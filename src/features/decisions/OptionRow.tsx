import { useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Check, Vote } from 'lucide-react'
import { IconButton } from '../../components/ui'
import RatingControl from './RatingControl'
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
  onRate: (score: number, comment: string | undefined) => void
  onClearRating: () => void
  onEdit: () => void
  onDelete: () => void
  onVote: () => void
  onRetractVote: () => void
}

export default function OptionRow({
  option, myUserId, isChosen, decided, nameOf, busy, locked, onRate, onClearRating, onEdit, onDelete, onVote, onRetractVote,
}: Props) {
  const [open, setOpen] = useState(false)
  const myRating = option.ratings.find((r) => r.userId === myUserId) ?? null
  const others = option.ratings.filter((r) => r.userId !== myUserId)
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
        <span className={styles.avg}>
          {option.avgScore != null ? `평균 ${option.avgScore.toFixed(1)} (${option.ratingCount})` : '평가 없음'}
        </span>
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
          <RatingControl key={myRating ? 'rated' : 'unrated'} myRating={myRating} busy={busy || locked} onRate={onRate} onClear={onClearRating} />
          {others.length > 0 && (
            <ul className={styles.others}>
              {others.map((r) => (
                <li key={r.userId} className={styles.otherLine}>
                  <span className={styles.otherName}>{nameOf(r.userId)}</span>
                  <span className={styles.otherScore}>{r.score}</span>
                  {r.comment && <span className={styles.otherComment}>{r.comment}</span>}
                </li>
              ))}
            </ul>
          )}
          {option.voterUserIds.length > 0 && (
            <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
