# 안건 Context Menu + Customization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give 안건 (SubPlan) cards a right-click / long-press context menu that surfaces existing actions plus new customization — a shared accent color + icon and a personal collapse-to-row.

**Architecture:** Two nullable columns on `sub_plans` (`accent_color`, `icon`) carry the shared tag, set via a new non-lock-guarded `PATCH /api/subplans/{id}/appearance` that reuses the existing decisions realtime change-signal. A new reusable `ContextMenu` UI primitive (right-click + touch long-press) hosts an inline menu on `SubPlanCard`. Collapse-to-row is per-device `localStorage`.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + MariaDB + Flyway (backend); Vite + React 19 + TypeScript + CSS Modules + React Query + React Router (frontend).

## Global Constraints

- All UI text in Korean. Lucide icons only, never emoji.
- CSS Modules + design tokens only — no Tailwind, no hardcoded hex in components. Cards never lift (hairline + `--c-surface-tint`); shadow only on floating surfaces (the menu qualifies).
- No `setState` in effect — use lazy `useState` initializers, derive on render, or imperative DOM writes in a layout effect.
- No backwards-compat shims, no feature flags. Comments only where the *why* is non-obvious.
- Backend: Flyway owns schema (this adds **V26**); Hibernate `ddl-auto: validate`. Workspace-scoped queries filter by `@CurrentWorkspace.id`; missing → 404, never 403 leak. Portfolio-grade (FK/constraints/RFC-7807).
- Every endpoint requires the `X-Workspace-Id` header (axios interceptor injects it).
- Frontend has **no test runner**: FE task gates are `npx tsc -b --noEmit`, `npm run build`, `npx eslint <touched>`. Backend uses JUnit + real MariaDB on :3307 (`test` profile).
- The color/icon allowlists MUST match exactly between backend (`PlanService` companion) and frontend (`types.ts`): colors `red, amber, green, blue, purple, gray`; icons `Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock`.

---

### Task 1: BE — V26 columns + entity + read-path threading

**Files:**
- Create: `src/main/resources/db/migration/V26__subplan_appearance.sql`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlan.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (SubPlanResponse, SubPlanDetailResponse)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`SubPlan.toResponse` ext, `getSubPlanDetail` construction)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanAppearanceTest.kt`

**Interfaces:**
- Produces: `SubPlan.accentColor: String?`, `SubPlan.icon: String?`; `SubPlanResponse.accentColor/icon`; `SubPlanDetailResponse.accentColor/icon`. Task 2 consumes the entity setters; the FE (Task 3) consumes the response fields.

- [ ] **Step 1: Write the failing test**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubPlanAppearanceTest(
    @Autowired private val service: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val subPlanRepository: SubPlanRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${java.util.UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Seed(val wsId: Long, val planId: Long, val subPlanId: Long, val ownerId: Long)

    private fun seed(): Seed {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = service.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "안건"))
        return Seed(ws.id!!, plan.id, sp.id, owner.id!!)
    }

    @Test
    fun `appearance columns default null and surface in tree and detail`() {
        val (ws, planId, sp) = seed()

        val tree = service.getTree(ws, planId)
        val node = tree.subPlans.first { it.id == sp }
        assertNull(node.accentColor)
        assertNull(node.icon)

        // set directly on the entity to prove the read path (write path is Task 2)
        val entity = subPlanRepository.findById(sp).get()
        entity.accentColor = "red"
        entity.icon = "Flag"
        subPlanRepository.save(entity)

        val detail = service.getSubPlanDetail(ws, sp)
        assertEquals("red", detail.accentColor)
        assertEquals("Flag", detail.icon)
    }
}
```

- [ ] **Step 2: Run it — verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanAppearanceTest"`
Expected: FAIL to compile — `accentColor`/`icon` unresolved on `SubPlan`, `SubPlanResponse`, `SubPlanDetailResponse`.

- [ ] **Step 3: Migration V26**

Create `src/main/resources/db/migration/V26__subplan_appearance.sql`:

