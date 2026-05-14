import { FilePlus2 } from 'lucide-react'
import styles from './NoteListEmpty.module.css'

type Props = {
  onCreate: () => void
}

export default function NoteListEmpty({ onCreate }: Props) {
  return (
    <div className={styles.root}>
      <span className={styles.icon} aria-hidden="true">
        <FilePlus2 size={24} strokeWidth={1.5} />
      </span>
      <p className={styles.title}>아직 메모가 없어요</p>
      <button type="button" className={styles.cta} onClick={onCreate}>
        새 메모 만들기
      </button>
    </div>
  )
}
