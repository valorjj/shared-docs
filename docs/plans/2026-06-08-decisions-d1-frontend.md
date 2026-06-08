# Decisions D1 — Frontend (plain non-canvas CRUD UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Conventions reference (READ FIRST):** `/tmp/frontend-ref.md` — the full map of this repo's feature structure, API client, React Query keys, workspace context, design primitives, tokens, forms pattern, and review-blocking rules. Every component below follows it.

**Goal:** A plain (non-canvas) UI that exercises the full Decisions model end-to-end — list/create/rename/delete 계획; drill into a 계획 to manage 안건 and 선택지; rate options (1–5 + comment); lock/reopen 결정 — proving the D1b backend before the React Flow canvas (D2+).

**Architecture:** New feature folder `src/features/decisions/`. Two routes: `/decisions` (계획 list) and `/decisions/:planId` (one plan's tree on a single mobile-first page). Data via React Query hooks over the D1b REST API; all mutations invalidate the workspace-scoped `decisions` query scope. No new shared primitives — compose existing `src/components/ui/*`.

**Tech Stack:** Vite + React 19 + TypeScript + CSS Modules + React Query + React Router v6 + axios (`apiClient`) + lucide-react. Verification per task: `npx tsc --noEmit`, `npx eslint src/`, and (final) `npm run build`. (This repo has no component-test framework; the gate is type-check + lint + build + a manual smoke checklist.)

**Rating widget (user-chosen):** a segmented **1·2·3·4·5 number-button** row for the current user's score, a numeric average header (`평균 3.5 (2)`), and per-member lines (`지진 4 · 소은 3`, with the comment beneath).

**Backend dependency:** the D1b API lives on the backend `decisions-d1b` branch (not deployed). To smoke-test locally, run `./gradlew bootRun` on that branch; type-check/lint/build do not need it.

---

## Korean copy (use verbatim)

| Context | Text |
|---|---|
| Nav + list title | `결정` |
| List empty | title `아직 계획이 없어요` · desc `함께 정할 일을 계획으로 추가해 보세요.` |
| Add plan FAB / button | `계획 추가` |
| Plan roll-up | `안건 {n}` · `결정 {m}` |
| Status chips | ACTIVE→`진행 중` · ARCHIVED→`보관됨` · 안건 EMPTY→`대기` · IN_PROGRESS→`진행 중` · DECIDED→`결정됨` |
| Add 안건 | `안건 추가` |
| 안건 empty options | `선택지를 추가해 결정을 시작하세요.` |
| Add 선택지 | `선택지 추가` |
| Rating header | `평균 {avg} ({count})` · unrated `평가 없음` |
| My rating label | `내 평가` · comment placeholder `한마디 (선택)` |
| Decide button | `결정하기` |
| Decision banner | `결정됨` · `{option} · {reason}` · `다시 열기` |
| Reopen confirm | `이 결정을 다시 열까요? 기록은 남아요.` |
| Generic delete confirm | `삭제할까요? 되돌릴 수 없어요.` |
| Field labels | `제목` / `설명` / `이유` |
| Modal save / cancel | `저장` / `취소` · busy `저장 중…` |
| Option-in-use delete error | `결정에 사용된 선택지는 삭제할 수 없어요.` (surfaced from `ApiError.body.detail`) |

---

## Task 1: Data layer — `types.ts` + `api.ts`

**Files:**
- Create: `src/features/decisions/types.ts`
- Create: `src/features/decisions/api.ts`

- [ ] **Step 1: Write `types.ts`** (mirrors the D1b response/request DTOs)

```ts
export type PlanStatus = 'ACTIVE' | 'ARCHIVED'
export type SubPlanStatus = 'EMPTY' | 'IN_PROGRESS' | 'DECIDED'

export type PlanSummary = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  subPlanCount: number
  decidedCount: number
  createdByUserId: number
  createdAt: string
}

export type Rating = { userId: number; score: number; comment: string | null }

export type DecisionInfo = {
  id: number
  chosenOptionId: number
  reason: string
  decidedByUserId: number
  decidedAt: string
}

export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  avgScore: number | null
  ratingCount: number
  ratings: Rating[]
}

export type SubPlanNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  canvasX: number | null
  canvasY: number | null
  status: SubPlanStatus
  options: OptionNode[]
  decision: DecisionInfo | null
}

export type PlanTree = {
  id: number
  title: string
  description: string | null
  status: PlanStatus
  canvasX: number | null
  canvasY: number | null
  groupLabel: string | null
  createdByUserId: number
  createdAt: string
  subPlans: SubPlanNode[]
}

// ── Payloads ──
export type CreatePlanPayload = { title: string; description?: string }
export type UpdatePlanPayload = { title?: string; description?: string; status?: PlanStatus }
export type TitleDescPayload = { title: string; description?: string }
export type RatePayload = { score: number; comment?: string }
export type LockDecisionPayload = { chosenOptionId: number; reason: string }
```

- [ ] **Step 2: Write `api.ts`** (query keys + all hooks; every query/mutation reads `activeId` and invalidates `decisionKeys.scope(activeId)` so list counts and the open tree both refresh)

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import type {
  CreatePlanPayload, LockDecisionPayload, OptionNode, PlanSummary, PlanTree,
  Rating, RatePayload, SubPlanNode, TitleDescPayload, UpdatePlanPayload,
} from './types'

export const decisionKeys = {
  scope: (wsId: number | null) => ['decisions', wsId] as const,
  list: (wsId: number | null) => ['decisions', wsId, 'list'] as const,
  tree: (wsId: number | null, planId: number) => ['decisions', wsId, 'tree', planId] as const,
}

// ── Queries ──
export function usePlans() {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.list(activeId),
    queryFn: async () => (await apiClient.get<PlanSummary[]>('/api/plans')).data,
    enabled: activeId != null,
  })
}

