import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { MessageCircle } from 'lucide-react'
import type { CommentPin } from './types'
import styles from './CommentPinNode.module.css'

export type CommentPinNodeType = Node<{ pin: CommentPin }, 'pin'>

function CommentPinNodeImpl({ data }: NodeProps<CommentPinNodeType>) {
  const { pin } = data
  return (
    <div className={`${styles.pin}${pin.resolved ? ' ' + styles.resolved : ''}`} title={pin.resolved ? '해결된 댓글' : '댓글'}>
      <Handle type="target" position={Position.Left} isConnectable={false} className={styles.hidden} />
      <MessageCircle size={14} aria-hidden="true" />
      <span className={styles.count}>{pin.commentCount}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className={styles.hidden} />
    </div>
  )
}
export default memo(CommentPinNodeImpl)
