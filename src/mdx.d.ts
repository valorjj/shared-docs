declare module '*.mdx' {
  import type { ComponentType } from 'react'

  export const meta: {
    emoji: string
    title: string
    subtitle: string
    description: string
    tags: string[]
    color: string
    status: 'done' | 'wip' | 'todo'
    tocItems?: Array<{ id: string; label: string; emoji?: string }>
  }

  const Component: ComponentType
  export default Component
}
