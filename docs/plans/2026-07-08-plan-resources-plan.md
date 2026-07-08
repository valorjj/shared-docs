# Plan Resources — 자료+댓글 (Life Story Board Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every decision (계획 or 하위결정) gets a **자료** section (links + file attachments, Lucide icon tiles by kind) and a **댓글** section (flat comments, reusing the existing generic Comment feature), both writable even when the plan is locked, both purged when a plan is permanently deleted, both live over the existing decisions realtime channel.

**Architecture:** `plan_attachments` mirrors the shipped `note_attachments` stack exactly at the storage layer (same `FileStorageService`, same global 10GB disk guard, same per-user 500MB quota — now summed across both tables). `plan_resources` is a new decision-module entity (LINK | FILE) that either carries a URL directly or points at a `plan_attachments` row. Comments need **zero schema change** — `Comment.pageId` is already a free-text column; the convention is simply `pageId = "plan:{planId}"`, reusing the shipped generic Comment CRUD as-is. The public `/files/{storedFilename}` endpoint gains a second lookup so plan-attachment downloads get correct headers. Every plan-resource + plan-scoped-comment write publishes the existing `DecisionChangePublisher` signal, so the shipped WS channel and `decisionKeys.scope` invalidation cover it for free.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + Flyway (`shared-docs-backend`); Vite + React 19 + TS + React Query (`shared-docs`).

**Design spec:** `shared-docs/docs/plans/2026-07-08-life-story-board-design.md` (§4 V24, §5 API, §6 UX icon system, §7 lock/trash rules).

## Global Constraints

- Two repos: BE tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend`, FE tasks in `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs`.
- All UI text Korean; icons are lucide-react only (never emoji).
- CSS Modules + tokens from `src/components/ui/tokens.css` — no hardcoded hex. Cards never lift (hairline `--c-border`, `--c-surface-tint` hover, no shadow). The one deliberate exception: `Comments.tsx`/`Comments.css` is pre-existing global CSS (not a Module) — Task 8 overrides its card chrome via a `:global()` selector inside a CSS Module, a defensible one-time adapter for pre-existing debt, not new debt.
- Frontend gates: `npx tsc -b --noEmit` and `npm run build`; lint only touched folders (`npx eslint src/features/decisions/`).
- Backend gate: `./gradlew test` (baseline: 244 tests green on `main` post-Phase-1). Single class: `./gradlew test --tests "com.shareddocs.backend.decision.<Class>"`.
- **자료 and 댓글 are NEVER lock-guarded** — a locked plan freezes 안건/선택지/결정 only; the conversation about it stays writable. Do not add `lockGuard` calls to any resource/comment code path.
- Foreign-workspace ids 404 (`PlanNotFoundException`/new `PlanResourceNotFoundException`), never 403. Permission denials (wrong user, not admin) ARE 403 (`ApiException` subclass), matching `AttachmentService`/`CommentService` precedent.
- Every plan-resource mutation ends with `changes.publish(workspaceId, planId)` (constructor param name `changes: DecisionChangePublisher`, exact call `changes.publish(workspaceId, planId)`).
- `PlanEventType` is `varchar(40)` — keep new names within that.
- Commit after each task, conventional commits (`feat(decisions): …`).

---

### Task 1: `plan_attachments` storage layer (V24 part 1) + `FileController` extension

**Files:**
- Create: `src/main/resources/db/migration/V24__plan_resources.sql` (both tables — this task uses only the `plan_attachments` half; Task 2 adds `plan_resources` rows via the same file, already migrated)
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanAttachment.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanAttachmentRepository.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanAttachmentService.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt` (add `ResourceQuotaExceededException`)
- Modify: `src/main/kotlin/com/shareddocs/backend/note/FileController.kt` (resolve plan attachments too)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanAttachmentServiceTest.kt`

**Interfaces:**
- Consumes: `com.shareddocs.backend.note.FileStorageService` (`store(file): StoredFile`, `delete(storedFilename)`), `com.shareddocs.backend.note.FileStorageProperties` (`perUserQuotaBytes`), `com.shareddocs.backend.note.AttachmentRepository.sumSizeBytesByUploadedByUserId(userId): Long` (existing, cross-package import).
- Produces: `PlanAttachment` entity (`id`, `workspaceId`, `planId`, `originalFilename`, `contentType`, `sizeBytes`, `storedFilename`, `uploadedByUserId`, extends `BaseEntity`), `PlanAttachmentRepository.findAllByPlanId(planId): List<PlanAttachment>`, `.findByStoredFilename(storedFilename): PlanAttachment?`, `.sumSizeBytesByUploadedByUserId(userId): Long`, `PlanAttachmentService.upload(workspaceId, planId, file: MultipartFile, uploaderUserId): PlanAttachment`, `PlanAttachmentService.delete(attachment: PlanAttachment)`. Tasks 2 and 4 depend on all of these.

**Design note for the implementer:** `PlanAttachment` deliberately does **not** mirror `note.Attachment` byte-for-byte. `note.Attachment` uses `@ManyToOne` to `Note` and hand-rolled `id`/`createdAt` because it lives in the `note` package's convention. `PlanAttachment` lives in the `decision` package, where every sibling entity (`SubPlan`, `Option`, `Decision`, `OptionVote`) uses a plain `Long` FK column plus a direct `workspaceId` column plus `BaseEntity` — follow that convention instead, for consistency with the module it actually lives in.

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanAttachmentServiceTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.note.FileController
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = ["app.storage.per-user-quota-bytes=100"])
class PlanAttachmentServiceTest(
    @Autowired private val service: PlanAttachmentService,
    @Autowired private val attachments: PlanAttachmentRepository,
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val fileController: FileController,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )
    private fun file(bytes: Int, name: String = "a.txt", contentType: String = "text/plain") =
        MockMultipartFile("file", name, contentType, ByteArray(bytes))

    @Test
    fun `upload stores the file and persists a PlanAttachment row`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        val saved = service.upload(ws.id!!, plan.id, file(10, "견적서.pdf", "application/pdf"), owner.id!!)

        assertEquals("견적서.pdf", saved.originalFilename)
        assertEquals("application/pdf", saved.contentType)
        assertEquals(10L, saved.sizeBytes)
        assertEquals(plan.id, saved.planId)
        assertEquals(1, attachments.findAllByPlanId(plan.id).size)
    }

    @Test
    fun `upload rejects when the combined note+plan attachment quota is exceeded`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        service.upload(ws.id!!, plan.id, file(60), owner.id!!)
        val ex = assertThrows(ResourceQuotaExceededException::class.java) {
            service.upload(ws.id!!, plan.id, file(60), owner.id!!)
        }
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.status)
    }

    @Test
    fun `delete removes the row and the file no longer resolves via FileController`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val saved = service.upload(ws.id!!, plan.id, file(10), owner.id!!)

        service.delete(saved)

        assertEquals(emptyList<PlanAttachment>(), attachments.findAllByPlanId(plan.id))
        assertEquals(404, fileController.serve(saved.storedFilename).statusCode.value())
    }

    @Test
    fun `FileController resolves a plan attachment's real content-type and filename`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val saved = service.upload(ws.id!!, plan.id, file(10, "계약서.pdf", "application/pdf"), owner.id!!)

        val response = fileController.serve(saved.storedFilename)

        assertEquals(HttpStatus.OK, response.statusCode)
        assertEquals("application/pdf", response.headers.contentType?.toString())
        assertEquals(
            "inline; filename=\"계약서.pdf\"",
            response.headers.getFirst(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION),
        )
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanAttachmentServiceTest"`
Expected: COMPILE FAILURE — `PlanAttachmentService`, `PlanAttachmentRepository`, `ResourceQuotaExceededException` unresolved.