```sql
-- 안건 (sub_plan) shared appearance tag: accent color + Lucide icon.
-- Light annotation (not lock-guarded, no timeline event); values validated app-side.
ALTER TABLE sub_plans
    ADD COLUMN accent_color VARCHAR(16) NULL,
    ADD COLUMN icon         VARCHAR(32) NULL;
```

- [ ] **Step 4: Entity columns**

In `SubPlan.kt`, add two constructor properties after `canvasY` (before `createdAt`/other trailing fields — match the existing constructor ordering; place alongside the other `var` columns):

```kotlin
    @Column(name = "accent_color", length = 16)
    var accentColor: String? = null,

    @Column(name = "icon", length = 32)
    var icon: String? = null,
```

- [ ] **Step 5: Response DTO fields**

In `DecisionDto.kt`, add to `SubPlanResponse` (after `parentSubPlanId`):

```kotlin
    val accentColor: String?,
    val icon: String?,
```

and to `SubPlanDetailResponse` (after `parentSubPlanId`):

```kotlin
    val accentColor: String?,
    val icon: String?,
```

- [ ] **Step 6: Thread through the builders in PlanService**

In the private `SubPlan.toResponse(...)` extension, add the two fields to the `SubPlanResponse(...)` construction (after `childSubPlanCount = childSubPlanCount,`):

```kotlin
        accentColor = accentColor,
        icon = icon,
```

In `getSubPlanDetail(...)`, find the `SubPlanDetailResponse(...)` construction and add (after `parentSubPlanId = sp.parentSubPlanId,`):

```kotlin
        accentColor = sp.accentColor,
        icon = sp.icon,
```

- [ ] **Step 7: Run the test — verify it passes**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanAppearanceTest"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main/resources/db/migration/V26__subplan_appearance.sql \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlan.kt \
        src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/SubPlanAppearanceTest.kt
git commit -m "feat(decisions): V26 sub_plan appearance columns + read-path threading"
```

---

### Task 2: BE — appearance write endpoint + validation + realtime

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (AppearanceRequest)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (allowlists + `setAppearance`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt` (PATCH endpoint)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/SubPlanAppearanceTest.kt` (extend)

**Interfaces:**
- Consumes: `SubPlan.accentColor/icon` (Task 1), `requireSubPlan`, `changes.publish` (existing).
- Produces: `PlanService.setAppearance(workspaceId: Long, subPlanId: Long, request: AppearanceRequest): SubPlanResponse`; `PATCH /api/subplans/{id}/appearance`; `PlanService.ACCENT_COLORS`/`ACCENT_ICONS` sets. FE (Task 3) calls the endpoint.

- [ ] **Step 1: Write the failing tests (append to `SubPlanAppearanceTest`)**

```kotlin
    @Test
    fun `setAppearance persists valid color and icon and clears with null`() {
        val (ws, _, sp) = seed()

        service.setAppearance(ws, sp, AppearanceRequest(accentColor = "green", icon = "Home"))
        var detail = service.getSubPlanDetail(ws, sp)
        assertEquals("green", detail.accentColor)
        assertEquals("Home", detail.icon)

        service.setAppearance(ws, sp, AppearanceRequest(accentColor = null, icon = null))
        detail = service.getSubPlanDetail(ws, sp)
        assertNull(detail.accentColor)
        assertNull(detail.icon)
    }

    @Test
    fun `setAppearance rejects an unknown color`() {
        val (ws, _, sp) = seed()
        val ex = org.junit.jupiter.api.Assertions.assertThrows(
            org.springframework.web.server.ResponseStatusException::class.java,
        ) { service.setAppearance(ws, sp, AppearanceRequest(accentColor = "chartreuse", icon = null)) }
        assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, ex.statusCode)
    }

    @Test
    fun `setAppearance rejects an unknown icon`() {
        val (ws, _, sp) = seed()
        org.junit.jupiter.api.Assertions.assertThrows(
            org.springframework.web.server.ResponseStatusException::class.java,
        ) { service.setAppearance(ws, sp, AppearanceRequest(accentColor = null, icon = "Rocket")) }
    }

    @Test
    fun `setAppearance on a foreign workspace throws not-found`() {
        val (_, _, sp) = seed()
        val otherOwner = newUser()
        val otherWs = workspaces.create(otherOwner.id!!, "W2", "w2")
        org.junit.jupiter.api.Assertions.assertThrows(SubPlanNotFoundException::class.java) {
            service.setAppearance(otherWs.id!!, sp, AppearanceRequest(accentColor = "red", icon = null))
        }
    }

    @Test
    fun `setAppearance works on a locked plan (not lock-guarded)`() {
        val (ws, planId, sp, owner) = seed()
        service.lock(ws, planId, owner)
        // must NOT throw PlanLockedException
        service.setAppearance(ws, sp, AppearanceRequest(accentColor = "blue", icon = null))
        assertEquals("blue", service.getSubPlanDetail(ws, sp).accentColor)
    }
