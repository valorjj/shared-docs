import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Wallet,
  ListTodo,
  Cake,
  Link as LinkIcon,
  ChefHat,
  type LucideIcon,
} from 'lucide-react'
import {
  AppSidebar,
  AppSidebarItem,
  AppSidebarSection,
} from '../components/common/AppSidebar'
import styles from './DataLayout.module.css'

type DataNavItem = {
  path: string
  label: string
  description: string
  Icon: LucideIcon
  status: 'done' | 'todo'
}

const NAV_ITEMS: DataNavItem[] = [
  {
    path: '/data/purchases',
    label: '구매 내역',
    description: '일상 지출과 외화 결제.',
    Icon: Wallet,
    status: 'done',
  },
  {
    path: '/data/todos',
    label: '할 일',
    description: '공동 할 일과 마감일.',
    Icon: ListTodo,
    status: 'done',
  },
  {
    path: '/data/anniversaries',
    label: '기념일',
    description: '결혼기념일, 생일, 약속.',
    Icon: Cake,
    status: 'done',
  },
  {
    path: '/data/links',
    label: '유용한 링크',
    description: '쇼핑 · 정보 · 자주 가는 사이트.',
    Icon: LinkIcon,
    status: 'todo',
  },
  {
    path: '/data/recipes',
    label: '레시피',
    description: '재료 · 순서 · 1인분 환산.',
    Icon: ChefHat,
    status: 'todo',
  },
]

export default function DataLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isIndex = location.pathname === '/data' || location.pathname === '/data/'

  return (
    <div className={styles.root}>
      <AppSidebar brand="데이터" label="데이터 보관함">
        <AppSidebarSection>
          {NAV_ITEMS.map((item) => (
            <AppSidebarItem
              key={item.path}
              Icon={item.Icon}
              label={item.label}
              active={location.pathname.startsWith(item.path)}
              disabled={item.status === 'todo'}
              onClick={
                item.status === 'done' ? () => navigate(item.path) : undefined
              }
              trailing={
                item.status === 'todo' ? (
                  <span className={styles.sidebarBadge}>준비 중</span>
                ) : null
              }
            />
          ))}
        </AppSidebarSection>
      </AppSidebar>
      <main className={styles.main}>{isIndex ? <DataIndex /> : <Outlet />}</main>
    </div>
  )
}

function DataIndex() {
  const navigate = useNavigate()
  return (
    <div className={styles.indexWrap}>
      <header className={styles.indexHeader}>
        <h1 className={styles.indexTitle}>데이터</h1>
        <p className={styles.indexSub}>우리 둘이 함께 쌓아가는 데이터입니다.</p>
      </header>
      <ul className={styles.indexList}>
        {NAV_ITEMS.map((item) => {
          const enabled = item.status === 'done'
          return (
            <li key={item.path}>
              <button
                type="button"
                className={`${styles.indexItem}${enabled ? '' : ` ${styles.indexItemDisabled}`}`}
                disabled={!enabled}
                onClick={enabled ? () => navigate(item.path) : undefined}
              >
                <span className={styles.indexIcon} aria-hidden="true">
                  <item.Icon size={20} strokeWidth={1.6} />
                </span>
                <span className={styles.indexBody}>
                  <span className={styles.indexLabel}>{item.label}</span>
                  <span className={styles.indexDesc}>{item.description}</span>
                </span>
                {!enabled && <span className={styles.indexBadge}>준비 중</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
