import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton,
} from '../../components/ui'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan } from './api'
import TitleDescModal from './TitleDescModal'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

export default function DecisionList() {
  const navigate = useNavigate()
  const { data: plans, isLoading, isError, error, refetch } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const remove = useDeletePlan()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)

  return (
    <Page>
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      {isLoading && (
        <div className={styles.list}>
          <Skeleton height={84} radius="var(--r-md)" />
          <Skeleton height={84} radius="var(--r-md)" />
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {plans && plans.length === 0 && (
        <EmptyState icon={<Vote size={24} strokeWidth={1.5} />} title="아직 계획이 없어요"
                    description="함께 정할 일을 계획으로 추가해 보세요." />
      )}

      {plans && plans.length > 0 && (
        <div className={styles.list}>
          {plans.map((p) => (
            <Card key={p.id} padding="none" className={styles.card}>
              <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{p.title}</span>
                  <Badge>{p.status === 'ARCHIVED' ? '보관됨' : '진행 중'}</Badge>
                </div>
                {p.description && <span className={styles.cardDesc}>{p.description}</span>}
                <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
              </button>
              <div className={styles.cardActions}>
                <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
                <IconButton variant="ghost" size="sm" label="계획 삭제"
                  onClick={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) remove.mutate(p.id) }}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />

      <TitleDescModal
        open={adding} onClose={() => setAdding(false)} entityLabel="계획" busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <TitleDescModal
        key={`plan-edit-${editing?.id ?? 'none'}`}
        open={editing != null} onClose={() => setEditing(null)} entityLabel="계획"
        initial={editing ? { title: editing.title, description: editing.description } : null}
        busy={update.isPending}
        onSubmit={(payload) => {
          if (!editing) return
          update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })
        }}
      />
    </Page>
  )
}
