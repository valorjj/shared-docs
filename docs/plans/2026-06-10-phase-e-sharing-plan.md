# Phase E — Per-Note Cross-Workspace Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a note's author (or workspace owner) grant a specific outside user `VIEW`/`EDIT` access to one note; the recipient sees it in a workspace-independent "공유받은 항목" view and opens it read-only or editable.

**Architecture:** A generic `resource_shares` table (wired only for `NOTE` now) plus two separated API halves: grant-management endpoints under the workspace-scoped `/api/notes/:id/shares`, and cross-workspace access under `/api/shares/*` (resolved purely by grant, no workspace filter — keeps CLAUDE.md rule #9 absolute). Frontend reuses the existing Tiptap `NoteEditorBody` in a new `minimal` mode for the shared viewer.

**Tech Stack:** Spring Boot 3.5 + Kotlin + JPA + Flyway (MariaDB); Vite + React 19 + TS + React Query + React Router v6 + axios + Tiptap.

**Design doc:** `docs/plans/2026-06-10-phase-e-sharing-design.md`

**Repos:**
- Backend: `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend` (branch `phase-e-sharing`)
- Frontend: `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs` (branch `phase-e-sharing`)

**Conventions reminder:**
- Backend exceptions use `ApiException` subclasses (RFC 7807), NOT `ResponseStatusException`.
- Repositories return `Optional<T>` (except `UserRepository.findByEmail` → `User?`).
- All entities extend `BaseEntity` (id/version/createdAt/updatedAt, auditing + optimistic lock).
- Backend tests: `@SpringBootTest @ActiveProfiles("test") @Transactional`, build with `./gradlew test`.
- Frontend type-check: `npx tsc -b --noEmit` (root `tsconfig.json` is a references stub — plain `tsc --noEmit` is a NO-OP). Authoritative gate: `npm run build`. Lint: `npx eslint src/features/shares`.
- All UI text Korean; Lucide icons; CSS Modules + tokens.

---

## File Structure

**Backend** (`src/main/kotlin/com/shareddocs/backend/share/` — new package):
- `ResourceShare.kt` — entity (polymorphic `resourceKind` + `resourceId`).
- `ShareEnums.kt` — `ResourceKind { NOTE }`, `SharePermission { VIEW, EDIT }`.
- `ResourceShareRepository.kt` — finders.
- `ShareExceptions.kt` — `ApiException` subclasses.
- `ShareDto.kt` — request/response DTOs.
- `ShareService.kt` — grant/revoke/list/resolve/update-shared.
- `NoteShareController.kt` — grant management (`/api/notes/:id/shares`).
- `SharedAccessController.kt` — cross-workspace access (`/api/shares/*`).
- `src/main/resources/db/migration/V17__resource_shares.sql` — table.
- Tests: `share/ShareServiceTest.kt`, `share/SharedAccessTest.kt`.

**Frontend** (`src/features/shares/` — new feature):
- `types.ts` — DTO mirrors.
- `api.ts` — React Query keys + hooks.
- `ShareDialog.tsx` + `.module.css` — manage grants on a note.
- `SharedItemList.tsx` + `.module.css` — `/shared` route ("공유받은 항목").
- `SharedNoteView.tsx` + `.module.css` — open a shared note (reuses `NoteEditorBody`).
- Modified: `src/api/client.ts` (exempt `/api/shares`), `src/App.tsx` (route + lazy), nav menu, `src/features/notes/editor/NoteEditorBody.tsx` (`minimal` mode), `src/features/notes/editor/NoteEditor.tsx` (Share action trigger).

---

## BACKEND

### Task 1: ResourceShare entity, enums, migration, repository

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/share/ShareEnums.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/share/ResourceShare.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/share/ResourceShareRepository.kt`
- Create: `src/main/resources/db/migration/V17__resource_shares.sql`
- Test: `src/test/kotlin/com/shareddocs/backend/share/ResourceShareRepositoryTest.kt`

- [ ] **Step 1: Write the migration**

`V17__resource_shares.sql`:
```sql
CREATE TABLE `resource_shares` (
  `id`                   bigint(20)   NOT NULL AUTO_INCREMENT,
  `resource_kind`        varchar(32)  NOT NULL,
  `resource_id`          bigint(20)   NOT NULL,
  `granted_to_user_id`   bigint(20)   NOT NULL,
  `granted_by_user_id`   bigint(20)   NOT NULL,
  `permission`           varchar(16)  NOT NULL,
  `version`              bigint(20)   NOT NULL DEFAULT 0,
  `created_at`           datetime(6)  NOT NULL,
  `updated_at`           datetime(6)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_resource_shares_kind_id_recipient` (`resource_kind`, `resource_id`, `granted_to_user_id`),
  KEY `idx_resource_shares_recipient` (`granted_to_user_id`),
  CONSTRAINT `fk_resource_shares_recipient` FOREIGN KEY (`granted_to_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_resource_shares_granter` FOREIGN KEY (`granted_by_user_id`)
      REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
> `resource_id` carries no FK — it is polymorphic (one column referencing different tables by `resource_kind`). The service layer verifies the referenced note exists. This is the documented exception to FK-everywhere.

- [ ] **Step 2: Write the enums**

`ShareEnums.kt`:
```kotlin
package com.shareddocs.backend.share

enum class ResourceKind { NOTE }

enum class SharePermission { VIEW, EDIT }
```

- [ ] **Step 3: Write the entity**

`ResourceShare.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Index
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint

@Entity
@Table(
    name = "resource_shares",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uq_resource_shares_kind_id_recipient",
            columnNames = ["resource_kind", "resource_id", "granted_to_user_id"],
        ),
    ],
    indexes = [Index(name = "idx_resource_shares_recipient", columnList = "granted_to_user_id")],
)
class ResourceShare(
    @Enumerated(EnumType.STRING)
    @Column(name = "resource_kind", nullable = false, length = 32, updatable = false)
    val resourceKind: ResourceKind,

    @Column(name = "resource_id", nullable = false, updatable = false)
    val resourceId: Long,

    @Column(name = "granted_to_user_id", nullable = false, updatable = false)
    val grantedToUserId: Long,

    @Column(name = "granted_by_user_id", nullable = false, updatable = false)
    val grantedByUserId: Long,

    @Enumerated(EnumType.STRING)
    @Column(name = "permission", nullable = false, length = 16)
    var permission: SharePermission,
) : BaseEntity()
```

- [ ] **Step 4: Write the repository**

`ResourceShareRepository.kt`:
```kotlin
package com.shareddocs.backend.share

import org.springframework.data.jpa.repository.JpaRepository

interface ResourceShareRepository : JpaRepository<ResourceShare, Long> {
    fun findByResourceKindAndResourceIdAndGrantedToUserId(
        resourceKind: ResourceKind,
        resourceId: Long,
        grantedToUserId: Long,
    ): ResourceShare?

    fun findAllByResourceKindAndResourceId(
        resourceKind: ResourceKind,
        resourceId: Long,
    ): List<ResourceShare>

