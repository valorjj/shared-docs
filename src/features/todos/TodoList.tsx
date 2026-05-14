import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ListTodo, Check, Trash2 } from 'lucide-react'
import {
  Page,
  PageHeader,
  PageTitle,
  BackLink,
  Tabs,
  type TabItem,
  Badge,
  Fab,
  IconButton,
  Button,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import {
  daysUntil,
  formatDue,
  useDeleteTodo,
  useTodoCategories,
  useTodos,
  useToggleTodo,
  type Todo,
  type TodoFilter,
} from './api'
import TodoForm from './TodoForm'
import './todos.css'

const TABS: TabItem<TodoFilter>[] = [
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'open', label: '전체' },
  { key: 'done', label: '완료됨' },
]

export default function TodoList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [searchParams, setSearchParams] = useSearchParams()

  const dateParam = searchParams.get('date')
  const [filter, setFilter] = useState<TodoFilter>('open')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)

  const clearOpenIntent = useCallback(() => {
    if (!dateParam) return
    const next = new URLSearchParams(searchParams)
    next.delete('date')
    setSearchParams(next, { replace: true })
  }, [dateParam, searchParams, setSearchParams])

  const formIsOpen = formOpen || !!dateParam

  const { data: rows, isLoading, isError, error, refetch } = useTodos(filter)
  const { data: categories } = useTodoCategories()
  const toggle = useToggleTodo()
  const del = useDeleteTodo()

  const handleToggle = (row: Todo) => {
    toggle.mutate({ id: row.id, done: row.status !== 'DONE' })
  }

  const handleEdit = (row: Todo) => {
    setEditing(row)
    setFormOpen(true)
  }

  const handleDelete = (row: Todo) => {
    const canDelete = row.createdBy.userId === user?.userId || isAdmin
    if (!canDelete) return
    if (confirm(`"${row.task}" 항목을 삭제할까요?`)) {
      del.mutate(row.id)
    }
  }

  const findCategory = (name: string) => categories?.find((c) => c.name === name)

  return (
    <Page>
      <PageHeader>
        <BackLink to="/data" mobileOnly>데이터</BackLink>
        <PageTitle icon={<ListTodo size={22} strokeWidth={2} />}>할 일</PageTitle>
      </PageHeader>

      <Tabs items={TABS} value={filter} onChange={setFilter} className="todos__tabs-wrap" />

      {isLoading && <p className="todos__status">불러오는 중…</p>}
      {isError && (
        <p className="todos__status todos__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
        </p>
      )}

      {rows && rows.length === 0 && (
        <div className="todos__empty">
          {filter === 'done' ? '아직 완료된 항목이 없어요.' : '할 일이 없어요. + 버튼으로 추가하세요.'}
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="todos__list">
          {rows.map((row) => (
            <TodoRow
              key={row.id}
              row={row}
              category={findCategory(row.category)}
              isAdmin={isAdmin}
              currentUserId={user?.userId ?? -1}
              onToggle={() => handleToggle(row)}
              onEdit={() => handleEdit(row)}
              onDelete={() => handleDelete(row)}
              toggling={toggle.isPending && toggle.variables?.id === row.id}
            />
          ))}
        </ul>
      )}

      <Fab
        label="할 일 추가"
        onClick={() => {
          setEditing(null)
          setFormOpen(true)
        }}
      />

      <TodoForm
        open={formIsOpen}
        initial={editing}
        initialDate={dateParam ?? undefined}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          clearOpenIntent()
        }}
      />
    </Page>
  )
}

function TodoRow({
  row,
  category,
  isAdmin,
  currentUserId,
  onToggle,
  onEdit,
  onDelete,
  toggling,
}: {
  row: Todo
  category?: { name: string; icon: string | null; color: string | null }
  isAdmin: boolean
  currentUserId: number
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  toggling: boolean
}) {
  const isDone = row.status === 'DONE'
  const canDelete = row.createdBy.userId === currentUserId || isAdmin
  const dueDelta = daysUntil(row.due)
  const dueClass =
    isDone ? '' :
    dueDelta == null ? '' :
    dueDelta < 0 ? ' todos__due--overdue' :
    dueDelta === 0 ? ' todos__due--today' :
    dueDelta <= 3 ? ' todos__due--soon' : ''
  const dueLabel =
    !row.due ? '' :
    isDone ? `${formatDue(row.due)} 마감` :
    dueDelta == null ? '' :
    dueDelta < 0 ? `${-dueDelta}일 지남` :
    dueDelta === 0 ? '오늘' :
    `${formatDue(row.due)} (${dueDelta}일 후)`

  return (
    <li className={`todos__row${isDone ? ' todos__row--done' : ''}`}>
      <button
        type="button"
        className={`todos__check${isDone ? ' todos__check--checked' : ''}`}
        onClick={onToggle}
        disabled={toggling}
        aria-label={isDone ? '미완료로 표시' : '완료로 표시'}
      >
        {isDone ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
      </button>

      <div className="todos__row-body" onClick={onEdit}>
        <div className="todos__task">{row.task}</div>
        <div className="todos__meta">
          {category && (
            <Badge color={category.color ?? undefined}>{category.name}</Badge>
          )}
          {dueLabel && <span className={`todos__due${dueClass}`}>{dueLabel}</span>}
          {isDone && row.completedBy && (
            <span className="todos__by">{row.completedBy.name}이(가) 완료</span>
          )}
          {!isDone && <span className="todos__by">{row.createdBy.name}</span>}
        </div>
      </div>

      {canDelete && (
        <IconButton label="삭제" variant="danger" size="sm" onClick={onDelete}>
          <Trash2 size={14} strokeWidth={2} />
        </IconButton>
      )}
    </li>
  )
}
