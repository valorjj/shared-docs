import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, RotateCcw, MessagesSquare } from 'lucide-react'
import { Page, PageHeader, PageTitle, BackLink, Button, IconButton, ErrorState, Skeleton, Tabs } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  usePlanTree, useTimeline, useCompletePlan, useUncompletePlan,
  useSetPlanDeadline, useClearPlanDeadline,
} from './api'
import DeadlineChip from './DeadlineChip'
import { deadlineLabel, toLocalDateString } from './deadlineLabel'
import ResourceSection from './ResourceSection'
import Comments from '../../components/Comments'
import PlanChain from './PlanChain'
import Timeline from './Timeline'
import DiscussionPane from './DiscussionPane'
import styles from './PlanDetail.module.css'

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

  const completePlan = useCompletePlan()
  const uncompletePlan = useUncompletePlan()
  const setPlanDeadline = useSetPlanDeadline()
  const clearPlanDeadline = useClearPlanDeadline()

  const [view, setView] = useState<'chain' | 'timeline'>('chain')

  const [discussionOpen, setDiscussionOpen] = useState(
    () => localStorage.getItem(`discussion-open-${planId}`) === '1',
  )
  const toggleDiscussion = () =>
    setDiscussionOpen((v) => {
      localStorage.setItem(`discussion-open-${planId}`, v ? '0' : '1')
      return !v
    })

  const { data: timeline, isLoading: timelineLoading } = useTimeline(planId, view === 'timeline')
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
    completed ? (
      <IconButton variant="ghost" size="sm" label="다시 진행" disabled={uncompletePlan.isPending}
        onClick={() => uncompletePlan.mutate(tree.id)}><RotateCcw size={16} /></IconButton>
    ) : (
      <IconButton variant="ghost" size="sm" label="완료" disabled={completePlan.isPending}
        onClick={() => { if (window.confirm('이 계획을 완료할까요?')) completePlan.mutate(tree.id) }}
      ><CheckCircle2 size={16} /></IconButton>
    )
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
                  editable={!completed}
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
        <div key={planId} className={discussionOpen ? styles.split : styles.mainWrap}>
          <div className={styles.main}>
          <div ref={sentinelRef} aria-hidden="true" className={styles.sentinel} />
          <div className={`${styles.controlStrip}${scrolled ? ' ' + styles.stuck : ''}`}>
            <span className={styles.condensedTitle} aria-hidden="true">{tree.title}{dday ? ` · ${dday}` : ''}</span>
            <Tabs
              items={[{ key: 'chain', label: '결정' }, { key: 'timeline', label: '기록' }]}
              value={view}
              onChange={setView}
            />
            <span className={styles.controlSpacer} />
            <Button variant="ghost" size="sm" leading={<MessagesSquare size={14} />}
              onClick={toggleDiscussion}>논의</Button>
            <div className={styles.stripLifecycle}>{lifecycleControls}</div>
          </div>

          {completed && (
            <div className={styles.lockBanner}>
              <CheckCircle2 size={14} className={styles.lockBannerIcon} aria-hidden="true" />
              <span>완료된 계획이에요. ‘다시 진행’으로 되돌릴 수 있어요.</span>
            </div>
          )}

          {view === 'chain' && (
            <>
              <PlanChain tree={tree} planId={planId} />
              <ResourceSection planId={planId} />
              <div className={styles.commentsSection}>
                <Comments pageId={`plan:${planId}`} />
              </div>
            </>
          )}

          {view === 'timeline' && (
            timelineLoading
              ? <div className={styles.list}><Skeleton height={64} radius="var(--r-md)" /></div>
              : <Timeline events={timeline ?? []} nameOf={nameOf} />
          )}
          </div>
          {discussionOpen && (
            <aside className={styles.pane} aria-label="논의">
              <DiscussionPane planId={planId} onClose={toggleDiscussion} />
            </aside>
          )}
        </div>
      )}
    </Page>
  )
}
