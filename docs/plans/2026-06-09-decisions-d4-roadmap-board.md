# Decisions D4 — Workspace Roadmap Board (계획 lanes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape `/decisions` from a flat list of 계획 cards into a **grouped board** — vertical stacked sections by `groupLabel` (lanes), each card showing status + roll-up (`안건 N · 결정 M`), tapping a card drills into its 안건 canvas. Add the ability to set a plan's group on create/edit.

**Architecture:** Almost entirely frontend. The backend `list()` already returns `groupLabel`/`status`/`subPlanCount`/`decidedCount` on `PlanSummaryResponse`; the only backend gap is that `groupLabel` can't be set at *creation* (it's on `UpdatePlanRequest` but not `CreatePlanRequest`). So: one tiny backend field + a frontend reshape (a dedicated `PlanModal` with a group field, and `DecisionList` rendering grouped sections computed client-side).

**Tech Stack:** Spring Boot 3.5.3 + Kotlin (backend) · Vite + React 19 + TS + CSS Modules + React Query (frontend). No new libraries. No migration (columns already exist).

---

## Design decisions locked (D4 discussion, 2026-06-09)

This is a deliberate, recorded deviation from canvas-design decision #6 ("nested infinite canvas everywhere"): the **roadmap level is a board, not an infinite canvas**, because 계획 have no inter-plan edges (plan→plan edges were deferred) — so freeform XY position carries no signal there, while a board cleanly encodes the one real signal (grouping) and reads far better on mobile. React Flow stays reserved for the 안건 canvas (D2/D3), where edges + spatial layout are meaningful.