- [ ] **Step 3: Migration + entity + repository + service + exception + FileController**

Create `src/main/resources/db/migration/V24__plan_resources.sql`:

```sql
-- 자료 (Plan resources) — Life Story Board Phase 2.
-- plan_attachments mirrors note_attachments (same FileStorageService, same
-- global 10GB disk guard); plan_resources is the umbrella row (LINK carries
-- a URL directly, FILE points at a plan_attachments row). Comments need no
-- schema change — pageId "plan:{id}" is a plain string on the existing table.
CREATE TABLE `plan_attachments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `plan_id` bigint(20) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `content_type` varchar(100) NOT NULL,
  `size_bytes` bigint(20) NOT NULL,
  `stored_filename` varchar(100) NOT NULL,
  `uploaded_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_plan_attachments_stored` (`stored_filename`),
  KEY `idx_plan_attachments_plan` (`plan_id`),
  KEY `idx_plan_attachments_workspace` (`workspace_id`),
  CONSTRAINT `fk_plan_attachments_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_attachments_uploader` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_attachments_workspace` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plan_resources` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `version` bigint(20) NOT NULL DEFAULT 0,
  `workspace_id` bigint(20) NOT NULL,
  `plan_id` bigint(20) NOT NULL,
  `kind` varchar(10) NOT NULL,
  `url` varchar(2048) DEFAULT NULL,
  `title` varchar(300) DEFAULT NULL,
  `attachment_id` bigint(20) DEFAULT NULL,
  `created_by_user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_plan_resources_plan` (`plan_id`),
  KEY `idx_plan_resources_workspace` (`workspace_id`),
  CONSTRAINT `fk_plan_resources_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_resources_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `plan_attachments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_plan_resources_creator` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

`PlanAttachment.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table

/** A file stored for a 계획's 자료 section. Mirrors note.Attachment at the
 *  storage layer (same FileStorageService/quota) but follows THIS module's
 *  convention (plain Long FK + direct workspaceId + BaseEntity) rather than
 *  note.Attachment's @ManyToOne/hand-rolled-id shape. */
@Entity
@Table(
    name = "plan_attachments",
    indexes = [
        Index(name = "idx_plan_attachments_plan", columnList = "plan_id"),
        Index(name = "idx_plan_attachments_stored", columnList = "stored_filename", unique = true),
    ],
)
class PlanAttachment(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,

    @Column(name = "original_filename", nullable = false, length = 255)
    var originalFilename: String,

    @Column(name = "content_type", nullable = false, length = 100)
    var contentType: String,

    @Column(name = "size_bytes", nullable = false)
    var sizeBytes: Long,

    @Column(name = "stored_filename", nullable = false, length = 100, unique = true, updatable = false)
    val storedFilename: String,

    @Column(name = "uploaded_by_user_id", nullable = false, updatable = false)
    val uploadedByUserId: Long,
) : BaseEntity()
```

`PlanAttachmentRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface PlanAttachmentRepository : JpaRepository<PlanAttachment, Long> {
    fun findAllByPlanId(planId: Long): List<PlanAttachment>
    fun findByStoredFilename(storedFilename: String): PlanAttachment?

    @Query("SELECT COALESCE(SUM(a.sizeBytes), 0) FROM PlanAttachment a WHERE a.uploadedByUserId = :userId")
    fun sumSizeBytesByUploadedByUserId(@Param("userId") userId: Long): Long
}
```

`PlanAttachmentService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.note.AttachmentRepository
import com.shareddocs.backend.note.FileStorageProperties
import com.shareddocs.backend.note.FileStorageService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

/**
 * Storage layer for 자료 file uploads. The per-user 500MB quota is checked
 * against the SUM of note attachments AND plan attachments — a single
 * physical-disk budget shared by both features, since they share the same
 * FileStorageService/upload directory (and thus the same global 10GB guard
 * inside FileStorageService.store() for free).
 */
@Service
@Transactional
class PlanAttachmentService(
    private val planAttachments: PlanAttachmentRepository,
    private val noteAttachments: AttachmentRepository,
    private val storage: FileStorageService,
    private val properties: FileStorageProperties,
) {
    fun upload(workspaceId: Long, planId: Long, file: MultipartFile, uploaderUserId: Long): PlanAttachment {
        val used = noteAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId) +
            planAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId)
        if (used + file.size > properties.perUserQuotaBytes) {
            throw ResourceQuotaExceededException()
        }
        val stored = storage.store(file)
        return planAttachments.save(
            PlanAttachment(
                workspaceId = workspaceId,
                planId = planId,
                originalFilename = stored.originalFilename,
                contentType = stored.contentType,
                sizeBytes = stored.sizeBytes,
                storedFilename = stored.storedFilename,
                uploadedByUserId = uploaderUserId,
            ),
        )
    }

    fun delete(attachment: PlanAttachment) {
        storage.delete(attachment.storedFilename)
        planAttachments.delete(attachment)
    }
}
```

`DecisionExceptions.kt` — add:

```kotlin
class ResourceQuotaExceededException :
    ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "resource-quota-exceeded", "Storage quota exceeded", "저장 용량을 초과했어요.")
```

`FileController.kt` — full replacement (adds the `planAttachments` constructor param and a second lookup):

```kotlin
package com.shareddocs.backend.note

import com.shareddocs.backend.decision.PlanAttachmentRepository
import org.springframework.core.io.UrlResource
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Duration

@RestController
@RequestMapping("/files")
class FileController(
    private val storage: FileStorageService,
    private val attachments: AttachmentRepository,
    private val planAttachments: PlanAttachmentRepository,
) {
    @GetMapping("/{storedFilename:.+}")
    fun serve(@PathVariable storedFilename: String): ResponseEntity<UrlResource> {
        val path = storage.resolve(storedFilename) ?: return ResponseEntity.notFound().build()
        val resource = UrlResource(path.toUri())
        if (!resource.exists() || !resource.isReadable) {
            return ResponseEntity.notFound().build()
        }
        val noteAttachment = attachments.findByStoredFilename(storedFilename)
        val planAttachment = if (noteAttachment == null) planAttachments.findByStoredFilename(storedFilename) else null
        val contentType = noteAttachment?.contentType ?: planAttachment?.contentType ?: MediaType.APPLICATION_OCTET_STREAM_VALUE
        val originalFilename = noteAttachment?.originalFilename ?: planAttachment?.originalFilename ?: storedFilename
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=\"${originalFilename.replace("\"", "")}\"",
            )
            .body(resource)
    }
}
```

Note: this is a `note` package file importing a `decision` package repository — an accepted cross-package wrinkle (the alternative, relocating `FileController` to a shared package, is out of scope/YAGNI for a two-line lookup addition).

- [ ] **Step 4: Run the new class, then the whole suite**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanAttachmentServiceTest"` → PASS (4 tests)
Run: `./gradlew test` → PASS (244 existing + 4).

- [ ] **Step 5: Commit**

```bash
git add src/main/resources/db/migration/V24__plan_resources.sql src/main/kotlin/com/shareddocs/backend/decision/PlanAttachment.kt src/main/kotlin/com/shareddocs/backend/decision/PlanAttachmentRepository.kt src/main/kotlin/com/shareddocs/backend/decision/PlanAttachmentService.kt src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt src/main/kotlin/com/shareddocs/backend/note/FileController.kt src/test/kotlin/com/shareddocs/backend/decision/PlanAttachmentServiceTest.kt
git commit -m "feat(decisions): plan_attachments storage layer (V24) + FileController plan-attachment resolution"
```

---

