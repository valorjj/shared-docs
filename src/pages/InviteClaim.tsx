import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MailX, Users } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useActiveWorkspace } from '../auth/useActiveWorkspace'
import { Button, Spinner } from '../components/ui'
import { ApiError } from '../api/client'
import {
  PENDING_INVITE_KEY,
  useClaimInvitation,
  useInvitePreview,
} from '../features/workspaces/membersApi'
import styles from './InviteClaim.module.css'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'

/**
 * `/invite/:token` — public route. If the visitor isn't signed in, stash the
 * token and bounce to Google (AuthCallback routes back here after). Once signed
 * in, preview the invite and let the matching user accept. Email-match is also
 * enforced server-side at claim.
 */
export default function InviteClaim() {
  const { token = '' } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { setActiveId } = useActiveWorkspace()

  const preview = useInvitePreview(token, !!user)
  const claim = useClaimInvitation()
  const [claimError, setClaimError] = useState<string | null>(null)

  // Signed out → remember the token and go sign in.
  useEffect(() => {
    if (!user && token) {
      sessionStorage.setItem(PENDING_INVITE_KEY, token)
      window.location.href = `${apiBase}/oauth2/authorization/google`
    }
  }, [user, token])

  if (!user) return <Screen><Spinner label="로그인으로 이동 중…" /></Screen>

  if (preview.isLoading) return <Screen><Spinner label="초대 확인 중…" /></Screen>

  if (preview.isError || !preview.data) {
    return (
      <Outcome
        title="초대를 찾을 수 없어요"
        body="링크가 잘못되었거나 초대가 취소되었어요."
        onHome={() => navigate('/', { replace: true })}
      />
    )
  }

  const p = preview.data
  const mismatch = p.email.toLowerCase() !== user.email.toLowerCase()

  if (p.status === 'CLAIMED') {
    return <Outcome title="이미 사용된 초대예요" body="이 초대는 이미 수락되었어요." onHome={() => navigate('/', { replace: true })} />
  }
  if (p.status === 'EXPIRED') {
    return <Outcome title="만료된 초대예요" body="이 초대는 만료되었어요. 새 초대를 요청하세요." onHome={() => navigate('/', { replace: true })} />
  }
  if (mismatch) {
    return (
      <Screen>
        <div className={styles.card}>
          <MailX className={styles.icon} size={28} strokeWidth={1.5} aria-hidden="true" />
          <h1 className={styles.title}>다른 이메일을 위한 초대예요</h1>
          <p className={styles.body}>
            이 초대는 <span className={styles.email}>{p.email}</span> 님을 위한 거예요.
            지금은 <span className={styles.email}>{user.email}</span> 로 로그인되어 있어요.
          </p>
          <div className={styles.actions}>
            <Button
              variant="outline"
              onClick={() => {
                // Re-stash so the post-login round-trip returns here, then sign
                // in with a different Google account.
                sessionStorage.setItem(PENDING_INVITE_KEY, token)
                logout()
                window.location.href = `${apiBase}/oauth2/authorization/google`
              }}
            >
              다른 Google 계정으로 로그인
            </Button>
            <Button variant="ghost" onClick={() => navigate('/', { replace: true })}>홈으로</Button>
          </div>
        </div>
      </Screen>
    )
  }

  const onAccept = async () => {
    setClaimError(null)
    try {
      const ws = await claim.mutateAsync(token)
      setActiveId(ws.id)
      navigate('/', { replace: true })
    } catch (e) {
      setClaimError(e instanceof ApiError ? e.message : '수락에 실패했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <Screen>
      <div className={styles.card}>
        <Users className={styles.icon} size={28} strokeWidth={1.5} aria-hidden="true" />
        <h1 className={styles.title}>
          <span className={styles.workspace}>{p.workspaceName}</span> 에 초대받았어요
        </h1>
        <p className={styles.body}>{p.inviterName} 님이 이 워크스페이스로 초대했어요.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={onAccept} disabled={claim.isPending}>
            {claim.isPending ? '수락 중…' : '수락하고 참여하기'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/', { replace: true })} disabled={claim.isPending}>
            나중에
          </Button>
        </div>
        {claimError && <p className={styles.muted}>{claimError}</p>}
      </div>
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>
}

function Outcome({ title, body, onHome }: { title: string; body: string; onHome: () => void }) {
  return (
    <Screen>
      <div className={styles.card}>
        <MailX className={styles.icon} size={28} strokeWidth={1.5} aria-hidden="true" />
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <Button variant="outline" onClick={onHome}>홈으로</Button>
        </div>
      </div>
    </Screen>
  )
}
