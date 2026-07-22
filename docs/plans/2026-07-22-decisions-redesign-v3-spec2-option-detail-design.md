# Decisions v3 — Spec 2: 후보 상세 (장점/단점 + 자료) — Design

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan
**Builds on:** Spec 1 core chain (`2026-07-22-decisions-redesign-v3-core-chain-design.md`, shipped). This is the second of the deferred v3 specs.
**Repos:** `shared-docs-backend` (Kotlin/Spring), `shared-docs` (React/Vite).

## Goal

Turn the 후보(candidate) sheet — today just title + vote + comments — into the real candidate workspace: a **rich 장점**, a **rich 단점**, and **자료** (links/images/files), stacked above the existing vote and comments in one mobile-first vertical scroll.

## Product decisions (locked during brainstorm)

- **장점/단점 = rich HTML, one document per side** (not the discrete plain-text line model that Spec 1 left dormant). Bold, italic, strike, bullet/ordered lists, inline links.
- **Sheet layout = single vertical scroll** (mockup option A): vote → 장점 → 단점 → 자료 → 댓글. No in-sheet tabs. Matches Bear-minimal + mobile one-handed use.
- **Editing = tap-to-edit + autosave on blur** (debounced). Read mode shows rendered HTML; tapping a side mounts an editor; blur saves. No editors mounted until tapped (mobile-light).
- **Not collaborative.** 장점/단점 are non-Yjs fields; peers see edits when the existing decisions change-feed refetches. Last-write-wins is acceptable for a short, rarely-simultaneously-edited field.
- **Clean replacement.** The discrete-line pro/con model (`option_pro_cons` table, `OptionProCon` entity, ProCon DTOs/endpoints, `ProConSection.tsx`) is **removed entirely** — it is unused (never mounted in Spec 1) and would fight the new model.
- **자료 is unchanged.** The backend (`option_resources` + `option_attachments`, endpoints) and the frontend `OptionResourceSection` are already complete from an earlier build; Spec 2 only mounts the section into the sheet.

## Backend (shared-docs-backend)

### Migration V35 (next after V34)
- `DROP TABLE option_pro_cons;`
- `ALTER TABLE options ADD COLUMN pros TEXT NULL, ADD COLUMN cons TEXT NULL;`
- Forward-only, `ddl-auto: validate`. No data preservation needed (feature unused; decisions data was already wiped at the Spec 1 deploy).

### Entities / DTOs
- Delete `OptionProCon.kt` entity + its repository. Remove the `proCons` relation/assembly from `Option` and from the tree/detail builders.
- `Option` entity: add `pros: String?`, `cons: String?` (columnDefinition TEXT).
- `OptionResponse`: **remove** `proCons: List<ProConResponse>`; **add** `pros: String?`, `cons: String?`. Populated in both `getTree` and `getSubPlanDetail` (two small text fields — cheap).
- Delete `CreateProConRequest` / `ProConResponse` DTOs.
- `UpdateOptionRequest`: add optional `pros: String?`, `cons: String?` (nullable; absent = unchanged, following the existing partial-update convention in `updateOption`).

### Endpoints
- **Removed:** `POST /api/options/{id}/procons`, `DELETE /api/procons/{id}` (+ service methods `addProCon`, `deleteProCon`).
- **Reused/extended:** `PATCH /api/options/{id}` (`updateOption` in `PlanService`) now also accepts `pros`/`cons`.
- 자료 endpoints unchanged.

### Sanitization (portfolio-grade requirement)
- On save, sanitize `pros`/`cons` server-side with **jsoup** (already a dependency) using an allowlist:
  `p, br, b, strong, i, em, s, ul, ol, li, a[href]` — and force `rel="nofollow noopener"` + strip non-`http(s)`/`mailto` hrefs.
- Never persist raw client HTML. This is the trust boundary; the client editor's constrained schema is a convenience, not the guarantee.

### Realtime / audit
- `updateOption` already publishes the decisions change-signal (`DecisionChangePublisher.publish(workspaceId, planId)`) AFTER_COMMIT — peers refetch and see new 장점/단점. Keep it.
- **No new timeline (PlanEvent) record** for pros/cons edits — they are not milestones; recording them would clutter 기록. (Existing event constants untouched; nothing deleted from the append-only enum.)

## Frontend (shared-docs)

