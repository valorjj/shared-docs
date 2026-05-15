import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Clipboard,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Link2Off,
  MousePointer,
  Pencil,
  Scissors,
} from 'lucide-react'
import styles from './EditorContextMenu.module.css'

/**
 * Bear-style custom context menu that fully replaces the browser's
 * default right-click menu inside the editor body. Items are
 * context-aware: clicking on a link offers link actions; clicking
 * inside a text selection offers clipboard + link-insertion actions;
 * clicking on empty content offers paste / select all.
 *
 * The contextmenu event is captured at the editor's container ref —
 * we preventDefault so the OS menu never shows, then render our own
 * portaled menu at the cursor position.
 */
export default function EditorContextMenu({
  containerRef,
  editor,
  onRequestLinkDialog,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  editor: Editor | null
  /** Toolbar's LinkDialog opener — we delegate "편집" / "링크 추가" here. */
  onRequestLinkDialog: () => void
}) {
  const [state, setState] = useState<MenuState | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Open on right-click anywhere inside the editor container.
  useEffect(() => {
    const container = containerRef.current
    if (!container || !editor) return

    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      const href = anchor?.getAttribute('href') ?? null

      // For non-link right-clicks, mirror the editor's selection state.
      const sel = editor.state.selection
      const hasSelection = !anchor && sel.from !== sel.to

      // If user right-clicked on a link without an explicit selection,
      // make sure the cursor lands inside the link so subsequent commands
      // (extendMarkRange) target the right range.
      if (anchor && !hasSelection) {
        // Find the ProseMirror position closest to the click point.
        const view = editor.view
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
        if (pos) {
          editor.commands.focus()
          editor.commands.setTextSelection(pos.pos)
        }
      }

      setState({
        x: e.clientX,
        y: e.clientY,
        kind: anchor ? 'link' : hasSelection ? 'selection' : 'empty',
        href,
      })
    }

    container.addEventListener('contextmenu', onContext)
    return () => container.removeEventListener('contextmenu', onContext)
  }, [containerRef, editor])

  // Close on outside click / scroll / Escape.
  useEffect(() => {
    if (!state) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      setState(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState(null)
    }
    const onScroll = () => setState(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [state])

  // Clamp the menu into the viewport after it renders so it never
  // gets clipped at the right edge or bottom on narrow viewports.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el || !state) return
    const PAD = 8
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.min(state.x, window.innerWidth - w - PAD)
    const top = Math.min(state.y, window.innerHeight - h - PAD)
    el.style.left = `${Math.max(PAD, left)}px`
    el.style.top = `${Math.max(PAD, top)}px`
    el.style.visibility = 'visible'
  }, [state])

  const close = useCallback(() => setState(null), [])

  if (!state || !editor) return null

  // ── command builders ───────────────────────────────────────────────
  const openLink = () => {
    if (state.href) window.open(state.href, '_blank', 'noopener,noreferrer')
    close()
  }
  const copyLinkUrl = async () => {
    if (state.href) await navigator.clipboard.writeText(state.href).catch(() => {})
    close()
  }
  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    close()
  }
  const editLink = () => {
    onRequestLinkDialog()
    close()
  }
  const copySelection = async () => {
    const text = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      '\n',
    )
    if (text) await navigator.clipboard.writeText(text).catch(() => {})
    close()
  }
  const cutSelection = async () => {
    const text = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      '\n',
    )
    if (text) await navigator.clipboard.writeText(text).catch(() => {})
    editor.chain().focus().deleteSelection().run()
    close()
  }
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) editor.chain().focus().insertContent(text).run()
    } catch {
      // The browser refused — usually because the document doesn't have
      // focus or the clipboard-read permission was denied. Silent fail.
    }
    close()
  }
  const selectAll = () => {
    editor.chain().focus().selectAll().run()
    close()
  }

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      style={{ visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {state.kind === 'link' && (
        <>
          <MenuItem icon={<ExternalLink size={14} />} label="새 탭에서 열기" onSelect={openLink} />
          <MenuItem icon={<Pencil size={14} />} label="링크 편집" onSelect={editLink} />
          <MenuItem icon={<Copy size={14} />} label="URL 복사" onSelect={copyLinkUrl} />
          <Separator />
          <MenuItem
            icon={<Link2Off size={14} />}
            label="링크 제거"
            destructive
            onSelect={removeLink}
          />
        </>
      )}

      {state.kind === 'selection' && (
        <>
          <MenuItem icon={<Copy size={14} />} label="복사" onSelect={copySelection} />
          <MenuItem icon={<Scissors size={14} />} label="잘라내기" onSelect={cutSelection} />
          <MenuItem icon={<Clipboard size={14} />} label="붙여넣기" onSelect={pasteFromClipboard} />
          <Separator />
          <MenuItem icon={<LinkIcon size={14} />} label="링크 추가" onSelect={editLink} />
          <MenuItem icon={<MousePointer size={14} />} label="모두 선택" onSelect={selectAll} />
        </>
      )}

      {state.kind === 'empty' && (
        <>
          <MenuItem icon={<Clipboard size={14} />} label="붙여넣기" onSelect={pasteFromClipboard} />
          <MenuItem icon={<MousePointer size={14} />} label="모두 선택" onSelect={selectAll} />
        </>
      )}
    </div>,
    document.body,
  )
}

type MenuState = {
  x: number
  y: number
  kind: 'link' | 'selection' | 'empty'
  href: string | null
}

function MenuItem({
  icon,
  label,
  onSelect,
  destructive = false,
}: {
  icon: React.ReactNode
  label: string
  onSelect: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`${styles.item}${destructive ? ` ${styles.destructive}` : ''}`}
      onMouseDown={(e) => {
        // Prevent stealing focus from the editor so editor commands run
        // on the same selection that was active when the menu opened.
        e.preventDefault()
        onSelect()
      }}
    >
      <span className={styles.itemIcon} aria-hidden="true">{icon}</span>
      <span className={styles.itemLabel}>{label}</span>
    </button>
  )
}

function Separator() {
  return <div className={styles.separator} role="separator" aria-hidden="true" />
}
