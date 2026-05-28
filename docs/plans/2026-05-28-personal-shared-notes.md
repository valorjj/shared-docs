# Phase 1 — Personal / Shared notes split

**Goal.** Add a `visibility` dimension to notes so each person can keep private notes alongside the shared ones — without changing how the existing flows feel.

**Architecture.** Add an enum column `visibility: PRIVATE | SHARED` to `notes`. Default existing rows to `SHARED` (preserves current behavior). All read paths (list, detail, search, calendar aggregation, entity-ref expansion) filter out other users' `PRIVATE` notes. The sidebar gains three sections: `내 비공개`, `함께`, and `채연이 공유` (whichever partner's name is *not* the viewer). One-click toggle in the editor meta strip flips a note between private and shared.

**Tech.** Kotlin/Spring/JPA backend, React/TS frontend, MariaDB. No new dependencies.

**Non-goals.**
- Per-note ACLs beyond owner-private / both-shared (no "share with anyone").
- Comments scoped to private notes (separate concern, not now).
- Trash visibility rules (private trash stays private — same predicate).

---

## File map

**Backend changes:**
- Modify `note/Note.kt` — add `visibility` enum field with DEFAULT 'SHARED'
- Create `note/Visibility.kt` — the enum
- Modify `note/NoteRepository.kt` — add visibility-aware queries
- Modify `note/NoteService.kt` — enforce predicate on every read; PATCH `visibility` on update
- Modify `note/NoteDto.kt` (or wherever DTOs live) — expose `visibility`
- Modify `note/NoteController.kt` — accept `visibility` on create/update
- Modify `note/EntityRefService.kt` (or `EntityRefIndexer.kt`) — backlink expansion must filter
- Modify `search/EntitySearchService.kt` — search results filtered
- Modify `calendar/CalendarService.kt` if it pulls notes (verify)
- Create `note/NoteVisibilityTest.kt` — JUnit test for the read predicate
- Migration: handled by `ddl-auto: update` + `columnDefinition` default (no manual SQL)

**Frontend changes:**
- Modify `features/notes/types.ts` — add `visibility: 'PRIVATE' | 'SHARED'` to `Note`
- Modify `features/notes/api.ts` — patch & create accept `visibility`
- Modify `features/notes/sidebar/NoteSidebarBody.tsx` — three filter sections
- Modify `features/notes/editor/NoteEditorMeta.tsx` — visibility toggle (Lucide `Lock` / `Users`)
- Modify `features/notes/list/NoteListItem.tsx` — small lock icon when private
- Modify `features/notes/list/NoteListContextMenu.tsx` — "비공개로 전환" / "공유로 전환" item
- Verify `features/search/useSearchResults.ts` — server already filters, but cached list also needs filter

---

## Tasks

### Task 1: Backend — `Visibility` enum + column

**Files:**
- Create: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/Visibility.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/Note.kt`

- [ ] **Step 1: Create the enum**

```kotlin
package com.shareddocs.backend.note

enum class Visibility {
    PRIVATE, SHARED;
}
```

- [ ] **Step 2: Add the column to `Note.kt`**

Insert after the `pinned` column (around line 36):

```kotlin
@Column(nullable = false, length = 16, columnDefinition = "VARCHAR(16) DEFAULT 'SHARED'")
@Enumerated(EnumType.STRING)
var visibility: Visibility = Visibility.SHARED,
```

Add the import:
```kotlin
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
```

- [ ] **Step 3: Restart backend, confirm migration**

Run: `./gradlew bootRun` and watch the log.
Expected: Hibernate logs `alter table notes add column visibility varchar(16) default 'SHARED' not null`. All existing rows now read as `SHARED`.

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/Visibility.kt \
        src/main/kotlin/com/shareddocs/backend/note/Note.kt
git commit -m "feat(notes): add visibility column (PRIVATE | SHARED), default SHARED"
```

---

