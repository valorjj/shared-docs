import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Search, X } from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Fab,
  Button,
  Skeleton,
} from '../../components/ui'
import {
  useCreateRecipe,
  useRecipeCategories,
  useRecipes,
} from './api'
import RecipeCard from './RecipeCard'
import './recipes.css'

const ALL = '전체'
const DEFAULT_CATEGORY = '기타'

export default function RecipeList() {
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useRecipes()
  const { data: categories } = useRecipeCategories()
  const create = useCreateRecipe()

  const [category, setCategory] = useState(ALL)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.filter((r) => {
      if (category !== ALL && r.category !== category) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        (r.note ?? '').toLowerCase().includes(q) ||
        r.ingredients.toLowerCase().includes(q)
      )
    })
  }, [data, category, query])

  const handleCreate = () => {
    // Default category: try 기타 first, fall back to whatever is first.
    const cat =
      categories?.find((c) => c.name === DEFAULT_CATEGORY)?.name ??
      categories?.[0]?.name
    if (!cat) return
    create.mutate(
      { title: '새 레시피', category: cat, servings: 1 },
      { onSuccess: (r) => navigate(`/data/recipes/${r.id}`) },
    )
  }

  return (
    <Page>
      <PageHeader>
        <BackLink to="/data" mobileOnly>데이터</BackLink>
        <PageTitle icon={<ChefHat size={22} strokeWidth={2} />}>레시피</PageTitle>
      </PageHeader>

      <div className="recipes__toolbar">
        <div className="recipes__search">
          <Search size={14} strokeWidth={2} className="recipes__search-icon" aria-hidden="true" />
          <input
            type="search"
            className="recipes__search-input"
            placeholder="이름 · 재료 · 메모"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="레시피 검색"
          />
          {query && (
            <button
              type="button"
              className="recipes__search-clear"
              onClick={() => setQuery('')}
              aria-label="검색어 지우기"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <nav className="recipes__chips" aria-label="카테고리">
        <button
          type="button"
          className={`recipes__chip${category === ALL ? ' recipes__chip--active' : ''}`}
          onClick={() => setCategory(ALL)}
        >
          전체
          <span className="recipes__chip-count">{data?.length ?? 0}</span>
        </button>
        {categories?.map((c) => {
          const count = data?.filter((r) => r.category === c.name).length ?? 0
          return (
            <button
              key={c.id}
              type="button"
              className={`recipes__chip${category === c.name ? ' recipes__chip--active' : ''}`}
              onClick={() => setCategory(c.name)}
            >
              {c.name}
              <span className="recipes__chip-count">{count}</span>
            </button>
          )
        })}
      </nav>

      {isLoading && (
        <ul className="recipes__grid recipes__grid--skeleton" aria-busy="true" aria-label="레시피 불러오는 중">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="recipes__skeleton-card">
              <Skeleton width="100%" height={150} radius={0} />
              <div className="recipes__skeleton-card-body">
                <Skeleton width={48} height={9} />
                <Skeleton width="75%" height={16} />
                <Skeleton width="45%" height={10} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {isError && (
        <p className="recipes__status recipes__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
        </p>
      )}

      {data && data.length === 0 && !isLoading && (
        <div className="recipes__empty">
          <span className="recipes__empty-icon" aria-hidden="true">
            <ChefHat size={24} strokeWidth={1.5} />
          </span>
          <p className="recipes__empty-title">아직 저장한 레시피가 없어요</p>
          <Button variant="outline" size="sm" onClick={handleCreate}>
            첫 레시피 만들기
          </Button>
        </div>
      )}

      {data && filtered.length === 0 && data.length > 0 && (
        <p className="recipes__empty-filter">조건에 맞는 레시피가 없어요.</p>
      )}

      {filtered.length > 0 && (
        <ul className="recipes__grid">
          {filtered.map((r) => (
            <li key={r.id}>
              <RecipeCard
                recipe={r}
                onOpen={() => navigate(`/data/recipes/${r.id}`)}
              />
            </li>
          ))}
        </ul>
      )}

      <Fab label="레시피 추가" onClick={handleCreate} />
    </Page>
  )
}
