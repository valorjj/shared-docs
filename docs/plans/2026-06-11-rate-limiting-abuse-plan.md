# Rate-Limiting & Abuse Protection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invisible-tripwire abuse protection to the backend — a per-user Bucket4j write-throttle filter (429 + Retry-After) and a per-user upload storage quota (413 over 500 MB) — with limits generous enough to never bite a real user (n≈20–100).

**Architecture:** A new `RateLimitFilter` (`OncePerRequestFilter`, mirroring `WorkspaceContextFilter`) gates mutating requests per authenticated user via in-memory Bucket4j buckets; profile-gated off in `test`. A per-user `SUM(size_bytes)` check in `AttachmentService.upload()` enforces the storage ceiling. All backend; no frontend, no schema change.

**Tech Stack:** Spring Boot 3.5 + Kotlin (JDK 17), Bucket4j 8.x (in-memory), JUnit 5 + Mockito + spring-boot-starter-test. Spec: `shared-docs/docs/plans/2026-06-11-rate-limiting-abuse-design.md`.

**Branch:** Backend repo (`shared-docs-backend`). Create a feature branch `rate-limiting` off `main`. Do not push during implementation.

**Test reality:** Backend uses JUnit (`./gradlew test`, `@SpringBootTest @ActiveProfiles("test")` against `shared_docs_test` on MariaDB :3307). Real TDD. The full suite must stay green — the `test` profile disables the throttle so existing multi-write tests aren't affected.

---

## Branch setup (do FIRST)

```bash
cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend
git checkout main && git pull --ff-only 2>/dev/null; git checkout -b rate-limiting
git rev-parse HEAD   # report this base SHA
```

---

## File Structure

| File | Responsibility |
|---|---|
| `build.gradle.kts` (modify) | Add `com.bucket4j:bucket4j_jdk17-core`. |
| `config/RateLimitProperties.kt` (create) | Bind `app.ratelimit.*` (enabled / writesPerMinute / capacity). |
| `SharedDocsBackendApplication.kt` (modify) | Register `RateLimitProperties` in `@EnableConfigurationProperties`. |
| `config/RateLimitFilter.kt` (create) | Per-user token-bucket gate on mutating requests; 429 + Retry-After. |
| `auth/SecurityConfig.kt` (modify) | Register `RateLimitFilter` between `JwtAuthFilter` and `WorkspaceContextFilter`. |
| `src/test/.../config/RateLimitFilterTest.kt` (create) | Unit-test the filter (mirrors `WorkspaceContextFilterTest`). |
| `note/FileStorageProperties.kt` (modify) | Add `perUserQuotaBytes`. |
| `note/AttachmentRepository.kt` (modify) | `sumSizeBytesByUploadedByUserId` aggregate. |
| `note/AttachmentService.kt` (modify) | Pre-store per-user storage-quota check → 413. |
| `src/test/.../note/AttachmentQuotaTest.kt` (create) | Quota service test. |
| `src/main/resources/application.yml` (modify) | `app.ratelimit.enabled: false` in the `test` profile. |

All packages are under `com.shareddocs.backend`.

---

## Task 1: Dependency + RateLimitProperties + config wiring

**Files:**
- Modify: `build.gradle.kts`
- Create: `src/main/kotlin/com/shareddocs/backend/config/RateLimitProperties.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/SharedDocsBackendApplication.kt`
- Modify: `src/main/resources/application.yml`

- [ ] **Step 1: Add the Bucket4j dependency**

In `build.gradle.kts`, inside the `dependencies { }` block (e.g. after the `jsoup` line), add:

```kotlin
    // In-memory token-bucket rate limiting (no Redis; single instance).
    implementation("com.bucket4j:bucket4j_jdk17-core:8.14.0")
```

The project targets JDK 17, so the `bucket4j_jdk17-core` artifact is correct. If `8.14.0` fails to resolve, use the latest 8.x `bucket4j_jdk17-core` on Maven Central (the package namespace stays `io.github.bucket4j`).

- [ ] **Step 2: Create RateLimitProperties**

Create `src/main/kotlin/com/shareddocs/backend/config/RateLimitProperties.kt`:

