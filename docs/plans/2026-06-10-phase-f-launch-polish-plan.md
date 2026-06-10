# Phase F — Launch Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Privacy/Terms pages, a split landing page, footer links, and a warm fresh-workspace welcome — the genuinely-missing slice of v2 Phase F.

**Architecture:** Frontend-only. Two new public routes render a shared `LegalPage` component fed by static Korean content. `Login.tsx`/`Login.css` become a two-column landing (stacking on mobile) with a footer linking the legal pages. `SettingsDialog` gets the same two links. `NoteListEmpty` gains a warm welcome description.

**Tech Stack:** Vite + React 19 + TS + React Router v6 + CSS Modules + lucide-react.

**Design doc:** `docs/plans/2026-06-10-phase-f-launch-polish-design.md`

**Repo:** `/Users/jeongjin/WebstormProjects/shared-docs-root/shared-docs` (branch `phase-f-launch-polish`).

**Verification gate (no unit-test harness in this frontend — matches how Phase E FE tasks were verified):**
- Type-check: `npx tsc -b --noEmit` (CRITICAL: root `tsconfig.json` is a references stub — plain `tsc --noEmit` checks zero files and falsely passes).
- Lint: `npx eslint <changed paths>`.
- Build (authoritative): `npm run build`.
- Plus a stated manual check per task.

**Conventions:** All UI text Korean; lucide-react icons (never emoji); CSS Modules + tokens from `src/components/ui/tokens.css` (no hardcoded hex); one primary button per screen; no setState-in-effect. Public routes carry no auth/`X-Workspace-Id`.

---

## File Structure

- `src/pages/legal/legalContent.ts` — typed static Korean copy for both docs (NEW).
- `src/pages/legal/LegalPage.tsx` + `LegalPage.module.css` — shared layout rendering one doc (NEW).
- `src/App.tsx` — add `/privacy` + `/terms` public lazy routes (MODIFY).
- `src/pages/Login.tsx` + `src/pages/Login.css` — split landing + footer links (MODIFY).
- `src/features/settings/SettingsDialog.tsx` + `SettingsDialog.module.css` — legal footer links (MODIFY).
- `src/features/notes/list/NoteListEmpty.tsx` — warm welcome copy (MODIFY).

---

## Task 1: Legal content + LegalPage component + routes

**Files:**
- Create: `src/pages/legal/legalContent.ts`
- Create: `src/pages/legal/LegalPage.tsx`
- Create: `src/pages/legal/LegalPage.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the content module**

`src/pages/legal/legalContent.ts`:
```ts
export type LegalDoc = 'privacy' | 'terms'

export type LegalSection = { heading: string; paragraphs: string[] }

export type LegalContent = {
  title: string
  updated: string
  sections: LegalSection[]
}

