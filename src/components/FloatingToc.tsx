import { useState, useEffect, useCallback } from 'react'
import './FloatingToc.css'

export interface TocItem {
  id: string
  label: string
  emoji?: string
}

interface FloatingTocProps {
  items: TocItem[]
}

export default function FloatingToc({ items }: FloatingTocProps) {
  const [activeId, setActiveId] = useState('')
  const [open, setOpen] = useState(false)

  // Track active section via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [items])

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setOpen(false)
    }
  }, [])

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <nav className="toc-desktop">
        <div className="toc-title">목차</div>
        <ul className="toc-list">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className={`toc-link ${activeId === item.id ? 'toc-link--active' : ''}`}
                onClick={() => scrollTo(item.id)}
              >
                {item.emoji && <span className="toc-emoji">{item.emoji}</span>}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Mobile: FAB + bottom sheet */}
      <button
        className="toc-fab"
        onClick={() => setOpen(!open)}
        aria-label="목차 열기"
      >
        ☰
      </button>

      {open && (
        <div className="toc-overlay" onClick={() => setOpen(false)}>
          <nav className="toc-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="toc-sheet-header">
              <span className="toc-sheet-title">목차</span>
              <button className="toc-sheet-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <ul className="toc-sheet-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`toc-sheet-link ${activeId === item.id ? 'toc-sheet-link--active' : ''}`}
                    onClick={() => scrollTo(item.id)}
                  >
                    {item.emoji && <span className="toc-emoji">{item.emoji}</span>}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  )
}
