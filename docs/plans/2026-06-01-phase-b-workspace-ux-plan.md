# Phase B — Workspace Integration UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace experience never-stuck (zero-workspace onboarding instead of a 400-storm), let users create a workspace with a name only, and stop the deployed backend from sharing a database with local dev.

**Architecture:** Reuse Phase A's workspace plumbing (`ActiveWorkspaceProvider` owns state; axios injects `X-Workspace-Id`; `WorkspaceController` list/detail/create). Add: (1) a DB-name env split so prod uses `shared_docs_prod`; (2) server-side slug auto-generation so the create API needs only a name; (3) a shared create form used by both a `CreateWorkspaceModal` (opened from the desktop switcher) and a `WorkspaceOnboarding` screen; (4) a gate in `MobileShell` that renders onboarding when authenticated with no active workspace.

**Tech Stack:** Backend Spring Boot 3.5 / Kotlin / JPA / Flyway / MariaDB. Frontend Vite / React 19 / TypeScript / CSS Modules / React Query / axios. Conventions: per-feature commits; `@SpringBootTest` integration tests against `shared_docs_test`; frontend verified by `tsc --noEmit` + `eslint` + `npm run build`; Korean UI; Lucide icons; one `.module.css` per component; multi-line comments documenting the *why*.

**Branch:** both repos on `main` (== former `v2-multi-tenant`). Per-task commits; push at the end of each task.

---

## File structure

### Backend (`shared-docs-backend/`)
```
docker-compose.yml                                  ← MODIFY: DB name from ${DB_NAME:-shared_docs}
.github/workflows/deploy.yml                        ← MODIFY: add DB_NAME=shared_docs_prod to deploy env
src/main/kotlin/.../workspace/WorkspaceDto.kt       ← MODIFY: CreateWorkspaceRequest.slug optional
src/main/kotlin/.../workspace/WorkspaceService.kt   ← MODIFY: create(slug optional) + slug generator
src/test/kotlin/.../workspace/WorkspaceServiceTest.kt ← MODIFY: add auto-slug tests
```

### Frontend (`shared-docs/`)
```
src/api/workspaces.ts                               ← MODIFY: CreateWorkspacePayload.slug optional
src/features/workspaces/WorkspaceCreateForm.tsx     ← CREATE: shared name-only create form
src/features/workspaces/WorkspaceCreateForm.module.css ← CREATE
src/features/workspaces/CreateWorkspaceModal.tsx    ← CREATE: Modal wrapping the form
src/features/workspaces/WorkspaceOnboarding.tsx     ← CREATE: zero-workspace screen
src/features/workspaces/WorkspaceOnboarding.module.css ← CREATE
src/features/workspaces/WorkspaceSwitcher.tsx       ← MODIFY: "+ 새 워크스페이스" item opens modal
src/components/common/MobileShell.tsx               ← MODIFY: gate ready && !active → onboarding
```

---

## Task 1: DB separation — deployed backend uses `shared_docs_prod`

**Files:**
- Modify: `shared-docs-backend/docker-compose.yml`
- Modify: `shared-docs-backend/.github/workflows/deploy.yml`

- [ ] **Step 1: Parameterize the DB name in compose**

In `docker-compose.yml`, the `backend` service env currently has:

```yaml
      - SPRING_DATASOURCE_URL=jdbc:mariadb://host.docker.internal:3307/shared_docs?characterEncoding=UTF-8&serverTimezone=Asia/Seoul&createDatabaseIfNotExist=true
```

Replace the `/shared_docs` segment with a `${DB_NAME:-shared_docs}` substitution so the default is unchanged but the deploy can override it:

```yaml
      # DB name is parameterized so prod uses its own database (shared_docs_prod,
      # injected by deploy.yml) while local `docker compose up` still defaults to
      # shared_docs. Prevents dev work from touching the deployed database.
      - SPRING_DATASOURCE_URL=jdbc:mariadb://host.docker.internal:3307/${DB_NAME:-shared_docs}?characterEncoding=UTF-8&serverTimezone=Asia/Seoul&createDatabaseIfNotExist=true
```

- [ ] **Step 2: Inject the prod DB name in the deploy workflow**

In `.github/workflows/deploy.yml`, the "Start new container" step has an `env:` block. Add `DB_NAME`:

