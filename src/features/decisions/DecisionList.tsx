import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Vote, Pencil, Trash2, Plus, CheckCircle2, RotateCcw } from 'lucide-react'
import {
  Page, PageHeader, PageTitle, Fab, Card, Badge, IconButton,
  EmptyState, ErrorState, Skeleton, Tabs,
} from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlans, useCreatePlan, useUpdatePlan, useDeletePlan, useFeed,
  useCompletedPlans, useTrashedPlans, useCompletePlan, useUncompletePlan,
  useRestorePlan, useDeletePlanForever,
} from './api'
import DeadlineChip from './DeadlineChip'
import PlanModal from './PlanModal'
import Timeline from './Timeline'
import StoryView from './StoryView'
import styles from './DecisionList.module.css'
import type { PlanSummary } from './types'

const UNGROUPED = '분류 없음'
type Tab = 'board' | 'story' | 'completed' | 'trash' | 'feed'

type Section = { key: string; label: string; named: boolean; plans: PlanSummary[] }

/** Group plans into sections: named groups sorted Korean-aware, "분류 없음" last. */
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
  const discard = useDeletePlan()
  const complete = useCompletePlan()
  const uncomplete = useUncompletePlan()
  const restore = useRestorePlan()
  const purge = useDeletePlanForever()

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<PlanSummary | null>(null)
  const [tab, setTab] = useState<Tab>('board')

  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) => uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'
  const planNameOf = (id: number) => (plans ?? []).find((p) => p.id === id)?.title ?? '계획'

  const { data: feed, isLoading: feedLoading } = useFeed(tab === 'feed')
  const { data: completed, isLoading: completedLoading } = useCompletedPlans(tab === 'completed' || tab === 'story')
  const { data: trashed, isLoading: trashLoading } = useTrashedPlans(tab === 'trash')

  const { sections, hasNamedGroup, groupOptions } = useMemo(() => toSections(plans ?? []), [plans])
  const storyPlans = useMemo(
    () => [...(plans ?? []), ...(completed ?? [])],
    [plans, completed],
  )

  const onDiscard = (p: PlanSummary) => {
    if (window.confirm('휴지통으로 이동할까요? 하위결정도 함께 이동해요. 휴지통에서 언제든 복원할 수 있어요.')) discard.mutate(p.id)
  }

  const renderCard = (p: PlanSummary, view: 'board' | 'completed') => (
    <Card key={p.id} padding="none" className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => navigate(`/decisions/${p.id}`)}>
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>{p.title}</span>
          {p.lockedAt != null
            ? <Badge>잠김</Badge>
            : view === 'completed' ? <Badge>완료</Badge> : null}
          <DeadlineChip
            deadline={p.deadline}
            settledAt={view === 'completed' ? p.completedAt : null}
            settledNoun="완료"
            editable={false}
          />
        </div>
        {p.description && <span className={styles.cardDesc}>{p.description}</span>}
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </button>
      <div className={styles.cardActions}>
        {view === 'board' ? (
          <IconButton variant="ghost" size="sm" label="완료" onClick={() => complete.mutate(p.id)}><CheckCircle2 size={14} /></IconButton>
        ) : (
          <IconButton variant="ghost" size="sm" label="다시 진행" onClick={() => uncomplete.mutate(p.id)}><RotateCcw size={14} /></IconButton>
        )}
        {view === 'board' && (
          <IconButton variant="ghost" size="sm" label="계획 수정" onClick={() => setEditing(p)}><Pencil size={14} /></IconButton>
        )}
        <IconButton variant="ghost" size="sm" label="휴지통으로 이동" onClick={() => onDiscard(p)}><Trash2 size={14} /></IconButton>
      </div>
    </Card>
  )

  const renderTrashCard = (p: PlanSummary) => (
    <Card key={p.id} padding="none" className={styles.card}>
      <div className={`${styles.cardMain} ${styles.cardMainStatic}`}>
        <div className={styles.cardTop}><span className={styles.cardTitle}>{p.title}</span></div>
        <span className={styles.cardMeta}>안건 {p.subPlanCount} · 결정 {p.decidedCount}</span>
      </div>
      <div className={styles.cardActions}>
        <IconButton variant="ghost" size="sm" label="복원" onClick={() => restore.mutate(p.id)}><RotateCcw size={14} /></IconButton>
        <IconButton variant="ghost" size="sm" label="영구 삭제"
          onClick={() => { if (window.confirm('계획과 모든 하위결정·안건·선택지·결정이 완전히 사라집니다. 되돌릴 수 없어요.')) purge.mutate(p.id) }}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </Card>
  )

  return (
    <Page>
      <PageHeader><PageTitle icon={<Vote size={22} strokeWidth={2} />}>결정</PageTitle></PageHeader>

      <Tabs
        className={styles.tabs}
        items={[{ key: 'board', label: '보드' }, { key: 'story', label: '스토리' }, { key: 'completed', label: '완료' }, { key: 'trash', label: '휴지통' }, { key: 'feed', label: '활동' }]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'feed' && (
        feedLoading
          ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
          : <Timeline events={feed ?? []} nameOf={nameOf} planNameOf={planNameOf}
                      onEventClick={(e) => navigate(`/decisions/${e.planId}`)} />
      )}

      {tab === 'board' && (
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
            hasNamedGroup ? (
              <div className={styles.board}>
                {sections.map((sec) => (
                  <section key={sec.key} className={styles.section}>
                    <header className={styles.sectionHead}>
                      <span className={styles.sectionLabel}>{sec.label}</span>
                      <span className={styles.sectionCount}>계획 {sec.plans.length}</span>
                    </header>
                    <div className={styles.list}>{sec.plans.map((p) => renderCard(p, 'board'))}</div>
                  </section>
                ))}
              </div>
            ) : (
              <div className={styles.list}>{plans.map((p) => renderCard(p, 'board'))}</div>
            )
          )}
        </>
      )}

      {tab === 'story' && (
        <>
          {(isLoading || completedLoading) && <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>}
          {isError && <ErrorState error={error} onRetry={() => refetch()} />}
          {!isLoading && !completedLoading && storyPlans.length === 0 && (
            <EmptyState icon={<Vote size={24} strokeWidth={1.5} />} title="아직 계획이 없어요"
                        description="계획을 추가하면 시간순 스토리로 볼 수 있어요." />
          )}
          {!isLoading && !completedLoading && storyPlans.length > 0 && <StoryView plans={storyPlans} onOpen={(id) => navigate(`/decisions/${id}`)} />}
        </>
      )}

      {tab === 'completed' && (
        completedLoading
          ? <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>
          : (completed && completed.length > 0
              ? <div className={styles.list}>{completed.map((p) => renderCard(p, 'completed'))}</div>
              : <EmptyState title="완료된 계획이 없어요" description="계획을 완료하면 여기로 모여요." />)
      )}

      {tab === 'trash' && (
        trashLoading
          ? <div className={styles.list}><Skeleton height={84} radius="var(--r-md)" /></div>
          : (trashed && trashed.length > 0
              ? <div className={styles.list}>{trashed.map(renderTrashCard)}</div>
              : <EmptyState title="휴지통이 비어 있어요" description="삭제한 계획이 여기에 머물러요." />)
      )}

      {(tab === 'board' || tab === 'story') && <Fab label="계획 추가" icon={<Plus size={26} strokeWidth={2.5} />} onClick={() => setAdding(true)} />}

      <PlanModal
        open={adding} onClose={() => setAdding(false)} groupOptions={groupOptions} busy={create.isPending}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setAdding(false) })}
      />
      <PlanModal
        key={`plan-edit-${editing?.id ?? 'none'}`}
        open={editing != null} onClose={() => setEditing(null)} groupOptions={groupOptions}
        initial={editing ? { title: editing.title, description: editing.description, groupLabel: editing.groupLabel } : null}
        busy={update.isPending}
        onSubmit={(payload) => { if (!editing) return; update.mutate({ id: editing.id, payload }, { onSuccess: () => setEditing(null) }) }}
      />
    </Page>
  )
}
