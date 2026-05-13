import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

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
    window.history.replaceState(null, '', '/')
    navigate('/', { replace: true })
  }, [loginWithToken, navigate])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Noto Sans KR", system-ui, sans-serif', color: '#6b6660' }}>
      로그인 처리 중…
    </div>
  )
}
