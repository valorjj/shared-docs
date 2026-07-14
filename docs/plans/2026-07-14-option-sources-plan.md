# 선택지 자료 (per-candidate sources) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each 선택지 (Option) carry its own 자료 — links, uploaded images/screenshots, files — shown as an image thumbnail grid + icon rows inside the candidate, so a decision can gather and compare its research in place.

**Architecture:** Mirror the shipped plan-level 자료 subsystem with its own `option_resources` + `option_attachments` tables FK'd to `options` (Flyway V27). `resources[]` rides along in the existing `GET /api/subplans/{id}` detail fetch (like `proCons`). New option-scoped service/controller mirror `PlanResourceService`/`PlanResourceController`; not lock-gated; quota-summed; purged with the option; realtime via the existing `changes.publish`.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + MariaDB + Flyway; Vite + React 19 + TS + CSS Modules + React Query.

## Global Constraints

- **Flyway owns the schema**; Hibernate `ddl-auto: validate`. New migration is **V27** (latest is V26). Entities must match the migrated columns exactly.
- **Every endpoint** takes `X-Workspace-Id`; controllers use `@CurrentWorkspace ws: Workspace` and services filter by `ws.id`.
- **Not lock-gated**: source add/delete must succeed on a locked plan / decided 안건 (mirror `PlanResourceService`, which never calls `lockGuard`).
- **Portfolio-grade**: real FK constraints (`ON DELETE RESTRICT`), optimistic locking via `BaseEntity` (`version`), typed `ApiException` errors (RFC-7807-ish).
- **All UI text in Korean.** **Lucide icons, never emoji** — the collapsed-row source hint uses Lucide `Paperclip`, not a 📎 character. **CSS Modules + design tokens only** (no hardcoded hex). **No setState in effect.** **Card never lifts** (hairline + `--c-surface-tint` hover).
- **Delete permission**: author-or-plan-owner-or-admin (reuse the plan 자료 rule).
- **Quota**: one shared per-user disk budget. The new `OptionAttachmentService` sums note + plan + option attachments; add the option term to `PlanAttachmentService.upload` too. **Do NOT** modify the note `AttachmentService` — it would introduce a note→decision module dependency, and note uploads already don't count plan attachments (pre-existing accepted asymmetry, out of scope here).
- **Exception reuse**: reuse `ResourceQuotaExceededException`, `PlanResourceNotFoundException`, `PlanResourceForbiddenException` (their 자료 messages are generic) rather than adding option-specific variants.
- FE authoritative gate is `npm run build` (+ `npx eslint src/<touched>`); there is no FE unit-test runner, so FE tasks verify via build/lint + a described manual check.
- Backend tests: `@SpringBootTest @ActiveProfiles("test") @Transactional`, constructor `@Autowired`, `newUser()` + `workspaces.create(...)` fixtures — mirror `PlanResourceServiceTest`.

---

## Task 1: Schema + entities + repositories (BE)

**Files:**
- Create: `shared-docs-backend/src/main/resources/db/migration/V27__option_resources.sql`
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResource.kt`
- Create: `.../decision/OptionAttachment.kt`
- Create: `.../decision/OptionResourceRepository.kt`
- Create: `.../decision/OptionAttachmentRepository.kt`
- Create: `.../decision/OptionResourceDto.kt`

**Interfaces:**
- Produces: `OptionResource`, `OptionAttachment` entities; `OptionResourceKind { LINK, FILE }`; `OptionResourceRepository` (`findAllByOptionIdOrderByCreatedAtAsc`, `findAllByOptionId`, `findAllByOptionIdIn`, `findByIdAndWorkspaceId`); `OptionAttachmentRepository` (`findAllByOptionId`, `findByStoredFilename`, `sumSizeBytesByUploadedByUserId`); `OptionResourceResponse` DTO.

- [ ] **Step 1: Write the migration**

`V27__option_resources.sql`:
```sql
-- 선택지 자료 (per-candidate sources). Mirrors plan_resources/plan_attachments
-- (V24) but FK'd to options. LINK carries a URL; FILE points at an
-- option_attachments row (same FileStorageService + global disk guard).
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
  `kind` varchar(10) NOT NULL,
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

- [ ] **Step 2: Write the entities**

`OptionResource.kt`:
```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Index
import jakarta.persistence.Table

enum class OptionResourceKind { LINK, FILE }

/** 자료 — a link or file attached to a 선택지, never lock-guarded. */
@Entity
@Table(
    name = "option_resources",
    indexes = [
        Index(name = "idx_option_resources_option", columnList = "option_id"),
        Index(name = "idx_option_resources_workspace", columnList = "workspace_id"),
    ],
)
class OptionResource(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "option_id", nullable = false, updatable = false)
    val optionId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10, updatable = false)
    val kind: OptionResourceKind,

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

`OptionAttachment.kt`:
```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Index
import jakarta.persistence.Table

