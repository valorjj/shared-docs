import { Button } from '../../components/ui'
import Comments from '../../components/Comments'
import { useSetCommentPinResolved, useDeleteCommentPin } from './api'
import type { CommentPin } from './types'

export default function CommentPinPanel({ pin, onDeleted }: { pin: CommentPin; onDeleted: () => void }) {
  const setResolved = useSetCommentPinResolved()
  const del = useDeleteCommentPin()

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResolved.mutate({ id: pin.id, resolved: !pin.resolved })}
        >
          {pin.resolved ? '다시 열기' : '해결'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm('이 댓글 핀을 삭제할까요?')) {
              del.mutate(pin.id, { onSuccess: onDeleted })
            }
          }}
        >
          삭제
        </Button>
      </div>
      <Comments pageId={`pin:${pin.id}`} />
    </div>
  )
}
