import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Page, PageHeader, PageTitle, BackLink, Button, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlanTree, useAddSubPlan, useUpdateSubPlan, useDeleteSubPlan,
  useAddOption, useUpdateOption, useDeleteOption,
  useRateOption, useDeleteRating, useLockDecision, useReopenDecision,
} from './api'
import SubPlanSection from './SubPlanSection'
import PlanCanvas from './PlanCanvas'
import TitleDescModal from './TitleDescModal'
import DecisionModal from './DecisionModal'
import styles from './PlanDetail.module.css'
import type { OptionNode, SubPlanNode } from './types'

export default function PlanDetail() {
  const { planId: planIdParam } = useParams()
  const planId = Number(planIdParam)
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()

  const { data: tree, isLoading, isError, error, refetch } = usePlanTree(planId)
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  // mutations — all invalidate the workspace-wide decisions scope, refreshing
  // the open tree and the list roll-ups together. addSubPlan needs planId (URL).
  const addSubPlan = useAddSubPlan(planId)
  const updateSubPlan = useUpdateSubPlan()
  const deleteSubPlan = useDeleteSubPlan()
  const addOption = useAddOption()
  const updateOption = useUpdateOption()
  const deleteOption = useDeleteOption()
  const rate = useRateOption()
  const clearRating = useDeleteRating()
  const lock = useLockDecision()
  const reopen = useReopenDecision()

  // modal state
  const [addingSubPlan, setAddingSubPlan] = useState(false)
  const [editingSubPlan, setEditingSubPlan] = useState<SubPlanNode | null>(null)
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null)        // subPlanId
  const [editingOption, setEditingOption] = useState<OptionNode | null>(null)
  const [decidingFor, setDecidingFor] = useState<SubPlanNode | null>(null)
  const [view, setView] = useState<'list' | 'canvas'>('list')

  return (
    <Page>
      <PageHeader>
        <BackLink to="/decisions" mobileOnly>결정</BackLink>
        <PageTitle>{tree?.title ?? '계획'}</PageTitle>
      </PageHeader>

      {isLoading && <div className={styles.list}><Skeleton height={120} radius="var(--r-md)" /></div>}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {tree && (
        <>
          <div className={styles.viewToggle}>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }]}
              value={view}
              onChange={setView}
            />
          </div>

          {view === 'canvas' ? (
            <PlanCanvas tree={tree} />
          ) : (
            <>
              {tree.description && <p className={styles.planDesc}>{tree.description}</p>}

              {tree.subPlans.length === 0 ? (
                <EmptyState title="안건이 없어요" description="결정할 안건을 추가해 보세요."
                  action={<Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>} />
              ) : (
                <div className={styles.list}>
                  {tree.subPlans.map((sp) => (
                    <SubPlanSection
                      key={sp.id}
                      subPlan={sp}
                      myUserId={myUserId}
                      nameOf={nameOf}
                      busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending}
                      onEdit={() => setEditingSubPlan(sp)}
                      onDelete={() => { if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteSubPlan.mutate(sp.id) }}
                      onAddOption={() => setAddingOptionFor(sp.id)}
                      onEditOption={(o) => setEditingOption(o)}
                      onDeleteOption={(o) => {
                        if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                        deleteOption.mutate(o.id, {
                          onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                        })
                      }}
                      onRate={(optionId, score, comment) => rate.mutate({ optionId, payload: { score, comment } })}
                      onClearRating={(optionId) => clearRating.mutate(optionId)}
                      onDecide={() => setDecidingFor(sp)}
                      onReopen={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(sp.id) }}
                    />
                  ))}
                  <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 안건 add/edit */}
      <TitleDescModal
        open={addingSubPlan} onClose={() => setAddingSubPlan(false)} entityLabel="안건" busy={addSubPlan.isPending}
        onSubmit={(payload) => addSubPlan.mutate(payload, { onSuccess: () => setAddingSubPlan(false) })}
      />
      <TitleDescModal
        key={`sp-edit-${editingSubPlan?.id ?? 'none'}`}
        open={editingSubPlan != null} onClose={() => setEditingSubPlan(null)} entityLabel="안건"
        initial={editingSubPlan ? { title: editingSubPlan.title, description: editingSubPlan.description } : null}
        busy={updateSubPlan.isPending}
        onSubmit={(payload) => { if (editingSubPlan) updateSubPlan.mutate({ id: editingSubPlan.id, payload }, { onSuccess: () => setEditingSubPlan(null) }) }}
      />

      {/* 선택지 add/edit */}
      <TitleDescModal
        open={addingOptionFor != null} onClose={() => setAddingOptionFor(null)} entityLabel="선택지" busy={addOption.isPending}
        onSubmit={(payload) => { if (addingOptionFor != null) addOption.mutate({ subPlanId: addingOptionFor, payload }, { onSuccess: () => setAddingOptionFor(null) }) }}
      />
      <TitleDescModal
        key={`opt-edit-${editingOption?.id ?? 'none'}`}
        open={editingOption != null} onClose={() => setEditingOption(null)} entityLabel="선택지"
        initial={editingOption ? { title: editingOption.title, description: editingOption.description } : null}
        busy={updateOption.isPending}
        onSubmit={(payload) => { if (editingOption) updateOption.mutate({ id: editingOption.id, payload }, { onSuccess: () => setEditingOption(null) }) }}
      />

      {/* 결정 */}
      <DecisionModal
        open={decidingFor != null} onClose={() => setDecidingFor(null)}
        options={decidingFor?.options ?? []}
        currentChosenId={decidingFor?.decision?.chosenOptionId ?? null}
        busy={lock.isPending}
        onSubmit={(payload) => { if (decidingFor) lock.mutate({ subPlanId: decidingFor.id, payload }, { onSuccess: () => setDecidingFor(null) }) }}
      />
    </Page>
  )
}