export const LEGAL_CONTENT: Record<LegalDoc, LegalContent> = {
  privacy: {
    title: '개인정보 처리방침',
    updated: '시행일: 2026년 6월 10일',
    sections: [
      {
        heading: '수집하는 정보',
        paragraphs: [
          'Google 계정으로 로그인할 때 이메일 주소, 이름, 프로필 사진을 받습니다.',
          '서비스를 이용하며 작성한 메모, 시트, 계산 기록, 그 밖의 콘텐츠가 저장됩니다.',
        ],
      },
      {
        heading: '이용 목적',
        paragraphs: [
          '수집한 정보는 로그인과 본인 식별, 그리고 워크스페이스 데이터를 제공하는 데에만 사용합니다.',
        ],
      },
      {
        heading: '보관과 파기',
        paragraphs: [
          '모든 데이터는 자체 서버에 비공개로 저장됩니다.',
          '계정이나 콘텐츠를 삭제하면 관련 데이터도 함께 삭제됩니다.',
        ],
      },
      {
        heading: '제3자 제공',
        paragraphs: [
          '수집한 정보를 판매하거나 외부에 제공하지 않습니다. Google 로그인은 인증 목적에만 사용됩니다.',
        ],
      },
      {
        heading: '문의',
        paragraphs: [
          '개인정보 관련 문의는 jeongjin@ecoletree.com 으로 보내주세요.',
          '본 서비스는 비상업적 개인 프로젝트입니다.',
        ],
      },
    ],
  },
  terms: {
    title: '이용약관',
    updated: '시행일: 2026년 6월 10일',
    sections: [
      {
        heading: '서비스 제공',
        paragraphs: [
          '본 서비스는 “있는 그대로” 제공되며, 가용성이나 정확성을 보장하지 않습니다.',
          '비상업적 개인 프로젝트로 운영되며, 사전 고지 없이 변경되거나 중단될 수 있습니다.',
        ],
      },
      {
        heading: '이용자의 책임',
        paragraphs: [
          '이용자는 불법이거나 타인의 권리를 침해하는 콘텐츠를 게시하지 않습니다.',
          '작성한 콘텐츠에 대한 책임은 이용자 본인에게 있습니다.',
        ],
      },
      {
        heading: '이용 제한',
        paragraphs: [
          '약관을 위반하거나 운영상 필요한 경우 계정 이용이 제한될 수 있습니다.',
        ],
      },
      {
        heading: '준거',
        paragraphs: [
          '본 약관은 한국어를 기준으로 해석합니다.',
        ],
      },
    ],
  },
}
```

- [ ] **Step 2: Create the LegalPage component**

`src/pages/legal/LegalPage.tsx`:
```tsx
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { LEGAL_CONTENT, type LegalDoc } from './legalContent'
import styles from './LegalPage.module.css'

type Props = { doc: LegalDoc }

export default function LegalPage({ doc }: Props) {
  const content = LEGAL_CONTENT[doc]
  return (
    <div className={styles.page}>
      <article className={styles.inner}>
        <Link to="/login" className={styles.back}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          돌아가기
        </Link>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.updated}>{content.updated}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className={styles.paragraph}>{p}</p>
            ))}
          </section>
        ))}
      </article>
    </div>
  )
}
```

- [ ] **Step 3: Create the stylesheet**

`src/pages/legal/LegalPage.module.css` (tokens only; verify each token exists in `src/components/ui/tokens.css` — if any is missing, substitute the nearest existing token and note it):
```css
.page {
  min-height: 100dvh;
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-sans);
  padding: var(--sp-7) var(--sp-5);
  display: flex;
  justify-content: center;
}
.inner {
  width: 100%;
  max-width: 640px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  text-decoration: none;
  margin-bottom: var(--sp-6);
}
.back:hover { color: var(--c-text); }
.title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: var(--fw-bold);
  font-size: var(--fs-2xl);
  letter-spacing: var(--tracking-display);
}
.updated {
  margin: var(--sp-2) 0 var(--sp-6);
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
}
.section { margin-bottom: var(--sp-6); }
.heading {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-md);
  font-weight: var(--fw-semi);
  color: var(--c-text);
}
.paragraph {
  margin: 0 0 var(--sp-2);
  font-size: var(--fs-sm);
  line-height: var(--lh-relaxed);
  color: var(--c-text-muted);
}
```
> Token verification: `--fs-2xl`, `--lh-relaxed`, `--tracking-display`, `--fw-semi` — grep `src/components/ui/tokens.css` to confirm. `Login.css` already uses `--font-serif`, `--fw-bold`, `--tracking-display`, `--lh-tight`, `--c-text-muted`, `--c-text-subtle`, so those exist. If `--fs-2xl` or `--lh-relaxed` don't exist, use the closest (e.g. the largest non-display font-size token, and `--lh-snug`).

- [ ] **Step 4: Add public routes in `src/App.tsx`**

Add a lazy import alongside the others (after the `InviteClaim` import, line ~28):
```ts
const LegalPage = lazy(() => import('./pages/legal/LegalPage'))
```
Add two routes in the PUBLIC block (next to `/invite/:token`, BEFORE `<Route element={<RequireAuth />}>`):
```tsx
<Route path="/privacy" element={<LegalPage doc="privacy" />} />
<Route path="/terms" element={<LegalPage doc="terms" />} />
```

- [ ] **Step 5: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/pages/legal src/App.tsx && npm run build`
Expected: all clean; new chunk for `LegalPage` emitted.
Manual: `npm run dev`, visit `/privacy` and `/terms` while logged OUT (no redirect to /login), confirm content renders and 돌아가기 → `/login`.