```kotlin
package com.shareddocs.backend.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Write-throttle config. Defaults are the production (docker) values — generous
 * enough that a real user never trips them. The `test` profile sets enabled=false
 * so the suite's many writes aren't throttled.
 */
@ConfigurationProperties(prefix = "app.ratelimit")
data class RateLimitProperties(
    val enabled: Boolean = true,
    val writesPerMinute: Long = 120,
    val capacity: Long = 120,
)
```

- [ ] **Step 3: Register the properties**

In `src/main/kotlin/com/shareddocs/backend/SharedDocsBackendApplication.kt`, add `RateLimitProperties` to the existing annotation. Add the import and change the line:

```kotlin
import com.shareddocs.backend.config.RateLimitProperties
```
```kotlin
@EnableConfigurationProperties(AuthProperties::class, FileStorageProperties::class, RateLimitProperties::class)
```
(Keep the existing `AuthProperties` / `FileStorageProperties` imports as they are.)

- [ ] **Step 4: Disable the throttle in the test profile**

In `src/main/resources/application.yml`, in the **`test`** profile document (the one with `on-profile: test`), add an `app.ratelimit` block under its existing `app:` mapping (which currently has `cors` and `storage`):

```yaml
app:
  cors:
    allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost:5173}
  storage:
    upload-dir: ${APP_STORAGE_UPLOAD_DIR:./build/test-uploads}
  ratelimit:
    enabled: false
```

Leave the `local` and `docker` profiles unchanged — they use the code defaults (enabled, 120/min).

- [ ] **Step 5: Verify it compiles and resolves**

Run:
```bash
./gradlew compileKotlin compileTestKotlin
```
Expected: BUILD SUCCESSFUL (Bucket4j resolves, properties class compiles).

- [ ] **Step 6: Commit**

```bash
git add build.gradle.kts src/main/kotlin/com/shareddocs/backend/config/RateLimitProperties.kt src/main/kotlin/com/shareddocs/backend/SharedDocsBackendApplication.kt src/main/resources/application.yml
git commit -m "chore(ratelimit): add Bucket4j + RateLimitProperties + test-profile toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: RateLimitFilter (TDD)

A per-user token-bucket gate. Applies only to `POST/PUT/PATCH/DELETE` by an authenticated `AppPrincipal`; everything else passes through. Over-limit → 429 + `Retry-After` + minimal problem+json.

**Files:**
- Create: `src/test/kotlin/com/shareddocs/backend/config/RateLimitFilterTest.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/config/RateLimitFilter.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt`

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/config/RateLimitFilterTest.kt`. Pure unit test (no Spring context), mirroring `WorkspaceContextFilterTest`. Uses a small capacity (3) so the limit trips fast, and real `MockHttpServletRequest/Response` so the 429 body/headers are observable:

```kotlin
package com.shareddocs.backend.config

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.user.Role
import jakarta.servlet.FilterChain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder

class RateLimitFilterTest {

    private fun filter(enabled: Boolean = true, capacity: Long = 3) =
        RateLimitFilter(RateLimitProperties(enabled = enabled, writesPerMinute = capacity, capacity = capacity))

    @BeforeEach fun before() = SecurityContextHolder.clearContext()
    @AfterEach fun after() = SecurityContextHolder.clearContext()

    private fun authenticate(userId: Long) {
        val principal = AppPrincipal(userId = userId, email = "x@x.com", name = "X", pictureUrl = null, role = Role.USER)
        SecurityContextHolder.getContext().authentication =
            UsernamePasswordAuthenticationToken(principal, null, emptyList())
    }

    private fun post() = MockHttpServletRequest("POST", "/api/notes")

    @Test
    fun `authenticated writes under the limit pass through`() {
        authenticate(1L)
        val f = filter(capacity = 3)
        val chain: FilterChain = mock(FilterChain::class.java)
        repeat(3) { f.doFilter(post(), MockHttpServletResponse(), chain) }
        verify(chain, times(3)).doFilter(any(), any())
    }

    @Test
    fun `the write over capacity is rejected 429 with Retry-After`() {
        authenticate(1L)
        val f = filter(capacity = 3)
        val chain: FilterChain = mock(FilterChain::class.java)
        repeat(3) { f.doFilter(post(), MockHttpServletResponse(), chain) }

        val res = MockHttpServletResponse()
        f.doFilter(post(), res, chain)

        assertEquals(429, res.status)
        assertNotNull(res.getHeader("Retry-After"))
        verify(chain, times(3)).doFilter(any(), any()) // the 4th did NOT proceed
    }

    @Test
    fun `GET requests are never throttled`() {
        authenticate(1L)
        val f = filter(capacity = 1)
        val chain: FilterChain = mock(FilterChain::class.java)
        repeat(5) { f.doFilter(MockHttpServletRequest("GET", "/api/notes"), MockHttpServletResponse(), chain) }
        verify(chain, times(5)).doFilter(any(), any())
    }

    @Test
    fun `unauthenticated requests pass through`() {
        val f = filter(capacity = 1)
        val chain: FilterChain = mock(FilterChain::class.java)
        repeat(5) { f.doFilter(post(), MockHttpServletResponse(), chain) }
        verify(chain, times(5)).doFilter(any(), any())
    }

    @Test
    fun `two users have independent buckets`() {
        val f = filter(capacity = 1)
        val chain: FilterChain = mock(FilterChain::class.java)
        authenticate(1L); f.doFilter(post(), MockHttpServletResponse(), chain)
        authenticate(2L); val res = MockHttpServletResponse(); f.doFilter(post(), res, chain)
        assertEquals(200, res.status) // user 2's first write is fine
        verify(chain, times(2)).doFilter(any(), any())
    }

    @Test
    fun `disabled filter never throttles`() {
        authenticate(1L)
        val f = filter(enabled = false, capacity = 1)
        val chain: FilterChain = mock(FilterChain::class.java)
        repeat(5) { f.doFilter(post(), MockHttpServletResponse(), chain) }
        verify(chain, times(5)).doFilter(any(), any())
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
./gradlew test --tests "com.shareddocs.backend.config.RateLimitFilterTest"
```
Expected: FAIL — `RateLimitFilter` is an unresolved reference (does not compile yet).

- [ ] **Step 3: Implement the filter**

Create `src/main/kotlin/com/shareddocs/backend/config/RateLimitFilter.kt`:

```kotlin
package com.shareddocs.backend.config

import com.shareddocs.backend.auth.AppPrincipal
import io.github.bucket4j.Bandwidth
import io.github.bucket4j.Bucket
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap

/**
 * Per-user write-throttle. Runs after [com.shareddocs.backend.auth.JwtAuthFilter]
 * (principal in the SecurityContext) and only gates mutating methods by an
 * authenticated user — reads, the unauth public surface, and OAuth/login routes
 * pass through (those are Cloudflare's job, out of scope). Buckets live in an
 * in-memory map keyed by userId (bounded by the user count; single instance, so
 * it resets on redeploy — acceptable for this scale).
 *
 * Like WorkspaceContextFilter, this runs outside the DispatcherServlet, so it
 * writes its own minimal problem+json rather than going through @RestControllerAdvice.
 */
@Component
class RateLimitFilter(
    private val properties: RateLimitProperties,
) : OncePerRequestFilter() {

    private val buckets = ConcurrentHashMap<Long, Bucket>()

    private fun newBucket(): Bucket {
        val limit = Bandwidth.builder()
            .capacity(properties.capacity)
            .refillGreedy(properties.writesPerMinute, Duration.ofMinutes(1))
            .build()
        return Bucket.builder().addLimit(limit).build()
    }

    private fun isMutating(method: String) =
        method == "POST" || method == "PUT" || method == "PATCH" || method == "DELETE"

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (!properties.enabled || !isMutating(request.method)) {
            filterChain.doFilter(request, response)
            return
        }
        val principal = SecurityContextHolder.getContext().authentication?.principal as? AppPrincipal
        if (principal == null) {
            filterChain.doFilter(request, response)
            return
        }

        val bucket = buckets.computeIfAbsent(principal.userId) { newBucket() }
        val probe = bucket.tryConsumeAndReturnRemaining(1)
        if (probe.isConsumed) {
            filterChain.doFilter(request, response)
            return
        }

        val retryAfterSeconds = Duration.ofNanos(probe.nanosToWaitForRefill).seconds.coerceAtLeast(1)
        response.status = HttpServletResponse.SC_TOO_MANY_REQUESTS  // 429
        response.setHeader("Retry-After", retryAfterSeconds.toString())
        response.contentType = "application/problem+json"
        response.writer.write(
            """{"type":"about:blank","title":"Too Many Requests","status":429,"detail":"요청이 너무 많아요. 잠시 후 다시 시도해 주세요."}""",
        )
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
./gradlew test --tests "com.shareddocs.backend.config.RateLimitFilterTest"
```
Expected: PASS (all 6 tests).

