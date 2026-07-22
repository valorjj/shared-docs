# Decisions v3 Spec 2 — Frontend Implementation Plan (후보 상세: 장점/단점 + 자료)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `OptionSheet` into the real candidate workspace — rich 장점 / 단점 (tap-to-edit + autosave) and 자료 — in one mobile-first vertical scroll.

**Architecture:** Add a reusable non-collaborative `RichTextField` (Tiptap, mounted only while editing), extend the option types/hook with `pros`/`cons`, rebuild `OptionSheet` to fetch `useSubPlanDetail` for resources and render vote → 장점 → 단점 → 자료 → 댓글, then delete the obsolete `ProConSection`.

**Tech Stack:** React 19 + TS strict, Vite, React Query v5, CSS Modules, Tiptap 3 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder` — all already installed). No Yjs on this field.

## Global Constraints

- Repo: `shared-docs`. Work on branch `decisions-v3-spec2`.
- Build gate: `npm run build` (`tsc -b && vite build`) green at the end of every task. **No FE unit-test runner exists — do not add one.** Lint touched folders: `npx eslint src/features/decisions src/components/ui`.
- Bear-minimal aesthetic: hairlines, no shadows/card-lift; use `--c-*` / `--sp-*` / `--r-*` tokens. Lucide icons, never emoji. All UI text Korean.
- Mobile-first: single vertical scroll, thumb-reachable, no editor mounted until the user taps a side.
- The backend PATCH sanitizes 장점/단점 server-side; the client editor's constrained schema is convenience only.
- React Query invalidation uses `decisionKeys.scope(activeId)` (already how option mutations work).
- Git identity = personal (`valorjj`). Commit only; no push/merge/deploy until the whole plan is done and the user authorizes the coordinated deploy.

---

### Task FE-1: Types + api (additive — nothing removed yet)

**Files:**
- Modify: `src/features/decisions/types.ts` (OptionNode +pros/cons; add UpdateOptionPayload)
- Modify: `src/features/decisions/api.ts:165-172` (useUpdateOption payload type)

**Interfaces:**
- Produces: `OptionNode.pros: string | null`, `OptionNode.cons: string | null`; `UpdateOptionPayload = { title?; description?; sortOrder?; pros?; cons? }`; `useUpdateOption()` accepting `{ id: number; payload: UpdateOptionPayload }`.
- The existing `ProCon`/`CreateProConPayload` types and `useAddProCon`/`useDeleteProCon` hooks REMAIN this task (still imported by `ProConSection`) — removed in FE-4.

- [ ] **Step 1: Extend `OptionNode` and add the payload type**

In `types.ts`, `OptionNode` (lines ~24-35): remove nothing yet, but add two fields after `resources`:

```ts
export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  proCons: ProCon[]
  voterUserIds: number[]
  resources: OptionResource[]
  pros: string | null
  cons: string | null
  confirmed: boolean
  confirmedAt: string | null
  confirmedBy: number | null
}
```

Add near the other payloads (after `TitleDescPayload`, line ~94):

```ts
export type UpdateOptionPayload = {
  title?: string
  description?: string
  sortOrder?: number
  pros?: string
  cons?: string
}
```

- [ ] **Step 2: Point `useUpdateOption` at the new payload**

In `api.ts`, update the import line (`~8`) to include `UpdateOptionPayload`, then change `useUpdateOption`:

```ts
export function useUpdateOption() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (v: { id: number; payload: UpdateOptionPayload }) =>
      (await apiClient.patch<OptionNode>(`/api/options/${v.id}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

- [ ] **Step 3: Build**

Run: `cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs && npm run build`
Expected: PASS. (`OptionNode` gains optional-shaped fields; existing consumers unaffected. Any dormant caller of `useUpdateOption` used `{title,description}`, still valid under `UpdateOptionPayload`.)

- [ ] **Step 4: Commit**

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts
git commit -m "feat(decisions): add OptionNode.pros/cons + UpdateOptionPayload (additive)"
```

---

### Task FE-2: `RichTextField` primitive (non-Yjs Tiptap, tap-to-edit + autosave)

**Files:**
- Create: `src/components/ui/RichTextField.tsx`
- Create: `src/components/ui/RichTextField.module.css`
- Modify: `src/components/ui/index.ts` (export)

**Interfaces:**
- Produces: `RichTextField` (default export + named re-export from `ui`):
  `{ value: string | null; placeholder: string; onSave: (html: string) => void; disabled?: boolean }`.
  Read mode renders sanitized HTML (no editor mounted); tapping enters edit mode (mounts Tiptap, autofocus); saves debounced on change and immediately on blur, then returns to read mode.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import styles from './RichTextField.module.css'

type Props = {
  value: string | null
  placeholder: string
  onSave: (html: string) => void
  disabled?: boolean
}

/**
 * Small non-collaborative rich-text field for Decisions 장점/단점. Read mode shows
 * server-sanitized HTML with no editor mounted (mobile-light). Tap → edit mode
 * mounts Tiptap; autosaves on change (debounced) and on blur, then exits. The
 * server re-sanitizes on save, so rendering the stored HTML is safe.
 */
export default function RichTextField({ value, placeholder, onSave, disabled }: Props) {
  const [editing, setEditing] = useState(false)

  if (!editing) {
    const empty = !value || value.trim() === ''
    return (
      <button
        type="button"
        className={empty ? `${styles.read} ${styles.empty}` : styles.read}
        onClick={() => { if (!disabled) setEditing(true) }}
        disabled={disabled}
        aria-label="편집"
      >
        {empty
          ? <span className={styles.placeholder}>{placeholder}</span>
          : <div className={styles.html} dangerouslySetInnerHTML={{ __html: value! }} />}
      </button>
    )
  }

  return (
    <RichTextEditor
      value={value}
      placeholder={placeholder}
      onSave={onSave}
      onDone={() => setEditing(false)}
    />
  )
}

function RichTextEditor({
  value, placeholder, onSave, onDone,
}: { value: string | null; placeholder: string; onSave: (html: string) => void; onDone: () => void }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<string>(value ?? '')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, heading: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true,
        HTMLAttributes: { rel: 'nofollow noopener', target: '_blank' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? '',
    autofocus: 'end',
    editorProps: { attributes: { class: styles.editor } },
    onUpdate: ({ editor }) => {
      latestRef.current = editor.getHTML()
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onSave(latestRef.current), 600)
    },
  })

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const flushAndExit = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (editor) onSave(editor.getHTML())
    onDone()
  }

  return (
    <div className={styles.editWrap} onBlur={(e) => {
      // Exit only when focus leaves the whole editor subtree (not on internal focus moves).
      if (!e.currentTarget.contains(e.relatedTarget as Node)) flushAndExit()
    }}>
      <EditorContent editor={editor} />
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

```css
/* RichTextField.module.css — Bear-minimal: hairline, no shadow, calm. */
.read {
  display: block; width: 100%; text-align: left;
  border: 1px solid var(--c-border); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); background: transparent;
  font: inherit; color: inherit; cursor: text; min-height: 2.4rem;
}
.read:hover { border-color: var(--c-border-strong, var(--c-border)); }
.empty { color: var(--c-text-muted); }
.placeholder { color: var(--c-text-muted); }
.html, .editor { font-size: 0.9rem; line-height: 1.55; }
.html :where(p) { margin: 0 0 var(--sp-1); }
.html :where(ul, ol) { margin: 0 0 var(--sp-1); padding-left: 1.25rem; }
.html :where(a) { color: var(--c-accent); text-decoration: underline; }
.editWrap {
  border: 1px solid var(--c-accent); border-radius: var(--r-md);
  padding: var(--sp-2) var(--sp-3); background: var(--c-surface);
}
.editor:focus { outline: none; }
.editor :where(p) { margin: 0 0 var(--sp-1); }
.editor :where(ul, ol) { margin: 0 0 var(--sp-1); padding-left: 1.25rem; }
.editor :where(p.is-editor-empty:first-child)::before {
  content: attr(data-placeholder); color: var(--c-text-muted);
  float: left; height: 0; pointer-events: none;
}
```

> If the `--c-*`/`--r-*`/`--sp-*` token names above don't match this repo's actual tokens, open `src/index.scss` (or the ui tokens file) and use the real names — do not invent tokens.

- [ ] **Step 3: Export from `ui`**

In `src/components/ui/index.ts`, add:

```ts
export { default as RichTextField } from './RichTextField'
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npx eslint src/components/ui`
Expected: PASS. (Component compiles; not yet mounted anywhere — that's FE-3.)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/RichTextField.tsx src/components/ui/RichTextField.module.css src/components/ui/index.ts
git commit -m "feat(ui): add RichTextField (non-collab Tiptap, tap-to-edit + autosave)"
```

---

### Task FE-3: Rebuild `OptionSheet` + pass `subPlanId` from `PlanChain`

**Files:**
- Modify: `src/features/decisions/OptionSheet.tsx`
- Modify: `src/features/decisions/OptionSheet.module.css` (add section spacing)
- Modify: `src/features/decisions/PlanChain.tsx:110-112, 207-209` (resolve owning subPlan; pass `subPlanId`)

**Interfaces:**
- Consumes: `RichTextField` (FE-2); `useUpdateOption` with `UpdateOptionPayload` (FE-1); existing `useSubPlanDetail`, `OptionResourceSection`, `useCastVote`/`useRetractVote`, `Comments`, `Panel`.
- Produces: `OptionSheet` prop shape `{ option: OptionNode; subPlanId: number; onClose: () => void }`.

- [ ] **Step 1: Rebuild `OptionSheet.tsx`**

```tsx
import { Vote } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { collabColorForUser } from '../notes/collab/collabColor'
import { useCastVote, useRetractVote, useUpdateOption, useSubPlanDetail } from './api'
import { Panel, RichTextField } from '../../components/ui'
import OptionResourceSection from './OptionResourceSection'
import Comments from '../../components/Comments'
import styles from './OptionSheet.module.css'
import type { OptionNode } from './types'

type Props = { option: OptionNode; subPlanId: number; onClose: () => void }

/**
 * Full 후보 detail: vote → 장점 → 단점 → 자료 → 댓글, one vertical scroll.
 * Fetches the subplan detail so 자료 (empty in the tree payload) is populated, and
 * re-resolves the open 후보 from that live detail to avoid a stale snapshot.
 */
export default function OptionSheet({ option, subPlanId, onClose }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const { data: detail } = useSubPlanDetail(subPlanId)

  // Prefer the freshly-fetched option (has resources + latest pros/cons); fall back
  // to the tree option passed in while the detail request is in flight.
  const live = detail?.options.find((o) => o.id === option.id) ?? option

  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const updateOption = useUpdateOption()
  const iVoted = live.voterUserIds.includes(myUserId)
  const busy = castVote.isPending || retractVote.isPending

  return (
    <Panel open onClose={onClose} title={live.title}>
      <div className={styles.wrap}>
        <div className={styles.voteRow}>
          <button
            type="button"
            className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
            disabled={busy}
            aria-pressed={iVoted}
            onClick={() => (iVoted ? retractVote.mutate(live.id) : castVote.mutate(live.id))}
          >
            <Vote size={15} />
            <span>{iVoted ? '투표함' : '투표'}</span>
          </button>
          {live.voterUserIds.length > 0 && (
            <div className={styles.voters}>
              {live.voterUserIds.map((uid) => (
                <span key={uid} className={styles.av}
                  style={{ background: collabColorForUser(uid) }} title={nameOf(uid)}>
                  {nameOf(uid).slice(0, 1)}
                </span>
              ))}
            </div>
          )}
        </div>
        {live.voterUserIds.length > 0 && (
          <p className={styles.voterNames}>투표: {live.voterUserIds.map(nameOf).join(', ')}</p>
        )}

        <section className={styles.block}>
          <h4 className={styles.blockLabel}>장점</h4>
          <RichTextField
            value={live.pros}
            placeholder="장점을 적어보세요"
            onSave={(html) => updateOption.mutate({ id: live.id, payload: { pros: html } })}
          />
        </section>

        <section className={styles.block}>
          <h4 className={styles.blockLabel}>단점</h4>
          <RichTextField
            value={live.cons}
            placeholder="단점을 적어보세요"
            onSave={(html) => updateOption.mutate({ id: live.id, payload: { cons: html } })}
          />
        </section>

        <OptionResourceSection optionId={live.id} resources={live.resources} />

        <div className={styles.comments}>
          <Comments pageId={`option:${live.id}`} />
        </div>
      </div>
    </Panel>
  )
}
```

- [ ] **Step 2: Add section styles to `OptionSheet.module.css`**

Append:

```css
.block { margin-top: var(--sp-4); }
.blockLabel {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--c-text-muted); margin: 0 0 var(--sp-2);
}
```

- [ ] **Step 3: Pass `subPlanId` from `PlanChain`**

In `PlanChain.tsx`, replace the `sheetOption` resolution (lines ~110-112) with an owner-aware resolve:

```tsx
  const sheetOwner = sheetOptionId == null
    ? null
    : stations.find((sp) => sp.options.some((o) => o.id === sheetOptionId)) ?? null
  const sheetOption = sheetOwner?.options.find((o) => o.id === sheetOptionId) ?? null
```

And the render (lines ~207-209):

```tsx
      {sheetOption && sheetOwner && (
        <OptionSheet
          option={sheetOption}
          subPlanId={sheetOwner.id}
          onClose={() => setSheetOptionId(null)}
        />
      )}
```

- [ ] **Step 4: Build + lint**

Run: `npm run build && npx eslint src/features/decisions src/components/ui`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/decisions/OptionSheet.tsx src/features/decisions/OptionSheet.module.css src/features/decisions/PlanChain.tsx
git commit -m "feat(decisions): 후보 sheet — 장점/단점 rich fields + 자료 in one scroll"
```

---

### Task FE-4: Delete the obsolete `ProConSection` + ProCon types/hooks

**Files:**
- Delete: `src/features/decisions/ProConSection.tsx`, `src/features/decisions/ProConSection.module.css`
- Modify: `src/features/decisions/types.ts` (remove `ProCon`, `ProConKind`, `CreateProConPayload`; remove `OptionNode.proCons`)
- Modify: `src/features/decisions/api.ts` (remove `useAddProCon`, `useDeleteProCon`; drop `CreateProConPayload` import)

**Interfaces:**
- Produces: `OptionNode` with no `proCons` field — final shape matching the backend `OptionResponse` (pros/cons only).

- [ ] **Step 1: Confirm nothing else imports ProConSection or the ProCon symbols**

Run: `grep -rn 'ProConSection\|useAddProCon\|useDeleteProCon\|CreateProConPayload\|ProConKind\|proCons\|: ProCon\b' src`
Expected before edits: hits only in `ProConSection.tsx`, `types.ts`, `api.ts`. (If anything else references them, stop and reconcile.)

- [ ] **Step 2: Delete the component**

```bash
git rm src/features/decisions/ProConSection.tsx src/features/decisions/ProConSection.module.css
```

- [ ] **Step 3: Remove the types**

In `types.ts`: delete `ProConKind` and `ProCon` (lines ~21-22), delete `CreateProConPayload` (line ~96), and remove the `proCons: ProCon[]` line from `OptionNode`.

- [ ] **Step 4: Remove the hooks**

In `api.ts`: delete the `useAddProCon` and `useDeleteProCon` functions and the `// ── ProCon (장단점) mutations ──` comment; remove `CreateProConPayload` from the type import list (line ~6).

- [ ] **Step 5: Grep clean + build**

Run: `grep -rn 'ProCon\|proCons' src`
Expected: no matches (or only unrelated strings).
Run: `npm run build && npx eslint src/features/decisions`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(decisions): remove obsolete ProConSection + ProCon types/hooks"
```

---

## Self-Review

- **Spec coverage:** RichTextField (tap-to-edit + autosave) ✓ FE-2; OptionSheet single-scroll vote→장점→단점→자료→댓글 ✓ FE-3; fetch useSubPlanDetail for resources ✓ FE-3; pass subPlanId ✓ FE-3; types/api pros/cons ✓ FE-1; delete ProConSection ✓ FE-4.
- **Green per task:** FE-1 additive; FE-2 adds unmounted component; FE-3 mounts it + resources; FE-4 removes only after FE-3 stopped using ProCon. Each ends `npm run build` green.
- **Type consistency:** `pros`/`cons: string | null` on `OptionNode`; `UpdateOptionPayload.pros/cons?: string`; `OptionSheet` prop `subPlanId: number`; `RichTextField.onSave: (html: string) => void` matches `updateOption.mutate({ id, payload: { pros|cons } })`.
- **Deploy note:** lower-risk than Spec 1 (removes only unused pro/con endpoints, adds fields). Deploy BE then FE close together; verify BE V35/V36 locally (`docker logs shared-docs-backend | grep flyway` + health), FE via Vercel/user smoke.
