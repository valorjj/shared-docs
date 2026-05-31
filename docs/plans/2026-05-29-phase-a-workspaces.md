# Phase A: Workspaces + Memberships + Scoped Reads — Implementation Plan

> **▶ RESUME POINT (2026-06-01): Task 5** — `WorkspaceDto` + `WorkspaceController`.
> Done so far: Section 1 Tasks 1–4 (entities, repos, service+tests) and **all of Section 0** (engineering-standards retrofit: Flyway, BaseEntity, RFC 7807, test profile). Backend `v2-multi-tenant` HEAD = `00bf5d9`. Both repos on branch `v2-multi-tenant`. Local dev DB `shared_docs` is now Flyway-owned (wiped + rebuilt from V1). DB access for tooling: `localhost:3307`, user `root`, pwd `1qaz!QAZ`, databases `shared_docs` (dev) / `shared_docs_test` (tests).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce workspace tenancy throughout the backend and frontend. Every resource gains a `workspace_id`; every read/write filters by it; every API request carries `X-Workspace-Id`. The existing app keeps working — on first sign-in a personal workspace is auto-created and the app behaves as if it always had one.

**Architecture:** New `Workspace` + `WorkspaceMember` entities. `WorkspaceContextFilter` reads `X-Workspace-Id` from each request, validates the caller is an active member, and exposes the resolved workspace via a `@CurrentWorkspace` argument resolver. Every existing repository gains a `workspaceId` parameter. The OAuth handler creates a personal workspace on first sign-in. Frontend axios interceptor injects the header from `localStorage`; an `ActiveWorkspaceProvider` syncs the state into React context.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + MariaDB. **Flyway** versioned migrations with `ddl-auto: validate` (per [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md) §1 — *not* `ddl-auto: update`). Vite + React 19 + TypeScript + axios + React Query.

**Branch:** all work on `v2-multi-tenant` (both repos). Nothing merges to `main` until v2 cutover.

**Engineering standards:** every backend change in this plan conforms to [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md) — Flyway migrations, `BaseEntity` + auditing, `@Version` optimistic locking, reference-by-ID + explicit FK constraints, RFC 7807 errors, Bean Validation. **Section 0 below retrofits the already-committed Tasks 1–4 to that standard before the controller (Task 5) lands.**