```yaml
        env:
          DB_NAME: shared_docs_prod
          DB_USERNAME: ${{ secrets.DB_USERNAME }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
          CORS_ALLOWED_ORIGINS: ${{ secrets.CORS_ALLOWED_ORIGINS }}
          GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
          GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          FRONTEND_URL: ${{ secrets.FRONTEND_URL }}
```

- [ ] **Step 3: Sanity-check compose locally renders the default (no deploy yet)**

Run from `shared-docs-backend/`:

```bash
docker compose config | grep SPRING_DATASOURCE_URL
```

Expected: the URL contains `/shared_docs?` (the default — local dev unchanged, because `DB_NAME` is unset locally).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .github/workflows/deploy.yml
git commit -m "feat(infra): deployed backend uses shared_docs_prod (separate from dev shared_docs)

DB name is parameterized via DB_NAME (default shared_docs for local dev);
deploy.yml injects DB_NAME=shared_docs_prod. createDatabaseIfNotExist + Flyway
build the prod DB clean on next deploy. Local dev and tests are unaffected."
git push origin main
```

> The actual prod cutover happens when the deploy workflow runs (Task 5). The live app will start empty in `shared_docs_prod`; re-login bootstraps a personal workspace there.

---

## Task 2: Backend — optional, server-generated slug

**Files:**
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceDto.kt`
- Modify: `shared-docs-backend/src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceService.kt`
- Test: `shared-docs-backend/src/test/kotlin/com/shareddocs/backend/workspace/WorkspaceServiceTest.kt`

- [ ] **Step 1: Write the failing tests**

Add these two tests to `WorkspaceServiceTest` (it already has `service`, `userRepository`, `memberRepository`, and `uniqueEmail()`):

```kotlin
@Test
fun `create with blank slug generates a valid unique slug`() {
    val user = userRepository.save(User(email = uniqueEmail(), name = "U", role = Role.USER))
    val ws1 = service.create(user.id!!, "직장", null)
    val ws2 = service.create(user.id!!, "취미", null)

    // Generated slugs match the API's lowercase-kebab contract and the ws-<6> shape.
    assert(ws1.slug.matches(Regex("^ws-[a-z0-9]{6}$"))) { "unexpected slug: ${ws1.slug}" }
    assertNotEquals(ws1.slug, ws2.slug)

    // Still creates the OWNER membership.
    val members = memberRepository.findAllByWorkspaceIdAndLeftAtIsNullOrderByJoinedAtAsc(ws1.id!!)
    assertEquals(1, members.size)
    assertEquals(WorkspaceRole.OWNER, members[0].role)
}

@Test
fun `create still honors an explicit slug`() {
    val user = userRepository.save(User(email = uniqueEmail(), name = "U", role = Role.USER))
    val ws = service.create(user.id!!, "직장", "work")
    assertEquals("work", ws.slug)
}
```

- [ ] **Step 2: Run the tests, watch them fail to compile**

```bash
cd shared-docs-backend
./gradlew test --tests "*WorkspaceServiceTest*"
```

Expected: compilation failure — `create(Long, String, null)` doesn't match the current `create(userId, name, slug: String)` signature.

- [ ] **Step 3: Make `slug` optional + add the generator in `WorkspaceService`**

Replace the existing `create` method and add the generator. The current method is:

```kotlin
    @Transactional
    fun create(userId: Long, name: String, slug: String): Workspace {
        if (workspaceRepository.existsByCreatedByUserIdAndSlug(userId, slug)) {
            throw WorkspaceSlugTakenException(slug)
        }
        val workspace = try {
            workspaceRepository.save(
                Workspace(name = name, slug = slug, createdByUserId = userId)
            )
        } catch (e: DataIntegrityViolationException) {
            throw WorkspaceSlugTakenException(slug)
        }
        memberRepository.save(
            WorkspaceMember(workspaceId = workspace.id!!, userId = userId, role = WorkspaceRole.OWNER)
        )
        return workspace
    }
```

Replace it with:

```kotlin
    @Transactional
    fun create(userId: Long, name: String, slug: String? = null): Workspace {
        // Slug is an internal identifier (not in any URL in v2), so the create UI
        // only collects a name. When the caller omits the slug we generate a
        // unique one server-side; an explicit slug (e.g. "personal" from the
        // bootstrap, or a future power-user field) is still honored.
        val finalSlug = slug?.trim()?.takeIf { it.isNotEmpty() } ?: generateUniqueSlug(userId)

        // Pre-check for a friendly error on the common case; the unique index
        // uq_workspaces_slug_per_user is the real guarantee, with the catch below
        // converting its violation to the same typed exception (TOCTOU backstop,
        // ENGINEERING-STANDARDS §2.4).
        if (workspaceRepository.existsByCreatedByUserIdAndSlug(userId, finalSlug)) {
            throw WorkspaceSlugTakenException(finalSlug)
        }
        val workspace = try {
            workspaceRepository.save(
                Workspace(name = name, slug = finalSlug, createdByUserId = userId)
            )
        } catch (e: DataIntegrityViolationException) {
            throw WorkspaceSlugTakenException(finalSlug)
        }
        memberRepository.save(
            WorkspaceMember(workspaceId = workspace.id!!, userId = userId, role = WorkspaceRole.OWNER)
        )
        return workspace
    }

    /**
     * Generates a slug like `ws-3f9a2c` unique within this user's slug namespace.
     * Collisions on a 6-char base36 suffix are astronomically unlikely; the loop
     * + the unique-index backstop in [create] make it safe regardless. The UUID
     * fallback guarantees termination.
     */
    private fun generateUniqueSlug(userId: Long): String {
        repeat(5) {
            val candidate = "ws-" + (1..6).map { SLUG_CHARS[rng.nextInt(SLUG_CHARS.length)] }.joinToString("")
            if (!workspaceRepository.existsByCreatedByUserIdAndSlug(userId, candidate)) return candidate
        }
        return "ws-" + java.util.UUID.randomUUID().toString().replace("-", "").take(8)
    }
```

Add the imports + companion fields. At the top of the file add:

```kotlin
import java.security.SecureRandom
```

And inside the class body (e.g., just above the closing brace) add:

```kotlin
    private companion object {
        private const val SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
    }
```

And as a private field on the class:

```kotlin
    private val rng = SecureRandom()
```

- [ ] **Step 4: Make `slug` optional in `CreateWorkspaceRequest`**

In `WorkspaceDto.kt`, the current request is:

```kotlin
data class CreateWorkspaceRequest(
    @field:NotBlank
    @field:Size(max = 80)
    val name: String,

    @field:NotBlank
    @field:Size(max = 40)
    @field:Pattern(
        regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        message = "slug must be lowercase letters, digits, and single hyphens",
    )
    val slug: String,
)
```

Replace it with (drop `@NotBlank` on slug; make it nullable — `@Size`/`@Pattern` skip null by Bean Validation rules, so an omitted slug is valid and a provided one is still validated):

```kotlin
data class CreateWorkspaceRequest(
    @field:NotBlank
    @field:Size(max = 80)
    val name: String,

    // Optional: omit to have the server generate a unique slug. When provided it
    // must still be lowercase-kebab. (@Size/@Pattern are skipped for null.)
    @field:Size(max = 40)
    @field:Pattern(
        regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$",
        message = "slug must be lowercase letters, digits, and single hyphens",
    )
    val slug: String? = null,
)
```

`WorkspaceController.create` already calls `service.create(me.userId, req.name, req.slug)` — `req.slug` is now `String?`, which matches the new signature. No controller change needed.

- [ ] **Step 5: Run the tests, watch them pass**

```bash
./gradlew test --tests "*WorkspaceServiceTest*"
```

Expected: all WorkspaceServiceTest tests PASS (the 6 existing + the 2 new).

- [ ] **Step 6: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceDto.kt \
        src/main/kotlin/com/shareddocs/backend/workspace/WorkspaceService.kt \
        src/test/kotlin/com/shareddocs/backend/workspace/WorkspaceServiceTest.kt
git commit -m "feat(workspace): optional, server-generated slug on create (Phase B)

