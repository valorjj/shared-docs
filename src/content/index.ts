import type { ComponentType } from 'react'
import type { TocItem } from '../components/FloatingToc'

const files = import.meta.glob('./*.mdx', { eager: true }) as Record<
  string,
  {
    meta: Omit<GuideMeta, 'id' | 'Component'>
    default: ComponentType
  }
>

export type GuideStatus = 'done' | 'wip' | 'todo'

export type GuideMeta = {
  id: string
  emoji: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  color: string
  status: GuideStatus
  tocItems?: TocItem[]
  Component: ComponentType
}

export const guides: GuideMeta[] = Object.entries(files).map(([path, mod]) => {
  const id = path.replace(/^\.\/|\.mdx$/g, '')
  return { ...mod.meta, id, Component: mod.default }
})

export const guideById = (id: string): GuideMeta | undefined =>
  guides.find((g) => g.id === id)
