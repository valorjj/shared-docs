import { Link, useParams, useSearchParams } from 'react-router-dom'
import { usePublicNote } from '../features/share/api'
import { Spinner } from '../components/ui'
import styles from './GuestViewer.module.css'

const KIND_LABEL: Record<string, string> = {
  notes: '메모',
}

/**
 * Public read-only view of a shared note. Mounted at `/share/:kind/:id`
 * outside the `RequireAuth` wrapper — no login required as long as the
 * URL carries a valid `?t=<token>`.
 *
 * The body is rendered via `dangerouslySetInnerHTML` rather than mounted
 * into a Tiptap editor. Two reasons: (1) the body is already complete
 * Tiptap-serialized HTML, so a static div renders it correctly without
 * the Tiptap bundle joining the guest chunk; (2) editor extensions
 * (mention chips, slash menu, data snapshots) need React + Tanstack
 * cache that we'd have to wire for anonymous callers — a footgun.
 *
 * Owner-trust assumption: the HTML produced by the owner's editor is
 * treated as safe (Tiptap doesn't emit script/iframe tags). If a
 * compromised owner's note ever poses an XSS risk to public readers,
 * the fix is at the source (DOMPurify before render) — flagged in
 * blueprint §10 "decide-later".
 */
export default function GuestViewer() {
  const { kind, id } = useParams<{ kind: string; id: string }>()
  const [params] = useSearchParams()
  const token = params.get('t')
  const numericId = id ? Number(id) : null

  const knownKind = kind === 'notes'
  const noteId = knownKind ? numericId : null
  const noteQuery = usePublicNote(noteId, token)

  if (!knownKind) {
    return <GuestError title="지원되지 않는 공유" message="현재 메모만 공개 링크로 공유할 수 있습니다." />
  }
  if (!token || numericId === null || Number.isNaN(numericId)) {
    return <GuestError title="잘못된 링크" message="공유 링크가 올바르지 않습니다." />
  }

  if (noteQuery.isLoading) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Spinner label="불러오는 중…" />
      </div>
    )
  }

  if (noteQuery.isError || !noteQuery.data) {
    return (
      <GuestError
        title="공유가 만료되었거나 잘못된 링크"
        message="이 링크는 더 이상 유효하지 않습니다. 원본 작성자에게 다시 요청해 주세요."
      />
    )
  }

  const note = noteQuery.data
  const updated = new Date(note.updatedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className={styles.root}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>{note.title ?? '제목 없음'}</h1>
          <p className={styles.meta}>
            <span>{note.createdBy.name}</span>
            <span aria-hidden="true">·</span>
            <span>{updated}</span>
            <span aria-hidden="true">·</span>
            <span className={styles.kindBadge}>{KIND_LABEL[kind ?? ''] ?? '문서'}</span>
          </p>
        </header>

        <div
          className={styles.body}
          // See file docstring for the owner-trust justification.
          dangerouslySetInnerHTML={{ __html: note.body }}
        />

        <footer className={styles.footer}>
          <span className={styles.wordmark}>공유 문서</span>
          <Link to="/login" className={styles.cta}>
            나도 만들어보기 →
          </Link>
        </footer>
      </article>
    </div>
  )
}

function GuestError({ title, message }: { title: string; message: string }) {
  return (
    <div className={styles.root}>
      <div className={styles.errorBox}>
        <h1 className={styles.errorTitle}>{title}</h1>
        <p className={styles.errorBody}>{message}</p>
        <Link to="/login" className={styles.cta}>
          공유 문서 시작하기 →
        </Link>
      </div>
    </div>
  )
}
