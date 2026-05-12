import { Link } from 'react-router-dom'
import {
  Database,
  Wallet,
  ListTodo,
  Cake,
  Link as LinkIcon,
  ChefHat,
  type LucideIcon,
} from 'lucide-react'
import './DataHub.css'

type FeatureCard = {
  id: string
  Icon: LucideIcon
  title: string
  description: string
  path: string
  status: 'done' | 'wip' | 'todo'
}

const features: FeatureCard[] = [
  {
    id: 'purchases',
    Icon: Wallet,
    title: '구매 내역',
    description: '일상 지출과 외화 결제를 함께 기록합니다.',
    path: '/data/purchases',
    status: 'done',
  },
  {
    id: 'todos',
    Icon: ListTodo,
    title: '할 일',
    description: '공동 할 일 목록과 마감일.',
    path: '/data/todos',
    status: 'done',
  },
  {
    id: 'anniversaries',
    Icon: Cake,
    title: '기념일',
    description: '결혼기념일, 생일, 약속.',
    path: '/data/anniversaries',
    status: 'done',
  },
  {
    id: 'links',
    Icon: LinkIcon,
    title: '유용한 링크',
    description: '쇼핑 · 정보 · 자주 가는 사이트 모음.',
    path: '/data/links',
    status: 'todo',
  },
  {
    id: 'recipes',
    Icon: ChefHat,
    title: '레시피',
    description: '재료 · 순서 · 1인분 환산.',
    path: '/data/recipes',
    status: 'todo',
  },
]

const STATUS_LABEL: Record<FeatureCard['status'], string> = {
  done: '사용 가능',
  wip: '작성 중',
  todo: '준비 중',
}

export default function DataHub() {
  return (
    <div className="data-hub">
      <header className="data-hub__header">
        <h1 className="data-hub__title">
          <Database size={24} strokeWidth={2} aria-hidden="true" />
          <span>데이터</span>
        </h1>
        <p className="data-hub__sub">우리 둘이 함께 쌓아가는 데이터입니다.</p>
      </header>

      <div className="data-hub__grid">
        {features.map((f) => {
          const enabled = f.status !== 'todo'
          const card = (
            <article
              className={`data-hub__card data-hub__card--${f.status}`}
            >
              <div className="data-hub__icon" aria-hidden="true">
                <f.Icon size={32} strokeWidth={1.6} />
              </div>
              <span className={`data-hub__badge data-hub__badge--${f.status}`}>
                {STATUS_LABEL[f.status]}
              </span>
              <h2 className="data-hub__card-title">{f.title}</h2>
              <p className="data-hub__card-desc">{f.description}</p>
            </article>
          )
          return enabled ? (
            <Link key={f.id} to={f.path} className="data-hub__card-link">
              {card}
            </Link>
          ) : (
            <div key={f.id} className="data-hub__card-link data-hub__card-link--disabled">
              {card}
            </div>
          )
        })}
      </div>
    </div>
  )
}