### New primitive: `RichTextField` (`src/components/ui/`)
- Small, single-purpose, **non-collaborative** Tiptap field. Reusable (Spec 3+).
- Extensions: StarterKit subset (paragraph, bold, italic, strike, bullet list, ordered list, history) + Link + Placeholder. No headings/tables/images/mentions/slash — keep it light.
- **Read mode** (default): renders the field's sanitized HTML read-only (Tiptap `editable=false` or equivalent). Empty → placeholder text (e.g. "장점을 적어보세요").
- **Edit mode**: tap → becomes editable, autofocus, minimal bubble menu (bold/italic/list/link). **onBlur → onSave(html)**, debounced (~600ms) and also flushed immediately on blur. Returns to read mode.
- Props: `{ value: string | null; placeholder: string; onSave: (html: string) => void; disabled?: boolean }`.
- Server sanitizes on save; on render we trust server-sanitized HTML.

### `OptionSheet` rebuild (`src/features/decisions/`)
- Layout A, single scroll inside the existing `Panel`:
  1. **Vote** row (existing) — toggle + voter pips + names.
  2. **장점** — `RichTextField` bound to `option.pros`, saves via `useUpdateOption({ id, payload: { pros } })`.
  3. **단점** — `RichTextField` bound to `option.cons`, saves via `{ cons }`.
  4. **자료** — mount existing `OptionResourceSection` with `option.resources`.
  5. **댓글** — existing `Comments pageId={`option:${option.id}`}`.
- **Data source:** the sheet needs `resources` (tree returns them empty) so it fetches `useSubPlanDetail(subPlanId)` and re-resolves the open option from that live detail (same anti-stale pattern Spec 1 used against the live tree); falls back to the passed tree option while the detail loads.
- `PlanChain` passes `subPlanId` into `OptionSheet` alongside the option.
- Autosave mutations invalidate `decisionKeys.scope(activeId)` (existing `useUpdateOption` behavior).

### Types / api (`types.ts`, `api.ts`)
- `OptionNode`: remove `proCons: ProCon[]`; add `pros: string | null`, `cons: string | null`.
- Remove `ProCon`, `ProConKind`, `CreateProConPayload` types and the `useAddProCon` / `useDeleteProCon` hooks.
- `UpdateOptionPayload`: add optional `pros?`, `cons?`.

### Deletions
- `ProConSection.tsx` + `ProConSection.module.css` (obsolete).
- Any remaining ProCon imports/refs.

### Reused as-is
- `OptionResourceSection` + `.module.css`, `LinkResourceModal`, `resourceIcon`, `ImageLightbox`, `useAddOptionLinkResource` / `useUploadOptionResourceFile` / `useDeleteOptionResource`, `useSubPlanDetail`, `useUpdateOption`, `useCastVote` / `useRetractVote`, `Comments`, `Panel`.

## Out of scope (later specs)
- 후보 title/description editing in the sheet (title is set at creation).
- 서브안건 zoom-in nested chain (Spec 3).
- Timeline (기록) redesign (Spec 4).
- Yjs cursor-presence re-attach.
- Collaborative (multi-cursor) editing of 장점/단점.

## Testing

**Backend (JUnit):**
- V35 migration applies clean; `option_pro_cons` gone; `options.pros/cons` exist; Hibernate `validate` passes.
- `PATCH /api/options/{id}` with `pros`/`cons` round-trips; absent fields leave existing values unchanged.
- jsoup sanitize: `<script>`, `onclick=`, `javascript:` href, and disallowed tags are stripped; allowed formatting survives.
- `getTree` and `getSubPlanDetail` include `pros`/`cons`; no `proCons` field remains.
- Foreign-workspace option PATCH → 404 (existing guard still holds).

**Frontend (build gate — no unit runner):**
- `npm run build` (`tsc -b && vite build`) green.
- `eslint` on `src/features/decisions` + `src/components/ui` clean.
- Manual smoke (user): open 후보 sheet → type 장점 → blur → persists + peer sees on refetch; 단점 same; add link/image/file 자료 → thumbnail + lightbox; vote + comments still work; one-handed on mobile.

## Deploy
Two-repo but **lower-risk than Spec 1**: the BE change removes only the unused pro/con endpoints (live FE never called them) and adds fields. Still deploy BE→FE close together. BE→CD applies V35 (verify locally via `docker logs shared-docs-backend | grep flyway` + `curl :8090/actuator/health`); FE→Vercel. Confirm before executing per standing rule.
