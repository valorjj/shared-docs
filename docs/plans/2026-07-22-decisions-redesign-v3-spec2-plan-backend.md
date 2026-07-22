# Decisions v3 Spec 2 — Backend Implementation Plan (후보 장점/단점 rich HTML + 자료)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the discrete-line 장점/단점 model with two server-sanitized rich-HTML fields on `options`, exposed through the existing `PATCH /api/options/{id}`.

**Architecture:** Add `options.pros`/`options.cons` (TEXT) + a jsoup `HtmlSanitizer` (allowlist), extend `UpdateOptionRequest`/`updateOption`, swap `OptionResponse.proCons` → `pros`/`cons`, then delete the entire `OptionProCon` stack (entity, repo, service, controller, DTOs, exceptions, table). 자료 (`option_resources`) is untouched.

**Tech Stack:** Spring Boot 3.5 + Kotlin, JPA/Hibernate 6 (`ddl-auto: validate`), Flyway (latest V34 → this adds V35, V36), MariaDB, JUnit 5, jsoup 1.18.3 (already a dependency).

## Global Constraints

- Repo: `shared-docs-backend`. Work on branch `decisions-v3-spec2`.
- Flyway forward-only; `ddl-auto: validate` — every schema change is a migration, and the entity mapping must match after each task. One migration per task.
- **NEVER delete `PlanEventType` enum constants** (append-only audit table — historical rows deserialize by name). `PROCON_ADDED`/`PROCON_REMOVED` stay in the enum; we only stop recording them.
- RFC-7807 errors via existing `ApiException(status, code, title, detail)`. FK/optimistic-locking conventions unchanged.
- All persisted 장점/단점 HTML MUST be sanitized server-side before save — the client editor's constrained schema is convenience, not the trust boundary.
- Build gate: `./gradlew build` (runs all tests) must be green at the end of every task.
- Git identity for this repo = personal (`valorjj`). Commit only; do not push/merge/deploy until the whole plan is done and the user authorizes the coordinated deploy.

---

### Task BE-1: `HtmlSanitizer` component (jsoup allowlist)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/HtmlSanitizer.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/decision/HtmlSanitizerTest.kt`

