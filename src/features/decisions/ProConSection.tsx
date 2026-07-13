import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { IconButton, Modal, Field, Label, Textarea, Button } from '../../components/ui'
import { useAddProCon, useDeleteProCon } from './api'
import styles from './ProConSection.module.css'
import type { ProCon, ProConKind } from './types'

type Props = {
  optionId: number
  proCons: ProCon[]
  locked: boolean
}

const COLUMNS: { kind: ProConKind; label: string; addLabel: string }[] = [
  { kind: 'PRO', label: '장점', addLabel: '장점 추가' },
  { kind: 'CON', label: '단점', addLabel: '단점 추가' },
]

export default function ProConSection({ optionId, proCons, locked }: Props) {
  return (
    <div className={styles.grid}>
      {COLUMNS.map(({ kind, label, addLabel }) => (
        <ProConColumn
          key={kind}
          kind={kind}
          label={label}
          addLabel={addLabel}
          optionId={optionId}
          lines={proCons.filter((pc) => pc.kind === kind)}
          locked={locked}
        />
      ))}
    </div>
  )
}

function ProConColumn({
  kind, label, addLabel, optionId, lines, locked,
}: {
  kind: ProConKind
  label: string
  addLabel: string
  optionId: number
  lines: ProCon[]
  locked: boolean
}) {
  const [adding, setAdding] = useState(false)
  const addProCon = useAddProCon()
  const deleteProCon = useDeleteProCon()

  return (
    <div className={styles.column}>
      <h4 className={styles.columnTitle}>
        <span>{label}</span>
        {lines.length > 0 && <span className={styles.columnCount}>{lines.length}</span>}
      </h4>
      {lines.length === 0 ? (
        <p className={styles.empty}>없음</p>
      ) : (
        <ul className={styles.list}>
          {lines.map((pc) => (
            <li key={pc.id} className={styles.line}>
              <span className={styles.lineText}>{pc.content}</span>
              {!locked && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  label={`${label} 삭제`}
                  onClick={() => deleteProCon.mutate(pc.id)}
                  disabled={deleteProCon.isPending && deleteProCon.variables === pc.id}
                >
                  <X size={12} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <button type="button" className={styles.addBtn} onClick={() => setAdding(true)}>
          <Plus size={13} />
          <span>{addLabel}</span>
        </button>
      )}
      {adding && (
        <ProConModal
          addLabel={addLabel}
          label={label}
          busy={addProCon.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(content) => addProCon.mutate(
            { optionId, payload: { kind, content } },
            { onSuccess: () => setAdding(false) },
          )}
        />
      )}
    </div>
  )
}

function ProConModal({ addLabel, label, busy, onClose, onSubmit }: {
  addLabel: string
  label: string
  busy: boolean
  onClose: () => void
  onSubmit: (content: string) => void
}) {
  const [content, setContent] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={addLabel}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" type="submit" form="procon-form" disabled={busy || !content.trim()}>
            {busy ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form id="procon-form" onSubmit={submit}>
        <Field>
          <Label htmlFor="procon-content">{label}</Label>
          <Textarea
            id="procon-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            placeholder={`${label} 내용을 입력하세요`}
          />
        </Field>
      </form>
    </Modal>
  )
}