### Task 2: `plan_resources` CRUD (LINK + FILE) + events + realtime

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanResource.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanResourceRepository.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanResourceDto.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanResourceService.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/decision/PlanResourceController.kt`
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt` (add `RESOURCE_ADDED`, `RESOURCE_REMOVED`)
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt` (add `PlanResourceNotFoundException`, `PlanResourceForbiddenException`)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanResourceServiceTest.kt`

**Interfaces:**
- Consumes: Task 1's `PlanAttachment`, `PlanAttachmentRepository`, `PlanAttachmentService`; `PlanRepository.findByIdAndWorkspaceId`; `PlanEventRecorder.record(workspaceId, planId, subPlanId, type, actorUserId, payload)`; `DecisionChangePublisher.publish(workspaceId, planId)`.
- Produces: `PlanResourceKind` enum, `PlanResource` entity, `PlanResourceRepository.findAllByPlanId(planId)`, `.findAllByPlanIdOrderByCreatedAtAsc(planId)`, `.findByIdAndWorkspaceId(id, workspaceId)`, `PlanResourceResponse` DTO, `PlanResourceService.list/addLink/addFile/updateTitle/delete`. Task 4 depends on `PlanResourceRepository.findAllByPlanId` and `PlanResourceService`'s attachment-cleanup shape.

**Scope note:** `updateTitle`/`PATCH /api/resources/{id}` is built and tested here, but Task 7 does **not** wire a rename UI to it — this mirrors an existing precedent in this exact codebase (`useUpdateComment` in `src/api/comments.ts` exists and is fully wired backend-to-hook, but has zero UI caller; editing existing content is consistently deferred past first ship here). Renaming a 자료 row is a natural follow-up, not a gap in this task.

**Trash note:** `requirePlan` below deliberately uses the same (non-`deletedAt`-filtered) lookup that `PlanService`'s own `requireSubPlan`/`requireOption` helpers use for 안건/선택지 mutations — NOT the stricter `findByIdAndWorkspaceIdAndDeletedAtIsNull` that `getTree`/`getHierarchy` use for reads. This matches the module's existing convention (mutation helpers reach trashed rows; only tree/hierarchy reads filter them out) rather than inventing a new, stricter rule. In practice a trashed plan is unreachable from the FE anyway, since its `getTree`/`getHierarchy` calls already 404 and no route renders it.

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanResourceServiceTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanResourceServiceTest(
    @Autowired private val service: PlanResourceService,
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val planEventRepository: PlanEventRepository,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `addLink then list returns the link with its title`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        val created = service.addLink(ws.id!!, plan.id, owner.id!!, CreateLinkResourceRequest(url = "https://youtu.be/abc", title = "후기 영상"))

        assertEquals("LINK", created.kind)
        assertEquals("후기 영상", created.title)
        val list = service.list(ws.id!!, plan.id)
        assertEquals(listOf(created.id), list.map { it.id })
    }

    @Test
    fun `addFile persists an attachment and the resource carries file metadata`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val file = MockMultipartFile("file", "견적서.pdf", "application/pdf", ByteArray(10))

        val created = service.addFile(ws.id!!, plan.id, owner.id!!, file)

        assertEquals("FILE", created.kind)
        assertEquals("견적서.pdf", created.originalFilename)
        assertEquals(10L, created.sizeBytes)
        assertTrue(created.fileUrl!!.startsWith("/files/"))
    }

    @Test
    fun `resources are addable on a locked plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        planService.lock(ws.id!!, plan.id, owner.id!!)

        val created = service.addLink(ws.id!!, plan.id, owner.id!!, CreateLinkResourceRequest(url = "https://a.com"))

        assertEquals("LINK", created.kind)
    }

    @Test
    fun `a non-author non-owner member cannot delete another member's resource`() {
        val owner = newUser()
        val other = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        workspaces.addMember(ws.id!!, other.id!!)
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val created = service.addLink(ws.id!!, plan.id, other.id!!, CreateLinkResourceRequest(url = "https://a.com"))
        val third = newUser()
        workspaces.addMember(ws.id!!, third.id!!)

        assertThrows(PlanResourceForbiddenException::class.java) {
            service.delete(ws.id!!, created.id, third.id!!, Role.USER)
        }
    }

    @Test
    fun `the plan owner can delete a resource added by someone else`() {
        val owner = newUser()
        val other = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        workspaces.addMember(ws.id!!, other.id!!)
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val created = service.addLink(ws.id!!, plan.id, other.id!!, CreateLinkResourceRequest(url = "https://a.com"))

        service.delete(ws.id!!, created.id, owner.id!!, Role.USER)

        assertEquals(emptyList<Any>(), service.list(ws.id!!, plan.id))
    }

    @Test
    fun `addLink and delete record RESOURCE_ADDED and RESOURCE_REMOVED on the plan`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val created = service.addLink(ws.id!!, plan.id, owner.id!!, CreateLinkResourceRequest(url = "https://a.com", title = "T"))

        service.delete(ws.id!!, created.id, owner.id!!, Role.USER)

        val types = planEventRepository.findAllByPlanIdOrderByCreatedAtDesc(plan.id).map { it.type }
        assertTrue(PlanEventType.RESOURCE_ADDED in types)
        assertTrue(PlanEventType.RESOURCE_REMOVED in types)
    }
}
```

Note for the implementer: `workspaces.addMember(...)` — verify the exact method name/signature on `WorkspaceService` (grep existing multi-member tests, e.g. in `workspace` test package or `PlanPresenceHandshakeTest`, which already exercises multiple members in one workspace) and adjust the two calls if the real signature differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanResourceServiceTest"`
Expected: COMPILE FAILURE — `PlanResourceService`, `CreateLinkResourceRequest`, `PlanResourceForbiddenException` unresolved.

- [ ] **Step 3: Implement**

`PlanEnums.kt` — add:

```kotlin
    RESOURCE_ADDED,
    RESOURCE_REMOVED,
```

`PlanResource.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Index
import jakarta.persistence.Table

enum class PlanResourceKind { LINK, FILE }

/** 자료 — a link or file attached to a 계획, never lock-guarded (the
 *  conversation about a decision stays writable after it's frozen). */
@Entity
@Table(
    name = "plan_resources",
    indexes = [
        Index(name = "idx_plan_resources_plan", columnList = "plan_id"),
        Index(name = "idx_plan_resources_workspace", columnList = "workspace_id"),
    ],
)
class PlanResource(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "plan_id", nullable = false, updatable = false)
    val planId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    val kind: PlanResourceKind,

    @Column(length = 2048, updatable = false)
    var url: String? = null,

    @Column(length = 300)
    var title: String? = null,

    @Column(name = "attachment_id", updatable = false)
    val attachmentId: Long? = null,

    @Column(name = "created_by_user_id", nullable = false, updatable = false)
    val createdByUserId: Long,
) : BaseEntity()
```

`PlanResourceRepository.kt`:

```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface PlanResourceRepository : JpaRepository<PlanResource, Long> {
    fun findAllByPlanIdOrderByCreatedAtAsc(planId: Long): List<PlanResource>
    fun findAllByPlanId(planId: Long): List<PlanResource>
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): PlanResource?
}
```

`PlanResourceDto.kt`:

```kotlin
package com.shareddocs.backend.decision

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant

data class PlanResourceResponse(
    val id: Long,
    val planId: Long,
    val kind: String,
    val url: String?,
    val title: String?,
    val attachmentId: Long?,
    val originalFilename: String?,
    val contentType: String?,
    val sizeBytes: Long?,
    val fileUrl: String?,
    val createdByUserId: Long,
    val createdAt: Instant,
)

data class CreateLinkResourceRequest(
    @field:NotBlank @field:Size(max = 2048) val url: String,
    @field:Size(max = 300) val title: String? = null,
)

data class UpdateResourceTitleRequest(
    @field:Size(max = 300) val title: String? = null,
)
```