### Task 2: Backend — repository predicate

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteRepository.kt`

- [ ] **Step 1: Read the file to identify current query methods**

We need to know what `findAll`, `findByDeletedAtIsNull`, `searchBody`, etc. exist today. Read the whole file first.

- [ ] **Step 2: Add the visibility-aware method**

Replace any `findByDeletedAtIsNull()`-style method (used for listing) with:

```kotlin
@Query("""
    SELECT n FROM Note n
    WHERE n.deletedAt IS NULL
      AND (n.visibility = com.shareddocs.backend.note.Visibility.SHARED
           OR (n.visibility = com.shareddocs.backend.note.Visibility.PRIVATE
               AND n.createdBy.id = :viewerId))
    ORDER BY n.pinned DESC, n.updatedAt DESC
""")
fun findVisible(@Param("viewerId") viewerId: Long): List<Note>
```

Add an equivalent `findVisibleTrashed` that flips `deletedAt IS NOT NULL`. Add `findByIdVisible(id, viewerId)` for single-note reads.

- [ ] **Step 3: Verify it compiles**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/NoteRepository.kt
git commit -m "feat(notes): repository predicate for visibility-aware reads"
```

---

### Task 3: Backend — service uses the new predicate

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteService.kt`

- [ ] **Step 1: Read NoteService.kt to find every read path**

Identify: `list()`, `getById()`, `listTrashed()`, etc. Each one currently passes only deleted/active state. We need the caller to pass the viewer's user id.

- [ ] **Step 2: Replace `repo.findByDeletedAtIsNull()` etc. with `repo.findVisible(viewerId)`**

Pattern for every read method:

```kotlin
fun list(viewer: User): List<Note> =
    repo.findVisible(viewer.id!!)

fun getById(id: Long, viewer: User): Note =
    repo.findByIdVisible(id, viewer.id!!)
        ?: throw NoteNotFoundException(id)
```

- [ ] **Step 3: Add `setVisibility` mutation**

```kotlin
@Transactional
fun setVisibility(id: Long, visibility: Visibility, actor: User): Note {
    val note = getById(id, actor)
    if (note.createdBy.id != actor.id && actor.role != Role.ADMIN) {
        throw ForbiddenException("Only the author can change visibility")
    }
    note.visibility = visibility
    note.updatedAt = Instant.now()
    return note
}
```

- [ ] **Step 4: Verify it compiles**

Run: `./gradlew compileKotlin`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/NoteService.kt
git commit -m "feat(notes): service enforces visibility predicate on all reads"
```

---

### Task 4: Backend — controller + DTO

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteDto.kt` (or wherever)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/NoteController.kt`

- [ ] **Step 1: Add `visibility` to NoteResponse + NoteUpdate DTOs**

Find the response DTO. Add:
```kotlin
val visibility: Visibility
```

Find the update DTO. Add:
```kotlin
val visibility: Visibility? = null
```

- [ ] **Step 2: Wire it through**

The PATCH handler:
```kotlin
if (req.visibility != null && req.visibility != note.visibility) {
    note = noteService.setVisibility(id, req.visibility, currentUser())
}
```

Update the response mapper to include `visibility = note.visibility`.

- [ ] **Step 3: Verify with curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/dev-login | jq -r .token)

# List should include visibility
curl -s http://localhost:8080/api/notes -H "Authorization: Bearer $TOKEN" | jq '.[0].visibility'
# Expected: "SHARED"

# Toggle to PRIVATE
curl -s -X PATCH http://localhost:8080/api/notes/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"visibility": "PRIVATE"}' | jq .visibility
# Expected: "PRIVATE"
```

- [ ] **Step 4: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/note/NoteDto.kt \
        src/main/kotlin/com/shareddocs/backend/note/NoteController.kt
git commit -m "feat(notes): expose visibility in API contract"
```

---