1. **Layout** = vertical stacked sections (group header + its cards), no horizontal scroll.
2. **Re-grouping** = via the plan's edit modal (a free-text group field), **no drag-and-drop**.
3. **Lanes are emergent** from a free-text `groupLabel`; the modal offers a `<datalist>` of existing group names for quick reuse. No separate "manage lanes" UI.
4. **Ungrouped plans** (null/empty `groupLabel`) collect into a default **"분류 없음"** section, rendered **last**.
5. **Graceful degrade**: if NO plan has a group, render cards flat with no section headers (today's behavior) — headers appear only once at least one named group exists.
6. Section order: named groups sorted alphabetically (Korean-aware `localeCompare`), then "분류 없음" last. Within a section, keep the API order (createdAt desc).

`canvasX/canvasY` on Plan stay unused by D4 (they exist from V15; harmless).

---

# PART A — Backend (`shared-docs-backend`)

> Branch note: do all work on a new branch `decisions-d4` (created by the executing skill). Backend `main` is at `ba17355`.

### Task 1: Allow `groupLabel` at plan creation

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt` (`CreatePlanRequest`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`create`)
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt` (add one test)

- [ ] **Step 1: Add the field to `CreatePlanRequest`**

In `DecisionDto.kt`, change `CreatePlanRequest` from:

```kotlin
data class CreatePlanRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 5000) val description: String? = null,
)
```

to:

```kotlin
data class CreatePlanRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:Size(max = 5000) val description: String? = null,
    @field:Size(max = 100) val groupLabel: String? = null,
)
```

(`@Size(max = 100)` matches the `group_label varchar(100)` column and the existing `UpdatePlanRequest.groupLabel` bound.)

- [ ] **Step 2: Persist it in `PlanService.create`**

In `PlanService.kt`, the `create` method builds `Plan(...)`. Add the group label (blank → null so an empty string doesn't create a phantom "" lane):

```kotlin
    fun create(workspaceId: Long, actorUserId: Long, request: CreatePlanRequest): PlanSummaryResponse {
        val plan = planRepository.save(
            Plan(
                workspaceId = workspaceId,
                title = request.title.trim(),
                description = request.description?.trim(),
                groupLabel = request.groupLabel?.trim()?.ifBlank { null },
                createdByUserId = actorUserId,
            ),
        )
        events.record(
            workspaceId = workspaceId,
            planId = plan.id!!,
            subPlanId = null,
            type = PlanEventType.PLAN_CREATED,
            actorUserId = actorUserId,
            payload = mapOf("title" to plan.title),
        )
        return plan.toSummary(subPlanCount = 0, decidedCount = 0)
    }
```

> Confirmed: `Plan.kt`'s constructor accepts `groupLabel: String? = null` as a named parameter (alongside `canvasX/canvasY/status`), so pass it in the constructor exactly as shown above. Do not change `Plan.kt`.

- [ ] **Step 3: Add a focused test**

Read `src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt` to match its existing fixture style (it has a `newUser()` helper and `@Autowired` service/workspaces/userRepository). Add this test method inside the class:

```kotlin
    @Test
    fun `create persists groupLabel and list returns it`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "이사", groupLabel = "2026 상반기"))
        service.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "메모", groupLabel = "  "))   // blank → null

        val list = service.list(ws.id!!)
        assertEquals("2026 상반기", list.first { it.title == "이사" }.groupLabel)
        assertEquals(null, list.first { it.title == "메모" }.groupLabel)
    }
```

If `PlanServiceTest` does not already import `assertEquals`, add `import org.junit.jupiter.api.Assertions.assertEquals`. If the autowired field for the service is named differently than `service` (or workspaces/userRepository differ), adapt the names to match the file.

- [ ] **Step 4: Run the test + full build**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanServiceTest"`
Expected: all PlanServiceTest tests PASS (including the new one).

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL (full suite green; Hibernate `validate` clean — no schema change).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
        src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
        src/test/kotlin/com/shareddocs/backend/decision/PlanServiceTest.kt
git commit -m "feat(decisions): accept groupLabel at plan creation (D4)"
```

---

# PART B — Frontend (`shared-docs`)

> Same branch `decisions-d4`. Frontend `main` is at `a36d6f0`. Reminder: the repo's real type-check is `npx tsc -b --noEmit` (plain `npx tsc --noEmit` checks zero files); `npm run build` is the authoritative gate. The ~24 pre-existing eslint errors in calc/notes/sheets are out of scope — only `src/features/decisions/` must be clean.

### Task 2: Add `groupLabel` to the plan payload types

**Files:**
- Modify: `src/features/decisions/types.ts`

- [ ] **Step 1: Extend the payloads**

In `types.ts`, change the two plan payload types:

```ts
export type CreatePlanPayload = { title: string; description?: string; groupLabel?: string }
export type UpdatePlanPayload = { title?: string; description?: string; status?: PlanStatus; groupLabel?: string }
```

(`PlanSummary` already has `groupLabel: string | null` — no change there. The existing `useCreatePlan`/`useUpdatePlan` hooks in `api.ts` pass the payload straight through, so they need no change — they already invalidate `decisionKeys.scope`.)

- [ ] **Step 2: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS (additive optional fields; no consumer broken).

- [ ] **Step 3: Commit**

```bash
git add src/features/decisions/types.ts
git commit -m "feat(decisions-fe): groupLabel on plan create/update payloads (D4)"
```

---

### Task 3: `PlanModal` — title + description + group field

**Files:**
- Create: `src/features/decisions/PlanModal.tsx`
- Create: `src/features/decisions/PlanModal.module.css`

A dedicated modal for 계획 (TitleDescModal stays as-is for 안건/선택지). Mirrors TitleDescModal's wrapper+keyed-inner pattern (no setState-in-effect), adds an optional free-text group field with a `<datalist>` of existing groups.

- [ ] **Step 1: Write `PlanModal.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Textarea, Button } from '../../components/ui'
import type { CreatePlanPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  initial?: { title: string; description: string | null; groupLabel: string | null } | null
  groupOptions?: string[]   // existing group labels, for the datalist
  busy?: boolean
  onSubmit: (payload: CreatePlanPayload) => void
}

export default function PlanModal(props: Props) {
  return (
    <PlanModalInner
      key={props.open ? (props.initial ? `edit-${props.initial.title}` : 'new') : 'closed'}
      {...props}
    />
  )
}

function PlanModalInner({ open, onClose, initial, groupOptions = [], busy, onSubmit }: Props) {
  const isEdit = initial != null
  const [title, setTitle] = useState(() => initial?.title ?? '')
  const [description, setDescription] = useState(() => initial?.description ?? '')
  const [group, setGroup] = useState(() => initial?.groupLabel ?? '')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onSubmit({
      title: t,
      description: description.trim() || undefined,
      // Send '' (not undefined) when cleared on edit, so the backend unsets the group.
      groupLabel: isEdit ? group.trim() : (group.trim() || undefined),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`계획 ${isEdit ? '수정' : '추가'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="plan-form" disabled={busy || !title.trim()}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="plan-title">제목</Label>
          <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={200} autoFocus placeholder="계획 제목" />
        </Field>
        <Field>
          <Label htmlFor="plan-desc" optional>설명</Label>
          <Textarea id="plan-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000} rows={3} />
        </Field>
        <Field>
          <Label htmlFor="plan-group" optional>그룹</Label>
          <Input id="plan-group" value={group} onChange={(e) => setGroup(e.target.value)}
                 maxLength={100} list="plan-group-options" placeholder="예: 2026 상반기" />
          <datalist id="plan-group-options">
            {groupOptions.map((g) => <option key={g} value={g} />)}
          </datalist>
        </Field>
      </form>
    </Modal>
  )
}
```

> Confirm `Label` accepts an `optional` prop (TitleDescModal uses `<Label optional>`), and `Input` forwards `list` (it spreads `...rest` onto the `<input>` — verified). No `PlanModal.module.css` rules are strictly required; create the file empty or with a single `.hint` rule only if you add helper text. If you create no styles, skip the CSS file and its import. (Keep the component CSS-free unless needed — the primitives carry the styling.)

- [ ] **Step 2: (Only if you added styles) create `PlanModal.module.css`**; otherwise omit. Do not import a stylesheet you didn't create.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b --noEmit`
Expected: PASS (PlanModal compiles; not yet imported anywhere — that's Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/PlanModal.tsx
# add PlanModal.module.css too ONLY if you created it
git commit -m "feat(decisions-fe): PlanModal with group field + datalist (D4)"
```

---

### Task 4: Reshape `DecisionList` into a grouped board

**Files:**
- Modify: `src/features/decisions/DecisionList.tsx`
- Modify: `src/features/decisions/DecisionList.module.css`

Group the existing plan summaries into vertical sections by `groupLabel`, render section headers (only when named groups exist), and swap `TitleDescModal` → `PlanModal` for create/edit. Keep the `Fab`, loading/error/empty states, card layout, and drill-in navigation.

- [ ] **Step 1: Rewrite `DecisionList.tsx`**

Replace the whole file with:

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton,
} from '../../components/ui'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from './api'
import PlanModal from './PlanModal'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

const UNGROUPED = '분류 없음'

type Section = { key: string; label: string; named: boolean; plans: PlanSummary[] }

/** Group plans into sections: named groups sorted Korean-aware, "분류 없음" last.
 *  Within a section the API order (createdAt desc) is preserved. */
function toSections(plans: PlanSummary[]): { sections: Section[]; hasNamedGroup: boolean; groupOptions: string[] } {
  const byGroup = new Map<string, PlanSummary[]>()
  for (const p of plans) {
    const g = p.groupLabel?.trim() || ''
    const key = g || UNGROUPED
    const arr = byGroup.get(key)
    if (arr) arr.push(p)
    else byGroup.set(key, [p])
  }
  const named = [...byGroup.keys()].filter((k) => k !== UNGROUPED).sort((a, b) => a.localeCompare(b, 'ko'))
  const sections: Section[] = named.map((label) => ({ key: label, label, named: true, plans: byGroup.get(label)! }))
  if (byGroup.has(UNGROUPED)) {
    sections.push({ key: UNGROUPED, label: UNGROUPED, named: false, plans: byGroup.get(UNGROUPED)! })
  }
  return { sections, hasNamedGroup: named.length > 0, groupOptions: named }
}

export default function DecisionList() {
  const navigate = useNavigate()
  const { data: plans, isLoading, isError, error, refetch } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const remove = useDeletePlan()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)

  const { sections, hasNamedGroup, groupOptions } = useMemo(
    () => toSections(plans ?? []),
    [plans],
  )

  const renderCard = (p: PlanSummary) => (
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
  )

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
        // No named groups → flat list (today's behavior). Otherwise → titled sections.
        hasNamedGroup ? (
          <div className={styles.board}>
            {sections.map((sec) => (
              <section key={sec.key} className={styles.section}>
                <header className={styles.sectionHead}>
                  <span className={styles.sectionLabel}>{sec.label}</span>
                  <span className={styles.sectionCount}>계획 {sec.plans.length}</span>
                </header>
                <div className={styles.list}>{sec.plans.map(renderCard)}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className={styles.list}>{(plans ?? []).map(renderCard)}</div>
        )
      )}

      <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />

      <PlanModal
        open={adding} onClose={() => setAdding(false)} groupOptions={groupOptions} busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <PlanModal
        key={`plan-edit-${editing?.id ?? 'none'}`}
        open={editing != null} onClose={() => setEditing(null)} groupOptions={groupOptions}
        initial={editing ? { title: editing.title, description: editing.description, groupLabel: editing.groupLabel } : null}
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

- [ ] **Step 2: Add the board/section styles to `DecisionList.module.css`**

Append (keep all existing `.list`, `.card`, `.cardMain`, `.cardTop`, `.cardTitle`, `.cardDesc`, `.cardMeta`, `.cardActions` rules unchanged):

```css
.board {
  display: flex;
  flex-direction: column;
  gap: var(--sp-6, 24px);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3, 12px);
}

/* Quiet lane header — hairline divider, not a heavy band (Bear-minimal). */
.sectionHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: var(--sp-2, 8px);
  border-bottom: 1px solid var(--c-border);
}

.sectionLabel {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--c-text);
}

.sectionCount {
  font-size: var(--fs-xs);
  color: var(--c-text-secondary);
}
```

> Verify the token names against `src/components/ui/tokens.css` before using them (`--sp-6`, `--sp-3`, `--sp-2`, `--fs-sm`, `--fs-xs`, `--c-text`, `--c-text-secondary`, `--c-border`). The fallbacks shown are belt-and-suspenders; if a token is absent, use the nearest existing one rather than the literal fallback. Match whatever spacing scale the rest of the decisions CSS already uses.

- [ ] **Step 3: Type-check, lint, build**

Run: `npx tsc -b --noEmit && npx eslint src/features/decisions/ && npm run build`
Expected: tsc clean; eslint 0 errors in decisions; `npm run build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/DecisionList.tsx src/features/decisions/DecisionList.module.css
git commit -m "feat(decisions-fe): group 계획 into roadmap board sections by group (D4)"
```

---

## Final verification (after all tasks)

- [ ] Backend: `./gradlew build` green.
- [ ] Frontend: `npx tsc -b --noEmit` clean; `npx eslint src/features/decisions/` 0 errors; `npm run build` succeeds.
- [ ] Manual smoke (optional, local): `/decisions` with no groups shows a flat list; add/edit a plan and set a group → sections appear, sorted, "분류 없음" last; the group field suggests existing groups; clearing a group on edit moves the plan back to "분류 없음"; tapping a card still drills into its 안건 canvas.
- [ ] Final code-review over the whole `decisions-d4` diff (both repos).
- [ ] superpowers:finishing-a-development-branch.

## What this phase intentionally defers / excludes

- **Infinite-canvas roadmap** (original decision #6) — deliberately replaced by the board at this level; see the locked-decisions note above.
- **Drag-and-drop re-grouping** — re-group via the edit modal in v1.
- **Plan→plan edges / dependencies** — already deferred in the design (not-list).
- **Lane management UI / lane ordering controls** — lanes are emergent from free-text groups, sorted alphabetically.
- **Archived-plan filtering / collapse** — status is shown on the card; filtering is a later polish (D5).