- [ ] **Step 5: Register the filter in SecurityConfig**

In `src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt`:

Add the import:
```kotlin
import com.shareddocs.backend.config.RateLimitFilter
```
Add it to the constructor (after `workspaceContextFilter`):
```kotlin
    private val rateLimitFilter: RateLimitFilter,
```
Change the filter wiring at the end of `securityFilterChain` so the order is JwtAuth → RateLimit → WorkspaceContext. Replace the existing two `addFilter…` lines:
```kotlin
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
            // After auth is established, resolve the workspace context so
            // @CurrentWorkspace can be injected downstream.
            .addFilterAfter(workspaceContextFilter, JwtAuthFilter::class.java)
```
with:
```kotlin
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter::class.java)
            // Throttle writes per-user before any workspace resolution work.
            .addFilterAfter(rateLimitFilter, JwtAuthFilter::class.java)
            // After auth + throttle, resolve the workspace context so
            // @CurrentWorkspace can be injected downstream.
            .addFilterAfter(workspaceContextFilter, RateLimitFilter::class.java)
```

- [ ] **Step 6: Verify the app still wires up**

```bash
./gradlew compileKotlin && ./gradlew test --tests "com.shareddocs.backend.config.RateLimitFilterTest"
```
Expected: compiles; filter tests still green. (Full-context boot is verified by the suite in Task 3 / done-when.)

- [ ] **Step 7: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/config/RateLimitFilter.kt src/test/kotlin/com/shareddocs/backend/config/RateLimitFilterTest.kt src/main/kotlin/com/shareddocs/backend/auth/SecurityConfig.kt
git commit -m "feat(ratelimit): per-user write-throttle filter (429 + Retry-After)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Upload storage quota (TDD)

Per-user total-bytes ceiling, checked before the file is written.

**Files:**
- Create: `src/test/kotlin/com/shareddocs/backend/note/AttachmentQuotaTest.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/note/AttachmentRepository.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/note/FileStorageProperties.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/note/AttachmentService.kt`

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/note/AttachmentQuotaTest.kt`. Mirrors `ShareServiceTest`'s setup idiom; sets a tiny 100-byte cap via `@TestPropertySource` so the quota trips with small files:

```kotlin
package com.shareddocs.backend.note

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.Workspace
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import org.springframework.http.HttpStatus
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = ["app.storage.per-user-quota-bytes=100"])
class AttachmentQuotaTest(
    @Autowired private val attachmentService: AttachmentService,
    @Autowired private val attachments: AttachmentRepository,
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val users: UserRepository,
) {
    private fun newUser(): User = users.save(User(email = "u-${UUID.randomUUID()}@t.test", name = "U", role = Role.USER))
    private fun wsFor(userId: Long): Workspace = workspaces.create(userId, "WS", "ws-${UUID.randomUUID().toString().take(8)}")
    private fun noteIn(ws: Workspace, authorId: Long): Long =
        noteService.create(CreateNoteRequest(title = "n", body = "<p>hi</p>", visibility = Visibility.WORKSPACE), ws.id!!, authorId).id
    private fun file(bytes: Int) = MockMultipartFile("file", "a.txt", "text/plain", ByteArray(bytes))

    @Test
    fun `sumSizeBytesByUploadedByUserId is 0 for a user with no attachments`() {
        val u = newUser()
        assertEquals(0L, attachments.sumSizeBytesByUploadedByUserId(u.id!!))
    }

    @Test
    fun `upload under the cap succeeds`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        val res = attachmentService.upload(noteId, ws.id!!, file(60), owner.id!!)
        assertEquals(60L, res.sizeBytes)
        assertEquals(60L, attachments.sumSizeBytesByUploadedByUserId(owner.id!!))
    }

    @Test
    fun `an upload that crosses the cap is rejected 413`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        attachmentService.upload(noteId, ws.id!!, file(60), owner.id!!) // total 60, under 100

        val ex = assertThrows(ResponseStatusException::class.java) {
            attachmentService.upload(noteId, ws.id!!, file(60), owner.id!!) // would be 120 > 100
        }
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.statusCode)
        assertEquals(60L, attachments.sumSizeBytesByUploadedByUserId(owner.id!!)) // second upload not recorded
    }
}
```

Note: `AttachmentResponse` (returned by `upload`) exposes `sizeBytes` — confirm the field name when implementing; if it differs, adjust the assertion to the actual property.

- [ ] **Step 2: Run the test to verify it fails**

```bash
./gradlew test --tests "com.shareddocs.backend.note.AttachmentQuotaTest"
```
Expected: FAIL — `sumSizeBytesByUploadedByUserId` is unresolved (does not compile).

- [ ] **Step 3: Add the repository aggregate**

In `src/main/kotlin/com/shareddocs/backend/note/AttachmentRepository.kt`, add the import and method:

```kotlin
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
```
```kotlin
    @Query("SELECT COALESCE(SUM(a.sizeBytes), 0) FROM Attachment a WHERE a.uploadedBy.id = :userId")
    fun sumSizeBytesByUploadedByUserId(@Param("userId") userId: Long): Long
