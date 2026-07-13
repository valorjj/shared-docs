import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus, ListChecks, ListTree, CornerLeftUp, CheckCircle2 } from 'lucide-react'
import { Page, PageHeader, PageTitle, BackLink, Button, Badge, EmptyState, ErrorState, Skeleton } from '../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import {
  useSubPlanDetail, useAddSubPlan,
  useAddOption, useUpdateOption, useDeleteOption,
  useCastVote, useRetractVote, useLockDecision, useReopenDecision,
  useSetSubPlanDeadline, useClearSubPlanDeadline,
} from './api'
import DeadlineChip from './DeadlineChip'
import OptionRow from './OptionRow'
import SubPlanCard from './SubPlanCard'
import TitleDescModal from './TitleDescModal'
import DecisionModal from './DecisionModal'
import Comments from '../../components/Comments'
import styles from './SubPlanDetail.module.css'
import type { OptionNode, VoteSnapshotEntry } from './types'

const STATUS_LABEL: Record<'EMPTY' | 'IN_PROGRESS' | 'DECIDED', string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

export default function SubPlanDetail() {
  const { planId: planIdParam, subPlanId: subPlanIdParam } = useParams()
  const planId = Number(planIdParam)
  const subPlanId = Number(subPlanIdParam)

  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const { data: detail, isLoading, isError, error, refetch } = useSubPlanDetail(subPlanId)

  const addOption = useAddOption()
  const updateOption = useUpdateOption()
  const deleteOption = useDeleteOption()
  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const lock = useLockDecision()
  const reopen = useReopenDecision()
  const setDeadline = useSetSubPlanDeadline()
  const clearDeadline = useClearSubPlanDeadline()
  const addChild = useAddSubPlan(planId)

  const [addingOption, setAddingOption] = useState(false)
  const [editingOption, setEditingOption] = useState<OptionNode | null>(null)
  const [deciding, setDeciding] = useState(false)
  const [addingChild, setAddingChild] = useState(false)

  const locked = detail?.locked ?? false
  const decision = detail?.decision ?? null
  const chosen = decision ? (detail?.options.find((o) => o.id === decision.chosenOptionId) ?? null) : null

  // frozen-at-확정 vote tally (this detail page is the only surface that shows options)
  const snapshot: VoteSnapshotEntry[] | null = (() => {
    if (!decision?.voteSnapshot) return null
    try { return JSON.parse(decision.voteSnapshot) as VoteSnapshotEntry[] } catch { return null }
  })()
  const totalVotes = snapshot?.reduce((n, e) => n + e.count, 0) ?? 0
  const chosenTally = snapshot?.find((e) => e.optionId === decision?.chosenOptionId)

  const busy = addOption.isPending || updateOption.isPending || deleteOption.isPending
    || castVote.isPending || retractVote.isPending || lock.isPending || reopen.isPending

  return (
    <Page>
      <PageHeader>
        <BackLink to={`/decisions/${planId}`} mobileOnly>결정</BackLink>
        {detail && (
          <nav className={styles.breadcrumb} aria-label="상위 경로">
            <Link to="/decisions">결정</Link>
            <span className={styles.crumbSep}>›</span>
            <Link to={`/decisions/${planId}`}>{detail.planTitle}</Link>
            <span className={styles.crumbSep}>›</span>
            <span className={styles.crumbCurrent} aria-current="page">{detail.title}</span>
            {detail.parentSubPlanId != null && (
              <Link
                to={`/decisions/${planId}/subplans/${detail.parentSubPlanId}`}
                className={styles.upLink}
              >
                <CornerLeftUp size={12} aria-hidden="true" /> 상위 안건
              </Link>
            )}
          </nav>
        )}
        <div className={styles.headerRow}>
          <div className={styles.headerMain}>
            <PageTitle>{detail?.title ?? '안건'}</PageTitle>
            {detail?.description && <p className={styles.subtitle}>{detail.description}</p>}
            {detail && (
              <div className={styles.metaRow}>
                <Badge>{STATUS_LABEL[detail.status]}</Badge>
                <DeadlineChip
                  deadline={detail.deadline}
                  settledAt={decision?.decidedAt ?? null}
                  settledNoun="결정"
                  editable={!locked && decision == null}
                  busy={setDeadline.isPending || clearDeadline.isPending}
                  onSet={(deadline) => setDeadline.mutate({ id: subPlanId, deadline })}
                  onClear={() => clearDeadline.mutate(subPlanId)}
                />
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {isLoading && <div className={styles.list}><Skeleton height={120} radius="var(--r-md)" /></div>}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {detail && (
        <>
          <section className={styles.section} aria-label="선택지">
            <h2 className={styles.heading}>
              <ListChecks size={14} aria-hidden="true" /> 선택지
            </h2>

            {decision && chosen && (
              <div className={styles.banner}>
                <span className={styles.bannerTag}><CheckCircle2 size={13} aria-hidden="true" /> 결정됨</span>
                <span className={styles.bannerBody}>
                  <strong>{chosen.title}</strong> · {decision.reason}
                  {snapshot && <span className={styles.bannerVotes}> · {totalVotes}표 중 {chosenTally?.count ?? 0}표</span>}
                </span>
                {!locked && <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('이 결정을 다시 열까요? 기록은 남아요.')) reopen.mutate(subPlanId) }} disabled={busy}>다시 열기</Button>}
              </div>
            )}

            {detail.options.length === 0 ? (
              <EmptyState title="선택지가 없어요" description={locked ? '잠긴 안건이에요.' : '선택지를 추가해 결정을 시작하세요.'}
                action={locked ? undefined : <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingOption(true)}>선택지 추가</Button>} />
            ) : (
              <div className={styles.options}>
                {detail.options.map((o) => (
                  <OptionRow
                    key={o.id}
                    option={o}
                    myUserId={myUserId}
                    isChosen={decision?.chosenOptionId === o.id}
                    decided={decision != null}
                    nameOf={nameOf}
                    busy={busy}
                    locked={locked}
                    onEdit={() => setEditingOption(o)}
                    onDelete={() => {
                      if (!window.confirm('삭제할까요? 되돌릴 수 없어요.')) return
                      deleteOption.mutate(o.id, {
                        onError: (e) => window.alert((e as { body?: { detail?: string } }).body?.detail ?? '삭제할 수 없어요.'),
                      })
                    }}
                    onVote={() => castVote.mutate(o.id)}
                    onRetractVote={() => retractVote.mutate(o.id)}
                  />
                ))}
              </div>
            )}

            {!locked && detail.options.length > 0 && (
              <div className={styles.footer}>
                <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingOption(true)}>선택지 추가</Button>
                {!decision && (
                  <Button variant="primary" onClick={() => setDeciding(true)} disabled={busy}>
                    {detail.options.some((o) => o.voterUserIds.length > 0) ? '결과 확정하기' : '결정하기'}
                  </Button>
                )}
              </div>
            )}
          </section>

          <section className={styles.section} aria-label="서브안건">
            <h2 className={styles.heading}>
              <ListTree size={14} aria-hidden="true" /> 서브안건
            </h2>
            {detail.children.length === 0 ? (
              <p className={styles.empty}>서브안건이 없어요.</p>
            ) : (
              <div className={styles.childList}>
                {detail.children.map((child, i) => (
                  <SubPlanCard key={child.id} subPlan={child} planId={planId} index={i + 1} nested locked={locked} />
                ))}
              </div>
            )}
            {!locked && (
              <Button variant="outline" size="sm" leading={<Plus size={14} />} onClick={() => setAddingChild(true)}>서브안건 추가</Button>
            )}
          </section>

          <div className={styles.commentsSection}>
            <Comments pageId={`subplan:${subPlanId}`} />
          </div>
        </>
      )}

      {/* 선택지 add/edit */}
      <TitleDescModal
        open={addingOption} onClose={() => setAddingOption(false)} entityLabel="선택지" busy={addOption.isPending}
        onSubmit={(payload) => addOption.mutate({ subPlanId, payload }, { onSuccess: () => setAddingOption(false) })}
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
        open={deciding} onClose={() => setDeciding(false)}
        options={detail?.options ?? []}
        currentChosenId={decision?.chosenOptionId ?? null}
        busy={lock.isPending}
        onSubmit={(payload) => lock.mutate({ subPlanId, payload }, { onSuccess: () => setDeciding(false) })}
      />

      {/* 서브안건 add */}
      <TitleDescModal
        open={addingChild} onClose={() => setAddingChild(false)} entityLabel="서브안건" busy={addChild.isPending}
        onSubmit={(payload) => addChild.mutate(
          { ...payload, parentSubPlanId: subPlanId },
          { onSuccess: () => setAddingChild(false) },
        )}
      />
    </Page>
  )
}
