# Plan Page (PlanDetail) Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `/decisions/:planId` into a natural top-down document: a header zone for plan identity/attributes, a sticky control strip for views, demoted lifecycle actions, an emphasized decision action, a slim discussion rail, and a mobile shape.

**Architecture:** Pure frontend, `src/features/decisions/` (plus the shared `Fab`/`IconButton` primitives, already exported). No backend, no data-model, no API change. The work is JSX restructuring + CSS Modules in `PlanDetail`, `SubPlanSection`, and `DiscussionPane`.

**Tech Stack:** Vite + React 19 + TS + CSS Modules + lucide-react. Type-check **`npx tsc -b --noEmit`** (must use `-b`); lint `npx eslint src/features/decisions/`; authoritative gate `npm run build`. **No JS test runner exists** — verification per task is tsc + eslint + build, plus a manual eyeball noted at the end. Each task is one commit.

**Spec:** `docs/plans/2026-06-15-plan-page-redesign-design.md`. **Branch:** `plan-page-redesign` (already created; design committed at `a94df17`).

**Deviation from spec (noted up front):** the spec proposed a narrower centered content column for #4. The page is already `max-width: 960px` centered (`src/components/ui/Page.module.css`), and a narrower inner column would make the full-width sticky strip wider than the cards. So we keep 960 and address #4 via the discussion-rail rebalance (Task 4) + sticky strip (Task 2) instead.

**Sequencing note:** Tasks 1 and 2 both edit the top of `PlanDetail`'s return. Task 1 builds the header and *moves* the 기한 chip + lifecycle out of `planBar` (leaving `planBar` = Tabs + 논의). Task 2 then converts that reduced `planBar` into the sticky control strip. Do them in order.

---

### Task 1: Header zone — eyebrow + title + subtitle + meta + demoted lifecycle

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

- [ ] **Step 1: Add the `IconButton` import**

In `PlanDetail.tsx`, change the ui import (line 6) from:
```tsx
import { Page, PageHeader, PageTitle, BackLink, Button, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui'
```
to:
```tsx
import { Page, PageHeader, PageTitle, BackLink, Button, IconButton, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui'
```

- [ ] **Step 2: Replace the `PageHeader` block with the new header zone**

Replace these lines (currently 242–245):
```tsx
      <PageHeader>
        <BackLink to="/decisions" mobileOnly>결정</BackLink>
        <PageTitle>{tree?.title ?? '계획'}</PageTitle>
      </PageHeader>
```
with:
```tsx
      <PageHeader>
        <BackLink to="/decisions" mobileOnly>결정</BackLink>
        <div className={styles.headerRow}>
          <div className={styles.headerMain}>
            {tree?.groupLabel && <div className={styles.eyebrow}>{tree.groupLabel}</div>}
            <PageTitle>{tree?.title ?? '계획'}</PageTitle>
            {tree?.description && <p className={styles.subtitle}>{tree.description}</p>}
            {tree && (
              <div className={styles.metaRow}>
                <DeadlineChip
                  deadline={tree.deadline}
                  settledAt={completed ? tree.completedAt : null}
                  settledNoun="완료"
                  editable={!locked && !completed}
                  busy={setPlanDeadline.isPending || clearPlanDeadline.isPending}
                  onSet={(deadline) => setPlanDeadline.mutate({ id: tree.id, deadline })}
                  onClear={() => clearPlanDeadline.mutate(tree.id)}
                />
              </div>
            )}
          </div>
          {tree && (
            <div className={styles.lifecycle}>
              {locked ? (
                <IconButton variant="ghost" size="sm" label="잠금 해제" disabled={unlockPlan.isPending}
                  onClick={() => unlockPlan.mutate(tree.id)}><LockOpen size={16} /></IconButton>
              ) : (
                <IconButton variant="ghost" size="sm" label="잠금" disabled={lockPlan.isPending}
                  onClick={() => lockPlan.mutate(tree.id)}><Lock size={16} /></IconButton>
              )}
              {completed ? (
                <IconButton variant="ghost" size="sm" label="다시 진행" disabled={uncompletePlan.isPending}
                  onClick={() => uncompletePlan.mutate(tree.id)}><RotateCcw size={16} /></IconButton>
              ) : (
                <IconButton variant="ghost" size="sm" label="완료" disabled={completePlan.isPending}
                  onClick={() => completePlan.mutate(tree.id)}><CheckCircle2 size={16} /></IconButton>
              )}
            </div>
          )}
        </div>
      </PageHeader>
```

