import { Check, Vote } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { useCastVote, useRetractVote } from './api'
import OptionResourceSection from './OptionResourceSection'
import ProConSection from './ProConSection'
import Comments from '../../components/Comments'
import styles from './OptionPanel.module.css'
import type { OptionNode } from './types'

type Props = { option: OptionNode; isChosen: boolean; decided: boolean; locked: boolean }

export default function OptionPanel({ option, isChosen, decided, locked }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '알 수 없음'

  const castVote = useCastVote()
  const retractVote = useRetractVote()
  const iVoted = option.voterUserIds.includes(myUserId)
  const frozen = locked || decided
  const busy = castVote.isPending || retractVote.isPending

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          {isChosen && <Check size={16} className={styles.chosen} aria-label="결정됨" />}
          <h3 className={styles.title}>{option.title}</h3>
        </div>
        <button
          type="button"
          className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
          disabled={busy || frozen}
          aria-pressed={iVoted}
          title={iVoted ? '투표 취소' : '투표'}
          onClick={() => (iVoted ? retractVote.mutate(option.id) : castVote.mutate(option.id))}
        >
          <Vote size={14} />
          <span>{option.voterUserIds.length > 0 ? `${option.voterUserIds.length}표` : '투표'}</span>
        </button>
      </div>

      {option.description && <p className={styles.desc}>{option.description}</p>}

      <OptionResourceSection optionId={option.id} resources={option.resources} />
      <ProConSection optionId={option.id} proCons={option.proCons} locked={locked} />

      {option.voterUserIds.length > 0 && (
        <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
      )}

      <div className={styles.comments}>
        <Comments pageId={`option:${option.id}`} />
      </div>
    </div>
  )
}