```

- [ ] **Step 2: Run — verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.SubPlanAppearanceTest"`
Expected: FAIL — `AppearanceRequest` and `service.setAppearance` unresolved.

- [ ] **Step 3: Request DTO**

In `DecisionDto.kt`, add near the other request DTOs:

```kotlin
data class AppearanceRequest(
    val accentColor: String?,
    val icon: String?,
)
```

- [ ] **Step 4: Allowlists + service method**

In `PlanService.kt`, add a companion object (or extend the existing one) on the class:

```kotlin
    companion object {
        val ACCENT_COLORS = setOf("red", "amber", "green", "blue", "purple", "gray")
        val ACCENT_ICONS = setOf("Flag", "Star", "AlertTriangle", "Home", "Car", "Heart", "Briefcase", "Clock")
    }
```

Add the method (near `setSubPlanDeadline`). Note: **no** `lockGuard` call, **no** `events.record` — it is a cosmetic annotation:

```kotlin
    /** Set/clear a 안건's shared appearance tag (accent color + icon). NOT lock-guarded
     *  and records no timeline event — cosmetic. Validates against the allowlists. */
    fun setAppearance(workspaceId: Long, subPlanId: Long, request: AppearanceRequest): SubPlanResponse {
        val subPlan = requireSubPlan(workspaceId, subPlanId)
        request.accentColor?.let {
            if (it !in ACCENT_COLORS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid accentColor")
        }
        request.icon?.let {
            if (it !in ACCENT_ICONS) throw ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid icon")
        }
        subPlan.accentColor = request.accentColor
        subPlan.icon = request.icon
        changes.publish(workspaceId, subPlan.planId)
        return subPlanResponseOf(subPlan)
    }
```

Add imports if missing: `import org.springframework.http.HttpStatus` and `import org.springframework.web.server.ResponseStatusException`.

- [ ] **Step 5: Controller endpoint**

In `SubPlanController.kt`, add:

```kotlin
    @PatchMapping("/{subPlanId}/appearance")
    fun setAppearance(
        @CurrentWorkspace ws: Workspace,
        @PathVariable subPlanId: Long,
        @RequestBody request: AppearanceRequest,
    ): SubPlanResponse = service.setAppearance(ws.id!!, subPlanId, request)
```

- [ ] **Step 6: Run the full suite — verify green**

Run: `./gradlew test`
Expected: PASS (all prior tests + the 5 new appearance tests).

- [ ] **Step 7: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/main/kotlin/com/shareddocs/backend/decision/SubPlanController.kt \
        src/test/kotlin/com/shareddocs/backend/decision/SubPlanAppearanceTest.kt
git commit -m "feat(decisions): PATCH /api/subplans/{id}/appearance (validated, not lock-guarded, realtime)"
```

---

### Task 3: FE — types + api hook

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`

**Interfaces:**
- Consumes: Task 1/2 response fields + endpoint.
- Produces: `SubPlanNode.accentColor/icon`, `SubPlanDetail.accentColor/icon`; `ACCENT_COLORS`, `ACCENT_ICONS`, `AccentColor`, `AccentIcon`; `useSetAppearance()`. Tasks 5/6 consume these.

