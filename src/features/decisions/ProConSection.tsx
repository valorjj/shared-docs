import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { IconButton } from '../../components/ui'
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
  const [draft, setDraft] = useState('')
  const addProCon = useAddProCon()
  const deleteProCon = useDeleteProCon()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    addProCon.mutate(
      { optionId, payload: { kind, content: trimmed } },
      { onSuccess: () => setDraft('') },
    )
  }

  return (
    <div className={styles.column}>
      <h4 className={styles.columnTitle}>{label}</h4>
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
        <form className={styles.addForm} onSubmit={handleSubmit}>
          <input
            className={styles.addInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={addLabel}
            aria-label={addLabel}
            maxLength={200}
          />
          <IconButton variant="ghost" size="sm" label={addLabel} type="submit" disabled={!draft.trim() || addProCon.isPending}>
            <Plus size={13} />
          </IconButton>
        </form>
      )}
    </div>
  )
}
