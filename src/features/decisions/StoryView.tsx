import { useMemo } from 'react'
import { GitFork } from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { toLocalDateString } from './deadlineLabel'
import { buildStoryLayout } from './storyGrouping'
import type { PlanSummary } from './types'
import styles from './StoryView.module.css'

type Props = {
  plans: PlanSummary[]
  onOpen: (id: number) => void
}

const MAX_DOTS = 8

/** 스토리 뷰 — root decisions on a vertical time axis (oldest at top),
 *  grouped by month, with an 예정 bucket for future-deadline decisions. */
export default function StoryView({ plans, onOpen }: Props) {
  const today = toLocalDateString(new Date())
  const layout = useMemo(() => buildStoryLayout(plans, today), [plans, today])

  return (
    <div className={styles.story}>
      {layout.months.map((month) => (
        <section key={month.key} className={styles.month}>
          <div className={styles.axisMarker}>{month.label}</div>
          <div className={styles.cards}>
            {month.plans.map((p) => (
              <StoryCard key={p.id} plan={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}

      {layout.upcoming.length > 0 && (
        <section className={styles.month}>
          <div className={`${styles.axisMarker} ${styles.upcomingMarker}`}>예정</div>
          <div className={styles.cards}>
            {layout.upcoming.map((p) => (
              <StoryCard key={p.id} plan={p} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StoryCard({ plan, onOpen }: { plan: PlanSummary; onOpen: (id: number) => void }) {
  const done = plan.status === 'COMPLETED'
  const dotCount = Math.min(plan.subPlanCount, MAX_DOTS)
  return (
    <button type="button" className={styles.card} onClick={() => onOpen(plan.id)}>
      <span className={styles.cardHead}>
        <span className={styles.cardTitle}>{plan.title}</span>
        <span className={done ? styles.done : styles.active}>{done ? '완료' : '진행 중'}</span>
        <DeadlineChip
          deadline={plan.deadline}
          settledAt={done ? plan.completedAt : null}
          settledNoun="완료"
          editable={false}
        />
      </span>
      {plan.subPlanCount > 0 && (
        <span className={styles.cluster}>
          <GitFork size={12} aria-hidden />
          <span className={styles.dots} aria-hidden>
            {Array.from({ length: dotCount }, (_, i) => (
              <span key={i} className={styles.dot} />
            ))}
          </span>
          <span className={styles.clusterCount}>안건 {plan.subPlanCount}</span>
        </span>
      )}
    </button>
  )
}