**Test posture:** tests run against a dedicated `shared_docs_test` database on the existing :3307 MariaDB container (ENGINEERING-STANDARDS §7.1) — never against `shared_docs`. This phase adds integration tests at the workspace-isolation boundary (the place where v2's defining bug — "user A sees user B's data" — would be born). Foundation tasks use full TDD. Per-feature scoping tasks use one isolation integration test per feature.

**Estimated effort:** 9–12 working days (was 7–10; +2 for the standards retrofit and per-feature migrations).

---

## File inventory

### Backend — new files

```
src/main/kotlin/com/shareddocs/backend/
├── common/
│   └── BaseEntity.kt              ← id/createdAt/updatedAt/version superclass (§0)
├── config/
│   ├── JpaAuditingConfig.kt       ← @EnableJpaAuditing (§0)
│   └── ApiExceptionHandler.kt     ← @RestControllerAdvice, RFC 7807 (§0)
└── workspace/
    ├── Workspace.kt
    ├── WorkspaceRepository.kt
    ├── WorkspaceMember.kt
    ├── WorkspaceMemberRepository.kt
    ├── WorkspaceRole.kt
    ├── WorkspaceService.kt
    ├── WorkspaceSlugTakenException.kt   ← typed domain exception (§0)
    ├── WorkspaceController.kt
    ├── WorkspaceDto.kt
    ├── CurrentWorkspace.kt              ← argument-resolver annotation
    ├── WorkspaceContextFilter.kt        ← reads X-Workspace-Id, validates membership
    ├── WorkspaceContextHolder.kt        ← request-scoped store
    └── WorkspaceWebConfig.kt            ← registers the resolver

src/main/resources/db/migration/
└── V1__baseline.sql               ← full v2 schema, FK constraints, indexes (§0)

src/test/kotlin/com/shareddocs/backend/workspace/
├── WorkspaceServiceTest.kt
├── WorkspaceContextFilterTest.kt
└── OAuth2SuccessHandlerWorkspaceBootstrapTest.kt
```

### Backend — modified files

```
src/main/kotlin/com/shareddocs/backend/auth/OAuth2SuccessHandler.kt
src/main/kotlin/com/shareddocs/backend/auth/DevAuthController.kt
src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt   ← register filter

every resource entity (add workspace_id):
├── note/Note.kt + EntityRef.kt + Attachment.kt
├── sheet/Sheet.kt
├── calc/CalcEntry.kt
├── purchase/Purchase.kt + PurchaseCategory.kt
├── settlement/Settlement.kt
├── recurring/RecurringPurchase.kt
├── todo/Todo.kt + TodoCategory.kt
├── anniversary/Anniversary.kt + AnniversaryCategory.kt
├── link/Link.kt + LinkCategory.kt
├── recipe/Recipe.kt + RecipeStep.kt + RecipeIngredient.kt

every resource entity also extends BaseEntity (id/createdAt/updatedAt/version)
every resource repository (filter by workspaceId)
every resource service (read currentWorkspace from @CurrentWorkspace)
every resource controller (declare @CurrentWorkspace parameter)
every feature ships its workspace_id column + FK constraint in a Flyway migration

build.gradle.kts                     ← add Flyway dependency (org.flywaydb:flyway-mysql)
src/main/resources/application.yml   ← Flyway config; ddl-auto: validate; test profile
```

### Frontend — new files

```
src/auth/workspaceStorage.ts       ← localStorage helpers
src/auth/ActiveWorkspaceProvider.tsx
src/auth/useActiveWorkspace.ts
src/api/workspaces.ts              ← typed client for /api/workspaces
src/features/workspaces/types.ts
```

### Frontend — modified files

```
src/api/client.ts                  ← X-Workspace-Id interceptor
src/auth/AuthProvider.tsx          ← mount ActiveWorkspaceProvider
src/pages/AuthCallback.tsx         ← seed active workspace on first sign-in
src/App.tsx                        ← wire provider
```

---

## Prerequisites

- [ ] Both repos checked out on `v2-multi-tenant` branch (verify: `git rev-parse --abbrev-ref HEAD` returns `v2-multi-tenant`).
- [ ] The shared MariaDB container is running on :3307 (`docker ps` → `lunch-select-db`). It is shared with the lunch-select project; the `shared_docs` DB lives inside it.
- [ ] Tasks 1–4 are already committed (entities, repositories, `WorkspaceService` + 6 tests). **Section 0 retrofits them to the engineering standard before Task 5.**
- [ ] Frontend dev server starts: `npm run dev` from `shared-docs/`.

> **Note on the v1 dev DB:** Section 0 introduces Flyway with `ddl-auto: validate`. Because the current `shared_docs` dev DB was built by Hibernate `ddl-auto: update` (v1 schema), Flyway `validate` will fail against it. Per the v2 cutover model, wipe the dev DB so Flyway owns the schema cleanly: `mysql -h 127.0.0.1 -P 3307 -u root -p1qaz!QAZ -e "DROP DATABASE IF EXISTS shared_docs; CREATE DATABASE shared_docs;"`. The `shared_docs_test` DB is created automatically by the test profile.

---

# Section 0 — Engineering-standards retrofit

> ✅ **COMPLETE (2026-06-01)** — backend commits `6121cab` (delete EntityRefBackfill), `f5a1c1a` (BaseEntity + auditing), `165048f` (Flyway + V1 baseline + validate + test profile), `00bf5d9` (typed exception + RFC 7807 advice). 6/6 WorkspaceServiceTest green against `shared_docs_test`; local-profile bootRun verified (Flyway applies V1, validate passes, Tomcat starts).
>
> **One deferred item:** the `@WebMvcTest` asserting the advice renders `problem+json` waits for Task 5 (needs a controller to throw through). The service test already asserts the typed exception.
>
> Executed AFTER the already-committed Tasks 1–4, BEFORE the controller (Task 5). Brings the foundation up to [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md). No new feature behavior — this is infrastructure the rest of Phase A builds on.

## Task 0a: Add Flyway + switch to `ddl-auto: validate`

**Files:**
- Modify: `shared-docs-backend/build.gradle.kts`
- Modify: `shared-docs-backend/src/main/resources/application.yml`
- Create: `shared-docs-backend/src/main/resources/db/migration/V1__baseline.sql`

- [ ] **Step 1: Add the Flyway dependency**

```kotlin
// build.gradle.kts dependencies
implementation("org.flywaydb:flyway-core")
implementation("org.flywaydb:flyway-mysql")   // MariaDB uses the MySQL-family module
```

- [ ] **Step 2: Author `V1__baseline.sql`** — the full schema for everything that exists so far, with FK constraints and indexes. This will GROW as each feature in Section 4 adds its tables (or each feature can author its own `V<n>__<feature>.sql` — decide in Task 0a; recommended: one baseline for workspace + user tables, then per-feature migrations for resource tables so the diffs stay reviewable).

```sql
-- V1__baseline.sql (workspace + membership; user table already exists in v1 form)
CREATE TABLE workspaces (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    name                VARCHAR(80)  NOT NULL,
    slug                VARCHAR(40)  NOT NULL,
    created_by_user_id  BIGINT       NOT NULL,
    created_at          DATETIME(6)  NOT NULL,
    updated_at          DATETIME(6)  NOT NULL,
    version             BIGINT       NOT NULL DEFAULT 0,
    deleted_at          DATETIME(6)  NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_workspaces_slug_per_user UNIQUE (created_by_user_id, slug),
    CONSTRAINT fk_workspaces_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    INDEX idx_workspaces_created_by (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE workspace_members (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    workspace_id  BIGINT       NOT NULL,
    user_id       BIGINT       NOT NULL,
    role          VARCHAR(16)  NOT NULL,
    joined_at     DATETIME(6)  NOT NULL,
    left_at       DATETIME(6)  NULL,
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    version       BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_ws_members_active UNIQUE (workspace_id, user_id, left_at),
    CONSTRAINT fk_ws_members_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_ws_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ws_members_workspace (workspace_id),
    INDEX idx_ws_members_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> The `users` table is created by an earlier part of `V1__baseline.sql` (port the v1 Hibernate-generated `users` DDL by hand). Since the dev DB is wiped, Flyway owns the entire schema from boot.

- [ ] **Step 3: Configure Flyway + validate in `application.yml`**

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
    locations: classpath:db/migration
```

- [ ] **Step 4: Wipe dev DB, boot, confirm Flyway applies V1 and `validate` passes**

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p1qaz!QAZ -e "DROP DATABASE IF EXISTS shared_docs; CREATE DATABASE shared_docs;"
./gradlew bootRun   # expect: Flyway "Migrating schema to version 1 - baseline"; Hibernate validate OK
```

- [ ] **Step 5: Commit** — `feat(db): adopt Flyway + ddl-auto:validate, V1 baseline (Phase A T0a)`

## Task 0b: `BaseEntity` + JPA auditing

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/common/BaseEntity.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/config/JpaAuditingConfig.kt`
- Modify: `workspace/Workspace.kt`, `workspace/WorkspaceMember.kt` to extend `BaseEntity`

- [ ] **Step 1: `BaseEntity`** (exact shape in ENGINEERING-STANDARDS §2.2).
- [ ] **Step 2: `JpaAuditingConfig`** — `@Configuration @EnableJpaAuditing`.
- [ ] **Step 3:** make `Workspace` and `WorkspaceMember` extend `BaseEntity`; drop their now-inherited `id` and `createdAt` fields; add nothing else (version/updatedAt come from the superclass).
- [ ] **Step 4:** re-run `WorkspaceServiceTest` — all 6 still green against `shared_docs_test`.
- [ ] **Step 5: Commit** — `feat(workspace): extend BaseEntity (auditing + @Version) (Phase A T0b)`

## Task 0c: Typed exception + RFC 7807 advice

**Files:**
- Create: `workspace/WorkspaceSlugTakenException.kt`
- Create: `config/ApiExceptionHandler.kt`
- Modify: `workspace/WorkspaceService.kt`

- [ ] **Step 1:** `WorkspaceSlugTakenException(slug: String) : RuntimeException(...)`.
- [ ] **Step 2:** in `WorkspaceService.create`, replace `throw IllegalStateException(...)` with the typed exception, AND wrap the `memberRepository.save` / `workspaceRepository.save` so a `DataIntegrityViolationException` from the unique constraint is caught and rethrown as `WorkspaceSlugTakenException` (the TOCTOU backstop, ENGINEERING-STANDARDS §2.4).
- [ ] **Step 3:** `ApiExceptionHandler` (`@RestControllerAdvice`) mapping the §4 table to `ProblemDetail` responses — start with `WorkspaceSlugTakenException`→409, `MissingWorkspaceContextException`→400, `OptimisticLockingFailureException`→409, `ResourceNotFoundException`→404, validation→400, fallback→500.
- [ ] **Step 4:** update the slug-collision test to assert `WorkspaceSlugTakenException`. Add a `@WebMvcTest` slice test asserting it renders as 409 `problem+json`.
- [ ] **Step 5: Commit** — `feat(workspace): typed exceptions + RFC 7807 advice (Phase A T0c)`

## Task 0d: Test profile → `shared_docs_test`

**Files:**
- Modify: `application.yml` (add `test` profile per ENGINEERING-STANDARDS §7.1)
- Modify: existing test classes to add `@ActiveProfiles("test")` (replacing `"local"`)

- [ ] **Step 1:** add the `test` profile datasource pointing at `shared_docs_test` (`createDatabaseIfNotExist=true`), Flyway enabled, `ddl-auto: validate`.
- [ ] **Step 2:** switch the 3 workspace test classes from `@ActiveProfiles("local")` to `@ActiveProfiles("test")`.
- [ ] **Step 3:** run `./gradlew test` — confirm tests now target `shared_docs_test`, not `shared_docs`. Verify by checking the dev DB is untouched (`SELECT COUNT(*) FROM shared_docs.workspaces;` unaffected by a test run).
- [ ] **Step 4: Commit** — `test(workspace): isolate tests to shared_docs_test DB (Phase A T0d)`

---

# Section 1 — Workspace + Membership foundation

> ✅ **Tasks 1–4 are already committed** (`1c3d887`, `e18899f`, `07461ec`). They were written before the engineering-standards doc; Section 0 above retrofits them. Tasks 1–4 remain documented below for reference. Resume new work at Task 5.

These tasks have no per-feature repetition. Full TDD: write the test, see it fail, implement, see it pass.

## Task 1: `WorkspaceRole` enum + `Workspace` entity

These tasks have no per-feature repetition. Full TDD: write the test, see it fail, implement, see it pass.

## Task 1: `WorkspaceRole` enum + `Workspace` entity

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceRole.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/Workspace.kt`

- [ ] **Step 1: Write the enum**

```kotlin
// WorkspaceRole.kt
package com.shareddocs.backend.workspace

enum class WorkspaceRole {
    OWNER,
    MEMBER,
}
```

- [ ] **Step 2: Write the entity**

```kotlin
// Workspace.kt
package com.shareddocs.backend.workspace

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "workspaces",
    indexes = [
        Index(name = "idx_workspaces_created_by", columnList = "created_by_user_id"),
        Index(name = "idx_workspaces_slug_per_user", columnList = "created_by_user_id,slug", unique = true),
    ],
)
class Workspace(
    @Column(name = "name", nullable = false, length = 80)
    var name: String,

    @Column(name = "slug", nullable = false, length = 40)
    var slug: String,

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    val createdByUserId: Long,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Column(name = "deleted_at")
    var deletedAt: Instant? = null,

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
```

Note the unique index on `(created_by_user_id, slug)` — user-scoped slug namespace per the locked decision (§11.2 of the v2 spec).

- [ ] **Step 3: Verify Hibernate creates the table**

Run: `./gradlew bootRun` and check the SQL log for `create table workspaces`. Kill the server. No commit yet — pairs with Task 2.

## Task 2: `WorkspaceMember` entity

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceMember.kt`

- [ ] **Step 1: Write the entity**

```kotlin
package com.shareddocs.backend.workspace

import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "workspace_members",
    indexes = [
        Index(name = "idx_ws_members_workspace", columnList = "workspace_id"),
        Index(name = "idx_ws_members_user", columnList = "user_id"),
        Index(name = "idx_ws_members_unique_active", columnList = "workspace_id,user_id,left_at", unique = true),
    ],
)
class WorkspaceMember(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "user_id", nullable = false, updatable = false)
    val userId: Long,

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    var role: WorkspaceRole,

    @Column(name = "joined_at", nullable = false, updatable = false)
    val joinedAt: Instant = Instant.now(),

    @Column(name = "left_at")
    var leftAt: Instant? = null,

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
```

The unique index on `(workspace_id, user_id, left_at)` enforces "at most one active membership per user per workspace" while still allowing rejoin (a new row with a new `left_at = null` is fine because the previous row has a non-null `left_at`). MariaDB treats NULLs in unique indexes as distinct, which is the behavior we want.

- [ ] **Step 2: Restart backend, verify `workspace_members` table created**

- [ ] **Step 3: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/
git commit -m "feat(workspace): Workspace + WorkspaceMember entities (Phase A)"
```

## Task 3: `WorkspaceRepository` + `WorkspaceMemberRepository`

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceRepository.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceMemberRepository.kt`

- [ ] **Step 1: Write `WorkspaceRepository`**

```kotlin
package com.shareddocs.backend.workspace

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface WorkspaceRepository : JpaRepository<Workspace, Long> {
    fun findByIdAndDeletedAtIsNull(id: Long): Workspace?

    @Query("""
        SELECT w FROM Workspace w
        JOIN WorkspaceMember m ON m.workspaceId = w.id
        WHERE m.userId = :userId
          AND m.leftAt IS NULL
          AND w.deletedAt IS NULL
        ORDER BY w.createdAt ASC
    """)
    fun findAllForUser(@Param("userId") userId: Long): List<Workspace>

    fun existsByCreatedByUserIdAndSlug(createdByUserId: Long, slug: String): Boolean
}
```

- [ ] **Step 2: Write `WorkspaceMemberRepository`**

```kotlin
package com.shareddocs.backend.workspace

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface WorkspaceMemberRepository : JpaRepository<WorkspaceMember, Long> {
    @Query("""
        SELECT m FROM WorkspaceMember m
        WHERE m.workspaceId = :workspaceId
          AND m.userId = :userId
          AND m.leftAt IS NULL
    """)
    fun findActive(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): WorkspaceMember?

    fun findAllByWorkspaceIdAndLeftAtIsNullOrderByJoinedAtAsc(workspaceId: Long): List<WorkspaceMember>

    fun countByWorkspaceIdAndLeftAtIsNull(workspaceId: Long): Long
}
```

- [ ] **Step 3: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/
git commit -m "feat(workspace): repositories (Phase A)"
```

## Task 4: `WorkspaceService` — basic CRUD

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceService.kt`
- Create: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/WorkspaceServiceTest.kt`

- [ ] **Step 1: Write the failing test first**

```kotlin
package com.shareddocs.backend.workspace

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("local")
@Transactional
class WorkspaceServiceTest(
    @Autowired private val service: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val memberRepository: WorkspaceMemberRepository,
) {
    @Test
    fun `createPersonalWorkspace creates workspace + OWNER membership`() {
        val user = userRepository.save(User(email = "test@example.com", name = "Test", role = Role.USER))
        val ws = service.createPersonalWorkspace(user.id!!)

        assertNotNull(ws.id)
        assertEquals("내 워크스페이스", ws.name)
        assertEquals(user.id, ws.createdByUserId)

        val members = memberRepository.findAllByWorkspaceIdAndLeftAtIsNullOrderByJoinedAtAsc(ws.id!!)
        assertEquals(1, members.size)
        assertEquals(WorkspaceRole.OWNER, members[0].role)
        assertEquals(user.id, members[0].userId)
    }

    @Test
    fun `create with custom name + slug works and is per-user-unique`() {
        val user = userRepository.save(User(email = "u@example.com", name = "U", role = Role.USER))
        val ws1 = service.create(user.id!!, "직장", "work")
        val ws2 = service.create(user.id!!, "취미", "hobby")
        assertNotEquals(ws1.id, ws2.id)
    }

    @Test
    fun `slug collision per user is rejected`() {
        val user = userRepository.save(User(email = "c@example.com", name = "C", role = Role.USER))
        service.create(user.id!!, "Work", "work")
        assertThrows(IllegalStateException::class.java) { service.create(user.id!!, "Work2", "work") }
    }

    @Test
    fun `findVisibleToUser only returns workspaces the user belongs to`() {
        val alice = userRepository.save(User(email = "a@x.com", name = "A", role = Role.USER))
        val bob = userRepository.save(User(email = "b@x.com", name = "B", role = Role.USER))
        service.createPersonalWorkspace(alice.id!!)
        val bobWs = service.createPersonalWorkspace(bob.id!!)

        val aliceList = service.findAllForUser(alice.id!!)
        assertEquals(1, aliceList.size)
        assertNotEquals(bobWs.id, aliceList[0].id)
    }
}
```

- [ ] **Step 2: Run, watch it fail (no `WorkspaceService` yet)**

```bash
./gradlew test --tests "*WorkspaceServiceTest*"
```

Expected: compilation failure.

- [ ] **Step 3: Implement the service**

```kotlin
package com.shareddocs.backend.workspace

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class WorkspaceService(
    private val workspaceRepository: WorkspaceRepository,
    private val memberRepository: WorkspaceMemberRepository,
) {
    @Transactional
    fun createPersonalWorkspace(userId: Long): Workspace =
        create(userId, name = "내 워크스페이스", slug = "personal")

    @Transactional
    fun create(userId: Long, name: String, slug: String): Workspace {
        if (workspaceRepository.existsByCreatedByUserIdAndSlug(userId, slug)) {
            throw IllegalStateException("workspace slug already taken: $slug")
        }
        val ws = workspaceRepository.save(
            Workspace(name = name, slug = slug, createdByUserId = userId)
        )
        memberRepository.save(
            WorkspaceMember(workspaceId = ws.id!!, userId = userId, role = WorkspaceRole.OWNER)
        )
        return ws
    }

    fun findAllForUser(userId: Long): List<Workspace> =
        workspaceRepository.findAllForUser(userId)

    fun findActiveById(id: Long): Workspace? =
        workspaceRepository.findByIdAndDeletedAtIsNull(id)

    fun isActiveMember(workspaceId: Long, userId: Long): Boolean =
        memberRepository.findActive(workspaceId, userId) != null
}
```

- [ ] **Step 4: Re-run, watch tests pass**

```bash
./gradlew test --tests "*WorkspaceServiceTest*"
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared-docs-backend/src/{main,test}/kotlin/com/shareddocs/backend/workspace/WorkspaceService*
git commit -m "feat(workspace): WorkspaceService + integration tests (Phase A)"
```

## Task 5: `WorkspaceDto` + `WorkspaceController` (basic surface)

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceDto.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceController.kt`

This phase ships the read endpoints (`GET /api/workspaces`, `GET /api/workspaces/:id`) and creation. Rename, delete, member management ship in **Phase B**.

- [ ] **Step 1: Write the DTOs**

```kotlin
// WorkspaceDto.kt
package com.shareddocs.backend.workspace

import java.time.Instant

data class WorkspaceResponse(
    val id: Long,
    val name: String,
    val slug: String,
    val createdByUserId: Long,
    val createdAt: Instant,
)

data class CreateWorkspaceRequest(
    val name: String,
    val slug: String,
)

fun Workspace.toResponse(): WorkspaceResponse = WorkspaceResponse(
    id = id!!,
    name = name,
    slug = slug,
    createdByUserId = createdByUserId,
    createdAt = createdAt,
)
```

- [ ] **Step 2: Write the controller**

```kotlin
// WorkspaceController.kt
package com.shareddocs.backend.workspace

import com.shareddocs.backend.auth.AppPrincipal
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/workspaces")
class WorkspaceController(
    private val service: WorkspaceService,
) {
    @GetMapping
    fun list(@AuthenticationPrincipal me: AppPrincipal): List<WorkspaceResponse> =
        service.findAllForUser(me.userId).map { it.toResponse() }

    @GetMapping("/{id}")
    fun detail(@PathVariable id: Long, @AuthenticationPrincipal me: AppPrincipal): ResponseEntity<WorkspaceResponse> {
        val ws = service.findActiveById(id) ?: return ResponseEntity.notFound().build()
        if (!service.isActiveMember(ws.id!!, me.userId)) return ResponseEntity.notFound().build()
        return ResponseEntity.ok(ws.toResponse())
    }

    @PostMapping
    fun create(
        @RequestBody req: CreateWorkspaceRequest,
        @AuthenticationPrincipal me: AppPrincipal,
    ): ResponseEntity<WorkspaceResponse> {
        val ws = service.create(me.userId, req.name, req.slug)
        return ResponseEntity.status(201).body(ws.toResponse())
    }
}
```

- [ ] **Step 3: Smoke-test manually**

```bash
./gradlew bootRun &
# Get a JWT via dev-login (or Google flow)
curl -X POST http://localhost:8090/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'
# Use the returned token:
curl http://localhost:8090/api/workspaces -H "Authorization: Bearer $TOKEN"
# Expect: empty array (no workspace yet — Task 6 fixes that)
```

- [ ] **Step 4: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceDto.kt \
        shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceController.kt
git commit -m "feat(workspace): list/detail/create endpoints (Phase A)"
```

---

# Section 2 — Request context plumbing

The `@CurrentWorkspace` resolver + `WorkspaceContextFilter` is the load-bearing infrastructure for v2. Every workspace-scoped endpoint relies on it. Test it carefully.

## Task 6: `WorkspaceContextHolder` + `@CurrentWorkspace` annotation

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceContextHolder.kt`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/CurrentWorkspace.kt`

- [ ] **Step 1: Annotation marker**

```kotlin
// CurrentWorkspace.kt
package com.shareddocs.backend.workspace

@Target(AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
annotation class CurrentWorkspace
```

- [ ] **Step 2: Holder (request-scoped via attribute)**

```kotlin
// WorkspaceContextHolder.kt
package com.shareddocs.backend.workspace

import jakarta.servlet.http.HttpServletRequest

object WorkspaceContextHolder {
    private const val ATTR_KEY = "shareddocs.currentWorkspace"

    fun set(request: HttpServletRequest, workspace: Workspace) {
        request.setAttribute(ATTR_KEY, workspace)
    }

    fun get(request: HttpServletRequest): Workspace? =
        request.getAttribute(ATTR_KEY) as? Workspace
}
```

We use request attributes (not ThreadLocal) so we get automatic cleanup on request completion.

## Task 7: `WorkspaceContextFilter`

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceContextFilter.kt`
- Create: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/WorkspaceContextFilterTest.kt`

The filter sits AFTER `JwtAuthFilter` and BEFORE controllers. If the request:
- has no `X-Workspace-Id` → pass through (some endpoints don't need workspace; e.g., `/api/workspaces`, `/api/auth/*`).
- has a valid header → validate the user is an active member, stash workspace on the request.
- has an invalid header (workspace doesn't exist or user isn't a member) → 403.

- [ ] **Step 1: Write the failing test**

```kotlin
// WorkspaceContextFilterTest.kt
package com.shareddocs.backend.workspace

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.user.Role
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.*
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder

class WorkspaceContextFilterTest {

    private val workspaceService: WorkspaceService = mock()
    private val filter = WorkspaceContextFilter(workspaceService)
    private val chain: FilterChain = mock()

    @BeforeEach
    fun setup() {
        SecurityContextHolder.clearContext()
    }

    private fun authenticated(userId: Long) {
        val principal = AppPrincipal(userId = userId, email = "x@x.com", role = Role.USER)
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, null, emptyList())
    }

    @Test
    fun `no header passes through without setting context`() {
        val req: HttpServletRequest = mock { on { getHeader("X-Workspace-Id") } doReturn null }
        val res: HttpServletResponse = mock()
        filter.doFilter(req, res, chain)
        verify(chain).doFilter(req, res)
        assertNull(WorkspaceContextHolder.get(req))
    }

    @Test
    fun `valid header for member sets workspace and continues`() {
        authenticated(userId = 1L)
        val ws = Workspace(name = "x", slug = "x", createdByUserId = 1L, id = 99L)
        whenever(workspaceService.findActiveById(99L)).thenReturn(ws)
        whenever(workspaceService.isActiveMember(99L, 1L)).thenReturn(true)

        val req: HttpServletRequest = mock { on { getHeader("X-Workspace-Id") } doReturn "99" }
        val res: HttpServletResponse = mock()

        filter.doFilter(req, res, chain)
        verify(chain).doFilter(req, res)
        verify(req).setAttribute(eq("shareddocs.currentWorkspace"), eq(ws))
    }

    @Test
    fun `non-member is rejected 403`() {
        authenticated(userId = 1L)
        val ws = Workspace(name = "x", slug = "x", createdByUserId = 2L, id = 99L)
        whenever(workspaceService.findActiveById(99L)).thenReturn(ws)
        whenever(workspaceService.isActiveMember(99L, 1L)).thenReturn(false)

        val req: HttpServletRequest = mock { on { getHeader("X-Workspace-Id") } doReturn "99" }
        val res: HttpServletResponse = mock()
        filter.doFilter(req, res, chain)

        verify(res).status = 403
        verify(chain, never()).doFilter(any(), any())
    }

    @Test
    fun `nonexistent workspace id is rejected 403`() {
        authenticated(userId = 1L)
        whenever(workspaceService.findActiveById(404L)).thenReturn(null)

        val req: HttpServletRequest = mock { on { getHeader("X-Workspace-Id") } doReturn "404" }
        val res: HttpServletResponse = mock()
        filter.doFilter(req, res, chain)

        verify(res).status = 403
        verify(chain, never()).doFilter(any(), any())
    }

    @Test
    fun `malformed header is rejected 400`() {
        authenticated(userId = 1L)
        val req: HttpServletRequest = mock { on { getHeader("X-Workspace-Id") } doReturn "not-a-number" }
        val res: HttpServletResponse = mock()
        filter.doFilter(req, res, chain)
        verify(res).status = 400
        verify(chain, never()).doFilter(any(), any())
    }
}
```

This test depends on `org.mockito.kotlin:mockito-kotlin`. If it's not on the classpath, add it to `build.gradle.kts`:

```kotlin
testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
```

- [ ] **Step 2: Implement the filter**

```kotlin
// WorkspaceContextFilter.kt
package com.shareddocs.backend.workspace

import com.shareddocs.backend.auth.AppPrincipal
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class WorkspaceContextFilter(
    private val workspaceService: WorkspaceService,
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val header = request.getHeader(WORKSPACE_HEADER)
        if (header.isNullOrBlank()) {
            filterChain.doFilter(request, response)
            return
        }

        val workspaceId = header.toLongOrNull()
        if (workspaceId == null) {
            response.status = 400
            return
        }

        val auth = SecurityContextHolder.getContext().authentication
        val principal = auth?.principal as? AppPrincipal
        if (principal == null) {
            // unauthenticated requests with a header — should never happen, but be safe
            filterChain.doFilter(request, response)
            return
        }

        val workspace = workspaceService.findActiveById(workspaceId)
        if (workspace == null) {
            response.status = 403
            return
        }
        if (!workspaceService.isActiveMember(workspace.id!!, principal.userId)) {
            response.status = 403
            return
        }

        WorkspaceContextHolder.set(request, workspace)
        filterChain.doFilter(request, response)
    }

    companion object {
        const val WORKSPACE_HEADER = "X-Workspace-Id"
    }
}
```

- [ ] **Step 3: Register the filter in `SecurityConfig.kt`**

Modify `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt` — add the new filter right after `JwtAuthFilter`:

```kotlin
// constructor: add WorkspaceContextFilter
class SecurityConfig(
    private val jwtAuthFilter: JwtAuthFilter,
    private val workspaceContextFilter: WorkspaceContextFilter,   // ← new
    ...
)

// in securityFilterChain(...):
.addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
.addFilterAfter(workspaceContextFilter, JwtAuthFilter::class.java)   // ← new
```

- [ ] **Step 4: Run tests**

```bash
./gradlew test --tests "*WorkspaceContextFilterTest*"
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/{WorkspaceContextHolder,CurrentWorkspace,WorkspaceContextFilter}.kt \
        shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt \
        shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/WorkspaceContextFilterTest.kt \
        shared-docs-backend/build.gradle.kts
git commit -m "feat(workspace): WorkspaceContextFilter + @CurrentWorkspace plumbing (Phase A)"
```

## Task 8: `@CurrentWorkspace` argument resolver

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceWebConfig.kt`

- [ ] **Step 1: Write the resolver**

```kotlin
// WorkspaceWebConfig.kt
package com.shareddocs.backend.workspace

import jakarta.servlet.http.HttpServletRequest
import org.springframework.context.annotation.Configuration
import org.springframework.core.MethodParameter
import org.springframework.web.bind.support.WebDataBinderFactory
import org.springframework.web.context.request.NativeWebRequest
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.method.support.ModelAndViewContainer
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WorkspaceWebConfig : WebMvcConfigurer {
    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(CurrentWorkspaceArgumentResolver())
    }
}

class CurrentWorkspaceArgumentResolver : HandlerMethodArgumentResolver {
    override fun supportsParameter(parameter: MethodParameter): Boolean =
        parameter.hasParameterAnnotation(CurrentWorkspace::class.java) &&
            parameter.parameterType == Workspace::class.java

    override fun resolveArgument(
        parameter: MethodParameter,
        mavContainer: ModelAndViewContainer?,
        webRequest: NativeWebRequest,
        binderFactory: WebDataBinderFactory?,
    ): Any {
        val request = webRequest.getNativeRequest(HttpServletRequest::class.java)
            ?: error("No HTTP request bound to controller")
        return WorkspaceContextHolder.get(request)
            ?: throw MissingWorkspaceContextException()
    }
}

class MissingWorkspaceContextException : RuntimeException("X-Workspace-Id header is required for this endpoint")
```

- [ ] **Step 2: Add an exception handler so the 400 doesn't render as a 500**

Modify (or create if it doesn't exist) `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/config/ApiExceptionHandler.kt`:

```kotlin
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(MissingWorkspaceContextException::class)
    fun handleMissingWorkspace(e: MissingWorkspaceContextException): ResponseEntity<Map<String, String>> =
        ResponseEntity.status(400).body(mapOf("error" to "missing_workspace_context", "message" to e.message.orEmpty()))
}
```

(If `ApiExceptionHandler` doesn't exist yet, create it with the appropriate imports.)

- [ ] **Step 3: Smoke-test by adding `@CurrentWorkspace ws: Workspace` to a controller method temporarily**

Pick any existing controller, add the parameter, run the app, hit the endpoint without `X-Workspace-Id` → expect 400. Hit it with a valid header → expect 200 with the workspace resolved. Then revert the temporary change.

- [ ] **Step 4: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceWebConfig.kt \
        shared-docs-backend/src/main/kotlin/com/shareddocs/backend/config/ApiExceptionHandler.kt
git commit -m "feat(workspace): @CurrentWorkspace argument resolver (Phase A)"
```

---

# Section 3 — OAuth flow integration

The OAuth handler creates a personal workspace on first sign-in. After this section, every signed-in user has at least one workspace.

## Task 9: `OAuth2SuccessHandler` — auto-create personal workspace

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/OAuth2SuccessHandler.kt`
- Create: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/OAuth2SuccessHandlerWorkspaceBootstrapTest.kt`

- [ ] **Step 1: Write the failing test**

```kotlin
// OAuth2SuccessHandlerWorkspaceBootstrapTest.kt
package com.shareddocs.backend.workspace

import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("local")
@Transactional
class OAuth2SuccessHandlerWorkspaceBootstrapTest(
    @Autowired private val service: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
) {
    @Test
    fun `first sign-in creates exactly one personal workspace`() {
        val user = userRepository.save(User(email = "new@example.com", name = "New"))
        // Simulate the OAuth flow's workspace bootstrap:
        if (service.findAllForUser(user.id!!).isEmpty()) {
            service.createPersonalWorkspace(user.id!!)
        }
        val list = service.findAllForUser(user.id!!)
        assertEquals(1, list.size)
        assertEquals("내 워크스페이스", list[0].name)
    }

    @Test
    fun `returning sign-in does not create a duplicate`() {
        val user = userRepository.save(User(email = "ret@example.com", name = "Ret"))
        service.createPersonalWorkspace(user.id!!)
        if (service.findAllForUser(user.id!!).isEmpty()) {
            service.createPersonalWorkspace(user.id!!)
        }
        assertEquals(1, service.findAllForUser(user.id!!).size)
    }
}
```

- [ ] **Step 2: Wire `WorkspaceService` into `OAuth2SuccessHandler`**

Modify `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/OAuth2SuccessHandler.kt`:

```kotlin
@Component
class OAuth2SuccessHandler(
    private val userRepository: UserRepository,
    private val jwtProvider: JwtProvider,
    private val authProperties: AuthProperties,
    private val workspaceService: WorkspaceService,    // ← new
) : AuthenticationSuccessHandler {
    // ... existing fields ...

    @Transactional
    override fun onAuthenticationSuccess(...) {
        // existing User upsert logic, unchanged up through:
        val saved = userRepository.save(user)

        // NEW: ensure the signed-in user has a workspace
        if (workspaceService.findAllForUser(saved.id!!).isEmpty()) {
            workspaceService.createPersonalWorkspace(saved.id!!)
        }

        if (!saved.active) {
            // existing rejection
            return
        }

        val token = jwtProvider.issue(saved)
        response.sendRedirect("${authProperties.frontendUrl}/auth/callback#token=$token")
    }
}
```

- [ ] **Step 3: Apply the same bootstrap to `DevAuthController`**

Modify `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/DevAuthController.kt`:

```kotlin
class DevAuthController(
    // ... existing fields ...
    private val workspaceService: WorkspaceService,    // ← new
) {
    @PostMapping("/dev-login")
    @Transactional
    fun devLogin(@RequestBody request: DevLoginRequest): ResponseEntity<Any> {
        // ... existing upsert ...
        val saved = userRepository.save(user)
        if (!saved.active) return ResponseEntity.status(403).body(mapOf("error" to "user deactivated"))

        // NEW: ensure the user has a workspace
        if (workspaceService.findAllForUser(saved.id!!).isEmpty()) {
            workspaceService.createPersonalWorkspace(saved.id!!)
        }

        return ResponseEntity.ok(/* existing response */)
    }
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew test --tests "*OAuth2SuccessHandlerWorkspaceBootstrap*"
```

Expected: both tests PASS.

- [ ] **Step 5: Manual smoke test**

```bash
./gradlew bootRun &
curl -X POST http://localhost:8090/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com"}'
# Use returned token:
curl http://localhost:8090/api/workspaces -H "Authorization: Bearer $TOKEN"
# Expect: [{"id":1,"name":"내 워크스페이스","slug":"personal","createdByUserId":1,"createdAt":"..."}]
```

- [ ] **Step 6: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/OAuth2SuccessHandler.kt \
        shared-docs-backend/src/main/kotlin/com/shareddocs/backend/auth/DevAuthController.kt \
        shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/OAuth2SuccessHandlerWorkspaceBootstrapTest.kt
git commit -m "feat(auth): auto-create personal workspace on first sign-in (Phase A)"
```

