import { Vote } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { collabColorForUser } from '../notes/collab/collabColor'
import { useCastVote, useRetractVote, useUpdateOption, useSubPlanDetail } from './api'
import { Panel, RichTextField } from '../../components/ui'
import OptionResourceSection from './OptionResourceSection'
import Comments from '../../components/Comments'
import styles from './OptionSheet.module.css'
import type { OptionNode } from './types'

type Props = { option: OptionNode; subPlanId: number; onClose: () => void }

/**
 * Full 후보 detail: vote → 장점 → 단점 → 자료 → 댓글, one vertical scroll.
 * Fetches the subplan detail so 자료 (empty in the tree payload) is populated, and
 * re-resolves the open 후보 from that live detail to avoid a stale snapshot.
 */
export default function OptionSheet({ option, subPlanId, onClose }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const { data: detail } = useSubPlanDetail(subPlanId)

  // Prefer the freshly-fetched option (has resources + latest pros/cons); fall back
  // to the tree option passed in while the detail request is in flight.
  const live = detail?.options.find((o) => o.id === option.id) ?? option

  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const updateOption = useUpdateOption()
  const iVoted = live.voterUserIds.includes(myUserId)
  const busy = castVote.isPending || retractVote.isPending

  return (
    <Panel open onClose={onClose} title={live.title}>
      <div className={styles.wrap}>
        <div className={styles.voteRow}>
          <button
            type="button"
            className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
            disabled={busy}
            aria-pressed={iVoted}
            onClick={() => (iVoted ? retractVote.mutate(live.id) : castVote.mutate(live.id))}
          >
            <Vote size={15} />
            <span>{iVoted ? '투표함' : '투표'}</span>
          </button>
          {live.voterUserIds.length > 0 && (
            <div className={styles.voters}>
              {live.voterUserIds.map((uid) => (
                <span key={uid} className={styles.av}
                  style={{ background: collabColorForUser(uid) }} title={nameOf(uid)}>
                  {nameOf(uid).slice(0, 1)}
                </span>
              ))}
            </div>
          )}
        </div>
        {live.voterUserIds.length > 0 && (
          <p className={styles.voterNames}>투표: {live.voterUserIds.map(nameOf).join(', ')}</p>
        )}

        <section className={styles.block}>
          <h4 className={styles.blockLabel}>장점</h4>
          <RichTextField
            value={live.pros}
            placeholder="장점을 적어보세요"
            onSave={(html) => updateOption.mutate({ id: live.id, payload: { pros: html } })}
          />
        </section>

        <section className={styles.block}>
          <h4 className={styles.blockLabel}>단점</h4>
          <RichTextField
            value={live.cons}
            placeholder="단점을 적어보세요"
            onSave={(html) => updateOption.mutate({ id: live.id, payload: { cons: html } })}
          />
        </section>

        <OptionResourceSection optionId={live.id} resources={live.resources} />

        <div className={styles.comments}>
          <Comments pageId={`option:${live.id}`} />
        </div>
      </div>
    </Panel>
  )
}
