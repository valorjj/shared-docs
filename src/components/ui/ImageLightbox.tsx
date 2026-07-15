import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap } from './useFocusTrap'
import styles from './ImageLightbox.module.css'

type Props = { src: string; alt: string; onClose: () => void }

/** Full-size image overlay. Closes on Esc / backdrop / close button. */
export default function ImageLightbox({ src, alt, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
    >
      <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
        <X size={20} />
      </button>
      <img className={styles.image} src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  )
}