---

# Section 4 — Per-feature workspace scoping

This section is repetitive: every existing resource entity gets `workspace_id`, every repository filters by it, every controller takes `@CurrentWorkspace`. The pattern is fully spelled out in **Task 10 (template)**, then applied to each feature in Tasks 11–19.

> ⚠️ **Do not commit per-task — commit per-feature**. Each feature task is one commit boundary.

## Task 10: The per-feature scoping pattern (template)

Use this as the recipe for every feature in Tasks 11–19. Every step conforms to [`../ENGINEERING-STANDARDS.md`](../ENGINEERING-STANDARDS.md).

### Pattern step 0: Author the Flyway migration

Each feature ships its table(s) as a versioned migration `V<n>__<feature>.sql` under `src/main/resources/db/migration/`. The migration creates the resource table **with** `workspace_id BIGINT NOT NULL`, the `BaseEntity` columns (`created_at`, `updated_at`, `version`), the FK constraint to `workspaces(id)`, and indexes.

```sql
-- e.g. V2__notes.sql
ALTER TABLE notes
  ADD COLUMN workspace_id BIGINT NOT NULL,
  ADD CONSTRAINT fk_notes_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT,
  ADD INDEX idx_notes_workspace (workspace_id);
```

`ON DELETE RESTRICT` on resource→workspace FKs (a workspace can't be hard-deleted while it owns resources; soft-delete + purge handles teardown — ENGINEERING-STANDARDS §2.1). After writing the migration, `ddl-auto: validate` will confirm the entity model matches.

### Pattern step 1: Extend `BaseEntity` + add `workspace_id` to the entity

The entity extends `BaseEntity` (inherits id/createdAt/updatedAt/version — remove any now-duplicate `id`/`createdAt` fields it declared) and adds:

```kotlin
@Column(name = "workspace_id", nullable = false, updatable = false)
val workspaceId: Long,
```

Mark `updatable = false` — a resource never moves between workspaces (locked decision §11.3 of the v2 spec). Use `val`, since it's immutable.

### Pattern step 2: Update the repository

For every method that returns resources, add a `workspaceId` parameter and add `AND workspaceId = :workspaceId` to the query. Example transformation:

```kotlin
// before
fun findAllByOrderByCreatedAtDesc(): List<Note>

// after
fun findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId: Long): List<Note>
```

For custom `@Query` JPQL, add `AND e.workspaceId = :workspaceId`.

For find-by-id endpoints, change:

```kotlin
// before
fun findById(id: Long): Optional<Note>

// after
fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): Note?
```

### Pattern step 3: Update the service

Change every service method to take a `workspaceId` parameter, threaded through to the repository.

```kotlin
// before
fun list(): List<NoteResponse> =
    repository.findAllByOrderByCreatedAtDesc().map { it.toResponse() }

// after
fun list(workspaceId: Long): List<NoteResponse> =
    repository.findAllByWorkspaceIdOrderByCreatedAtDesc(workspaceId).map { it.toResponse() }
```

For `create`, the service receives `workspaceId` and writes it into the new entity:

```kotlin
fun create(workspaceId: Long, userId: Long, req: CreateNoteRequest): NoteResponse =
    repository.save(Note(workspaceId = workspaceId, /* ... */)).toResponse()
```

### Pattern step 4: Update the controller

Add `@CurrentWorkspace ws: Workspace` to every method signature. Use `ws.id!!` for the workspaceId.

```kotlin
// before
@GetMapping
fun list(@AuthenticationPrincipal me: AppPrincipal): List<NoteResponse> =
    service.list()

// after
@GetMapping
fun list(
    @AuthenticationPrincipal me: AppPrincipal,
    @CurrentWorkspace ws: Workspace,
): List<NoteResponse> =
    service.list(ws.id!!)
```

### Pattern step 5: Write the workspace isolation test

For each feature, write one integration test that proves cross-workspace data is invisible:

```kotlin
@Test
fun `workspace A cannot see workspace B's notes`() {
    val a = userRepository.save(User(email = "a@x.com", name = "A"))
    val b = userRepository.save(User(email = "b@x.com", name = "B"))
    val wsA = workspaceService.createPersonalWorkspace(a.id!!)
    val wsB = workspaceService.createPersonalWorkspace(b.id!!)

    noteService.create(wsA.id!!, a.id!!, CreateNoteRequest(title = "A note", body = ""))
    noteService.create(wsB.id!!, b.id!!, CreateNoteRequest(title = "B note", body = ""))

    val seenByA = noteService.list(wsA.id!!)
    assertEquals(1, seenByA.size)
    assertEquals("A note", seenByA[0].title)
}
```

Mock data adjusted to whatever the feature's create signature looks like.

### Pattern step 6: Commit the feature

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/<feature>/
git add shared-docs-backend/src/test/kotlin/com/shareddocs/backend/<feature>/
git commit -m "feat(<feature>): workspace_id scoping + isolation test (Phase A)"
```

