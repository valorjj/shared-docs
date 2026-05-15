import type { SnapshotAttrs } from './types'

/** Where the card's "open source" click should navigate. */
export function sourceLinkFor(kind: SnapshotAttrs['kind'], filter: SnapshotAttrs['filter']): string {
  switch (kind) {
    case 'purchase-total': {
      const f = filter as { month: string; category?: string }
      const params = new URLSearchParams({ month: f.month })
      return `/data/purchases?${params.toString()}`
    }
    case 'settlement': {
      const f = filter as { month: string }
      return `/data/purchases?month=${f.month}`
    }
    case 'todo-subset':
      return '/data/todos'
    case 'anniversary':
      return '/data/anniversaries'
  }
}