export function usePlanTree(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.tree(activeId, planId),
    queryFn: async () => (await apiClient.get<PlanTree>(`/api/plans/${planId}`)).data,
    enabled: activeId != null && Number.isFinite(planId),
  })
}

// ── Plan mutations ──
export function useCreatePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: CreatePlanPayload) => (await apiClient.post<PlanSummary>('/api/plans', p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdatePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: UpdatePlanPayload }) =>
      (await apiClient.patch<PlanSummary>(`/api/plans/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeletePlan() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/plans/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── SubPlan (안건) mutations ──
export function useAddSubPlan(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (p: TitleDescPayload) =>
      (await apiClient.post<SubPlanNode>(`/api/plans/${planId}/subplans`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateSubPlan(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: TitleDescPayload }) =>
      (await apiClient.patch<SubPlanNode>(`/api/subplans/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteSubPlan(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/subplans/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Option (선택지) mutations ──
export function useAddOption(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { subPlanId: number; payload: TitleDescPayload }) =>
      (await apiClient.post<OptionNode>(`/api/subplans/${v.subPlanId}/options`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateOption(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: TitleDescPayload }) =>
      (await apiClient.patch<OptionNode>(`/api/options/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteOption(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/options/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Rating (평가) mutations ──
export function useRateOption(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { optionId: number; payload: RatePayload }) =>
      (await apiClient.put<Rating>(`/api/options/${v.optionId}/rating`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteRating(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (optionId: number) => { await apiClient.delete(`/api/options/${optionId}/rating`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}

// ── Decision (결정) mutations ──
export function useLockDecision(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { subPlanId: number; payload: LockDecisionPayload }) =>
      (await apiClient.post(`/api/subplans/${v.subPlanId}/decision`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useReopenDecision(planId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (subPlanId: number) => { await apiClient.post(`/api/subplans/${subPlanId}/decision/reopen`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Type-check.** Run `npx tsc --noEmit` → no errors. (`planId` params on some hooks are currently only used for clarity/scoping symmetry; eslint may not flag unused fn params, but if `npx eslint src/` complains about an unused `planId`, prefix with `_` or keep — they are used as part of the public hook contract consumed in later tasks.)

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions-fe): data types + React Query hooks (D1)"
```

---

## Task 2: Leaf components — TitleDescModal, RatingControl, DecisionModal

**Files:**
- Create: `src/features/decisions/TitleDescModal.tsx`
- Create: `src/features/decisions/RatingControl.tsx` + `RatingControl.module.css`
- Create: `src/features/decisions/DecisionModal.tsx` + `DecisionModal.module.css`

- [ ] **Step 1: `TitleDescModal.tsx`** — one reusable create/edit modal for 계획/안건/선택지 (all are `{title, description?}`). Wrapper + keyed inner (no setState-in-effect). `entityLabel` drives the title (`계획`/`안건`/`선택지`).

```tsx
import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Textarea, Button } from '../../components/ui'
import type { TitleDescPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  entityLabel: string                 // '계획' | '안건' | '선택지'
  initial?: { title: string; description: string | null } | null
  busy?: boolean
  onSubmit: (payload: TitleDescPayload) => void
}

export default function TitleDescModal(props: Props) {
  return (
    <TitleDescModalInner
      key={props.open ? (props.initial ? `edit-${props.initial.title}` : 'new') : 'closed'}
      {...props}
    />
  )
}

function TitleDescModalInner({ open, onClose, entityLabel, initial, busy, onSubmit }: Props) {
  const isEdit = initial != null
  const [title, setTitle] = useState(() => initial?.title ?? '')
  const [description, setDescription] = useState(() => initial?.description ?? '')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit({ title: t, description: description.trim() || undefined })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${entityLabel} ${isEdit ? '수정' : '추가'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="titledesc-form" disabled={busy || !title.trim()}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="titledesc-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="td-title">제목</Label>
          <Input id="td-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={200} autoFocus placeholder={`${entityLabel} 제목`} />
        </Field>
        <Field>
          <Label htmlFor="td-desc" optional>설명</Label>
          <Textarea id="td-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000} rows={3} />
        </Field>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: `RatingControl.tsx`** — the current user's 1–5 number buttons + comment. Local state seeded from the user's existing rating; buttons call `onRate` immediately (PUT upsert); comment commits on blur (or Enter) if changed. A "지우기" ghost clears the rating (DELETE) when one exists.

```tsx
import { useState } from 'react'
import { Button } from '../../components/ui'
import styles from './RatingControl.module.css'

type Props = {
  myRating: { score: number; comment: string | null } | null
  busy?: boolean
  onRate: (score: number, comment: string | undefined) => void
  onClear: () => void
}

const SCORES = [1, 2, 3, 4, 5]

export default function RatingControl({ myRating, busy, onRate, onClear }: Props) {
  const [comment, setComment] = useState(() => myRating?.comment ?? '')
  const score = myRating?.score ?? null

  const pick = (s: number) => onRate(s, comment.trim() || undefined)
  const commitComment = () => {
    if (score == null) return // a comment without a score is meaningless; pick a score first
    const next = comment.trim() || undefined
    if ((myRating?.comment ?? '') !== (next ?? '')) onRate(score, next)
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>내 평가</span>
      <div className={styles.scores} role="group" aria-label="내 평가 점수">
        {SCORES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            aria-pressed={score === s}
            className={score === s ? `${styles.score} ${styles.scoreOn}` : styles.score}
            onClick={() => pick(s)}
          >
            {s}
          </button>
        ))}
        {score != null && (
          <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>지우기</Button>
        )}
      </div>
      <input
        className={styles.comment}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={commitComment}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitComment() } }}
        placeholder="한마디 (선택)"
        maxLength={2000}
        disabled={busy}
      />
    </div>
  )
}
```

`RatingControl.module.css` (mirror the token usage in `src/features/links/LinkCard.module.css`):
- `.wrap`: `display:flex; flex-direction:column; gap:var(--sp-2);`
- `.label`: `font-size:var(--fs-xs); color:var(--c-text-subtle);`
- `.scores`: `display:flex; gap:var(--sp-1); align-items:center;`
- `.score`: 36×36 (mobile: min 40px touch target), `border:1px solid var(--c-border); border-radius:var(--r-sm); background:var(--c-surface); color:var(--c-text); font-size:var(--fs-sm); cursor:pointer; transition:border-color var(--t-fast),background var(--t-fast);`
- `.score:hover`: `border-color:var(--c-border-strong);`
- `.scoreOn`: `background:var(--c-primary); border-color:var(--c-primary); color:#fff;`
- `.comment`: full-width text input, `border:1px solid var(--c-border); border-radius:var(--r-sm); padding:var(--sp-2) var(--sp-3); font:inherit; font-size:var(--fs-sm); background:var(--c-surface); color:var(--c-text);` `:focus` → `outline:none; box-shadow:var(--ring-focus);`

- [ ] **Step 3: `DecisionModal.tsx`** — pick a 선택지 (radio list) + reason; confirms the lock. Reused for first lock and re-lock (re-lock supersedes server-side). Wrapper + keyed inner.

```tsx
import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Textarea, Button } from '../../components/ui'
import styles from './DecisionModal.module.css'
import type { OptionNode, LockDecisionPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  options: OptionNode[]
  currentChosenId?: number | null     // preselect when changing an existing decision
  busy?: boolean
  onSubmit: (payload: LockDecisionPayload) => void
}

export default function DecisionModal(props: Props) {
  return <DecisionModalInner key={props.open ? 'open' : 'closed'} {...props} />
}

function DecisionModalInner({ open, onClose, options, currentChosenId, busy, onSubmit }: Props) {
  const [chosenOptionId, setChosenOptionId] = useState<number | null>(() => currentChosenId ?? null)
  const [reason, setReason] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (chosenOptionId == null || !reason.trim()) return
    onSubmit({ chosenOptionId, reason: reason.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="결정하기"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="decision-form"
                  disabled={busy || chosenOptionId == null || !reason.trim()}>
            {busy ? '저장 중…' : '결정'}
          </Button>
        </>
      }
    >
      <form id="decision-form" onSubmit={submit}>
        <div className={styles.options} role="radiogroup" aria-label="선택지">
          {options.map((o) => (
            <label key={o.id} className={chosenOptionId === o.id ? `${styles.option} ${styles.optionOn}` : styles.option}>
              <input type="radio" name="chosen" value={o.id}
                     checked={chosenOptionId === o.id}
                     onChange={() => setChosenOptionId(o.id)} />
              <span className={styles.optionTitle}>{o.title}</span>
              {o.avgScore != null && <span className={styles.optionAvg}>평균 {o.avgScore.toFixed(1)}</span>}
            </label>
          ))}
        </div>
        <Field>
          <Label htmlFor="decision-reason">이유</Label>
          <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                    rows={3} maxLength={2000} placeholder="왜 이 선택지로 정했나요?" />
        </Field>
      </form>
    </Modal>
  )
}
```

`DecisionModal.module.css`:
- `.options`: `display:flex; flex-direction:column; gap:var(--sp-2); margin-bottom:var(--sp-4);`
- `.option`: `display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3); border:1px solid var(--c-border); border-radius:var(--r-sm); cursor:pointer;`
- `.optionOn`: `border-color:var(--c-primary); background:var(--c-primary-soft);`
- `.optionTitle`: `flex:1; font-size:var(--fs-base); color:var(--c-text);`
- `.optionAvg`: `font-size:var(--fs-xs); color:var(--c-text-muted);`

- [ ] **Step 4: Verify.** `npx tsc --noEmit` && `npx eslint src/` → clean. (If `Textarea`/`Input` prop types differ from assumptions, open `src/components/ui/Input.tsx`/`Textarea.tsx` and adapt props to match — they forward standard HTML attrs.)

- [ ] **Step 5: Commit**
```bash
git add src/features/decisions/TitleDescModal.tsx \
        src/features/decisions/RatingControl.tsx src/features/decisions/RatingControl.module.css \
        src/features/decisions/DecisionModal.tsx src/features/decisions/DecisionModal.module.css
git commit -m "feat(decisions-fe): title/desc, rating, decision modals (D1)"
```

---

## Task 3: Tree nodes — OptionRow + SubPlanSection

**Files:**
- Create: `src/features/decisions/OptionRow.tsx` + `OptionRow.module.css`
- Create: `src/features/decisions/SubPlanSection.tsx` + `SubPlanSection.module.css`

These are presentational + wire mutations passed down from `PlanDetail` (Task 4). They receive a `nameOf(userId) => string` resolver (built in PlanDetail from `useMembers` + `useAuth`).

- [ ] **Step 1: `OptionRow.tsx`** — one 선택지: header row (title, average, expand chevron, edit/delete menu), and an expandable body with the per-member rating lines + the current user's `RatingControl`. A `decidedBadge` marks the chosen option.

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Check } from 'lucide-react'
import { IconButton } from '../../components/ui'
import RatingControl from './RatingControl'
import styles from './OptionRow.module.css'
import type { OptionNode } from './types'

