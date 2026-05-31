# Engineering Standards

> Last revised: 2026-06-01. This document governs how v2 code is written. It exists alongside [`ARCHITECTURE.md`](ARCHITECTURE.md) (what the system *is*) and defines the *quality bar* every backend change must clear.

## 0. Why this document exists

This project has two goals that pull in different directions:

1. **It's a small app** — two-to-ten people per workspace, tens of users. Pragmatically, it does not *need* optimistic locking, foreign-key constraints, or a migration tool.
2. **It's a portfolio piece** — it's shown to interviewers as evidence of how the author builds backend systems.

When those two goals conflict, **goal 2 wins on the fundamentals and goal 1 wins on scope.** That means: the data layer, transaction handling, error contracts, and tests are built to a professional standard regardless of the app's size — but we do *not* add CQRS, event sourcing, hexagonal architecture, or microservices, because applying heavyweight patterns to a CRUD app is itself a signal of poor judgment.

**The portfolio thesis:** strong fundamentals applied deliberately, with the reasoning written down, and a short list of patterns consciously declined. A reviewer should come away thinking "this person knows what matters and what doesn't," not "this person knows every pattern."

Every "we deliberately did NOT do X" decision is logged in §10. That section is as important as the rest.

---

## 1. Schema management — Flyway, not auto-DDL

**Rule:** Hibernate runs with `ddl-auto: validate`. It never mutates the schema. All schema changes are versioned Flyway migrations under `src/main/resources/db/migration/`.

**Why:** `ddl-auto: update` cannot be trusted in production — it never drops columns, never alters types safely, and silently diverges from what the entity model implies. It also cannot create the foreign-key constraints we want (see §2). Flyway gives us:

- A reproducible schema any reviewer can recreate by cloning and booting.
- Real DDL we author by hand — including FK constraints, named indexes, and check constraints Hibernate would never generate.
- An auditable history (`flyway_schema_history` table) of how the schema evolved.
- `validate` mode as a safety net: if the entity model and the migrated schema disagree, the app refuses to start.

**Conventions:**

- Migration files: `V<n>__<snake_case_description>.sql` (e.g. `V1__baseline.sql`, `V2__add_resource_shares.sql`).
- One logical change per migration. Never edit a migration that has been applied to any shared database — write a new one.
- The v2 baseline is a single `V1__baseline.sql` that creates the entire multi-tenant schema from scratch (the v2 cutover wipes the DB, so there is no legacy schema to migrate *from*).
- Migrations are plain SQL (MariaDB dialect). No Java-based migrations unless a data backfill genuinely needs application logic.

**Cutover implication:** the v2 deploy is `DROP DATABASE; CREATE DATABASE;` → boot → Flyway replays `V1__baseline.sql`. This supersedes the "Hibernate recreates via ddl-auto" note in the v2 spec §7.

---

## 2. Entity & persistence rules

### 2.1 Reference by ID, enforce integrity at the DB

**Rule:** entities reference other aggregates by raw identifier (`val workspaceId: Long`), **not** by JPA association (`@ManyToOne Workspace`). Referential integrity is enforced by **explicit foreign-key constraints declared in Flyway migrations.**

**Why:** this is the DDD aggregate-boundary stance — an aggregate (Workspace, Note, CalcEntry) is consistency-bounded on its own and references other aggregates by identity, the same way a REST resource links by ID rather than embedding. Benefits:

- No accidental lazy-loading or N+1 surprises from walking an object graph.
- No `LazyInitializationException` leaking out of a closed persistence context.
- Aggregates stay independently loadable and testable.

The cost of reference-by-ID is that Hibernate won't generate FK constraints — so we add them by hand in the migration. We get loose object coupling *and* hard database integrity, which is the best of both:

