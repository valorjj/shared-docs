import { useNavigate, useParams } from 'react-router-dom'
import { Share2 } from 'lucide-react'
import { EmptyState } from '../../components/ui'
import { useSharedWithMe } from './api'
import SharedNoteView from './SharedNoteView'
import styles from './SharedItemList.module.css'

export default function SharedItemList() {
  const { data, isLoading } = useSharedWithMe()
  const navigate = useNavigate()
  const params = useParams()
  const selectedId = params.noteId ? Number(params.noteId) : null

  if (selectedId != null) return <SharedNoteView noteId={selectedId} />

  if (isLoading) return <p className={styles.state}>불러오는 중…</p>
  if (!data || data.length === 0) {
    return <EmptyState title="공유받은 항목이 없어요" description="다른 사람이 메모를 공유하면 여기에 나타나요." />
  }

  const groups = new Map<string, typeof data>()
  for (const item of data) {
    const arr = groups.get(item.ownerName) ?? []
    arr.push(item)
    groups.set(item.ownerName, arr)
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}><Share2 size={18} /> 공유받은 항목</h1>
      {[...groups.entries()].map(([owner, items]) => (
        <section key={owner} className={styles.section}>
          <h2 className={styles.owner}>{owner}</h2>
          <ul className={styles.list}>
            {items.map((it) => (
              <li key={it.noteId}>
                <button type="button" className={styles.row} onClick={() => navigate(`/shared/${it.noteId}`)}>
                  <span className={styles.title}>{it.title || '제목 없음'}</span>
                  <span className={styles.perm}>{it.permission === 'EDIT' ? '편집' : '보기'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
