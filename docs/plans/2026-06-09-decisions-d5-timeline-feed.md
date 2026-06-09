# Decisions D5 — Timeline + Activity Feed (the audit-trail UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the append-only PlanEvent log that already exists — a per-계획 **기록 (timeline)** tab on PlanDetail ("왜 우리가 마포로 정했더라?") and a workspace-wide **활동 (feed)** tab on the `/decisions` board. Plus a small polish: make the React Flow canvas `colorMode` follow the app theme.

**Architecture:** Frontend-only. The backend is done (from D1b): `GET /api/plans/{id}/timeline` (events newest-first) and `GET /api/decision-feed?limit=N` (workspace-wide, capped). Both return `PlanEventResponse[]`. We add: event types + two query hooks, a pure Korean event-formatter, one reusable `Timeline` component (used by both surfaces), the two tab wirings, and the theme fix.

**Tech Stack:** Vite + React 19 + TS + CSS Modules + React Query + lucide-react. No backend change, no migration, no new libraries.

---

## Design decisions locked (D5 discussion, 2026-06-09)

1. **Per-계획 timeline** = a 3rd tab **기록** on PlanDetail, beside 목록 / 캔버스. Read-only.
2. **Workspace feed** = a **활동** tab on the `/decisions` board (a 보드 / 활동 toggle under the header). Same event renderer as the timeline; feed rows show which 계획 the event belongs to and tap through to that plan.
3. **One renderer** — a single `Timeline` component serves both (feed mode just adds a plan label + click-through).
4. **Korean relative time** via the existing `src/features/notes/shared/formatRelativeTime.ts` (방금 / 5분 전 / 어제 / 3일 전 / YYYY-MM-DD).
5. **Theme polish** — `PlanCanvas` currently hardcodes `colorMode="dark"`; make it follow `useSettings().theme` (only `light` is a light theme; `dark`/`dracula`/`monokai` are dark).

## Event reference (verified payloads — drives the formatter)

Events come newest-first. `PlanEventResponse = { id, planId, subPlanId, type, actorUserId, payload, createdAt }`.

| `type` | payload keys | Korean line (actor = resolved name) |
|---|---|---|
| `PLAN_CREATED` | `title` | `{actor}님이 계획을 만들었어요` |
| `SUBPLAN_ADDED` | `subPlanTitle` | `{actor}님이 '{subPlanTitle}' 안건을 추가했어요` |
| `OPTION_ADDED` | `subPlanTitle, optionTitle` | `{actor}님이 '{subPlanTitle}' 안건에 '{optionTitle}' 선택지를 추가했어요` |
| `DECISION_LOCKED` | `optionTitle, reason` | `{actor}님이 '{optionTitle}' 선택지로 결정했어요` |
| `DECISION_CHANGED` | `optionTitle, reason` | `{actor}님이 '{optionTitle}' 선택지로 결정을 바꿨어요` |
| `DECISION_REOPENED` | `subPlanTitle` | `{actor}님이 '{subPlanTitle}' 안건의 결정을 다시 열었어요` |

> Particle note: the sentences deliberately attach the Korean particle to a fixed trailing noun (안건/선택지) rather than to the variable title, so 을/를/로/의 are always grammatically correct regardless of the title's final character. `reason` is recorded but not shown in the line (kept terse; it's already visible on the 결정 banner in 목록).

---

# Frontend (`shared-docs`) — all tasks on a new `decisions-d5` branch

> Reminders: the repo's real type-check is **`npx tsc -b --noEmit`** (plain `npx tsc --noEmit` checks zero files — root tsconfig is a references stub). `npm run build` is the authoritative gate. The ~24 pre-existing eslint errors in calc/notes/sheets are out of scope — only `src/features/decisions/` must be clean. Frontend `main` is at `58184b5`.

### Task 1: Event types + query hooks + formatter

**Files:**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`
- Create: `src/features/decisions/formatPlanEvent.tsx`

- [ ] **Step 1: Add the event types**

Append to `types.ts`:

```ts
export type PlanEventType =
  | 'PLAN_CREATED' | 'SUBPLAN_ADDED' | 'OPTION_ADDED'
  | 'DECISION_LOCKED' | 'DECISION_CHANGED' | 'DECISION_REOPENED'

