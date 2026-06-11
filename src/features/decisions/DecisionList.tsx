import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton, Tabs,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useFeed } from './api'
import PlanModal from './PlanModal'
import Timeline from './Timeline'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

const UNGROUPED = '분류 없음'

type Section = { key: string; label: string; named: boolean; plans: PlanSummary[] }

/** Group plans into sections: named groups sorted Korean-aware, "분류 없음" last.
 *  Within a section the API order (createdAt desc) is preserved. */
function toSections(plans: PlanSummary[]): { sections: Section[]; hasNamedGroup: boolean; groupOptions: string[] } {
  const byGroup = new Map<string, PlanSummary[]>()
  for (const p of plans) {
    const g = p.groupLabel?.trim() || ''
    const key = g || UNGROUPED
    const arr = byGroup.get(key)
    if (arr) arr.push(p)
    else byGroup.set(key, [p])
  }
  const named = [...byGroup.keys()].filter((k) => k !== UNGROUPED).sort((a, b) => a.localeCompare(b, 'ko'))
  const sections: Section[] = named.map((label) => ({ key: label, label, named: true, plans: byGroup.get(label)! }))
  if (byGroup.has(UNGROUPED)) {
    sections.push({ key: UNGROUPED, label: UNGROUPED, named: false, plans: byGroup.get(UNGROUPED)! })
  }
  return { sections, hasNamedGroup: named.length > 0, groupOptions: named }
}

export default function DecisionList() {
  const navigate = useNavigate()
  const { data: plans, isLoading, isError, error, refetch } = usePlans()
  const create = useCreatePlan()
  const update = useUpdatePlan()
  const remove = useDeletePlan()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)

  const [tab, setTab] = useState<'board' | 'feed'>('board')
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) => uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'
  const planNameOf = (id: number) => (plans ?? []).find((p) => p.id === id)?.title ?? '계획'
  const { data: feed, isLoading: feedLoading } = useFeed(tab === 'feed')

  const { sections, hasNamedGroup, groupOptions } = useMemo(
    () => toSections(plans ?? []),
    [plans],
  )

  const renderCard = (p: PlanSummary) => {
    const planLocked = p.lockedAt != null
    return (
    <Card key={p.id} padding="none" className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{p.title}</span>
          {planLocked ? <Badge>잠김</Badge> : <Badge>{p.status === 'ARCHIVED' ? '보관됨' : '진행 중'}</Badge>}
        </div>
        {p.description && <span className={styles.cardDesc}>{p.description}</span>}
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </button>
      {!planLocked && (
        <div className={styles.cardActions}>
          <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
          <IconButton variant="ghost" size="sm" label="계획 삭제"
            onClick={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) remove.mutate(p.id) }}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}
    </Card>
    )
  }

  return (
    <Page>
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      <Tabs
        className={styles.tabs}
        items={[{ key: 'board', label: '보드' }, { key: 'feed', label: '활동' }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'feed' ? (
        feedLoading
          ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
          : <Timeline events={feed ?? []} nameOf={nameOf} planNameOf={planNameOf}
                      onEventClick={(e) => navigate(`/decisions/${e.planId}`)} />
      ) : (
        <>
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
            // No named groups → flat list (today's behavior). Otherwise → titled sections.
            hasNamedGroup ? (
              <div className={styles.board}>
                {sections.map((sec) => (
                  <section key={sec.key} className={styles.section}>
                    <header className={styles.sectionHead}>
                      <span className={styles.sectionLabel}>{sec.label}</span>
                      <span className={styles.sectionCount}>계획 {sec.plans.length}</span>
                    </header>
                    <div className={styles.list}>{sec.plans.map(renderCard)}</div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.list}>{(plans ?? []).map(renderCard)}</div>
            )
          )}
        </>
      )}

      <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />

      <PlanModal
        open={adding} onClose={() => setAdding(false)} groupOptions={groupOptions} busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <PlanModal
        key={`plan-edit-${editing?.id ?? 'none'}`}
        open={editing != null} onClose={() => setEditing(null)} groupOptions={groupOptions}
        initial={editing ? { title: editing.title, description: editing.description, groupLabel: editing.groupLabel } : null}
        busy={update.isPending}
        onSubmit={(payload) => {
          if (!editing) return
          update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) })
        }}
      />
    </Page>
  )
}