---

## Task 11: `note` feature (note + attachment + entity_ref)

Apply Task 10 pattern to:
- `note/Note.kt`
- `note/NoteRepository.kt` — every find/count method gets `workspaceId`
- `note/NoteService.kt` — every method takes `workspaceId`
- `note/NoteController.kt` — `@CurrentWorkspace ws` on every method
- `note/Attachment.kt` — gets `workspaceId` (matches its parent Note)
- `note/AttachmentRepository.kt`
- `note/AttachmentService.kt` — `create` derives workspace from the parent Note
- `note/EntityRef.kt` — gets `workspaceId` (a ref's workspace = its source note's workspace)
- `note/EntityRefRepository.kt`
- `note/EntityRefIndexer.kt` — when re-indexing on Note save, write `workspaceId` from the parent

**Gotchas:**
- `Visibility` enum keeps its current values (`PRIVATE`, `SHARED`) for now. Renaming `SHARED` → `WORKSPACE` happens at the end of Phase A as a separate single-commit cleanup (Task 28).
- `EntityRefBackfill.kt` was a one-shot migration job — leave it unchanged but add a guard so it doesn't run on the v2 schema. (Or delete it now; pre-v2 backfills are no longer needed.)

Isolation test name: `noteWorkspaceIsolationTest.kt` in `src/test/kotlin/com/shareddocs/backend/note/`. Cover: list, findById, search, soft-delete query.