- [ ] **Step 1: types.ts — fields + allowlists**

Add `accentColor` + `icon` to both `SubPlanNode` and `SubPlanDetail` (after their `parentSubPlanId` fields):

```ts
  accentColor: string | null
  icon: string | null
```

Add near the other exported constants/types:

```ts
export const ACCENT_COLORS = ['red', 'amber', 'green', 'blue', 'purple', 'gray'] as const
export type AccentColor = typeof ACCENT_COLORS[number]

export const ACCENT_ICONS = ['Flag', 'Star', 'AlertTriangle', 'Home', 'Car', 'Heart', 'Briefcase', 'Clock'] as const
export type AccentIcon = typeof ACCENT_ICONS[number]
```

- [ ] **Step 2: api.ts — mutation hook**

Add (near `useSetSubPlanDeadline`):

```ts
export function useSetAppearance() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; accentColor: string | null; icon: string | null }) =>
      (await apiClient.patch<SubPlanNode>(`/api/subplans/${v.id}/appearance`, { accentColor: v.accentColor, icon: v.icon })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Gates**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/types.ts src/features/decisions/api.ts`
Expected: clean (this task only adds; it typechecks on its own).

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions): FE types + useSetAppearance for 안건 color/icon"
```

---

### Task 4: FE — `--c-tag-*` palette tokens (4 themes)

**Files:**
- Modify: `src/components/ui/tokens.css` (`:root` base / light values)
- Modify: `src/components/ui/themes.css` (dark, dracula, monokai overrides)

**Interfaces:**
- Produces: `--c-tag-red|amber|green|blue|purple|gray` in every theme. Task 6 consumes them via `var(--c-tag-{slug})`.

- [ ] **Step 1: Base palette in tokens.css**

In `src/components/ui/tokens.css`, immediately after the `--c-accent-*` block in `:root`, add:

```css
  /* Tag palette — small accents (dot + 3px bar) for 안건 color tags. Base = light. */
  --c-tag-red: #d64545;
  --c-tag-amber: #c98a1a;
  --c-tag-green: #2f8a57;
  --c-tag-blue: #2f6fb0;
  --c-tag-purple: #7c5cbf;
  --c-tag-gray: #8a8f98;
```

- [ ] **Step 2: Per-theme overrides in themes.css**

In `src/components/ui/themes.css`, add a tag block inside each theme selector (place after that theme's `--c-accent` line).

`:root[data-theme='dark']`:

```css
  --c-tag-red: #ff6b6b;
  --c-tag-amber: #e0a44a;
  --c-tag-green: #4fbf82;
  --c-tag-blue: #5b9bd8;
  --c-tag-purple: #a98fe0;
  --c-tag-gray: #9aa0ab;
```

`:root[data-theme='dracula']`:

```css
  --c-tag-red: #ff5555;
  --c-tag-amber: #ffb86c;
  --c-tag-green: #50fa7b;
  --c-tag-blue: #8be9fd;
  --c-tag-purple: #bd93f9;
  --c-tag-gray: #6272a4;
```

`:root[data-theme='monokai']`:

```css
  --c-tag-red: #f92672;
  --c-tag-amber: #fd971f;
  --c-tag-green: #a6e22e;
  --c-tag-blue: #66d9ef;
  --c-tag-purple: #ae81ff;
  --c-tag-gray: #75715e;
```

- [ ] **Step 3: Gate**

Run: `npm run build`
Expected: success (CSS-only change).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/tokens.css src/components/ui/themes.css
git commit -m "feat(ui): --c-tag-* accent palette across all four themes"
```

---

### Task 5: FE — `ContextMenu` UI primitive

**Files:**
- Create: `src/components/ui/ContextMenu.tsx`
- Create: `src/components/ui/ContextMenu.module.css`
- Modify: `src/components/ui/index.ts` (barrel export — verify the file name; if the barrel is `index.tsx` use that)

