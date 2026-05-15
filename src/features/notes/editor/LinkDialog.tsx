import { useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Button,
  Field,
  Input,
  Label,
  Modal,
  Stack,
} from '../../../components/ui'

type Props = {
  open: boolean
  editor: Editor | null
  onClose: () => void
}

/**
 * Replaces the native window.prompt() that used to live in the toolbar
 * and bubble-menu link buttons. Handles three cases that the prompt-
 * based flow silently mishandled:
 *
 * 1. User has text selected — convert the selection to a link.
 * 2. User has nothing selected and isn't on an existing link — insert
 *    a fresh text+link node using the URL as fallback text if none
 *    is provided. The old prompt did nothing in this case.
 * 3. User clicked while inside an existing link — pre-fill the URL,
 *    allow editing OR removal via the "링크 제거" footer button.
 */
export default function LinkDialog({ open, editor, onClose }: Props) {
  return open && editor ? (
    <LinkDialogInner editor={editor} onClose={onClose} />
  ) : null
}

function LinkDialogInner({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const { from, to } = editor.state.selection
  const hasSelection = from !== to
  const selectedText = hasSelection ? editor.state.doc.textBetween(from, to) : ''
  const existingHref = editor.getAttributes('link').href as string | undefined
  const isEditing = !!existingHref

  const [url, setUrl] = useState(existingHref ?? '')
  const [text, setText] = useState('')

  // No selection AND not on an existing link → the user needs to provide
  // text for the link to attach to. With selection, the selected range
  // becomes the link text. While editing, the existing link's text is
  // already in the doc — no extra input needed.
  const needsTextInput = !hasSelection && !isEditing

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      if (isEditing) {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        onClose()
      }
      return
    }
    const href = withScheme(trimmed)

    if (hasSelection || isEditing) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      // No selection — insert URL (or user-provided label) as fresh text
      // carrying the link mark. Without this the old prompt-based flow
      // simply dropped the URL on the floor.
      const insertText = text.trim() || trimmed
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'text',
          text: insertText,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run()
    }
    onClose()
  }

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? '링크 편집' : '링크 추가'}
      footer={
        <>
          {isEditing && (
            <Button variant="ghost" onClick={removeLink}>링크 제거</Button>
          )}
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" type="submit" form="link-dialog-form" disabled={!url.trim()}>
            {isEditing ? '저장' : '삽입'}
          </Button>
        </>
      }
    >
      <form id="link-dialog-form" onSubmit={submit}>
        <Stack gap={3}>
          <Field>
            <Label htmlFor="link-dialog-url">URL</Label>
            <Input
              id="link-dialog-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              autoComplete="off"
              required
            />
          </Field>
          {needsTextInput && (
            <Field>
              <Label htmlFor="link-dialog-text" optional>표시할 텍스트</Label>
              <Input
                id="link-dialog-text"
                type="text"
                placeholder="비워두면 URL이 그대로 표시돼요"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={300}
              />
            </Field>
          )}
          {hasSelection && (
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-placeholder)', margin: 0 }}>
              선택된 텍스트: <strong style={{ color: 'var(--c-text-muted)' }}>{truncate(selectedText, 60)}</strong>
            </p>
          )}
        </Stack>
      </form>
    </Modal>
  )
}

/** Prepend https:// if the user typed a bare domain. */
function withScheme(raw: string): string {
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(raw)) return raw
  if (raw.startsWith('mailto:') || raw.startsWith('tel:')) return raw
  if (raw.startsWith('/') || raw.startsWith('#')) return raw // relative
  return `https://${raw}`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
