import {
  AlignLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  CheckSquare,
  CircleDollarSign,
  Hash,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../../components/ui'
import type { SheetColumn, SheetColumnKind } from '../types'

type Props = {
  column: SheetColumn
  position: { x: number; y: number } | null
  onClose: () => void
  /** Open the rename dialog. The menu doesn't own the dialog state —
   *  the parent does, so closing the menu + opening the dialog stays
   *  decoupled from this component. */
  onRequestRename: () => void
  onSetKind: (kind: SheetColumnKind) => void
  onSort: (direction: 'asc' | 'desc') => void
  onDelete: () => void
}

/**
 * Right-click menu on a column header. Lets the user rename, switch
 * the column kind (text/number/currency/date/check), or delete the
 * column. Mirrors the row-context-menu pattern in the memo sidebar.
 *
 * The kind switch only changes display + alignment + status-bar
 * aggregation — it does not coerce existing cell values. So flipping
 * a text column to currency leaves "abc" untouched in the data; the
 * cell just stops contributing to the sum.
 */
export default function SheetHeaderMenu({
  column,
  position,
  onClose,
  onRequestRename,
  onSetKind,
  onSort,
  onDelete,
}: Props) {
  const currentKind = column.kind ?? 'text'

  return (
    <ContextMenu
      open={position !== null}
      position={position}
      onClose={onClose}
      ariaLabel={`${column.name} 열 메뉴`}
    >
      <ContextMenuItem
        icon={<Pencil size={14} strokeWidth={1.75} />}
        onSelect={onRequestRename}
      >
        이름 변경
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<ArrowUpAZ size={14} strokeWidth={1.75} />}
        onSelect={() => onSort('asc')}
      >
        오름차순 정렬
      </ContextMenuItem>
      <ContextMenuItem
        icon={<ArrowDownAZ size={14} strokeWidth={1.75} />}
        onSelect={() => onSort('desc')}
      >
        내림차순 정렬
      </ContextMenuItem>
      <ContextMenuSeparator />
      {KINDS.map(({ kind, label, Icon }) => (
        <ContextMenuItem
          key={kind}
          icon={<Icon size={14} strokeWidth={1.75} />}
          onSelect={() => onSetKind(kind)}
        >
          {label}
          {kind === currentKind && <span style={{ marginLeft: 8, opacity: 0.6 }}>✓</span>}
        </ContextMenuItem>
      ))}
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={<Trash2 size={14} strokeWidth={1.75} />}
        onSelect={onDelete}
        destructive
      >
        삭제
      </ContextMenuItem>
    </ContextMenu>
  )
}

const KINDS: ReadonlyArray<{ kind: SheetColumnKind; label: string; Icon: LucideIcon }> = [
  { kind: 'text', label: '텍스트', Icon: AlignLeft },
  { kind: 'number', label: '숫자', Icon: Hash },
  { kind: 'currency', label: '통화 (₩)', Icon: CircleDollarSign },
  { kind: 'date', label: '날짜', Icon: Calendar },
  { kind: 'check', label: '체크박스', Icon: CheckSquare },
]