export type PlanEvent = {
  id: number
  planId: number
  subPlanId: number | null
  type: PlanEventType
  actorUserId: number
  payload: Record<string, string | null> | null
  createdAt: string
}
```

- [ ] **Step 2: Add the query hooks + keys**

In `api.ts`, add two keys to `decisionKeys` (they nest under `scope`, so existing mutations that invalidate `decisionKeys.scope(activeId)` already refresh the timeline + feed — no mutation change needed):

```ts
export const decisionKeys = {
  scope: (wsId: number | null) => ['decisions', wsId] as const,
  list: (wsId: number | null) => ['decisions', wsId, 'list'] as const,
  tree: (wsId: number | null, planId: number) => ['decisions', wsId, 'tree', planId] as const,
  timeline: (wsId: number | null, planId: number) => ['decisions', wsId, 'timeline', planId] as const,
  feed: (wsId: number | null) => ['decisions', wsId, 'feed'] as const,
}
```

Extend the `types` import to include `PlanEvent`, and add the hooks (near `usePlanTree`):

```ts
export function useTimeline(planId: number, enabled = true) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.timeline(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanEvent[]>(`/api/plans/${planId}/timeline`)).data,
    enabled: enabled && activeId != null && Number.isFinite(planId),
  })
}

export function useFeed(enabled = true, limit = 50) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.feed(activeId),
    queryFn: async () => (await apiClient.get<PlanEvent[]>(`/api/decision-feed?limit=${limit}`)).data,
    enabled: enabled && activeId != null,
  })
}
```

- [ ] **Step 3: Write the formatter** `formatPlanEvent.tsx` (`.tsx` because it references Lucide icon components)

```tsx
import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, type LucideIcon } from 'lucide-react'
import type { PlanEvent, PlanEventType } from './types'

const ICONS: Record<PlanEventType, LucideIcon> = {
  PLAN_CREATED: Flag,
  SUBPLAN_ADDED: ListPlus,
  OPTION_ADDED: CirclePlus,
  DECISION_LOCKED: CheckCircle2,
  DECISION_CHANGED: RefreshCw,
  DECISION_REOPENED: RotateCcw,
}

export function planEventIcon(type: PlanEventType): LucideIcon {
  return ICONS[type]
}

/** Korean sentence for one event. `actor` is the already-resolved display name.
 *  Particles attach to fixed nouns (안건/선택지), so they stay grammatical for any title. */
export function planEventText(e: PlanEvent, actor: string): string {
  const p = e.payload ?? {}
  const q = (v: string | null | undefined) => `'${v ?? ''}'`
  switch (e.type) {
    case 'PLAN_CREATED': return `${actor}님이 계획을 만들었어요`
    case 'SUBPLAN_ADDED': return `${actor}님이 ${q(p.subPlanTitle)} 안건을 추가했어요`
    case 'OPTION_ADDED': return `${actor}님이 ${q(p.subPlanTitle)} 안건에 ${q(p.optionTitle)} 선택지를 추가했어요`
    case 'DECISION_LOCKED': return `${actor}님이 ${q(p.optionTitle)} 선택지로 결정했어요`
    case 'DECISION_CHANGED': return `${actor}님이 ${q(p.optionTitle)} 선택지로 결정을 바꿨어요`
    case 'DECISION_REOPENED': return `${actor}님이 ${q(p.subPlanTitle)} 안건의 결정을 다시 열었어요`
    default: return `${actor}님이 활동했어요`
  }
}
```

- [ ] **Step 4: Type-check + commit**

Run: `npx tsc -b --noEmit` → PASS (hooks/formatter compile; not yet consumed).

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts src/features/decisions/formatPlanEvent.tsx
git commit -m "feat(decisions-fe): PlanEvent types, timeline/feed hooks, event formatter (D5)"
```

---

### Task 2: `Timeline` component

**Files:**
- Create: `src/features/decisions/Timeline.tsx`
- Create: `src/features/decisions/Timeline.module.css`

A single read-only vertical timeline used by both surfaces. Feed mode passes `planNameOf` (show which 계획) + `onEventClick` (tap through to the plan).

- [ ] **Step 1: Write `Timeline.tsx`**

