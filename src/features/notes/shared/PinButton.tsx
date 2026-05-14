import { Pin, PinOff } from 'lucide-react'
import styles from './PinButton.module.css'

type Props = {
  pinned: boolean
  onToggle: () => void
  size?: number
}

export default function PinButton({ pinned, onToggle, size = 16 }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btn}${pinned ? ` ${styles.active}` : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-pressed={pinned}
      aria-label={pinned ? '고정 해제' : '메모 고정'}
      title={pinned ? '고정 해제' : '메모 고정'}
    >
      {pinned ? <Pin size={size} strokeWidth={2} /> : <PinOff size={size} strokeWidth={1.75} />}
    </button>
  )
}
