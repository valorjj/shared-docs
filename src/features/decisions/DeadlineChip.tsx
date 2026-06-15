import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { Modal, Field, Label, Input, Button } from '../../components/ui'
import { deadlineLabel, settledDeadlineLabel, fullDate, toLocalDateString } from './deadlineLabel'
import styles from './DeadlineChip.module.css'

type Props = {
  deadline: string | null
  /** decidedAt / completedAt — when present with a deadline, show a frozen 기한 내/지나 annotation. */
  settledAt?: string | null
  settledNoun?: string            // '결정' | '완료'
  editable: boolean
  busy?: boolean
  onSet?: (deadline: string) => void
  onClear?: () => void
}

export default function DeadlineChip({ deadline, settledAt, settledNoun = '결정', editable, busy, onSet, onClear }: Props) {
  const [open, setOpen] = useState(false)

  // Frozen annotation: settled with a deadline → read-only 기한 내/지나.
  if (deadline && settledAt) {
    const { text, tone } = settledDeadlineLabel(deadline, settledAt, settledNoun)
    return <span className={`${styles.chip} ${styles[tone]}`} title={fullDate(deadline)}><CalendarClock size={12} aria-hidden="true" />{text}</span>
  }

  // Live D-day (or ghost "기한" when none + editable).
  const live = deadline ? deadlineLabel(deadline, toLocalDateString(new Date())) : null

  if (!editable) {
    // Display-only (board cards, locked): show the chip if a deadline exists, else nothing.
    if (!live || !deadline) return null
    return <span className={`${styles.chip} ${styles[live.tone]}`} title={fullDate(deadline)}><CalendarClock size={12} aria-hidden="true" />{live.text}</span>
  }

  // Editable: chip is a button that opens the date modal.
  return (
    <>
      {deadline && live ? (
        <button type="button" className={`${styles.chip} ${styles.button} ${styles[live.tone]}`} title={fullDate(deadline)}
                onClick={() => setOpen(true)} disabled={busy}><CalendarClock size={12} aria-hidden="true" />{live.text}</button>
      ) : (
        <button type="button" className={`${styles.chip} ${styles.button} ${styles.ghost}`}
                onClick={() => setOpen(true)} disabled={busy}><CalendarClock size={12} aria-hidden="true" />기한</button>
      )}
      {open && (
        <DeadlineModal
          current={deadline}
          busy={busy}
          onClose={() => setOpen(false)}
          onSet={(d) => { onSet?.(d); setOpen(false) }}
          onClear={() => { onClear?.(); setOpen(false) }}
        />
      )}
    </>
  )
}

function DeadlineModal({ current, busy, onClose, onSet, onClear }: {
  current: string | null; busy?: boolean; onClose: () => void; onSet: (d: string) => void; onClear: () => void
}) {
  const [value, setValue] = useState(current ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      title="기한"
      footer={
        <>
          {current && <Button variant="ghost" onClick={onClear} disabled={busy}>없애기</Button>}
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" onClick={() => value && onSet(value)} disabled={busy || !value}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <Field>
        <Label htmlFor="deadline-input">날짜</Label>
        <Input id="deadline-input" type="date" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      </Field>
    </Modal>
  )
}
