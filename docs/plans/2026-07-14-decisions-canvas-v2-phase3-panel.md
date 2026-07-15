# Decisions Canvas v2 — Phase 3 (Slide-in Detail Panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking an 안건 or 선택지 node on the canvas slides a detail panel in from the right — full detail (장점/단점, 자료, 댓글, description, vote for options; description, status, deadline, 서브안건, 댓글 for 안건) — while the graph stays visible. Reuses the existing detail components; adds a reusable right-slide `Panel` and the missing `useFocusTrap` (discharging the a11y carry-forward, and retrofitting `ImageLightbox`).

**Architecture:** `PlanDetail` owns panel state (its `tree` is kept live by react-query; the canvas seeds once and goes stale). `PlanCanvas` lifts an `onNodeSelect({kind,id})` callback up via React Flow's `onNodeClick`. `PlanDetail` resolves the clicked entity from its live `tree` (options) or via `useSubPlanDetail` (안건) and renders the panel content. Option content reuses the standalone `OptionResourceSection`/`ProConSection`/`Comments` + a vote control; 안건 content is a lean view with a link out to the full detail page.

**Tech Stack:** React 19, TypeScript (strict), `@xyflow/react ^12`, CSS Modules, `createPortal`.

**Design spec:** `docs/plans/2026-07-14-decisions-canvas-v2-design.md`. This is **Phase 3 of 4**; Phase 4 (decision glow/dim + canvas-as-default) follows.

## Global Constraints

- **Verification gate is `npm run build`** (tsc strict + Vite). ESLint pre-existing-red — lint only touched files. Behavioral gate = the manual smoke checklist at the end.
- **PlanDetail owns panel state.** Do NOT put panel state inside `PlanCanvas` (its node data is stale after mutations — it seeds once at mount by design). `PlanCanvas` only emits `onNodeSelect`.
- **Node ids are namespaced** `sp:{id}`/`opt:{id}`; use the existing `parseNodeId` in `PlanCanvas.tsx`.
- **Reuse, don't rebuild** detail content: `OptionResourceSection` (`{optionId, resources}`), `ProConSection` (`{optionId, proCons, locked}`), `Comments` (`{pageId}`), `useCastVote`/`useRetractVote` (take `optionId`), `useSubPlanDetail(id)`. Vote button markup mirrors `OptionRow`'s (vote pill, `disabled` when `locked || decided`).
- **Bear-minimal** (hairlines, no lift, `--c-*`/`--sp-*`/`--r-*` tokens, Lucide, Korean copy). The panel reuses the Modal overlay z-band (backdrop 300 / dialog 310), `--c-overlay`, `--shadow-lg`.
- **a11y:** the panel traps focus while open and restores focus on close (new `useFocusTrap`); Esc + backdrop-click close; `role="dialog" aria-modal="true"`.

---

### Task 1: `useFocusTrap` hook + right-slide `Panel` primitive (+ retrofit ImageLightbox)

**Files:**
- Create: `src/components/ui/useFocusTrap.ts`
- Create: `src/components/ui/Panel.tsx`
- Create: `src/components/ui/Panel.module.css`
- Modify: `src/components/ui/index.ts` (barrel exports)
- Modify: `src/components/ui/ImageLightbox.tsx` (adopt `useFocusTrap` — discharges the owed a11y follow-up)

**Interfaces:**
- Produces: `useFocusTrap(ref, active)`; `Panel` (named export) with props `{ open, onClose, title, children }`.

- [ ] **Step 1: Write `useFocusTrap`**

`src/components/ui/useFocusTrap.ts`:
```ts
import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * While `active`, keep Tab focus inside `ref`, and restore focus to whatever
 * was focused before, on deactivate. Moves focus into the container on activate.
 * The container should have tabIndex={-1} as a focus fallback.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)

    ;(focusables()[0] ?? node).focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [ref, active])
}
```

- [ ] **Step 2: Write the `Panel` component**

