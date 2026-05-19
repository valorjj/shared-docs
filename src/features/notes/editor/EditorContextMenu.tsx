import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Clipboard,
  Combine,
  Copy,
  ExternalLink,
  Heading,
  Link as LinkIcon,
  Link2Off,
  MousePointer,
  Pencil,
  Rows,
  Scissors,
  Trash2,
  X,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from '../../../components/ui'

type MenuState = {
  x: number
  y: number
  kind: 'link' | 'selection' | 'empty' | 'table'
  href: string | null
}

/**
 * Bear-style custom context menu that fully replaces the browser's
 * default right-click menu inside the editor body. Items are
 * context-aware: clicking on a link offers link actions; clicking
 * inside a text selection offers clipboard + link-insertion actions;
 * clicking on empty content offers paste / select all.
 *
 * The contextmenu event is captured at the editor's container ref —
 * we preventDefault so the OS menu never shows, then drive the shared
 * `ContextMenu` primitive in `components/ui`.
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

  useEffect(() => {
    const container = containerRef.current
    if (!container || !editor) return

    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      const target = e.target as HTMLElement | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      const href = anchor?.getAttribute('href') ?? null
      const cell = !anchor ? target?.closest?.('td, th') : null

      const sel = editor.state.selection
      const hasSelection = !anchor && !cell && sel.from !== sel.to

      // Land the cursor inside the link/cell so subsequent commands
      // (extendMarkRange, table actions) target the right range.
      if ((anchor || cell) && !hasSelection) {
        const view = editor.view
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
        if (pos) {
          editor.commands.focus()
          editor.commands.setTextSelection(pos.pos)
        }
      }

      const kind: MenuState['kind'] = anchor
        ? 'link'
        : cell
          ? 'table'
          : hasSelection
            ? 'selection'
            : 'empty'

      setState({ x: e.clientX, y: e.clientY, kind, href })
    }

    container.addEventListener('contextmenu', onContext)
    return () => container.removeEventListener('contextmenu', onContext)
  }, [containerRef, editor])

  const close = useCallback(() => setState(null), [])

  if (!state || !editor) return null

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
      // Clipboard read denied (document not focused or permission off).
    }
    close()
  }
  const selectAll = () => {
    editor.chain().focus().selectAll().run()
    close()
  }

  // ── table command builders ─────────────────────────────────────────
  const tableCmd = (fn: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => {
    fn(editor.chain().focus()).run()
    close()
  }
  const addRowBefore = tableCmd((c) => c.addRowBefore())
  const addRowAfter = tableCmd((c) => c.addRowAfter())
  const deleteRow = tableCmd((c) => c.deleteRow())
  const addColBefore = tableCmd((c) => c.addColumnBefore())
  const addColAfter = tableCmd((c) => c.addColumnAfter())
  const deleteCol = tableCmd((c) => c.deleteColumn())
  const toggleHeaderRow = tableCmd((c) => c.toggleHeaderRow())
  const mergeOrSplit = tableCmd((c) => c.mergeOrSplit())
  const deleteTable = tableCmd((c) => c.deleteTable())

  return (
    <ContextMenu
      open
      position={{ x: state.x, y: state.y }}
      onClose={close}
      ariaLabel="에디터 메뉴"
    >
      {state.kind === 'link' && (
        <>
          <ContextMenuItem icon={<ExternalLink size={14} />} onSelect={openLink}>
            새 탭에서 열기
          </ContextMenuItem>
          <ContextMenuItem icon={<Pencil size={14} />} onSelect={editLink}>
            링크 편집
          </ContextMenuItem>
          <ContextMenuItem icon={<Copy size={14} />} onSelect={copyLinkUrl}>
            URL 복사
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Link2Off size={14} />} destructive onSelect={removeLink}>
            링크 제거
          </ContextMenuItem>
        </>
      )}

      {state.kind === 'selection' && (
        <>
          <ContextMenuItem icon={<Copy size={14} />} onSelect={copySelection}>
            복사
          </ContextMenuItem>
          <ContextMenuItem icon={<Scissors size={14} />} onSelect={cutSelection}>
            잘라내기
          </ContextMenuItem>
          <ContextMenuItem icon={<Clipboard size={14} />} onSelect={pasteFromClipboard}>
            붙여넣기
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<LinkIcon size={14} />} onSelect={editLink}>
            링크 추가
          </ContextMenuItem>
          <ContextMenuItem icon={<MousePointer size={14} />} onSelect={selectAll}>
            모두 선택
          </ContextMenuItem>
        </>
      )}

      {state.kind === 'empty' && (
        <>
          <ContextMenuItem icon={<Clipboard size={14} />} onSelect={pasteFromClipboard}>
            붙여넣기
          </ContextMenuItem>
          <ContextMenuItem icon={<MousePointer size={14} />} onSelect={selectAll}>
            모두 선택
          </ContextMenuItem>
        </>
      )}

      {state.kind === 'table' && (
        <>
          <ContextMenuItem icon={<ArrowUpToLine size={14} />} onSelect={addRowBefore}>
            위에 행 추가
          </ContextMenuItem>
          <ContextMenuItem icon={<ArrowDownToLine size={14} />} onSelect={addRowAfter}>
            아래에 행 추가
          </ContextMenuItem>
          <ContextMenuItem icon={<ArrowLeftToLine size={14} />} onSelect={addColBefore}>
            왼쪽에 열 추가
          </ContextMenuItem>
          <ContextMenuItem icon={<ArrowRightToLine size={14} />} onSelect={addColAfter}>
            오른쪽에 열 추가
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Combine size={14} />} onSelect={mergeOrSplit}>
            셀 병합 / 분할
          </ContextMenuItem>
          <ContextMenuItem icon={<Heading size={14} />} onSelect={toggleHeaderRow}>
            머리글 행 토글
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem icon={<Rows size={14} />} destructive onSelect={deleteRow}>
            행 삭제
          </ContextMenuItem>
          <ContextMenuItem icon={<X size={14} />} destructive onSelect={deleteCol}>
            열 삭제
          </ContextMenuItem>
          <ContextMenuItem icon={<Trash2 size={14} />} destructive onSelect={deleteTable}>
            표 삭제
          </ContextMenuItem>
        </>
      )}
    </ContextMenu>
  )
}
