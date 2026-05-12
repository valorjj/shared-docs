import { useParams } from 'react-router-dom'
import DocLayout from '../components/DocLayout'
import { guideById } from '../content'
import NotFound from './NotFound'

export default function Doc() {
  const params = useParams()
  const id = params['*'] ?? params.id

  const guide = id ? guideById(id) : undefined
  if (!guide) return <NotFound />

  const { Component, tocItems } = guide
  return (
    <DocLayout pageId={guide.id} tocItems={tocItems}>
      <Component />
    </DocLayout>
  )
}
