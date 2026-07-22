import type { SubPlanNode } from './types'

/** An 안건 is decided once any of its 후보 is confirmed. */
export const isDecided = (sp: SubPlanNode): boolean => sp.options.some((o) => o.confirmed)

/** Earliest confirmedAt among confirmed 후보, or null. */
export const decidedAt = (sp: SubPlanNode): string | null =>
  sp.options.filter((o) => o.confirmed && o.confirmedAt).map((o) => o.confirmedAt!).sort()[0] ?? null