/** A file stored for a 선택지's 자료. Mirrors PlanAttachment. */
@Entity
@Table(
    name = "option_attachments",
    indexes = [
        Index(name = "idx_option_attachments_option", columnList = "option_id"),
        Index(name = "idx_option_attachments_stored", columnList = "stored_filename", unique = true),
    ],
)
class OptionAttachment(
    @Column(name = "workspace_id", nullable = false, updatable = false)
    val workspaceId: Long,

    @Column(name = "option_id", nullable = false, updatable = false)
    val optionId: Long,

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

- [ ] **Step 3: Write the repositories**

`OptionResourceRepository.kt`:
```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository

interface OptionResourceRepository : JpaRepository<OptionResource, Long> {
    fun findAllByOptionIdOrderByCreatedAtAsc(optionId: Long): List<OptionResource>
    fun findAllByOptionId(optionId: Long): List<OptionResource>
    fun findAllByOptionIdIn(optionIds: Collection<Long>): List<OptionResource>
    fun findByIdAndWorkspaceId(id: Long, workspaceId: Long): OptionResource?
}
```

`OptionAttachmentRepository.kt`:
```kotlin
package com.shareddocs.backend.decision

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface OptionAttachmentRepository : JpaRepository<OptionAttachment, Long> {
    fun findAllByOptionId(optionId: Long): List<OptionAttachment>
    fun findByStoredFilename(storedFilename: String): OptionAttachment?

    @Query("SELECT COALESCE(SUM(a.sizeBytes), 0) FROM OptionAttachment a WHERE a.uploadedByUserId = :userId")
    fun sumSizeBytesByUploadedByUserId(@Param("userId") userId: Long): Long
}
```

- [ ] **Step 4: Write the response DTO**

`OptionResourceDto.kt` (reuse `CreateLinkResourceRequest` from `PlanResourceDto.kt` — do not redefine it):
```kotlin
package com.shareddocs.backend.decision

import java.time.Instant

data class OptionResourceResponse(
    val id: Long,
    val optionId: Long,
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
```

- [ ] **Step 5: Verify it compiles and the schema validates**

Run: `cd shared-docs-backend && ./gradlew compileKotlin test --tests "com.shareddocs.backend.decision.PlanServiceTest" -q`
Expected: PASS — app context loads with V27 applied and `ddl-auto: validate` accepting the two new entities. (Any existing decision test exercises context load; `PlanServiceTest` is a safe smoke.)

- [ ] **Step 6: Commit**

```bash
git add shared-docs-backend/src/main/resources/db/migration/V27__option_resources.sql \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResource.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionAttachment.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResourceRepository.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionAttachmentRepository.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResourceDto.kt
git commit -m "feat(decisions): option_resources + option_attachments schema (V27)"
```

---

## Task 2: OptionAttachmentService + shared quota (BE)

**Files:**
- Create: `.../decision/OptionAttachmentService.kt`
- Modify: `.../decision/PlanAttachmentService.kt` (add option term to the quota sum)
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/OptionAttachmentServiceTest.kt`

**Interfaces:**
- Consumes: `OptionAttachmentRepository`, `PlanAttachmentRepository`, `AttachmentRepository` (note), `FileStorageService`, `FileStorageProperties`.
- Produces: `OptionAttachmentService.upload(workspaceId: Long, optionId: Long, file: MultipartFile, uploaderUserId: Long): OptionAttachment`; `OptionAttachmentService.delete(attachment: OptionAttachment)`.

- [ ] **Step 1: Write the failing test**

`OptionAttachmentServiceTest.kt`:
```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.note.FileStorageProperties
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
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
class OptionAttachmentServiceTest(
    @Autowired private val service: OptionAttachmentService,
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val properties: FileStorageProperties,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private fun optionOf(wsId: Long, userId: Long): Long {
        val plan = planService.create(wsId, userId, CreatePlanRequest(title = "P"))
        val sp = planService.addSubPlan(wsId, plan.id, userId, CreateSubPlanRequest(title = "S"))
        return planService.addOption(wsId, sp.id, userId, CreateOptionRequest(title = "O")).id
    }

    @Test
    fun `upload persists an option attachment with file metadata`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val optionId = optionOf(ws.id!!, owner.id!!)
        val file = MockMultipartFile("file", "review.png", "image/png", ByteArray(12))

        val saved = service.upload(ws.id!!, optionId, file, owner.id!!)

        assertEquals("review.png", saved.originalFilename)
        assertEquals("image/png", saved.contentType)
        assertEquals(12L, saved.sizeBytes)
    }

    @Test
    fun `upload over the per-user quota is rejected`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val optionId = optionOf(ws.id!!, owner.id!!)
        val tooBig = MockMultipartFile("file", "big.bin", "application/octet-stream",
            ByteArray((properties.perUserQuotaBytes + 1).toInt()))

        assertThrows(ResourceQuotaExceededException::class.java) {
            service.upload(ws.id!!, optionId, tooBig, owner.id!!)
        }
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionAttachmentServiceTest" -q`
Expected: FAIL — `OptionAttachmentService` does not exist (compile error).

- [ ] **Step 3: Write `OptionAttachmentService`**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.note.AttachmentRepository
import com.shareddocs.backend.note.FileStorageProperties
import com.shareddocs.backend.note.FileStorageService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

/**
 * Storage layer for 선택지 자료 uploads. The per-user quota is checked against
 * the SUM of note + plan + option attachments — one shared physical-disk
 * budget (same FileStorageService/upload dir, same global 10GB guard).
 */
@Service
@Transactional
class OptionAttachmentService(
    private val optionAttachments: OptionAttachmentRepository,
    private val planAttachments: PlanAttachmentRepository,
    private val noteAttachments: AttachmentRepository,
    private val storage: FileStorageService,
    private val properties: FileStorageProperties,
) {
    fun upload(workspaceId: Long, optionId: Long, file: MultipartFile, uploaderUserId: Long): OptionAttachment {
        val used = noteAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId) +
            planAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId) +
            optionAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId)
        if (used + file.size > properties.perUserQuotaBytes) {
            throw ResourceQuotaExceededException()
        }
        val stored = storage.store(file)
        return optionAttachments.save(
            OptionAttachment(
                workspaceId = workspaceId,
                optionId = optionId,
                originalFilename = stored.originalFilename,
                contentType = stored.contentType,
                sizeBytes = stored.sizeBytes,
                storedFilename = stored.storedFilename,
                uploadedByUserId = uploaderUserId,
            ),
        )
    }

    fun delete(attachment: OptionAttachment) {
        storage.delete(attachment.storedFilename)
        optionAttachments.delete(attachment)
    }
}
```

- [ ] **Step 4: Add the option term to the plan quota sum**

In `PlanAttachmentService.kt`, inject the option repo and add it to the sum. Change the constructor to add `private val optionAttachments: OptionAttachmentRepository,` and change the `used` computation in `upload(...)` to:
```kotlin
        val used = noteAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId) +
            planAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId) +
            optionAttachments.sumSizeBytesByUploadedByUserId(uploaderUserId)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionAttachmentServiceTest" --tests "com.shareddocs.backend.decision.PlanAttachmentServiceTest" -q`