    fun findAllByResourceKindAndGrantedToUserId(
        resourceKind: ResourceKind,
        grantedToUserId: Long,
    ): List<ResourceShare>
}
```

- [ ] **Step 5: Write the repository test**

`ResourceShareRepositoryTest.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ResourceShareRepositoryTest(
    @Autowired private val shares: ResourceShareRepository,
    @Autowired private val users: UserRepository,
) {
    private fun newUser(): User =
        users.save(User(email = "u-${UUID.randomUUID()}@t.test", name = "U", role = Role.USER))

    @Test
    fun `finds a share by kind, resource, and recipient`() {
        val recipient = newUser()
        val granter = newUser()
        shares.save(ResourceShare(ResourceKind.NOTE, 100L, recipient.id!!, granter.id!!, SharePermission.VIEW))

        val found = shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, 100L, recipient.id!!)
        assertNotNull(found)
        assertEquals(SharePermission.VIEW, found!!.permission)

        val missing = shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, 999L, recipient.id!!)
        assertNull(missing)
    }

    @Test
    fun `lists all shares for a recipient`() {
        val recipient = newUser()
        val granter = newUser()
        shares.save(ResourceShare(ResourceKind.NOTE, 1L, recipient.id!!, granter.id!!, SharePermission.VIEW))
        shares.save(ResourceShare(ResourceKind.NOTE, 2L, recipient.id!!, granter.id!!, SharePermission.EDIT))

        val mine = shares.findAllByResourceKindAndGrantedToUserId(ResourceKind.NOTE, recipient.id!!)
        assertEquals(2, mine.size)
    }
}
```

- [ ] **Step 6: Run tests**

Run: `cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend && ./gradlew test --tests "com.shareddocs.backend.share.ResourceShareRepositoryTest"`
Expected: PASS (2 tests). Flyway applies V17 against the test DB; Hibernate `validate` confirms the entity matches.

- [ ] **Step 7: Commit**
```bash
git add src/main/kotlin/com/shareddocs/backend/share src/main/resources/db/migration/V17__resource_shares.sql src/test/kotlin/com/shareddocs/backend/share/ResourceShareRepositoryTest.kt
git commit -m "feat(phase-e): resource_shares entity, migration, repository"
```

---

### Task 2: Share exceptions and DTOs

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/share/ShareExceptions.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/share/ShareDto.kt`

- [ ] **Step 1: Write the exceptions**

`ShareExceptions.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.common.ApiException
import org.springframework.http.HttpStatus

/** The note to share/manage was not found in the granter's workspace. */
class ShareNoteNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "share-note-not-found", "Note not found", "메모를 찾을 수 없어요.")

/** Caller is neither the note author nor the workspace owner. */
class ShareForbiddenException :
    ApiException(HttpStatus.FORBIDDEN, "share-forbidden", "Cannot share", "이 메모를 공유할 권한이 없어요.")

/** No user exists for the given email. */
class ShareRecipientNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "share-recipient-not-found", "User not found", "이 이메일의 사용자가 없어요. 먼저 가입해야 공유할 수 있어요.")

/** Trying to share with yourself. */
class ShareSelfException :
    ApiException(HttpStatus.BAD_REQUEST, "share-self", "Cannot share with self", "자신에게는 공유할 수 없어요.")

/** Recipient is already an active member of the note's workspace. */
class ShareExistingMemberException :
    ApiException(HttpStatus.BAD_REQUEST, "share-existing-member", "Already a member", "이미 워크스페이스 멤버예요.")

/** The shared resource (by grant) was not found for this caller. Used by /api/shares/*. */
class SharedResourceNotFoundException :
    ApiException(HttpStatus.NOT_FOUND, "shared-resource-not-found", "Shared item not found", "공유받은 항목을 찾을 수 없어요.")

/** Caller has VIEW permission but attempted to edit. */
class ShareViewOnlyException :
    ApiException(HttpStatus.FORBIDDEN, "share-view-only", "View only", "보기 전용으로 공유받았어요.")
```

- [ ] **Step 2: Write the DTOs**

`ShareDto.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.note.NoteResponse
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import java.time.Instant

/** POST /api/notes/:id/shares */
data class GrantShareRequest(
    @field:NotBlank @field:Email val email: String,
    val permission: SharePermission = SharePermission.VIEW,
)

/** PATCH /api/notes/:id/shares/:userId */
data class UpdateShareRequest(
    val permission: SharePermission,
)

/** One grant row, as shown in the ShareDialog. */
data class ShareResponse(
    val grantedToUserId: Long,
    val recipientName: String,
    val recipientEmail: String,
    val permission: SharePermission,
    val createdAt: Instant,
)

/** A note shared with me, as listed in 공유받은 항목. */
data class SharedNoteSummary(
    val noteId: Long,
    val title: String?,
    val ownerName: String,
    val permission: SharePermission,
    val sharedAt: Instant,
)

/** Full shared note + my effective permission (GET /api/shares/notes/:id). */
data class SharedNoteResponse(
    val note: NoteResponse,
    val effectivePermission: SharePermission,
) {
    companion object {
        fun from(note: com.shareddocs.backend.note.Note, permission: SharePermission) =
            SharedNoteResponse(note = NoteResponse.from(note), effectivePermission = permission)
    }
}
```

- [ ] **Step 3: Verify compile**

Run: `cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs-backend && ./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL. (`NoteResponse.from` and `Note` are existing public types in package `note`.)

- [ ] **Step 4: Commit**
```bash
git add src/main/kotlin/com/shareddocs/backend/share/ShareExceptions.kt src/main/kotlin/com/shareddocs/backend/share/ShareDto.kt
git commit -m "feat(phase-e): share exceptions and DTOs"
```

---

### Task 3: ShareService — grant, revoke, list, resolve, update-shared

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/share/ShareService.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/share/ShareServiceTest.kt`

**Context:** This is the core. The granter is identified by `granterUserId` + the `@CurrentWorkspace` (workspace owner = `ws.createdByUserId`). The recipient must be an existing user, not the granter, and not already an active member of the note's workspace. `resolveNotePermission` / `updateSharedNote` power the cross-workspace `/api/shares/*` path and load the note WITHOUT a workspace filter (`noteRepository.findById`). `EntityRefIndexer.reindex` is reused so edited shared notes keep their `@`-mention edges fresh in the owner's workspace.

- [ ] **Step 1: Write the failing test**