```
(`COALESCE(..., 0)` guarantees a non-null `0` when the user has no attachments.)

- [ ] **Step 4: Add the quota property**

In `src/main/kotlin/com/shareddocs/backend/note/FileStorageProperties.kt`, add the field (default 500 MB):

```kotlin
@ConfigurationProperties(prefix = "app.storage")
data class FileStorageProperties(
    val uploadDir: String = "./uploads",
    val perUserQuotaBytes: Long = 524_288_000,   // 500 MB
)
```

- [ ] **Step 5: Enforce the quota in AttachmentService.upload**

In `src/main/kotlin/com/shareddocs/backend/note/AttachmentService.kt`, inject the properties by adding a constructor parameter:

```kotlin
    private val properties: FileStorageProperties,
```
(Add it to the existing constructor list — e.g. after `noteService`.)

Then in `upload(...)`, **after** the author check + `users.findById` and **before** `storage.store(file)`, add the quota guard:

```kotlin
        val currentBytes = attachments.sumSizeBytesByUploadedByUserId(callerUserId)
        if (currentBytes + file.size > properties.perUserQuotaBytes) {
            throw ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "저장 용량을 초과했어요.")
        }
        val stored = storage.store(file)
```
(`ResponseStatusException` and `HttpStatus` are already imported in this file.)

- [ ] **Step 6: Run the test to verify it passes**

```bash
./gradlew test --tests "com.shareddocs.backend.note.AttachmentQuotaTest"
```
Expected: PASS (all 3 tests). If the `sizeBytes` assertion fails on a name mismatch, correct it to `AttachmentResponse`'s actual field and re-run.

- [ ] **Step 7: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/AttachmentRepository.kt src/main/kotlin/com/shareddocs/backend/note/FileStorageProperties.kt src/main/kotlin/com/shareddocs/backend/note/AttachmentService.kt src/test/kotlin/com/shareddocs/backend/note/AttachmentQuotaTest.kt
git commit -m "feat(uploads): per-user storage quota (413 over 500MB)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done-when

- `RateLimitFilter` throttles authenticated writes per user (429 + `Retry-After`), never throttles GETs or unauthenticated/`enabled=false` requests, and buckets are per-user independent.
- `AttachmentService.upload` rejects an upload that would push the user's total over `app.storage.per-user-quota-bytes` (413) and records nothing; the `SUM` aggregate is correct (0 when empty).
- `test` profile has `app.ratelimit.enabled: false`.
- **Full suite green:** `./gradlew test` passes (confirms context boots with the new filter + properties, and the throttle being off in `test` didn't break existing multi-write tests).
- `./gradlew build -x test` succeeds.

Run the final full verification:
```bash
./gradlew clean test
```
Expected: BUILD SUCCESSFUL, full suite green.
