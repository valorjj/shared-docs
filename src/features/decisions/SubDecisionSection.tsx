import { Plus, GitFork } from 'lucide-react'
import { deadlineLabel, toLocalDateString } from './deadlineLabel'
import type { PlanHierarchyNode } from './types'
import styles from './SubDecisionSection.module.css'

type Props = {
  childPlans: PlanHierarchyNode[]
  locked: boolean
  onOpen: (id: number) => void
  onAdd: () => void
}

/** 하위결정 cards under the 안건 list. A card zooms into the child plan's own page. */
export default function SubDecisionSection({ childPlans, locked, onOpen, onAdd }: Props) {
  if (childPlans.length === 0 && locked) return null
  return (
    <section className={styles.section} aria-label="하위결정">
      <h2 className={styles.heading}>
        <GitFork size={14} aria-hidden /> 하위결정
      </h2>
      <div className={styles.grid}>
        {childPlans.map((c) => {
          const dday = c.deadline ? deadlineLabel(c.deadline, toLocalDateString(new Date())).text : null
          return (
            <button key={c.id} type="button" className={styles.card} onClick={() => onOpen(c.id)}>
              <span className={styles.cardTitle}>{c.title}</span>
              <span className={styles.meta}>
                <span className={c.status === 'COMPLETED' ? styles.done : styles.progress}>
                  {c.status === 'COMPLETED' ? '완료' : '진행 중'}
                </span>
                {dday && <span>{dday}</span>}
                <span>안건 {c.decidedCount}/{c.subPlanCount}</span>
                {c.childCount > 0 && <span>하위 {c.childCount}</span>}
              </span>
            </button>
          )
        })}
        {!locked && (
          <button type="button" className={styles.addCard} onClick={onAdd}>
            <Plus size={14} aria-hidden /> 하위결정 추가
          </button>
        )}
      </div>
    </section>
  )
}
