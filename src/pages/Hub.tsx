import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Folder,
  ChevronRight,
  Heart,
  Brush,
  Hammer,
  Landmark,
  LineChart,
  type LucideIcon,
} from 'lucide-react'
import './Hub.css'

type GuideStatus = 'done' | 'wip' | 'todo'
type FolderId = 'travel' | 'home' | 'finance'

interface FolderDef {
  id: FolderId
  name: string
}

interface Guide {
  id: string
  folder: FolderId
  Icon: LucideIcon
  title: string
  subtitle: string
  description: string
  path: string
  status: GuideStatus
}

const folders: FolderDef[] = [
  { id: 'travel',  name: '여행' },
  { id: 'home',    name: '집' },
  { id: 'finance', name: '금융' },
]

const guides: Guide[] = [
  {
    id: 'honeymoon',
    folder: 'travel',
    Icon: Heart,
    title: '신혼여행 가이드',
    subtitle: '파리 · 니스 · 바르셀로나 9박 10일',
    description: 'A안/B안 비교, 캘린더 뷰, 공식 링크 총정리.',
    path: '/honeymoon',
    status: 'done',
  },
  {
    id: 'cleaning',
    folder: 'home',
    Icon: Brush,
    title: '입주 청소 가이드',
    subtitle: '권선대우 325동201호 · 32평',
    description: '전체 철거 후 입주 청소. 재질별 세제, 공간별 순서, 2인 주말 플랜.',
    path: '/cleaning',
    status: 'done',
  },
  {
    id: 'interior',
    folder: 'home',
    Icon: Hammer,
    title: '인테리어 체크리스트',
    subtitle: '권선대우 아파트 리모델링',
    description: '공정별 체크사항 및 시공 메모.',
    path: '/interior',
    status: 'todo',
  },
  {
    id: 'loan',
    folder: 'finance',
    Icon: Landmark,
    title: '대출 가이드',
    subtitle: '디딤돌 · 신생아 특례',
    description: '대출 구조, 조건, 갈아타기 타이밍 정리.',
    path: '/loan',
    status: 'todo',
  },
  {
    id: 'stock',
    folder: 'finance',
    Icon: LineChart,
    title: '주식 투자 가이드',
    subtitle: '부부 장기 투자 시스템',
    description: '95% 인덱스 자동화 + 5% 개별 종목. 절세 계좌, DCA, 리밸런싱, LS일렉트릭 사례까지.',
    path: '/stock',
    status: 'done',
  },
]

const statusLabel: Record<GuideStatus, string> = {
  done: '완성',
  wip: '작성 중',
  todo: '준비 중',
}

function isFolderId(value: string | null): value is FolderId {
  return value !== null && folders.some((f) => f.id === value)
}

export default function Hub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const folderParam = searchParams.get('folder')
  const activeFolder = isFolderId(folderParam)
    ? folders.find((f) => f.id === folderParam) ?? null
    : null

  const goFolder = (id: FolderId) => setSearchParams({ folder: id })
  const goRoot = () => setSearchParams({})

  const openGuide = (g: Guide) => {
    if (g.status === 'todo') return
    navigate(g.path)
  }

  const guidesInFolder = activeFolder
    ? guides.filter((g) => g.folder === activeFolder.id)
    : []

  return (
    <div className="hub">
      <div className="hub__container">
        <header className="hub__header">
          <h1 className="hub__title">우리의 가이드북</h1>
          <p className="hub__subtitle">필요한 정보를 한눈에 정리했어요</p>
        </header>

        <nav className="hub__crumbs" aria-label="경로">
          <button
            type="button"
            className={`hub__crumb${activeFolder ? '' : ' hub__crumb--current'}`}
            onClick={goRoot}
            disabled={!activeFolder}
          >
            전체
          </button>
          {activeFolder && (
            <>
              <ChevronRight size={14} className="hub__crumb-sep" aria-hidden="true" />
              <span className="hub__crumb hub__crumb--current">{activeFolder.name}</span>
            </>
          )}
        </nav>

        {!activeFolder ? (
          <ul className="hub__grid" aria-label="폴더">
            {folders.map((f) => {
              const count = guides.filter((g) => g.folder === f.id).length
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className="hub__tile hub__tile--folder"
                    onClick={() => goFolder(f.id)}
                  >
                    <span className="hub__tile-icon" aria-hidden="true">
                      <Folder size={36} strokeWidth={1.5} />
                    </span>
                    <span className="hub__tile-title">{f.name}</span>
                    <span className="hub__tile-meta">{count}개</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="hub__grid" aria-label={`${activeFolder.name} 가이드`}>
            {guidesInFolder.map((g) => {
              const disabled = g.status === 'todo'
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className={`hub__tile hub__tile--guide${disabled ? ' hub__tile--disabled' : ''}`}
                    onClick={() => openGuide(g)}
                    disabled={disabled}
                    aria-label={`${g.title} — ${statusLabel[g.status]}`}
                  >
                    <span className="hub__tile-icon" aria-hidden="true">
                      <g.Icon size={32} strokeWidth={1.5} />
                    </span>
                    <span className="hub__tile-title">{g.title}</span>
                    <span className={`hub__tile-status hub__tile-status--${g.status}`}>
                      <span className="hub__tile-dot" aria-hidden="true" />
                      {statusLabel[g.status]}
                    </span>
                  </button>
                </li>
              )
            })}
            {guidesInFolder.length === 0 && (
              <li className="hub__empty">아직 문서가 없어요.</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
