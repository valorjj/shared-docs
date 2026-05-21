import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Highlight } from '@tiptap/extension-highlight'
import { absoluteFileUrl, useNotes } from '../api'
import { DataSnapshot } from '../../snapshots/DataSnapshot'
import { Tag } from './extensions/Tag'
import { EntityLink } from './extensions/EntityLink'
import { LinkCard } from './extensions/LinkCard'
import { NoteSearch } from './extensions/NoteSearch'
import NoteSearchBar from './NoteSearchBar'
import {
  SlashCommand,
  type SlashKeyHandler,
  type SlashState,
} from './extensions/SlashCommand'
import {
  MentionCommand,
  type MentionKeyHandler,
  type MentionState,
} from './extensions/MentionCommand'
import type { NoteLinkLookupItem } from './extensions/EntityLink'
import { buildSlashItems } from './slashItems'
import NoteEditorBubbleMenu from './NoteEditorBubbleMenu'
import SlashMenuPopup from './SlashMenuPopup'
import MentionMenuPopup from './MentionMenuPopup'
import LinkNavigateDialog from './LinkNavigateDialog'
import EntityNavigateDialog from './EntityNavigateDialog'
import { EntityNavigateCtx } from './entityNavigateContext'
import EditorContextMenu from './EditorContextMenu'
import type { EntityKind } from './extensions/EntityLink'
import styles from './NoteEditorBody.module.css'

type Props = {
  noteId: number
  initialBody: string
  onBodyChange: (html: string) => void
  onUploadImage: (file: File) => Promise<string>
  onUploadFile: (file: File) => Promise<{ url: string; filename: string; sizeBytes: number }>
  onPickFile: () => void
  onPickSnapshot: () => void
  onPickLinkCard: () => void
  registerEditor: (editor: Editor | null) => void
  /** Single source of truth for the link dialog lives in NoteEditor —
   *  both this body's context menu and the toolbar's link button
   *  open it via this prop. */
  onRequestLinkDialog: () => void
}

const IMAGE_MIME = /^image\//