`ShareServiceTest.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.UpdateNoteRequest
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.Workspace
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ShareServiceTest(
    @Autowired private val shareService: ShareService,
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val users: UserRepository,
) {
    private fun newUser(name: String = "U"): User =
        users.save(User(email = "u-${UUID.randomUUID()}@t.test", name = name, role = Role.USER))

    private fun wsFor(userId: Long): Workspace = workspaces.create(userId, "WS", "ws-${UUID.randomUUID().toString().take(8)}")

    private fun noteIn(ws: Workspace, authorId: Long): Long =
        noteService.create(CreateNoteRequest(title = "n", body = "<p>hi</p>", visibility = Visibility.WORKSPACE), ws.id!!, authorId).id

    @Test
    fun `grant creates a VIEW share for an existing user`() {
        val owner = newUser("owner"); val ws = wsFor(owner.id!!)
        val recipient = newUser("rec")
        val noteId = noteIn(ws, owner.id!!)

        val res = shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))

        assertEquals(recipient.id, res.grantedToUserId)
        assertEquals(SharePermission.VIEW, res.permission)
        assertEquals(SharePermission.VIEW, shareService.resolveNotePermission(noteId, recipient.id!!))
    }

    @Test
    fun `re-granting upserts permission, not a duplicate row`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val recipient = newUser()
        val noteId = noteIn(ws, owner.id!!)
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.EDIT))

        assertEquals(SharePermission.EDIT, shareService.resolveNotePermission(noteId, recipient.id!!))
        assertEquals(1, shareService.listForNote(noteId, ws, owner.id!!).size)
    }

    @Test
    fun `grant to unknown email throws recipient-not-found`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        assertThrows(ShareRecipientNotFoundException::class.java) {
            shareService.grant(noteId, ws, owner.id!!, GrantShareRequest("nobody@t.test", SharePermission.VIEW))
        }
    }

    @Test
    fun `grant to self throws share-self`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        assertThrows(ShareSelfException::class.java) {
            shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(owner.email, SharePermission.VIEW))
        }
    }

    @Test
    fun `non-author non-owner cannot grant`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        val stranger = newUser(); val recipient = newUser()
        assertThrows(ShareForbiddenException::class.java) {
            shareService.grant(noteId, ws, stranger.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))
        }
    }

    @Test
    fun `resolveNotePermission returns null for a non-grantee`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        val stranger = newUser()
        assertEquals(null, shareService.resolveNotePermission(noteId, stranger.id!!))
    }

    @Test
    fun `updateSharedNote with EDIT writes through`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val recipient = newUser()
        val noteId = noteIn(ws, owner.id!!)
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.EDIT))

        val res = shareService.updateSharedNote(noteId, recipient.id!!, UpdateNoteRequest(body = "<p>edited</p>"))
        assertEquals("<p>edited</p>", res.note.body)
        // owner sees the edit in their own workspace
        assertEquals("<p>edited</p>", noteService.get(noteId, ws.id!!, owner.id!!).body)
    }

    @Test
    fun `updateSharedNote with VIEW throws view-only`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val recipient = newUser()
        val noteId = noteIn(ws, owner.id!!)
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))
        assertThrows(ShareViewOnlyException::class.java) {
            shareService.updateSharedNote(noteId, recipient.id!!, UpdateNoteRequest(body = "<p>nope</p>"))
        }
    }

    @Test
    fun `updateSharedNote by a non-grantee throws shared-resource-not-found`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val noteId = noteIn(ws, owner.id!!)
        val stranger = newUser()
        assertThrows(SharedResourceNotFoundException::class.java) {
            shareService.updateSharedNote(noteId, stranger.id!!, UpdateNoteRequest(body = "<p>x</p>"))
        }
    }

    @Test
    fun `listSharedNotes returns shared notes with owner name and permission`() {
        val owner = newUser("Owner Park"); val ws = wsFor(owner.id!!); val recipient = newUser()
        val noteId = noteIn(ws, owner.id!!)
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))

        val mine = shareService.listSharedNotes(recipient.id!!)
        assertEquals(1, mine.size)
        assertEquals(noteId, mine[0].noteId)
        assertEquals("Owner Park", mine[0].ownerName)
        assertEquals(SharePermission.VIEW, mine[0].permission)
    }

    @Test
    fun `revoke removes the grant`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val recipient = newUser()
        val noteId = noteIn(ws, owner.id!!)
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.EDIT))
        shareService.revoke(noteId, ws, owner.id!!, recipient.id!!)
        assertEquals(null, shareService.resolveNotePermission(noteId, recipient.id!!))
    }

    @Test
    fun `granting a PRIVATE note is allowed`() {
        val owner = newUser(); val ws = wsFor(owner.id!!); val recipient = newUser()
        val privateNote = noteService.create(
            CreateNoteRequest(title = "secret", body = "<p>s</p>", visibility = Visibility.PRIVATE), ws.id!!, owner.id!!,
        ).id
        val res = shareService.grant(privateNote, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))
        assertTrue(res.grantedToUserId == recipient.id)
    }
}
```