**Interfaces:**
- Produces: `@Component class HtmlSanitizer { fun clean(html: String?): String? }` — returns null for null/blank input; otherwise returns jsoup-cleaned HTML restricted to the 장점/단점 allowlist. Injected into `PlanService` in BE-2.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class HtmlSanitizerTest {
    private val san = HtmlSanitizer()

    @Test fun `strips script and event handlers`() {
        val out = san.clean("""<p>ok<script>alert(1)</script></p><p onclick="x()">hi</p>""")
        assertThat(out).doesNotContain("script").doesNotContain("onclick")
        assertThat(out).contains("ok").contains("hi")
    }

    @Test fun `keeps allowed formatting`() {
        val out = san.clean("<p><strong>bold</strong> <em>it</em> <s>st</s></p><ul><li>a</li></ul><ol><li>b</li></ol>")
        assertThat(out).contains("<strong>").contains("<em>").contains("<s>").contains("<ul>").contains("<li>").contains("<ol>")
    }

    @Test fun `keeps safe links and drops javascript hrefs`() {
        val ok = san.clean("""<a href="https://x.com">x</a>""")
        assertThat(ok).contains("href=\"https://x.com\"").contains("rel=").contains("nofollow")
        val bad = san.clean("""<a href="javascript:alert(1)">x</a>""")
        assertThat(bad).doesNotContain("javascript:")
    }

    @Test fun `drops disallowed structural tags`() {
        val out = san.clean("<h1>big</h1><div><img src=\"x\"><table><tr><td>c</td></tr></table></div>")
        assertThat(out).doesNotContain("<h1>").doesNotContain("<img").doesNotContain("<table").contains("big").contains("c")
    }

    @Test fun `null or blank returns null`() {
        assertThat(san.clean(null)).isNull()
        assertThat(san.clean("   ")).isNull()
        assertThat(san.clean("<p>  </p>")).isNull()
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend && ./gradlew test --tests 'com.shareddocs.backend.decision.HtmlSanitizerTest'`
Expected: FAIL — `HtmlSanitizer` unresolved.

- [ ] **Step 3: Write the implementation**

```kotlin
package com.shareddocs.backend.decision

import org.jsoup.Jsoup
import org.jsoup.safety.Safelist
import org.springframework.stereotype.Component

/**
 * Sanitizes 장점/단점 rich HTML before persistence. Allowlist matches the
 * frontend RichTextField's constrained Tiptap schema; the client is convenience,
 * this is the trust boundary. Returns null for null/blank/empty-markup input so
 * an emptied field round-trips to NULL rather than "<p></p>".
 */
@Component
class HtmlSanitizer {
    private val safelist: Safelist = Safelist()
        .addTags("p", "br", "b", "strong", "i", "em", "s", "ul", "ol", "li", "a")
        .addAttributes("a", "href")
        .addProtocols("a", "href", "http", "https", "mailto")
        .addEnforcedAttribute("a", "rel", "nofollow noopener")

    fun clean(html: String?): String? {
        if (html.isNullOrBlank()) return null
        val cleaned = Jsoup.clean(html, safelist)
        // Collapse markup that carries no text (e.g. "<p></p>", stripped tags) to null.
        return if (Jsoup.parse(cleaned).text().isBlank()) null else cleaned
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests 'com.shareddocs.backend.decision.HtmlSanitizerTest'`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend
git add src/main/kotlin/com/shareddocs/backend/decision/HtmlSanitizer.kt src/test/kotlin/com/shareddocs/backend/decision/HtmlSanitizerTest.kt
git commit -m "feat(decisions): add HtmlSanitizer for 장점/단점 rich HTML (jsoup allowlist)"
```

---

### Task BE-2: Add `pros`/`cons` (V35), wire into update path (additive — `proCons` stays)

**Files:**
- Create: `src/main/resources/db/migration/V35__option_pros_cons.sql`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/Option.kt` (add fields)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt:44-48` (UpdateOptionRequest) and `:147-158` (OptionResponse)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (inject sanitizer, `updateOption`, `toResponse`)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/OptionProsConsTest.kt`

**Interfaces:**
- Consumes: `HtmlSanitizer.clean(String?): String?` (BE-1).
- Produces: `OptionResponse.pros: String?`, `OptionResponse.cons: String?` (populated everywhere `toResponse` is built); `UpdateOptionRequest.pros/cons: String?` applied+sanitized by `updateOption`. `proCons` field REMAINS in this task (removed in BE-3) to keep the build green.

- [ ] **Step 1: Write the migration**

```sql
-- V35__option_pros_cons.sql
-- Rich-HTML 장점/단점 per 후보 (replaces the option_pro_cons line model; table dropped in V36).
ALTER TABLE options
    ADD COLUMN pros TEXT NULL,
    ADD COLUMN cons TEXT NULL;
```

- [ ] **Step 2: Add entity fields**

In `Option.kt`, after the `sortOrder` column (line ~40), add:

```kotlin
    /** 장점 as sanitized rich HTML; null when empty. */
    @Column(columnDefinition = "text")
    var pros: String? = null,

    /** 단점 as sanitized rich HTML; null when empty. */
    @Column(columnDefinition = "text")
    var cons: String? = null,
```

- [ ] **Step 3: Extend DTOs**

In `DecisionDto.kt`, `UpdateOptionRequest` becomes:

```kotlin
data class UpdateOptionRequest(
    @field:Size(max = 200) val title: String? = null,
    @field:Size(max = 5000) val description: String? = null,
    val sortOrder: Int? = null,
    @field:Size(max = 20000) val pros: String? = null,
    @field:Size(max = 20000) val cons: String? = null,
)
```

`OptionResponse` gains two fields (keep `proCons` for now):

```kotlin
data class OptionResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val sortOrder: Int,
    val voterUserIds: List<Long>,
    val proCons: List<ProConResponse>,
    val pros: String? = null,
    val cons: String? = null,
    val resources: List<OptionResourceResponse> = emptyList(),
    val confirmed: Boolean = false,
    val confirmedAt: Instant? = null,
    val confirmedBy: Long? = null,
)
```

- [ ] **Step 4: Wire PlanService**

Inject the sanitizer — add to the `PlanService` constructor params:

```kotlin
    private val htmlSanitizer: HtmlSanitizer,
```

In `updateOption` (around line 548), apply + sanitize. `pros`/`cons` use a presence sentinel is unnecessary — treat "field present in body" via nullability is ambiguous for clearing, so we adopt: **the client always sends the full current value of the side it edited** (autosave sends `{pros}` or `{cons}`), and an explicit empty clears to null. Apply only when the key is non-null OR intentionally cleared. Since Kotlin data-class nullability can't distinguish "absent" from "null", and autosave never sends both keys at once, apply each independently only when present is not distinguishable — so we sanitize-and-set whenever the request field is non-null, and additionally allow clearing via a blank string:

```kotlin
    fun updateOption(workspaceId: Long, optionId: Long, request: UpdateOptionRequest): OptionResponse {
        val option = requireOption(workspaceId, optionId)
        request.title?.let { option.title = it.trim() }
        request.description?.let { option.description = it.trim() }
        request.sortOrder?.let { option.sortOrder = it }
        request.pros?.let { option.pros = htmlSanitizer.clean(it) }
        request.cons?.let { option.cons = htmlSanitizer.clean(it) }
        changes.publish(workspaceId, null)
        val proCons = optionProConRepository.findAllByOptionIdOrderByKindAscSortOrderAscIdAsc(optionId)
        return option.toResponse(proCons = proCons)
    }
```

> Note on clearing: the frontend sends the field's current HTML on blur; an emptied editor sends `"<p></p>"`/`""`, which `HtmlSanitizer.clean` collapses to `null`. `request.pros?.let { ... }` still fires for `""` (non-null), so the clear persists. Only a truly absent key (JSON omits it) leaves the side unchanged — which is exactly the autosave contract (edit 장점 → send only `pros`).

In `toResponse` (the `Option.toResponse` extension, ~line 636), add the two fields to the `OptionResponse(...)` call:

```kotlin
        pros = pros,
        cons = cons,
```

- [ ] **Step 5: Write the test**

```kotlin
package com.shareddocs.backend.decision

// Follow the existing decision integration-test setup in this package
// (e.g. OptionProConServiceTest / a *ServiceTest) for workspace/user/plan/subplan/option fixtures.
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@Transactional
class OptionProsConsTest {
    @Autowired lateinit var planService: PlanService
    // reuse the package's fixture helpers to create a workspace, user, plan, subplan, option

    @Test fun `update sanitizes and persists pros and cons; getTree exposes them`() {
        // val ctx = createPlanWithOption(...)   // per existing test helpers
        // planService.updateOption(ctx.workspaceId, ctx.optionId,
        //     UpdateOptionRequest(pros = "<p><strong>good</strong><script>x()</script></p>", cons = "<p>bad</p>"))
        // val tree = planService.getTree(ctx.workspaceId, ctx.planId)
        // val opt = tree.subPlans.flatMap { it.options }.first { it.id == ctx.optionId }
        // assertThat(opt.pros).contains("<strong>good</strong>").doesNotContain("script")
        // assertThat(opt.cons).contains("bad")
    }

    @Test fun `emptied pros clears to null`() {
        // planService.updateOption(ws, optId, UpdateOptionRequest(pros = "<p></p>"))
        // assertThat(planService.getTree(ws, planId)...pros).isNull()
    }
}
```

> The implementer MUST replace the commented fixture lines with the concrete helper calls used elsewhere in this test package (open `OptionProConServiceTest.kt` for the exact pattern) and make the assertions run. The test is not complete until it compiles and the two assertions execute.

- [ ] **Step 6: Build (migrates test DB, runs entity validation + tests)**

Run: `./gradlew build`
Expected: PASS. Flyway applies V35 on the test DB; Hibernate `validate` passes (entity now matches columns); new test green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(decisions): add options.pros/cons rich-HTML fields + sanitized update path (V35)"
```

---

### Task BE-3: Remove the entire `OptionProCon` stack + drop table (V36)

**Files:**
- Create: `src/main/resources/db/migration/V36__drop_option_pro_cons.sql`
- Delete: `OptionProCon.kt`, `OptionProConRepository.kt`, `OptionProConService.kt`, `OptionProConController.kt`, `src/test/kotlin/com/shareddocs/backend/decision/OptionProConServiceTest.kt`
- Modify: `DecisionDto.kt` (remove `CreateProConRequest`, `ProConResponse`, `OptionResponse.proCons`)
- Modify: `DecisionExceptions.kt` (remove `ProConNotFoundException`, `ProConForbiddenException`)
- Modify: `PlanService.kt` (remove `optionProConRepository` injection + all reads; keep `pros`/`cons`)
- Keep unchanged: `PlanEventType` enum (`PROCON_ADDED`/`PROCON_REMOVED` stay).

**Interfaces:**
- Produces: `OptionResponse` with NO `proCons` field — only `pros`/`cons`. This is the final shape the frontend targets.

- [ ] **Step 1: Write the drop migration**

```sql
-- V36__drop_option_pro_cons.sql
-- The line-based 장점/단점 model is replaced by options.pros/cons (V35). No data preserved
-- (feature was never surfaced; decisions data was wiped at the Spec 1 deploy).
DROP TABLE IF EXISTS option_pro_cons;
```

- [ ] **Step 2: Delete the ProCon code files**

```bash
cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend
git rm src/main/kotlin/com/shareddocs/backend/decision/OptionProCon.kt \
       src/main/kotlin/com/shareddocs/backend/decision/OptionProConRepository.kt \
       src/main/kotlin/com/shareddocs/backend/decision/OptionProConService.kt \
       src/main/kotlin/com/shareddocs/backend/decision/OptionProConController.kt \
       src/test/kotlin/com/shareddocs/backend/decision/OptionProConServiceTest.kt
```

- [ ] **Step 3: Remove ProCon DTOs and the `proCons` response field**

In `DecisionDto.kt`: delete `CreateProConRequest` (lines ~50-53) and `ProConResponse` (lines ~160-165). In `OptionResponse`, remove the `val proCons: List<ProConResponse>,` line. Note: `ProConKind` lives in `OptionProCon.kt` (deleted) — confirm nothing else imports it after this task.

- [ ] **Step 4: Remove ProCon exceptions**

In `DecisionExceptions.kt`, delete `ProConNotFoundException` and `ProConForbiddenException` (lines ~37-40).

- [ ] **Step 5: Clean `PlanService`**

Remove the constructor param `private val optionProConRepository: OptionProConRepository,` (line ~25). Then remove every `optionProConRepository` / `proCons` reference:
- Tree assembly (~178-185): drop the `proConsByOption` map and the `proCons =` arg to `toResponse`.
- SubPlan detail assembly (~409-413) and (~442-458): same.
- `updateOption` (~554-555): return `option.toResponse()` (no proCons lookup).
- `deleteOption` (~561): remove the `optionProConRepository.deleteAll(...)` line.
- `setOptionConfirmed` (~589-590): return `option.toResponse(votes = votes)`.
- `Option.toResponse` (~636-652): remove the `proCons` parameter and the `.proCons =` mapping; keep `pros = pros`, `cons = cons`.

Resulting `Option.toResponse`:

```kotlin
    private fun Option.toResponse(
        votes: List<OptionVote> = emptyList(),
        resources: List<OptionResourceResponse> = emptyList(),
    ): OptionResponse = OptionResponse(
        id = id!!,
        title = title,
        description = description,
        sortOrder = sortOrder,
        voterUserIds = votes.map { it.userId },
        pros = pros,
        cons = cons,
        resources = resources,
        confirmed = confirmed,
        confirmedAt = confirmedAt,
        confirmedBy = confirmedBy,
    )
```

- [ ] **Step 6: Grep for stragglers**

Run: `grep -rn 'ProCon\|proCon\|procons' src/main src/test`
Expected: only `PROCON_ADDED` / `PROCON_REMOVED` in `PlanEventType` (kept) and possibly a comment. Fix any other hit.

- [ ] **Step 7: Build**

Run: `./gradlew build`
Expected: PASS. Flyway applies V36; validate passes (entity gone AND table gone); all tests green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(decisions): remove OptionProCon stack + drop table (V36); OptionResponse now pros/cons only

Keeps PROCON_ADDED/PROCON_REMOVED enum constants (append-only audit)."
```

---

## Self-Review

- **Spec coverage:** V35 add columns ✓ (BE-2); V36 drop table ✓ (BE-3); OptionResponse proCons→pros/cons ✓ (BE-2 add, BE-3 remove); extend PATCH ✓ (BE-2); jsoup sanitize ✓ (BE-1 + BE-2 wiring); delete entity/repo/service/controller/DTOs/exceptions/test ✓ (BE-3); keep enum constants ✓ (BE-3 note); no timeline event for edits ✓ (updateOption records none).
- **Green per task:** BE-1 additive; BE-2 additive (proCons kept); BE-3 removes only after nothing reads it. Each ends on `./gradlew build` green.
- **Type consistency:** `pros`/`cons: String?` used identically in entity, DTO, response, and toResponse.