Expected: PASS (both the new option tests and the existing plan-attachment tests, confirming the quota change didn't break them).

- [ ] **Step 6: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionAttachmentService.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanAttachmentService.kt \
  shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/OptionAttachmentServiceTest.kt
git commit -m "feat(decisions): OptionAttachmentService with shared per-user quota"
```

---

## Task 3: OptionResourceService (BE)

**Files:**
- Create: `.../decision/OptionResourceService.kt`
- Test: `.../test/.../decision/OptionResourceServiceTest.kt`

**Interfaces:**
- Consumes: `OptionResourceRepository`, `OptionAttachmentRepository`, `OptionAttachmentService` (Task 2), `OptionRepository`, `SubPlanRepository`, `PlanRepository`, `PlanEventRecorder`, `DecisionChangePublisher`.
- Produces: `OptionResourceService.addLink(workspaceId, optionId, actorUserId, CreateLinkResourceRequest): OptionResourceResponse`; `addFile(workspaceId, optionId, actorUserId, MultipartFile): OptionResourceResponse`; `delete(workspaceId, resourceId, actorUserId, actorRole): Unit`; and a package-private `listForOptions(optionIds): Map<Long, List<OptionResourceResponse>>` used by Task 4's detail fetch.

- [ ] **Step 1: Write the failing test**

`OptionResourceServiceTest.kt`:
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
import jakarta.persistence.EntityManager

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OptionResourceServiceTest(
    @Autowired private val service: OptionResourceService,
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val optionAttachmentRepository: OptionAttachmentRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    private data class Ctx(val wsId: Long, val ownerId: Long, val planId: Long, val subPlanId: Long, val optionId: Long)

    private fun ctx(): Ctx {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = planService.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "S"))
        val opt = planService.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "O"))
        return Ctx(ws.id!!, owner.id!!, plan.id, sp.id, opt.id)
    }

    @Test
    fun `addLink attaches a link to the option`() {
        val c = ctx()
        val r = service.addLink(c.wsId, c.optionId, c.ownerId, CreateLinkResourceRequest(url = "https://a.com", title = "후기"))
        assertEquals("LINK", r.kind)
        assertEquals(c.optionId, r.optionId)
        assertEquals("후기", r.title)
    }

    @Test
    fun `addFile persists an attachment with metadata`() {
        val c = ctx()
        val file = MockMultipartFile("file", "shot.png", "image/png", ByteArray(9))
        val r = service.addFile(c.wsId, c.optionId, c.ownerId, file)
        assertEquals("FILE", r.kind)
        assertEquals("shot.png", r.originalFilename)
        assertTrue(r.fileUrl!!.startsWith("/files/"))
    }

    @Test
    fun `sources are addable after the plan is locked`() {
        val c = ctx()
        planService.lock(c.wsId, c.planId, c.ownerId)
        val r = service.addLink(c.wsId, c.optionId, c.ownerId, CreateLinkResourceRequest(url = "https://a.com"))
        assertEquals("LINK", r.kind)
    }

    @Test
    fun `deleting a FILE resource removes the row and its attachment`() {
        val c = ctx()
        val file = MockMultipartFile("file", "shot.png", "image/png", ByteArray(9))
        val r = service.addFile(c.wsId, c.optionId, c.ownerId, file)
        val attId = r.attachmentId!!
        service.delete(c.wsId, r.id, c.ownerId, Role.USER)
        entityManager.flush(); entityManager.clear()
        assertTrue(optionAttachmentRepository.findById(attId).isEmpty)
    }

    @Test
    fun `a non-author non-owner member cannot delete another member's source`() {
        val c = ctx()
        val other = newUser(); workspaces.joinAsMember(c.wsId, other.id!!)
        val r = service.addLink(c.wsId, c.optionId, other.id!!, CreateLinkResourceRequest(url = "https://a.com"))
        val third = newUser(); workspaces.joinAsMember(c.wsId, third.id!!)
        assertThrows(PlanResourceForbiddenException::class.java) {
            service.delete(c.wsId, r.id, third.id!!, Role.USER)
        }
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionResourceServiceTest" -q`
Expected: FAIL — `OptionResourceService` does not exist.

- [ ] **Step 3: Write `OptionResourceService`**

```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile

/**
 * 선택지 자료 CRUD — mirrors PlanResourceService. Deliberately NOT lock-guarded
 * (evidence stays writable after a decision freezes). Delete permission is
 * author-or-plan-owner-or-admin. Add/remove record RESOURCE_ADDED/REMOVED events
 * (with the owning 안건) and fire the decisions change-signal.
 */
@Service
@Transactional
class OptionResourceService(
    private val resources: OptionResourceRepository,
    private val optionRepository: OptionRepository,
    private val subPlanRepository: SubPlanRepository,
    private val planRepository: PlanRepository,
    private val optionAttachments: OptionAttachmentRepository,
    private val attachmentService: OptionAttachmentService,
    private val events: PlanEventRecorder,
    private val changes: DecisionChangePublisher,
) {
    fun addLink(workspaceId: Long, optionId: Long, actorUserId: Long, request: CreateLinkResourceRequest): OptionResourceResponse {
        val option = requireOption(workspaceId, optionId)
        val resource = resources.save(
            OptionResource(
                workspaceId = workspaceId, optionId = optionId, kind = OptionResourceKind.LINK,
                url = request.url.trim(), title = request.title?.trim()?.ifBlank { null },
                createdByUserId = actorUserId,
            ),
        )
        record(workspaceId, option, PlanEventType.RESOURCE_ADDED, resource.title ?: resource.url ?: "링크", actorUserId)
        return resource.toResponse(null)
    }

    fun addFile(workspaceId: Long, optionId: Long, actorUserId: Long, file: MultipartFile): OptionResourceResponse {
        val option = requireOption(workspaceId, optionId)
        val attachment = attachmentService.upload(workspaceId, optionId, file, actorUserId)
        val resource = resources.save(
            OptionResource(
                workspaceId = workspaceId, optionId = optionId, kind = OptionResourceKind.FILE,
                attachmentId = attachment.id, createdByUserId = actorUserId,
            ),
        )
        record(workspaceId, option, PlanEventType.RESOURCE_ADDED, attachment.originalFilename, actorUserId)
        return resource.toResponse(attachment)
    }

    fun delete(workspaceId: Long, resourceId: Long, actorUserId: Long, actorRole: Role) {
        val resource = resources.findByIdAndWorkspaceId(resourceId, workspaceId) ?: throw PlanResourceNotFoundException()
        val option = requireOption(workspaceId, resource.optionId)
        val (planId, subPlanId) = planAndSubPlanOf(option)
        val plan = planRepository.findByIdAndWorkspaceId(planId, workspaceId)
        val isAuthor = resource.createdByUserId == actorUserId
        val isOwner = plan?.createdByUserId == actorUserId
        if (!isAuthor && !isOwner && !actorRole.isAtLeastAdmin()) throw PlanResourceForbiddenException()

        val attachment = if (resource.kind == OptionResourceKind.FILE) {
            resource.attachmentId?.let { optionAttachments.findById(it).orElse(null) }
        } else null
        val label = if (resource.kind == OptionResourceKind.FILE) attachment?.originalFilename ?: "파일"
            else resource.title ?: resource.url ?: "링크"
        // Delete + flush the resource row BEFORE its attachment (attachment_id is a
        // plain Long with ON DELETE RESTRICT), then remove the file. Mirrors PlanResourceService.
        resources.delete(resource)
        resources.flush()
        attachment?.let { attachmentService.delete(it) }
        events.record(workspaceId, planId, subPlanId, PlanEventType.RESOURCE_REMOVED, actorUserId, mapOf("title" to label))
        changes.publish(workspaceId, planId)
    }

    /** Batch fetch for the 안건 detail response — resources grouped by optionId, with attachments resolved. */
    @Transactional(readOnly = true)
    fun listForOptions(optionIds: Collection<Long>): Map<Long, List<OptionResourceResponse>> {
        if (optionIds.isEmpty()) return emptyMap()
        val rows = resources.findAllByOptionIdIn(optionIds).sortedBy { it.createdAt }
        val attIds = rows.mapNotNull { it.attachmentId }
        val attById = if (attIds.isEmpty()) emptyMap() else optionAttachments.findAllById(attIds).associateBy { it.id!! }
        return rows.map { it.toResponse(attById[it.attachmentId]) }.groupBy { it.optionId }
    }

    private fun record(workspaceId: Long, option: Option, type: PlanEventType, label: String, actorUserId: Long) {
        val (planId, subPlanId) = planAndSubPlanOf(option)
        events.record(workspaceId, planId, subPlanId, type, actorUserId, mapOf("title" to label))
        changes.publish(workspaceId, planId)
    }

    private fun requireOption(workspaceId: Long, optionId: Long): Option =
        optionRepository.findByIdAndWorkspaceId(optionId, workspaceId) ?: throw OptionNotFoundException()

    private fun planAndSubPlanOf(option: Option): Pair<Long, Long> {
        val sp = subPlanRepository.findById(option.subPlanId).orElseThrow { SubPlanNotFoundException() }
        return sp.planId to sp.id!!
    }
}

private fun OptionResource.toResponse(attachment: OptionAttachment?) = OptionResourceResponse(
    id = id!!, optionId = optionId, kind = kind.name, url = url, title = title,
    attachmentId = attachmentId,
    originalFilename = attachment?.originalFilename, contentType = attachment?.contentType,
    sizeBytes = attachment?.sizeBytes,
    fileUrl = attachment?.let { "/files/${it.storedFilename}" },
    createdByUserId = createdByUserId, createdAt = createdAt!!,
)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionResourceServiceTest" -q`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResourceService.kt \
  shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/OptionResourceServiceTest.kt
git commit -m "feat(decisions): OptionResourceService (add link/file, delete, not lock-gated)"
```

---

## Task 4: Controller + detail wiring + purge (BE)

**Files:**
- Create: `.../decision/OptionResourceController.kt`
- Modify: `.../decision/DecisionDto.kt` (add `resources` to `OptionResponse`)
- Modify: `.../decision/PlanService.kt` (`Option.toResponse` gains a `resources` param; `getSubPlanDetail` populates it; `deleteOption` and `deleteSubPlanCascade` purge option resources+attachments)
- Test: `.../test/.../decision/OptionResourcePurgeTest.kt`

**Interfaces:**
- Consumes: `OptionResourceService` (Task 3), `OptionResourceRepository` + `OptionAttachmentRepository` + `OptionAttachmentService` (for purge).
- Produces: `POST /api/options/{optionId}/resources`, `POST /api/options/{optionId}/resources/file`, `DELETE /api/option-resources/{resourceId}`; `OptionResponse.resources: List<OptionResourceResponse>`.

- [ ] **Step 1: Write the failing purge test**

`OptionResourcePurgeTest.kt`:
```kotlin
package com.shareddocs.backend.decision

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.mock.web.MockMultipartFile
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import jakarta.persistence.EntityManager

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class OptionResourcePurgeTest(
    @Autowired private val resourceService: OptionResourceService,
    @Autowired private val planService: PlanService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val userRepository: UserRepository,
    @Autowired private val optionResourceRepository: OptionResourceRepository,
    @Autowired private val optionAttachmentRepository: OptionAttachmentRepository,
    @Autowired private val entityManager: EntityManager,
) {
    private fun newUser() = userRepository.save(
        User(email = "u-${UUID.randomUUID()}@test.example", name = "U", role = Role.USER),
    )

    @Test
    fun `deleting an option purges its resources and attachments without FK violation`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = planService.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "S"))
        val opt = planService.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "O"))
        resourceService.addFile(ws.id!!, opt.id, owner.id!!, MockMultipartFile("file", "a.png", "image/png", ByteArray(5)))
        resourceService.addLink(ws.id!!, opt.id, owner.id!!, CreateLinkResourceRequest(url = "https://a.com"))

        planService.deleteOption(ws.id!!, opt.id)
        entityManager.flush(); entityManager.clear()

        assertTrue(optionResourceRepository.findAllByOptionId(opt.id).isEmpty())
        assertTrue(optionAttachmentRepository.findAllByOptionId(opt.id).isEmpty())
    }

    @Test
    fun `permanently deleting a plan purges its options' resources`() {
        val owner = newUser()
        val ws = workspaces.create(owner.id!!, "W", "w")
        val plan = planService.create(ws.id!!, owner.id!!, CreatePlanRequest(title = "P"))
        val sp = planService.addSubPlan(ws.id!!, plan.id, owner.id!!, CreateSubPlanRequest(title = "S"))
        val opt = planService.addOption(ws.id!!, sp.id, owner.id!!, CreateOptionRequest(title = "O"))
        resourceService.addFile(ws.id!!, opt.id, owner.id!!, MockMultipartFile("file", "a.png", "image/png", ByteArray(5)))

        planService.softDelete(ws.id!!, plan.id, owner.id!!)
        planService.deleteForever(ws.id!!, plan.id, owner.id!!)
        entityManager.flush(); entityManager.clear()

        assertTrue(optionResourceRepository.findAllByOptionId(opt.id).isEmpty())
        assertTrue(optionAttachmentRepository.findAllByOptionId(opt.id).isEmpty())
    }
}
```
> Note: confirm the exact soft-delete / permanent-delete method names on `PlanService` (search `fun softDelete`, `fun deleteForever`) and adjust the two calls in the second test to match; the purge logic under test is in `purgeSinglePlan` → `deleteSubPlanCascade`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionResourcePurgeTest" -q`
Expected: FAIL — either compile error (no purge helper) or FK violation / leftover rows.

