import type { SheetSummary } from '../types'
import SheetListEmpty from './SheetListEmpty'
import SheetListHeader from './SheetListHeader'
import SheetListItem from './SheetListItem'
import styles from './SheetList.module.css'

type Props = {
  sheets: SheetSummary[]
  activeId: number | null
  loading: boolean
  onSelect: (id: number) => void
  onCreate: () => void
}

export default function SheetList({ sheets, activeId, loading, onSelect, onCreate }: Props) {
  return (
    <div className={styles.root}>
      <SheetListHeader count={sheets.length} onCreate={onCreate} />
      <div className={styles.scroll}>
        {loading && sheets.length === 0 ? (
          <div className={styles.loading}>불러오는 중…</div>
        ) : sheets.length === 0 ? (
          <SheetListEmpty onCreate={onCreate} />
        ) : (
          <ul className={styles.list}>
            {sheets.map((s) => (
              <SheetListItem
                key={s.id}
                sheet={s}
                active={s.id === activeId}
                onClick={() => onSelect(s.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
