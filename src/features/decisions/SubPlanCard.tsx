import { Pencil, Trash2, Link2, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Badge, Skeleton } from '../../components/ui'
import TitleDescModal from './TitleDescModal'
import {
  useAddSubPlan, useSubPlanDetail, useUpdateSubPlan, useDeleteSubPlan,
  useSetSubPlanDeadline, useClearSubPlanDeadline,
} from './api'
import styles from './SubPlanCard.module.css'
import type { SubPlanNode } from './types'

const STATUS_LABEL: Record<SubPlanNode['status'], string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

export type SubPlanHighlight = 'normal' | 'source' | 'linked' | 'dim'

type SubPlanLink = { id: number; title: string }

type Props = {
  subPlan: SubPlanNode
  planId: number
  index: number
  /** Smaller visual — used one level deep for children rendered inside the
   *  foldable 서브안건 block. Nested cards don't get their own fold/expand
   *  (that would recurse-fetch indefinitely) — deeper nesting is reached by
   *  navigating into the child's own detail page. */
  nested?: boolean
  links?: { outgoing: SubPlanLink[]; incoming: SubPlanLink[] }
  onJumpToSubPlan?: (id: number) => void
  highlight?: SubPlanHighlight
  onHoverChange?: (hovered: boolean) => void
  /** Top-level cards get edit/delete/deadline wired to PlanDetail's shared
   *  modal + mutation instances. When omitted (nested children), the card
   *  manages its own local modal + mutations — it's a fully self-contained unit. */
  onEdit?: () => void
  onDelete?: () => void
  onOpenConnect?: () => void
  dragHandle?: ReactNode
  locked?: boolean
  onSetDeadline?: (deadline: string) => void
  onClearDeadline?: () => void
  deadlineBusy?: boolean
}

export default function SubPlanCard({
  subPlan, planId, index, nested = false, links, onJumpToSubPlan, highlight = 'normal', onHoverChange,
  onEdit, onDelete, onOpenConnect, dragHandle, locked, onSetDeadline, onClearDeadline, deadlineBusy,
}: Props) {
  const navigate = useNavigate()
  const { decision } = subPlan
  const hasLinks = links != null && (links.outgoing.length > 0 || links.incoming.length > 0)

  const [subOpen, setSubOpen] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [localEditOpen, setLocalEditOpen] = useState(false)

  const addChild = useAddSubPlan(planId)
  const updateThis = useUpdateSubPlan()
  const deleteThis = useDeleteSubPlan()
  const setDeadlineThis = useSetSubPlanDeadline()
  const clearDeadlineThis = useClearSubPlanDeadline()

  // Lazy fetch: only queries once expanded. Passing NaN while collapsed keeps
  // the query disabled (Number.isFinite guard already inside useSubPlanDetail)
  // without needing an extra `enabled` param on the hook.
  const { data: childDetail, isLoading: childrenLoading } = useSubPlanDetail(subOpen ? subPlan.id : NaN)

  const handleEdit = onEdit ?? (() => setLocalEditOpen(true))
  const handleDelete = onDelete ?? (() => {
    if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteThis.mutate(subPlan.id)
  })
  const handleSetDeadline = onSetDeadline ?? ((deadline: string) => setDeadlineThis.mutate({ id: subPlan.id, deadline }))
  const handleClearDeadline = onClearDeadline ?? (() => clearDeadlineThis.mutate(subPlan.id))
  const deadlineBusyResolved = deadlineBusy ?? (setDeadlineThis.isPending || clearDeadlineThis.isPending)

  const eyebrowLabel = nested ? '서브안건' : '안건'

  return (
    <section
      id={`subplan-${subPlan.id}`}
      className={[styles.section, nested && styles.nested, highlight !== 'normal' && styles[highlight]].filter(Boolean).join(' ')}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      <div className={styles.qno}>{eyebrowLabel} {index}</div>
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <button
            type="button"
            className={styles.titleButton}
            onClick={() => navigate(`/decisions/${planId}/subplans/${subPlan.id}`)}
          >
            {subPlan.title}
          </button>
          <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
          <DeadlineChip
            deadline={subPlan.deadline}
            settledAt={decision?.decidedAt ?? null}
            settledNoun="결정"
            editable={!locked && decision == null}
            busy={deadlineBusyResolved}
            onSet={handleSetDeadline}
            onClear={handleClearDeadline}
          />
        </div>
        {!locked && (
          <div className={styles.actions}>
            {dragHandle}
            {onOpenConnect && (
              <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
            )}
            <IconButton variant="ghost" size="sm" label={`${eyebrowLabel} 수정`} onClick={handleEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label={`${eyebrowLabel} 삭제`} onClick={handleDelete}><Trash2 size={14} /></IconButton>
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

      <div className={styles.body}>
        {subPlan.description && <p className={styles.desc}>{subPlan.description}</p>}
        <span className={styles.optionCount}>선택지 {subPlan.options.length}</span>
      </div>

      {!nested && (
        <div className={styles.subSection}>
          <div className={styles.subControls}>
            {subPlan.childSubPlanCount > 0 && (
              <button
                type="button"
                className={styles.subToggle}
                onClick={() => setSubOpen((v) => !v)}
                aria-expanded={subOpen}
              >
                {subOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>서브안건 {subPlan.childSubPlanCount}</span>
              </button>
            )}
            {!locked && (
              <button type="button" className={styles.addChildBtn} onClick={() => setAddingChild(true)}>
                <Plus size={12} />
                <span>서브안건 추가</span>
              </button>
            )}
          </div>

          {subOpen && (
            <div className={styles.childList}>
              {childrenLoading && <Skeleton height={56} radius="var(--r-md)" />}
              {childDetail?.children.map((child, i) => (
                <SubPlanCard key={child.id} subPlan={child} planId={planId} index={i + 1} nested locked={locked} />
              ))}
            </div>
          )}

          <TitleDescModal
            open={addingChild}
            onClose={() => setAddingChild(false)}
            entityLabel="서브안건"
            busy={addChild.isPending}
            onSubmit={(payload) => addChild.mutate(
              { ...payload, parentSubPlanId: subPlan.id },
              { onSuccess: () => setAddingChild(false) },
            )}
          />
        </div>
      )}

      {!onEdit && (
        <TitleDescModal
          open={localEditOpen}
          onClose={() => setLocalEditOpen(false)}
          entityLabel={eyebrowLabel}
          initial={{ title: subPlan.title, description: subPlan.description }}
          busy={updateThis.isPending}
          onSubmit={(payload) => updateThis.mutate(
            { id: subPlan.id, payload },
            { onSuccess: () => setLocalEditOpen(false) },
          )}
        />
      )}
    </section>
  )
}
