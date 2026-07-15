import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge, Skeleton } from '../../components/ui'
import { useSubPlanDetail } from './api'
import Comments from '../../components/Comments'
import styles from './SubPlanPanel.module.css'
import type { SubPlanStatus } from './types'

const STATUS_LABEL: Record<SubPlanStatus, string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

type Props = {
  subPlanId: number
  planId: number
  locked: boolean
  onOpenSubPlan: (id: number) => void
}

export default function SubPlanPanel({ subPlanId, planId, onOpenSubPlan }: Props) {
  const { data: detail, isLoading, isError } = useSubPlanDetail(subPlanId)

  if (isLoading) return <Skeleton height={140} radius="var(--r-md)" />
  if (isError || !detail) return <p className={styles.empty}>안건을 불러오지 못했어요.</p>

  return (
    <div className={styles.wrap}>
      <div className={styles.metaRow}>
        <Badge>{STATUS_LABEL[detail.status]}</Badge>
        {detail.deadline && <span className={styles.deadline}>기한 {detail.deadline}</span>}
      </div>

      {detail.description && <p className={styles.desc}>{detail.description}</p>}

      <section className={styles.section}>
        <h4 className={styles.heading}>서브안건</h4>
        {detail.children.length === 0 ? (
          <p className={styles.empty}>서브안건이 없어요.</p>
        ) : (
          <ul className={styles.childList}>
            {detail.children.map((child) => (
              <li key={child.id}>
                <button type="button" className={styles.childRow} onClick={() => onOpenSubPlan(child.id)}>
                  <span className={styles.childTitle}>{child.title}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to={`/decisions/${planId}/subplans/${subPlanId}`} className={styles.fullLink}>
        안건 전체 페이지 열기 →
      </Link>

      <div className={styles.comments}>
        <Comments pageId={`subplan:${subPlanId}`} />
      </div>
    </div>
  )
}