**Interfaces:**
- Produces: `useContextMenu()` → `{ open, position, close, triggerProps }`; `<ContextMenu open position onClose>`, `<ContextMenuItem onSelect danger>`, `<ContextMenuDivider>`, `<ContextMenuGroup label>`. Task 6 consumes all.

- [ ] **Step 1: Component**

Create `src/components/ui/ContextMenu.tsx`:

```tsx
import {
  useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import styles from './ContextMenu.module.css'

type Pos = { x: number; y: number }

/** Opens a context menu on right-click or a ~500ms touch long-press.
 *  setState happens only in event handlers (never in an effect). */
export function useContextMenu() {
  const [position, setPosition] = useState<Pos | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const clear = () => {
    if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined }
  }

  const onContextMenu = (e: { preventDefault: () => void; clientX: number; clientY: number }) => {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
  }
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    const { clientX, clientY } = e
    clear()
    timer.current = window.setTimeout(() => setPosition({ x: clientX, y: clientY }), 500)
  }

  return {
    open: position != null,
    position,
    close: () => setPosition(null),
    triggerProps: {
      onContextMenu,
      onPointerDown,
      onPointerUp: clear,
      onPointerMove: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  }
}

export function ContextMenu({
  open, position, onClose, children,
}: {
  open: boolean
  position: Pos | null
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Clamp into the viewport imperatively AFTER layout — no setState, so no
  // set-state-in-effect. Runs before paint (useLayoutEffect) so there's no flash.
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !position || !el) return
    const pad = 8
    const w = el.offsetWidth
    const h = el.offsetHeight
    const x = Math.max(pad, Math.min(position.x, window.innerWidth - w - pad))
    const y = Math.max(pad, Math.min(position.y, window.innerHeight - h - pad))
    el.style.left = `${x}px`
    el.style.top = `${y}px`
  }, [open, position])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onScroll = () => onClose()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('mousedown', onDown, true)
    }
  }, [open, onClose])

  if (!open || !position) return null

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className={styles.menu}
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  )
}

export function ContextMenuItem({
  children, onSelect, danger = false, disabled = false,
}: {
  children: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${styles.item} ${danger ? styles.danger : ''}`}
      disabled={disabled}
      onClick={onSelect}
    >
      {children}
    </button>
  )
}

export function ContextMenuDivider() {
  return <div className={styles.divider} role="separator" />
}

