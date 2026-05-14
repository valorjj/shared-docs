import { useState } from 'react'
import styles from './NoteEditorTitle.module.css'

type Props = {
  initialValue: string | null
  onCommit: (value: string | null) => void
}

/**
 * The parent re-keys this component on note change, so we read `initialValue`
 * once via lazy `useState` and never sync via effect.
 */
export default function NoteEditorTitle({ initialValue, onCommit }: Props) {
  const [value, setValue] = useState(() => initialValue ?? '')

  const commit = () => {
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
      placeholder="제목"
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
