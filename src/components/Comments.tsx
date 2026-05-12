import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  type Comment,
} from '../api/comments'
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

      {isLoading && <p className="comments__status">불러오는 중…</p>}
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
            const canDelete =
              (c.author.userId != null && c.author.userId === user?.userId) || isAdmin
            return (
              <CommentRow
                key={c.id}
                comment={c}
                canDelete={canDelete}
                onDelete={() => deleteMutation.mutate(c.id)}
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
  canDelete,
  onDelete,
  deleting,
}: {
  comment: Comment
  canDelete: boolean
  onDelete: () => void
  deleting: boolean
}) {
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
        </time>
        {canDelete && (
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
      <p className="comments__body">{comment.content}</p>
    </li>
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