```sql
-- in V1__baseline.sql
ALTER TABLE workspace_members
  ADD CONSTRAINT fk_ws_members_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE workspace_members
  ADD CONSTRAINT fk_ws_members_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

**`ON DELETE` policy:** membership rows cascade-delete with their workspace or user (they're meaningless without both). Resource tables (`notes`, `calc_entries`, etc.) use `ON DELETE RESTRICT` on `workspace_id` — a workspace cannot be hard-deleted while it still owns resources; the soft-delete + 30-day purge job (v2 spec §11.5) handles ordered teardown. The interview talking point: cascade vs restrict is chosen per-relationship based on whether the child can meaningfully outlive the parent.

### 2.2 Base entity & auditing

**Rule:** every entity extends a `BaseEntity` mapped superclass providing `id`, `createdAt`, `updatedAt`, and `version`. Audit timestamps are populated by Spring Data JPA auditing, never set by hand.

```kotlin
@MappedSuperclass
@EntityListeners(AuditingEntityListener::class)
abstract class BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null

    @CreatedDate @Column(name = "created_at", nullable = false, updatable = false)
    lateinit var createdAt: Instant
        protected set

    @LastModifiedDate @Column(name = "updated_at", nullable = false)
    lateinit var updatedAt: Instant
        protected set

    @Version @Column(name = "version", nullable = false)
    var version: Long = 0
        protected set
}
```

Enabled with `@EnableJpaAuditing` on a config class.

**Why:** consistent audit columns across every table without copy-paste; `updated_at` that's actually trustworthy; and `@Version` for optimistic locking (§2.3) on every entity for free.

**`createdBy` / authorship:** resources that have an author keep an explicit `createdByUserId: Long` field (not Spring's `@CreatedBy`, because our principal lookup is custom). Audit *timestamps* are framework-managed; audit *authorship* is domain data and stays explicit.

### 2.3 Optimistic locking

**Rule:** every mutable entity carries `@Version` (via `BaseEntity`). Concurrent updates that collide throw `OptimisticLockException`, which §4 maps to HTTP 409.

**Why:** even at small scale, two devices editing the same note (the actual use case — a couple sharing a notebook) can race. Last-write-wins silently dropping one person's edit is a real, user-visible bug, not a theoretical one. Optimistic locking turns it into a detectable 409 the frontend can handle (reload + retry) instead of silent data loss. This is *the* concurrency story for the app and a clean thing to explain in an interview: "I chose optimistic over pessimistic because reads vastly outnumber write-conflicts, so I pay the cost only when a conflict actually happens."

### 2.4 Uniqueness & race conditions

**Rule:** uniqueness is enforced by a DB unique constraint *and* checked in the service for a friendly error. The service catches `DataIntegrityViolationException` from the constraint as the authoritative backstop — the pre-check is UX, the constraint is truth.

**Why:** the check-then-insert in `WorkspaceService.create` (slug uniqueness) has a time-of-check-to-time-of-use gap. Two simultaneous requests can both pass the `existsBy...` check and then both insert. The unique index is what actually prevents the duplicate; the service must catch the resulting integrity violation and translate it to the same clean error the pre-check would have produced. Pre-check for the common case, constraint for the race. Documenting that you know the pre-check alone is insufficient is exactly the kind of rigor a reviewer looks for.

---

## 3. Transaction boundaries

**Rules:**

- Transactions live at the **service layer**, never in controllers or repositories.
- Read-only service methods are annotated `@Transactional(readOnly = true)` — lets the driver/JDBC skip dirty-checking and flush, and documents intent.
- Write methods are `@Transactional` (default propagation `REQUIRED`).
- A single service method that performs multiple writes (e.g. create workspace + create OWNER membership) is one transaction — both succeed or both roll back. This is already how `WorkspaceService.create` works and is the canonical example.
- No business logic spans two transactions when it should be atomic. If a flow needs to call out (email send, HTTP) mid-transaction, the side effect is deferred until after commit (`TransactionSynchronization` / application event published `AFTER_COMMIT`), so a rolled-back transaction never sends a real-world message.

**Why:** the service layer owns the unit of work because it owns the business invariant. Controllers translate HTTP; repositories translate SQL; only the service knows "these three writes are one logical operation." The `AFTER_COMMIT` rule matters for Phase D (invitations): we must not email "you've been invited" inside a transaction that then rolls back.

---

## 4. Error handling — RFC 7807 Problem Details

**Rule:** all API errors are returned as `application/problem+json` using Spring 6's built-in `ProblemDetail`. A single `@RestControllerAdvice` translates exceptions to problem responses. No controller returns an ad-hoc error map.

**Shape:**

```json
{
  "type": "https://shared-docs/errors/slug-taken",
  "title": "Workspace slug already taken",
  "status": 409,
  "detail": "A workspace with slug 'work' already exists for this user.",
  "instance": "/api/workspaces"
}
```

**Exception → status map (the advice):**

| Exception | Status | type slug |
|---|---|---|
| `MissingWorkspaceContextException` | 400 | `missing-workspace-context` |
| `MethodArgumentNotValidException` (Bean Validation) | 400 | `validation-failed` (with `errors` extension) |
| `WorkspaceSlugTakenException` | 409 | `slug-taken` |
| `OptimisticLockException` / `ObjectOptimisticLockingFailureException` | 409 | `concurrent-modification` |
| `AccessDeniedException` | 403 | `forbidden` |
| `ResourceNotFoundException` | 404 | `not-found` |
| Uncaught | 500 | `internal` (no leak of stack/SQL) |

**Why:** RFC 7807 is the modern standard for HTTP error bodies, Spring 6 supports it natively (no library), and it gives the frontend one consistent contract to parse instead of guessing each endpoint's shape. Domain exceptions (`WorkspaceSlugTakenException`) replace the current `throw IllegalStateException("...")` — typed exceptions carry their HTTP semantics into the advice cleanly.

**404-not-403 rule for tenancy:** when a caller requests a resource in a workspace they don't belong to, return **404, not 403** — don't leak the existence of other tenants' data. (403 is only for "you're authenticated and we're telling you no" within your own scope.)

**Frontend contract:** `apiClient` parses `problem+json`; the axios error interceptor surfaces `title`/`detail` to the UI. Validation errors carry a `errors: {field: message}` extension the forms read.

---

## 5. Validation

**Rule:** request DTOs use Bean Validation annotations (`@field:NotBlank`, `@field:Size`, `@field:Email`). Controllers annotate the body `@Valid`. Validation failures become 400 problem responses (§4) automatically.

**Why:** validation belongs at the edge, declaratively, not as hand-rolled `if (x.isBlank())` scattered through services. Example:

```kotlin
data class CreateWorkspaceRequest(
    @field:NotBlank @field:Size(max = 80) val name: String,
    @field:NotBlank @field:Size(max = 40) @field:Pattern(regexp = "^[a-z0-9-]+$") val slug: String,
)
```

The slug pattern enforcing lowercase-kebab is a domain rule that belongs on the DTO, not in the service.

---

## 6. Layering & DTO discipline

Unchanged from `ARCHITECTURE.md` §4, restated as enforceable rules:

- **Controller** → HTTP only: parse request, call one service method, map to response DTO, set status. No business logic, no repository access.
- **Service** → business logic + transaction boundary. Accepts primitives/commands, returns domain objects or DTOs. Never returns a JPA entity to a controller that serializes it directly.
- **Repository** → Spring Data JPA. Query methods + `@Query` JPQL. No logic.
- **Entity** → never serialized to JSON. Always mapped to a response DTO. This prevents lazy-loading-during-serialization bugs and accidental field leakage (e.g. never shipping `version` or internal columns unless intended).

**Mapping:** hand-written `toResponse()` extension functions (already the pattern). No MapStruct/ModelMapper — reflection-based mappers are harder to debug and hide field drift; explicit mapping is a feature, not boilerplate, at this size.

---

## 7. Testing

### 7.1 Test database

**Rule:** tests run against a dedicated `shared_docs_test` database on the **existing** MariaDB container (`lunch-select-db`, port 3307) — never against `shared_docs` (the dev/prod database). A `test` Spring profile points the datasource at `shared_docs_test` with `createDatabaseIfNotExist=true` so it materializes on first run. Flyway migrates it; `@Transactional` tests roll back per-method.

```yaml
# application.yml — test profile
spring:
  config:
    activate:
      on-profile: test
  datasource:
    url: jdbc:mariadb://localhost:3307/shared_docs_test?createDatabaseIfNotExist=true&characterEncoding=UTF-8
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
```

**Why not Testcontainers:** the constraint is real — the Mac Mini runs one always-on MariaDB container shared by two projects; spinning a fresh container per test run isn't wanted. Schema-isolating into `shared_docs_test` on that same instance gives the critical guarantee (tests never touch real data) without new infrastructure. The tradeoff vs Testcontainers — tests assume a MariaDB is reachable on :3307 — is documented here and acceptable given the always-on setup. *(If this ever moves to CI, Testcontainers becomes the right answer; noting that I know the difference is the point.)*

**Why not H2:** H2 wouldn't exercise MariaDB-specific behavior we depend on — the NULL-distinct unique index on `workspace_members(workspace_id, user_id, left_at)`, FK cascade semantics, dialect quirks. Testing against the real engine is the only way those invariants are actually verified.

### 7.2 What to test

- **Tenancy isolation is the headline invariant.** Every resource feature gets at least one integration test proving workspace A cannot read/write workspace B's data. This is the bug v2 most fears; it gets explicit coverage.
- **Service-layer integration tests** over the real DB for anything with a non-trivial query or transaction (the `WorkspaceServiceTest` pattern).
- **Slice tests** (`@WebMvcTest`) for controller/advice behavior — that exceptions map to the right problem+json status — without booting the full context.
- **Plain unit tests** for pure logic (the calc `compute/` functions are the model case; no Spring needed).
- We do **not** chase coverage percentage. We test invariants, edge cases, and the things that would actually break. Coverage is an output, not a target.

### 7.3 Test naming

Backtick descriptive names (`workspace A cannot see workspace B's notes`). Arrange-act-assert structure. One behavioral assertion per test where practical.

