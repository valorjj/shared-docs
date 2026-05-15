import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  Database,
  Table as TableIcon,
  Paperclip,
} from 'lucide-react'
import type { SlashItem } from './extensions/SlashCommand'

/**
 * Slash menu command list. The `onPickFile` + `onPickSnapshot` handlers
 * are injected from the editor since they live outside the Tiptap chain
 * (file picking opens a hidden <input>; data-snapshot picking opens a
 * Radix Dialog owned by NoteEditor).
 */
export function buildSlashItems(
  onPickFile: () => void,
  onPickSnapshot: () => void,
): SlashItem[] {
  return [
    {
      id: 'h1',
      title: '제목 1',
      hint: 'heading 1',
      Icon: Heading1,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
    },
    {
      id: 'h2',
      title: '제목 2',
      hint: 'heading 2',
      Icon: Heading2,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      id: 'h3',
      title: '제목 3',
      hint: 'heading 3',
      Icon: Heading3,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
    },
    {
      id: 'bullet',
      title: '글머리 기호',
      hint: 'bullet list',
      Icon: List,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      id: 'ordered',
      title: '번호 매기기',
      hint: 'numbered list',
      Icon: ListOrdered,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      id: 'task',
      title: '체크리스트',
      hint: 'task list',
      Icon: ListTodo,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleTaskList().run(),
    },
    {
      id: 'quote',
      title: '인용',
      hint: 'blockquote',
      Icon: Quote,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      id: 'code',
      title: '코드 블록',
      hint: 'code block',
      Icon: Code,
      run: (editor, range) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      id: 'table',
      title: '표',
      hint: 'table',
      Icon: TableIcon,
      run: (editor, range) =>
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: 'file',
      title: '파일 첨부',
      hint: 'image / file',
      Icon: Paperclip,
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        onPickFile()
      },
    },
    {
      id: 'data-snapshot',
      title: '데이터 스냅샷',
      hint: 'data snapshot',
      Icon: Database,
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        onPickSnapshot()
      },
    },
  ]
}
