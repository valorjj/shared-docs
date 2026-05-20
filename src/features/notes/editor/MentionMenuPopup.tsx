import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Cake,
  ChefHat,
  CreditCard,
  FileText,
  Link2,
  Sheet,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react'
import { apiClient } from '../../../api/client'
import type {
  MentionItem,
  MentionKeyHandler,
  MentionState,
} from './extensions/MentionCommand'
import type { EntityKind } from './extensions/EntityLink'
import styles from './MentionMenuPopup.module.css'

type Props = {
  state: MentionState
  keyHandlerRef: { current: MentionKeyHandler | null }
  /** Excluded from the result list — a memo can't `@`-mention itself. */
  currentNoteId: number | null
}

const SEARCH_DEBOUNCE_MS = 180
const PER_KIND = 6

export default function MentionMenuPopup({
  state,
  keyHandlerRef,
  currentNoteId,
}: Props) {
  const [selected, setSelected] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedRef = useRef(selected)
  useEffect(() => { selectedRef.current = selected }, [selected])

  // Debounce the suggestion query before hitting the backend. ~180ms is
  // fast enough to feel "live" but stops mid-typing requests from piling up.
  const [debouncedQuery, setDebouncedQuery] = useState(state.query)
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(state.query), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [state.query])

  const trimmed = debouncedQuery.trim()
  const queryEnabled = trimmed.length > 0

  const { data: rawHits } = useQuery({
    queryKey: ['mention-search', trimmed, PER_KIND],
    queryFn: async () => {
      const { data } = await apiClient.get<MentionItem[]>('/api/search/entities', {
        params: { q: trimmed, perKind: PER_KIND },
      })
      return data
    },
    enabled: queryEnabled,
    staleTime: 30 * 1000,
    retry: false,
  })

  const items: MentionItem[] = useMemo(() => {
    if (!queryEnabled) return []
    return (rawHits ?? []).filter(
      (h) => !(h.kind === 'note' && currentNoteId != null && h.id === currentNoteId),
    )
  }, [rawHits, queryEnabled, currentNoteId])

  const safeSelected =
    items.length === 0 ? 0 : Math.min(selected, items.length - 1)
  const itemsRef = useRef<MentionItem[]>(items)
  useEffect(() => { itemsRef.current = items }, [items])
  // Mirror `state` into a ref so the keyboard handler can reach the
  // latest `state.command` without re-installing on every keystroke.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useLayoutEffect(() => {
    const el = containerRef.current
    const rect = state.clientRect?.()
    if (!el || !rect) return
    const PAD = 8
    const popupHeight = el.offsetHeight || 220
    const popupWidth = el.offsetWidth || 260
    const placeAbove = rect.bottom + popupHeight + PAD > window.innerHeight
    const top = placeAbove ? rect.top - popupHeight - 6 : rect.bottom + 6
    const maxLeft = window.innerWidth - popupWidth - PAD
    const left = Math.max(PAD, Math.min(rect.left, maxLeft))
    el.style.top = `${Math.max(PAD, top)}px`
    el.style.left = `${left}px`
    el.style.visibility = 'visible'
  }, [state, safeSelected, items])

  // Install the keyboard handler once. Reading via refs avoids
  // re-installing on every keystroke — the previous pattern had a
  // cleanup→reinstall window per render that, under React 19, could
  // race ProseMirror's keydown read and leave the ref briefly null.
  useEffect(() => {
    const handler: MentionKeyHandler = (event) => {
      const list = itemsRef.current
      if (list.length === 0) {
        if (event.key === 'Escape') return true
        return false
      }
      if (event.key === 'ArrowDown') {
        setSelected((s) => (s + 1) % list.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setSelected((s) => (s - 1 + list.length) % list.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const idx = Math.min(selectedRef.current, list.length - 1)
        const picked = list[idx] ?? list[0]
        if (picked) stateRef.current.command(picked)
        return true
      }
      if (event.key === 'Escape') return true
      return false
    }
    keyHandlerRef.current = handler
    return () => {
      if (keyHandlerRef.current === handler) keyHandlerRef.current = null
    }
  }, [keyHandlerRef])

  if (!queryEnabled) {
    return createPortal(
      <div ref={containerRef} className={styles.popup} role="listbox">
        <div className={styles.empty}>검색어를 입력하세요</div>
      </div>,
      document.body,
    )
  }

  if (items.length === 0) {
    return createPortal(
      <div ref={containerRef} className={styles.popup} role="listbox">
        <div className={styles.empty}>일치하는 항목이 없어요</div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div ref={containerRef} className={styles.popup} role="listbox">
      {items.map((item, i) => {
        const Icon = iconFor(item.kind)
        return (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            role="option"
            aria-selected={i === safeSelected}
            className={`${styles.item}${i === safeSelected ? ` ${styles.active}` : ''}`}
            onMouseEnter={() => setSelected(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              state.command(item)
            }}
          >
            <span className={styles.icon} aria-hidden="true">
              <Icon size={14} strokeWidth={1.75} />
            </span>
            <span className={styles.label}>{item.title}</span>
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

function iconFor(kind: EntityKind): LucideIcon {
  switch (kind) {
    case 'note': return FileText
    case 'sheet': return Sheet
    case 'purchase': return CreditCard
    case 'todo': return SquareCheck
    case 'anniversary': return Cake
    case 'recipe': return ChefHat
    case 'link': return Link2
  }
}