- [ ] **Step 3: Strip the moved controls out of `planBar`**

Replace the current `planBar` block (currently 253–287) with the reduced version (Tabs + 논의 only — the 기한 chip, divider, and lifecycle buttons are now in the header):
```tsx
          <div className={styles.planBar}>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
            <Button variant="ghost" size="sm" leading={<MessagesSquare size={14} />}
              onClick={toggleDiscussion}>논의</Button>
          </div>
```

- [ ] **Step 4: Remove the now-duplicated description from the list view**

In the `view === 'list'` block, delete this line (currently 313) — the description now lives in the header subtitle:
```tsx
              {tree.description && <p className={styles.planDesc}>{tree.description}</p>}
```
So the list block opens directly with the `{tree.subPlans.length === 0 ? ...` ternary.

- [ ] **Step 5: Add header CSS, remove dead rules**

In `PlanDetail.module.css`, delete the now-unused `.planBarActions`, `.actionDivider`, and `.planDesc` rules, and add:
```css
.headerRow {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}

.headerMain {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.eyebrow {
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
}

.subtitle {
  font-size: var(--fs-base);
  color: var(--c-text-muted);
  margin: 0;
}

.metaRow {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.lifecycle {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  flex: none;
}
```
> The `PageHeader` wrapper already supplies `display:flex; flex-direction:column; gap` and bottom margin; `.headerRow` sits inside it. Leave `.planBar` as-is for now (Task 2 replaces it).

- [ ] **Step 6: Type-check, lint, build, commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.
```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions-fe): plan header zone — eyebrow/subtitle/meta + demoted lifecycle"
```

---

### Task 2: Sticky control strip + condensed title on scroll

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

- [ ] **Step 1: Import the D-day helpers**

In `PlanDetail.tsx`, add after the existing `import DeadlineChip from './DeadlineChip'` line:
```tsx
import { deadlineLabel, toLocalDateString } from './deadlineLabel'
```

- [ ] **Step 2: Add the `scrolled` state, sentinel ref, and observer**

`useState`, `useEffect`, and `useRef` are already imported. Add near the other hooks (e.g. just after `const completed = tree?.status === 'COMPLETED'`):
```tsx
  const [scrolled, setScrolled] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    // setState lives in the observer CALLBACK, not the effect body — compliant
    // with the "no setState in effect" rule. rootMargin top = sticky strip offset.
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [tree?.id])

  const dday = tree?.deadline ? deadlineLabel(tree.deadline, toLocalDateString(new Date())).text : null
```

- [ ] **Step 3: Replace the reduced `planBar` with the sticky control strip**

Replace the `planBar` block from Task 1 (Tabs + 논의) with a sentinel + sticky strip carrying a condensed title:
```tsx
          <div ref={sentinelRef} aria-hidden="true" className={styles.sentinel} />
          <div className={`${styles.controlStrip}${scrolled ? ' ' + styles.stuck : ''}`}>
            <span className={styles.condensedTitle}>{tree.title}{dday ? ` · ${dday}` : ''}</span>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
            <span className={styles.controlSpacer} />
            <Button variant="ghost" size="sm" leading={<MessagesSquare size={14} />}
              onClick={toggleDiscussion}>논의</Button>
          </div>
```
> The sentinel + strip live inside `styles.main`, at the same spot the old `planBar` was. The condensed title is in the DOM always but hidden until `.stuck`.

- [ ] **Step 4: Replace `.planBar` CSS with the strip rules**