- [ ] **Step 3: Add `resources` to `OptionResponse`**

In `DecisionDto.kt`, add the field to `OptionResponse`:
```kotlin
data class OptionResponse(
    val id: Long,
    val title: String,
    val description: String?,
    val sortOrder: Int,
    val voterUserIds: List<Long>,
    val proCons: List<ProConResponse>,
    val resources: List<OptionResourceResponse> = emptyList(),
)
```

- [ ] **Step 4: Thread `resources` through `Option.toResponse` + populate in `getSubPlanDetail`**

In `PlanService.kt`, change the private `Option.toResponse` to accept resources (default empty, so the plan/canvas call sites are unaffected):
```kotlin
    private fun Option.toResponse(
        votes: List<OptionVote> = emptyList(),
        proCons: List<OptionProCon> = emptyList(),
        resources: List<OptionResourceResponse> = emptyList(),
    ): OptionResponse = OptionResponse(
        id = id!!,
        title = title,
        description = description,
        sortOrder = sortOrder,
        voterUserIds = votes.map { it.userId },
        proCons = proCons.sortedWith(compareBy({ it.kind }, { it.sortOrder }, { it.id }))
            .map { ProConResponse(it.id!!, it.kind, it.content, it.createdByUserId) },
        resources = resources,
    )
```
Inject `OptionResourceService` into `PlanService`'s constructor (add `private val optionResourceService: OptionResourceService,`). In `getSubPlanDetail`, after `proConsByOption` is computed, add:
```kotlin
        val resourcesByOption = optionResourceService.listForOptions(optionIds)
```
and change the `options =` mapping in the returned `SubPlanDetailResponse` to:
```kotlin
            options = options.map { it.toResponse(votesByOption[it.id] ?: emptyList(), proConsByOption[it.id] ?: emptyList(), resourcesByOption[it.id] ?: emptyList()) },
```
> Leave the other two `Option.toResponse` call sites (plan detail ~236, canvas ~481) unchanged — they render on surfaces without per-option 자료, so their default-empty `resources` avoids extra queries.

