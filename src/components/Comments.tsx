import { useState, type FormEvent } from 'react'
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
  const { data: comments, isLoading, isError, error, refetch } = useComments(pageId)
  const createMutation = useCreateComment(pageId)
  const deleteMutation = useDeleteComment(pageId)

  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedAuthor = author.trim()
    const trimmedContent = content.trim()
    if (!trimmedAuthor || !trimmedContent) return

    createMutation.mutate(
      { author: trimmedAuthor, content: trimmedContent },
      {
        onSuccess: () => setContent(''),
      },
    )
  }

  return (
    <section className="comments">
      {title && <h3 className="comments__title">{title}</h3>}

      {isLoading && <p className="comments__status">불러오는 중…</p>}
      {isError && (
        <p className="comments__status comments__status--error">
          댓글을 불러오지 못했습니다. {error instanceof Error ? error.message : ''}{' '}
          <button type="button" onClick={() => refetch()}>
            다시 시도
          </button>
        </p>
      )}

      {comments && comments.length === 0 && (
        <p className="comments__status">아직 댓글이 없습니다.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="comments__list">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              onDelete={() => deleteMutation.mutate(c.id)}
              deleting={deleteMutation.isPending && deleteMutation.variables === c.id}
            />
          ))}
        </ul>
      )}

      <form className="comments__form" onSubmit={handleSubmit}>
        <input
          className="comments__author"
          type="text"
          placeholder="이름"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={32}
          required
        />
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
  onDelete,
  deleting,
}: {
  comment: Comment
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <li className="comments__item">
      <div className="comments__meta">
        <span className="comments__author-name">{comment.author}</span>
        <time className="comments__time" dateTime={comment.createdAt}>
          {formatTime(comment.createdAt)}
        </time>
        <button
          type="button"
          className="comments__delete"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? '삭제 중…' : '삭제'}
        </button>
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
