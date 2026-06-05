import { useSearchParams } from 'react-router-dom'
import { Tags } from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Tabs,
  type TabItem,
} from '../components/ui'
import CategoryAdminPanel from '../features/admin/CategoryAdminPanel'
import { CATEGORY_KIND_LABELS, type CategoryKind } from '../api/categoryAdmin'
import styles from './SettingsCategories.module.css'

const TAB_ITEMS: TabItem<CategoryKind>[] = (
  ['purchase', 'todo', 'anniversary', 'link', 'recipe'] as const
).map((k) => ({ key: k, label: CATEGORY_KIND_LABELS[k] }))

function isCategoryKind(v: string | null): v is CategoryKind {
  return v === 'purchase' || v === 'todo' || v === 'anniversary' || v === 'link' || v === 'recipe'
}

/**
 * Phase C: per-workspace category management. Any workspace member can manage
 * the categories of the active workspace here (no longer an ADMIN-only screen).
 * Reuses CategoryAdminPanel; the hooks are workspace-scoped via the active
 * workspace + the X-Workspace-Id header.
 */
export default function SettingsCategories() {
  const [params, setParams] = useSearchParams()
  // Tab value is *derived* from the URL — no useState/useEffect sync.
  const tabParam = params.get('tab')
  const active: CategoryKind = isCategoryKind(tabParam) ? tabParam : 'purchase'

  const setActive = (kind: CategoryKind) => {
    const next = new URLSearchParams(params)
    next.set('tab', kind)
    setParams(next, { replace: true })
  }

  return (
    <Page>
      <PageHeader>
        <BackLink to="/" mobileOnly>홈</BackLink>
        <PageTitle icon={<Tags size={22} strokeWidth={2} />}>카테고리</PageTitle>
      </PageHeader>

      <p className={styles.intro}>
        이 워크스페이스의 카테고리를 관리해요(구매·할 일·기념일·링크·레시피).
        이름 옆 색상은 캘린더의 점이나 그래프에서 사용됩니다.
      </p>

      <Tabs<CategoryKind>
        items={TAB_ITEMS}
        value={active}
        onChange={setActive}
        className={styles.tabs}
      />

      <CategoryAdminPanel key={active} kind={active} />
    </Page>
  )
}
