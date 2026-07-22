import { Vote } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { collabColorForUser } from '../notes/collab/collabColor'
import { useCastVote, useRetractVote } from './api'
import { Panel } from '../../components/ui'
import Comments from '../../components/Comments'
import styles from './OptionSheet.module.css'
import type { OptionNode } from './types'

type Props = { option: OptionNode; onClose: () => void }

/**
 * Light per-후보 detail for Spec 1: title, a vote toggle with voter avatars,
 * and the per-후보 comment thread. The rich 장점·단점 + 자료 editor is Spec 2.
 */
export default function OptionSheet({ option, onClose }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)

  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const iVoted = option.voterUserIds.includes(myUserId)
  const busy = castVote.isPending || retractVote.isPending

  return (
    <Panel open onClose={onClose} title={option.title}>
      <div className={styles.wrap}>
        <div className={styles.voteRow}>
          <button
            type="button"
            className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
            disabled={busy}
            aria-pressed={iVoted}
            onClick={() => (iVoted ? retractVote.mutate(option.id) : castVote.mutate(option.id))}
          >
            <Vote size={15} />
            <span>{iVoted ? '투표함' : '투표'}</span>
          </button>

          {option.voterUserIds.length > 0 && (
            <div className={styles.voters}>
              {option.voterUserIds.map((uid) => (
                <span
                  key={uid}
                  className={styles.av}
                  style={{ background: collabColorForUser(uid) }}
                  title={nameOf(uid)}
                >
                  {nameOf(uid).slice(0, 1)}
                </span>
              ))}
            </div>
          )}
        </div>

        {option.voterUserIds.length > 0 && (
          <p className={styles.voterNames}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
        )}

        <div className={styles.comments}>
          <Comments pageId={`option:${option.id}`} />
        </div>
      </div>
    </Panel>
  )
}
