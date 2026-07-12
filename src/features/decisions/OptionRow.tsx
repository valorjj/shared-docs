import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Check, Vote, ListChecks } from 'lucide-react'
import { IconButton } from '../../components/ui'
import Comments from '../../components/Comments'
import ProConSection from './ProConSection'
import styles from './OptionRow.module.css'
import type { OptionNode } from './types'

type Props = {
  option: OptionNode
  myUserId: number
  isChosen: boolean
  decided: boolean
  nameOf: (userId: number) => string
  busy?: boolean
  locked?: boolean
  onEdit: () => void
  onDelete: () => void
  onVote: () => void
  onRetractVote: () => void
}

export default function OptionRow({
  option, myUserId, isChosen, decided, nameOf, busy, locked, onEdit, onDelete, onVote, onRetractVote,
}: Props) {
  const [open, setOpen] = useState(false)
  const iVoted = option.voterUserIds.includes(myUserId)
  const frozen = !!locked || decided

  return (
    <div className={isChosen ? `${styles.row} ${styles.rowChosen}` : styles.row}>
      <div className={styles.head}>
        <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={styles.title}>{option.title}</span>
          {isChosen && <Check size={14} className={styles.chosenMark} aria-label="결정됨" />}
        </button>
        <button
          type="button"
          className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
          disabled={busy || frozen}
          aria-pressed={iVoted}
          aria-label={iVoted ? '투표 취소' : '투표'}
          title={iVoted ? '투표 취소' : '투표'}
          onClick={() => (iVoted ? onRetractVote() : onVote())}
        >
          <Vote size={13} />
          {option.voterUserIds.length > 0 && <span>{option.voterUserIds.length}</span>}
        </button>
        {option.proCons.length > 0 && (
          <span className={styles.proConCount}>
            <ListChecks size={13} /> 장단점 {option.proCons.length}
          </span>
        )}
        {!locked && (
          <div className={styles.actions}>
            <IconButton variant="ghost" size="sm" label="선택지 수정" onClick={onEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label="선택지 삭제" onClick={onDelete}><Trash2 size={14} /></IconButton>
          </div>
        )}
      </div>

      {open && (
        <div className={styles.body}>
          {option.description && <p className={styles.desc}>{option.description}</p>}
          <ProConSection optionId={option.id} proCons={option.proCons} locked={!!locked} />
          {option.voterUserIds.length > 0 && (
            <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
          )}
          <div className={styles.commentsSection}>
            <Comments pageId={`option:${option.id}`} />
          </div>
        </div>
      )}
    </div>
  )
}
