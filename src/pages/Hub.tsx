import { Link, useNavigate } from 'react-router-dom'
import { Database, Calendar } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import './Hub.css'

type GuideStatus = 'done' | 'wip' | 'todo'

interface Guide {
  id: string
  emoji: string
  title: string
  subtitle: string
  description: string
  path: string
  status: GuideStatus
  tags: string[]
  color: string
}

const guides: Guide[] = [
  {
    id: 'honeymoon',
    emoji: '✈️',
    title: '신혼여행 가이드',
    subtitle: '파리 · 니스 · 바르셀로나 9박 10일',
    description: 'A안/B안 비교, 캘린더 뷰, 공식 링크 총정리.',
    path: '/honeymoon',
    status: 'done',
    tags: ['여행', '유럽'],
    color: 'navy',
  },
  {
    id: 'cleaning',
    emoji: '🧹',
    title: '입주 청소 가이드',
    subtitle: '권선대우 325동201호 · 32평',
    description: '전체 철거 후 입주 청소. 재질별 세제, 공간별 순서, 2인 주말 플랜.',
    path: '/cleaning',
    status: 'done',
    tags: ['입주청소', '인테리어'],
    color: 'teal',
  },
  {
    id: 'interior',
    emoji: '🏠',
    title: '인테리어 체크리스트',
    subtitle: '권선대우 아파트 리모델링',
    description: '공정별 체크사항 및 시공 메모.',
    path: '/interior',
    status: 'todo',
    tags: ['리모델링', '체크리스트'],
    color: 'teal',
  },
  {
    id: 'loan',
    emoji: '🏦',
    title: '대출 가이드',
    subtitle: '디딤돌 · 신생아 특례',
    description: '대출 구조, 조건, 갈아타기 타이밍 정리.',
    path: '/loan',
    status: 'todo',
    tags: ['대출', '부동산'],
    color: 'green',
  },
  {
    id: 'stock',
    emoji: '📈',
    title: '주식 투자 가이드',
    subtitle: '부부 장기 투자 시스템',
    description: '95% 인덱스 자동화 + 5% 개별 종목. 절세 계좌, DCA, 리밸런싱, LS일렉트릭 사례까지.',
    path: '/stock',
    status: 'done',
    tags: ['투자', 'ETF', '부부 절세'],
    color: 'orange',
  },
]

const statusLabel: Record<GuideStatus, string> = {
  done: '완성',
  wip: '작성 중',
  todo: '준비 중',
}

export default function Hub() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleClick = (guide: Guide) => {
    if (guide.status === 'todo') return
    navigate(guide.path)
  }

  return (
    <div className="hub">
      <header className="hub__header">
        {user?.role === 'ADMIN' && (
          <Link to="/admin" className="hub__admin-link">관리</Link>
        )}
        <h1 className="hub__title">우리의 가이드북</h1>
        <p className="hub__subtitle">필요한 정보를 한눈에 정리했어요</p>
      </header>

      <nav className="hub__quick-nav" aria-label="섹션 바로가기">
        <Link to="/data" className="hub__quick-link">
          <span className="hub__quick-icon" aria-hidden="true">
            <Database size={22} strokeWidth={2} />
          </span>
          <span>
            <span className="hub__quick-label">데이터</span>
            <span className="hub__quick-sub">구매 · 할 일 · 기념일</span>
          </span>
        </Link>
        <Link to="/calendar" className="hub__quick-link">
          <span className="hub__quick-icon" aria-hidden="true">
            <Calendar size={22} strokeWidth={2} />
          </span>
          <span>
            <span className="hub__quick-label">캘린더</span>
            <span className="hub__quick-sub">기념일 · 마감일을 한눈에</span>
          </span>
        </Link>
      </nav>

      <main className="hub__grid">
        {guides.map((guide) => (
          <article
            key={guide.id}
            className={`card card--${guide.color} ${guide.status === 'todo' ? 'card--disabled' : ''}`}
            onClick={() => handleClick(guide)}
          >
            <div className="card__emoji">{guide.emoji}</div>
            <span className={`card__badge card__badge--${guide.status}`}>
              {statusLabel[guide.status]}
            </span>
            <h2 className="card__title">{guide.title}</h2>
            <p className="card__subtitle">{guide.subtitle}</p>
            <p className="card__desc">{guide.description}</p>
            <div className="card__tags">
              {guide.tags.map((tag) => (
                <span key={tag} className="card__tag">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </main>

      <footer className="hub__footer">
        <p>&copy; 2026 &mdash; with ❤️</p>
      </footer>
    </div>
  )
}