slug is internal (not in URLs), so the create API needs only a name. When
omitted, WorkspaceService generates a unique ws-<6> slug (unique-index backstop
+ UUID fallback). Explicit slugs still honored. CreateWorkspaceRequest.slug
is now optional."
git push origin main
```

---

## Task 3: Frontend — shared create form, modal, and switcher entry

**Files:**
- Modify: `shared-docs/src/api/workspaces.ts`
- Create: `shared-docs/src/features/workspaces/WorkspaceCreateForm.tsx`
- Create: `shared-docs/src/features/workspaces/WorkspaceCreateForm.module.css`
- Create: `shared-docs/src/features/workspaces/CreateWorkspaceModal.tsx`
- Modify: `shared-docs/src/features/workspaces/WorkspaceSwitcher.tsx`

- [ ] **Step 1: Make `slug` optional in the API payload type**

In `src/api/workspaces.ts`, the current payload is:

```ts
export type CreateWorkspacePayload = {
  name: string
  slug: string
}
```

Change to:

```ts
export type CreateWorkspacePayload = {
  name: string
  // Optional — the server generates one when omitted (slug isn't user-facing).
  slug?: string
}
```

Nothing else in that file changes (`createWorkspace` posts the payload as-is; `useCreateWorkspace` already invalidates `['workspaces']`).

- [ ] **Step 2: Create the shared create form**

Create `src/features/workspaces/WorkspaceCreateForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, Input, Label, Stack } from '../../components/ui'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useCreateWorkspace } from '../../api/workspaces'

/**
 * The one place workspace creation is implemented. Used by both
 * CreateWorkspaceModal (from the switcher) and WorkspaceOnboarding (zero-state),
 * so there's a single create form, not two divergent ones.
 *
 * Collects a name only — the server generates the slug. On success it makes the
 * new workspace active (which also clears the query cache and refetches), then
 * calls `onCreated` so the host can close the modal / move on.
 */
export function WorkspaceCreateForm({
  onCreated,
  autoFocus = false,
}: {
  onCreated?: () => void
  autoFocus?: boolean
}) {
  const create = useCreateWorkspace()
  const { setActiveId } = useActiveWorkspace()
  const [name, setName] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (ws) => {
          setActiveId(ws.id)
          onCreated?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Field>
          <Label htmlFor="ws-name">워크스페이스 이름</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus={autoFocus}
            placeholder="예: 직장, 취미"
          />
        </Field>
        {create.error && <ErrorText>{create.error.message}</ErrorText>}
        <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
          {create.isPending ? '만드는 중…' : '워크스페이스 만들기'}
        </Button>
      </Stack>
    </form>
  )
}
```

> Note: confirm the `Stack` `gap` prop value against `src/components/ui/Stack.tsx` (use whatever the existing components pass — e.g. `gap="md"` or a numeric token); and confirm `Button`'s primary variant prop name (`variant="primary"`) matches `Button.tsx`. Match the existing usage in `features/purchases/PurchaseForm.tsx`.

- [ ] **Step 3: Create the (empty for now) module CSS**

Create `src/features/workspaces/WorkspaceCreateForm.module.css`:

```css
/* The form uses shared <Stack>/<Field>/<Button> primitives, so no bespoke
   styles are needed yet. File kept for the one-module-per-component convention
   and as the home for any future create-form styling. */
```

(If lint flags an empty CSS module import, inline the form without importing this file and delete it.)

- [ ] **Step 4: Create the modal wrapper**

Create `src/features/workspaces/CreateWorkspaceModal.tsx`:

```tsx
import { Modal } from '../../components/ui'
import { WorkspaceCreateForm } from './WorkspaceCreateForm'

/**
 * Modal home for the create form, opened from the workspace switcher. Re-mounts
 * the form each time it opens (keyed on `open`) so the name field starts empty.
 */
export default function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="새 워크스페이스">
      <WorkspaceCreateForm key={open ? 'open' : 'closed'} autoFocus onCreated={onClose} />
    </Modal>
  )
}
```

- [ ] **Step 5: Add "+ 새 워크스페이스" to the switcher**

Modify `src/features/workspaces/WorkspaceSwitcher.tsx`. Current content:

```tsx
import { Check, ChevronDown } from 'lucide-react'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { Menu, MenuItem } from '../../components/ui/Menu'
import styles from './WorkspaceSwitcher.module.css'

export default function WorkspaceSwitcher() {
  const { workspaces, active, setActiveId } = useActiveWorkspace()

  if (!active) return null

  return (
    <Menu
      align="start"
      trigger={ /* ... unchanged ... */ }
    >
      {workspaces.map((ws) => (
        <MenuItem /* ... unchanged ... */ >
          {ws.name}
        </MenuItem>
      ))}
    </Menu>
  )
}
```

Add modal state, the separator + create item, and the modal. Replace the imports and component body (keep the existing `trigger` and the `workspaces.map(...)` item exactly as they are):

```tsx
import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu'
import CreateWorkspaceModal from './CreateWorkspaceModal'
import styles from './WorkspaceSwitcher.module.css'

