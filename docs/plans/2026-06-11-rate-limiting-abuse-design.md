# Rate-Limiting & Abuse Protection (Design)

> **Status:** design — approved for plan-writing 2026-06-11.
> **Scope:** backend only (`shared-docs-backend`). No frontend, no Cloudflare config in this round.

## 1. Goal

Before broadcasting the public URL, add **invisible-tripwire** abuse protection: limits set generously high so a real user (n≈20–100) never hits them — they exist only to stop scripts/floods from exhausting the single Mac Mini host (CPU, MariaDB rows, the uploads disk volume).

Two independent pieces:
1. **Write-throttle** — a per-user rate limit on mutating requests (covers authenticated write-flood → DB/CPU exhaustion).
2. **Upload storage quota** — a per-user total-bytes ceiling on attachments (covers the fastest disk-fill vector).

Explicitly **NOT** in scope (deliberate, per scoping): Cloudflare edge rules (public-surface scraping & login floods are the edge's job), signup/workspace caps (Google OAuth already gates signup), per-entity count quotas (the write-throttle bounds creation *rate*, so the DB can't be filled fast), and any user-facing usage UI.

## 2. Context (current state)

- Stack: Spring Boot 3.5 + Kotlin, stateless JWT auth, single instance behind Cloudflare Tunnel → Mac Mini Docker + MariaDB. Prod profile = `docker`.
- Filter chain (`SecurityConfig`): `JwtAuthFilter` → `WorkspaceContextFilter` → controllers. `WorkspaceContextFilter` is an `OncePerRequestFilter` that reads the `AppPrincipal` from the `SecurityContext` — the pattern the new filter mirrors.
- `/api/auth/dev-login` is `permitAll` in the matcher BUT `DevAuthController` is `@Profile("local")`, so the bean never loads in `docker` — the route 404s in prod. **Not a hole; no action needed.**
- Uploads: `Attachment` entity has `sizeBytes: Long` and `uploadedBy: User`. Spring multipart already caps **per-file 20 MB / per-request 25 MB** (`application.yml`). No aggregate cap exists today.
- No rate-limit dependency present.

## 3. Architecture

### 3.1 Write-throttle filter

- **New** `RateLimitFilter : OncePerRequestFilter` in `com.shareddocs.backend.config` (or `auth`), registered in `SecurityConfig` via `addFilterAfter(rateLimitFilter, JwtAuthFilter::class.java)` (principal is in the `SecurityContext` by then).
- **Applies only when ALL of:** the request method is mutating (`POST`, `PUT`, `PATCH`, `DELETE`) AND there is an authenticated `AppPrincipal`. Otherwise pass through untouched (GETs, the unauth public surface, and OAuth/login routes are out of scope here).
- **Key:** `principal.userId`. (No per-IP keying — keeps the bucket map bounded by user count and avoids penalizing shared NATs; the public/unauth surface is Cloudflare's job.)
- **Algorithm:** Bucket4j in-memory token bucket — capacity `app.ratelimit.capacity` (default 120), refill `app.ratelimit.writes-per-minute` (default 120) tokens per minute, greedy refill. ~2 sustained writes/sec with a 120 burst.
- **Bucket storage:** a Caffeine cache `Cache<Long, Bucket>` (key = userId) with `expireAfterAccess(~15 min)` so idle users evict. In-memory, single instance; resets on redeploy (acceptable).
- **On rejection (no token):** stop the chain, respond **429 Too Many Requests** with a `Retry-After` header (seconds) and a minimal `application/problem+json` body `{ "type": "about:blank", "title": "Too Many Requests", "status": 429, "detail": "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }`. Hand-written in the filter because it runs outside the `DispatcherServlet` (same constraint `WorkspaceContextFilter` documents).
- **Sanity vs. real usage:** the note editor autosaves on a debounce (≈1 save / few seconds); a heavy human stays far under 120/min. A script doing thousands/min trips immediately.

### 3.2 Upload storage quota

- **New repo method** on `AttachmentRepository`: `sumSizeBytesByUploadedByUserId(userId: Long): Long?` (JPQL `SELECT COALESCE(SUM(a.sizeBytes), 0) FROM Attachment a WHERE a.uploadedBy.id = :userId`; returns 0 when none).
- In `AttachmentService.upload(...)`, **before** `storage.store(file)`: compute `current = sum(...)`; if `current + file.size > app.storage.per-user-quota-bytes` → throw `ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "저장 용량을 초과했어요.")` (matches the module's existing `ResponseStatusException` style; the per-file 20 MB cap stays as the multipart guard).
- **Default cap:** `app.storage.per-user-quota-bytes = 524288000` (500 MB). At n≈100 ≈ 50 GB worst case.

### 3.3 Config & profile safety

New properties (bound via a small `@ConfigurationProperties` holder, e.g. `RateLimitProperties` + an addition to the existing storage properties):

```yaml
app:
  ratelimit:
    enabled: true            # docker (prod)
    writes-per-minute: 120
    capacity: 120
  storage:
    per-user-quota-bytes: 524288000   # 500 MB
```

- **`test` profile:** `app.ratelimit.enabled=false` (so the existing suite's many writes aren't throttled) and `per-user-quota-bytes` set very high (so unrelated upload tests don't trip the quota). The filter checks `enabled` first and passes through when off.
- `local` keeps `enabled: true` with the same generous defaults (so the limiter is exercised in dev), but this is easily flipped.

## 4. Components & responsibilities

| Unit | Responsibility |
|---|---|
| `RateLimitProperties` | Bind `app.ratelimit.*`. |
| `RateLimitFilter` | Per-user token-bucket gate on mutating requests; 429 + Retry-After on reject. |
| `SecurityConfig` (modify) | Register `RateLimitFilter` after `JwtAuthFilter`. |
| `AttachmentRepository` (modify) | `sumSizeBytesByUploadedByUserId` aggregate. |
| `AttachmentService.upload` (modify) | Pre-store per-user storage-quota check → 413. |
| storage properties (modify) | Add `per-user-quota-bytes`. |
| `build.gradle.kts` (modify) | Add Bucket4j (+ Caffeine if not already present). |

## 5. Error handling

- **Throttle:** 429 + `Retry-After` + minimal problem+json (written in-filter). Frontend's `apiFetch` surfaces it as a generic error — no special UX needed (tripwire is meant to be invisible to humans).
- **Quota:** 413 via `ResponseStatusException`, rendered by the existing exception handling. Korean detail message.
- Both are fail-closed only for the offending action; nothing else is affected.

## 6. Testing

- **Filter** (slice/unit with `enabled=true`): 120 writes pass, 121st → 429 with a `Retry-After` header; a `GET` is never throttled; an unauthenticated request passes through; two different users have independent buckets.
- **Quota** (service test): upload under the cap succeeds; an upload that would cross the cap → 413 and **no file is written / no row inserted**; `sumSizeBytesByUploadedByUserId` returns the correct total (and 0 for a user with none).
- Confirm the full existing suite stays green with `test` profile disabling the throttle.

## 7. Build order (informs the plan)

1. Add Bucket4j (+ Caffeine) dependency; `RateLimitProperties`; profile config.
2. `RateLimitFilter` + register in `SecurityConfig`; filter tests.
3. `sumSizeBytesByUploadedByUserId` + storage property; quota check in `AttachmentService.upload`; quota tests.
4. Full-suite green check.

Pieces 2 and 3 are independent and could be done in either order; the throttle (2) is the higher-value half.