`src/components/ui/Panel.tsx`:
```tsx
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from './useFocusTrap'
import styles from './Panel.module.css'

type Props = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
}

/** Right-slide overlay panel. Portals to body; Esc + backdrop close; locks
 *  body scroll; traps + restores focus while open. */
export function Panel({ open, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 3: Write `Panel.module.css`**

```css
.backdrop {
  position: fixed; inset: 0;
  background: var(--c-overlay);
  z-index: 300;
  animation: fadeIn 0.15s ease;
}
.panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: min(480px, 92vw);
  background: var(--c-surface);
  color: var(--c-text);
  box-shadow: var(--shadow-lg);
  z-index: 310;
  display: flex; flex-direction: column;
  animation: slideInRight 0.2s ease;
  outline: none;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--c-border);
  flex: none;
}
.title {
  font-size: var(--fs-base); font-weight: var(--fw-semi);
  margin: 0; color: var(--c-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.close {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border: none; background: transparent;
  color: var(--c-text-muted); border-radius: var(--r-md); cursor: pointer;
}
.close:hover { background: var(--c-surface-tint); color: var(--c-text); }
.body { flex: 1; overflow-y: auto; padding: var(--sp-4); }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
@media (max-width: 767px) { .panel { width: 100vw; } }
```

- [ ] **Step 4: Export from the barrel**

In `src/components/ui/index.ts`, add:
```ts
export { Panel } from './Panel'
export { useFocusTrap } from './useFocusTrap'
```

- [ ] **Step 5: Retrofit `ImageLightbox` with the focus trap (discharge the a11y follow-up)**

Read `src/components/ui/ImageLightbox.tsx`. It already portals + handles Esc/backdrop. Make three additions, matching its existing structure:
1. `import { useFocusTrap } from './useFocusTrap'`
2. Add a ref to the overlay/dialog root element: `const ref = useRef<HTMLDivElement>(null)` (add `useRef` to the react import) and put `ref={ref}` + `tabIndex={-1}` on that root element.
3. Call `useFocusTrap(ref, true)` in the component body (the lightbox is mounted only while open, so `active` is always `true` here).
Do not change its close/Esc/portal behavior.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: succeeds. (Panel/useFocusTrap are new; ImageLightbox still compiles + now traps focus.)

- [ ] **Step 7: Commit**
```bash
git add src/components/ui/useFocusTrap.ts src/components/ui/Panel.tsx src/components/ui/Panel.module.css src/components/ui/index.ts src/components/ui/ImageLightbox.tsx
git commit -m "feat(ui): right-slide Panel + useFocusTrap; retrofit ImageLightbox focus-trap"
```

---

### Task 2: OptionPanel (선택지 detail content)

**Files:**
- Create: `src/features/decisions/OptionPanel.tsx`
- Create: `src/features/decisions/OptionPanel.module.css`

**Interfaces:**
- Consumes: `OptionNode`, `OptionResourceSection`, `ProConSection`, `Comments`, `useCastVote`/`useRetractVote`, `useAuth`/`useMembers`/`useActiveWorkspace`.
- Produces: `OptionPanel` (default export), props `{ option: OptionNode; isChosen: boolean; decided: boolean; locked: boolean }`.

- [ ] **Step 1: Write the component**

`src/features/decisions/OptionPanel.tsx`:
```tsx
import { Check, Vote } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { useCastVote, useRetractVote } from './api'
import OptionResourceSection from './OptionResourceSection'
import ProConSection from './ProConSection'
import Comments from '../../components/Comments'
import styles from './OptionPanel.module.css'
import type { OptionNode } from './types'

type Props = { option: OptionNode; isChosen: boolean; decided: boolean; locked: boolean }

export default function OptionPanel({ option, isChosen, decided, locked }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const iVoted = option.voterUserIds.includes(myUserId)
  const frozen = locked || decided
  const busy = castVote.isPending || retractVote.isPending

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          {isChosen && <Check size={16} className={styles.chosen} aria-label="결정됨" />}
          <h3 className={styles.title}>{option.title}</h3>
        </div>
        <button
          type="button"
          className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
          disabled={busy || frozen}
          aria-pressed={iVoted}
          title={iVoted ? '투표 취소' : '투표'}
          onClick={() => (iVoted ? retractVote.mutate(option.id) : castVote.mutate(option.id))}
        >
          <Vote size={14} />
          <span>{option.voterUserIds.length > 0 ? `${option.voterUserIds.length}표` : '투표'}</span>
        </button>
      </div>

      {option.description && <p className={styles.desc}>{option.description}</p>}

      <OptionResourceSection optionId={option.id} resources={option.resources} />
      <ProConSection optionId={option.id} proCons={option.proCons} locked={locked} />

      {option.voterUserIds.length > 0 && (
        <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
      )}

      <div className={styles.comments}>
        <Comments pageId={`option:${option.id}`} />
      </div>
    </div>
  )
}
```

> **Implementer note:** confirm the import paths `../../auth/useAuth`, `../../auth/useActiveWorkspace`, `../workspaces/membersApi`, `../../components/Comments`, and the default exports of `OptionResourceSection`/`ProConSection` against `SubPlanDetail.tsx`'s imports (they match there). Confirm `ProConSection`'s prop name is `proCons` and `OptionResourceSection`'s is `resources` (both take `optionId`).

- [ ] **Step 2: Write `OptionPanel.module.css`**

```css
.wrap { display: flex; flex-direction: column; gap: var(--sp-4); }
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
.titleRow { display: flex; align-items: center; gap: var(--sp-1); min-width: 0; }
.chosen { color: var(--c-primary); flex: none; }
.title { margin: 0; font-size: var(--fs-base); font-weight: var(--fw-semi); color: var(--c-text); }
.vote {
  flex: none; display: inline-flex; align-items: center; gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2); border: 1px solid var(--c-border);
  border-radius: var(--r-pill); background: var(--c-surface); color: var(--c-text-muted);
  font-size: var(--fs-xs); cursor: pointer;
}
.vote:disabled { opacity: 0.5; cursor: default; }
.voteOn { border-color: var(--c-primary); color: var(--c-primary); background: var(--c-primary-soft); }
.desc { margin: 0; font-size: var(--fs-sm); color: var(--c-text-muted); white-space: pre-wrap; }
.voters { margin: 0; font-size: var(--fs-xs); color: var(--c-text-muted); }
.comments { border-top: 1px solid var(--c-border); padding-top: var(--sp-3); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (not yet referenced — wiring is Task 4).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/OptionPanel.tsx src/features/decisions/OptionPanel.module.css
git commit -m "feat(decisions-canvas): OptionPanel — 선택지 detail (vote/장단점/자료/댓글)"
```

---

### Task 3: SubPlanPanel (안건 detail content)

**Files:**
- Create: `src/features/decisions/SubPlanPanel.tsx`
- Create: `src/features/decisions/SubPlanPanel.module.css`

**Interfaces:**
- Consumes: `useSubPlanDetail`, `Badge`/`Skeleton` (ui), `Comments`, `react-router-dom` `Link`.
- Produces: `SubPlanPanel` (default export), props `{ subPlanId: number; planId: number; locked: boolean; onOpenSubPlan: (id: number) => void }`.

- [ ] **Step 1: Write the component**

`src/features/decisions/SubPlanPanel.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge, Skeleton } from '../../components/ui'
import { useSubPlanDetail } from './api'
import Comments from '../../components/Comments'
import styles from './SubPlanPanel.module.css'
import type { SubPlanStatus } from './types'

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

