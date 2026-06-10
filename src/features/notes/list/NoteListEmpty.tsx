import { Sparkles } from 'lucide-react'
import { Button, EmptyState } from '../../../components/ui'

type Props = {
  onCreate: () => void
}

export default function NoteListEmpty({ onCreate }: Props) {
  return (
    <EmptyState
      icon={<Sparkles size={24} strokeWidth={1.5} />}
      title="환영해요 — 워크스페이스가 비어 있어요"
      description="첫 메모를 적어 시작해보세요."
      action={
        <Button variant="outline" size="sm" onClick={onCreate}>
          새 메모 만들기
        </Button>
      }
    />
  )
}