```tsx
import { EmptyState } from '../../components/ui'
import { formatRelativeTime } from '../notes/shared/formatRelativeTime'
import { planEventIcon, planEventText } from './formatPlanEvent'
import styles from './Timeline.module.css'
import type { PlanEvent } from './types'

type Props = {
  events: PlanEvent[]
  nameOf: (uid: number) => string
  planNameOf?: (planId: number) => string   // feed mode: label which 계획
  onEventClick?: (e: PlanEvent) => void      // feed mode: tap → that plan
}

export default function Timeline({ events, nameOf, planNameOf, onEventClick }: Props) {
  if (events.length === 0) {
    return <EmptyState title="아직 기록이 없어요" description="계획에 변화가 생기면 여기에 쌓여요." />
  }
  return (
    <ol className={styles.timeline}>
      {events.map((e) => {
        const Icon = planEventIcon(e.type)
        const inner = (
          <>
            <span className={styles.icon}><Icon size={15} strokeWidth={2} /></span>
            <span className={styles.body}>
              <span className={styles.text}>{planEventText(e, nameOf(e.actorUserId))}</span>
              <span className={styles.meta}>
                {planNameOf && <span className={styles.plan}>{planNameOf(e.planId)}</span>}
                <time className={styles.time} dateTime={e.createdAt}>{formatRelativeTime(e.createdAt)}</time>
              </span>
            </span>
          </>
        )
        return (
          <li key={e.id} className={styles.item}>
            {onEventClick
              ? <button type="button" className={styles.row} onClick={() => onEventClick(e)}>{inner}</button>
              : <div className={styles.row}>{inner}</div>}
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 2: Write `Timeline.module.css`** (tokens only — verify each token exists in `src/components/ui/tokens.css`; substitute the nearest existing one if not. The decisions feature already uses `--c-text`, `--c-text-subtle`, `--c-border`, `--c-surface`, `--c-accent`, `--r-md`, `--fs-sm`, `--fs-xs`, `--sp-*`.)

```css
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.item {
  position: relative;
  padding-left: 28px;
}

/* The vertical rail behind the icons. */
.item::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--c-border);
}
.item:first-child::before { top: 12px; }
.item:last-child::before { bottom: calc(100% - 12px); }

.row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-2) 0;
  background: none;
  border: 0;
  text-align: left;
  font: inherit;
  color: inherit;
}
button.row { cursor: pointer; }
button.row:hover .text { color: var(--c-accent); }

/* Icon sits centered on the rail. */
.icon {
  position: absolute;
  left: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-text-subtle);
}

.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.text { font-size: var(--fs-sm); color: var(--c-text); line-height: 1.45; }
.meta { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-xs); color: var(--c-text-subtle); }
.plan { padding: 1px 6px; border: 1px solid var(--c-border); border-radius: var(--r-pill); }
.time { white-space: nowrap; }
```

- [ ] **Step 3: Type-check + commit**

Run: `npx tsc -b --noEmit` → PASS.

```bash
git add src/features/decisions/Timeline.tsx src/features/decisions/Timeline.module.css
git commit -m "feat(decisions-fe): reusable Timeline component (D5)"
```

---

### Task 3: Wire the 기록 tab (PlanDetail) and the 활동 tab (DecisionList)

**Files:**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/DecisionList.tsx`

#### 3A — PlanDetail 기록 tab

PlanDetail already has a `view: 'list' | 'canvas'` Tabs toggle and a `nameOf(uid)` resolver. Add a third tab.

- [ ] **Step 1: Widen the view union + add the tab + fetch + render**

In `PlanDetail.tsx`:

(a) Add the timeline hook import to the existing `./api` import: add `useTimeline` to the import list.
(b) Add `Timeline` import: `import Timeline from './Timeline'`.
(c) Change the view state type to include `'timeline'`:

```tsx
  const [view, setView] = useState<'list' | 'canvas' | 'timeline'>('list')
```

(d) Fetch the timeline only when its tab is active (newest-first from the API):

```tsx
  const { data: timeline, isLoading: timelineLoading } = useTimeline(planId, view === 'timeline')
```

(e) Add the 기록 tab to the Tabs `items`:

```tsx
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
```

(f) Replace the `view === 'canvas' ? <PlanCanvas/> : ( …목록… )` block with three explicit branches (clearer than a nested ternary across three states). The 목록 branch body is UNCHANGED — only its wrapper condition changes:

```tsx
          {view === 'canvas' && <PlanCanvas tree={tree} />}

          {view === 'timeline' && (
            timelineLoading
              ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
              : <Timeline events={timeline ?? []} nameOf={nameOf} />
          )}

          {view === 'list' && (
            <>
              {/* …existing 목록 content: description, empty-state / SubPlanSection list + 안건 추가 button… */}
            </>
          )}
```