In `PlanDetail.module.css`, delete the `.planBar` rule and add:
```css
.sentinel {
  height: 1px;
}

.controlStrip {
  position: sticky;
  top: 56px; /* global TopNav height — verify visually, adjust if the nav resizes */
  z-index: 60; /* below the global nav (z-index 70) */
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
  padding: var(--sp-2) 0;
  background: var(--c-surface-translucent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.controlSpacer {
  flex: 1;
}

.condensedTitle {
  font-family: var(--font-serif);
  font-size: var(--fs-md);
  font-weight: var(--fw-semi);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 0;
  opacity: 0;
  transition: opacity var(--t-fast), max-width var(--t-fast);
}

.controlStrip.stuck .condensedTitle {
  max-width: 260px;
  opacity: 1;
  margin-right: var(--sp-2);
}
```
> Tokens `--c-surface-translucent`, `--t-fast` are the same ones `.top-nav` uses. If `--c-surface-translucent` is absent, substitute `--c-surface`.

- [ ] **Step 5: Type-check, lint, build, commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.
```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions-fe): sticky control strip with condensed title on scroll"
```

---

### Task 3: 안건 numbering + decision-action emphasis

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/SubPlanSection.tsx`
- Modify: `src/features/decisions/SubPlanSection.module.css`

- [ ] **Step 1: Pass the 1-based index from `PlanDetail`**

In `PlanDetail.tsx`, in `renderSubPlan` (signature `(sp: SubPlanNode, i: number)`), add the `index` prop to the `<SortableSubPlanSection ...>` element (alongside the existing props, e.g. right after `key={sp.id}`):
```tsx
      index={i + 1}
```

- [ ] **Step 2: Accept `index` in `SubPlanSection` and render the eyebrow**

In `SubPlanSection.tsx`, add to the `Props` type:
```tsx
  index: number
```
Add `index` to the destructured params in the function signature.

Then render a `안건 {index}` eyebrow immediately inside the `<section>`, before `<header className={styles.head}>`:
```tsx
      <div className={styles.qno}>안건 {index}</div>
      <header className={styles.head}>
```

- [ ] **Step 3: Emphasize the decision button (drop `size="sm"`)**

In `SubPlanSection.tsx`, the footer decision button (currently `<Button variant="soft" size="sm" onClick={onDecide} ...>`). Change it to default size so it out-weighs `선택지 추가`:
```tsx
          {!decision && subPlan.options.length > 0 && (
            <Button variant="soft" onClick={onDecide} disabled={busy}>
              {subPlan.options.some((o) => o.voterUserIds.length > 0) ? '결과 확정하기' : '결정하기'}
            </Button>
          )}
```
> Keep `선택지 추가` as `variant="outline" size="sm"`. Leave it `soft` (not filled `primary`) — a plan may have many undecided 안건; N filled primaries would break "one primary per screen." With lifecycle now demoted (Task 1), soft-accent already wins the hierarchy.

- [ ] **Step 4: Add the `.qno` style**

In `SubPlanSection.module.css`, add:
```css
.qno {
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
  margin-bottom: 2px;
}
```

- [ ] **Step 5: Type-check, lint, build, commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.
```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/SubPlanSection.tsx src/features/decisions/SubPlanSection.module.css
git commit -m "feat(decisions-fe): number 안건 blocks + emphasize the decision action"
```

---

### Task 4: Slim discussion rail + comments flow under the note

**Files:**
- Modify: `src/features/decisions/PlanDetail.module.css`
- Modify: `src/features/decisions/DiscussionPane.module.css`

- [ ] **Step 1: Slim the rail and let it scroll as one**

In `PlanDetail.module.css`, change the `.split` grid column and the `.pane` overflow:
```css
.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
  gap: var(--sp-4);
  align-items: start;
}
```
and in `.pane`, change `overflow: hidden;` to:
```css
  overflow-y: auto;
```
(keep `position: sticky; top: var(--sp-4); max-height: calc(100vh - 96px); display: flex; flex-direction: column;` unchanged.)

- [ ] **Step 2: Make the note + comments flow naturally**

In `DiscussionPane.module.css`, replace the `.editorWrap` and `.commentsWrap` rules:
```css
.editorWrap {
  flex: 0 0 auto;
  min-height: 160px;
}

