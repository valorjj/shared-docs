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
    // Capture phase on window: fires before Panel's bubble-phase `document`
    // listener, so stopPropagation() here keeps Esc from also closing an
    // ancestor Panel underneath this lightbox.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
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
