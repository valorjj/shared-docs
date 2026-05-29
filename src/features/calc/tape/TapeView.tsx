import { useCalcEntries } from '../api'
import type { CalcEntry } from '../types'
import TapeEmpty from './TapeEmpty'
import TapeLine from './TapeLine'
import styles from './Tape.module.css'

type Props = {
  /** Called when the user picks a tape line. The workspace seeds the
   *  matching mode editor with the entry's content. Passing the same
   *  entry id again clears the seed (handled by the workspace). */
  onSelectEntry?: (entry: CalcEntry) => void
  /** Visually marks the row currently loaded into the editor. */
  activeEntryId?: number | null
}

export default function TapeView({ onSelectEntry, activeEntryId }: Props) {
  const { data, isLoading } = useCalcEntries()
  if (isLoading) {
    return <p className={styles.loading}>불러오는 중…</p>
  }
  const entries = data ?? []
  return (
    <>
      <h2 className={styles.heading}>기록</h2>
      {entries.length === 0 ? (
        <TapeEmpty />
      ) : (
        <ol className={styles.list}>
          {entries.map((e) => (
            <li key={e.id}>
              <TapeLine
                entry={e}
                active={activeEntryId === e.id}
                onSelect={onSelectEntry}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