---

## 8. API conventions

- REST resource URLs, plural nouns (`/api/workspaces`, `/api/notes`).
- Correct status codes: 200 read, 201 create (+ `Location` where meaningful), 204 delete-with-no-body, 400/403/404/409 per §4.
- Workspace context via `X-Workspace-Id` header (v2 spec §4). Workspace-meta endpoints (`/api/workspaces/**`) are exempt.
- List endpoints that can grow unbounded (notes, calc entries) return paginated results (`Pageable`) before v2 ships — not in Phase A, but a tracked obligation, not an afterthought.

---

## 9. Observability & operational hygiene

Lightweight but present:

- Structured logging via SLF4J. No `println`. Log at the boundary of significant operations (workspace created, member invited, login rejected) at INFO; everything routine at DEBUG.
- No secrets, tokens, or full request bodies in logs.
- Actuator `health`/`info` stay exposed (already configured) for the container healthcheck.
- Meaningful exception messages — but the *user* sees the problem+json `detail`, never a stack trace.

---

## 10. Patterns we deliberately do NOT use

This section is intentional. Each is a pattern a reviewer might expect, with the reason it would be wrong here. Knowing when *not* to reach for something is the senior signal.

| Pattern | Why we skip it |
|---|---|
| **CQRS** (separate read/write models) | The read and write models are identical for a CRUD notes app. Splitting them would double the code to maintain a distinction that doesn't exist here. Revisit only if a read path needs a genuinely different shape than its write path. |
| **Event sourcing** | We need current state, not an event log we replay. The audit trail the *product* wants (Decisions history) is a domain feature stored as ordinary rows, not an infrastructure-level event store. |
| **Hexagonal / ports-and-adapters** | The layered controller→service→repository structure already isolates the domain from web and persistence concerns adequately at this size. Full ports-and-adapters would add indirection (interfaces with one implementation) without a second adapter ever materializing. |
| **Microservices** | One small app, one team of one. A modular monolith with clean package-per-feature boundaries is strictly better here — no network calls, no distributed-transaction problem, trivial deploy. |
| **MapStruct / reflection mappers** | Explicit `toResponse()` functions are easier to read, debug, and grep. Hidden mapping is a liability, not a convenience, at this scale. |
| **A caching layer (Redis etc.)** | No demonstrated read-latency problem. Adding a cache invites cache-invalidation bugs to solve a problem we don't have. JPA's first-level cache within a transaction is enough. |
| **Pessimistic DB locking** | Reads vastly outnumber write-conflicts; optimistic locking (§2.3) pays its cost only on actual collision. Pessimistic locking would serialize access we don't need to serialize. |

