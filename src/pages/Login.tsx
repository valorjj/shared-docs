import { useSearchParams } from 'react-router-dom'
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
        <h1 className="login__title">공유 문서</h1>
        <p className="login__lede">메모, 시트, 그리고 공유.</p>

        {error && (
          <div className="login__error" role="alert">
            {ERROR_MESSAGES[error] ?? `오류: ${error}`}
          </div>
        )}

        <div className="login__rule" aria-hidden="true" />

        <a className="login__google" href={`${apiBase}/oauth2/authorization/google`}>
          <svg className="login__google-icon" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.185l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
            />
          </svg>
          <span>Google로 시작하기</span>
        </a>

        <p className="login__hint">
          링크로 받은 문서를 보러 오셨다면 로그인이 필요 없습니다.
        </p>
      </main>
    </div>
  )
}
