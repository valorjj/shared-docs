import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import {
  dispatchSearch,
  getSearchState,
  NoteSearchPluginKey,
} from './extensions/NoteSearch'
import styles from './NoteSearchBar.module.css'

type Props = {
  editor: Editor | null
  open: boolean
  onClose: () => void
}

/**
 * Floating search bar that pins to the top of the note editor. Driven
 * entirely by the `NoteSearch` Tiptap plugin — this component just
 * dispatches meta-tagged transactions and reads the resulting state
 * (matches, activeIndex). Enter / Shift+Enter cycle; Escape closes.
 */
export default function NoteSearchBar({ editor, open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Push initial query whenever the bar (re-)opens. Also focus the
  // input so the user can just type. Closing the bar clears the
  // search so the highlights vanish.
  useLayoutEffect(() => {
    if (!editor) return
    if (open) {
      inputRef.current?.focus()
      inputRef.current?.select()
    } else {
      dispatchSearch(editor.state, editor.view.dispatch, { query: '' })
      setQuery('')
      setMatchCount(0)
      setActiveIndex(0)
    }
  }, [open, editor])

  // Subscribe to editor transactions so the bar's match count updates
  // when the user edits the doc while the bar is open.
  useEffect(() => {
    if (!editor || !open) return
    const update = () => {
      const s = getSearchState(editor.state)
      if (!s) return
      setMatchCount(s.matches.length)
      setActiveIndex(s.activeIndex)
    }
    editor.on('transaction', update)
    update()
    return () => {
      editor.off('transaction', update)
    }
  }, [editor, open])

  // Scroll the active match into view whenever it changes.
  useEffect(() => {
    if (!editor || !open) return
    const s = getSearchState(editor.state)
    if (!s || s.matches.length === 0) return
    const match = s.matches[s.activeIndex]
    if (!match) return
    // Use the DOM coords of the match's position and scroll into view.
    const dom = editor.view.domAtPos(match.from)
    const el =
      dom.node instanceof Element ? dom.node : (dom.node.parentElement as HTMLElement | null)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex, editor, open])

  if (!open || !editor) return null

  const setQ = (v: string) => {
    setQuery(v)
    // New search → start at the first match.
    dispatchSearch(editor.state, editor.view.dispatch, { query: v, activeIndex: 0 })
  }

  const next = () => {
    if (matchCount === 0) return
    const i = (activeIndex + 1) % matchCount
    dispatchSearch(editor.state, editor.view.dispatch, { activeIndex: i })
  }
  const prev = () => {
    if (matchCount === 0) return
    const i = (activeIndex - 1 + matchCount) % matchCount
    dispatchSearch(editor.state, editor.view.dispatch, { activeIndex: i })
  }

  const counter = matchCount === 0
    ? query ? '0' : ''
    : `${activeIndex + 1} / ${matchCount}`

  return (
    <div className={styles.bar} role="search" aria-label="메모 안에서 검색">
      <input
        ref={inputRef}
        type="text"
        className={styles.input}
        placeholder="메모 안에서 검색"
        value={query}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) prev()
            else next()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
        aria-label="검색어"
      />
      <span className={styles.counter} aria-live="polite">{counter}</span>
      <button
        type="button"
        className={styles.btn}
        onClick={prev}
        disabled={matchCount === 0}
        aria-label="이전 결과"
        title="이전 (Shift+Enter)"
      >
        <ChevronUp size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={next}
        disabled={matchCount === 0}
        aria-label="다음 결과"
        title="다음 (Enter)"
      >
        <ChevronDown size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onClose}
        aria-label="검색 닫기"
        title="닫기 (Esc)"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

// Re-export so consumers don't need a second import path.
export { NoteSearchPluginKey }