Commit message: `feat(note): workspace_id scoping + isolation test (Phase A)`

## Task 12: `sheet` feature

Apply pattern to:
- `sheet/Sheet.kt`
- `sheet/SheetRepository.kt`
- `sheet/SheetService.kt`
- `sheet/SheetController.kt`

Isolation test: `sheetWorkspaceIsolationTest.kt`.

## Task 13: `calc` feature

Apply pattern to:
- `calc/CalcEntry.kt`
- `calc/CalcEntryRepository.kt` — note current method `findAllByOrderByPinnedDescCreatedAtDescIdDesc()` becomes `findAllByWorkspaceIdOrderBy...`
- `calc/CalcEntryService.kt`
- `calc/CalcEntryController.kt`

Isolation test: `calcEntryWorkspaceIsolationTest.kt`. Important — the calc tape is the canonical example of "shared between workspace members" so the isolation test is the key invariant.

## Task 14: `purchase` + `settlement` + `recurring` features (grouped)

These are intertwined (Settlement references Purchase rows, RecurringPurchase generates Purchase rows). Treat them as one task.

Apply pattern to:
- `purchase/Purchase.kt`, `PurchaseCategory.kt`
- `purchase/PurchaseRepository.kt`, `PurchaseCategoryRepository.kt`
- `purchase/PurchaseService.kt`, `PurchaseCategoryService.kt`
- `purchase/PurchaseController.kt`
- `settlement/Settlement.kt` + repo + service + controller
- `recurring/RecurringPurchase.kt` + repo + service + controller

