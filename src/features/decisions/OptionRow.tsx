import { useState, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight, Check, Vote, ListChecks, MoreHorizontal, Paperclip } from 'lucide-react'
import { IconButton, ContextMenu, ContextMenuItem, useContextMenu } from '../../components/ui'
import Comments from '../../components/Comments'
import ProConSection from './ProConSection'
import OptionResourceSection from './OptionResourceSection'
import styles from './OptionRow.module.css'
import type { OptionNode } from './types'

type Props = {
  option: OptionNode
  myUserId: number
  isChosen: boolean
  decided: boolean
  nameOf: (userId: number) => string
  busy?: boolean
  locked?: boolean
  onEdit: () => void
  onDelete: () => void
  onVote: () => void
  onRetractVote: () => void
}

export default function OptionRow({
  option, myUserId, isChosen, decided, nameOf, busy, locked, onEdit, onDelete, onVote, onRetractVote,
}: Props) {
  const [open, setOpen] = useState(false)
  const iVoted = option.voterUserIds.includes(myUserId)
  const frozen = !!locked || decided
  const menu = useContextMenu()

  // ⋯ opens the same menu as right-click; anchor to the button's rect so
  // keyboard activation works too (mirrors SubPlanCard).
  const openMenuFromButton = (e: MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    menu.openAt(r.right, r.bottom)
  }

  return (
    <div className={isChosen ? `${styles.row} ${styles.rowChosen}` : styles.row}>
      {/* triggerProps on the head only — right-click inside the expanded body
          (comment box, pro/con inputs) stays native. */}
      <div className={styles.head} {...(locked ? {} : menu.triggerProps)}>
        <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={styles.title}>{option.title}</span>
          {isChosen && <Check size={14} className={styles.chosenMark} aria-label="결정됨" />}
        </button>
        {option.proCons.length > 0 && (
          <span className={styles.proConCount}>
            <ListChecks size={13} /> 장단점 {option.proCons.length}
          </span>
        )}
        {option.resources.length > 0 && (
          <span className={styles.proConCount}>
            <Paperclip size={13} /> 자료 {option.resources.length}
          </span>
        )}
        <button
          type="button"
          className={iVoted ? `${styles.vote} ${styles.voteOn}` : styles.vote}
          disabled={busy || frozen}
          aria-pressed={iVoted}
          aria-label={iVoted ? '투표 취소' : '투표'}
          title={iVoted ? '투표 취소' : '투표'}
          onClick={() => (iVoted ? onRetractVote() : onVote())}
        >
          <Vote size={13} />
          {option.voterUserIds.length > 0 && <span>{option.voterUserIds.length}</span>}
        </button>
        {!locked && (
          <div className={styles.actions}>
            <IconButton variant="ghost" size="sm" label="선택지 메뉴" onClick={openMenuFromButton}>
              <MoreHorizontal size={16} />
            </IconButton>
          </div>
        )}
      </div>

      {!locked && (
        <ContextMenu open={menu.open} position={menu.position} onClose={menu.close}>
          <ContextMenuItem onSelect={() => { menu.close(); onEdit() }}>수정</ContextMenuItem>
          <ContextMenuItem danger onSelect={() => { menu.close(); onDelete() }}>삭제</ContextMenuItem>
        </ContextMenu>
      )}

      {open && (
        <div className={styles.body}>
          {option.description && <p className={styles.desc}>{option.description}</p>}
          <OptionResourceSection optionId={option.id} resources={option.resources} />
          <ProConSection optionId={option.id} proCons={option.proCons} locked={!!locked} />
          {option.voterUserIds.length > 0 && (
            <p className={styles.voters}>투표: {option.voterUserIds.map(nameOf).join(', ')}</p>
          )}
          <div className={styles.commentsSection}>
            <Comments pageId={`option:${option.id}`} />
          </div>
        </div>
      )}
    </div>
  )
}
