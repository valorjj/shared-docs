import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import FloatingToc, { type TocItem } from './FloatingToc'
import CommentsFab from './CommentsFab'
import './DocLayout.css'

type Props = {
  pageId: string
  tocItems?: TocItem[]
  children: ReactNode
}

export default function DocLayout({ pageId, tocItems, children }: Props) {
  const navigate = useNavigate()

  return (
    <div className="doc">
      <button className="doc__back" type="button" onClick={() => navigate('/')}>
        ← 홈으로
      </button>

      {tocItems && tocItems.length > 0 && <FloatingToc items={tocItems} />}

      <article className="doc__body">{children}</article>

      <CommentsFab pageId={pageId} />
    </div>
  )
}
