import { useState } from 'react'
import styles from './SheetEditorTitle.module.css'

type Props = {
  initialValue: string | null
  onCommit: (value: string | null) => void
  readOnly?: boolean
}

export default function SheetEditorTitle({ initialValue, onCommit, readOnly = false }: Props) {
  const [value, setValue] = useState(() => initialValue ?? '')

  const commit = () => {
    if (readOnly) return
    const next = value.trim()
    const normalized = next.length === 0 ? null : next
    const prev = (initialValue ?? '').trim()
    if (normalized === (prev.length === 0 ? null : prev)) return
    onCommit(normalized)
  }

  return (
    <input
      className={styles.input}
      type="text"
      value={value}
      placeholder={readOnly ? '제목 없는 시트' : '시트 제목'}
      readOnly={readOnly}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      maxLength={200}
    />
  )
}