If any of these becomes justified by a real requirement later, that's a new ADR-style entry — not a "while we're here."

---

## 11. Applying this to existing Phase A code

The four commits already on `v2-multi-tenant` (`Workspace`, `WorkspaceMember`, repositories, `WorkspaceService` + tests) predate this document and must be retrofitted before Phase A continues:

1. Add Flyway; author `V1__baseline.sql` for `workspaces` + `workspace_members` (+ FK constraints, indexes). Switch `ddl-auto` to `validate`.
2. Introduce `BaseEntity` (id/createdAt/updatedAt/version); make `Workspace` and `WorkspaceMember` extend it. Enable JPA auditing.
3. Replace `throw IllegalStateException` in `WorkspaceService` with a typed `WorkspaceSlugTakenException`, and catch `DataIntegrityViolationException` as the race backstop (§2.4).
4. Add the `@RestControllerAdvice` + `ProblemDetail` mapping (§4).
5. Add the `test` profile + `shared_docs_test` datasource; confirm the existing 6 tests pass against it.
6. Add Bean Validation to `CreateWorkspaceRequest` when Task 5 (controller) lands.

This retrofit is tracked as **Task 0** in the Phase A plan and is done before Task 5 (controller). The Phase A plan's per-feature pattern (Task 10) is amended so every entity extends `BaseEntity` and every feature ships its FK constraints in a migration.

---

## 12. Pointers

- What the system is: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- What we're building & why: [`VISION.md`](VISION.md), [`plans/2026-05-29-multi-tenant-v2.md`](plans/2026-05-29-multi-tenant-v2.md)
- Build order: [`ROADMAP.md`](ROADMAP.md)
- Visual rules: [`DESIGN.md`](DESIGN.md)
