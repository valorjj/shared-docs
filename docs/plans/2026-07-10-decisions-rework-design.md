# Decisions Page Rework — Nested 안건, 안건 Detail Page, Pros/Cons Candidates

**Date:** 2026-07-10
**Status:** Approved design, pre-plan
**Supersedes / revises:** the Life Story Board Phase 1 sub-decision model (`plans.parent_plan_id` child-plans) and the candidate rating model (`OptionRating`).

## 1. Why

Manual testing of the shipped Decisions pillar surfaced structural UX problems the up-front design missed:

1. **하위결정 felt detached.** Phase 1 attached sub-decisions to the *plan* (`plans.parent_plan_id`) and rendered them in a plan-level section, disconnected from the 안건 that motivated them. Navigating into a sub-decision zoomed to a whole separate plan page — "not intuitive, natural at all, quite annoying." Sub-items should hang off the **specific 안건** they belong to, visually connected and foldable.
2. **No 안건 detail surface.** 안건 only expanded inline; the user wants clicking a 안건 to open its own **detail page**.
3. **Candidate area was awkward.** 내평가 (1–5 rating) and 한마디 (per-rating comment) felt wrong. Planning needs *reasoning* per candidate, and real comment threads — per candidate and per plan.

The framing that guides all of it: **결정 is a chronological record of decisions and their candidates.** The structure should read like a nested record, not a graph of separate pages.

## 2. Decisions made (with the user, 2026-07-10)

1. **A sub-item is a nested 안건**, not a child plan. `SubPlan` gains `parent_sub_plan_id`; everything lives in ONE 계획. The Phase-1 child-plan concept (`plans.parent_plan_id` + zoom navigation) is **retired**.
2. **Every 안건 has a detail page** that is a full recursive hub: its 선택지 (candidates) + 결정하기, its foldable sub-안건 list, and its own 댓글 thread. Every 안건 page looks identical at any depth. A 안건 may have both its own 선택지 AND sub-안건 (not forced to be leaf-or-container).
3. **Candidate reasoning = structured 장점/단점** (pros/cons): two lists of short member-editable lines per 선택지.
4. **투표 (voting) stays**; **내평가 (rating) + 한마디 are removed** entirely.
5. **Comments at three levels** — 계획 + 안건 + 선택지 — all via the generic `Comment` entity and pageId conventions.
6. **No data migration** — disposable 2-person test data. Old child-plans become ordinary top-level 계획; old ratings are dropped.

## 3. Data model

### Retired
- `plans.parent_plan_id` (+ FK/index) — dropped (Flyway). The `/api/plans/{id}/hierarchy` endpoint and `PlanSummaryResponse.childCount` are removed.
- `OptionRating` entity + `option_ratings` table (Flyway drop) + `RatingController`/`RatingService` + FE `RatingControl`.

### V25 — nested 안건 + pros/cons; drop rating + parent_plan_id
```sql
-- Nested 안건: a 안건 may hang under another 안건 in the SAME plan.
ALTER TABLE `sub_plans`
  ADD COLUMN `parent_sub_plan_id` bigint(20) DEFAULT NULL,
  ADD KEY `idx_sub_plans_parent` (`parent_sub_plan_id`),
  ADD CONSTRAINT `fk_sub_plans_parent` FOREIGN KEY (`parent_sub_plan_id`)
      REFERENCES `sub_plans` (`id`) ON DELETE RESTRICT;

-- Candidate reasoning as structured pros/cons.
CREATE TABLE `option_pro_cons` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `option_id` bigint(20) NOT NULL,
  `kind` varchar(4) NOT NULL,          -- PRO | CON
  `content` varchar(500) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_option_pro_cons_option` (`option_id`),
  KEY `idx_option_pro_cons_workspace` (`workspace_id`),
  CONSTRAINT `fk_option_pro_cons_option` FOREIGN KEY (`option_id`) REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_pro_cons_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_pro_cons_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drop rating.
DROP TABLE IF EXISTS `option_ratings`;