> Note: `noteService.create(...).id` — `NoteResponse.id` is `Long`. `noteService.get(id, wsId, userId)` uses the 3-arg overload (`includeDeleted` defaults false).

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew test --tests "com.shareddocs.backend.share.ShareServiceTest"`
Expected: FAIL — `ShareService` does not exist / unresolved reference.

- [ ] **Step 3: Write the service**

`ShareService.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.note.EntityRefIndexer
import com.shareddocs.backend.note.NoteRepository
import com.shareddocs.backend.note.UpdateNoteRequest
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.Workspace
import com.shareddocs.backend.workspace.WorkspaceService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ShareService(
    private val shares: ResourceShareRepository,
    private val notes: NoteRepository,
    private val users: UserRepository,
    private val workspaceService: WorkspaceService,
    private val indexer: EntityRefIndexer,
) {
    /** Author or workspace owner grants a note to an existing outside user. Upserts. */
    fun grant(noteId: Long, ws: Workspace, granterUserId: Long, req: GrantShareRequest): ShareResponse {
        val note = notes.findByIdAndWorkspaceIdAndDeletedAtIsNull(noteId, ws.id!!)
            .orElseThrow { ShareNoteNotFoundException() }
        val isAuthor = note.createdBy.id == granterUserId
        val isOwner = ws.createdByUserId == granterUserId
        if (!isAuthor && !isOwner) throw ShareForbiddenException()

        val email = req.email.trim().lowercase()
        val recipient = users.findByEmail(email) ?: throw ShareRecipientNotFoundException()
        val recipientId = recipient.id!!
        if (recipientId == granterUserId) throw ShareSelfException()
        if (workspaceService.isActiveMember(ws.id!!, recipientId)) throw ShareExistingMemberException()

        val existing = shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, noteId, recipientId)
        val share = if (existing != null) {
            existing.permission = req.permission
            existing
        } else {
            shares.save(ResourceShare(ResourceKind.NOTE, noteId, recipientId, granterUserId, req.permission))
        }
        return ShareResponse(recipientId, recipient.name, recipient.email, share.permission, share.createdAt!!)
    }

    fun updatePermission(noteId: Long, ws: Workspace, granterUserId: Long, recipientUserId: Long, req: UpdateShareRequest): ShareResponse {
        val note = notes.findByIdAndWorkspaceIdAndDeletedAtIsNull(noteId, ws.id!!)
            .orElseThrow { ShareNoteNotFoundException() }
        if (note.createdBy.id != granterUserId && ws.createdByUserId != granterUserId) throw ShareForbiddenException()
        val share = shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, noteId, recipientUserId)
            ?: throw SharedResourceNotFoundException()
        share.permission = req.permission
        val recipient = users.findById(recipientUserId).orElseThrow { ShareRecipientNotFoundException() }
        return ShareResponse(recipientUserId, recipient.name, recipient.email, share.permission, share.createdAt!!)
    }

    fun revoke(noteId: Long, ws: Workspace, granterUserId: Long, recipientUserId: Long) {
        val note = notes.findByIdAndWorkspaceIdAndDeletedAtIsNull(noteId, ws.id!!)
            .orElseThrow { ShareNoteNotFoundException() }
        if (note.createdBy.id != granterUserId && ws.createdByUserId != granterUserId) throw ShareForbiddenException()
        val share = shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, noteId, recipientUserId)
            ?: return
        shares.delete(share)
    }

    @Transactional(readOnly = true)
    fun listForNote(noteId: Long, ws: Workspace, callerUserId: Long): List<ShareResponse> {
        val note = notes.findByIdAndWorkspaceIdAndDeletedAtIsNull(noteId, ws.id!!)
            .orElseThrow { ShareNoteNotFoundException() }
        if (note.createdBy.id != callerUserId && ws.createdByUserId != callerUserId) throw ShareForbiddenException()
        val rows = shares.findAllByResourceKindAndResourceId(ResourceKind.NOTE, noteId)
        if (rows.isEmpty()) return emptyList()
        val byId = users.findAllById(rows.map { it.grantedToUserId }).associateBy { it.id }
        return rows.mapNotNull { r ->
            val u = byId[r.grantedToUserId] ?: return@mapNotNull null
            ShareResponse(r.grantedToUserId, u.name, u.email, r.permission, r.createdAt!!)
        }
    }

    @Transactional(readOnly = true)
    fun resolveNotePermission(noteId: Long, userId: Long): SharePermission? =
        shares.findByResourceKindAndResourceIdAndGrantedToUserId(ResourceKind.NOTE, noteId, userId)?.permission

    @Transactional(readOnly = true)
    fun listSharedNotes(userId: Long): List<SharedNoteSummary> {
        val rows = shares.findAllByResourceKindAndGrantedToUserId(ResourceKind.NOTE, userId)
        if (rows.isEmpty()) return emptyList()
        val notesById = notes.findAllById(rows.map { it.resourceId })
            .filter { it.deletedAt == null }
            .associateBy { it.id }
        return rows.mapNotNull { r ->
            val note = notesById[r.resourceId] ?: return@mapNotNull null
            SharedNoteSummary(note.id!!, note.title, note.createdBy.name, r.permission, r.createdAt!!)
        }.sortedByDescending { it.sharedAt }
    }

    @Transactional(readOnly = true)
    fun getSharedNote(noteId: Long, userId: Long): SharedNoteResponse {
        val perm = resolveNotePermission(noteId, userId) ?: throw SharedResourceNotFoundException()
        val note = notes.findById(noteId).filter { it.deletedAt == null }.orElseThrow { SharedResourceNotFoundException() }
        return SharedNoteResponse.from(note, perm)
    }

    fun updateSharedNote(noteId: Long, userId: Long, req: UpdateNoteRequest): SharedNoteResponse {
        val perm = resolveNotePermission(noteId, userId) ?: throw SharedResourceNotFoundException()
        if (perm != SharePermission.EDIT) throw ShareViewOnlyException()
        val note = notes.findById(noteId).filter { it.deletedAt == null }.orElseThrow { SharedResourceNotFoundException() }
        req.title?.let { note.title = it.trim().takeIf { s -> s.isNotEmpty() } }
        val bodyChanged = req.body != null && req.body != note.body
        req.body?.let { note.body = it }
        // Shared editors cannot change pinned/visibility — only title/body.
        if (bodyChanged) indexer.reindex(note.id!!, note.workspaceId, note.body)
        return SharedNoteResponse.from(note, perm)
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./gradlew test --tests "com.shareddocs.backend.share.ShareServiceTest"`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**
```bash
git add src/main/kotlin/com/shareddocs/backend/share/ShareService.kt src/test/kotlin/com/shareddocs/backend/share/ShareServiceTest.kt
git commit -m "feat(phase-e): ShareService grant/revoke/resolve/update-shared"
```

---

### Task 4: Grant-management controller (workspace-scoped)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/share/NoteShareController.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/share/NoteShareControllerTest.kt`

**Context:** Mirrors `PlanController` style — `@CurrentWorkspace ws: Workspace` + `@AuthenticationPrincipal me: AppPrincipal`. The note is in the caller's workspace, so rule #9 holds.

- [ ] **Step 1: Write the controller**

`NoteShareController.kt`:
```kotlin
package com.shareddocs.backend.share

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
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/notes/{noteId}/shares")
class NoteShareController(
    private val service: ShareService,
) {
    @GetMapping
    fun list(
        @PathVariable noteId: Long,
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
    ): List<ShareResponse> = service.listForNote(noteId, ws, me.userId)

    @PostMapping
    fun grant(
        @PathVariable noteId: Long,
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @Valid @RequestBody request: GrantShareRequest,
    ): ResponseEntity<ShareResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.grant(noteId, ws, me.userId, request))

    @PatchMapping("/{recipientId}")
    fun update(
        @PathVariable noteId: Long,
        @PathVariable recipientId: Long,
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
        @Valid @RequestBody request: UpdateShareRequest,
    ): ShareResponse = service.updatePermission(noteId, ws, me.userId, recipientId, request)

    @DeleteMapping("/{recipientId}")
    fun revoke(
        @PathVariable noteId: Long,
        @PathVariable recipientId: Long,
        @CurrentWorkspace ws: Workspace,
        @AuthenticationPrincipal me: AppPrincipal,
    ): ResponseEntity<Void> {
        service.revoke(noteId, ws, me.userId, recipientId)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 2: Write the controller test (MockMvc-free; thin)**

Since service logic is covered in Task 3, this test asserts wiring via the service through a `@SpringBootTest`. `NoteShareControllerTest.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class NoteShareControllerTest(
    @Autowired private val controller: NoteShareController,
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val users: UserRepository,
) {
    private fun user() = users.save(User(email = "u-${UUID.randomUUID()}@t.test", name = "U", role = Role.USER))

    @Test
    fun `grant then list returns the recipient`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(6)}")
        val recipient = user()
        val noteId = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!).id
        val principal = com.shareddocs.backend.auth.AppPrincipal(owner.id!!, owner.email, owner.name, null, Role.USER)

        controller.grant(noteId, ws, principal, GrantShareRequest(recipient.email, SharePermission.EDIT))
        val list = controller.list(noteId, ws, principal)
        assertEquals(1, list.size)
        assertEquals(SharePermission.EDIT, list[0].permission)
    }
}
```

- [ ] **Step 3: Run tests**

Run: `./gradlew test --tests "com.shareddocs.backend.share.NoteShareControllerTest"`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**
```bash
git add src/main/kotlin/com/shareddocs/backend/share/NoteShareController.kt src/test/kotlin/com/shareddocs/backend/share/NoteShareControllerTest.kt
git commit -m "feat(phase-e): note share grant-management endpoints"
```

---

### Task 5: Shared-access controller (cross-workspace, `/api/shares/*`)

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/share/SharedAccessController.kt`
- Test: `src/test/kotlin/com/shareddocs/backend/share/SharedAccessControllerTest.kt`

**Context:** These endpoints do NOT take `@CurrentWorkspace` — access is resolved purely by grant. They take only `@AuthenticationPrincipal`. The `WorkspaceContextFilter` validates the (always-present, from the interceptor) header against the caller's own active workspace and passes; these handlers ignore it.

- [ ] **Step 1: Write the controller**

`SharedAccessController.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.note.UpdateNoteRequest
import jakarta.validation.Valid
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/shares")
class SharedAccessController(
    private val service: ShareService,
) {
    /** Notes shared with me — workspace-independent list. */
    @GetMapping
    fun listSharedWithMe(@AuthenticationPrincipal me: AppPrincipal): List<SharedNoteSummary> =
        service.listSharedNotes(me.userId)

    @GetMapping("/notes/{id}")
    fun getNote(
        @PathVariable id: Long,
        @AuthenticationPrincipal me: AppPrincipal,
    ): SharedNoteResponse = service.getSharedNote(id, me.userId)

    @PatchMapping("/notes/{id}")
    fun updateNote(
        @PathVariable id: Long,
        @AuthenticationPrincipal me: AppPrincipal,
        @Valid @RequestBody request: UpdateNoteRequest,
    ): SharedNoteResponse = service.updateSharedNote(id, me.userId, request)
}
```

- [ ] **Step 2: Write the test**

`SharedAccessControllerTest.kt`:
```kotlin
package com.shareddocs.backend.share

