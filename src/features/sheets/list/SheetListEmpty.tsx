import { TableProperties } from 'lucide-react'
import styles from './SheetListEmpty.module.css'

type Props = {
  onCreate: () => void
}

export default function SheetListEmpty({ onCreate }: Props) {
  return (
    <div className={styles.root}>
      <span className={styles.icon} aria-hidden="true">
        <TableProperties size={24} strokeWidth={1.5} />
      </span>
      <p className={styles.title}>아직 시트가 없어요</p>
      <button type="button" className={styles.cta} onClick={onCreate}>
        새 시트 만들기
      </button>
    </div>
  )
}
