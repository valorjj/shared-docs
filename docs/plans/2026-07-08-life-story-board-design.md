# Life Story Board — Decisions 진화 설계

**Date:** 2026-07-08
**Status:** Approved design, pre-plan
**Scope:** Decisions pillar — recursive sub-decisions, per-decision community section (자료+댓글), chronological story view

## 1. Vision

Evolve the Decisions pillar from a flat "계획 → 안건 → 선택지" register into a **life-time story board**: big life decisions (집 구매, 자동차 구입, 이직) that decompose recursively into sub-decisions, each carrying its own evidence (links, files, receipts, contracts, images) and lightweight comments, browsable later as a chronological story. This deepens the "immutable group diary" framing — past decisions stay frozen; the record of *how* we decided grows richer.

User's driving examples: buying a house (region → price → infra → interior, each with documents/receipts attached); buying a car (brand → price range → community research → pros/cons — potentially hundreds of sub-decisions).

## 2. Current state (what exists)

- `Plan` (계획): flat per workspace. Status/lock/deadline/완료/휴지통/논의 note (1:1, realtime collab)/canvas position.
- `SubPlan` (안건): decidable question under a plan; sort_order spine; deadline; canvas node.
- `Option` (선택지): votes + ratings per option.
- `Decision` (결정): append-only with reason + vote snapshot.
- `SubPlanEdge` (연결), `PlanEvent` (기록 timeline, 12 event types).
- `Comment`: **generic** workspace-scoped threads keyed by arbitrary `pageId` string — reusable as-is.
- `Attachment`: hard-wired to notes (`note_attachments`); `FileStorageService` + per-user 500MB quota + global 10GB disk guard are generic.
- Realtime: workspace-wide decisions change-signal (AFTER_COMMIT → WS → React Query invalidate) + per-plan presence.

## 3. Decisions made (with the user, 2026-07-08)

1. **A sub-decision IS a full 계획**, linked by `plans.parent_plan_id`. Not a nested-안건 tree, not a separate entity. Everything a decision has today (선택지, votes, ratings, 기한, lock, 완료, 휴지통, 논의, 기록, realtime) works on sub-decisions for free; recursion is unlimited.
2. **Zoom-as-navigation**, not one literal infinite canvas. Each decision is its own page; clicking a sub-decision plays a zoom-in transition into its page; breadcrumb zooms out. Scales to hundreds of sub-decisions because each level loads only its own data.
3. **Floating tree navigator** on the right of decision pages: full tree from root ancestor down, current node highlighted, click-to-jump. Cure for deep-tree disorientation.
4. **Sub-decisions attach to the parent decision** (`parent_plan_id`), **plus an 안건-promotion action** ("하위결정으로 전환") for when a question outgrows its card. Not attached to 안건 (alternating node types tax everything); not both (complexity tax).
5. **Community section per decision page: 자료 + 댓글, 논의 stays.** 자료 = links/files/images/receipts. 댓글 = flat Apple-Memo-style stream reusing the generic `Comment` entity (`pageId = "plan:{planId}"`). 논의 (rich collaborative note) remains the long-form surface. No merge/migration of the shipped 논의 integration.
6. **Chronological story view** on the life board (결정 tab): third view toggle beside 목록/캔버스. Vertical time axis, root decisions anchored by date, sub-decision dot-clusters.
7. **자료 icons: Lucide only, no emoji** (house rule). Modern/simple/cute: small rounded tile per row, muted per-kind accent tint, glyph from a pure function of content-type + extension + URL domain.

## 4. Data model

### V23 — sub-decision tree
```sql
ALTER TABLE plans ADD COLUMN parent_plan_id BIGINT NULL,
  ADD CONSTRAINT fk_plans_parent FOREIGN KEY (parent_plan_id) REFERENCES plans(id),
  ADD INDEX idx_plans_parent (parent_plan_id);
```
- `parent_plan_id` immutable after creation (no re-parenting in v1).
- Service invariant: child `workspace_id` == parent `workspace_id`.
- Root board query: `parent_plan_id IS NULL` (+ existing status/deleted filters).
- FK is RESTRICT; subtree deletion handled in service (see §7 휴지통 cascade).

### V24 — community section
```sql
CREATE TABLE plan_attachments (
  -- mirrors note_attachments: id, plan_id FK, original_filename, content_type,
  -- size_bytes, stored_filename (unique), uploaded_by_user_id FK, created_at
);
CREATE TABLE plan_resources (
  id BIGINT PK, workspace_id BIGINT NOT NULL, plan_id BIGINT NOT NULL FK,
  kind VARCHAR(10) NOT NULL,          -- LINK | FILE
  url VARCHAR(2048) NULL,             -- LINK only
  title VARCHAR(300) NULL,            -- user-editable label (links; optional caption for files)
  attachment_id BIGINT NULL FK -> plan_attachments,  -- FILE only
  created_by_user_id BIGINT NOT NULL, created_at, updated_at, version
);
```
- Images are FILE rows with `image/*` content type (inline thumbnail rendering); no separate IMAGE kind.
- Per-user upload quota (500MB): quota query becomes SUM over `note_attachments` + `plan_attachments`. Global 10GB disk guard already lives in `FileStorageService.store()` — no change.
- Comments: **no schema change**. Convention `pageId = "plan:{planId}"` on the existing `comments` table/API.

## 5. API surface

Phase 1:
- `GET /api/plans/{id}/tree` → `{ ancestors: [...], root: {...}, nodes: [{id,title,status,deadline,childCount,resourceCount,commentCount,parentId}] }` — ancestors for breadcrumb, subtree for navigator + 하위결정 section. In-memory tree build from the workspace's plans (small scale; no recursive CTE needed).
- `POST /api/plans` gains optional `parentPlanId`.
- `POST /api/subplans/{id}/promote` → creates child plan from the 안건 (see §7), returns new plan id.
- Existing plan list endpoint gains `parent_plan_id IS NULL` filter for the root board (and story view reuses it — dates already present).

