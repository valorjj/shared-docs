import { NotebookPen } from 'lucide-react'
import './Hub.css'

export default function Hub() {
  return (
    <div className="hub">
      <div className="hub__container">
        <header className="hub__header">
          <h1 className="hub__title">우리의 가이드북</h1>
          <p className="hub__subtitle">필요한 정보를 한눈에 정리했어요</p>
        </header>

        <div className="hub__empty" role="status">
          <span className="hub__empty-icon" aria-hidden="true">
            <NotebookPen size={28} strokeWidth={1.5} />
          </span>
          <p className="hub__empty-title">아직 메모가 없어요</p>
          <p className="hub__empty-sub">곧 메모 기능이 추가됩니다.</p>
        </div>
      </div>
    </div>
  )
}
