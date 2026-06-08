import { useState } from 'react'
import { Button } from '../../components/ui'
import styles from './RatingControl.module.css'

type Props = {
  myRating: { score: number; comment: string | null } | null
  busy?: boolean
  onRate: (score: number, comment: string | undefined) => void
  onClear: () => void
}

const SCORES = [1, 2, 3, 4, 5]

export default function RatingControl({ myRating, busy, onRate, onClear }: Props) {
  const [comment, setComment] = useState(() => myRating?.comment ?? '')
  const score = myRating?.score ?? null

  const pick = (s: number) => onRate(s, comment.trim() || undefined)
  const commitComment = () => {
    if (score == null) return // a comment without a score is meaningless; pick a score first
    const next = comment.trim() || undefined
    if ((myRating?.comment ?? '') !== (next ?? '')) onRate(score, next)
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>내 평가</span>
      <div className={styles.scores} role="group" aria-label="내 평가 점수">
        {SCORES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            aria-pressed={score === s}
            className={score === s ? `${styles.score} ${styles.scoreOn}` : styles.score}
            onClick={() => pick(s)}
          >
            {s}
          </button>
        ))}
        {score != null && (
          <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>지우기</Button>
        )}
      </div>
      <input
        className={styles.comment}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={commitComment}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitComment() } }}
        placeholder="한마디 (선택)"
        maxLength={2000}
        disabled={busy}
      />
    </div>
  )
}