type Props = {
  subPlanId: number
  planId: number
  locked: boolean
  onOpenSubPlan: (id: number) => void
}

export default function SubPlanPanel({ subPlanId, planId, onOpenSubPlan }: Props) {
  const { data: detail, isLoading, isError } = useSubPlanDetail(subPlanId)

  if (isLoading) return <Skeleton height={140} radius="var(--r-md)" />
  if (isError || !detail) return <p className={styles.empty}>안건을 불러오지 못했어요.</p>

  return (
    <div className={styles.wrap}>
      <div className={styles.metaRow}>
        <Badge>{STATUS_LABEL[detail.status]}</Badge>
        {detail.deadline && <span className={styles.deadline}>기한 {detail.deadline}</span>}
      </div>

      {detail.description && <p className={styles.desc}>{detail.description}</p>}

      <section className={styles.section}>
        <h4 className={styles.heading}>서브안건</h4>
        {detail.children.length === 0 ? (
          <p className={styles.empty}>서브안건이 없어요.</p>
        ) : (
          <ul className={styles.childList}>
            {detail.children.map((child) => (
              <li key={child.id}>
                <button type="button" className={styles.childRow} onClick={() => onOpenSubPlan(child.id)}>
                  <span className={styles.childTitle}>{child.title}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to={`/decisions/${planId}/subplans/${subPlanId}`} className={styles.fullLink}>
        안건 전체 페이지 열기 →
      </Link>

      <div className={styles.comments}>
        <Comments pageId={`subplan:${subPlanId}`} />
      </div>
    </div>
  )
}
```

> **Implementer note:** the 선택지 are intentionally NOT listed here — for a top-level 안건 they're already visible as nodes on the canvas, and deeper editing (decide, add option) lives on the full page reachable via the "전체 페이지 열기" link. Confirm `SubPlanDetail` type has `children: SubPlanNode[]`, `description`, `deadline`, `status` (it does — types.ts).

- [ ] **Step 2: Write `SubPlanPanel.module.css`**

```css
.wrap { display: flex; flex-direction: column; gap: var(--sp-4); }
.metaRow { display: flex; align-items: center; gap: var(--sp-2); }
.deadline { font-size: var(--fs-xs); color: var(--c-text-subtle); }
.desc { margin: 0; font-size: var(--fs-sm); color: var(--c-text-muted); white-space: pre-wrap; }
.section { display: flex; flex-direction: column; gap: var(--sp-2); }
.heading { margin: 0; font-size: var(--fs-sm); font-weight: var(--fw-semi); color: var(--c-text); }
.empty { margin: 0; font-size: var(--fs-sm); color: var(--c-text-muted); }
.childList { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.childRow {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-md);
  background: var(--c-surface); color: var(--c-text); cursor: pointer; text-align: left;
}
.childRow:hover { border-color: var(--c-border-strong); }
.childTitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fullLink { font-size: var(--fs-sm); color: var(--c-primary); text-decoration: none; }
.fullLink:hover { text-decoration: underline; }
.comments { border-top: 1px solid var(--c-border); padding-top: var(--sp-3); }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: succeeds (not yet referenced — wiring is Task 4).

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/SubPlanPanel.tsx src/features/decisions/SubPlanPanel.module.css
git commit -m "feat(decisions-canvas): SubPlanPanel — 안건 detail (status/deadline/서브안건/댓글)"
```

---

### Task 4: Wire node-click → panel (PlanCanvas + PlanDetail)

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx` (add `onNodeSelect` prop + `onNodeClick`)
- Modify: `src/features/decisions/PlanDetail.tsx` (panel state + resolve entity + render Panel)

**Interfaces:**
- Consumes: `Panel` (ui), `OptionPanel`, `SubPlanPanel` (Tasks 1–3); `parseNodeId` (PlanCanvas).

- [ ] **Step 1: Emit `onNodeSelect` from PlanCanvas**

In `PlanCanvas.tsx`, extend `Props`:
```ts
type Props = { tree: PlanTree; locked: boolean; onNodeSelect?: (sel: { kind: 'sp' | 'opt'; id: number }) => void }
```
Thread `onNodeSelect` through `PlanCanvas` → `Flow` (both take `Props`). In the `Flow` component, add an `onNodeClick` handler passed to `<ReactFlow>`:
```tsx
      onNodeClick={(_, n) => onNodeSelect?.(parseNodeId(n.id))}
```
(Place it next to the other `<ReactFlow>` handlers. `parseNodeId` already exists and returns `{ kind, id }`. Node-click fires on plain click; it does not interfere with drag, which fires `onNodeDragStop`.)

- [ ] **Step 2: Add panel state + entity resolution in PlanDetail**

In `PlanDetail.tsx`:
1. Add `useMemo` to the react import (it currently imports `useState`/`useEffect`/`useRef`).
2. Import the pieces:
```tsx
import { Panel } from '../../components/ui'
import OptionPanel from './OptionPanel'
import SubPlanPanel from './SubPlanPanel'
```
   (Add `Panel` to the existing `../../components/ui` import if one exists, or a new import line.)
3. Near the other modal state (~line 77), add:
```tsx
  const [selectedNode, setSelectedNode] = useState<{ kind: 'sp' | 'opt'; id: number } | null>(null)
```
4. After `locked`/`completed` are derived (~line 90), add the option resolver:
```tsx
  const selectedOption = useMemo(() => {
    if (selectedNode?.kind !== 'opt' || !tree) return null
    for (const sp of tree.subPlans) {
      const o = sp.options.find((op) => op.id === selectedNode.id)
      if (o) return { option: o, subPlan: sp }
    }
    return null
  }, [selectedNode, tree])
```

- [ ] **Step 3: Pass the callback to PlanCanvas + render the Panel**

Update the canvas mount (line 309):
```tsx
          {view === 'canvas' && <PlanCanvas tree={tree} locked={locked} onNodeSelect={setSelectedNode} />}
```
Add the panel render just before the closing `</Page>` (after the `ConnectModal`, ~line 385):
```tsx
      {selectedNode?.kind === 'opt' && selectedOption && (
        <Panel open onClose={() => setSelectedNode(null)} title={selectedOption.option.title}>
          <OptionPanel
            option={selectedOption.option}
            isChosen={selectedOption.subPlan.decision?.chosenOptionId === selectedOption.option.id}
            decided={selectedOption.subPlan.decision != null}
            locked={locked}
          />
        </Panel>
      )}
      {selectedNode?.kind === 'sp' && (
        <Panel open onClose={() => setSelectedNode(null)} title="안건">
          <SubPlanPanel
            subPlanId={selectedNode.id}
            planId={planId}
            locked={locked}
            onOpenSubPlan={(id) => setSelectedNode({ kind: 'sp', id })}
          />
        </Panel>
      )}
```

> **Note on live data:** `selectedOption` is re-resolved from the live `tree` on every render, so when a vote / 장단점 / 자료 mutation invalidates the decisions scope and the tree refetches, the open OptionPanel receives the fresh `option` automatically. The panel holds only the `{kind,id}`, never a stale snapshot.

- [ ] **Step 4: Verify build + lint touched files**

Run: `npm run build` (MUST succeed).
Then: `npx eslint src/features/decisions/PlanCanvas.tsx src/features/decisions/PlanDetail.tsx src/features/decisions/OptionPanel.tsx src/features/decisions/SubPlanPanel.tsx src/components/ui/Panel.tsx src/components/ui/useFocusTrap.ts` — fix NEW errors in these only.

- [ ] **Step 5: Commit**
```bash
git add src/features/decisions/PlanCanvas.tsx src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions-canvas): node click opens slide-in detail panel"
```

---

## Manual Smoke Checklist (behavioral gate — owed to the user)

On the running app, 캔버스 tab, a plan with ≥1 안건 that has options + at least one nested 서브안건:

1. **Option panel:** click a 선택지 node → panel slides in from the right showing its title, description, 자료 (add a link/file works), 장점/단점 (add works), voters, and 댓글. The graph stays visible behind it.
2. **Vote from panel:** the vote pill toggles; count updates; on a decided 안건 the pill is disabled; the chosen option shows ✓.
3. **안건 panel:** click a 안건 node → panel shows status badge, deadline (if set), description, a 서브안건 list, a "전체 페이지 열기" link, and 댓글. Clicking a 서브안건 row swaps the panel to that nested 안건.
4. **Close:** Esc, backdrop click, and the ✕ all close the panel.
5. **Focus trap:** with the panel open, Tab cycles only within the panel; on close, focus returns to roughly where it was.
6. **Live refresh:** add a 장점 or vote in the panel → the count/section updates without reopening (tree refetch flows through).
7. **Lightbox a11y (retrofit):** open an image in the 자료 lightbox → Tab stays trapped; Esc closes and returns focus.
8. **Lock:** on a locked plan, the panel still opens (read + comment), but vote is disabled and section add-controls are gated as before.

## Not in Phase 3 (Phase 4)
- Decision glow/dim of chosen/unchosen branches on the canvas.
- Making the canvas the default view.
- Editing an option's title/description or deciding from the panel (still done on the full detail page / 목록).