- [ ] **Step 5: Purge option resources in both teardown paths**

Inject `OptionResourceRepository`, `OptionAttachmentRepository`, `OptionAttachmentService` into `PlanService` (constructor).

Add a private helper:
```kotlin
    /** Remove an option's 자료 rows + attachments (FK-safe: resources+flush before
     *  attachments, which have ON DELETE RESTRICT), deleting the underlying files. */
    private fun purgeOptionResources(optionIds: Collection<Long>) {
        if (optionIds.isEmpty()) return
        val rows = optionResourceRepository.findAllByOptionIdIn(optionIds)
        optionResourceRepository.deleteAll(rows)
        optionResourceRepository.flush()
        rows.forEach { r -> r.attachmentId?.let { id -> optionAttachmentRepository.findById(id).ifPresent { optionAttachmentService.delete(it) } } }
        // Any file-less orphan attachments (shouldn't happen, but be safe): remove remaining by option.
        optionIds.forEach { oid -> optionAttachmentRepository.findAllByOptionId(oid).forEach { optionAttachmentService.delete(it) } }
    }
```

In `deleteSubPlanCascade`, before `optionRepository.deleteAll(options)` (and after the proCon deletion), add:
```kotlin
        purgeOptionResources(optionIds)
```

In `deleteOption`, before `optionRepository.delete(option)` (after the proCon deletion), add:
```kotlin
        purgeOptionResources(listOf(optionId))
```

