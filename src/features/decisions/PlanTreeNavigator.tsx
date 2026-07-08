import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTree, X } from 'lucide-react'
import { IconButton } from '../../components/ui'
import type { PlanHierarchy, PlanHierarchyNode } from './types'
import styles from './PlanTreeNavigator.module.css'

type Props = { hierarchy: PlanHierarchy; currentId: number }

const MAX_INDENT_DEPTH = 4

/** Floating tree navigator — the whole decision tree from the root ancestor,
 *  current node highlighted, click to jump. Collapsed to a floating button. */
export default function PlanTreeNavigator({ hierarchy, currentId }: Props) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  if (hierarchy.nodes.length <= 1) return null

  const byParent = new Map<number | null, PlanHierarchyNode[]>()
  hierarchy.nodes.forEach((n) => {
    const key = n.id === hierarchy.rootId ? null : n.parentPlanId
    byParent.set(key, [...(byParent.get(key) ?? []), n])
  })

  const renderNode = (node: PlanHierarchyNode, depth: number): ReactElement => (
    <li key={node.id}>
      <button
        type="button"
        className={`${styles.node}${node.id === currentId ? ' ' + styles.current : ''}`}
        style={{ paddingLeft: `${Math.min(depth, MAX_INDENT_DEPTH) * 14 + 10}px` }}
        onClick={() => {
          if (node.id !== currentId) {
            navigate(`/decisions/${node.id}`)
            setOpen(false)
          }
        }}
      >
        <span
          className={`${styles.dot} ${node.status === 'COMPLETED' ? styles.dotDone : styles.dotActive}`}
          aria-hidden
        />
        <span className={styles.nodeTitle}>
          {depth > MAX_INDENT_DEPTH ? '› ' : ''}
          {node.title}
        </span>
      </button>
      {(byParent.get(node.id) ?? []).length > 0 && (
        <ul className={styles.children}>
          {(byParent.get(node.id) ?? []).map((c) => renderNode(c, depth + 1))}
        </ul>
      )}
    </li>
  )

  const root = hierarchy.nodes.find((n) => n.id === hierarchy.rootId)
  if (!root) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          className={styles.toggle}
          aria-label="결정 트리 열기"
          onClick={() => setOpen(true)}
        >
          <ListTree size={18} aria-hidden />
        </button>
      )}
      {open && (
        <div className={styles.panel} role="navigation" aria-label="결정 트리">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>결정 트리</span>
            <IconButton variant="ghost" size="sm" label="닫기" onClick={() => setOpen(false)}>
              <X size={14} />
            </IconButton>
          </div>
          <ul className={styles.tree}>{renderNode(root, 0)}</ul>
        </div>
      )}
    </>
  )
}