`PlanResourceService.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

/**
 * 자료 CRUD. Deliberately NOT lock-guarded anywhere in this service — a
 * locked plan freezes 안건/선택지/결정 only; evidence and conversation about
 * the decision stay writable. Delete/rename permission is author-or-plan-
 * owner-or-admin (broader than Comment's author-or-admin, since 자료 rows
 * have no independent identity outside the plan they document).
 */
@Service
@Transactional
class PlanResourceService(
    private val resources: PlanResourceRepository,
    private val planRepository: PlanRepository,
    private val planAttachments: PlanAttachmentRepository,
    private val attachmentService: PlanAttachmentService,
    private val events: PlanEventRecorder,
    private val changes: DecisionChangePublisher,
) {
    @Transactional(readOnly = true)
    fun list(workspaceId: Long, planId: Long): List<PlanResourceResponse> {
        requirePlan(workspaceId, planId)
        val list = resources.findAllByPlanIdOrderByCreatedAtAsc(planId)
        val attachmentIds = list.mapNotNull { it.attachmentId }
        val attachmentsById = if (attachmentIds.isEmpty()) emptyMap()
            else planAttachments.findAllById(attachmentIds).associateBy { it.id!! }
        return list.map { it.toResponse(attachmentsById[it.attachmentId]) }
    }

    fun addLink(workspaceId: Long, planId: Long, actorUserId: Long, request: CreateLinkResourceRequest): PlanResourceResponse {
        val plan = requirePlan(workspaceId, planId)
        val resource = resources.save(
            PlanResource(
                workspaceId = workspaceId,
                planId = planId,
                kind = PlanResourceKind.LINK,
                url = request.url.trim(),
                title = request.title?.trim()?.ifBlank { null },
                createdByUserId = actorUserId,
            ),
        )
        recordAdded(workspaceId, plan, resource.title ?: resource.url ?: "링크", actorUserId)
        return resource.toResponse(null)
    }

    fun addFile(workspaceId: Long, planId: Long, actorUserId: Long, file: MultipartFile): PlanResourceResponse {
        val plan = requirePlan(workspaceId, planId)
        val attachment = attachmentService.upload(workspaceId, planId, file, actorUserId)
        val resource = resources.save(
            PlanResource(
                workspaceId = workspaceId,
                planId = planId,
                kind = PlanResourceKind.FILE,
                attachmentId = attachment.id,
                createdByUserId = actorUserId,
            ),
        )
        recordAdded(workspaceId, plan, attachment.originalFilename, actorUserId)
        return resource.toResponse(attachment)
    }

    fun updateTitle(workspaceId: Long, resourceId: Long, actorUserId: Long, actorRole: Role, request: UpdateResourceTitleRequest): PlanResourceResponse {
        val resource = requireResource(workspaceId, resourceId)
        val plan = requirePlan(workspaceId, resource.planId)
        requireCanMutate(resource, plan, actorUserId, actorRole)
        resource.title = request.title?.trim()?.ifBlank { null }
        changes.publish(workspaceId, resource.planId)
        val attachment = resource.attachmentId?.let { planAttachments.findById(it).orElse(null) }
        return resource.toResponse(attachment)
    }

    fun delete(workspaceId: Long, resourceId: Long, actorUserId: Long, actorRole: Role) {
        val resource = requireResource(workspaceId, resourceId)
        val plan = requirePlan(workspaceId, resource.planId)
        requireCanMutate(resource, plan, actorUserId, actorRole)
        val label = if (resource.kind == PlanResourceKind.FILE) {
            val attachment = resource.attachmentId?.let { planAttachments.findById(it).orElse(null) }
            attachment?.let { attachmentService.delete(it) }
            attachment?.originalFilename ?: "파일"
        } else {
            resource.title ?: resource.url ?: "링크"
        }
        resources.delete(resource)
        events.record(
            workspaceId = workspaceId, planId = plan.id!!, subPlanId = null,
            type = PlanEventType.RESOURCE_REMOVED, actorUserId = actorUserId,
            payload = mapOf("title" to label),
        )
        changes.publish(workspaceId, plan.id)
    }

    private fun recordAdded(workspaceId: Long, plan: Plan, label: String, actorUserId: Long) {
        events.record(
            workspaceId = workspaceId, planId = plan.id!!, subPlanId = null,
            type = PlanEventType.RESOURCE_ADDED, actorUserId = actorUserId,
            payload = mapOf("title" to label),
        )
        changes.publish(workspaceId, plan.id)
    }

    private fun requirePlan(workspaceId: Long, planId: Long): Plan =
        planRepository.findByIdAndWorkspaceId(planId, workspaceId) ?: throw PlanNotFoundException()

    private fun requireResource(workspaceId: Long, resourceId: Long): PlanResource =
        resources.findByIdAndWorkspaceId(resourceId, workspaceId) ?: throw PlanResourceNotFoundException()

    private fun requireCanMutate(resource: PlanResource, plan: Plan, actorUserId: Long, actorRole: Role) {
        val isAuthor = resource.createdByUserId == actorUserId
        val isPlanOwner = plan.createdByUserId == actorUserId
        val isAdmin = actorRole.isAtLeastAdmin()
        if (!isAuthor && !isPlanOwner && !isAdmin) throw PlanResourceForbiddenException()
    }
}

private fun PlanResource.toResponse(attachment: PlanAttachment?) = PlanResourceResponse(
    id = id!!, planId = planId, kind = kind.name, url = url, title = title,
    attachmentId = attachmentId,
    originalFilename = attachment?.originalFilename, contentType = attachment?.contentType,
    sizeBytes = attachment?.sizeBytes,
    fileUrl = attachment?.let { "/files/${it.storedFilename}" },
    createdByUserId = createdByUserId, createdAt = createdAt!!,
)
```

`DecisionExceptions.kt` — add:

```kotlin
class PlanResourceNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "plan-resource-not-found", "Resource not found", "자료를 찾을 수 없어요.")
class PlanResourceForbiddenException :
    ApiException(HttpStatus.FORBIDDEN, "plan-resource-forbidden", "Not allowed", "작성자 또는 계획 생성자만 삭제/수정할 수 있어요.")
```

`PlanResourceController.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.workspace.CurrentWorkspace
import com.shareddocs.backend.workspace.Workspace
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api")
class PlanResourceController(
    private val service: PlanResourceService,
) {
    @GetMapping("/plans/{planId}/resources")
    fun list(@CurrentWorkspace ws: Workspace, @PathVariable planId: Long): List<PlanResourceResponse> =
        service.list(ws.id!!, planId)

    @PostMapping("/plans/{planId}/resources")
    fun addLink(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
        @Valid @RequestBody request: CreateLinkResourceRequest,
    ): ResponseEntity<PlanResourceResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addLink(ws.id!!, planId, me.userId, request))

    @PostMapping("/plans/{planId}/resources/file")
    fun addFile(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable planId: Long,
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<PlanResourceResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addFile(ws.id!!, planId, me.userId, file))

    @PatchMapping("/resources/{resourceId}")
    fun updateTitle(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable resourceId: Long,
        @Valid @RequestBody request: UpdateResourceTitleRequest,
    ): PlanResourceResponse = service.updateTitle(ws.id!!, resourceId, me.userId, me.role, request)

    @DeleteMapping("/resources/{resourceId}")
    fun delete(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable resourceId: Long,
    ): ResponseEntity<Void> {
        service.delete(ws.id!!, resourceId, me.userId, me.role)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanResourceServiceTest"` → PASS (6 tests)
