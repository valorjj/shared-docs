import { useCalcEntries } from '../api'
import TapeEmpty from './TapeEmpty'
import TapeLine from './TapeLine'
import styles from './Tape.module.css'

export default function TapeView() {
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
              <TapeLine entry={e} />
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
