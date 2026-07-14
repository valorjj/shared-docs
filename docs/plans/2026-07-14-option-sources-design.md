# 선택지 자료 (per-candidate sources) — Design

**Date:** 2026-07-14
**Status:** Design (brainstorm complete, awaiting review → plan)

## Goal

Let each **선택지 (candidate)** carry its own **자료 (sources)** — links, uploaded images/screenshots, and files — shown inside the candidate so that a real decision (e.g. a couple choosing a car: each candidate model gathers its dealer link, review video, price screenshot, brochure PDF) can be researched and compared in place. Today a candidate has only 장점/단점 + 댓글; there is no way to attach the evidence a decision is actually built from, and the 결정 pillar gives no visual intuition of that research.

## Context (what already exists)

- **Plan-level 자료** shipped 2026-07-08 (Life Story Board Phase 2, Flyway V24): `plan_resources` (LINK carries url+title; FILE points at a `plan_attachments` row) + `plan_attachments` (mirrors `note_attachments`, same `FileStorageService`, same global 10GB disk guard). `ResourceSection.tsx` renders icon-tinted rows; `PlanResourceService` is deliberately **not** lock-gated; uploads count against a per-user 500MB quota summed across note + plan attachments.
- **Candidate internals** (`OptionResponse`) already embed `proCons: List<ProConResponse>` loaded in the same `GET /api/subplans/{id}` detail fetch. `OptionProConService` is the closest mirror for a new option-scoped CRUD service (lock behavior aside).
- **Realtime**: every Decisions write calls `changes.publish(workspaceId, planId)`; clients re-run `decisionKeys.scope(wsId)` invalidation.
- **Purge paths**: `PlanService.deleteOption` (single option) and `PlanService.deleteSubPlanCascade` (cascade when a 안건/plan is permanently deleted) tear down an option's votes + proCons before the option row (FK RESTRICT).

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Where sources attach | **Per 선택지 (candidate)** only. Not plan- or 안건-level (plan already has 자료). |
| Presentation | **Image/screenshot uploads → thumbnail grid**; links + non-image files → compact icon rows below. |
| Placement in candidate | Sources area sits **above 장점/단점** in the expanded candidate body (gather evidence, then form pros/cons). |
| Collapsed-row hint | A quiet **📎 N** count (Lucide `Paperclip`) next to `장단점 N`, so well-researched candidates are visible while scanning. |
| Lock behavior | **Never lock-gated** — matches plan 자료 ("evidence stays writable after a decision freezes"). |
| Image click | **In-page lightbox** — full-size dismissible overlay; stay on the comparison page. |

## Non-goals (YAGNI)

- No plan- or 안건-level source additions (plan 자료 already covers the umbrella level).
- No link rich-preview fetching (no og:image/title scraping) — a link shows its user-entered title + favicon-style icon row, as plan 자료 does.
- No resource rename UI (mirrors the shipped `PATCH /api/resources/{id}` deferral — endpoint may exist, no caller).
- No drag-reorder of sources; creation order (ascending) is the display order.
- No gallery prev/next in the lightbox for v1 — click a thumbnail, view it, dismiss. (Cheap to add later if wanted.)

## Data model (Flyway V27)

Mirror the plan pattern with **its own tables + clean FKs to `options`** — chosen over generalizing the shipped `plan_resources` (a polymorphic owner would break the single-target FK; a shared table would entangle working plan code). Isolated tables keep FK integrity, a clean cascade, and don't touch shipped code.