Run: `./gradlew test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanResource.kt src/main/kotlin/com/shareddocs/backend/decision/PlanResourceRepository.kt src/main/kotlin/com/shareddocs/backend/decision/PlanResourceDto.kt src/main/kotlin/com/shareddocs/backend/decision/PlanResourceService.kt src/main/kotlin/com/shareddocs/backend/decision/PlanResourceController.kt src/main/kotlin/com/shareddocs/backend/decision/PlanEnums.kt src/main/kotlin/com/shareddocs/backend/decision/DecisionExceptions.kt src/test/kotlin/com/shareddocs/backend/decision/PlanResourceServiceTest.kt
git commit -m "feat(decisions): plan_resources CRUD (LINK+FILE) with RESOURCE_ADDED/REMOVED events"
```

---

### Task 3: Comment realtime hook for `plan:{id}` pages

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/comment/CommentService.kt`
- Modify: `src/test/kotlin/com/shareddocs/backend/decision/DecisionChangeCoverageTest.kt`

**Interfaces:**
- Consumes: `DecisionChangePublisher.publish(workspaceId, planId)` (cross-package import from `decision`).
- Produces: no new public API — `CommentService.create/update/delete` now additionally publish the decisions change-signal when `pageId` matches `plan:{digits}`.

- [ ] **Step 1: Write the failing test**

In `src/test/kotlin/com/shareddocs/backend/decision/DecisionChangeCoverageTest.kt`, find the primary constructor:

```kotlin
class DecisionChangeCoverageTest(
    @Autowired private val planService: PlanService,
    @Autowired private val voteService: VoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val recorder: Recorder,
) {
```

Add one line so it reads:

```kotlin
class DecisionChangeCoverageTest(
    @Autowired private val planService: PlanService,
    @Autowired private val voteService: VoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val recorder: Recorder,
    @Autowired private val commentService: com.shareddocs.backend.comment.CommentService,
) {
```

Then, after the existing `` `plan create, subplan add, option add, and vote each emit exactly one change`() `` test method's closing brace (still inside the class, before the class's own final closing brace), add this new test method:

```kotlin
    @Test
    fun `a comment on a plan page publishes the change signal; other pages don't`() {
        val owner = user()
        val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(8)}")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))

        recorder.events.clear()
        val comment = commentService.create(
            com.shareddocs.backend.comment.CreateCommentRequest(pageId = "plan:${plan.id}", content = "hi"),
            ws.id!!, owner.id!!,
        )
        assertEquals(1, recorder.events.size)
        assertEquals(plan.id, recorder.events.single().planId)

        recorder.events.clear()
        commentService.update(comment.id, com.shareddocs.backend.comment.UpdateCommentRequest(content = "hi2"), ws.id!!, owner.id!!)
        assertEquals(1, recorder.events.size)
        assertEquals(plan.id, recorder.events.single().planId)

        recorder.events.clear()
        commentService.delete(comment.id, ws.id!!, owner.id!!, com.shareddocs.backend.user.Role.USER)
        assertEquals(1, recorder.events.size)
        assertEquals(plan.id, recorder.events.single().planId)

        recorder.events.clear()
        commentService.create(
            com.shareddocs.backend.comment.CreateCommentRequest(pageId = "note-1", content = "hi"),
            ws.id!!, owner.id!!,
        )
        assertEquals(0, recorder.events.size)
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionChangeCoverageTest"`
Expected: FAIL (compiles fine — `CommentService` and its DTOs already exist — but the new assertions on `plan:{id}` pages fail because nothing publishes yet: `recorder.events.size` is 0 where 1 is expected).

- [ ] **Step 3: Implement**

`CommentService.kt` — add the publisher dependency and a parse-and-publish helper, called at the end of `create`, `update`, and `delete` (not `listByPage`, which is read-only):

```kotlin
package com.shareddocs.backend.comment

import com.shareddocs.backend.decision.DecisionChangePublisher
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
@Transactional
class CommentService(
    private val repository: CommentRepository,
    private val userRepository: UserRepository,
    private val changes: DecisionChangePublisher,
) {
    @Transactional(readOnly = true)
    fun listByPage(pageId: String, workspaceId: Long): List<CommentResponse> =
        repository.findByWorkspaceIdAndPageIdOrderByCreatedAtAsc(workspaceId, pageId).map(CommentResponse::from)

    fun create(request: CreateCommentRequest, workspaceId: Long, callerUserId: Long): CommentResponse {
        val user = userRepository.findById(callerUserId)
            .orElseThrow { ResponseStatusException(HttpStatus.UNAUTHORIZED) }
        val displayName = user.name.take(32).ifBlank { user.email.substringBefore("@").take(32) }
        val saved = repository.save(
            Comment(
                workspaceId = workspaceId,
                pageId = request.pageId.trim(),
                author = displayName,
                content = request.content.trim(),
                user = user,
            )
        )
        publishIfPlanPage(workspaceId, saved.pageId)
        return CommentResponse.from(saved)
    }

    fun update(id: Long, request: UpdateCommentRequest, workspaceId: Long, callerUserId: Long): CommentResponse {
        val comment = repository.findByIdAndWorkspaceId(id, workspaceId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "comment $id") }
        if (comment.user?.id != callerUserId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit")
        }
        comment.content = request.content.trim()
        publishIfPlanPage(workspaceId, comment.pageId)
        return CommentResponse.from(comment)
    }

    fun delete(id: Long, workspaceId: Long, callerUserId: Long, callerRole: Role) {
        val comment = repository.findByIdAndWorkspaceId(id, workspaceId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "comment $id") }
        val isOwner = comment.user?.id == callerUserId
        val isAdmin = callerRole.isAtLeastAdmin()
        if (!isOwner && !isAdmin) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author or an admin can delete")
        }
        repository.delete(comment)
        publishIfPlanPage(workspaceId, comment.pageId)
    }

    /** Comments are generic (any pageId); only "plan:{id}" pages ride the
     *  decisions realtime channel, so a plan's 댓글 section updates live. */
    private fun publishIfPlanPage(workspaceId: Long, pageId: String) {
        val planId = PLAN_PAGE_ID.matchEntire(pageId)?.groupValues?.get(1)?.toLongOrNull() ?: return
        changes.publish(workspaceId, planId)
    }

    companion object {
        private val PLAN_PAGE_ID = Regex("^plan:(\\d+)$")
    }
}
```

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.DecisionChangeCoverageTest"` → PASS
Run: `./gradlew test --tests "com.shareddocs.backend.comment.CommentWorkspaceIsolationTest"` → PASS (unaffected)
Run: `./gradlew test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/comment/CommentService.kt src/test/kotlin/com/shareddocs/backend/decision/DecisionChangeCoverageTest.kt
git commit -m "feat(decisions): comments on plan:{id} pages publish the decisions realtime signal"
```

---

### Task 4: Purge cleanup — resources, attachments, and comments on permanent plan delete

**Files:**
- Modify: `src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt` (`purgeSinglePlan`, constructor)
- Modify: `src/main/kotlin/com/shareddocs/backend/comment/CommentRepository.kt` (add bulk delete)
- Test: `src/test/kotlin/com/shareddocs/backend/decision/PlanResourcePurgeTest.kt`

**Interfaces:**
- Consumes: Task 2's `PlanResourceRepository.findAllByPlanId`, Task 1's `PlanAttachmentRepository`/`PlanAttachmentService.delete`, `CommentRepository`.
- Produces: `CommentRepository.deleteAllByWorkspaceIdAndPageId(workspaceId, pageId)`.

- [ ] **Step 1: Write the failing test**

Create `src/test/kotlin/com/shareddocs/backend/decision/PlanResourcePurgeTest.kt`:

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.comment.CommentRepository
import com.shareddocs.backend.comment.CommentService
import com.shareddocs.backend.comment.CreateCommentRequest
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PlanResourcePurgeTest(
    @Autowired private val planService: PlanService,
    @Autowired private val resourceService: PlanResourceService,
    @Autowired private val commentService: CommentService,
    @Autowired private val resources: PlanResourceRepository,
    @Autowired private val attachments: PlanAttachmentRepository,
    @Autowired private val comments: CommentRepository,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `permanently deleting a plan removes its resources, attachments, and comments`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        resourceService.addLink(ws.id!!, plan.id, owner.id!!, CreateLinkResourceRequest(url = "https://a.com"))
        resourceService.addFile(ws.id!!, plan.id, owner.id!!, MockMultipartFile("file", "a.pdf", "application/pdf", ByteArray(5)))
        commentService.create(CreateCommentRequest(pageId = "plan:${plan.id}", content = "hi"), ws.id!!, owner.id!!)
        planService.discard(ws.id!!, plan.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        planService.deleteForever(ws.id!!, plan.id)
        entityManager.flush(); entityManager.clear()

        assertEquals(emptyList<PlanResource>(), resources.findAllByPlanId(plan.id))
        assertEquals(emptyList<PlanAttachment>(), attachments.findAllByPlanId(plan.id))
        assertEquals(emptyList<Any>(), comments.findByWorkspaceIdAndPageIdOrderByCreatedAtAsc(ws.id!!, "plan:${plan.id}"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanResourcePurgeTest"`
Expected: FAIL — resources/attachments/comments rows still present after `deleteForever` (`purgeSinglePlan` doesn't touch them yet). If it also fails to COMPILE first because `deleteAllByWorkspaceIdAndPageId` doesn't exist yet, that's expected too — implement Step 3's `CommentRepository` change first, then re-check.

- [ ] **Step 3: Implement**

`CommentRepository.kt` — add:

```kotlin
    fun deleteAllByWorkspaceIdAndPageId(workspaceId: Long, pageId: String)
```

`PlanService.kt` — add three constructor params and extend `purgeSinglePlan`:

```kotlin
    // add to the primary constructor, alongside the existing repository/publisher params:
    private val planResourceRepository: PlanResourceRepository,
    private val planAttachmentRepository: PlanAttachmentRepository,
    private val planAttachmentService: PlanAttachmentService,
    private val commentRepository: com.shareddocs.backend.comment.CommentRepository,
```

```kotlin
/** Permanently delete a single plan's rows (see [deleteForever] for FK ordering).
 *  자료/댓글 have no FK to plans.subPlans/etc., so they're cleaned up first,
 *  independent of the sub_plan/option/decision purge order below. */
private fun purgeSinglePlan(plan: Plan) {
    val planId = plan.id!!
    val planResources = planResourceRepository.findAllByPlanId(planId)
    planResources.forEach { resource ->
        resource.attachmentId?.let { attId ->
            planAttachmentRepository.findById(attId).ifPresent { planAttachmentService.delete(it) }
        }
    }
    planResourceRepository.deleteAll(planResources)
    commentRepository.deleteAllByWorkspaceIdAndPageId(plan.workspaceId, "plan:$planId")

    // ... existing subPlans/options/decisions/votes/ratings/events/edges purge, unchanged
}
```

Keep every existing line inside `purgeSinglePlan` below this new block exactly as it is today — only prepend the resource/attachment/comment cleanup.

- [ ] **Step 4: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.decision.PlanResourcePurgeTest"` → PASS
Run: `./gradlew test` → PASS (full suite, including all of Phase 1's trash/purge tests — confirms the new constructor params didn't break existing `PlanService` instantiation anywhere).

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt src/main/kotlin/com/shareddocs/backend/comment/CommentRepository.kt src/test/kotlin/com/shareddocs/backend/decision/PlanResourcePurgeTest.kt
git commit -m "feat(decisions): purge plan_resources, plan_attachments (+files), and comments on permanent plan delete"
```

---

### Task 5: Frontend API surface + timeline copy

**Files (frontend repo):**
- Modify: `src/features/decisions/types.ts`
- Modify: `src/features/decisions/api.ts`
- Modify: `src/features/decisions/formatPlanEvent.tsx`

**Interfaces:**
- Consumes: Task 1-2's response shapes.
- Produces (Tasks 6-8 rely on these): `PlanResource`, `PlanResourceKind`, `CreateLinkResourcePayload`, `UpdateResourceTitlePayload`, `decisionKeys.resources(wsId, planId)`, `usePlanResources(planId)`, `useAddLinkResource(planId)`, `useUploadResourceFile(planId)`, `useUpdateResourceTitle(planId)`, `useDeleteResource(planId)`.

- [ ] **Step 1: types.ts**

Add:

```ts
export type PlanResourceKind = 'LINK' | 'FILE'

export type PlanResource = {
  id: number
  planId: number
  kind: PlanResourceKind
  url: string | null
  title: string | null
  attachmentId: number | null
  originalFilename: string | null
  contentType: string | null
  sizeBytes: number | null
  fileUrl: string | null
  createdByUserId: number
  createdAt: string
}

export type CreateLinkResourcePayload = { url: string; title?: string }
export type UpdateResourceTitlePayload = { title?: string }
```

Extend the `PlanEventType` union with `| 'RESOURCE_ADDED' | 'RESOURCE_REMOVED'`.

- [ ] **Step 2: api.ts**

Add to `decisionKeys`:

```ts
  resources: (wsId: number | null, planId: number) => ['decisions', wsId, 'resources', planId] as const,
```

Add (matching the existing per-`planId`-hook-factory convention used by `useAddSubPlan(planId)`/`useCreateEdge(planId)`/`useReorderSubPlans(planId)`):

```ts
async function listResourcesReq(planId: number): Promise<PlanResource[]> {
  const { data } = await apiClient.get<PlanResource[]>(`/api/plans/${planId}/resources`)
  return data
}
async function addLinkResourceReq(planId: number, payload: CreateLinkResourcePayload): Promise<PlanResource> {
  const { data } = await apiClient.post<PlanResource>(`/api/plans/${planId}/resources`, payload)
  return data
}
async function uploadResourceFileReq(planId: number, file: File): Promise<PlanResource> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<PlanResource>(
    `/api/plans/${planId}/resources/file`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}
async function updateResourceTitleReq(id: number, payload: UpdateResourceTitlePayload): Promise<PlanResource> {
  const { data } = await apiClient.patch<PlanResource>(`/api/resources/${id}`, payload)
  return data
}
async function deleteResourceReq(id: number): Promise<void> {
  await apiClient.delete(`/api/resources/${id}`)
}

export function usePlanResources(planId: number) {
  const { activeId } = useActiveWorkspace()
  return useQuery({
    queryKey: decisionKeys.resources(activeId, planId),
    queryFn: () => listResourcesReq(planId),
    enabled: activeId != null && Number.isFinite(planId),
  })
}
export function useAddLinkResource(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (payload: CreateLinkResourcePayload) => addLinkResourceReq(planId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUploadResourceFile(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (file: File) => uploadResourceFileReq(planId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUpdateResourceTitle(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateResourceTitlePayload }) => updateResourceTitleReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteResource(planId: number) {
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: (id: number) => deleteResourceReq(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```

Import `PlanResource`, `CreateLinkResourcePayload`, `UpdateResourceTitlePayload` in the type import list. `decisionKeys.resources` sits under the `['decisions', wsId]` prefix, so the realtime change feed invalidates it automatically.

- [ ] **Step 3: formatPlanEvent.tsx**

Add two cases to the exhaustive `ICONS: Record<PlanEventType, LucideIcon>` map and the copy-switch, following the file's existing `${actor}님이 …` pattern exactly (see the actor-prefix fix from Phase 1 Task 5 for the exact shape to copy):

- `RESOURCE_ADDED` → icon `Paperclip`, copy `${actor}님이 자료 '${title}'을(를) 추가했어요`
- `RESOURCE_REMOVED` → icon `Trash2`, copy `${actor}님이 자료 '${title}'을(를) 삭제했어요`

(`title` comes from `payload.title`, same as every other event case in this file.)

- [ ] **Step 4: Gates + commit**

Run: `npx tsc -b --noEmit` → clean. `npx eslint src/features/decisions/` → no new errors. `npm run build` → success.

```bash
git add src/features/decisions/types.ts src/features/decisions/api.ts src/features/decisions/formatPlanEvent.tsx
git commit -m "feat(decisions): plan-resources API surface + RESOURCE_ADDED/REMOVED event copy"
```

---

### Task 6: `resourceIcon.ts` — pure icon+tint classifier

**Files (frontend repo):**
- Create: `src/features/decisions/resourceIcon.ts`

**Interfaces:**
- Consumes: `PlanResource` from Task 5.
- Produces: `resourceIconSpec(resource: PlanResource): ResourceIconSpec` — Task 7 renders each row's icon tile from this.

- [ ] **Step 1: Implement**

```ts
import type { ComponentType } from 'react'
import { FileSignature, FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Receipt, Youtube } from 'lucide-react'
import type { PlanResource } from './types'

export type ResourceIconSpec = {
  Icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  tintVar: string
  colorVar: string
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Pure classifier: kind + URL domain + content-type + filename → icon and
 * tint tokens. Resource kind (LINK/FILE) always branches first. Priority
 * within FILE: filename hints (영수증/계약) beat content-type, since a
 * scanned receipt is still a PDF/JPEG at the content-type level.
 */
export function resourceIconSpec(resource: PlanResource): ResourceIconSpec {
  if (resource.kind === 'LINK') {
    const host = resource.url ? hostOf(resource.url) : null
    if (host && YOUTUBE_HOSTS.has(host)) {
      return { Icon: Youtube, tintVar: 'var(--c-accent-soft)', colorVar: 'var(--c-accent)' }
    }
    return { Icon: LinkIcon, tintVar: 'var(--c-primary-soft)', colorVar: 'var(--c-primary)' }
  }

  const name = (resource.originalFilename ?? '').toLowerCase()
  const contentType = resource.contentType ?? ''
  if (name.includes('영수증') || name.includes('receipt')) {
    return { Icon: Receipt, tintVar: 'var(--c-primary-soft)', colorVar: 'var(--c-primary)' }
  }
  if (name.includes('계약') || name.includes('contract')) {
    return { Icon: FileSignature, tintVar: 'var(--c-primary-soft-strong)', colorVar: 'var(--c-primary)' }
  }
  if (contentType.startsWith('image/')) {
    return { Icon: ImageIcon, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
  }
  if (contentType.startsWith('text/') || contentType.includes('pdf')) {
    return { Icon: FileText, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
  }
  return { Icon: Paperclip, tintVar: 'var(--c-surface-tint)', colorVar: 'var(--c-text-muted)' }
}
```

- [ ] **Step 2: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` → clean.

```bash
git add src/features/decisions/resourceIcon.ts
git commit -m "feat(decisions): resourceIconSpec — pure icon+tint classifier for 자료 rows"
```

---

### Task 7: `ResourceSection` + `LinkResourceModal`, mounted in PlanDetail

**Files (frontend repo):**
- Create: `src/features/decisions/ResourceSection.tsx`
- Create: `src/features/decisions/ResourceSection.module.css`
- Create: `src/features/decisions/LinkResourceModal.tsx`
- Modify: `src/features/decisions/PlanDetail.tsx`

**Interfaces:**
- Consumes: Task 5's hooks, Task 6's `resourceIconSpec`, existing `ConfirmDialog` (`components/ui/ConfirmDialog.tsx`, props `{open, onOpenChange, title, description?, confirmLabel?, destructive?, onConfirm}`), existing `Modal`/`Field`/`Label`/`Input`/`Button` (`components/ui`), `formatBytes` (`lib/format`), `absoluteFileUrl` (`lib/files`).
- Produces: `<ResourceSection planId={planId} />` mounted right after `<SubDecisionSection>` in PlanDetail's list view.

- [ ] **Step 1: `LinkResourceModal.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Input, Button } from '../../components/ui'
import type { CreateLinkResourcePayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  busy?: boolean
  onSubmit: (payload: CreateLinkResourcePayload) => void
}

export default function LinkResourceModal(props: Props) {
  return <LinkResourceModalInner key={props.open ? 'open' : 'closed'} {...props} />
}

function LinkResourceModalInner({ open, onClose, busy, onSubmit }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return
    onSubmit({ url: trimmedUrl, title: title.trim() || undefined })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="링크 추가"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="link-resource-form" disabled={busy || !url.trim()}>
            {busy ? '추가 중…' : '추가'}
          </Button>
        </>
      }
    >
      <form id="link-resource-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="resource-url">URL</Label>
          <Input id="resource-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                 maxLength={2048} autoFocus placeholder="https://…" />
        </Field>
        <Field>
          <Label htmlFor="resource-title" optional>제목</Label>
          <Input id="resource-title" value={title} onChange={(e) => setTitle(e.target.value)}
                 maxLength={300} placeholder="예: 유튜브 후기 영상" />
        </Field>
      </form>
    </Modal>
  )
}
```

- [ ] **Step 2: `ResourceSection.tsx`**

```tsx
import { useRef, useState } from 'react'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatBytes } from '../../lib/format'
import { absoluteFileUrl } from '../../lib/files'
import { usePlanResources, useAddLinkResource, useUploadResourceFile, useDeleteResource } from './api'
import { resourceIconSpec } from './resourceIcon'
import type { PlanResource } from './types'
import LinkResourceModal from './LinkResourceModal'
import styles from './ResourceSection.module.css'

type Props = { planId: number }

/** 자료 section — links + files, never gated on the plan's lock state
 *  (evidence stays writable after a decision freezes). */
export default function ResourceSection({ planId }: Props) {
  const { data } = usePlanResources(planId)
  const addLink = useAddLinkResource(planId)
  const uploadFile = useUploadResourceFile(planId)
  const deleteResource = useDeleteResource(planId)
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<PlanResource | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resources = data ?? []

  const handleFilePick = (file: File) => {
    uploadFile.mutate(file, {
      onError: (err) => {
        window.alert(err instanceof Error ? err.message : '업로드에 실패했어요.')
      },
    })
  }

  return (
    <section className={styles.section} aria-label="자료">
      <header className={styles.header}>
        <h2 className={styles.heading}>
          <Paperclip size={14} aria-hidden /> 자료
        </h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.addButton} onClick={() => setLinkModalOpen(true)}>
            <Plus size={13} aria-hidden /> 링크
          </button>
          <button type="button" className={styles.addButton} onClick={() => fileInputRef.current?.click()}>
            <Plus size={13} aria-hidden /> 파일
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.hiddenInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFilePick(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      {resources.length === 0 && <p className={styles.empty}>아직 자료가 없어요.</p>}

      {resources.length > 0 && (
        <ul className={styles.list}>
          {resources.map((r) => {
            const { Icon, tintVar, colorVar } = resourceIconSpec(r)
            const label = r.title ?? r.originalFilename ?? r.url ?? '자료'
            const href = r.kind === 'LINK' ? (r.url ?? '#') : absoluteFileUrl(r.fileUrl ?? '')
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.tile} style={{ background: tintVar, color: colorVar }} aria-hidden="true">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                <a className={styles.name} href={href} target="_blank" rel="noreferrer" title={label}>
                  {label}
                </a>
                {r.kind === 'FILE' && r.sizeBytes != null && (
                  <span className={styles.meta}>{formatBytes(r.sizeBytes)}</span>
                )}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`${label} 삭제`}
                  onClick={() => setConfirmTarget(r)}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <LinkResourceModal
        open={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        busy={addLink.isPending}
        onSubmit={(payload) => addLink.mutate(payload, { onSuccess: () => setLinkModalOpen(false) })}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`${confirmTarget?.title ?? confirmTarget?.originalFilename ?? confirmTarget?.url ?? '자료'}을(를) 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={() => {
          if (confirmTarget) deleteResource.mutate(confirmTarget.id)
          setConfirmTarget(null)
        }}
      />
    </section>
  )
}
```

- [ ] **Step 3: `ResourceSection.module.css`**

```css
.section {
  margin-top: var(--sp-6);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-3);
}

.heading {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
  margin: 0;
}

.headerActions {
  display: flex;
  gap: var(--sp-2);
}

.addButton {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  cursor: pointer;
}

.addButton:hover {
  background: var(--c-surface-tint);
  color: var(--c-text);
}

.hiddenInput {
  display: none;
}

.empty {
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
}

.row:hover {
  background: var(--c-surface-tint);
}

.tile {
  flex: none;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-sm);
  color: var(--c-text);
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
}

.meta {
  flex: none;
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}

.remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-subtle);
  cursor: pointer;
}

.remove:hover {
  background: var(--c-danger-soft);
  color: var(--c-danger);
}
```

- [ ] **Step 4: Mount in PlanDetail**

In `src/features/decisions/PlanDetail.tsx`: add `import ResourceSection from './ResourceSection'`. Insert `<ResourceSection planId={planId} />` immediately after the `<SubDecisionSection ... />` call, still inside the `{view === 'list' && (...)}` block, before the mobile `<Fab>` block.

- [ ] **Step 5: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.
Manual (`npm run dev`): open a plan → 자료 → add a link (with/without title) → row appears with the right icon/tint → add a YouTube link → Youtube icon, accent tint → upload a file named `계약서.pdf` → FileSignature icon → delete a row → confirm dialog → gone. Try adding 자료 on a locked plan — should succeed.

```bash
git add src/features/decisions/ResourceSection.tsx src/features/decisions/ResourceSection.module.css src/features/decisions/LinkResourceModal.tsx src/features/decisions/PlanDetail.tsx
git commit -m "feat(decisions): 자료 section with icon-tinted rows, mounted on the plan page"
```

---

### Task 8: 댓글 section — mount the existing generic `Comments` component

**Files (frontend repo):**
- Modify: `src/features/decisions/PlanDetail.tsx`
- Modify: `src/features/decisions/PlanDetail.module.css`

**Interfaces:**
- Consumes: `src/components/Comments.tsx` (props `{pageId: string, title?: string}`, already fully generic — zero changes needed to that component).
- Produces: a `plan:{id}` comment thread visible + writable on every plan page.

- [ ] **Step 1: Mount + wrapper**

In `PlanDetail.tsx`: add `import Comments from '../../components/Comments'`. Insert immediately after `<ResourceSection planId={planId} />` (still inside `{view === 'list' && (...)}`, before the mobile `<Fab>`):

```tsx
              <div className={styles.commentsSection}>
                <Comments pageId={`plan:${planId}`} />
              </div>
```

- [ ] **Step 2: `PlanDetail.module.css` — adapt the pre-existing global `Comments.css` card chrome to this document-column layout**

Add:

```css
.commentsSection {
  margin-top: var(--sp-6);
}

/* Comments.tsx ships its own global (non-module) Comments.css styled as a
 * standalone centered card (max-width/margin/border/background) — that
 * predates this feature and isn't something to fix here. This :global()
 * override just strips the card chrome so it reads as a plain in-flow
 * section, matching 하위결정/자료 above it. */
.commentsSection :global(.comments) {
  max-width: none;
  margin: 0;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
}

.commentsSection :global(.comments__title) {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
  margin: 0 0 var(--sp-3);
}
```

- [ ] **Step 3: Gates + commit**

Run: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.
Manual: open a plan → 댓글 section appears below 자료, reads as a plain section (no floating card) → post a comment → appears → delete (own comment) → gone. Add a comment on a locked plan — should succeed. Two browsers: comment on one appears live on the other (existing realtime channel, wired in Task 3).

```bash
git add src/features/decisions/PlanDetail.tsx src/features/decisions/PlanDetail.module.css
git commit -m "feat(decisions): mount 댓글 (Comments) on the plan page via pageId=plan:{id}"
```

---

### Task 9: Docs sync, full gates, deploy

**Files:**
- Modify: `CLAUDE.md` (frontend repo)
- Both repos: final verification + push

- [ ] **Step 1: CLAUDE.md**

1. Add to the feature-status table: `| Decisions 자료+댓글 (Life Story Board Phase 2) | **Shipped 2026-07-08.** plan_attachments + plan_resources (V24), GET/POST /api/plans/{id}/resources (+ /file, PATCH/DELETE /api/resources/{id}); Lucide icon-tinted rows (Youtube/Link/Receipt/FileSignature/Image/FileText/Paperclip); 댓글 reuses the generic Comment feature via pageId=plan:{id}, live over the existing decisions WS channel; neither is lock-guarded; both purged on permanent plan delete. Design/plan: docs/plans/2026-07-08-life-story-board-design.md + 2026-07-08-plan-resources-plan.md. Phase 3 (스토리 뷰) pending. |`
2. Update "Flyway owns the schema (latest V23)" → V24.
3. Update the header's "shipped" list to include Phase 2.

- [ ] **Step 2: Full gates, both repos**

Backend: `./gradlew test` → all green.
Frontend: `npx tsc -b --noEmit` && `npm run build` && `npx eslint src/features/decisions/` → clean.

- [ ] **Step 3: Commit docs, push both repos, verify deploy locally**

```bash
# frontend repo
git add CLAUDE.md docs/plans/2026-07-08-plan-resources-plan.md
git commit -m "docs: plan resources (자료+댓글) shipped (Life Story Board Phase 2)"
git push origin main
# backend repo
git push origin main
```

Verify locally (this machine is the CD runner): `docker logs shared-docs-backend 2>&1 | grep -i flyway | tail -3` (expect "Migrating schema … to version 24 - plan resources → Successfully applied") and `curl -s localhost:8090/actuator/health` (expect `"status":"UP"`). Vercel builds the frontend cloud-side.

- [ ] **Step 4: Manual smoke checklist (user)**

- Add a link (plain + YouTube) and a file to a plan; confirm icon/tint per kind; download the file; delete both.
- Post, then delete, a comment; confirm a second workspace member can also delete their own comment but not yours (unless they're the plan owner or admin, for 자료 — comments stay author-or-admin only).
- Add 자료/댓글 on a **locked** plan — both should succeed.
- Permanently delete (영구 삭제) a plan that has 자료 + 댓글 — confirm the uploaded file is gone from disk (re-visiting its `/files/{storedFilename}` URL 404s) and the comment thread is empty if you recreate a plan with the same id pattern (informal check — the purge test already covers this precisely).
- Two browsers: adding a resource or comment on one appears live on the other.