- [ ] **Step 6: Commit**
```bash
git add src/pages/legal src/App.tsx
git commit -m "feat(phase-f): privacy + terms pages on public routes"
```

---

## Task 2: Landing page split layout + footer links

**Files:**
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/Login.css`

**Context:** Keep ALL existing OAuth wiring (`apiBase`, the `href`, `ERROR_MESSAGES`, the Google SVG, the error block, the hint). Only the layout changes: a two-column split (value left, sign-in right) that stacks on mobile, plus a footer with legal links + tagline.

- [ ] **Step 1: Rework `Login.tsx`**

Replace the contents of `src/pages/Login.tsx` with:
```tsx
import { Link, useSearchParams } from 'react-router-dom'
import './Login.css'

const ERROR_MESSAGES: Record<string, string> = {
  deactivated: '계정이 비활성화되었습니다.',
  missing_email: 'Google 계정에서 이메일을 가져올 수 없습니다.',
  missing_token: '로그인 토큰을 찾을 수 없습니다. 다시 시도해 주세요.',
  oauth_failed: 'Google 로그인에 실패했습니다. 다시 시도해 주세요.',
  session_expired: '세션이 만료되었습니다. 다시 로그인해 주세요.',
}

export default function Login() {
  const [params] = useSearchParams()
  const error = params.get('error')
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

  return (
    <div className="login">
      <main className="login__inner">
        <section className="login__intro">
          <h1 className="login__title">공유 문서</h1>
          <p className="login__lede">함께 쓰는 작은 워크스페이스.</p>
          <p className="login__pillars">메모 · 시트 · 계산기 · 결정</p>
        </section>

        <div className="login__divider" aria-hidden="true" />

        <section className="login__panel">
          <h2 className="login__panel-title">시작하기</h2>

          {error && (
            <div className="login__error" role="alert">
              {ERROR_MESSAGES[error] ?? `오류: ${error}`}
            </div>
          )}

          <a className="login__google" href={`${apiBase}/oauth2/authorization/google`}>
            <svg className="login__google-icon" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
            </svg>
            <span>Google로 시작하기</span>
          </a>

          <p className="login__hint">
            링크로 받은 문서를 보러 오셨다면 로그인이 필요 없습니다.
          </p>
        </section>
      </main>

      <footer className="login__footer">
        <Link to="/privacy" className="login__footer-link">개인정보 처리방침</Link>
        <span className="login__footer-dot" aria-hidden="true">·</span>
        <Link to="/terms" className="login__footer-link">이용약관</Link>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Rework `Login.css`**

Replace `src/pages/Login.css` with (keeps `.login__title/.login__lede/.login__error/.login__google*/.login__hint` styling, adds split + footer):
```css
/* Bear-style minimal landing. Two-column split on wide screens (value left,
   sign-in right), single calm column on mobile. No shadows, hairline divider. */

.login {
  min-height: 100dvh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-7);
  padding: var(--sp-7) var(--sp-5);
  background: var(--c-bg);
  color: var(--c-text);
  font-family: var(--font-sans);
}

.login__inner {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
  align-items: center;
  text-align: center;
}

.login__intro { display: flex; flex-direction: column; align-items: center; }

.login__title {
  margin: 0;
  font-family: var(--font-serif);
  font-weight: var(--fw-bold);
  font-size: clamp(40px, 7vw, 64px);
  line-height: var(--lh-tight);
  letter-spacing: var(--tracking-display);
  color: var(--c-text);
}

.login__lede {
  margin: var(--sp-3) 0 0;
  font-size: var(--fs-md);
  line-height: var(--lh-snug);
  color: var(--c-text-muted);
}

.login__pillars {
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-sm);
  color: var(--c-text-subtle);
  letter-spacing: 0.01em;
}

.login__divider { display: none; }

.login__panel {
  width: 100%;
  max-width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login__panel-title {
  margin: 0 0 var(--sp-4);
  font-size: var(--fs-sm);
  font-weight: var(--fw-semi);
  color: var(--c-text-subtle);
}

.login__error {
  margin: 0 0 var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-danger-bg);
  border: 1px solid var(--c-danger-border);
  border-radius: var(--r-md);
  color: var(--c-danger);
  font-size: var(--fs-sm);
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}

.login__google {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  width: 100%;
  padding: var(--sp-3) var(--sp-4);
  background: var(--c-surface);
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  font-family: inherit;
  font-size: var(--fs-md);
  font-weight: var(--fw-medium);
  letter-spacing: -0.005em;
  text-decoration: none;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.login__google:hover { background: var(--c-surface-tint); border-color: var(--c-border-strong); }
.login__google:focus-visible { outline: none; box-shadow: var(--ring-focus); }
.login__google-icon { width: 18px; height: 18px; flex-shrink: 0; }

.login__hint {
  margin: var(--sp-5) 0 0;
  font-size: var(--fs-sm);
  line-height: var(--lh-snug);
  color: var(--c-text-subtle);
  max-width: 28ch;
}

.login__footer {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}
.login__footer-link { color: var(--c-text-subtle); text-decoration: none; }
.login__footer-link:hover { color: var(--c-text); }
.login__footer-dot { color: var(--c-text-subtle); }

/* Wide screens: value left, sign-in right, hairline divider between. */
@media (min-width: 720px) {
  .login__inner {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: var(--sp-7);
    text-align: left;
  }
  .login__intro { align-items: flex-start; flex: 1; }
  .login__divider {
    display: block;
    align-self: stretch;
    width: 1px;
    background: var(--c-border);
  }
  .login__panel { align-items: stretch; flex: 0 0 320px; }
  .login__panel-title { text-align: left; }
  .login__hint { text-align: left; }
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/pages/Login.tsx && npm run build`
Manual: `npm run dev`, view `/login` at desktop width (two columns + divider) and narrow width (single stacked column); footer links navigate to `/privacy` and `/terms`; trigger `?error=oauth_failed` to confirm the error block still renders inside the right panel; the Google button still points at `${apiBase}/oauth2/authorization/google`.

- [ ] **Step 4: Commit**
```bash
git add src/pages/Login.tsx src/pages/Login.css
git commit -m "feat(phase-f): split landing layout + legal footer links"
```

---

## Task 3: Legal links in SettingsDialog

**Files:**
- Modify: `src/features/settings/SettingsDialog.tsx`
- Modify: `src/features/settings/SettingsDialog.module.css`

**Context:** Add a small footer with 개인정보 처리방침 / 이용약관 links at the bottom of the settings dialog (after the 계정 section), so legal pages are reachable when signed in. Navigating closes the dialog (the pages are full routes). The dialog already imports `useNavigate` and `useSettings` (for `setDialogOpen`).

- [ ] **Step 1: Add the footer to `SettingsDialog.tsx`**

After the `{user && ( ... 계정 ... )}` section's closing (just before `</Dialog.Content>`), add:
```tsx
          <footer className={styles.legal}>
            <button
              type="button"
              className={styles.legalLink}
              onClick={() => { s.setDialogOpen(false); navigate('/privacy') }}
            >
              개인정보 처리방침
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              className={styles.legalLink}
              onClick={() => { s.setDialogOpen(false); navigate('/terms') }}
            >
              이용약관
            </button>
          </footer>
```
(Use buttons + `navigate` for consistency with the existing `navigate('/settings/members')` rows, which also close the dialog first.)

- [ ] **Step 2: Add styles to `SettingsDialog.module.css`**

Append (tokens only; match the file's existing token usage):
```css
.legal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding-top: var(--sp-4);
  font-size: var(--fs-xs);
  color: var(--c-text-subtle);
}
.legalLink {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: var(--c-text-subtle);
}
.legalLink:hover { color: var(--c-text); }
```

- [ ] **Step 3: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/settings/SettingsDialog.tsx && npm run build`
Manual: open Settings (signed in), scroll to footer, click each link → dialog closes and `/privacy` / `/terms` renders.

- [ ] **Step 4: Commit**
```bash
git add src/features/settings/SettingsDialog.tsx src/features/settings/SettingsDialog.module.css
git commit -m "feat(phase-f): legal links in settings dialog"
```

---

## Task 4: Fresh-workspace welcome line

**Files:**
- Modify: `src/features/notes/list/NoteListEmpty.tsx`

**Context:** The notes empty state is what a brand-new (or freshly-joined) empty workspace shows on the Hub. Warm it up with a welcome line via the existing `EmptyState`'s `description` slot (already supported: `EmptyState` takes `icon`, `title`, `description`, `action`). Use a Lucide icon — NOT an emoji.

- [ ] **Step 1: Update `NoteListEmpty.tsx`**

Replace the file with:
```tsx
import { Sparkles } from 'lucide-react'
import { Button, EmptyState } from '../../../components/ui'

type Props = {
  onCreate: () => void
}

export default function NoteListEmpty({ onCreate }: Props) {
  return (
    <EmptyState
      icon={<Sparkles size={24} strokeWidth={1.5} />}
      title="환영해요 — 워크스페이스가 비어 있어요"
      description="첫 메모를 적어 시작해보세요."
      action={
        <Button variant="outline" size="sm" onClick={onCreate}>
          새 메모 만들기
        </Button>
      }
    />
  )
}
```
> `Sparkles` is a lucide-react icon (welcoming, not childish). If the team prefers a calmer glyph, `FilePlus2` (the previous icon) or `NotebookPen` also work — but `Sparkles` reads as "fresh start". The `description` prop is already rendered by `EmptyState` between title and action.

- [ ] **Step 2: Verify**

Run: `npx tsc -b --noEmit && npx eslint src/features/notes/list/NoteListEmpty.tsx && npm run build`
Manual: `npm run dev`, in a workspace with zero notes confirm the Hub shows the icon + welcome title + description + 새 메모 만들기, and that creating a note still works.

- [ ] **Step 3: Commit**
```bash
git add src/features/notes/list/NoteListEmpty.tsx
git commit -m "feat(phase-f): warm welcome on empty notes workspace"
```

---

## Final verification

- [ ] `npx tsc -b --noEmit` — clean.
- [ ] `npx eslint src/pages/legal src/pages/Login.tsx src/features/settings src/features/notes/list/NoteListEmpty.tsx src/App.tsx` — clean (ignore pre-existing errors in unrelated files).
- [ ] `npm run build` — clean; `LegalPage` chunk emitted.
- [ ] Manual smoke: logged-out `/privacy` + `/terms` render (no auth redirect); `/login` is split on desktop / stacked on mobile with working footer links; Settings footer links work signed-in; empty workspace shows the warm welcome.
- [ ] Dispatch a final code-review subagent over the whole `phase-f-launch-polish` diff.
- [ ] Then `superpowers:finishing-a-development-branch`.

## Self-review notes (spec coverage)

- Privacy + Terms pages (design §1) → Task 1. ✓
- Landing split direction B (design §2) → Task 2. ✓
- Footer links — login (design §3) → Task 2; settings (design §3) → Task 3. ✓
- Fresh-workspace welcome direction A (design §4) → Task 4. ✓
- Out of scope (profile page, allowlist flip, backend) → none built. ✓
- Type consistency: `LegalDoc`/`LEGAL_CONTENT` defined in Task 1, consumed by `LegalPage` (Task 1) and routes (Task 1); `EmptyState` `description` prop confirmed to exist before use (Task 4). ✓
