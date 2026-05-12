import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListTodo, Plus, Check, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
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

const TABS: Array<{ key: TodoFilter; label: string }> = [
  { key: 'today', label: '오늘' },
  { key: 'week',  label: '이번 주' },
  { key: 'open',  label: '전체' },
  { key: 'done',  label: '완료됨' },
]

export default function TodoList() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [filter, setFilter] = useState<TodoFilter>('open')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)

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
    <div className="todos">
      <header className="todos__header">
        <Link to="/data" className="todos__back">← 데이터</Link>
        <h1 className="todos__title">
          <ListTodo size={22} strokeWidth={2} aria-hidden="true" />
          <span>할 일</span>
        </h1>
      </header>

      <div className="todos__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`todos__tab${filter === t.key ? ' todos__tab--active' : ''}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="todos__status">불러오는 중…</p>}
      {isError && (
        <p className="todos__status todos__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <button type="button" onClick={() => refetch()}>다시 시도</button>
        </p>
      )}

      {rows && rows.length === 0 && (
        <div className="todos__empty">
          {filter === 'done'
            ? '아직 완료된 항목이 없어요.'
            : '할 일이 없어요. + 버튼으로 추가하세요.'}
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

      <button
        type="button"
        className="todos__fab"
        aria-label="할 일 추가"
        onClick={() => { setEditing(null); setFormOpen(true) }}
      >
        <Plus size={26} strokeWidth={2.5} aria-hidden="true" />
      </button>

      <TodoForm
        open={formOpen}
        initial={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
      />
    </div>
  )
}

function TodoRow({
  row, category, isAdmin, currentUserId,
  onToggle, onEdit, onDelete, toggling,
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

  const catStyle = category?.color
    ? { background: hexAlpha(category.color, 0.15), color: category.color }
    : undefined

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
            <span className="todos__cat-badge" style={catStyle}>
              {category.icon && <span>{category.icon}</span>}
              <span>{category.name}</span>
            </span>
          )}
          {dueLabel && <span className={`todos__due${dueClass}`}>{dueLabel}</span>}
          {isDone && row.completedBy && (
            <span className="todos__by">{row.completedBy.name}이(가) 완료</span>
          )}
          {!isDone && (
            <span className="todos__by">
              {row.createdBy.name}
            </span>
          )}
        </div>
      </div>

      {canDelete && (
        <button
          type="button"
          className="todos__del-btn"
          onClick={onDelete}
          aria-label="삭제"
        >
          <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

function hexAlpha(hex: string, a: number): string {
  const m = hex.match(/^#?([\da-f]{6})$/i)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`
}
