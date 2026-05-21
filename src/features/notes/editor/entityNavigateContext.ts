import { createContext, useContext } from 'react'
import type { EntityKind } from './extensions/EntityLink'

export type EntityNavRequest = (kind: EntityKind, id: number) => void

/**
 * Lets `EntityLinkChip` ask the editor wrapper to open the
 * click-confirm dialog instead of navigating directly. Kept in its own
 * file (no React component) so Fast Refresh doesn't complain about a
 * `.tsx` exporting both a hook and a component.
 */
export const EntityNavigateCtx = createContext<EntityNavRequest | null>(null)

export function useEntityNavigate(): EntityNavRequest | null {
  return useContext(EntityNavigateCtx)
}