.commentsWrap {
  border-top: 1px solid var(--c-border);
  padding-top: var(--sp-3);
  margin-top: var(--sp-3);
  flex: 0 0 auto;
}
```
> Removes `flex: 1` (which stretched the editor and pinned 댓글 to the bottom) and the per-region `overflow-y: auto`/`min-height: 120px`. The outer sticky `.pane` now scrolls as one, so the note and 댓글 sit together. The mobile bottom-sheet `.pane` is already `overflow-y: auto`, so it benefits too.

- [ ] **Step 3: Build + commit** (CSS-only — tsc/eslint still run for safety)

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.
```bash
git add src/features/decisions/PlanDetail.module.css src/features/decisions/DiscussionPane.module.css
git commit -m "feat(decisions-fe): slim discussion rail + comments flow under the note"
```

---

### Task 5: Mobile shape — FAB, sticky strip offset, full-width decision

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`
- Modify: `src/features/decisions/SubPlanSection.module.css`

- [ ] **Step 1: Import `Fab`**

In `PlanDetail.tsx`, add `Fab` to the ui import:
```tsx
import { Page, PageHeader, PageTitle, BackLink, Button, IconButton, Fab, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui'
```

- [ ] **Step 2: Render a mobile-only FAB for 안건 추가**

In `PlanDetail.tsx`, inside the `view === 'list'` block, after the `{tree.subPlans.length === 0 ? (...) : (...)}` ternary (still inside the `<>...</>`), add:
```tsx
              {!locked && !discussionOpen && tree.subPlans.length > 0 && (
                <Fab className={styles.fabAdd} label="안건 추가" onClick={() => setAddingSubPlan(true)} />
              )}
```
> Shown only when there are 안건 (the empty state keeps its own inline add button), not when locked, and hidden while the discussion bottom-sheet is open (avoids overlap). CSS hides it above the mobile breakpoint.

- [ ] **Step 3: Add the mobile CSS in `PlanDetail.module.css`**

Append:
```css
.fabAdd {
  display: none;
}

@media (max-width: 768px) {
  .fabAdd {
    display: inline-flex;
  }
  /* the inline full-width 안건 추가 button is redundant with the FAB on mobile */
  .addRow {
    display: none;
  }
  /* global TopNav is hidden < 768px, so the strip pins to the very top */
  .controlStrip {
    top: 0;
  }
}
```

- [ ] **Step 4: Full-width footer buttons on mobile in `SubPlanSection.module.css`**

Append:
```css
@media (max-width: 768px) {
  .footer {
    flex-direction: column;
    align-items: stretch;
  }
}
```
> Stacking the footer with `align-items: stretch` makes both `선택지 추가` and `결정하기` span the card width — `결정하기` becomes the full-width emphasized action on phones, no per-viewport prop toggling needed.

- [ ] **Step 5: Type-check, lint, build, commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.
```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css src/features/decisions/SubPlanSection.module.css
git commit -m "feat(decisions-fe): mobile shape — FAB add, top-pinned strip, full-width decision"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- [ ] Manual eyeball (local `npm run dev` or prod after deploy), desktop:
  - Header shows group-label eyebrow (when set), serif title, description subtitle, 기한 chip in the meta row; 잠금/완료 are quiet icons top-right.
  - Scroll a long plan → control strip pins below the global nav; condensed `title · D-day` fades in; tabs + 논의 stay reachable.
  - 안건 cards show `안건 N`; `결정하기` is clearly the dominant action; 선택지 추가 is secondary.
  - Open 논의 → slim ~360px rail; note body then 댓글 flow together (no big gap); rail scrolls as one.
- [ ] Manual eyeball, mobile (≤768px, e.g. devtools): single column; control strip pinned to top; `안건 추가` is a FAB; 결정하기 full-width; 논의 opens the bottom sheet.
- [ ] Verify the sticky `top: 56px` visually aligns with the global nav bottom; adjust the value if there's a gap/overlap.
- [ ] Final code-review over the whole `plan-page-redesign` diff.
- [ ] superpowers:finishing-a-development-branch.

## What this plan intentionally defers / excludes

- No backend/data/API change; no 캔버스 or 기록 internal changes.
- Group label stays read-only on detail (edit remains in the plan modal).
- On mobile, the `BackLink` lives in the (scroll-away) header; the persistent `BottomNav` covers navigation when scrolled. A back affordance inside the sticky strip is a possible later polish, not in scope.
- No new design tokens; reuse existing. The one magic number is the sticky `top: 56px` (global nav height), documented inline.