```sql
-- V27__option_resources.sql
CREATE TABLE `option_attachments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `option_id` bigint(20) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `content_type` varchar(100) NOT NULL,
  `size_bytes` bigint(20) NOT NULL,
  `stored_filename` varchar(100) NOT NULL,
  `uploaded_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_option_attachments_stored` (`stored_filename`),
  KEY `idx_option_attachments_option` (`option_id`),
  KEY `idx_option_attachments_workspace` (`workspace_id`),
  CONSTRAINT `fk_option_attachments_option` FOREIGN KEY (`option_id`) REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_attachments_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_attachments_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `option_resources` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `option_id` bigint(20) NOT NULL,
  `kind` varchar(10) NOT NULL,          -- LINK | FILE
  `url` varchar(2048) DEFAULT NULL,
  `title` varchar(300) DEFAULT NULL,
  `attachment_id` bigint(20) DEFAULT NULL,
  `created_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_option_resources_option` (`option_id`),
  KEY `idx_option_resources_workspace` (`workspace_id`),
  CONSTRAINT `fk_option_resources_option` FOREIGN KEY (`option_id`) REFERENCES `options` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_resources_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `option_attachments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_option_resources_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Backend components

- **`OptionResourceKind`** enum `{ LINK, FILE }` (its own 2-value enum — keeps the decision module's option-resource code decoupled from `PlanResourceKind`; duplication of two constants is cheaper than cross-coupling the modules).
- **`OptionAttachment`** entity + **`OptionAttachmentRepository`** (`sumSizeBytesByUploadedByUserId`, `findAllById`) — mirror `PlanAttachment`.
- **`OptionResource`** entity + **`OptionResourceRepository`** (`findAllByOptionIdOrderByCreatedAtAsc`, `findAllByOptionIdIn`, `findByIdAndWorkspaceId`).
- **`OptionAttachmentService`** — `upload(workspaceId, optionId, file, uploaderUserId)` and `delete(attachment)`, reusing the shared `FileStorageService`/`FileStorageProperties`. **Quota** = `noteAttachments.sum + planAttachments.sum + optionAttachments.sum` (one physical-disk budget across all three features). To keep the guard honest in every direction, add the `optionAttachments` term to the quota sums in the two existing upload paths as well (`PlanAttachmentService.upload` and the note `AttachmentService` upload) — a small, well-scoped edit to shipped code so no path can silently exceed the shared budget.
- **`OptionResourceService`** — mirrors `PlanResourceService`, **not lock-gated**:
  - `addLink(ws, optionId, actor, CreateLinkResourceRequest)`, `addFile(ws, optionId, actor, MultipartFile)`, `delete(ws, resourceId, actor, role)`.
  - Resolves `planId` via `option → subPlan → plan` (like `OptionProConService.planAndSubPlanOf`) for `changes.publish` and events.
  - Delete permission: author-or-plan-owner-or-admin (same as plan 자료 / proCon).
  - Delete order: delete+flush `option_resources` row **before** its `option_attachments` (attachment FK is RESTRICT), then `storage.delete` — exactly as `PlanResourceService.delete` documents.
  - Records `RESOURCE_ADDED` / `RESOURCE_REMOVED` `PlanEvent`s (reuse existing types; `subPlanId` set) so they appear in 기록, consistent with plan 자료 + proCons. `changes.publish(workspaceId, planId)` after every write.
- **`OptionResourceController`** (`/api`):
  - `POST /api/options/{optionId}/resources` (link, 201), `POST /api/options/{optionId}/resources/file` (upload, 201), `DELETE /api/option-resources/{resourceId}` (204). Distinct `/option-resources/` delete path avoids colliding with the plan `/resources/{id}` route.
  - No list endpoint — sources ride along in the subplan detail (below).
- **`OptionResponse.resources: List<OptionResourceResponse>`** added; `OptionResourceResponse` mirrors `PlanResourceResponse` (`id, optionId, kind, url, title, attachmentId, originalFilename, contentType, sizeBytes, fileUrl, createdByUserId, createdAt`). `contentType` is what the FE uses to decide image-vs-row.
- **`getSubPlanDetail`** (and anywhere `OptionResponse` is built): batch-load resources by `findAllByOptionIdIn(optionIds)` + their attachments by id, and thread into `Option.toResponse(proCons, resources)` — same shape as the existing proCon batch-load, no N+1.
- **Purge**: add option-resource cleanup (resources+flush → attachments+files) to both `deleteOption` and `deleteSubPlanCascade`, before `optionRepository.delete(...)`.

## Frontend components

- **`types.ts`**: `OptionResource` (mirror `PlanResource`); add `resources: OptionResource[]` to `OptionNode`.
- **`api.ts`**: `useAddOptionLinkResource(optionId)`, `useUploadOptionResourceFile(optionId)`, `useDeleteOptionResource()` — all `invalidate(decisionKeys.scope)` on success (the detail refetch carries the new `resources`). Reuse `CreateLinkResourceRequest` shape + `LinkResourceModal`.
- **`OptionResourceSection.tsx`** (new; own `.module.css`): given `optionId` + `resources` + `locked`(ignored for gating; always writable):
  - **Thumbnail grid** for `resources` whose `contentType` starts with `image/` — `<img>` (thumbnail size, `object-fit: cover`, lazy) sourced from `absoluteFileUrl(fileUrl)`; click opens the lightbox.
  - **Icon rows** for LINK + non-image FILE, reusing `resourceIconSpec` + the row styling from `ResourceSection`.
  - `+ 링크` / `+ 파일` add buttons (mirror `ResourceSection` header actions); delete via a per-item control with `ConfirmDialog`.
  - Empty state omitted when empty (the `+ 링크 / + 파일` affordance is enough; avoid an "아직 자료가 없어요" line per candidate — too noisy across many candidates).
- **`ImageLightbox.tsx`** (new, minimal, in `components/ui` — reusable): `createPortal` overlay, dark scrim, the image centered `max-w/h`, closes on backdrop click / Esc / close button. Single image (the one clicked). No gallery nav in v1.
- **`OptionRow.tsx`**: render `<OptionResourceSection>` at the top of the expanded `.body`, above `<ProConSection>`. On the collapsed head, add a quiet `📎 {resources.length}` indicator (styled like `.proConCount`) when `resources.length > 0`.

## Data flow

1. User expands a candidate → `+ 파일` → picks a screenshot → `useUploadOptionResourceFile` POSTs multipart → `OptionAttachmentService.upload` (quota check) + `OptionResourceService.addFile` saves the resource + records event + `changes.publish`.
2. Mutation `onSuccess` invalidates `decisionKeys.scope` → `GET /api/subplans/{id}` refetches → `OptionResponse.resources` now includes the image → thumbnail appears. Other viewers get the same via the WS change-signal.
3. Click thumbnail → `ImageLightbox` opens with `absoluteFileUrl(fileUrl)`.
4. Delete → `ConfirmDialog` → `useDeleteOptionResource` → `DELETE /api/option-resources/{id}` → resource row + attachment + disk file removed (FK-safe order) → refetch.

## Testing

- **Backend** (`OptionResourceServiceTest`, mirror `PlanResourceServiceTest` if present): add link; add file (attachment created, quota enforced → `ResourceQuotaExceededException`); delete removes resource + attachment + calls `storage.delete`; **not lock-gated** (add/delete succeed on a locked plan / decided 안건); delete permission (non-author non-owner → forbidden); cascade — `deleteOption` and permanent plan/subplan delete purge option resources + attachments (no FK violation, disk files removed). `ddl-auto: validate` passes against V27.
- **Frontend**: `npm run build` (authoritative gate) + `eslint` on touched folders green. Manual: upload image → thumbnail; add link → row; lightbox open/close; collapsed 📎 count; delete flow; realtime in a second browser.

## Deploy

FE → Vercel; BE → push to `main` → Mac Mini CD applies Flyway V27. Verify locally: `docker logs shared-docs-backend | grep flyway` → `now at version v27`; `curl :8090/actuator/health` → UP.
