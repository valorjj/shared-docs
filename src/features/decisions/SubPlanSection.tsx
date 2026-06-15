import { Plus, Pencil, Trash2, Link2 } from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { useMemo, type ReactNode } from 'react'
import { Button, IconButton, Badge } from '../../components/ui'
import OptionRow from './OptionRow'
import styles from './SubPlanSection.module.css'
import type { OptionNode, SubPlanNode, VoteSnapshotEntry } from './types'

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
  myUserId: number
  nameOf: (userId: number) => string
  busy?: boolean
  onEdit: () => void
  onDelete: () => void
  onAddOption: () => void
  onEditOption: (o: OptionNode) => void
  onDeleteOption: (o: OptionNode) => void
  onRate: (optionId: number, score: number, comment: string | undefined) => void
  onClearRating: (optionId: number) => void
  onDecide: () => void
  onReopen: () => void
  onVote: (option: OptionNode) => void
  onRetractVote: (option: OptionNode) => void
  onOpenConnect?: () => void
  index: number
  dragHandle?: ReactNode
  locked?: boolean
  onSetDeadline: (deadline: string) => void
  onClearDeadline: () => void
  deadlineBusy?: boolean
}

export default function SubPlanSection({
  subPlan, links, onJumpToSubPlan, highlight = 'normal', onHoverChange, myUserId, nameOf, busy, onEdit, onDelete, onAddOption,
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen, onVote, onRetractVote, onOpenConnect, index, dragHandle, locked,
  onSetDeadline, onClearDeadline, deadlineBusy,
}: Props) {
  const { decision } = subPlan
  const chosen = decision ? subPlan.options.find((o) => o.id === decision.chosenOptionId) ?? null : null
  const hasLinks = links != null && (links.outgoing.length > 0 || links.incoming.length > 0)

  const snapshot: VoteSnapshotEntry[] | null = useMemo(() => {
    if (!decision?.voteSnapshot) return null
    try { return JSON.parse(decision.voteSnapshot) as VoteSnapshotEntry[] } catch { return null }
  }, [decision])
  const chosenTally = snapshot?.find((e) => e.optionId === decision?.chosenOptionId)
  const totalVotes = snapshot?.reduce((n, e) => n + e.count, 0) ?? 0

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

      {subPlan.description && <p className={styles.desc}>{subPlan.description}</p>}

      {decision && chosen && (
        <div className={styles.banner}>
          <span className={styles.bannerTag}>결정됨</span>
          <span className={styles.bannerBody}>
            <strong>{chosen.title}</strong> · {decision.reason}
            {snapshot && <span className={styles.bannerVotes}> · {totalVotes}표 중 {chosenTally?.count ?? 0}표</span>}
          </span>
          {!locked && <Button variant="ghost" size="sm" onClick={onReopen} disabled={busy}>다시 열기</Button>}
        </div>
      )}

      {subPlan.options.length === 0 ? (
        <p className={styles.empty}>선택지를 추가해 결정을 시작하세요.</p>
      ) : (
        <div className={styles.options}>
          {subPlan.options.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              myUserId={myUserId}
              isChosen={decision?.chosenOptionId === o.id}
              decided={decision != null}
              nameOf={nameOf}
              busy={busy}
              onRate={(score, comment) => onRate(o.id, score, comment)}
              onClearRating={() => onClearRating(o.id)}
              onEdit={() => onEditOption(o)}
              onDelete={() => onDeleteOption(o)}
              onVote={() => onVote(o)}
              onRetractVote={() => onRetractVote(o)}
              locked={locked}
            />
          ))}
        </div>
      )}

      {!locked && (
        <div className={styles.footer}>
          <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={onAddOption}>선택지 추가</Button>
          {!decision && subPlan.options.length > 0 && (
            <Button variant="soft" onClick={onDecide} disabled={busy}>
              {subPlan.options.some((o) => o.voterUserIds.length > 0) ? '결과 확정하기' : '결정하기'}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
