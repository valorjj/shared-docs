import { Pencil, Trash2, Link2, ChevronDown, ChevronRight } from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { useState, type ReactNode } from 'react'
import { IconButton, Badge } from '../../components/ui'
import styles from './SubPlanSection.module.css'
import type { SubPlanNode } from './types'

const STATUS_LABEL: Record<SubPlanNode['status'], string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

export type SubPlanHighlight = 'normal' | 'source' | 'linked' | 'dim'

type SubPlanLink = { id: number; title: string }

type Props = {
  subPlan: SubPlanNode
  links?: { outgoing: SubPlanLink[]; incoming: SubPlanLink[] }
  onJumpToSubPlan?: (id: number) => void
  highlight?: SubPlanHighlight
  onHoverChange?: (hovered: boolean) => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenConnect?: () => void
  index: number
  dragHandle?: ReactNode
  locked?: boolean
  onSetDeadline: (deadline: string) => void
  onClearDeadline: () => void
  deadlineBusy?: boolean
}

export default function SubPlanSection({
  subPlan, links, onJumpToSubPlan, highlight = 'normal', onHoverChange, onOpen, onEdit, onDelete, onOpenConnect, index,
  dragHandle, locked, onSetDeadline, onClearDeadline, deadlineBusy,
}: Props) {
  const { decision } = subPlan
  const hasLinks = links != null && (links.outgoing.length > 0 || links.incoming.length > 0)
  const [subOpen, setSubOpen] = useState(false)

  return (
    <section
      id={`subplan-${subPlan.id}`}
      className={[styles.section, highlight !== 'normal' && styles[highlight]].filter(Boolean).join(' ')}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div className={styles.qno}>안건 {index}</div>
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>{subPlan.title}</h2>
          <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
          <DeadlineChip
            deadline={subPlan.deadline}
            settledAt={decision?.decidedAt ?? null}
            settledNoun="결정"
            editable={!locked && decision == null}
            busy={deadlineBusy}
            onSet={onSetDeadline}
            onClear={onClearDeadline}
          />
        </div>
        {!locked && (
          <div className={styles.actions}>
            {dragHandle}
            {onOpenConnect && (
              <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
            )}
            <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
          </div>
        )}
      </header>

      {hasLinks && (
        <div className={styles.links}>
          {links!.outgoing.length > 0 && (
            <div className={styles.linkRow}>
              <span className={styles.linkLabel}>연결 →</span>
              {links!.outgoing.map((l) => (
                <button key={`o-${l.id}`} type="button" className={styles.linkChip} onClick={() => onJumpToSubPlan?.(l.id)}>
                  {l.title}
                </button>
              ))}
            </div>
          )}
          {links!.incoming.length > 0 && (
            <div className={styles.linkRow}>
              <span className={styles.linkLabel}>← 연결</span>
              {links!.incoming.map((l) => (
                <button key={`i-${l.id}`} type="button" className={styles.linkChip} onClick={() => onJumpToSubPlan?.(l.id)}>
                  {l.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" className={styles.body} onClick={onOpen}>
        {subPlan.description && <p className={styles.desc}>{subPlan.description}</p>}
        <span className={styles.optionCount}>선택지 {subPlan.options.length}</span>
      </button>

      {subPlan.childSubPlanCount > 0 && (
        <div className={styles.subSection}>
          <button
            type="button"
            className={styles.subToggle}
            onClick={() => setSubOpen((v) => !v)}
            aria-expanded={subOpen}
          >
            {subOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>서브안건 {subPlan.childSubPlanCount}</span>
          </button>
          {/* Placeholder — the foldable 서브안건 tree itself lands in Task 7. */}
          {subOpen && <div className={styles.subPlaceholder}>서브안건 목록은 곧 표시돼요.</div>}
        </div>
      )}
    </section>
  )
}
