import { useNavigate } from 'react-router-dom'
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
  },
]

const statusLabel: Record<GuideStatus, string> = {
  done: '완성',
  wip: '작성 중',
  todo: '준비 중',
}

export default function Hub() {
  const navigate = useNavigate()

  const handleClick = (guide: Guide) => {
    if (guide.status === 'todo') return
    navigate(guide.path)
  }

  return (
    <div className="hub">
      <div className="hub__container">
        <header className="hub__header">
          <h1 className="hub__title">우리의 가이드북</h1>
          <p className="hub__subtitle">필요한 정보를 한눈에 정리했어요</p>
        </header>

        <div className="hub__section-label">
          <span>가이드</span>
          <span className="hub__section-count">{guides.length}</span>
        </div>

        <ul className="hub__list">
          {guides.map((guide) => {
            const disabled = guide.status === 'todo'
            return (
              <li
                key={guide.id}
                className={`hub__row${disabled ? ' hub__row--disabled' : ''}`}
                onClick={() => handleClick(guide)}
                onKeyDown={(e) => {
                  if (disabled) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClick(guide)
                  }
                }}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled || undefined}
              >
                <span className="hub__row-emoji" aria-hidden="true">
                  {guide.emoji}
                </span>
                <div className="hub__row-body">
                  <div className="hub__row-head">
                    <h2 className="hub__row-title">{guide.title}</h2>
                    <span className={`hub__status hub__status--${guide.status}`}>
                      <span className="hub__status-dot" aria-hidden="true" />
                      {statusLabel[guide.status]}
                    </span>
                  </div>
                  <p className="hub__row-sub">{guide.subtitle}</p>
                  <p className="hub__row-desc">{guide.description}</p>
                  <div className="hub__row-tags">
                    {guide.tags.map((tag) => (
                      <span key={tag} className="hub__tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