> Keep the existing 목록 JSX exactly as it is today — just move it under the `view === 'list' &&` guard instead of the `: ( … )` else-branch. Do not change SubPlanSection, the modals, or the mutations.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/` → both clean.

#### 3B — DecisionList 활동 tab

DecisionList is the `/decisions` board. Add a 보드 / 활동 toggle under the header; 활동 renders the workspace feed. The feed needs name + plan-name resolution, so add `useAuth` + `useMembers` (mirroring PlanDetail) and reuse the already-loaded `plans` for plan titles.

- [ ] **Step 3: Add the tab + feed rendering**

In `DecisionList.tsx`:

(a) Add imports:

```tsx
import { Tabs } from '../../components/ui'          // add Tabs to the existing ui import
import { useNavigate } from 'react-router-dom'      // already imported
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { useFeed } from './api'                      // add useFeed to the existing ./api import
import Timeline from './Timeline'
```

(b) Add state + resolvers inside the component:

```tsx
  const [tab, setTab] = useState<'board' | 'feed'>('board')
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) => uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'
  const planNameOf = (id: number) => (plans ?? []).find((p) => p.id === id)?.title ?? '계획'
  const { data: feed, isLoading: feedLoading } = useFeed(tab === 'feed')
```

(c) Render the Tabs right under `<PageHeader>` (only meaningful once data loads, but always shown so the toggle is discoverable):

```tsx
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      <Tabs
        className={styles.tabs}
        items={[{ key: 'board', label: '보드' }, { key: 'feed', label: '활동' }]}
        value={tab}
        onChange={setTab}
      />
```

(d) Gate the existing board content (loading/error/empty/board/flat-list) behind `tab === 'board'`, and add the feed branch:

```tsx
      {tab === 'feed' ? (
        feedLoading
          ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
          : <Timeline events={feed ?? []} nameOf={nameOf} planNameOf={planNameOf}
                      onEventClick={(e) => navigate(`/decisions/${e.planId}`)} />
      ) : (
        <>
          {/* …existing board content: isLoading / isError / empty / (hasNamedGroup ? board : flat list)… */}
        </>
      )}
```

> The `Fab` ("계획 추가") and both `PlanModal`s stay mounted regardless of tab (a user can add a plan from either view). Leave them after the conditional, as today.

- [ ] **Step 4: Add a tiny spacing rule for the tabs** in `DecisionList.module.css`:

```css
.tabs { margin-bottom: var(--sp-4); }
```

(Verify `--sp-4` exists; otherwise match the spacing used between the header and content elsewhere in this file.)

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.

- [ ] **Step 6: Commit**

```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/DecisionList.tsx src/features/decisions/DecisionList.module.css
git commit -m "feat(decisions-fe): 기록 timeline tab + 활동 feed tab (D5)"
```

---

### Task 4: Polish — React Flow `colorMode` follows the app theme

**Files:**
- Modify: `src/features/decisions/PlanCanvas.tsx`

The D2/D3 canvas hardcodes `colorMode="dark"`, so on the `light` theme the controls/handles render dark. Make it follow the active theme.

- [ ] **Step 1: Read the theme in `Flow` and pass it through**

In `PlanCanvas.tsx`:

(a) Add the import: `import { useSettings } from '../settings/settingsContext'`.
(b) Inside the `Flow` component, derive the color mode (only `light` is a light theme; `dark`/`dracula`/`monokai` are dark):

```tsx
  const { theme } = useSettings()
  const colorMode = theme === 'light' ? 'light' : 'dark'
```

(c) Change the `<ReactFlow … colorMode="dark" …>` prop to `colorMode={colorMode}`.

> Only the `Flow` component (used when there are sub-plans) renders `<ReactFlow>`. The empty branch has no React Flow, so no change there. `useSettings()` is safe to call here — the whole app is wrapped in `<SettingsProvider>`.

- [ ] **Step 2: Type-check, lint, build + commit**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build` → all clean/succeed.

```bash
git add src/features/decisions/PlanCanvas.tsx
git commit -m "fix(decisions-fe): canvas colorMode follows app theme (D5)"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- [ ] Manual smoke (optional, local): open a plan → 기록 tab shows events newest-first with correct Korean sentences + relative times; do an action (add 안건, lock a 결정) → 기록 updates (scope invalidation). On `/decisions`, 활동 tab shows the workspace feed with plan labels; tapping a row opens that plan. Switch theme to `light` → canvas controls render light.
- [ ] Final code-review over the whole `decisions-d5` diff.
- [ ] superpowers:finishing-a-development-branch.

## What this phase intentionally defers / excludes

- **Pagination / infinite scroll** on the feed — capped at 50 (the endpoint's default); enough at this scale.
- **Per-event detail / reason expansion** — the line is terse; `reason` stays on the 결정 banner in 목록.
- **Real-time updates** — events refresh on React Query invalidation (after a mutation) and refetch, not via websockets.
- **Filtering the timeline by type / actor** — not needed for a small group.
- **Backend changes** — none; D5 consumes the D1b endpoints unchanged.
