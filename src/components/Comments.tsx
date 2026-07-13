import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  type Comment,
} from '../api/comments'
import { Spinner } from './ui'
import './Comments.css'

type CommentsProps = {
  pageId: string
  title?: string
}

export default function Comments({ pageId, title = '댓글' }: CommentsProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data: comments, isLoading, isError, error, refetch } = useComments(pageId)
  const createMutation = useCreateComment(pageId)
  const updateMutation = useUpdateComment(pageId)
  const deleteMutation = useDeleteComment(pageId)

  const [content, setContent] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return

    createMutation.mutate(
      { content: trimmed },
      { onSuccess: () => setContent('') },
    )
  }

  return (
    <section className="comments">
      {title && <h3 className="comments__title">{title}</h3>}

      {isLoading && (
        <p className="comments__status">
          <Spinner label="불러오는 중…" />
        </p>
      )}
      {isError && (
        <p className="comments__status comments__status--error">
          댓글을 불러오지 못했습니다. {error instanceof Error ? error.message : ''}{' '}
          <button type="button" onClick={() => refetch()}>다시 시도</button>
        </p>
      )}

      {comments && comments.length === 0 && (
        <p className="comments__status">아직 댓글이 없습니다.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="comments__list">
          {comments.map((c) => {
            const isAuthor = c.author.userId != null && c.author.userId === user?.userId
            return (
              <CommentRow
                key={c.id}
                comment={c}
                canEdit={isAuthor}
                canDelete={isAuthor || isAdmin}
                onUpdate={(content, onSuccess) => updateMutation.mutate({ id: c.id, content }, { onSuccess })}
                onDelete={() => deleteMutation.mutate(c.id)}
                updating={updateMutation.isPending && updateMutation.variables?.id === c.id}
                deleting={deleteMutation.isPending && deleteMutation.variables === c.id}
              />
            )
          })}
        </ul>
      )}

      <form className="comments__form" onSubmit={handleSubmit}>
        {user && (
          <div className="comments__me">
            {user.pictureUrl ? (
              <img className="comments__me-avatar" src={user.pictureUrl} alt="" />
            ) : (
              <span className="comments__me-avatar comments__me-avatar--initial">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="comments__me-name">{user.name}으로 댓글 남기기</span>
          </div>
        )}
        <textarea
          className="comments__content"
          placeholder="댓글을 입력하세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={3}
          required
        />
        <button
          type="submit"
          className="comments__submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? '등록 중…' : '댓글 등록'}
        </button>
        {createMutation.isError && (
          <p className="comments__status comments__status--error">
            등록 실패:{' '}
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : '알 수 없는 오류'}
          </p>
        )}
      </form>
    </section>
  )
}

function CommentRow({
  comment,
  canEdit,
  canDelete,
  onUpdate,
  onDelete,
  updating,
  deleting,
}: {
  comment: Comment
  canEdit: boolean
  canDelete: boolean
  onUpdate: (content: string, onSuccess: () => void) => void
  onDelete: () => void
  updating: boolean
  deleting: boolean
}) {
  const [editing, setEditing] = useState(false)

  const edited = comment.updatedAt !== comment.createdAt

  return (
    <li className="comments__item">
      <div className="comments__meta">
        {comment.author.pictureUrl ? (
          <img className="comments__avatar" src={comment.author.pictureUrl} alt="" />
        ) : (
          <span className="comments__avatar comments__avatar--initial">
            {comment.author.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="comments__author-name">{comment.author.name}</span>
        <time className="comments__time" dateTime={comment.createdAt}>
          {formatTime(comment.createdAt)}
          {edited && ' (수정됨)'}
        </time>
        {canEdit && !editing && (
          <button type="button" className="comments__edit" onClick={() => setEditing(true)}>
            수정
          </button>
        )}
        {canDelete && !editing && (
          <button
            type="button"
            className="comments__delete"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? '삭제 중…' : '삭제'}
          </button>
        )}
      </div>
      {editing ? (
        <CommentEditor
          initial={comment.content}
          busy={updating}
          onCancel={() => setEditing(false)}
          onSave={(content) => onUpdate(content, () => setEditing(false))}
        />
      ) : (
        <p className="comments__body">{comment.content}</p>
      )}
    </li>
  )
}

function CommentEditor({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial: string
  busy: boolean
  onCancel: () => void
  onSave: (content: string) => void
}) {
  const [draft, setDraft] = useState(initial)
  const trimmed = draft.trim()
  const dirty = trimmed !== initial.trim()

  const handleSave = () => {
    if (!trimmed || !dirty) {
      onCancel()
      return
    }
    onSave(trimmed)
  }

  return (
    <div className="comments__edit-form">
      <textarea
        className="comments__content"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        rows={3}
        autoFocus
      />
      <div className="comments__edit-actions">
        <button type="button" className="comments__edit-cancel" onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button
          type="button"
          className="comments__submit"
          onClick={handleSave}
          disabled={busy || !trimmed}
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
