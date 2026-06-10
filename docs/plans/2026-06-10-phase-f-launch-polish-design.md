# Phase F — launch polish (design)

> **Status:** approved 2026-06-10. Frontend-only. The honest, scoped-down version
> of v2 spec Phase F after subtracting what already exists.

## What already exists (so NOT in scope)

- **User profile page** — already satisfied by `SettingsDialog`'s 계정 section
  (avatar, name, email, 로그아웃). No separate page.
- **Per-feature empty states** — notes/sheets/links/decisions/etc. already render
  proper `EmptyState`s; the Phase B zero-workspace onboarding screen already exists.
- **Flipping `APP_AUTH_ALLOWLIST_ENABLED`** — an ops/env change and the actual
  "open the doors" launch trigger; a separate decision, not this build.

## In scope (frontend-only, 4 pieces)

### 1. Privacy + Terms pages

- New **public** routes `/privacy` and `/terms`, placed alongside `/login`,
  `/auth/callback`, `/invite/:token` (outside `RequireAuth`/`MobileShell`),
  `React.lazy`-split.
- A single small shared **`LegalPage`** layout component (heading + prose +
  back-to-login link) renders both, parameterized by title + content. One
  `.module.css`. Tokens only, hairlines, no card lift.
- **Korean placeholder copy — honest, not lorem:**
  - **개인정보 처리방침:** collected data (Google 이메일·이름·프로필 사진 via OAuth;
    사용자가 작성한 메모·시트·기타 콘텐츠); storage (자체 서버, 비공개);
    not sold or shared with third parties; retention/deletion (계정·콘텐츠 삭제 시
    제거); a contact email; a "비상업적 개인 프로젝트" note.
  - **이용약관:** as-is / no-warranty, acceptable use, account termination,
    "본 약관은 한국어를 기준으로 합니다." Short.
- Copy lives as static constants in the feature (easy to refine later).

### 2. Landing page (direction B — left/right split)

Rework `src/pages/Login.tsx` + `Login.css`:
- **Left column:** product value — "공유 문서" title, a short value line
  ("함께 쓰는 작은 워크스페이스"), and "메모 · 시트 · 계산기 · 결정".
- **Right column:** the existing Google sign-in card — the OAuth `<a>` button
  (wiring untouched), the `error` display block, and the "링크로 받은 문서를 보러
  오셨다면 로그인이 필요 없습니다." hint.
- Hairline divider between columns; no shadows / no lift.
- **Mobile:** stacks to a single column (value text on top, sign-in below).
- The OAuth URL construction and `ERROR_MESSAGES` map stay exactly as they are.

### 3. Footer links

- A small footer on the landing page: `개인정보` · `이용약관` links → the new
  pages, plus a quiet one-line tagline.
- The same two links added discreetly to `SettingsDialog` (a small footer row),
  so they're reachable when signed in.

### 4. Fresh-workspace welcome (direction A — warm line)

- Enhance the notes empty state: when a workspace has no notes, show a warm
  welcome above the existing "새 메모 만들기" action — a Lucide icon (NOT emoji),
  "환영해요 — 워크스페이스가 비어 있어요", and "첫 메모를 적어 시작해보세요."
- Reuse the existing `EmptyState` primitive; this is richer copy + icon for the
  empty-notes case, not a new component or any new state tracking.
- Implementation note: `NoteListEmpty.tsx` already wraps `EmptyState` with an
  icon + title + action — adjust its copy/icon to the warm welcome. (If the same
  empty state is reused in a non-fresh context where the warm copy would be odd,
  keep it simple — the notes list empty state always means "this workspace has no
  notes yet", which is exactly the fresh-workspace signal.)

## Conventions

- All UI text Korean; Lucide icons (never emoji); CSS Modules + tokens (no
  hardcoded hex); one primary button per screen; no setState-in-effect.
- Public routes get no `X-Workspace-Id` / auth (they render for logged-out users).
- Type-check with `npx tsc -b --noEmit` (root tsconfig is a references stub —
  plain `tsc --noEmit` is a no-op). Authoritative gate: `npm run build`.

## Out of scope (restated)

Profile page (exists), allowlist flip (ops/launch trigger), any backend change,
real (lawyer-reviewed) legal text — these are minimal honest placeholders.