import com.shareddocs.backend.auth.AppPrincipal
import com.shareddocs.backend.note.CreateNoteRequest
import com.shareddocs.backend.note.NoteService
import com.shareddocs.backend.note.UpdateNoteRequest
import com.shareddocs.backend.note.Visibility
import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import com.shareddocs.backend.user.UserRepository
import com.shareddocs.backend.workspace.WorkspaceService
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SharedAccessControllerTest(
    @Autowired private val controller: SharedAccessController,
    @Autowired private val shareService: ShareService,
    @Autowired private val noteService: NoteService,
    @Autowired private val workspaces: WorkspaceService,
    @Autowired private val users: UserRepository,
) {
    private fun user() = users.save(User(email = "u-${UUID.randomUUID()}@t.test", name = "U", role = Role.USER))
    private fun principal(u: User) = AppPrincipal(u.id!!, u.email, u.name, null, Role.USER)

    @Test
    fun `recipient reads a shared note with its effective permission`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(6)}")
        val recipient = user()
        val noteId = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!).id
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))

        val res = controller.getNote(noteId, principal(recipient))
        assertEquals(noteId, res.note.id)
        assertEquals(SharePermission.VIEW, res.effectivePermission)
    }

    @Test
    fun `non-grantee gets 404 (shared-resource-not-found)`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(6)}")
        val stranger = user()
        val noteId = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!).id
        assertThrows(SharedResourceNotFoundException::class.java) { controller.getNote(noteId, principal(stranger)) }
    }

    @Test
    fun `EDIT recipient updates through the shared endpoint`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(6)}")
        val recipient = user()
        val noteId = noteService.create(CreateNoteRequest(body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!).id
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.EDIT))

        val res = controller.updateNote(noteId, principal(recipient), UpdateNoteRequest(body = "<p>edited</p>"))
        assertEquals("<p>edited</p>", res.note.body)
    }

    @Test
    fun `listSharedWithMe returns my shared notes`() {
        val owner = user(); val ws = workspaces.create(owner.id!!, "W", "w-${UUID.randomUUID().toString().take(6)}")
        val recipient = user()
        val noteId = noteService.create(CreateNoteRequest(title = "shared", body = "<p>x</p>", visibility = Visibility.WORKSPACE), ws.id!!, owner.id!!).id
        shareService.grant(noteId, ws, owner.id!!, GrantShareRequest(recipient.email, SharePermission.VIEW))

        val mine = controller.listSharedWithMe(principal(recipient))
        assertEquals(1, mine.size)
        assertEquals(noteId, mine[0].noteId)
    }
}
```

- [ ] **Step 3: Run tests + full backend suite**

Run: `./gradlew test --tests "com.shareddocs.backend.share.*"` then `./gradlew test`
Expected: all share tests PASS; full suite green (existing 83 + new share tests).

- [ ] **Step 4: Commit**
```bash
git add src/main/kotlin/com/shareddocs/backend/share/SharedAccessController.kt src/test/kotlin/com/shareddocs/backend/share/SharedAccessControllerTest.kt
git commit -m "feat(phase-e): cross-workspace /api/shares access endpoints"
```

---

## FRONTEND

### Task 6: API client exemption + shares types + React Query hooks

**Files:**
- Modify: `src/api/client.ts` (the `workspaceAgnostic` line)
- Create: `src/features/shares/types.ts`
- Create: `src/features/shares/api.ts`

- [ ] **Step 1: Exempt `/api/shares` from the workspace header**

In `src/api/client.ts`, find:
```typescript
  const workspaceAgnostic =
    url.startsWith('/api/workspaces') || url.startsWith('/api/auth') || url.startsWith('/api/invitations')
```
Replace with:
```typescript
  const workspaceAgnostic =
    url.startsWith('/api/workspaces') ||
    url.startsWith('/api/auth') ||
    url.startsWith('/api/invitations') ||
    url.startsWith('/api/shares')
```

- [ ] **Step 2: Write the types**

`src/features/shares/types.ts`:
```typescript
import type { Note } from '../notes/types'

export type SharePermission = 'VIEW' | 'EDIT'

/** One grant on a note (ShareDialog row). */
export type Share = {
  grantedToUserId: number
  recipientName: string
  recipientEmail: string
  permission: SharePermission
  createdAt: string
}

/** A note shared with me (공유받은 항목 row). */
export type SharedNoteSummary = {
  noteId: number
  title: string | null
  ownerName: string
  permission: SharePermission
  sharedAt: string
}

/** Full shared note + my effective permission. */
export type SharedNoteResponse = {
  note: Note
  effectivePermission: SharePermission
}