Settlement gets `workspaceId` matching the Purchases it references — we enforce same-workspace at the Settlement creation boundary.

`PurchaseCategory` and other categories are also workspace-scoped (each workspace gets its own category set).

Isolation tests: one per sub-feature (`purchaseWorkspaceIsolationTest`, `settlementWorkspaceIsolationTest`, `recurringWorkspaceIsolationTest`).

## Task 15: `todo` feature

Apply pattern to:
- `todo/Todo.kt`, `TodoCategory.kt`
- `todo/TodoRepository.kt`, `TodoCategoryRepository.kt`
- `todo/TodoService.kt`, `TodoCategoryService.kt`
- `todo/TodoController.kt`

Isolation test: `todoWorkspaceIsolationTest.kt`.

## Task 16: `anniversary` feature

Apply pattern to:
- `anniversary/Anniversary.kt`, `AnniversaryCategory.kt`
- repos, service, controller

Isolation test: `anniversaryWorkspaceIsolationTest.kt`.

## Task 17: `link` feature

Apply pattern to:
- `link/Link.kt`, `LinkCategory.kt`
- repos, service, controller

`OpenGraphFetcher` is workspace-agnostic — pure HTTP utility. Leave it alone.

Isolation test: `linkWorkspaceIsolationTest.kt`.

