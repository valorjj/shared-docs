import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton, Badge } from '../../components/ui'
import OptionRow from './OptionRow'
import styles from './SubPlanSection.module.css'
import type { OptionNode, SubPlanNode } from './types'

const STATUS_LABEL: Record<SubPlanNode['status'], string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

type SubPlanLink = { id: number; title: string }

type Props = {
  subPlan: SubPlanNode
  links?: { outgoing: SubPlanLink[]; incoming: SubPlanLink[] }
  onJumpToSubPlan?: (id: number) => void
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
}

export default function SubPlanSection({
  subPlan, links, onJumpToSubPlan, myUserId, nameOf, busy, onEdit, onDelete, onAddOption,
  onEditOption, onDeleteOption, onRate, onClearRating, onDecide, onReopen,
}: Props) {
  const { decision } = subPlan
  const chosen = decision ? subPlan.options.find((o) => o.id === decision.chosenOptionId) ?? null : null
  const hasLinks = links != null && (links.outgoing.length > 0 || links.incoming.length > 0)

  return (
    <section id={`subplan-${subPlan.id}`} className={styles.section}>
      <header className={styles.head}>
        <div className={styles.titleWrap}>
          <h2 className={styles.title}>{subPlan.title}</h2>
          <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
        </div>
        <div className={styles.actions}>
          <IconButton variant="ghost" size="sm" label="안건 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="안건 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </div>
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
          <span className={styles.bannerBody}><strong>{chosen.title}</strong> · {decision.reason}</span>
          <Button variant="ghost" size="sm" onClick={onReopen} disabled={busy}>다시 열기</Button>
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
              nameOf={nameOf}
              busy={busy}
              onRate={(score, comment) => onRate(o.id, score, comment)}
              onClearRating={() => onClearRating(o.id)}
              onEdit={() => onEditOption(o)}
              onDelete={() => onDeleteOption(o)}
            />
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={onAddOption}>선택지 추가</Button>
        {!decision && subPlan.options.length > 0 && (
          <Button variant="soft" size="sm" onClick={onDecide} disabled={busy}>결정하기</Button>
        )}
      </div>
    </section>
  )
}
