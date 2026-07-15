import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { Check, Vote, ListChecks, Paperclip } from 'lucide-react'
import styles from './OptionCanvasNode.module.css'
import type { OptionNode } from './types'

export type OptionCanvasNodeData = { option: OptionNode; chosen: boolean; dimmed: boolean }
export type OptionCanvasNodeType = Node<OptionCanvasNodeData, 'option'>

export default function OptionCanvasNode({ data }: NodeProps<OptionCanvasNodeType>) {
  const { option, chosen, dimmed } = data
  const cls = [styles.node, chosen ? styles.chosen : '', dimmed ? styles.dimmed : ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
      {/* ownership in (from its 안건) on the left; flow out (to a downstream 안건) on the right */}
      <Handle type="target" position={Position.Left} className={styles.handle} isConnectable={false} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <div className={styles.head}>
        {chosen && <Check size={13} className={styles.check} aria-label="결정됨" />}
        <span className={styles.title}>{option.title}</span>
      </div>
      {(option.voterUserIds.length > 0 || option.proCons.length > 0 || option.resources.length > 0) && (
        <div className={styles.meta}>
          {option.voterUserIds.length > 0 && (
            <span className={styles.metaItem}><Vote size={12} /> {option.voterUserIds.length}</span>
          )}
          {option.proCons.length > 0 && (
            <span className={styles.metaItem}><ListChecks size={12} /> {option.proCons.length}</span>
          )}
          {option.resources.length > 0 && (
            <span className={styles.metaItem}><Paperclip size={12} /> {option.resources.length}</span>
          )}
        </div>
      )}
    </div>
  )
}