type Props = {
  option: OptionNode
  myUserId: number
  isChosen: boolean
  nameOf: (userId: number) => string
  busy?: boolean
  onRate: (score: number, comment: string | undefined) => void
  onClearRating: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function OptionRow({
  option, myUserId, isChosen, nameOf, busy, onRate, onClearRating, onEdit, onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const myRating = option.ratings.find((r) => r.userId === myUserId) ?? null
  const others = option.ratings.filter((r) => r.userId !== myUserId)

  return (
    <div className={isChosen ? `${styles.row} ${styles.rowChosen}` : styles.row}>
      <div className={styles.head}>
        <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={styles.title}>{option.title}</span>
          {isChosen && <Check size={14} className={styles.chosenMark} aria-label="결정됨" />}
        </button>
        <span className={styles.avg}>
          {option.avgScore != null ? `평균 ${option.avgScore.toFixed(1)} (${option.ratingCount})` : '평가 없음'}
        </span>
        <div className={styles.actions}>
          <IconButton variant="ghost" size="sm" label="선택지 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="선택지 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </div>
      </div>

      {open && (
        <div className={styles.body}>
          {option.description && <p className={styles.desc}>{option.description}</p>}
          <RatingControl myRating={myRating} busy={busy} onRate={onRate} onClear={onClearRating} />
          {others.length > 0 && (
            <ul className={styles.others}>
              {others.map((r) => (
                <li key={r.userId} className={styles.otherLine}>
                  <span className={styles.otherName}>{nameOf(r.userId)}</span>
                  <span className={styles.otherScore}>{r.score}</span>
                  {r.comment && <span className={styles.otherComment}>{r.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

`OptionRow.module.css` (tokens only; no shadow; hairline borders):
- `.row`: `border:1px solid var(--c-border); border-radius:var(--r-md); background:var(--c-surface);`
- `.rowChosen`: `border-color:var(--c-primary); background:var(--c-primary-soft);`
- `.head`: `display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3);`
- `.toggle`: `display:flex; align-items:center; gap:var(--sp-2); flex:1; background:none; border:none; padding:0; cursor:pointer; color:var(--c-text); text-align:left;`
- `.title`: `font-size:var(--fs-base); font-weight:var(--fw-medium);`
- `.chosenMark`: `color:var(--c-primary);`
- `.avg`: `font-size:var(--fs-xs); color:var(--c-text-muted); white-space:nowrap;`
- `.actions`: `display:flex; gap:var(--sp-1);`
- `.body`: `padding:0 var(--sp-3) var(--sp-3); display:flex; flex-direction:column; gap:var(--sp-3); border-top:1px solid var(--c-border);` (add `padding-top:var(--sp-3)`)
- `.desc`: `font-size:var(--fs-sm); color:var(--c-text-muted); margin:0;`
- `.others`: `list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--sp-1);`
- `.otherLine`: `display:flex; align-items:baseline; gap:var(--sp-2); font-size:var(--fs-sm);`
- `.otherName`: `color:var(--c-text); font-weight:var(--fw-medium);`
- `.otherScore`: `color:var(--c-primary); font-weight:var(--fw-semi);`
- `.otherComment`: `color:var(--c-text-muted);`

- [ ] **Step 2: `SubPlanSection.tsx`** — one 안건: header (title, status chip, edit/delete + `결정하기`), the options list (or empty hint), `선택지 추가`, and — when decided — a 결정 banner with `다시 열기`. All actions are callbacks from PlanDetail.

```tsx
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton, Badge } from '../../components/ui'
import OptionRow from './OptionRow'
import styles from './SubPlanSection.module.css'
import type { OptionNode, SubPlanNode } from './types'

const STATUS_LABEL: Record<SubPlanNode['status'], string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

type Props = {
  subPlan: SubPlanNode
  myUserId: number
  nameOf: (userId: number) => string
  busy?: boolean
  onEdit: () => void
  onDelete: () => void
  onAddOption: () => void
  onEditOption: (o: OptionNode) => void
  onDeleteOption: (o: OptionNode) => void
  onRate: (optionId: number, score: number, comment: string | undefined) => void
  onClearRating: (optionId: number) => void
  onDecide: () => void
  onReopen: () => void
}

export default function SubPlanSection({
  subPlan, myUserId, nameOf, busy, onEdit, onDelete, onAddOption,
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen,
}: Props) {
  const { decision } = subPlan
  const chosen = decision ? subPlan.options.find((o) => o.id === decision.chosenOptionId) ?? null : null

  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>{subPlan.title}</h2>
          <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
        </div>
        <div className={styles.actions}>
          <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </div>
      </header>

      {subPlan.description && <p className={styles.desc}>{subPlan.description}</p>}

      {decision && chosen && (
        <div className={styles.banner}>
          <span className={styles.bannerTag}>결정됨</span>
          <span className={styles.bannerBody}><strong>{chosen.title}</strong> · {decision.reason}</span>
          <Button variant="ghost" size="sm" onClick={onReopen} disabled={busy}>다시 열기</Button>
        </div>
      )}

      {subPlan.options.length === 0 ? (
        <p className={styles.empty}>선택지를 추가해 결정을 시작하세요.</p>
      ) : (
        <div className={styles.options}>
          {subPlan.options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              myUserId={myUserId}
              isChosen={decision?.chosenOptionId === o.id}
              nameOf={nameOf}
              busy={busy}
              onRate={(score, comment) => onRate(o.id, score, comment)}
              onClearRating={() => onClearRating(o.id)}
              onEdit={() => onEditOption(o)}
              onDelete={() => onDeleteOption(o)}
            />
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={onAddOption}>선택지 추가</Button>
        {!decision && subPlan.options.length > 0 && (
          <Button variant="soft" size="sm" onClick={onDecide} disabled={busy}>결정하기</Button>
        )}
      </div>
    </section>
  )
}
```

`SubPlanSection.module.css`:
- `.section`: `border:1px solid var(--c-border); border-radius:var(--r-md); background:var(--c-surface); padding:var(--sp-4); display:flex; flex-direction:column; gap:var(--sp-3);`
- `.head`: `display:flex; align-items:center; justify-content:space-between; gap:var(--sp-2);`
- `.titleWrap`: `display:flex; align-items:center; gap:var(--sp-2);`
- `.title`: `font-family:var(--font-serif); font-size:var(--fs-lg); font-weight:var(--fw-semi); color:var(--c-text); margin:0;`
- `.actions`: `display:flex; gap:var(--sp-1);`
- `.desc`: `font-size:var(--fs-sm); color:var(--c-text-muted); margin:0;`
- `.banner`: `display:flex; align-items:center; gap:var(--sp-2); padding:var(--sp-2) var(--sp-3); border:1px solid var(--c-primary); border-radius:var(--r-sm); background:var(--c-primary-soft); font-size:var(--fs-sm);`
- `.bannerTag`: `font-size:var(--fs-xs); font-weight:var(--fw-semi); color:var(--c-primary);`
- `.bannerBody`: `flex:1; color:var(--c-text);`
- `.empty`: `font-size:var(--fs-sm); color:var(--c-text-subtle); margin:0;`
- `.options`: `display:flex; flex-direction:column; gap:var(--sp-2);`
- `.footer`: `display:flex; gap:var(--sp-2);`

- [ ] **Step 3: Verify.** `npx tsc --noEmit` && `npx eslint src/` → clean. (Confirm `Badge` accepts plain children; if it needs a `tone`/`variant` prop, read `src/components/ui/Badge.tsx` and pass the neutral default.)

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/OptionRow.tsx src/features/decisions/OptionRow.module.css \
        src/features/decisions/SubPlanSection.tsx src/features/decisions/SubPlanSection.module.css
git commit -m "feat(decisions-fe): 안건 section + 선택지 row with rating/decision UI (D1)"
```

---

## Task 4: Pages — DecisionList + PlanDetail

**Files:**
- Create: `src/features/decisions/DecisionList.tsx` + `DecisionList.module.css`
- Create: `src/features/decisions/PlanDetail.tsx` + `PlanDetail.module.css`

- [ ] **Step 1: `DecisionList.tsx`** — `/decisions`. Lists 계획 cards (title, description, roll-up `안건 N · 결정 M`, status chip), tap → `/decisions/:id`; FAB opens create; per-card edit/delete. Loading→`Skeleton`, error→`ErrorState onRetry`, empty→`EmptyState`.

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton,
} from '../../components/ui'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from './api'
import TitleDescModal from './TitleDescModal'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

export default function DecisionList() {
  const navigate = useNavigate()
  const { data: plans, isLoading, isError, error, refetch } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const remove = useDeletePlan()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)

  return (
    <Page>
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      {isLoading && (
        <div className={styles.list}>
          <Skeleton height={84} radius="var(--r-md)" />
          <Skeleton height={84} radius="var(--r-md)" />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {plans && plans.length === 0 && (
        <EmptyState icon={<Vote size={24} strokeWidth={1.5} />} title="아직 계획이 없어요"
                    description="함께 정할 일을 계획으로 추가해 보세요." />
      )}

      {plans && plans.length > 0 && (
        <div className={styles.list}>
          {plans.map((p) => (
            <Card key={p.id} padding="none" className={styles.card}>
              <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{p.title}</span>
                  <Badge>{p.status === 'ARCHIVED' ? '보관됨' : '진행 중'}</Badge>
                </div>
                {p.description && <span className={styles.cardDesc}>{p.description}</span>}
                <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
              </button>
              <div className={styles.cardActions}>
                <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
                <IconButton variant="ghost" size="sm" label="계획 삭제"
                  onClick={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) remove.mutate(p.id) }}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />

      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="계획" busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <TitleDescModal
        open={editing != null} onClose={() => setEditing(null)} entityLabel="계획"
        initial={editing ? { title: editing.title, description: editing.description } : null}
        busy={update.isPending}
        onSubmit={(payload) => {
          if (!editing) return
          update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })
        }}
      />
    </Page>
  )
}
```

`DecisionList.module.css`:
- `.list`: `display:flex; flex-direction:column; gap:var(--sp-3);`
- `.card`: `display:flex; align-items:stretch; overflow:hidden;`
- `.cardMain`: `flex:1; display:flex; flex-direction:column; gap:var(--sp-1); padding:var(--sp-3) var(--sp-4); background:none; border:none; cursor:pointer; text-align:left; color:var(--c-text);`
- `.cardTop`: `display:flex; align-items:center; gap:var(--sp-2);`
- `.cardTitle`: `font-size:var(--fs-base); font-weight:var(--fw-semi); flex:1;`
- `.cardDesc`: `font-size:var(--fs-sm); color:var(--c-text-muted);`
- `.cardMeta`: `font-size:var(--fs-xs); color:var(--c-text-subtle);`
- `.cardActions`: `display:flex; align-items:center; gap:var(--sp-1); padding-right:var(--sp-2);`

- [ ] **Step 2: `PlanDetail.tsx`** — `/decisions/:planId`. Reads `useParams`, fetches tree + members, builds `nameOf`, renders header (BackLink + serif title) and the 안건 sections via `SubPlanSection`, owns all the modal state (add/edit 안건, add/edit 선택지, decide) and wires every mutation. Uses `useAuth()` for `myUserId`.

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Page, PageHeader, PageTitle, BackLink, Button, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlanTree, useAddSubPlan, useUpdateSubPlan, useDeleteSubPlan,
  useAddOption, useUpdateOption, useDeleteOption,
  useRateOption, useDeleteRating, useLockDecision, useReopenDecision,
} from './api'
import SubPlanSection from './SubPlanSection'
import TitleDescModal from './TitleDescModal'
import DecisionModal from './DecisionModal'
import styles from './PlanDetail.module.css'
import type { OptionNode, SubPlanNode } from './types'

export default function PlanDetail() {
  const { planId: planIdParam } = useParams()
  const planId = Number(planIdParam)
  const navigate = useNavigate()
  const { user } = useAuth()
  const myUserId = user?.id ?? -1
  const { activeId } = useActiveWorkspace()

  const { data: tree, isLoading, isError, error, refetch } = usePlanTree(planId)
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  // mutations (planId threaded for cache invalidation symmetry)
  const addSubPlan = useAddSubPlan(planId)
  const updateSubPlan = useUpdateSubPlan(planId)
  const deleteSubPlan = useDeleteSubPlan(planId)
  const addOption = useAddOption(planId)
  const updateOption = useUpdateOption(planId)
  const deleteOption = useDeleteOption(planId)
  const rate = useRateOption(planId)
  const clearRating = useDeleteRating(planId)
  const lock = useLockDecision(planId)
  const reopen = useReopenDecision(planId)

  // modal state
  const [addingSubPlan, setAddingSubPlan] = useState(false)
  const [editingSubPlan, setEditingSubPlan] = useState<SubPlanNode | null>(null)
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null)        // subPlanId
  const [editingOption, setEditingOption] = useState<OptionNode | null>(null)
  const [decidingFor, setDecidingFor] = useState<SubPlanNode | null>(null)

  return (
    <Page>
      <PageHeader>
        <BackLink to="/decisions" mobileOnly>결정</BackLink>
        <PageTitle>{tree?.title ?? '계획'}</PageTitle>
      </PageHeader>

      {isLoading && <div className={styles.list}><Skeleton height={120} radius="var(--r-md)" /></div>}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {tree && (
        <>
          {tree.description && <p className={styles.planDesc}>{tree.description}</p>}

          {tree.subPlans.length === 0 ? (
            <EmptyState title="안건이 없어요" description="결정할 안건을 추가해 보세요."
              action={<Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>} />
          ) : (
            <div className={styles.list}>
              {tree.subPlans.map((sp) => (
                <SubPlanSection
                  key={sp.id}
                  subPlan={sp}
                  myUserId={myUserId}
                  nameOf={nameOf}
                  busy={rate.isPending || lock.isPending || reopen.isPending}
                  onEdit={() => setEditingSubPlan(sp)}
                  onDelete={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteSubPlan.mutate(sp.id) }}
                  onAddOption={() => setAddingOptionFor(sp.id)}
                  onEditOption={(o) => setEditingOption(o)}
                  onDeleteOption={(o) => {
                    if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                    deleteOption.mutate(o.id, {
                      onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                    })
                  }}
                  onRate={(optionId, score, comment) => rate.mutate({ optionId, payload: { score, comment } })}
                  onClearRating={(optionId) => clearRating.mutate(optionId)}
                  onDecide={() => setDecidingFor(sp)}
                  onReopen={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(sp.id) }}
                />
              ))}
              <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
            </div>
          )}
        </>
      )}

      {/* 안건 add/edit */}
      <TitleDescModal
        open={addingSubPlan} onClose={() => setAddingSubPlan(false)} entityLabel="안건" busy={addSubPlan.isPending}
        onSubmit={(payload) => addSubPlan.mutate(payload, { onSuccess: () => setAddingSubPlan(false) })}
      />
      <TitleDescModal
        open={editingSubPlan != null} onClose={() => setEditingSubPlan(null)} entityLabel="안건"
        initial={editingSubPlan ? { title: editingSubPlan.title, description: editingSubPlan.description } : null}
        busy={updateSubPlan.isPending}
        onSubmit={(payload) => { if (editingSubPlan) updateSubPlan.mutate({ id: editingSubPlan.id, payload }, { onSuccess: () => setEditingSubPlan(null) }) }}
      />

      {/* 선택지 add/edit */}
      <TitleDescModal
        open={addingOptionFor != null} onClose={() => setAddingOptionFor(null)} entityLabel="선택지" busy={addOption.isPending}
        onSubmit={(payload) => { if (addingOptionFor != null) addOption.mutate({ subPlanId: addingOptionFor, payload }, { onSuccess: () => setAddingOptionFor(null) }) }}
      />
      <TitleDescModal
        open={editingOption != null} onClose={() => setEditingOption(null)} entityLabel="선택지"
        initial={editingOption ? { title: editingOption.title, description: editingOption.description } : null}
        busy={updateOption.isPending}
        onSubmit={(payload) => { if (editingOption) updateOption.mutate({ id: editingOption.id, payload }, { onSuccess: () => setEditingOption(null) }) }}
      />

      {/* 결정 */}
      <DecisionModal
        open={decidingFor != null} onClose={() => setDecidingFor(null)}
        options={decidingFor?.options ?? []}
        currentChosenId={decidingFor?.decision?.chosenOptionId ?? null}
        busy={lock.isPending}
        onSubmit={(payload) => { if (decidingFor) lock.mutate({ subPlanId: decidingFor.id, payload }, { onSuccess: () => setDecidingFor(null) }) }}
      />
    </Page>
  )
}
```

`PlanDetail.module.css`:
- `.list`: `display:flex; flex-direction:column; gap:var(--sp-4);`
- `.planDesc`: `font-size:var(--fs-base); color:var(--c-text-muted); margin:0 0 var(--sp-4);`

- [ ] **Step 3: Verify the auth hook + user id field.** Open `src/auth/useAuth.ts` (or wherever `useAuth` lives — grep `export function useAuth`) and confirm the user object's id field name. The plan assumes `user.id: number`. If it is `userId` or the JWT `sub`, adapt `myUserId` accordingly. Then `npx tsc --noEmit` && `npx eslint src/` → clean.

- [ ] **Step 4: Commit**
```bash
git add src/features/decisions/DecisionList.tsx src/features/decisions/DecisionList.module.css \
        src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions-fe): 계획 list + plan detail pages (D1)"
```

---

## Task 5: Wire routing + nav, final build + smoke

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/common/BottomNav.tsx`
- Modify: `src/components/common/TopNav.tsx`

- [ ] **Step 1: Routes in `src/App.tsx`.** Add lazy imports near the other feature lazies:
```ts
const DecisionList = lazy(() => import('./features/decisions/DecisionList'))
const PlanDetail = lazy(() => import('./features/decisions/PlanDetail'))
```
Add inside `<MobileShell>` (sibling to `/calc`):
```tsx
<Route path="/decisions" element={<DecisionList />} />
<Route path="/decisions/:planId" element={<PlanDetail />} />
```

- [ ] **Step 2: Nav entry in BOTH navs.** In `src/components/common/BottomNav.tsx` and `src/components/common/TopNav.tsx`, import the icon (`import { Vote } from 'lucide-react'` alongside the existing lucide imports) and add to each file's `ITEMS` array (place after `/calc` or wherever fits the existing order):
```ts
{ to: '/decisions', Icon: Vote, label: '결정' },
```
Match each file's exact `NavItem` shape (the explorer confirmed both use `{ to, Icon, label }`). Keep the two arrays in sync.

- [ ] **Step 3: Full verification.**
```
npx tsc --noEmit
npx eslint src/
npm run build
```
All three must pass clean (no type errors, no lint errors, successful production build).

- [ ] **Step 4: Commit**
```bash
git add src/App.tsx src/components/common/BottomNav.tsx src/components/common/TopNav.tsx
git commit -m "feat(decisions-fe): route + nav wiring for /decisions (D1)"
```

- [ ] **Step 5: Manual smoke checklist** (requires backend `decisions-d1b` running via `./gradlew bootRun` + a dev token; reported for the user to run, NOT a blocker for the commit):
  1. `/decisions` shows empty state → 계획 추가 creates a plan card.
  2. Tap card → detail; 안건 추가 → 안건 appears as `대기`.
  3. 선택지 추가 ×2 → 안건 becomes `진행 중`; expand a 선택지, set your 1–5 score + comment → `평균` updates, your line shows under 내 평가.
  4. 결정하기 → pick a 선택지 + 이유 → 안건 becomes `결정됨`, banner shows, chosen row highlighted.
  5. 다시 열기 → back to `진행 중`. Delete a chosen option → blocked with the Korean 409 message.
  6. Back to `/decisions` → card roll-up shows `안건 N · 결정 M` correctly.

---

## Done criteria
- `npx tsc --noEmit`, `npx eslint src/`, `npm run build` all green.
- `/decisions` + `/decisions/:planId` render, nav entry present in both navs, full CRUD + rate + decide/reopen wired, all text Korean, Lucide-only, tokens-only CSS, no card lift, one primary button per modal.
- React Query invalidation keeps list roll-ups and the open tree in sync after every mutation.

## After D1
**D2** — read-only 안건 canvas (React Flow / @xyflow): render one plan's 안건 nodes (auto-layout), expand → 선택지 sub-stack, status styling. Then D3 (drag + persist + `sub_plan_edges`), D4 (workspace roadmap), D5 (timeline + feed + polish).