export type GrantSharePayload = { email: string; permission: SharePermission }
export type UpdateSharePayload = { permission: SharePermission }
```
> If `../notes/types` does not export `Note` under that path, the implementer should import the existing Note response type from wherever `useNote`/note hooks define it (look in `src/features/notes/`). The shape must match backend `NoteResponse` (id, title, body, pinned, visibility, createdBy, createdAt, updatedAt, deletedAt).

- [ ] **Step 3: Write the API hooks**

`src/features/shares/api.ts`:
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type {
  GrantSharePayload, Share, SharedNoteResponse, SharedNoteSummary, UpdateSharePayload,
} from './types'

export const shareKeys = {
  root: ['shares'] as const,
  sharedWithMe: ['shares', 'with-me'] as const,
  sharedNote: (noteId: number) => ['shares', 'note', noteId] as const,
  grants: (noteId: number) => ['shares', 'grants', noteId] as const,
}

/** 공유받은 항목 — notes shared with me. */
export function useSharedWithMe() {
  return useQuery({
    queryKey: shareKeys.sharedWithMe,
    queryFn: async () => (await apiClient.get<SharedNoteSummary[]>('/api/shares')).data,
  })
}

/** Open one shared note (read or edit). */
export function useSharedNote(noteId: number) {
  return useQuery({
    queryKey: shareKeys.sharedNote(noteId),
    queryFn: async () => (await apiClient.get<SharedNoteResponse>(`/api/shares/notes/${noteId}`)).data,
  })
}

/** Save edits to a shared note (EDIT permission). */
export function useUpdateSharedNote(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { title?: string; body?: string }) =>
      (await apiClient.patch<SharedNoteResponse>(`/api/shares/notes/${noteId}`, body)).data,
    onSuccess: (data) => qc.setQueryData(shareKeys.sharedNote(noteId), data),
  })
}

/** Grants on a note (ShareDialog). */
export function useNoteShares(noteId: number, enabled = true) {
  return useQuery({
    queryKey: shareKeys.grants(noteId),
    queryFn: async () => (await apiClient.get<Share[]>(`/api/notes/${noteId}/shares`)).data,
    enabled,
  })
}

export function useGrantShare(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: GrantSharePayload) =>
      (await apiClient.post<Share>(`/api/notes/${noteId}/shares`, p)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}

export function useUpdateGrant(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { recipientId: number; payload: UpdateSharePayload }) =>
      (await apiClient.patch<Share>(`/api/notes/${noteId}/shares/${v.recipientId}`, v.payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}

export function useRevokeShare(noteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (recipientId: number) => {
      await apiClient.delete(`/api/notes/${noteId}/shares/${recipientId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: shareKeys.grants(noteId) }),
  })
}
```

- [ ] **Step 4: Verify type-check**

Run: `cd /Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs && npx tsc -b --noEmit`
Expected: no errors. (If `Note` import path is wrong, fix per Step 2's note.)

- [ ] **Step 5: Commit**
```bash
git add src/api/client.ts src/features/shares/types.ts src/features/shares/api.ts
git commit -m "feat(phase-e-fe): shares api client + React Query hooks"
```

---

### Task 7: ShareDialog component

**Files:**
- Create: `src/features/shares/ShareDialog.tsx`
- Create: `src/features/shares/ShareDialog.module.css`

**Context:** Reuse the existing `Modal` primitive and form primitives (look in `src/components/ui` — same set used by `PlanModal`/`TitleDescModal`). The dialog lists current grants and an add row. On grant error with `body.type === 'share-recipient-not-found'`, show the inline Korean hint.

- [ ] **Step 1: Build the dialog**

`ShareDialog.tsx`:
```tsx
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button } from '../../components/ui'
import { ApiError } from '../../api/client'
import { useNoteShares, useGrantShare, useRevokeShare, useUpdateGrant } from './api'
import type { SharePermission } from './types'
import styles from './ShareDialog.module.css'

type Props = { noteId: number; open: boolean; onClose: () => void }