### Task 5: Backend — search + entity refs respect visibility

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/search/EntitySearchService.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/note/EntityRefService.kt` (or `EntityRefIndexer.kt` — whichever resolves to-note titles)
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt` (verify only — calendar doesn't currently include notes, but check)

- [ ] **Step 1: EntitySearchService — filter `note` kind**

Find the note-search section. Add the same predicate:
```kotlin
.filter { it.visibility == Visibility.SHARED || it.createdBy.id == viewer.id }
```

Or push the predicate into the repository query and pass the viewer id.

- [ ] **Step 2: EntityRef expansion — filter referrers**

In `NoteReferrers` API: when listing notes that reference X, filter out notes the viewer can't see. Use `findVisible` and join.

- [ ] **Step 3: Calendar — verify**

Open `CalendarService.kt`. The 4 sources are: anniversaries, todos, purchases, settlements. Notes are NOT in the calendar today. No change needed — write a code comment confirming this is intentional.

- [ ] **Step 4: Manual verification**

1. Log in as User A (dev-login, modify dev-login to allow both users)
2. Create a note, mark it PRIVATE
3. Switch to User B account
4. Verify: not in list, not in search, not in `NoteReferrers` from a shared note that references it (the chip should still render with `data-title` from cache, but the referrer panel won't link back)

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/search/EntitySearchService.kt \
        src/main/kotlin/com/shareddocs/backend/note/EntityRefService.kt \
        src/main/kotlin/com/shareddocs/backend/calendar/CalendarService.kt
git commit -m "feat(notes): search + entity refs honor note visibility"
```

---

### Task 6: Backend — targeted unit test

**Files:**
- Create: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/note/NoteVisibilityTest.kt`

- [ ] **Step 1: Confirm test infrastructure is in place**

Run: `./gradlew test`
Expected: BUILD SUCCESSFUL (no tests found, but task succeeds).

If the project lacks any `src/test` directory, the test task will still succeed because `spring-boot-starter-test` is already in `build.gradle.kts`. Continue.

- [ ] **Step 2: Write the failing test**

```kotlin
package com.shareddocs.backend.note

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.User
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("local")
@Transactional
class NoteVisibilityTest {

    @Autowired lateinit var noteRepo: NoteRepository
    @Autowired lateinit var userRepo: com.shareddocs.backend.user.UserRepository

    @Test
    fun `private note from other user is hidden from viewer`() {
        val alice = userRepo.save(User(email = "a@test", name = "Alice", role = Role.USER))
        val bob   = userRepo.save(User(email = "b@test", name = "Bob",   role = Role.USER))

        noteRepo.save(Note(body = "alice-private", createdBy = alice, visibility = Visibility.PRIVATE))
        noteRepo.save(Note(body = "alice-shared",  createdBy = alice, visibility = Visibility.SHARED))
        noteRepo.save(Note(body = "bob-private",   createdBy = bob,   visibility = Visibility.PRIVATE))

        val visibleToBob = noteRepo.findVisible(bob.id!!)

        assertEquals(2, visibleToBob.size)
        assertTrue(visibleToBob.any { it.body == "alice-shared" })
        assertTrue(visibleToBob.any { it.body == "bob-private" })
        assertTrue(visibleToBob.none { it.body == "alice-private" })
    }
}
```

- [ ] **Step 3: Run the test — expect PASS**

Run: `./gradlew test --tests NoteVisibilityTest`
Expected: PASS. (If FAIL, debug the predicate.)

- [ ] **Step 4: Commit**

```bash
git add src/test/kotlin/com/shareddocs/backend/note/NoteVisibilityTest.kt
git commit -m "test(notes): private notes hidden from other viewers"
```

---

### Task 7: Frontend — types + API

**Files:**
- Modify: `shared-docs/src/features/notes/types.ts`
- Modify: `shared-docs/src/features/notes/api.ts`

- [ ] **Step 1: Add the type**

```ts
export type NoteVisibility = 'PRIVATE' | 'SHARED'

export type Note = {
  // ...existing fields
  visibility: NoteVisibility
}
```

- [ ] **Step 2: Add `setVisibility` mutation**

```ts
export function useSetNoteVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, visibility }: { id: number; visibility: NoteVisibility }) =>
      apiClient.patch(`/notes/${id}`, { visibility }).then((r) => r.data as Note),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.setQueryData(['note', note.id], note)
    },
  })
}
```

- [ ] **Step 3: Verify type-check**

Run: `cd shared-docs && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/notes/types.ts src/features/notes/api.ts
git commit -m "feat(notes): NoteVisibility type + useSetNoteVisibility hook"
```

---

### Task 8: Frontend — sidebar 3-section split

**Files:**
- Modify: `shared-docs/src/features/notes/sidebar/NoteSidebarBody.tsx`

- [ ] **Step 1: Read the file to understand current section structure**

The sidebar today shows: 모든 메모 / 고정됨 / 휴지통 / (태그들). We're adding above-the-fold sections.

- [ ] **Step 2: Compute the partner name**

Use `useAuth()`. The 2-person app has both users in the system. Find the partner: filter all known users (need a `/api/users` endpoint or include both in `/api/auth/me` response). If only `me` is available, fall back to "상대" as the label.

For now hardcode using a static helper — when the user is `jeongjin@*`, partner is `채연`, and vice-versa. Add a TODO comment to make this dynamic when needed.

```ts
function partnerLabel(meEmail: string | undefined): string {
  if (!meEmail) return '상대'
  return meEmail.startsWith('jeongjin') ? '채연' : '진'
}
```

- [ ] **Step 3: Compute the three counts**

```ts
const { user } = useAuth()
const partner = partnerLabel(user?.email)

const counts = useMemo(() => {
  if (!notes) return { myPrivate: 0, shared: 0, partnerShared: 0 }
  return {
    myPrivate:    notes.filter((n) => n.visibility === 'PRIVATE' && n.createdBy.userId === user?.userId).length,
    shared:       notes.filter((n) => n.visibility === 'SHARED').length,
    partnerShared:notes.filter((n) => n.visibility === 'SHARED' && n.createdBy.userId !== user?.userId).length,
  }
}, [notes, user?.userId])
```

- [ ] **Step 4: Render three new `<AppSidebarItem>` rows**

Above the existing 모든 메모 / 고정됨 rows, add:

```tsx
<AppSidebarSection label="시야">
  <AppSidebarItem
    Icon={Lock}
    label="내 비공개"
    count={counts.myPrivate}
    active={filter.scope === 'mine-private'}
    onClick={() => setFilter({ scope: 'mine-private' })}
  />
  <AppSidebarItem
    Icon={Users}
    label="함께"
    count={counts.shared}
    active={filter.scope === 'shared'}
    onClick={() => setFilter({ scope: 'shared' })}
  />
  <AppSidebarItem
    Icon={UserCheck}
    label={`${partner}의 메모`}
    count={counts.partnerShared}
    active={filter.scope === 'partner'}
    onClick={() => setFilter({ scope: 'partner' })}
  />
</AppSidebarSection>
```

- [ ] **Step 5: Update the filter type and list-filter logic**

In `NoteWorkspace.tsx` (or wherever `filter` is defined), add to the `kind` union: `'mine-private' | 'shared' | 'partner'` and apply the matching predicate when slicing `notes` for the list.

- [ ] **Step 6: Manual smoke**

Run: `cd shared-docs && npm run dev`
Open `http://localhost:5173`.
Expected: three new sidebar items appear with counts. Clicking each filters the middle pane correctly.

- [ ] **Step 7: Commit**

```bash
git add src/features/notes/sidebar/NoteSidebarBody.tsx \
        src/features/notes/workspace/NoteWorkspace.tsx
git commit -m "feat(notes): sidebar splits 내 비공개 / 함께 / 상대 메모"
```

---

### Task 9: Frontend — editor visibility toggle

**Files:**
- Modify: `shared-docs/src/features/notes/editor/NoteEditorMeta.tsx`
- Modify: `shared-docs/src/features/notes/list/NoteListItem.tsx`
- Modify: `shared-docs/src/features/notes/list/NoteListContextMenu.tsx`

- [ ] **Step 1: Add the toggle to the meta strip**

Read `NoteEditorMeta.tsx`. Beside the existing kebab, add an icon button:

```tsx
<IconButton
  label={note.visibility === 'PRIVATE' ? '공유로 전환' : '비공개로 전환'}
  variant="ghost"
  size="sm"
  onClick={() =>
    setVisMut.mutate({
      id: note.id,
      visibility: note.visibility === 'PRIVATE' ? 'SHARED' : 'PRIVATE',
    })
  }
>
  {note.visibility === 'PRIVATE'
    ? <Lock size={14} strokeWidth={2} />
    : <Users size={14} strokeWidth={2} />}
</IconButton>
```

Only render if the current user is the author.

- [ ] **Step 2: Add the lock icon to list items**

`NoteListItem.tsx`: when `note.visibility === 'PRIVATE'`, render a small `<Lock size={12} />` next to the title.

- [ ] **Step 3: Add the context-menu action**

`NoteListContextMenu.tsx`: between "고정" and "복제", add:

```tsx
<MenuItem
  icon={note.visibility === 'PRIVATE' ? <Users size={14} /> : <Lock size={14} />}
  onSelect={() => setVisMut.mutate({ id: note.id, visibility: note.visibility === 'PRIVATE' ? 'SHARED' : 'PRIVATE' })}
>
  {note.visibility === 'PRIVATE' ? '공유로 전환' : '비공개로 전환'}
</MenuItem>
```

- [ ] **Step 4: Manual smoke**

Run dev. Toggle a note private → confirm lock icon appears in list + sidebar count updates + still visible to author / hidden in partner sidebar.

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/editor/NoteEditorMeta.tsx \
        src/features/notes/list/NoteListItem.tsx \
        src/features/notes/list/NoteListContextMenu.tsx
git commit -m "feat(notes): per-note visibility toggle in editor + list + context menu"
```

---

### Task 10: Frontend — search palette respects visibility

**Files:**
- Modify: `shared-docs/src/features/search/useSearchResults.ts`

- [ ] **Step 1: Verify**

The cached `notes` query already returns only what's visible to the current user (server filters). So `useSearchResults` should already be correct.

Read the file. Confirm it slices from `useNotes()` data only. If yes, no change.

- [ ] **Step 2: Add a defensive filter**

Even if the cache is right, add an explicit safety predicate so a future endpoint change doesn't leak:

```ts
const visibleNotes = notes.filter(
  (n) => n.visibility === 'SHARED' || n.createdBy.userId === user?.userId
)
```

- [ ] **Step 3: Manual smoke**

⌘K, type a fragment of a partner's PRIVATE note title → expect 0 results.

- [ ] **Step 4: Commit**

```bash
git add src/features/search/useSearchResults.ts
git commit -m "feat(search): defensive visibility filter in search palette"
```

---

### Task 11: End-to-end manual verification

- [ ] **Step 1: Two-user smoke**

1. `./gradlew bootRun` + `npm run dev`
2. Sign in as User A. Create 3 notes: one PRIVATE, two SHARED.
3. Sign out, sign in as User B.
4. Expect: 2 notes visible (both SHARED). Partner's PRIVATE note not in list, not in `⌘K`, not in `@`-mention picker, not in trash, not in 휴지통 count.
5. Sign back in as User A. Toggle the PRIVATE note → SHARED. Verify it appears for User B.

- [ ] **Step 2: Backlinks check**

1. As User A: create a SHARED note that `@`-mentions a PRIVATE note (this should still work — author can mention their own private notes).
2. As User B: open the shared note. The mention chip renders (text only, from `data-title`) but the link doesn't resolve to the target. **Acceptable.**
3. Document this in `ARCHITECTURE.md` under "Visibility leakage surfaces."

- [ ] **Step 3: Tag a release**

```bash
git tag phase-1-personal-shared-notes
git push origin main --tags
```

---

## Risks & rollback

- **Index efficiency.** `findVisible` filters on `visibility` + `created_by_user_id`. With <1000 notes the existing `idx_notes_created_by` is enough. Revisit if note count grows.
- **EntityRef leakage.** A chip rendered before the visibility filter shipped could expose a title via `data-title`. **Mitigation:** the title was already public in the referring (shared) note's body at the time of insert, so this is consistent with how Tiptap atoms work. Documented, not fixed.
- **Rollback.** Drop the `visibility` column manually. All other changes degrade gracefully (frontend reads `visibility ?? 'SHARED'`).

## Self-review

- Spec coverage: ✓ data model, ✓ read paths, ✓ UI affordances, ✓ search, ✓ entity refs, ✓ test
- Placeholders: none
- Type consistency: `Visibility` enum used identically backend + frontend (`PRIVATE`/`SHARED`)
- Open question: partner-name resolution is hardcoded. Acceptable for 2-person app; flagged as TODO.