export default function WorkspaceSwitcher() {
  const { workspaces, active, setActiveId } = useActiveWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  if (!active) return null

  return (
    <>
      <Menu
        align="start"
        trigger={
          <button type="button" className={styles.trigger} aria-label="워크스페이스 전환" title={active.name}>
            <span className={styles.name}>{active.name}</span>
            <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        }
      >
        {workspaces.map((ws) => (
          <MenuItem
            key={ws.id}
            onSelect={() => {
              if (ws.id !== active.id) setActiveId(ws.id)
            }}
            icon={
              ws.id === active.id ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <span className={styles.checkSpacer} aria-hidden="true" />
              )
            }
          >
            {ws.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => setCreateOpen(true)} icon={<Plus size={14} strokeWidth={2} />}>
          새 워크스페이스
        </MenuItem>
      </Menu>
      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
```

- [ ] **Step 6: Type-check, lint, build**

```bash
cd shared-docs
npx tsc --noEmit
npx eslint src/features/workspaces/ src/api/workspaces.ts
npm run build
```

Expected: `tsc` exits 0; eslint reports no errors for these files; build succeeds. (Pre-existing eslint debt elsewhere in the repo is out of scope.)

- [ ] **Step 7: Commit**

```bash
git add src/api/workspaces.ts src/features/workspaces/
git commit -m "feat(workspace): create-workspace form + modal + switcher entry (Phase B)

WorkspaceCreateForm (name only) is shared by CreateWorkspaceModal and (next task)
the onboarding screen. On success it makes the new workspace active. The desktop
switcher gains a '+ 새 워크스페이스' item. CreateWorkspacePayload.slug is optional."
git push origin main
```

---

## Task 4: Frontend — zero-workspace onboarding + MobileShell gate

**Files:**
- Create: `shared-docs/src/features/workspaces/WorkspaceOnboarding.tsx`
- Create: `shared-docs/src/features/workspaces/WorkspaceOnboarding.module.css`
- Modify: `shared-docs/src/components/common/MobileShell.tsx`

- [ ] **Step 1: Create the onboarding screen**

Create `src/features/workspaces/WorkspaceOnboarding.tsx`:

```tsx
import { WorkspaceCreateForm } from './WorkspaceCreateForm'
import styles from './WorkspaceOnboarding.module.css'

/**
 * Shown when a signed-in user has no active workspace (the never-stuck guard;
 * normally the sign-in bootstrap means you always have one, so this covers edge
 * cases like a wiped/left workspace). Creating one here makes it active, which
 * flips MobileShell back to the normal app. No `onCreated` needed — the gate
 * re-renders once `active` is set.
 */
export default function WorkspaceOnboarding() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>아직 워크스페이스가 없어요</h1>
        <p className={styles.lede}>워크스페이스를 만들면 메모와 데이터를 모아둘 수 있어요.</p>
        <WorkspaceCreateForm autoFocus />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the onboarding CSS module**

Create `src/features/workspaces/WorkspaceOnboarding.module.css`:

```css
.wrap {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-6);
  font-family: var(--font-sans);
}

.card {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.title {
  font-size: var(--fs-lg);
  font-weight: var(--fw-semi);
  color: var(--c-text);
  letter-spacing: -0.01em;
}

.lede {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}
```

> Confirm token names against `src/index.scss` (the project uses `--sp-*`, `--fs-*`, `--fw-*`, `--c-text`, `--c-text-muted`, `--font-sans`). If `--c-text-muted` doesn't exist, use the muted color token that does (grep `--c-text` in `src/index.scss`).

- [ ] **Step 3: Gate `MobileShell` on an active workspace**

Modify `src/components/common/MobileShell.tsx`. It currently destructures `ready` and renders a spinner while `!ready`. Add `active` to the destructure and an onboarding branch.

Change the import line for the hook usage and the gate. The current gate is:

```tsx
  const { ready } = useActiveWorkspace()
  const hasBottomNav = !NO_PAD_PREFIXES.some((p) => location.pathname.startsWith(p))

  // Hold the authed app until the active workspace is resolved. ...
  if (!ready) {
    return (
      <div /* spinner */ >
        <Spinner label="워크스페이스 불러오는 중…" />
      </div>
    )
  }
```

Replace with:

```tsx
  const { ready, active } = useActiveWorkspace()
  const hasBottomNav = !NO_PAD_PREFIXES.some((p) => location.pathname.startsWith(p))

  // Hold the authed app until the active workspace is resolved, so resource
  // pages never mount without an X-Workspace-Id header.
  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-sans)',
        }}
        aria-busy="true"
      >
        <Spinner label="워크스페이스 불러오는 중…" />
      </div>
    )
  }

  // Authenticated but no workspace (edge case: wiped/left). Show onboarding
  // instead of the resource hub — never the silent 400-storm.
  if (!active) {
    return <WorkspaceOnboarding />
  }
```

Add the import at the top of `MobileShell.tsx`:

```tsx
import WorkspaceOnboarding from '../../features/workspaces/WorkspaceOnboarding'
```

- [ ] **Step 4: Type-check, lint, build**

```bash
cd shared-docs
npx tsc --noEmit
npx eslint src/features/workspaces/ src/components/common/MobileShell.tsx
npm run build
```

Expected: `tsc` exits 0; eslint clean for these files; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces/WorkspaceOnboarding.tsx \
        src/features/workspaces/WorkspaceOnboarding.module.css \
        src/components/common/MobileShell.tsx
git commit -m "feat(workspace): zero-workspace onboarding screen + MobileShell gate (Phase B)

When authenticated with no active workspace, MobileShell renders
WorkspaceOnboarding (reusing the shared create form) instead of the resource
hub — closes the silent 400-storm we hit when a session outlived its workspace."
git push origin main
```

---

## Task 5: Deploy + verify the prod DB split end-to-end

**Files:** none (operational verification).

> The user must trigger the deploy (the runner repo is on a GitHub account this session's `gh` can't dispatch). The workflow runs on the self-hosted Mac Mini.

- [ ] **Step 1: Trigger the deploy** — GitHub → Actions → "Backend CD" → Run workflow on `main` (or push to `main`, already done by the task commits). Frontend redeploys via Vercel from `main`.

- [ ] **Step 2: Confirm the deployed container uses the prod DB**

On the Mac Mini:

```bash
docker exec shared-docs-backend printenv SPRING_DATASOURCE_URL
docker logs shared-docs-backend 2>&1 | grep -iE "Database:|Migrating schema|up to date" | tail -5
```

Expected: URL contains `/shared_docs_prod`; Flyway reports migrating/validating `shared_docs_prod`.

- [ ] **Step 3: Confirm dev DB is untouched + prod is separate**

```bash
docker exec lunch-select-db sh -c 'mariadb -h127.0.0.1 -P3306 --protocol=TCP -uroot -p"1qaz!QAZ" -N -e "SHOW DATABASES LIKE \"shared_docs%\";"'
```

Expected: lists `shared_docs`, `shared_docs_prod`, `shared_docs_test`.

- [ ] **Step 4: Manual smoke on the deployed app**
  - Sign in → lands in a freshly-bootstrapped personal workspace (in `shared_docs_prod`).
  - Open the switcher → "+ 새 워크스페이스" → create "직장" → it becomes active, app reloads into it; switcher shows both.
  - (Onboarding) In DevTools, delete `shared-docs.activeWorkspaceId` from Local Storage AND confirm behavior only via a real zero-workspace account is hard to force live — instead rely on the backend test + the gate logic; optionally verify by signing in as a brand-new google account if available.

- [ ] **Step 5: Tag the phase**

```bash
cd shared-docs-backend && git tag -f phase-b-complete -m "Phase B: workspace onboarding + create + prod DB split" && git push -f origin phase-b-complete
cd ../shared-docs && git tag -f phase-b-complete -m "Phase B: workspace onboarding + create + prod DB split" && git push -f origin phase-b-complete
```

---

## Self-review notes (coverage against the spec)

- Spec §"DB separation" → Task 1 + Task 5 verification. ✓
- Spec §"optional auto-generated slug" → Task 2 (+ tests). ✓
- Spec §"create-workspace flow" → Task 3 (shared form, modal, switcher item). ✓
- Spec §"zero-workspace onboarding" → Task 4 (screen + MobileShell gate). ✓
- Spec §"deferred" items (rename/settings/delete/member-mgmt/mobile switcher) → not present in any task. ✓
- Error handling: create errors surface via `create.error.message` (RFC 7807 `detail` parsed by the axios client) in the shared form. ✓
- Shared form prevents two divergent create forms (spec risk note). ✓
