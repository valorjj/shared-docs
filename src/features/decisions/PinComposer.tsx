import { useState } from 'react'
import { Button } from '../../components/ui'
import styles from './PinComposer.module.css'

type Props = {
  screenX: number
  screenY: number
  busy: boolean
  onSubmit: (content: string) => void
  onCancel: () => void
}

export default function PinComposer({ screenX, screenY, busy, onSubmit, onCancel }: Props) {
  const [content, setContent] = useState('')
  return (
    <div className={styles.popover} style={{ transform: `translate(${screenX}px, ${screenY}px)` }}>
      <textarea
        className={styles.input}
        autoFocus
        placeholder="댓글을 입력하세요"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
      />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        <Button size="sm" disabled={busy || !content.trim()} onClick={() => onSubmit(content.trim())}>등록</Button>
      </div>
    </div>
  )
}
