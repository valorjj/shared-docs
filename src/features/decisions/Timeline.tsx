import { EmptyState } from '../../components/ui'
import { formatRelativeTime } from '../notes/shared/formatRelativeTime'
import { planEventIcon, planEventText } from './formatPlanEvent'
import styles from './Timeline.module.css'
import type { PlanEvent } from './types'

type Props = {
  events: PlanEvent[]
  nameOf: (uid: number) => string
  planNameOf?: (planId: number) => string   // feed mode: label which 계획
  onEventClick?: (e: PlanEvent) => void      // feed mode: tap → that plan
}

export default function Timeline({ events, nameOf, planNameOf, onEventClick }: Props) {
  if (events.length === 0) {
    return <EmptyState title="아직 기록이 없어요" description="계획에 변화가 생기면 여기에 쌓여요." />
  }
  return (
    <ol className={styles.timeline}>
      {events.map((e) => {
        const Icon = planEventIcon(e.type)
        const inner = (
          <>
            <span className={styles.icon}><Icon size={15} strokeWidth={2} /></span>
            <span className={styles.body}>
              <span className={styles.text}>{planEventText(e, nameOf(e.actorUserId))}</span>
              <span className={styles.meta}>
                {planNameOf && <span className={styles.plan}>{planNameOf(e.planId)}</span>}
                <time className={styles.time} dateTime={e.createdAt}>{formatRelativeTime(e.createdAt)}</time>
              </span>
            </span>
          </>
        )
        return (
          <li key={e.id} className={styles.item}>
            {onEventClick
              ? <button type="button" className={styles.row} onClick={() => onEventClick(e)}>{inner}</button>
              : <div className={styles.row}>{inner}</div>}
          </li>
        )
      })}
    </ol>
  )
}
