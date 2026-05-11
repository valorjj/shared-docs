import { useEffect, useState } from 'react'
import Comments from './Comments'
import { useComments } from '../api/comments'
import './CommentsFab.css'

type CommentsFabProps = {
  pageId: string
}

export default function CommentsFab({ pageId }: CommentsFabProps) {
  const [open, setOpen] = useState(false)
  const { data: comments } = useComments(pageId)
  const count = comments?.length ?? 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="comments-fab"
        onClick={() => setOpen(true)}
        aria-label={`댓글 열기${count > 0 ? ` (${count}개)` : ''}`}
      >
        <span className="comments-fab__icon" aria-hidden="true">💬</span>
        {count > 0 && <span className="comments-fab__badge">{count}</span>}
      </button>

      <div
        className={`comments-drawer-backdrop ${open ? 'is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        className={`comments-drawer ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="댓글"
        aria-hidden={!open}
      >
        <header className="comments-drawer__header">
          <h2 className="comments-drawer__title">댓글{count > 0 ? ` (${count})` : ''}</h2>
          <button
            type="button"
            className="comments-drawer__close"
            onClick={() => setOpen(false)}
            aria-label="댓글 닫기"
          >
            ✕
          </button>
        </header>
        <div className="comments-drawer__body">
          <Comments pageId={pageId} title="" />
        </div>
      </aside>
    </>
  )
}
