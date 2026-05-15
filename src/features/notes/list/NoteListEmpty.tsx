import { FilePlus2 } from 'lucide-react'
import { Button, EmptyState } from '../../../components/ui'

type Props = {
  onCreate: () => void
}

export default function NoteListEmpty({ onCreate }: Props) {
  return (
    <EmptyState
      icon={<FilePlus2 size={24} strokeWidth={1.5} />}
      title="아직 메모가 없어요"
      action={
        <Button variant="outline" size="sm" onClick={onCreate}>
          새 메모 만들기
        </Button>
      }
    />
  )
}
