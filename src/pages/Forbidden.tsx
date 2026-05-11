import { Link } from 'react-router-dom'

export default function Forbidden() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#f4efe5',
        color: '#1c1916',
        fontFamily: '"Noto Sans KR", system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>403</h1>
      <p style={{ fontSize: '1.05rem', color: '#6b6660', margin: '0 0 1.5rem' }}>
        권한이 없습니다. 이 페이지에 접근할 수 없습니다.
      </p>
      <Link
        to="/"
        style={{
          padding: '0.55rem 1.2rem',
          background: '#1b3a5c',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        홈으로
      </Link>
    </div>
  )
}
