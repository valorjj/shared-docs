import { NotebookPen } from 'lucide-react'
import styles from './NoteEditorEmpty.module.css'

export default function NoteEditorEmpty() {
  return (
    <div className={styles.root}>
      <span className={styles.icon} aria-hidden="true">
        <NotebookPen size={28} strokeWidth={1.5} />
      </span>
      <p className={styles.title}>메모를 선택하세요</p>
      <p className={styles.sub}>왼쪽에서 메모를 고르거나 새 메모를 만들어 보세요.</p>
    </div>
  )
}
