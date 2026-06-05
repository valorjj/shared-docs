import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PENDING_INVITE_KEY } from '../features/workspaces/membersApi'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const token = params.get('token')

    if (!token) {
      navigate('/login?error=missing_token', { replace: true })
      return
    }

    loginWithToken(token)

    // If the user arrived via an invite link while signed out, /invite/:token
    // stashed the token before sending them to Google. Return them there so they
    // can accept; otherwise land on the home workspace.
    const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY)
    if (pendingInvite) {
      sessionStorage.removeItem(PENDING_INVITE_KEY)
      window.history.replaceState(null, '', `/invite/${pendingInvite}`)
      navigate(`/invite/${pendingInvite}`, { replace: true })
      return
    }

    window.history.replaceState(null, '', '/')
    navigate('/', { replace: true })
  }, [loginWithToken, navigate])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Noto Sans KR", system-ui, sans-serif', color: '#6b6660' }}>
      로그인 처리 중…
    </div>
  )
}
