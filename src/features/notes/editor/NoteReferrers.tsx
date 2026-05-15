import { useNavigate } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { useNoteReferrers } from '../api'
import styles from './NoteReferrers.module.css'

type Props = { noteId: number }

/**
 * "참조됨" strip — lists the memos that link to this note. Hidden when
 * the panel has no rows (most notes have zero referrers). Renders below
 * the editor meta and above the body so the user can navigate the
 * surrounding graph without scrolling away from the editor.
 */
export default function NoteReferrers({ noteId }: Props) {
  const navigate = useNavigate()
  const { data: referrers, isLoading } = useNoteReferrers(noteId)

  if (isLoading || !referrers || referrers.length === 0) return null

  return (
    <section className={styles.wrap} aria-label="이 메모를 참조하는 메모">
      <div className={styles.header}>
        <Link2 size={12} strokeWidth={2} aria-hidden="true" />
        <span className={styles.title}>참조됨</span>
        <span className={styles.count}>{referrers.length}</span>
      </div>
      <ul className={styles.list}>
        {referrers.map((ref) => (
          <li key={ref.id}>
            <button
              type="button"
              className={styles.item}
              onClick={() => navigate(`/?note=${ref.id}`)}
              title={ref.title ?? '제목 없음'}
            >
              {ref.title ?? '제목 없음'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