export function ContextMenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      <div className={styles.groupBody}>{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Styles**

Create `src/components/ui/ContextMenu.module.css`:

```css
.menu {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  max-width: 260px;
  padding: var(--sp-1);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: cm-in var(--t-fast);
}

@keyframes cm-in {
  from { opacity: 0; transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .menu { animation: none; }
}

.item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  min-height: 36px;
  padding: var(--sp-2) var(--sp-2);
  background: none;
  border: none;
  border-radius: var(--r-sm);
  font: inherit;
  font-size: var(--fs-sm);
  color: var(--c-text);
  text-align: left;
  cursor: pointer;
}

.item:hover:not(:disabled) { background: var(--c-surface-tint); }
.item:focus-visible { outline: none; box-shadow: var(--ring-focus); }
.item:disabled { opacity: 0.45; cursor: not-allowed; }

.danger { color: var(--c-danger); }
.danger:hover:not(:disabled) { background: var(--c-danger-soft); }

.divider {
  height: 1px;
  margin: var(--sp-1) 0;
  background: var(--c-border);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2);
}

.groupLabel {
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}

.groupBody {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
}
```

- [ ] **Step 3: Barrel export**

Confirm the primitives barrel: `ls src/components/ui/index.*`. In that file add:

```ts
export { ContextMenu, ContextMenuItem, ContextMenuDivider, ContextMenuGroup, useContextMenu } from './ContextMenu'
```

- [ ] **Step 4: Gates**

Run: `npx tsc -b --noEmit && npm run build && npx eslint src/components/ui/ContextMenu.tsx`
Expected: clean. (If eslint flags `react-refresh/only-export-components` for exporting a hook + components from one file, that rule is not in this project's config — verify with the command; if it does fire, split the hook into `useContextMenu.ts`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ContextMenu.tsx src/components/ui/ContextMenu.module.css src/components/ui/index.*
git commit -m "feat(ui): reusable ContextMenu primitive (right-click + long-press)"
```

---

### Task 6: FE — wire the menu + appearance into `SubPlanCard`

**Files:**
- Modify: `src/features/decisions/SubPlanCard.tsx`
- Modify: `src/features/decisions/SubPlanCard.module.css`

**Interfaces:**
- Consumes: `useContextMenu`, `ContextMenu*` (Task 5); `useSetAppearance`, `ACCENT_COLORS`, `ACCENT_ICONS`, `AccentIcon` (Task 3); `--c-tag-*` (Task 4).
- Produces: the finished feature on 안건 cards.

- [ ] **Step 1: Imports + icon map**

At the top of `SubPlanCard.tsx`, extend the lucide import and add the curated icon map + the appearance hook. Add to the existing `lucide-react` import: `Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock, type LucideIcon`. Add:

```tsx
import { ContextMenu, ContextMenuItem, ContextMenuDivider, ContextMenuGroup, useContextMenu } from '../../components/ui'
import { useSetAppearance } from './api'
import { ACCENT_COLORS, ACCENT_ICONS, type AccentIcon } from './types'

const ICON_MAP: Record<AccentIcon, LucideIcon> = {
  Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock,
}
```

(`useAddSubPlan, useSubPlanDetail, ...` import already present — extend the existing `./api` import instead of adding a second line if the linter prefers.)

- [ ] **Step 2: Hooks + collapse state (inside the component, near the other hooks)**

```tsx
  const setAppearance = useSetAppearance()
  const menu = useContextMenu()

  // personal, per-device — lazy init (no setState-in-effect), mirrors discussion-open-{planId}
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`subplan-collapsed-${subPlan.id}`) === '1',
  )
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem(`subplan-collapsed-${subPlan.id}`, v ? '0' : '1')
      return !v
    })

  const AccentIconCmp = subPlan.icon && subPlan.icon in ICON_MAP
    ? ICON_MAP[subPlan.icon as AccentIcon]
    : null
```

- [ ] **Step 3: Section attributes (accent + collapsed) + trigger**

Change the opening `<section ...>` to carry the accent color variable, the accent/collapsed modifier classes, and the menu trigger. Merge these into the existing `<section>` (keep `id`, `onMouseEnter`, `onMouseLeave`):

```tsx
    <section
      id={`subplan-${subPlan.id}`}
      className={[
        styles.section,
        nested && styles.nested,
        subPlan.accentColor && styles.accented,
        collapsed && styles.collapsed,
        highlight !== 'normal' && styles[highlight],
      ].filter(Boolean).join(' ')}
      style={subPlan.accentColor ? ({ ['--card-accent' as string]: `var(--c-tag-${subPlan.accentColor})` }) : undefined}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      {...menu.triggerProps}
    >
```

- [ ] **Step 4: Eyebrow dot + title icon**

Replace the eyebrow line and add the icon before the title. In the `.titleGroup`:

```tsx
        <span className={styles.qno}>
          {subPlan.accentColor && <span className={styles.colorDot} aria-hidden="true" />}
          {eyebrowLabel} {index}
        </span>
        <button type="button" className={styles.titleButton} onClick={openDetail}>
          {AccentIconCmp && <AccentIconCmp size={14} aria-hidden="true" className={styles.titleIcon} />}
          {subPlan.title}
        </button>
