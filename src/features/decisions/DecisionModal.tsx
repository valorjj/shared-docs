import { useState, type FormEvent } from 'react'
import { Modal, Field, Label, Textarea, Button } from '../../components/ui'
import styles from './DecisionModal.module.css'
import type { OptionNode, LockDecisionPayload } from './types'

type Props = {
  open: boolean
  onClose: () => void
  options: OptionNode[]
  currentChosenId?: number | null     // preselect when changing an existing decision
  busy?: boolean
  onSubmit: (payload: LockDecisionPayload) => void
}

export default function DecisionModal(props: Props) {
  return <DecisionModalInner key={props.open ? 'open' : 'closed'} {...props} />
}

function DecisionModalInner({ open, onClose, options, currentChosenId, busy, onSubmit }: Props) {
  const [chosenOptionId, setChosenOptionId] = useState<number | null>(() => currentChosenId ?? null)
  const [reason, setReason] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (chosenOptionId == null || !reason.trim()) return
    onSubmit({ chosenOptionId, reason: reason.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="결정하기"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="decision-form"
                  disabled={busy || chosenOptionId == null || !reason.trim()}>
            {busy ? '저장 중…' : '결정'}
          </Button>
        </>
      }
    >
      <form id="decision-form" onSubmit={submit}>
        <div className={styles.options} role="radiogroup" aria-label="선택지">
          {options.map((o) => (
            <label key={o.id} className={chosenOptionId === o.id ? `${styles.option} ${styles.optionOn}` : styles.option}>
              <input type="radio" name="chosen" value={o.id}
                     checked={chosenOptionId === o.id}
                     onChange={() => setChosenOptionId(o.id)} />
              <span className={styles.optionTitle}>{o.title}</span>
              {o.voterUserIds.length > 0 && <span className={styles.optionVotes}>{o.voterUserIds.length}표</span>}
            </label>
          ))}
        </div>
        <Field>
          <Label htmlFor="decision-reason">이유</Label>
          <Textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                    rows={3} maxLength={2000} placeholder="왜 이 선택지로 정했나요?" />
        </Field>
      </form>
    </Modal>
  )
}