export default function ShareDialog({ noteId, open, onClose }: Props) {
  const shares = useNoteShares(noteId, open)
  const grant = useGrantShare(noteId)
  const revoke = useRevokeShare(noteId)
  const updateGrant = useUpdateGrant(noteId)

  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('VIEW')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) return
    grant.mutate(
      { email: trimmed, permission },
      {
        onSuccess: () => setEmail(''),
        onError: (e) => {
          const body = e instanceof ApiError ? e.body : null
          setError(body?.detail ?? '공유할 수 없어요.')
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="메모 공유">
      <div className={styles.addRow}>
        <input
          type="email"
          className={styles.email}
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        <select
          className={styles.perm}
          value={permission}
          onChange={(e) => setPermission(e.target.value as SharePermission)}
        >
          <option value="VIEW">보기</option>
          <option value="EDIT">편집</option>
        </select>
        <Button variant="primary" size="sm" onClick={submit} disabled={grant.isPending}>공유</Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <ul className={styles.list}>
        {shares.data?.length === 0 && <li className={styles.empty}>아직 공유한 사람이 없어요.</li>}
        {shares.data?.map((s) => (
          <li key={s.grantedToUserId} className={styles.item}>
            <div className={styles.who}>
              <span className={styles.name}>{s.recipientName}</span>
              <span className={styles.mail}>{s.recipientEmail}</span>
            </div>
            <select
              className={styles.perm}
              value={s.permission}
              onChange={(e) => updateGrant.mutate({ recipientId: s.grantedToUserId, payload: { permission: e.target.value as SharePermission } })}
            >
              <option value="VIEW">보기</option>
              <option value="EDIT">편집</option>
            </select>
            <button
              type="button"
              className={styles.remove}
              aria-label="공유 해제"
              onClick={() => revoke.mutate(s.grantedToUserId)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
```
> The implementer must confirm `Modal`, `Button` are exported from `src/components/ui` (used by existing modals) and that `ApiError` is exported from `src/api/client` (it is — the interceptor rejects with `new ApiError(...)`). If `Modal`'s prop is `title` vs `header`, match the existing usage in `PlanModal.tsx`.

- [ ] **Step 2: Styles**

`ShareDialog.module.css` — use tokens only (match `PlanModal.module.css` conventions):
```css
.addRow { display: flex; gap: var(--sp-2); align-items: center; margin-bottom: var(--sp-2); }
.email { flex: 1; padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-md); background: var(--c-surface); color: var(--c-text); font-family: var(--font-sans); }
.perm { padding: var(--sp-2); border: 1px solid var(--c-border); border-radius: var(--r-md); background: var(--c-surface); color: var(--c-text); }
.error { margin: 0 0 var(--sp-2); font-size: var(--fs-sm); color: var(--c-danger); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
.empty { font-size: var(--fs-sm); color: var(--c-text-subtle); padding: var(--sp-2) 0; }
.item { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) 0; border-top: 1px solid var(--c-border); }
.who { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.name { font-size: var(--fs-sm); color: var(--c-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mail { font-size: var(--fs-xs); color: var(--c-text-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.remove { display: inline-flex; padding: var(--sp-1); border: none; background: none; color: var(--c-text-muted); cursor: pointer; }
.remove:hover { color: var(--c-danger); }
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/shares`
Expected: clean.

- [ ] **Step 4: Commit**
```bash
git add src/features/shares/ShareDialog.tsx src/features/shares/ShareDialog.module.css
git commit -m "feat(phase-e-fe): ShareDialog for managing note grants"
```

---

### Task 8: NoteEditorBody `minimal` mode

**Files:**
- Modify: `src/features/notes/editor/NoteEditorBody.tsx`

**Context:** `NoteEditorBody` already supports `canEdit` (→ Tiptap `editable`). It also renders workspace-coupled toolbar pickers (attachment upload, calc/link-card/entity-ref snapshots) whose handlers (`onUploadImage`, `onUploadFile`, `onPickFile`, `onPickSnapshot`, `onPickLinkCard`, `onPickCalcSnapshot`) reference the current workspace. Cross-workspace shared notes have no such context, so add a `minimal` flag that (a) makes those picker handler props optional, and (b) hides the picker toolbar group. Core text formatting stays.

- [ ] **Step 1: Read the file, then make picker handlers optional + add `minimal`**

Open `src/features/notes/editor/NoteEditorBody.tsx`. In the `Props` type, change the workspace-coupled handler props to optional and add `minimal`:
```typescript
type Props = {
  noteId: number
  initialBody: string
  canEdit?: boolean
  /** When true, hide workspace-coupled pickers (attachments, snapshots, calc/link cards). */
  minimal?: boolean
  onBodyChange: (html: string) => void
  onUploadImage?: (file: File) => Promise<string>
  onUploadFile?: (file: File) => Promise<{ url: string; filename: string; sizeBytes: number }>
  onPickFile?: () => void
  onPickSnapshot?: () => void
  onPickLinkCard?: () => void
  onPickCalcSnapshot?: () => void
  registerEditor: (editor: Editor | null) => void
  onRequestLinkDialog: () => void
}
```

- [ ] **Step 2: Guard the picker toolbar group**

Locate the toolbar JSX group that renders the attachment/snapshot/link-card/calc-snapshot buttons (the ones calling `onPickFile`/`onPickSnapshot`/`onPickLinkCard`/`onPickCalcSnapshot`). Wrap that group:
```tsx
{!minimal && (
  <>
    {/* …existing picker buttons… */}
  </>
)}
```
Guard any image/file paste/drop handlers that call `onUploadImage`/`onUploadFile` with optional-chaining or an early return when `minimal` (so a paste in a shared editor inserts text only, never attempts a cross-workspace upload). Example for an upload call site:
```typescript
const url = await onUploadImage?.(file)
if (!url) return
```

- [ ] **Step 3: Verify existing callers still type-check**

The existing `NoteEditor.tsx` passes all handlers, so making them optional is backward-compatible. Run:
```
npx tsc -b --noEmit
```
Expected: no errors. (No behavior change for the in-workspace editor — `minimal` defaults falsy.)

- [ ] **Step 4: Commit**
```bash
git add src/features/notes/editor/NoteEditorBody.tsx
git commit -m "feat(phase-e-fe): NoteEditorBody minimal mode (hide workspace pickers)"
```

---

### Task 9: SharedNoteView (open a shared note)

**Files:**
- Create: `src/features/shares/SharedNoteView.tsx`
- Create: `src/features/shares/SharedNoteView.module.css`

**Context:** Loads via `useSharedNote(noteId)`, renders title + `NoteEditorBody` in `minimal` mode with `canEdit = effectivePermission === 'EDIT'`. On body/title change (EDIT only), debounce-save via `useUpdateSharedNote`. This is a presentational route target; the parent route supplies `noteId` from the URL.

- [ ] **Step 1: Build the view**

`SharedNoteView.tsx`:
```tsx
import { useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import NoteEditorBody from '../notes/editor/NoteEditorBody'
import { useSharedNote, useUpdateSharedNote } from './api'
import styles from './SharedNoteView.module.css'

type Props = { noteId: number }
const SAVE_MS = 600

export default function SharedNoteView({ noteId }: Props) {
  const shared = useSharedNote(noteId)
  const update = useUpdateSharedNote(noteId)
  const editorRef = useRef<Editor | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [title, setTitle] = useState<string | null>(null)

  const canEdit = shared.data?.effectivePermission === 'EDIT'

  const scheduleSave = useCallback((patch: { title?: string; body?: string }) => {
    if (!canEdit) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => update.mutate(patch), SAVE_MS)
  }, [canEdit, update])

  if (shared.isLoading) return <p className={styles.state}>불러오는 중…</p>
  if (shared.isError || !shared.data) return <p className={styles.state}>공유받은 항목을 찾을 수 없어요.</p>

  const note = shared.data.note
  const titleValue = title ?? note.title ?? ''

  return (
    <div className={styles.view}>
      {canEdit ? (
        <input
          className={styles.title}
          placeholder="제목 없음"
          value={titleValue}
          onChange={(e) => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
        />
      ) : (
        <h1 className={styles.titleStatic}>{note.title || '제목 없음'}</h1>
      )}
      {!canEdit && <p className={styles.badge}>보기 전용</p>}
      <NoteEditorBody
        noteId={note.id}
        initialBody={note.body}
        canEdit={canEdit}
        minimal
        onBodyChange={(html) => scheduleSave({ body: html })}
        registerEditor={(e) => { editorRef.current = e }}
        onRequestLinkDialog={() => {}}
      />
    </div>
  )
}
```
> `NoteEditorBody`'s default export name/path must match Task 8's file. `registerEditor`/`onRequestLinkDialog` are required props (kept required in Task 8); pass a no-op for the link dialog (shared minimal editor uses the built-in link mark via the bubble menu, not the workspace link dialog).

- [ ] **Step 2: Styles**

`SharedNoteView.module.css`:
```css
.view { max-width: 720px; margin: 0 auto; padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.title { font-size: var(--fs-xl); font-weight: var(--fw-semi); border: none; background: none; color: var(--c-text); font-family: var(--font-sans); padding: 0; }
.title:focus { outline: none; }
.titleStatic { font-size: var(--fs-xl); font-weight: var(--fw-semi); color: var(--c-text); margin: 0; }
.badge { align-self: flex-start; font-size: var(--fs-xs); color: var(--c-text-muted); border: 1px solid var(--c-border); border-radius: var(--r-pill); padding: 2px var(--sp-2); margin: 0; }
.state { padding: var(--sp-6); text-align: center; color: var(--c-text-subtle); }
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/shares`
Expected: clean.

- [ ] **Step 4: Commit**
```bash
git add src/features/shares/SharedNoteView.tsx src/features/shares/SharedNoteView.module.css
git commit -m "feat(phase-e-fe): SharedNoteView reusing NoteEditorBody minimal"
```

---

### Task 10: `/shared` route — SharedItemList + nav entry

**Files:**
- Create: `src/features/shares/SharedItemList.tsx`
- Create: `src/features/shares/SharedItemList.module.css`
- Modify: `src/App.tsx` (lazy import + route)
- Modify: the nav menu source (find where `/decisions`, `/calc` nav items are defined — likely a menu/sidebar component; the implementer should grep for `'/decisions'` to locate it)

**Context:** "공유받은 항목" lists notes shared with me, grouped by owner name, opening `SharedNoteView` in a detail pane or sub-route. Simplest: a master list where clicking a row navigates to `/shared/:noteId`, which renders `SharedNoteView`. Use a nested route.

- [ ] **Step 1: Build the list**

`SharedItemList.tsx`:
```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { EmptyState } from '../../components/ui'
import { useSharedWithMe } from './api'
import SharedNoteView from './SharedNoteView'
import styles from './SharedItemList.module.css'

export default function SharedItemList() {
  const { data, isLoading } = useSharedWithMe()
  const navigate = useNavigate()
  const params = useParams()
  const selectedId = params.noteId ? Number(params.noteId) : null

  if (selectedId != null) {
    return <SharedNoteView noteId={selectedId} />
  }

  if (isLoading) return <p className={styles.state}>불러오는 중…</p>
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="공유받은 항목이 없어요"
        description="다른 사람이 메모를 공유하면 여기에 나타나요."
      />
    )
  }

  // Group by owner name.
  const groups = new Map<string, typeof data>()
  for (const item of data) {
    const arr = groups.get(item.ownerName) ?? []
    arr.push(item)
    groups.set(item.ownerName, arr)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}><Share2 size={18} /> 공유받은 항목</h1>
      {[...groups.entries()].map(([owner, items]) => (
        <section key={owner} className={styles.section}>
          <h2 className={styles.owner}>{owner}</h2>
          <ul className={styles.list}>
            {items.map((it) => (
              <li key={it.noteId}>
                <button type="button" className={styles.row} onClick={() => navigate(`/shared/${it.noteId}`)}>
                  <span className={styles.title}>{it.title || '제목 없음'}</span>
                  <span className={styles.perm}>{it.permission === 'EDIT' ? '편집' : '보기'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Styles**

`SharedItemList.module.css`:
```css
.page { max-width: 720px; margin: 0 auto; padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-4); }
.heading { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-lg); font-weight: var(--fw-semi); color: var(--c-text); margin: 0; }
.section { display: flex; flex-direction: column; gap: var(--sp-1); }
.owner { font-size: var(--fs-xs); color: var(--c-text-subtle); text-transform: none; margin: 0 0 var(--sp-1); }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; gap: var(--sp-2); width: 100%; text-align: left; background: none; border: none; border-top: 1px solid var(--c-border); padding: var(--sp-3) var(--sp-1); cursor: pointer; color: var(--c-text); }
.row:hover { background: var(--c-surface-tint); }
.title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.perm { font-size: var(--fs-xs); color: var(--c-text-muted); }
.state { padding: var(--sp-6); text-align: center; color: var(--c-text-subtle); }
```

- [ ] **Step 3: Add the routes in `src/App.tsx`**

Add a lazy import alongside the others:
```typescript
const SharedItemList = lazy(() => import('./features/shares/SharedItemList'))
```
Add routes inside the authed `MobileShell` block (a parent route + a child so both `/shared` and `/shared/:noteId` render the same component, which switches on the param):
```tsx
<Route path="/shared" element={<SharedItemList />} />
<Route path="/shared/:noteId" element={<SharedItemList />} />
```

- [ ] **Step 4: Add the nav entry**

Grep to locate the nav definition: `grep -rn "'/decisions'" src --include=*.tsx`. In that menu component, add an item mirroring the existing ones:
```tsx
{ to: '/shared', label: '공유받은 항목', icon: <Share2 size={18} /> }
```
Match the exact shape the existing items use (the implementer adapts label/icon to the file's structure; import `Share2` from `lucide-react`).

- [ ] **Step 5: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/shares && npm run build`
Expected: build succeeds; `/shared` chunk emitted.

- [ ] **Step 6: Commit**
```bash
git add src/features/shares/SharedItemList.tsx src/features/shares/SharedItemList.module.css src/App.tsx
# plus the nav file the implementer modified
git commit -m "feat(phase-e-fe): 공유받은 항목 route + nav entry"
```

---

### Task 11: Wire the Share action into NoteEditor

**Files:**
- Modify: `src/features/notes/editor/NoteEditor.tsx`

**Context:** Add a "공유" trigger in the note editor's existing action area (the header/overflow next to delete). Clicking opens `ShareDialog` for the current note. The editor already has the note id.

- [ ] **Step 1: Add the dialog + trigger**

In `NoteEditor.tsx`, import and add state:
```tsx
import { Share2 } from 'lucide-react'
import ShareDialog from '../../shares/ShareDialog'
// …
const [shareOpen, setShareOpen] = useState(false)
```
Add a button in the existing action row (match the existing icon-button style used for delete/back). Example:
```tsx
<button type="button" className={styles.action} aria-label="공유" onClick={() => setShareOpen(true)}>
  <Share2 size={18} />
</button>
```
And render the dialog near the end of the component's JSX:
```tsx
<ShareDialog noteId={note.id} open={shareOpen} onClose={() => setShareOpen(false)} />
```
> The implementer should match `NoteEditor.tsx`'s existing action-button className and placement (it has back/delete buttons already). `note.id` is available on the `note` prop. Import path for `ShareDialog` is from `NoteEditor.tsx` (`src/features/notes/editor/`) up to `src/features/shares/ShareDialog` — verify the relative depth (`../../shares/ShareDialog`).

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**
```bash
git add src/features/notes/editor/NoteEditor.tsx
git commit -m "feat(phase-e-fe): share action in note editor"
```

---

## Final verification

- [ ] Backend: `cd shared-docs-backend && ./gradlew test` — full suite green (existing + new share tests).
- [ ] Frontend: `cd shared-docs && npx tsc -b --noEmit && npx eslint src/features/shares && npm run build` — all clean.
- [ ] Dispatch a final code-review subagent over the whole `phase-e-sharing` diff (both repos).
- [ ] Then `superpowers:finishing-a-development-branch`.

## Self-review notes (spec coverage)

- Data model (design §1) → Task 1. ✓
- Grant-management API (design §2a) → Task 4. ✓
- Shared-access API (design §2b) → Task 5. ✓
- Permission resolution + `effectivePermission` (design §3) → Tasks 3, 5. ✓
- PRIVATE-note grant allowed → Task 3 test. ✓
- Frontend ShareDialog (design §4) → Task 7, wired in Task 11. ✓
- `/shared` 공유받은 항목 (design §4) → Task 10. ✓
- SharedNoteView reusing NoteEditor/Body (design §4) → Tasks 8–9. ✓
- VIEW+EDIT enforced read+write → Tasks 3, 5 tests. ✓
- Separate `/api/shares/*` path preserving rule #9 → Task 5 + Task 6 interceptor exemption. ✓
- Out of scope (other kinds, public links, pending-email) → not built. ✓
