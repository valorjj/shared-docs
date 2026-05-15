import * as Dialog from '@radix-ui/react-dialog'
import { LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useSettings } from './settingsContext'
import {
  FONTS,
  FONT_LABELS,
  LINE_HEIGHTS,
  LINE_HEIGHT_LABELS,
  THEMES,
  THEME_LABELS,
  type FontKey,
  type Theme,
} from './types'
import styles from './SettingsDialog.module.css'

export default function SettingsDialog() {
  const s = useSettings()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => {
    s.setDialogOpen(false)
    logout()
    navigate('/login', { replace: true })
  }
  return (
    <Dialog.Root open={s.dialogOpen} onOpenChange={s.setDialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>설정</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label="닫기">
                <X size={16} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </header>

          <Section label="테마">
            {THEMES.map((t) => (
              <ChipButton
                key={t}
                label={THEME_LABELS[t]}
                active={s.theme === t}
                onClick={() => s.setTheme(t)}
                swatch={<ThemeSwatch theme={t} />}
              />
            ))}
          </Section>

          <Section label="본문 글꼴" hint="메모와 본문 텍스트에 적용됩니다.">
            {FONTS.map((f) => (
              <ChipButton
                key={f}
                label={FONT_LABELS[f]}
                active={s.font === f}
                onClick={() => s.setFont(f)}
                sampleFont={f}
              />
            ))}
          </Section>

          <Section label="줄 간격" hint="메모 본문에 적용됩니다.">
            {LINE_HEIGHTS.map((l) => (
              <ChipButton
                key={l}
                label={LINE_HEIGHT_LABELS[l]}
                active={s.lineHeight === l}
                onClick={() => s.setLineHeight(l)}
              />
            ))}
          </Section>

          {user && (
            <section className={styles.section}>
              <div className={styles.sectionLabel}>계정</div>
              <div className={styles.account}>
                <div className={styles.accountIdentity}>
                  {user.pictureUrl ? (
                    <img className={styles.accountAvatar} src={user.pictureUrl} alt="" />
                  ) : (
                    <span className={`${styles.accountAvatar} ${styles.accountAvatarInitial}`} aria-hidden="true">
                      {user.name?.[0] ?? '·'}
                    </span>
                  )}
                  <div className={styles.accountText}>
                    <div className={styles.accountName}>{user.name}</div>
                    <div className={styles.accountEmail}>{user.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.logout}
                  onClick={handleLogout}
                >
                  <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
                  로그아웃
                </button>
              </div>
            </section>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Section({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {hint && <div className={styles.sectionHint}>{hint}</div>}
      <div className={styles.chipRow}>{children}</div>
    </section>
  )
}

function ChipButton({
  label,
  active,
  onClick,
  swatch,
  sampleFont,
}: {
  label: string
  active: boolean
  onClick: () => void
  swatch?: React.ReactNode
  sampleFont?: FontKey
}) {
  const style = sampleFont
    ? {
        fontFamily:
          sampleFont === 'serif'
            ? "'Noto Serif KR', serif"
            : sampleFont === 'mono'
              ? 'ui-monospace, Menlo, monospace'
              : "'Noto Sans KR', sans-serif",
      }
    : undefined
  return (
    <button
      type="button"
      className={`${styles.chip}${active ? ` ${styles.chipActive}` : ''}`}
      onClick={onClick}
      style={style}
    >
      {swatch && <span className={styles.chipSwatch}>{swatch}</span>}
      <span>{label}</span>
    </button>
  )
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  // Tiny preview circles that reflect each theme's bg / accent so the
  // chip is recognizable at a glance — same idea Bear uses in its theme list.
  const swatches: Record<Theme, { bg: string; accent: string }> = {
    light:   { bg: '#f4f4f4', accent: '#e8434a' },
    dark:    { bg: '#16181d', accent: '#ff6168' },
    dracula: { bg: '#282a36', accent: '#ff79c6' },
    monokai: { bg: '#272822', accent: '#f92672' },
  }
  const { bg, accent } = swatches[theme]
  return (
    <span
      className={styles.swatchOuter}
      style={{ background: bg, borderColor: bg === '#f4f4f4' ? '#e6e6e6' : 'transparent' }}
      aria-hidden="true"
    >
      <span className={styles.swatchInner} style={{ background: accent }} />
    </span>
  )
}