## Task 18: `recipe` feature

Apply pattern to:
- `recipe/Recipe.kt`, `RecipeStep.kt`, `RecipeIngredient.kt`
- repos, service, controller

Steps and Ingredients inherit `workspaceId` from their parent Recipe at creation. Their controllers are nested under `/api/recipes/:id/...`, so workspace is enforced at the parent lookup.

Isolation test: `recipeWorkspaceIsolationTest.kt`.

## Task 19: `calendar` + `search` (aggregator features, read-only)

Calendar aggregates 4 sources (anniversaries + todos + purchases + settlements). It already calls into each feature's service — those calls now take a workspaceId. Update `CalendarController` to take `@CurrentWorkspace` and pass through.

Similarly, `EntitySearchService` queries across multiple repositories. Update its signature to take `workspaceId` and pass through to each source repo.

No new entities; just controller + service signature changes.

Isolation tests: `calendarWorkspaceIsolationTest.kt` (verify the aggregator only returns the current workspace's events) and `entitySearchWorkspaceIsolationTest.kt`.

---

# Section 5 — Frontend wiring

After this section, the frontend sends `X-Workspace-Id` on every request and tracks the active workspace in React context.

## Task 20: API client — `X-Workspace-Id` interceptor

**Files:**
- Modify: `shared-docs/src/api/client.ts`
- Create: `shared-docs/src/auth/workspaceStorage.ts`

- [ ] **Step 1: localStorage helpers**

```typescript
// workspaceStorage.ts
const KEY = 'activeWorkspaceId'

export const getActiveWorkspaceId = (): number | null => {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export const setActiveWorkspaceId = (id: number): void => {
  localStorage.setItem(KEY, String(id))
}

export const clearActiveWorkspaceId = (): void => {
  localStorage.removeItem(KEY)
}
```

- [ ] **Step 2: Axios interceptor**

Modify `shared-docs/src/api/client.ts`. After the existing Bearer-token interceptor, add:

```typescript
import { getActiveWorkspaceId } from '@/auth/workspaceStorage'

apiClient.interceptors.request.use((config) => {
  const wsId = getActiveWorkspaceId()
  if (wsId !== null) {
    config.headers = config.headers ?? {}
    config.headers['X-Workspace-Id'] = String(wsId)
  }
  return config
})
```

If the request goes to `/api/workspaces/...` or `/api/auth/...`, skipping the header is fine — backend `WorkspaceContextFilter` passes through when the header is absent.

- [ ] **Step 3: Commit**

```bash
git add shared-docs/src/api/client.ts shared-docs/src/auth/workspaceStorage.ts
git commit -m "feat(api): inject X-Workspace-Id header on every request (Phase A)"
```

## Task 21: `useActiveWorkspace` context

**Files:**
- Create: `shared-docs/src/auth/ActiveWorkspaceProvider.tsx`
- Create: `shared-docs/src/auth/useActiveWorkspace.ts`
- Modify: `shared-docs/src/auth/AuthProvider.tsx`

- [ ] **Step 1: Context shape**

```typescript
// useActiveWorkspace.ts
import { createContext, useContext } from 'react'

export interface ActiveWorkspaceState {
  workspaceId: number | null
  setWorkspaceId: (id: number) => void
  clear: () => void
}

export const ActiveWorkspaceContext = createContext<ActiveWorkspaceState | null>(null)

export const useActiveWorkspace = (): ActiveWorkspaceState => {
  const ctx = useContext(ActiveWorkspaceContext)
  if (!ctx) throw new Error('useActiveWorkspace must be used inside ActiveWorkspaceProvider')
  return ctx
}
```

- [ ] **Step 2: Provider**

```typescript
// ActiveWorkspaceProvider.tsx
import { useState, useCallback, ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ActiveWorkspaceContext } from './useActiveWorkspace'
import {
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  clearActiveWorkspaceId,
} from './workspaceStorage'

export function ActiveWorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [workspaceId, setState] = useState<number | null>(() => getActiveWorkspaceId())

  const setWorkspaceId = useCallback((id: number) => {
    setActiveWorkspaceId(id)
    setState(id)
    queryClient.clear()  // wipe all cached queries — they're workspace-specific
  }, [queryClient])

  const clear = useCallback(() => {
    clearActiveWorkspaceId()
    setState(null)
    queryClient.clear()
  }, [queryClient])

  return (
    <ActiveWorkspaceContext.Provider value={{ workspaceId, setWorkspaceId, clear }}>
      {children}
    </ActiveWorkspaceContext.Provider>
  )
}
```

- [ ] **Step 3: Wire into AuthProvider**

Modify `shared-docs/src/auth/AuthProvider.tsx` so that `ActiveWorkspaceProvider` wraps children (inside `AuthProvider`, since it depends on the query client and is logically auth-adjacent).

- [ ] **Step 4: Commit**

```bash
git add shared-docs/src/auth/{ActiveWorkspaceProvider.tsx,useActiveWorkspace.ts,AuthProvider.tsx}
git commit -m "feat(auth): ActiveWorkspaceProvider + useActiveWorkspace hook (Phase A)"
```

## Task 22: Workspaces API client

**Files:**
- Create: `shared-docs/src/api/workspaces.ts`
- Create: `shared-docs/src/features/workspaces/types.ts`

- [ ] **Step 1: Types**

```typescript
// features/workspaces/types.ts
export interface Workspace {
  id: number
  name: string
  slug: string
  createdByUserId: number
  createdAt: string
}

export interface CreateWorkspaceRequest {
  name: string
  slug: string
}
```

- [ ] **Step 2: API client**

```typescript
// api/workspaces.ts
import { apiClient } from './client'
import type { Workspace, CreateWorkspaceRequest } from '@/features/workspaces/types'

export const listMyWorkspaces = async (): Promise<Workspace[]> => {
  const { data } = await apiClient.get<Workspace[]>('/api/workspaces')
  return data
}

export const getWorkspace = async (id: number): Promise<Workspace> => {
  const { data } = await apiClient.get<Workspace>(`/api/workspaces/${id}`)
  return data
}

export const createWorkspace = async (req: CreateWorkspaceRequest): Promise<Workspace> => {
  const { data } = await apiClient.post<Workspace>('/api/workspaces', req)
  return data
}
```

- [ ] **Step 3: Commit**

```bash
git add shared-docs/src/api/workspaces.ts shared-docs/src/features/workspaces/types.ts
git commit -m "feat(workspaces): typed API client (Phase A)"
```

## Task 23: `AuthCallback` — seed initial workspace

**Files:**
- Modify: `shared-docs/src/pages/AuthCallback.tsx`

After parsing the token from the URL fragment, fetch the user's workspaces. If none, that's a bug — but if any exist, set the first as active.

- [ ] **Step 1: Update AuthCallback**

```typescript
// AuthCallback.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveWorkspace } from '@/auth/useActiveWorkspace'
import { listMyWorkspaces } from '@/api/workspaces'
import { setAuthToken } from './tokenStorage'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { workspaceId, setWorkspaceId } = useActiveWorkspace()

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const token = hash.get('token')
    if (!token) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }
    setAuthToken(token)
    ;(async () => {
      try {
        const workspaces = await listMyWorkspaces()
        if (workspaces.length === 0) {
          navigate('/login?error=no_workspace', { replace: true })
          return
        }
        // Only seed if we don't already have an active workspace (e.g. user is re-signing in)
        if (workspaceId === null) {
          setWorkspaceId(workspaces[0].id)
        }
        navigate('/', { replace: true })
      } catch {
        navigate('/login?error=workspace_fetch_failed', { replace: true })
      }
    })()
  }, [navigate, setWorkspaceId, workspaceId])

  return null
}
```

- [ ] **Step 2: Add the new error messages to Login.tsx**

```typescript
const ERROR_MESSAGES: Record<string, string> = {
  // ... existing ...
  no_workspace: '워크스페이스를 찾을 수 없습니다. 다시 시도해 주세요.',
  workspace_fetch_failed: '워크스페이스 정보를 불러올 수 없습니다. 다시 시도해 주세요.',
}
```

- [ ] **Step 3: Commit**

```bash
git add shared-docs/src/pages/AuthCallback.tsx shared-docs/src/pages/Login.tsx
git commit -m "feat(auth): seed active workspace on sign-in (Phase A)"
```

## Task 24: Boot-time guard — fetch workspaces if active is stale

**Files:**
- Modify: `shared-docs/src/auth/ActiveWorkspaceProvider.tsx`

If `getActiveWorkspaceId()` returns a value, but the user no longer has access (workspace deleted, membership revoked), all subsequent API calls will 403. Add a mount-time check.

- [ ] **Step 1: Add the boot check**

```typescript
// inside ActiveWorkspaceProvider, after the useState
useEffect(() => {
  if (workspaceId === null) return

  let cancelled = false
  ;(async () => {
    try {
      const list = await listMyWorkspaces()
      if (cancelled) return
      const stillExists = list.some(w => w.id === workspaceId)
      if (!stillExists) {
        if (list.length > 0) {
          setWorkspaceId(list[0].id)
        } else {
          clear()
        }
      }
    } catch {
      // probably an auth issue; AuthProvider will handle redirect
    }
  })()

  return () => { cancelled = true }
}, [])  // mount-only
```

- [ ] **Step 2: Smoke-test**

Sign in twice with the same user, simulate a stale localStorage entry by manually editing it to a workspace ID that doesn't exist (e.g. 99999). Refresh — the app should self-recover.

- [ ] **Step 3: Commit**

```bash
git add shared-docs/src/auth/ActiveWorkspaceProvider.tsx
git commit -m "feat(auth): self-recover from stale active workspace ID (Phase A)"
```

---

# Section 6 — End-to-end validation

## Task 25: e2e smoke test — single user happy path

This is a manual scripted test, not a Cypress test (we don't have e2e infrastructure yet). Document the steps in the commit message; future Phase B work may automate this.

- [ ] Wipe local DB: `mysql ... -e "DROP DATABASE shared_docs; CREATE DATABASE shared_docs;"`
- [ ] Start backend: `./gradlew bootRun`
- [ ] Start frontend: `npm run dev`
- [ ] Open `http://localhost:5173/login`
- [ ] Click "Google로 시작하기" (or POST to `/api/auth/dev-login` with a test email)
- [ ] Verify: redirected to `/`, sidebar shows empty note list
- [ ] Open DevTools → Application → Local Storage → verify `activeWorkspaceId` is set
- [ ] Open DevTools → Network → check any `/api/...` request → verify `X-Workspace-Id` header is present
- [ ] Create a note via the slash menu, save it
- [ ] Refresh — note still there
- [ ] Open DB: `SELECT id, workspace_id, title FROM notes;` — workspace_id should be 1

## Task 26: e2e workspace isolation test — two users

- [ ] Wipe local DB.
- [ ] `POST /api/auth/dev-login {"email":"alice@x.com"}` → get token A
- [ ] `POST /api/auth/dev-login {"email":"bob@x.com"}` → get token B
- [ ] `curl /api/workspaces -H "Authorization: Bearer $TOKEN_A"` → Alice's workspace ID
- [ ] `curl /api/workspaces -H "Authorization: Bearer $TOKEN_B"` → Bob's workspace ID (different)
- [ ] Alice creates a note in her workspace.
- [ ] `curl /api/notes -H "Authorization: Bearer $TOKEN_B" -H "X-Workspace-Id: <bob's>"` → empty list (correct)
- [ ] `curl /api/notes -H "Authorization: Bearer $TOKEN_B" -H "X-Workspace-Id: <alice's>"` → 403 (correct — Bob is not a member)

If any of these fails, Phase A is incomplete.

## Task 27: Type-check, lint, build pass

- [ ] `cd shared-docs-backend && ./gradlew build`  → BUILD SUCCESSFUL
- [ ] `cd shared-docs && npx tsc --noEmit`         → no errors
- [ ] `cd shared-docs && npx eslint src/`          → no errors
- [ ] `cd shared-docs && npm run build`            → succeeds, bundle sizes within tolerance

## Task 28: Rename `Visibility.SHARED` → `Visibility.WORKSPACE`

Held until end of Phase A so it doesn't interleave with the workspace_id loop.

- [ ] In `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/Visibility.kt`, rename `SHARED` to `WORKSPACE`.
- [ ] Search-replace all references in the backend (`Visibility.SHARED` → `Visibility.WORKSPACE`).
- [ ] In `shared-docs/src/features/notes/types.ts`, rename `'SHARED'` → `'WORKSPACE'` in the union type.
- [ ] Search-replace in frontend.
- [ ] `./gradlew build` + `npx tsc --noEmit` clean.
- [ ] Commit:

```bash
git commit -m "refactor(note): rename Visibility.SHARED -> WORKSPACE (v2 spec §3.2)"
```

## Task 29: Phase A wrap commit

- [ ] On the v2-multi-tenant branch, add a `PHASE-A-DONE` marker — either a tag or a final commit that touches no code but signals readiness for Phase B planning.

```bash
git tag phase-a-complete
git push origin phase-a-complete
```

---

# Open questions / things to confirm during execution

These didn't make it into the locked spec but will need answers as code lands:

1. **`mockito-kotlin` version.** Plan assumes `5.4.0`. If the build picks a different Mockito core, this may conflict. First time we run Task 7's filter test, surface the version mismatch and pin both together.

2. **`AppPrincipal` shape.** I assumed it exposes `userId: Long`, `email: String`, `role: Role`. If the existing class uses different field names, Task 7's test will need adjustment.

3. **`EntityRefBackfill` behavior on v2.** It was a 2026-05-20 one-shot — does it run unconditionally on app start? If yes, Task 11 needs to disable it (or it'll crash because old wire formats no longer exist in a wiped DB).

4. **Recipe sub-entities — duplicated `workspaceId` or derived?** I proposed adding `workspaceId` to both `RecipeStep` and `RecipeIngredient` even though they could derive it from the parent Recipe via JOIN. The duplication makes scoping queries simpler at the cost of one extra column. Confirm during Task 18.

5. **Calendar source filter UI.** The current calendar lets you toggle which sources (anniversaries / todos / purchases / settlements) to show. After Phase A, all 4 sources are still visible — just workspace-scoped. The multi-calendar overlay across workspaces is post-v2 (per VISION.md §5).

---

# Out of scope for Phase A

These are explicitly **next-phase** work:

- Workspace switcher UI (Phase B)
- Create-workspace UI (Phase B)
- Workspace settings page (Phase B)
- Per-workspace category bootstrapping (Phase C)
- Invitations (Phase D)
- Per-doc ShareGrant (Phase E)
- `effectivePermission: VIEW | EDIT` in responses (Phase E — until then, everyone is effectively EDIT inside their workspace)
- "공유받은 항목" view (Phase E)
- Polish, empty states, profile page (Phase F)

---

# Self-review checklist (run after the plan is fully executed)

- [ ] Every entity in the codebase has a `workspace_id` NOT NULL column.
- [ ] Every list/detail endpoint filters by workspace.
- [ ] Manual e2e test (Task 26) shows two users with isolated data.
- [ ] No endpoint accepts cross-workspace reads except `/api/workspaces` (which lists the caller's own memberships).
- [ ] Backend tests all green: `./gradlew test`.
- [ ] Frontend type-checks + lints + builds.
- [ ] `git log v2-multi-tenant..main` shows main has not advanced (we're still merging into v2 only).
