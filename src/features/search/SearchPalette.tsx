import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Pin, Search, Table2 } from 'lucide-react'
import { Kbd } from '../../components/ui'
import { useSearchResults, type SearchResult } from './useSearchResults'
import styles from './SearchPalette.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SearchPalette({ open, onOpenChange }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.srOnly}>검색</Dialog.Title>
          {open && <SearchBody onClose={() => onOpenChange(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const { results, isLoading } = useSearchResults(query)

  // Clamp active when results shrink below it (e.g. user typed and the
  // result list got shorter). Derived in render — no setState-in-effect.
  const safeActive = Math.min(active, Math.max(0, results.length - 1))

  // Scroll the active row into view on arrow navigation. Side-effect only,
  // no state change.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-search-idx="${safeActive}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [safeActive])

  const choose = (r: SearchResult) => {
    onClose()
    if (r.kind === 'note') {
      navigate(`/?note=${r.id}`)
    } else {
      navigate(`/sheets?sheet=${r.id}`)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(Math.min(safeActive + 1, Math.max(0, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(0, safeActive - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[safeActive]
      if (r) choose(r)
    }
  }

  return (
    <div className={styles.body} onKeyDown={onKeyDown}>
      <div className={styles.inputRow}>
        <Search className={styles.inputIcon} size={16} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          autoFocus
          type="text"
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          placeholder="메모와 시트를 검색하세요…"
          aria-label="검색어"
        />
        <Kbd>Esc</Kbd>
      </div>

      <div className={styles.resultsWrap}>
        {query.trim() === '' ? (
          <EmptyHint />
        ) : isLoading ? (
          <div className={styles.statusRow}>불러오는 중…</div>
        ) : results.length === 0 ? (
          <div className={styles.statusRow}>검색 결과가 없습니다.</div>
        ) : (
          <ul ref={listRef} className={styles.results} role="listbox">
            {results.map((r, i) => (
              <li
                key={`${r.kind}-${r.id}`}
                data-search-idx={i}
                className={`${styles.result}${i === active ? ` ${styles.resultActive}` : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(r)}
                role="option"
                aria-selected={i === active}
              >
                <ResultRow result={r} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className={styles.footer}>
        <span className={styles.hint}><Kbd>↑</Kbd><Kbd>↓</Kbd> 이동</span>
        <span className={styles.hint}><Kbd>Enter</Kbd> 열기</span>
        <span className={styles.hint}><Kbd>Esc</Kbd> 닫기</span>
        <span className={styles.hintRight}>
          {results.length > 0 && `${results.length}개 결과`}
        </span>
      </footer>
    </div>
  )
}

function ResultRow({ result }: { result: SearchResult }) {
  const Icon = result.kind === 'note' ? BookOpen : Table2
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>
          {result.pinned && (
            <Pin size={11} strokeWidth={2} className={styles.rowPin} aria-hidden="true" />
          )}
          <span>{result.title}</span>
        </div>
        {result.snippet && (
          <div className={styles.rowSnippet}>{result.snippet}</div>
        )}
      </div>
      <span className={styles.rowKind}>
        {result.kind === 'note' ? '메모' : '시트'}
        {result.kind === 'note' && result.matchedField === 'body' && ' · 본문'}
      </span>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className={styles.empty}>
      <p>메모 제목/본문, 시트 제목을 한 곳에서 검색해요.</p>
      <p className={styles.emptyHint}>
        <Kbd>⌘</Kbd><Kbd>K</Kbd> 로 어디서든 열 수 있어요.
      </p>
    </div>
  )
}