```

- [ ] **Step 5: Collapse — render a compact row when collapsed**

Wrap the existing `metaRow`, `links`, `openBody`, and `subSection` blocks so they only render when **not** collapsed. Immediately after the `</header>`, add:

```tsx
      {!collapsed && (
        <>
```

and close the fragment right before the final closing `</section>` (after the local-edit `TitleDescModal`, which must stay OUTSIDE the fragment so editing still works — actually keep the two `TitleDescModal`s outside; place `</>` right after the `subSection` block and before the modals). Concretely: the fragment wraps `metaRow` → `links` → `openBody` → `subSection`; the `{!onEdit && <TitleDescModal .../>}` local-edit modal and the child-add modal stay after the fragment close.

When collapsed, the header alone (eyebrow · icon · title · status via a compact badge) is shown. Add the status badge into the header for the collapsed case by rendering it next to the actions:

```tsx
        {collapsed && <Badge>{STATUS_LABEL[subPlan.status]}</Badge>}
```

(Place this just before the `{!locked && (<div className={styles.actions}>...)}` inside `.head`.)

- [ ] **Step 6: The context menu**

Just before the final `</section>` (after the modals), add:

```tsx
      <ContextMenu open={menu.open} position={menu.position} onClose={menu.close}>
        <ContextMenuItem onSelect={() => { menu.close(); openDetail() }}>열기</ContextMenuItem>
        {!locked && <ContextMenuItem onSelect={() => { menu.close(); handleEdit() }}>수정</ContextMenuItem>}
        {!locked && onOpenConnect && (
          <ContextMenuItem onSelect={() => { menu.close(); onOpenConnect() }}>연결</ContextMenuItem>
        )}
        <ContextMenuDivider />
        <ContextMenuGroup label="색">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.swatch} ${subPlan.accentColor === c ? styles.swatchOn : ''}`}
              style={{ background: `var(--c-tag-${c})` }}
              aria-label={c}
              onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: c, icon: subPlan.icon })}
            />
          ))}
          <button
            type="button"
            className={`${styles.swatch} ${styles.swatchClear} ${!subPlan.accentColor ? styles.swatchOn : ''}`}
            aria-label="색 없음"
            onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: null, icon: subPlan.icon })}
          />
        </ContextMenuGroup>
        <ContextMenuGroup label="아이콘">
          {ACCENT_ICONS.map((name) => {
            const Ico = ICON_MAP[name]
            return (
              <button
                key={name}
                type="button"
                className={`${styles.iconChip} ${subPlan.icon === name ? styles.iconChipOn : ''}`}
                aria-label={name}
                onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: subPlan.accentColor, icon: name })}
              >
                <Ico size={15} />
              </button>
            )
          })}
          <button
            type="button"
            className={`${styles.iconChip} ${!subPlan.icon ? styles.iconChipOn : ''}`}
            aria-label="아이콘 없음"
            onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: subPlan.accentColor, icon: null })}
          >
            <X size={14} />
          </button>
        </ContextMenuGroup>
        <ContextMenuItem onSelect={() => { menu.close(); toggleCollapsed() }}>
          {collapsed ? '카드 펼치기' : '기본으로 접기'}
        </ContextMenuItem>
        {!locked && (
          <>
            <ContextMenuDivider />
            <ContextMenuItem danger onSelect={() => { menu.close(); handleDelete() }}>삭제</ContextMenuItem>
          </>
        )}
      </ContextMenu>
```

- [ ] **Step 7: CSS additions**

Append to `SubPlanCard.module.css`:

```css
.section { position: relative; }

/* accent bar — no layout shift (absolute), only when a color is set */
.accented::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: var(--r-md) 0 0 var(--r-md);
  background: var(--card-accent);
}

.colorDot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: var(--sp-1);
  border-radius: var(--r-pill);
  background: var(--card-accent);
  vertical-align: middle;
}

.titleIcon {
  margin-right: var(--sp-1);
  vertical-align: -2px;
  color: var(--c-text-muted);
}

.collapsed { gap: 0; }

/* menu pickers */
.swatch {
  width: 20px;
  height: 20px;
  border-radius: var(--r-pill);
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.swatchOn { border-color: var(--c-text); }
.swatchClear {
  background: var(--c-surface);
  border: 1px dashed var(--c-border-strong);
  position: relative;
}

.iconChip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  background: none;
  color: var(--c-text-muted);
  cursor: pointer;
}
.iconChip:hover { background: var(--c-surface-tint); color: var(--c-text); }
.iconChipOn { border-color: var(--c-text); color: var(--c-text); }
```

- [ ] **Step 8: Gates**

Run: `npx tsc -b --noEmit && npm run build && npx eslint src/features/decisions/SubPlanCard.tsx`
Expected: clean.

- [ ] **Step 9: Manual verification (dev)**

Run `npm run dev`. On a plan with 안건: right-click a card → menu opens; pick a color → 3px bar + eyebrow dot appear and the swatch shows selected; pick an icon → glyph appears before the title; "기본으로 접기" → card collapses to a one-line row and stays collapsed after reload (same browser only); Esc / outside-click / scroll close the menu; on a narrow window the menu stays within the viewport.

- [ ] **Step 10: Commit**

```bash
git add src/features/decisions/SubPlanCard.tsx src/features/decisions/SubPlanCard.module.css
git commit -m "feat(decisions): 안건 context menu — actions + color/icon tag + collapse"
```

---

### Task 7: Docs + deploy + verify

**Files:**
- Modify: `shared-docs/CLAUDE.md` (Flyway latest → V26; feature entry + table row)

- [ ] **Step 1: Whole-branch review (both repos)**

Before merging, run an adversarial whole-branch review over the BE branch and the FE branch (per the project's practice). Fix any Critical/Important findings.

- [ ] **Step 2: CLAUDE.md**

Update the "Flyway owns the schema (latest V25)" line → **V26**. Add a dated `2026-07-13 shipped` entry summarizing the 안건 context menu + appearance tag, and a feature-table row. Commit:

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE): 안건 context menu + appearance (Flyway V26)"
```

- [ ] **Step 3: Merge both repos**

```bash
# backend repo
git checkout main && git merge --no-ff decisions-context-menu -m "Merge branch 'decisions-context-menu' — 안건 appearance (V26)"
# frontend repo
git checkout main && git merge --no-ff decisions-context-menu -m "Merge branch 'decisions-context-menu' — 안건 context menu + appearance"
```

- [ ] **Step 4: Pre-pull base images (avoid the recurring Docker Hub 60s timeout), then push**

```bash
docker pull eclipse-temurin:17-jdk >/dev/null 2>&1 & docker pull eclipse-temurin:17-jre >/dev/null 2>&1 & wait
git push origin main   # in each repo
```

- [ ] **Step 5: Verify deploy**

- Backend (this machine is the CD runner + Docker host): after CD, `docker logs shared-docs-backend | grep -i "version 26"` shows `Migrating … to version "26"` + `now at version v26`; `curl -s localhost:8090/actuator/health` → `UP`.
- Frontend (Vercel): confirm the served bundle carries the new code (Python fetch of the deployed chunks; check for `appearance` / the menu strings) once the new deployment is live.

- [ ] **Step 6: Clean up**

```bash
git branch -d decisions-context-menu   # in each repo
```

## Self-Review

- **Spec coverage:** V26 columns (T1) ✓; endpoint + validation + not-lock-guarded + realtime (T2) ✓; any-member permission (T2 — no author/owner gate) ✓; FE types + hook (T3) ✓; `--c-tag-*` across 4 themes (T4) ✓; ContextMenu primitive with right-click + long-press + a11y + reduced-motion (T5) ✓; 안건 menu = actions + inline color swatches + icon grid + 기본으로 접기 (T6) ✓; accent bar + dot + title icon render (T6) ✓; collapse via localStorage, lazy-init no setState-in-effect (T6) ✓; docs/deploy/verify (T7) ✓. Allowlists match between BE (T2) and FE (T3) ✓.
- **Placeholders:** none — all steps carry concrete code/commands.
- **Type consistency:** `AppearanceRequest{accentColor,icon}` identical BE (T2) ↔ FE payload (T3); `SubPlanNode/SubPlanDetail.accentColor/icon` (T1/T3); `ICON_MAP` keyed by `AccentIcon` matches `ACCENT_ICONS` (T3/T6); `useSetAppearance` mutate shape `{id,accentColor,icon}` matches all call sites (T6).