Phase 2:
- `GET/POST/DELETE /api/plans/{id}/resources` (+ `PATCH` title). File upload multipart to `POST /api/plans/{id}/resources/file` (mirrors note attachment upload path + quota checks).
- Comments: existing `/api/comments?pageId=plan:{id}` CRUD unchanged.

Phase 3: no new endpoints.

## 6. UX per surface

**Decision page** (order): breadcrumb › title/status/기한 › view toggle › 안건 목록 › **하위결정** › **자료** › **댓글**; 논의 rail unchanged.
- 하위결정 cards: title, status chip, deadline chip, 💬(comment count) 📎(resource count) ●(child count) — Lucide glyphs, Bear-hairline card, no shadow. Click → zoom-in transition (scale+fade, ~200ms, respects `prefers-reduced-motion`) → navigate.
- Breadcrumb: `결정 › 자동차 구입 › 브랜드 선정`; segments navigate; long chains middle-truncate (`결정 › … › 브랜드 선정`).
- **Floating navigator**: right-side collapsible panel (desktop ≥1200px; on mobile it becomes a sheet from a tree button). Indent up to 4 levels, deeper nodes flatten with `›` path prefix. Current node highlighted; status dot per node.
- **Canvas view**: new compact circular node type for sub-decisions alongside 안건 nodes; click = zoom in. 안건 nodes unchanged.
- **안건 ⋮ menu**: "하위결정으로 전환" (hidden when 안건 already decided or plan locked).

**자료 rows**: rounded icon tile + title + meta (domain or filesize) + uploader + time. Icon mapping (pure function): URL domain `youtube.com|youtu.be` → `Youtube`; other links → `Link`; `image/*` → `Image` (thumbnail); `application/pdf`/docs → `FileText`; filename contains 영수증/receipt → `Receipt`; 계약/contract → `FileSignature`; fallback `Paperclip`. Each kind gets a muted accent tint token (existing CSS variable palette).

**댓글**: flat chronological, author name + relative time + text, single-line composer at bottom. No threading, no reactions (YAGNI).

**Story view** (결정 tab, third toggle): vertical axis, top = past. Year/month markers; root-decision cards anchored at **anchor date** = `completedAt` ?? latest active decision's `createdAt` ?? plan `createdAt`. Dot-cluster per card shows sub-decision count; click zooms in. Plans whose only date is a future deadline sit under a "예정" divider at the bottom.

## 7. Rules & edge cases

- **완료 with open sub-decisions**: allowed; confirm modal annotates "미완료 하위결정 N개" (annotate-don't-enforce, matching deadline philosophy).
- **잠금**: applies to the locked plan only, never the subtree. On a locked plan, 자료/댓글 **stay writable** — lock freezes decision content (안건/선택지/결정), not the conversation. 휴지통 plans are fully read-only as today.
- **휴지통 cascade**: trashing a parent trashes the whole subtree (confirm shows count); restore restores the subtree; permanent delete cascades the same way. A sub-decision alone trashes freely.
- **Promotion semantics**: creates child plan carrying title/description/deadline; existing 선택지 move under a first 안건 (same title) in the new plan — option rows are re-pointed (votes/ratings follow by FK, untouched); the original 안건 row is deleted; `SUBPLAN_PROMOTED` event written on the parent. Blocked when 안건 has an active decision or plan is locked. One-way in v1.
- **New PlanEventTypes**: `SUBDECISION_ADDED`, `SUBDECISION_REMOVED`, `SUBPLAN_PROMOTED`, `RESOURCE_ADDED`, `RESOURCE_REMOVED` (varchar(40) fits). Comments write no 기록 (too chatty).
- **Realtime**: sub-decision CRUD + resource CRUD publish the existing decisions change-signal. CommentService gets one hook: `pageId` matching `plan:*` also publishes it (comments appear live). Presence stays per-plan-page.
- **Sharing/permissions**: unchanged — workspace-member gated, same as decisions today.

## 8. Phasing (3 independent ship units)

1. **Sub-decision tree** — V23, tree endpoint, 하위결정 section, breadcrumb, zoom transition, navigator, canvas node, promotion. *The fundamental change.*
2. **Community section** — V24, 자료 (+icon system) + 댓글 wiring, realtime hooks, quota update.
3. **스토리 뷰** — client-only.

Each phase: own implementation plan → subagent-driven execution → review → deploy. The app never sits half-migrated.

## 9. Testing

- BE per phase: repository/service tests for tree invariants (same-workspace, immutable parent, cascade trash/restore), promotion (options re-pointing, vote/rating survival, blocked-when-decided/locked), quota summing both tables, event emission, change-signal publication. Suite currently ~226 tests, all green as baseline.
- FE gate: `tsc -b` + `npm run build` + targeted-folder lint (repo has no FE test runner); manual smoke per phase (zoom nav round-trip, navigator jump, promotion, upload/download, comment realtime, story ordering).

## 10. Out of scope (deliberate)

- Re-parenting / demoting sub-decisions (v1 one-way, immutable parent).
- Link previews/unfurling (fetch-on-add OG metadata) — title is user-typed; revisit later.
- Comment threading/reactions/edit-history.
- Semantic-zoom single canvas (rejected: performance + community section doesn't fit in nodes).
- Cross-workspace sub-decisions.
- Distributed realtime fan-out (stays in the shared-doc-yjs scaling lab).