- [ ] **Step 6: Write `OptionResourceController`**

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
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api")
class OptionResourceController(
    private val service: OptionResourceService,
) {
    @PostMapping("/options/{optionId}/resources")
    fun addLink(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
        @Valid @RequestBody request: CreateLinkResourceRequest,
    ): ResponseEntity<OptionResourceResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addLink(ws.id!!, optionId, me.userId, request))

    @PostMapping("/options/{optionId}/resources/file")
    fun addFile(
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @PathVariable optionId: Long,
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<OptionResourceResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.addFile(ws.id!!, optionId, me.userId, file))

    @DeleteMapping("/option-resources/{resourceId}")
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

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.decision.OptionResourcePurgeTest" --tests "com.shareddocs.backend.decision.OptionResourceServiceTest" --tests "com.shareddocs.backend.decision.PlanServiceTest" -q`
Expected: PASS — purge leaves no rows/attachments, service tests still green, plan detail still builds.

- [ ] **Step 8: Full backend suite**

Run: `cd shared-docs-backend && ./gradlew test -q`
Expected: PASS (whole decision suite; confirms `getSubPlanDetail` + purge changes didn't regress).

- [ ] **Step 9: Commit**

```bash
git add shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/OptionResourceController.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/DecisionDto.kt \
  shared-docs-backend/src/main/kotlin/com/shareddocs/backend/decision/PlanService.kt \
  shared-docs-backend/src/test/kotlin/com/shareddocs/backend/decision/OptionResourcePurgeTest.kt
git commit -m "feat(decisions): option resources API + detail wiring + purge"
```

---

## Task 5: Frontend types + api hooks + icon-spec generalization

**Files:**
- Modify: `shared-docs/src/features/decisions/types.ts` (add `OptionResource`; add `resources` to `OptionNode`)
- Modify: `shared-docs/src/features/decisions/api.ts` (3 hooks)
- Modify: `shared-docs/src/features/decisions/resourceIcon.ts` (accept a structural type so both `PlanResource` and `OptionResource` work)

**Interfaces:**
- Produces: `OptionResource` type; `OptionNode.resources: OptionResource[]`; `useAddOptionLinkResource(optionId)`, `useUploadOptionResourceFile(optionId)`, `useDeleteOptionResource()`.

- [ ] **Step 1: Add types**

In `types.ts`, add `resources: OptionResource[]` to `OptionNode`:
```ts
export type OptionNode = {
  id: number
  title: string
  description: string | null
  sortOrder: number
  proCons: ProCon[]
  voterUserIds: number[]
  resources: OptionResource[]
}
```
And add the `OptionResource` type (structurally identical to `PlanResource` but keyed by option) near `PlanResource`:
```ts
export type OptionResource = {
  id: number
  optionId: number
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
```

- [ ] **Step 2: Generalize `resourceIconSpec`**

In `resourceIcon.ts`, change the parameter type from `PlanResource` to a structural subset so it accepts `OptionResource` too. Add near the top:
```ts
type ResourceLike = Pick<PlanResource, 'kind' | 'url' | 'originalFilename' | 'contentType'>
```
and change the signature to `export function resourceIconSpec(resource: ResourceLike): ResourceIconSpec`. (Body unchanged — it only reads those four fields. Keep the `PlanResource` import for the `Pick`.)

- [ ] **Step 3: Add the api hooks**

In `api.ts`, after the ProCon mutations (~line 257), add:
```ts
// ── Option 자료 (per-candidate sources) mutations ──
export function useAddOptionLinkResource(optionId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (payload: CreateLinkResourcePayload) =>
      (await apiClient.post(`/api/options/${optionId}/resources`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useUploadOptionResourceFile(optionId: number) {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return (await apiClient.post(`/api/options/${optionId}/resources/file`, form,
        { headers: { 'Content-Type': 'multipart/form-data' } })).data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
export function useDeleteOptionResource() {
  const qc = useQueryClient(); const { activeId } = useActiveWorkspace()
  return useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/option-resources/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: decisionKeys.scope(activeId) }),
  })
}
```
Ensure `CreateLinkResourcePayload` is imported in `api.ts` (it already is — used by the plan resource hooks).

- [ ] **Step 4: Verify build + lint**

Run: `cd shared-docs && npm run build && npx eslint src/features/decisions/`
Expected: build succeeds; eslint clean on the decisions folder.

- [ ] **Step 5: Commit**

```bash
git add shared-docs/src/features/decisions/types.ts shared-docs/src/features/decisions/api.ts \
  shared-docs/src/features/decisions/resourceIcon.ts
git commit -m "feat(decisions): FE types + api hooks for option sources"
```

---

## Task 6: ImageLightbox primitive (FE)

**Files:**
- Create: `shared-docs/src/components/ui/ImageLightbox.tsx`
- Create: `shared-docs/src/components/ui/ImageLightbox.module.css`
- Modify: `shared-docs/src/components/ui/index.ts` (export it — confirm the barrel filename; it's the file that re-exports `Modal`, `IconButton`, etc.)

**Interfaces:**
- Produces: `<ImageLightbox src={string} alt={string} onClose={() => void} />` — a portal overlay; closes on backdrop click, Esc, or the close button.

- [ ] **Step 1: Write the component**

`ImageLightbox.tsx`:
```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import styles from './ImageLightbox.module.css'

type Props = { src: string; alt: string; onClose: () => void }

/** Full-size image overlay. Closes on Esc / backdrop / close button. */
export default function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}>
      <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
        <X size={20} />
      </button>
      <img className={styles.image} src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  )
}
```

`ImageLightbox.module.css`:
```css
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-6);
  background: rgba(0, 0, 0, .72);
}
.image {
  max-width: 92vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: var(--r-sm);
}
.close {
  position: fixed;
  top: var(--sp-4);
  right: var(--sp-4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--r-pill);
  background: rgba(0, 0, 0, .5);
  color: #fff;
  cursor: pointer;
}
.close:hover { background: rgba(0, 0, 0, .75); }
```

- [ ] **Step 2: Export from the ui barrel**

Add to `src/components/ui/index.ts` (match the existing export style in that file):
```ts
export { default as ImageLightbox } from './ImageLightbox'
```

- [ ] **Step 3: Verify build + lint**

Run: `cd shared-docs && npm run build && npx eslint src/components/ui/`
Expected: build + lint clean.

- [ ] **Step 4: Commit**

```bash
git add shared-docs/src/components/ui/ImageLightbox.tsx shared-docs/src/components/ui/ImageLightbox.module.css shared-docs/src/components/ui/index.ts
git commit -m "feat(ui): ImageLightbox overlay primitive"
```

---

## Task 7: OptionResourceSection (FE)

**Files:**
- Create: `shared-docs/src/features/decisions/OptionResourceSection.tsx`
- Create: `shared-docs/src/features/decisions/OptionResourceSection.module.css`

**Interfaces:**
- Consumes: `OptionResource` (Task 5), `useAddOptionLinkResource`/`useUploadOptionResourceFile`/`useDeleteOptionResource` (Task 5), `resourceIconSpec` (Task 5), `ImageLightbox` (Task 6), `LinkResourceModal`, `absoluteFileUrl`, `formatBytes`, `ConfirmDialog`.
- Produces: `<OptionResourceSection optionId={number} resources={OptionResource[]} locked={boolean} />` (locked is accepted for signature parity but does NOT gate — sources stay writable).

- [ ] **Step 1: Write the component**

`OptionResourceSection.tsx`:
```tsx
import { useRef, useState } from 'react'
import { Paperclip, Plus, Trash2 } from 'lucide-react'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ImageLightbox } from '../../components/ui'
import { formatBytes } from '../../lib/format'
import { absoluteFileUrl } from '../../lib/files'
import { useAddOptionLinkResource, useUploadOptionResourceFile, useDeleteOptionResource } from './api'
import { resourceIconSpec } from './resourceIcon'
import LinkResourceModal from './LinkResourceModal'
import type { OptionResource } from './types'
import styles from './OptionResourceSection.module.css'

type Props = { optionId: number; resources: OptionResource[] }

const isImage = (r: OptionResource) => (r.contentType ?? '').startsWith('image/')

export default function OptionResourceSection({ optionId, resources }: Props) {
  const addLink = useAddOptionLinkResource(optionId)
  const uploadFile = useUploadOptionResourceFile(optionId)
  const deleteResource = useDeleteOptionResource()
  const [linkOpen, setLinkOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<OptionResource | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const images = resources.filter(isImage)
  const rows = resources.filter((r) => !isImage(r))

  const handleFilePick = (file: File) => {
    uploadFile.mutate(file, {
      onError: (err) => window.alert(err instanceof Error ? err.message : '업로드에 실패했어요.'),
    })
  }

  return (
    <section className={styles.section} aria-label="자료">
      <header className={styles.header}>
        <h4 className={styles.heading}><Paperclip size={13} aria-hidden /> 자료</h4>
        <div className={styles.actions}>
          <button type="button" className={styles.addButton} onClick={() => setLinkOpen(true)}>
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

      {images.length > 0 && (
        <ul className={styles.thumbs}>
          {images.map((r) => {
            const src = absoluteFileUrl(r.fileUrl ?? '')
            const label = r.originalFilename ?? '이미지'
            return (
              <li key={r.id} className={styles.thumb}>
                <button type="button" className={styles.thumbBtn} onClick={() => setLightbox({ src, alt: label })}>
                  <img className={styles.thumbImg} src={src} alt={label} loading="lazy" />
                </button>
                <button
                  type="button"
                  className={styles.thumbRemove}
                  aria-label={`${label} 삭제`}
                  onClick={() => setConfirmTarget(r)}
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((r) => {
            const { Icon, tintVar, colorVar } = resourceIconSpec(r)
            const label = r.title ?? r.originalFilename ?? r.url ?? '자료'
            const href = r.kind === 'LINK' ? (r.url ?? '#') : absoluteFileUrl(r.fileUrl ?? '')
            return (
              <li key={r.id} className={styles.row}>
                <span className={styles.tile} style={{ background: tintVar, color: colorVar }} aria-hidden="true">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <a className={styles.name} href={href} target="_blank" rel="noreferrer" title={label}>{label}</a>
                {r.kind === 'FILE' && r.sizeBytes != null && (
                  <span className={styles.meta}>{formatBytes(r.sizeBytes)}</span>
                )}
                <button type="button" className={styles.remove} aria-label={`${label} 삭제`} onClick={() => setConfirmTarget(r)}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <LinkResourceModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        busy={addLink.isPending}
        onSubmit={(payload) => addLink.mutate(payload, { onSuccess: () => setLinkOpen(false) })}
      />
      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}
        title={`${confirmTarget?.title ?? confirmTarget?.originalFilename ?? confirmTarget?.url ?? '자료'}을(를) 삭제할까요?`}
        confirmLabel="삭제"
        destructive
        onConfirm={() => { if (confirmTarget) deleteResource.mutate(confirmTarget.id); setConfirmTarget(null) }}
      />
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </section>
  )
}
```

`OptionResourceSection.module.css`:
```css
.section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.heading {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-muted);
  margin: 0;
}
.actions { display: flex; gap: var(--sp-2); }
.addButton {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
  cursor: pointer;
}
.addButton:hover { background: var(--c-surface-tint); color: var(--c-text); }
.hiddenInput { display: none; }

.thumbs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.thumb { position: relative; }
.thumbBtn {
  display: block;
  padding: 0;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: none;
  cursor: pointer;
  overflow: hidden;
}
.thumbImg {
  display: block;
  width: 84px;
  height: 84px;
  object-fit: cover;
}
.thumbRemove {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--r-sm);
  background: rgba(0, 0, 0, .55);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity .12s;
}
.thumb:hover .thumbRemove,
.thumb:focus-within .thumbRemove { opacity: 1; }

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: var(--c-surface);
}
.row:hover { background: var(--c-surface-tint); }
.tile {
  flex: none;
  width: 26px;
  height: 26px;
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
.name:hover { text-decoration: underline; }
.meta { flex: none; font-size: var(--fs-xs); color: var(--c-text-subtle); }
.remove {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-subtle);
  cursor: pointer;
}
.remove:hover { background: var(--c-danger-soft); color: var(--c-danger); }
```
> Verify `ConfirmDialog`'s prop names against `src/components/ui/ConfirmDialog.tsx` (this plan uses `open`/`onOpenChange`/`title`/`confirmLabel`/`destructive`/`onConfirm`, matching `ResourceSection.tsx`). Verify `--c-danger-soft`/`--c-danger` token names exist (used by `ResourceSection.module.css`).

- [ ] **Step 2: Verify build + lint**

Run: `cd shared-docs && npm run build && npx eslint src/features/decisions/`
Expected: build + lint clean.

- [ ] **Step 3: Commit**

```bash
git add shared-docs/src/features/decisions/OptionResourceSection.tsx shared-docs/src/features/decisions/OptionResourceSection.module.css
git commit -m "feat(decisions): OptionResourceSection — thumbnails + rows + lightbox"
```

---

## Task 8: Wire into OptionRow (FE)

**Files:**
- Modify: `shared-docs/src/features/decisions/OptionRow.tsx`
- Modify: `shared-docs/src/features/decisions/OptionRow.module.css`

**Interfaces:**
- Consumes: `OptionResourceSection` (Task 7); `option.resources` (Task 5 added it to `OptionNode`; `SubPlanDetail` already passes the full `option`).

- [ ] **Step 1: Render the section + collapsed-row count**

In `OptionRow.tsx`:
- Import: `import OptionResourceSection from './OptionResourceSection'` and add `Paperclip` to the lucide import.
- In the collapsed head, next to the existing `proConCount` span (before the vote button), add a source count when present:
```tsx
        {option.resources.length > 0 && (
          <span className={styles.proConCount}>
            <Paperclip size={13} /> 자료 {option.resources.length}
          </span>
        )}
```
- In the expanded `.body`, render the section as the FIRST child (above `<ProConSection>`):
```tsx
      {open && (
        <div className={styles.body}>
          {option.description && <p className={styles.desc}>{option.description}</p>}
          <OptionResourceSection optionId={option.id} resources={option.resources} />
          <ProConSection optionId={option.id} proCons={option.proCons} locked={!!locked} />
          ...
```

- [ ] **Step 2: Verify build + lint**

Run: `cd shared-docs && npm run build && npx eslint src/features/decisions/`
Expected: build + lint clean.

- [ ] **Step 3: Manual verification (dev server)**

Run: `cd shared-docs && npm run dev`, open a 안건 detail page, expand a candidate:
- `+ 파일` an image → thumbnail appears; click it → lightbox opens; Esc/backdrop closes.
- `+ 링크` → row appears with the link icon; `+ 파일` a PDF → row with file icon + size.
- Delete via the trash affordance → ConfirmDialog → row/thumb disappears.
- Collapse the candidate → `자료 N` count shows next to `장단점 N`.
- (If a second browser/profile is handy) the added source appears there too (realtime).

- [ ] **Step 4: Commit**

```bash
git add shared-docs/src/features/decisions/OptionRow.tsx shared-docs/src/features/decisions/OptionRow.module.css
git commit -m "feat(decisions): show per-candidate 자료 in OptionRow + collapsed count"
```

---

## Final: whole-branch review, merge, deploy, verify

- Whole-branch review (opus) both repos.
- Merge to `main`; push. FE → Vercel; BE → Mac Mini CD applies Flyway V27.
- Verify BE: `docker logs shared-docs-backend | grep flyway` → `now at version v27`; `curl -s localhost:8090/actuator/health` → `{"status":"UP"}`.
- Verify FE: the `SubPlanDetail-*` chunk carries a new marker (e.g. `자료 ` count / `OptionResourceSection` strings).
- Update `shared-docs/CLAUDE.md` (Flyway V26→V27; new feature-table row + changelog entry).

---

## Self-Review

**Spec coverage:** per-option sources ✅ (T1–T8); thumbnails+rows ✅ (T7); above 장점/단점 ✅ (T8); collapsed 📎 count ✅ (T8, Lucide Paperclip); not lock-gated ✅ (T3, tested); lightbox ✅ (T6); own tables mirroring plan + FK ✅ (T1); resources in subplan detail ✅ (T4); endpoints ✅ (T4); quota shared ✅ (T2); purge with option ✅ (T4, tested); realtime ✅ (T3 `changes.publish`). Non-goals (plan/안건-level adds, link preview scraping, rename UI, reorder, gallery nav) — none introduced.

**Placeholder scan:** two explicit "confirm/verify" notes (PlanService soft/permanent-delete method names in T4-Step1; ConfirmDialog props + `--c-danger*` tokens in T7) are runtime-checkable pointers, not missing content — the surrounding code is complete.

**Type consistency:** `OptionResourceResponse` (BE) ↔ `OptionResource` (FE) fields match; `Option.toResponse(votes, proCons, resources)` arg order consistent between definition (T4-Step4) and call site; `useAddOptionLinkResource`/`useUploadOptionResourceFile`/`useDeleteOptionResource` names consistent T5↔T7; `OptionResourceKind` (BE enum) serialized as `kind: String` → FE `PlanResourceKind` union `'LINK'|'FILE'` matches.