-- Retire child-plan linkage (test data only; existing children become top-level plans).
ALTER TABLE `plans` DROP FOREIGN KEY `fk_plans_parent`;
ALTER TABLE `plans` DROP COLUMN `parent_plan_id`;
```

### Entity notes
- `SubPlan.parentSubPlanId: Long?` (nullable, immutable, same-workspace + same-plan enforced in service — a nested 안건's `planId` must equal its parent's `planId`). No re-parenting in v1.
- `OptionProCon` (`option_pro_cons`) extends `BaseEntity`: `workspaceId`, `optionId`, `kind: ProConKind {PRO,CON}`, `content`, `sortOrder`, `createdByUserId`.
- Comments: no schema change. pageId conventions `plan:{id}` (exists), `subplan:{id}`, `option:{id}`.

## 4. API

**Retired:** `GET /api/plans/{id}/hierarchy`; `POST/DELETE /api/options/{id}/ratings` (whatever the rating routes were); `parentPlanId` on create-plan; `childCount` on summaries.

**Changed:**
- `POST /api/plans/{planId}/subplans` gains optional `parentSubPlanId` (create a nested 안건). Service validates the parent 안건 is in the same plan+workspace.
- The plan tree response (`GET /api/plans/{planId}`) now returns each 안건 with a `parentSubPlanId` field and a `childSubPlanCount` so the client can build the tree and render compact cards + foldable child lists. **Top-level list = `parentSubPlanId IS NULL`.** Because the plan page no longer shows 선택지 inline, this response carries only per-안건 option/decision *counts*, not full 선택지/procon payloads (those come from the detail endpoint).
- New `GET /api/subplans/{subPlanId}` → a `SubPlanDetailResponse`: the 안건 + its full 선택지 (each with 장점/단점 + votes + decision state) + its direct child 안건 (summaries, with their own childSubPlanCount) + ancestor chain (for breadcrumb). Workspace-scoped; 404 cross-workspace.
- **Pro/con CRUD:** `POST /api/options/{optionId}/procons` (`{kind, content}`), `PATCH /api/procons/{id}` (`{content}`), `DELETE /api/procons/{id}`. Author-or-plan-owner-or-admin to mutate; lock-guarded (freezes with other decision content). Each write records a timeline event + publishes the decisions change-signal.
- **Comments:** unchanged endpoints; `CommentService` already publishes the change-signal for `plan:{id}` — extend the match to also fire for `subplan:{id}` and `option:{id}`.

**Promotion:** the existing `POST /api/subplans/{id}/promote` is **removed** (it promoted a 안건 into a child *plan*; that concept is gone). Instead, "break this 안건 down" = just adding sub-안건 under it via the create endpoint with `parentSubPlanId`. No option/vote migration needed.

## 5. UX

**계획 page** (`/decisions/:planId`, 목록 view):
- Top-level 안건 only (`parentSubPlanId IS NULL`), vertical order-spine between them (the 안건1→안건2 sequence).
- Each 안건 = a compact card (no inline 선택지): title, status chip, 기한 chip, `선택지 N` + decided marker, 💬/서브안건 counts. Click → 안건 detail page.
- A foldable **서브안건** block directly under each card (dashed, indented, collapsed default) listing child 안건 as smaller cards + "+ 서브안건 추가".
- Plan-level 자료 + 댓글 at the bottom (unchanged).
- 캔버스 / 기록 tabs stay; 캔버스 renders top-level 안건 only (sub-decision node type retired); 연결(edges) unchanged.

**안건 detail page** (`/decisions/:planId/agenda/:subPlanId`):
- Breadcrumb 결정 › {계획} › {안건 ancestors…} › {current}, all in-plan, clickable.
- Title + status + 기한.
- **선택지** list — each a collapsible candidate card (Section below); "+ 선택지 추가" + "결정하기".
- **서브안건** foldable block (same as plan page) + "+ 서브안건 추가"; click a child → its detail page (recursion).
- **댓글** — this 안건's thread (`subplan:{id}`).

**선택지 (candidate) card:**
- Collapsed: title, chosen-✓ if decided, vote count, small 장단점/💬 counts.
- Expanded:
  - **장점 / 단점** — two columns; each a list of short lines with inline "+ 장점"/"+ 단점" add and per-line delete (member-editable; content ≤500).
  - **투표** — existing tally + "나도 투표" toggle (unchanged mechanics).
  - **댓글** — candidate thread (`option:{id}`).
- No 내평가, no 한마디.
- Locked plan: 장점/단점 + 투표 freeze; 댓글 stays open.

**Icons:** Lucide only. 장점 `Plus`/`ThumbsUp`, 단점 `Minus`/`ThumbsDown` (pick the calmer pair at build time), consistent with the Bear-minimal bar.

## 6. Timeline events
- **Reuse:** `SUBPLAN_ADDED` (already exists) for nested 안건 too — payload gains `parentSubPlanId` when non-null.
- **Add:** `PROCON_ADDED`, `PROCON_REMOVED` (≤40 chars).
- **Retire:** `SUBDECISION_ADDED`, `SUBDECISION_REMOVED`, `SUBPLAN_PROMOTED` (all Phase-1 child-plan events, now gone).
- **Keep unchanged:** everything else, including `RESOURCE_ADDED` / `RESOURCE_REMOVED` (자료 is untouched by this rework).
- Comments write no timeline events (as today).

## 7. Impact on existing features
- **Story view (Phase 3):** stays; dot-cluster switches from `childCount` (child plans, retired) to the plan's 안건 count (`subPlanCount`, already present). `buildStoryLayout` unchanged (roots are now simply all plans).
- **Board list / trash / completed:** unchanged except `childCount`/`parentPlanId` removed from `PlanSummary`. Trash cascade simplifies (no child-plan subtree; but 안건-subtree + procon + subplan/option comments must be purged on permanent plan delete — extend `purgeSinglePlan`).
- **자료 + 댓글 (Phase 2):** plan-level 자료 unchanged; comments extended to two new levels.
- **Realtime:** all new writes (subplan-nesting, procon, subplan/option comments) publish the existing decisions change-signal; FE query keys stay under `['decisions', wsId]` so they refresh live; comment keys already fanned out (Phase 2 fix) — verify `subplan:`/`option:` pages invalidate.

## 8. Cleanup (code removed)
Backend: `parent_plan_id` column + `Plan.parentPlanId` + `findAllByParentPlanId*` + `getHierarchy`/`PlanHierarchy*` DTOs + hierarchy controller route; `OptionRating`/`OptionRatingRepository`/`RatingController`/`RatingService`; `promoteSubPlan` + its route/tests; `childCount` roll-up.
Frontend: `SubDecisionSection`, `SubDecisionCanvasNode`, `PlanTreeNavigator`, the zoom-transition CSS + `key={planId}` remount, breadcrumb-to-parent-*plan*, `RatingControl`, `usePlanHierarchy`/promote/move-plan hooks, `resourceIcon` untouched (자료 stays). Story view: swap `childCount` → `subPlanCount` in the dot-cluster.

## 9. Build order (each its own review + deploy)
1. **Backend** — V25 (nested 안건 + option_pro_cons + drop rating + drop parent_plan_id); nested-안건 create + tree/detail responses; pro/con CRUD; comment realtime for subplan/option + purge; retire hierarchy/rating/promote/childCount.
2. **Frontend — structure** — 안건 detail page route + hub; plan page top-level list with foldable 서브안건 + breadcrumb; wire nested-안건 create; remove the retired components + rating; fix story-view dot-cluster.
3. **Frontend — candidate card** — 장점/단점 UI + CRUD wiring; keep 투표; per-candidate + per-안건 댓글 mounts.

Each phase gates on `./gradlew test` (BE) / `tsc -b` + `build` + folder eslint (FE) + per-task review + whole-branch review, then deploy (BE via CD — watch the recurring Docker Hub base-image timeout; FE via Vercel).

## 10. Out of scope (deliberate)
- Migrating existing child-plans/ratings (disposable test data).
- Re-parenting nested 안건 (immutable parent, v1).
- Moving 자료 to 안건/candidate level (stays plan-level).
- Canvas redesign for the nested tree (canvas shows top-level 안건 only for now).
- Per-user reasoning (장점/단점 are shared/collaborative).
