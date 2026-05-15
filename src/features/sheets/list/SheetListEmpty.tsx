import { TableProperties } from 'lucide-react'
import { Button, EmptyState } from '../../../components/ui'

type Props = {
  onCreate: () => void
}

export default function SheetListEmpty({ onCreate }: Props) {
  return (
    <EmptyState
      icon={<TableProperties size={24} strokeWidth={1.5} />}
      title="아직 시트가 없어요"
      action={
        <Button variant="outline" size="sm" onClick={onCreate}>
          새 시트 만들기
        </Button>
      }
    />
  )
}
