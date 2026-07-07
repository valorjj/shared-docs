import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus, Lock, LockOpen, CheckCircle2, RotateCcw, MessagesSquare } from 'lucide-react'
import { Page, PageHeader, PageTitle, BackLink, Button, IconButton, Fab, EmptyState, ErrorState, Skeleton, Tabs } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlanTree, useAddSubPlan, useUpdateSubPlan, useDeleteSubPlan,
  useAddOption, useUpdateOption, useDeleteOption,
  useRateOption, useDeleteRating, useLockDecision, useReopenDecision,
  useCastVote, useRetractVote,
  useTimeline, useCreateEdge, useDeleteEdge, useReorderSubPlans,
  useLockPlan, useUnlockPlan, useCompletePlan, useUncompletePlan,
  useSetPlanDeadline, useClearPlanDeadline, useSetSubPlanDeadline, useClearSubPlanDeadline,
} from './api'
import DeadlineChip from './DeadlineChip'
import { deadlineLabel, toLocalDateString } from './deadlineLabel'
import SortableSubPlanSection from './SortableSubPlanSection'
import PlanCanvas from './PlanCanvas'
import Timeline from './Timeline'
import TitleDescModal from './TitleDescModal'
import DecisionModal from './DecisionModal'
import ConnectModal, { type ConnectCandidate } from './ConnectModal'
import DiscussionPane from './DiscussionPane'
import DecisionPresenceStack from './collab/DecisionPresenceStack'
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
  const createEdge = useCreateEdge(planId)
  const deleteEdge = useDeleteEdge()
  const reorder = useReorderSubPlans(planId)
  const lockPlan = useLockPlan()
  const unlockPlan = useUnlockPlan()
  const completePlan = useCompletePlan()
  const uncompletePlan = useUncompletePlan()
  const setPlanDeadline = useSetPlanDeadline()
  const clearPlanDeadline = useClearPlanDeadline()
  const setSubPlanDeadline = useSetSubPlanDeadline()
  const clearSubPlanDeadline = useClearSubPlanDeadline()
  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (e: DragEndEvent) => {
    if (!tree) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = tree.subPlans.map((sp) => sp.id)
    const from = ids.indexOf(Number(active.id))
    const to = ids.indexOf(Number(over.id))
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(to, 0, next.splice(from, 1)[0])
    reorder.mutate({ orderedSubPlanIds: next })
  }

  // modal state
  const [addingSubPlan, setAddingSubPlan] = useState(false)
  const [editingSubPlan, setEditingSubPlan] = useState<SubPlanNode | null>(null)
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null)        // subPlanId
  const [editingOption, setEditingOption] = useState<OptionNode | null>(null)
  const [decidingFor, setDecidingFor] = useState<SubPlanNode | null>(null)
  const [view, setView] = useState<'list' | 'canvas' | 'timeline'>('list')
  const [connectingFor, setConnectingFor] = useState<SubPlanNode | null>(null)

  const [discussionOpen, setDiscussionOpen] = useState(
    () => localStorage.getItem(`discussion-open-${planId}`) === '1',
  )
  const toggleDiscussion = () =>
    setDiscussionOpen((v) => {
      localStorage.setItem(`discussion-open-${planId}`, v ? '0' : '1')
      return !v
    })

  const { data: timeline, isLoading: timelineLoading } = useTimeline(planId, view === 'timeline')
  const locked = tree?.lockedAt != null
  const completed = tree?.status === 'COMPLETED'

  const [scrolled, setScrolled] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    // setState is in the observer CALLBACK (not the effect body) — compliant with
    // the repo's "no setState in effect" rule. rootMargin top = sticky strip offset.
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: '-56px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [tree?.id])

  const dday = tree?.deadline ? deadlineLabel(tree.deadline, toLocalDateString(new Date())).text : null

  const lifecycleControls = tree && (
    <>
      {locked ? (
        <IconButton variant="ghost" size="sm" label="잠금 해제" disabled={unlockPlan.isPending}
          onClick={() => unlockPlan.mutate(tree.id)}><LockOpen size={16} /></IconButton>
      ) : (
        <IconButton variant="ghost" size="sm" label="잠금" disabled={lockPlan.isPending}
          onClick={() => lockPlan.mutate(tree.id)}><Lock size={16} /></IconButton>
      )}
      {completed ? (
        <IconButton variant="ghost" size="sm" label="다시 진행" disabled={uncompletePlan.isPending}
          onClick={() => uncompletePlan.mutate(tree.id)}><RotateCcw size={16} /></IconButton>
      ) : (
        <IconButton variant="ghost" size="sm" label="완료" disabled={completePlan.isPending}
          onClick={() => completePlan.mutate(tree.id)}><CheckCircle2 size={16} /></IconButton>
      )}
    </>
  )

  // 안건 connections (the canvas edges) surfaced in the list view: resolve each
  // edge to source/target titles and group per 안건 into outgoing/incoming.
  const linksBySubPlan = useMemo(() => {
    const map = new Map<number, { outgoing: { id: number; title: string }[]; incoming: { id: number; title: string }[] }>()
    if (!tree) return map
    const titleById = new Map(tree.subPlans.map((sp) => [sp.id, sp.title] as const))
    tree.subPlans.forEach((sp) => map.set(sp.id, { outgoing: [], incoming: [] }))
    tree.edges.forEach((e) => {
      const src = titleById.get(e.sourceSubPlanId)
      const tgt = titleById.get(e.targetSubPlanId)
      if (src == null || tgt == null) return
      map.get(e.sourceSubPlanId)?.outgoing.push({ id: e.targetSubPlanId, title: tgt })
      map.get(e.targetSubPlanId)?.incoming.push({ id: e.sourceSubPlanId, title: src })
    })
    return map
  }, [tree])

  const jumpToSubPlan = (id: number) => {
    document.getElementById(`subplan-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const [hoveredSubPlanId, setHoveredSubPlanId] = useState<number | null>(null)

  const [searchParams] = useSearchParams()
  const jumpedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!tree) return
    const spParam = searchParams.get('subplan')
    const optParam = searchParams.get('option')
    const jumpKey = `${planId}:${spParam}:${optParam}`
    if (jumpedRef.current === jumpKey) return
    const spNum = Number(spParam)
    let targetId: number | null = spParam != null && Number.isFinite(spNum) ? spNum : null
    if (targetId == null && optParam != null) {
      const optId = Number(optParam)
      if (Number.isFinite(optId)) {
        targetId = tree.subPlans.find((sp) => sp.options.some((o) => o.id === optId))?.id ?? null
      }
    }
    if (targetId != null) {
      jumpedRef.current = jumpKey
      jumpToSubPlan(targetId)
      // Timeout-driven transient: flash the accent layer then clear it.
      // The leading setTimeout keeps the setState out of the effect body
      // (avoids cascading renders) while still firing on the next tick.
      setTimeout(() => {
        setHoveredSubPlanId(targetId)
        setTimeout(() => setHoveredSubPlanId((prev) => (prev === targetId ? null : prev)), 1600)
      }, 0)
    }
  }, [tree, searchParams, planId])

  // Neighbor ids (both directions) of the hovered 안건 — drives the accent layer.
  const hoveredNeighbors = useMemo(() => {
    if (hoveredSubPlanId == null) return null
    const links = linksBySubPlan.get(hoveredSubPlanId)
    if (!links) return new Set<number>()
    return new Set<number>([...links.outgoing.map((l) => l.id), ...links.incoming.map((l) => l.id)])
  }, [hoveredSubPlanId, linksBySubPlan])

  const highlightOf = (id: number): 'normal' | 'source' | 'linked' | 'dim' => {
    if (hoveredSubPlanId == null) return 'normal'
    if (id === hoveredSubPlanId) return 'source'
    if (hoveredNeighbors?.has(id)) return 'linked'
    return 'dim'
  }

  // The spine segment between card[i-1] and card[i] is accented when the hovered
  // source links directly to its adjacent neighbour across that segment.
  const spineActive = (prevId: number, nextId: number): boolean => {
    if (hoveredSubPlanId == null || !hoveredNeighbors) return false
    return (
      (prevId === hoveredSubPlanId && hoveredNeighbors.has(nextId)) ||
      (nextId === hoveredSubPlanId && hoveredNeighbors.has(prevId))
    )
  }

  // Candidates for the 연결 modal: every other 안건, annotated with the existing
  // edge (either direction) so the checkbox reflects current connections.
  const connectCandidates = useMemo<ConnectCandidate[]>(() => {
    if (!tree || !connectingFor) return []
    const src = connectingFor.id
    return tree.subPlans
      .filter((sp) => sp.id !== src)
      .map((sp) => {
        const out = tree.edges.find((e) => e.sourceSubPlanId === src && e.targetSubPlanId === sp.id)
        const inc = tree.edges.find((e) => e.sourceSubPlanId === sp.id && e.targetSubPlanId === src)
        const edge = out ?? inc ?? null
        return { id: sp.id, title: sp.title, edgeId: edge ? edge.id : null, outgoing: out != null }
      })
  }, [tree, connectingFor])

  const leadingOptionId = (sp: SubPlanNode): number | null => {
    const max = Math.max(...sp.options.map((o) => o.voterUserIds.length))
    if (max <= 0) return null
    const leaders = sp.options.filter((o) => o.voterUserIds.length === max)
    return leaders.length === 1 ? leaders[0].id : null
  }

  const renderSubPlan = (sp: SubPlanNode, i: number) => (
    <SortableSubPlanSection
      key={sp.id}
      index={i + 1}
      showSpine={i > 0}
      spineActive={i > 0 && spineActive(tree!.subPlans[i - 1].id, sp.id)}
      subPlan={sp}
      links={linksBySubPlan.get(sp.id)}
      onJumpToSubPlan={jumpToSubPlan}
      highlight={highlightOf(sp.id)}
      onHoverChange={(hovered) => setHoveredSubPlanId(hovered ? sp.id : null)}
      myUserId={myUserId}
      nameOf={nameOf}
      busy={rate.isPending || lock.isPending || reopen.isPending || deleteSubPlan.isPending || deleteOption.isPending || castVote.isPending || retractVote.isPending}
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
      onVote={(o) => castVote.mutate(o.id)}
      onRetractVote={(o) => retractVote.mutate(o.id)}
      onOpenConnect={() => setConnectingFor(sp)}
      locked={locked}
      onSetDeadline={(deadline) => setSubPlanDeadline.mutate({ id: sp.id, deadline })}
      onClearDeadline={() => clearSubPlanDeadline.mutate(sp.id)}
      deadlineBusy={setSubPlanDeadline.isPending || clearSubPlanDeadline.isPending}
    />
  )

  return (
    <Page>
      <PageHeader>
        <BackLink to="/decisions" mobileOnly>결정</BackLink>
        <div className={styles.headerRow}>
          <div className={styles.headerMain}>
            {tree?.groupLabel && <div className={styles.eyebrow}>{tree.groupLabel}</div>}
            <PageTitle>{tree?.title ?? '계획'}</PageTitle>
            {tree?.description && <p className={styles.subtitle}>{tree.description}</p>}
            {tree && (
              <div className={styles.metaRow}>
                <DeadlineChip
                  deadline={tree.deadline}
                  settledAt={completed ? tree.completedAt : null}
                  settledNoun="완료"
                  editable={!locked && !completed}
                  busy={setPlanDeadline.isPending || clearPlanDeadline.isPending}
                  onSet={(deadline) => setPlanDeadline.mutate({ id: tree.id, deadline })}
                  onClear={() => clearPlanDeadline.mutate(tree.id)}
                />
              </div>
            )}
          </div>
          {tree && (
            <div className={styles.lifecycle}>
              {lifecycleControls}
            </div>
          )}
        </div>
      </PageHeader>

      {isLoading && <div className={styles.list}><Skeleton height={120} radius="var(--r-md)" /></div>}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {tree && (
        <div className={discussionOpen ? styles.split : undefined}>
          <div className={styles.main}>
          <div ref={sentinelRef} aria-hidden="true" className={styles.sentinel} />
          <div className={`${styles.controlStrip}${scrolled ? ' ' + styles.stuck : ''}`}>
            <span className={styles.condensedTitle} aria-hidden="true">{tree.title}{dday ? ` · ${dday}` : ''}</span>
            <Tabs
              items={[{ key: 'list', label: '목록' }, { key: 'canvas', label: '캔버스' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
            <span className={styles.controlSpacer} />
            <Button variant="ghost" size="sm" leading={<MessagesSquare size={14} />}
              onClick={toggleDiscussion}>논의</Button>
            <DecisionPresenceStack planId={planId} />
            <div className={styles.stripLifecycle}>{lifecycleControls}</div>
          </div>

          {locked && (
            <div className={styles.lockBanner}>
              <Lock size={14} className={styles.lockBannerIcon} aria-hidden="true" />
              <span>이 계획은 잠겨 있어요. 잠금을 해제하면 다시 편집할 수 있어요.</span>
            </div>
          )}

          {!locked && completed && (
            <div className={styles.lockBanner}>
              <CheckCircle2 size={14} className={styles.lockBannerIcon} aria-hidden="true" />
              <span>완료된 계획이에요. ‘다시 진행’으로 되돌릴 수 있어요.</span>
            </div>
          )}

          {view === 'canvas' && <PlanCanvas tree={tree} locked={locked} />}

          {view === 'timeline' && (
            timelineLoading
              ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
              : <Timeline events={timeline ?? []} nameOf={nameOf} />
          )}

          {view === 'list' && (
            <>
              {tree.subPlans.length === 0 ? (
                <EmptyState title="안건이 없어요" description={locked ? '잠긴 계획이에요.' : '결정할 안건을 추가해 보세요.'}
                  action={locked ? undefined : <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>} />
              ) : (
                <div className={styles.list}>
                  {locked ? (
                    tree.subPlans.map(renderSubPlan)
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                      <SortableContext items={tree.subPlans.map((sp) => sp.id)} strategy={verticalListSortingStrategy}>
                        {tree.subPlans.map(renderSubPlan)}
                      </SortableContext>
                    </DndContext>
                  )}
                  {!locked && (
                    <div className={styles.addRow}>
                      <Button variant="outline" full leading={<Plus size={16} />} onClick={() => setAddingSubPlan(true)}>안건 추가</Button>
                    </div>
                  )}
                </div>
              )}
              {!locked && !discussionOpen && tree.subPlans.length > 0 && (
                <Fab className={styles.fabAdd} label="안건 추가" onClick={() => setAddingSubPlan(true)} />
              )}
            </>
          )}
          </div>
          {discussionOpen && (
            <aside className={styles.pane} aria-label="논의">
              <DiscussionPane planId={planId} onClose={toggleDiscussion} />
            </aside>
          )}
        </div>
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
        currentChosenId={decidingFor?.decision?.chosenOptionId ?? (decidingFor ? leadingOptionId(decidingFor) : null)}
        busy={lock.isPending}
        onSubmit={(payload) => { if (decidingFor) lock.mutate({ subPlanId: decidingFor.id, payload }, { onSuccess: () => setDecidingFor(null) }) }}
      />

      <ConnectModal
        open={connectingFor != null}
        onClose={() => setConnectingFor(null)}
        sourceTitle={connectingFor?.title ?? ''}
        candidates={connectCandidates}
        busy={createEdge.isPending || deleteEdge.isPending}
        onConnect={(targetId) => {
          if (!connectingFor) return
          createEdge.mutate(
            { sourceSubPlanId: connectingFor.id, targetSubPlanId: targetId },
            { onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '연결할 수 없어요.') },
          )
        }}
        onDisconnect={(edgeId) => deleteEdge.mutate(edgeId)}
      />
    </Page>
  )
}