export default function NoteEditorBody({
  noteId,
  initialBody,
  onBodyChange,
  onUploadImage,
  onUploadFile,
  onPickFile,
  onPickSnapshot,
  onPickLinkCard,
  registerEditor,
  onRequestLinkDialog,
}: Props) {
  const lastNoteId = useRef(noteId)

  // Slash menu state — driven from the Tiptap extension's callbacks.
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const slashKeyHandlerRef = useRef<SlashKeyHandler | null>(null)
  const slashItems = useMemo(
    () => buildSlashItems(onPickFile, onPickSnapshot, onPickLinkCard),
    [onPickFile, onPickSnapshot, onPickLinkCard],
  )

  // @-mention state — popup owns search, this just plumbs trigger state.
  const [mentionState, setMentionState] = useState<MentionState | null>(null)
  const mentionKeyHandlerRef = useRef<MentionKeyHandler | null>(null)
  // Notes cache feeds the `[[title]]` input rule (note-only). The
  // mention popup fetches results from /api/search/entities directly.
  const noteLookupRef = useRef<NoteLinkLookupItem[]>([])
  const currentNoteIdRef = useRef<number | null>(noteId)
  const { data: notes } = useNotes()
  useEffect(() => {
    noteLookupRef.current =
      notes?.map((n) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })) ?? []
  }, [notes])
  useEffect(() => { currentNoteIdRef.current = noteId }, [noteId])

  const editor = useEditor({
    extensions: [
      // StarterKit v3 bundles its own Link extension which collides with the
      // explicit `Link.configure` below — disable the bundled one so the
      // configured behavior (no openOnClick, autolink, linkOnPaste) wins.
      StarterKit.configure({ link: false }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "내용을 입력하세요. '/' 를 누르면 메뉴가 열려요." }),
      Link.configure({
        // Plain clicks open the LinkNavigateDialog instead of navigating —
        // we listen at the container ref below. Cmd/Ctrl-click still
        // bypasses (handled in the delegate handler).
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
      Tag,
      // eslint-disable-next-line react-hooks/refs
      EntityLink.configure({
        itemsRef: noteLookupRef,
        currentNoteIdRef,
      }),
      DataSnapshot,
      LinkCard,
      NoteSearch,
      // Ref is stored on the extension and only read inside ProseMirror
      // keydown handlers — never during render.
      // eslint-disable-next-line react-hooks/refs
      SlashCommand.configure({
        items: slashItems,
        keyHandlerRef: slashKeyHandlerRef,
        onOpen: setSlashState,
        onUpdate: setSlashState,
        onClose: () => setSlashState(null),
      }),
      // eslint-disable-next-line react-hooks/refs
      MentionCommand.configure({
        currentNoteIdRef,
        keyHandlerRef: mentionKeyHandlerRef,
        onOpen: setMentionState,
        onUpdate: setMentionState,
        onClose: () => setMentionState(null),
      }),
    ],
    content: initialBody || '',
    editorProps: {
      attributes: { class: styles.editor },
      handlePaste(_view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (!file) continue
            event.preventDefault()
            void handleFileInsert(file)
            return true
          }
        }
        return false
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        event.preventDefault()
        for (const file of Array.from(files)) {
          void handleFileInsert(file)
        }
        return true
      },
    },
    onUpdate({ editor: e }) {
      onBodyChange(e.getHTML())
    },
  })

  async function handleFileInsert(file: File) {
    if (!editor) return
    try {
      if (IMAGE_MIME.test(file.type)) {
        const url = await onUploadImage(file)
        editor.chain().focus().setImage({ src: absoluteFileUrl(url) }).run()
      } else {
        const att = await onUploadFile(file)
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'link', attrs: { href: absoluteFileUrl(att.url) } }],
                text: `📎 ${att.filename}`,
              },
            ],
          })
          .run()
      }
    } catch (err) {
      console.error('upload failed', err)
      const msg = err instanceof Error ? err.message : '파일 업로드에 실패했어요.'
      window.alert(msg)
    }
  }

  useEffect(() => {
    registerEditor(editor)
    return () => registerEditor(null)
  }, [editor, registerEditor])

  useEffect(() => {
    if (!editor) return
    if (lastNoteId.current !== noteId) {
      lastNoteId.current = noteId
      editor.commands.setContent(initialBody || '', { emitUpdate: false })
    }
  }, [noteId, initialBody, editor])

  // Container ref for the LinkHoverPreview + EditorContextMenu
  // delegate listeners — they hook into the editor's DOM via this node.
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Click-to-navigate confirm dialog. The Link extension has
  // `openOnClick: false`; a delegate listener here promotes anchor
  // clicks into a dialog so users can't accidentally jump out of the
  // doc mid-edit. Cmd/Ctrl/middle-click bypasses (power-user escape).
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      // Let modifier-clicks (cmd/ctrl/shift) and middle-clicks fall through
      // to native behavior — power users keep their tab-open habit.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      const target = e.target as HTMLElement | null
      // Skip internal entity-link chips — they navigate via React Router.
      // Accept the legacy selector too for old memos that haven't been
      // re-saved into the new wire format yet.
      if (target?.closest('[data-type="entity-link"]')) return
      if (target?.closest('[data-type="note-link"]')) return
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!/^https?:\/\//i.test(href) && !href.startsWith('/files/')) return
      e.preventDefault()
      setPendingNavHref(href)
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [])

  // Entity-link chip click-confirm dialog. `EntityLinkChip` consumes
  // `EntityNavigateCtx` and calls this setter on plain click; Cmd/Ctrl
  // -click on the chip skips this and navigates directly.
  const [pendingEntityNav, setPendingEntityNav] =
    useState<{ kind: EntityKind; id: number } | null>(null)
  const requestEntityNav = useCallback((kind: EntityKind, id: number) => {
    setPendingEntityNav({ kind, id })
  }, [])

  // In-note search bar (Cmd+F). The keyboard handler is scoped to the
  // body container — opening the bar while typing in some unrelated
  // page input shouldn't hijack the browser's native find.
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    node.addEventListener('keydown', onKey)
    return () => node.removeEventListener('keydown', onKey)
  }, [])

  return (
    <EntityNavigateCtx.Provider value={requestEntityNav}>
      <div className={styles.wrapper} ref={containerRef}>
        <NoteSearchBar editor={editor} open={searchOpen} onClose={() => setSearchOpen(false)} />
        <EditorContent editor={editor} />
        <NoteEditorBubbleMenu editor={editor} onRequestLinkDialog={onRequestLinkDialog} />
        <EditorContextMenu
          containerRef={containerRef}
          editor={editor}
          onRequestLinkDialog={onRequestLinkDialog}
        />
        <LinkNavigateDialog
          open={pendingNavHref !== null}
          href={pendingNavHref}
          onClose={() => setPendingNavHref(null)}
        />
        <EntityNavigateDialog
          open={pendingEntityNav !== null}
          kind={pendingEntityNav?.kind ?? null}
          id={pendingEntityNav?.id ?? null}
          onClose={() => setPendingEntityNav(null)}
        />
        {slashState && (
          <SlashMenuPopup state={slashState} keyHandlerRef={slashKeyHandlerRef} />
        )}
        {mentionState && (
          <MentionMenuPopup
            state={mentionState}
            keyHandlerRef={mentionKeyHandlerRef}
            currentNoteId={noteId}
          />
        )}
      </div>
    </EntityNavigateCtx.Provider>
  )
}
