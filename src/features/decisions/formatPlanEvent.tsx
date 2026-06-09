import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, type LucideIcon } from 'lucide-react'
import type { PlanEvent, PlanEventType } from './types'

const ICONS: Record<PlanEventType, LucideIcon> = {
  PLAN_CREATED: Flag,
  SUBPLAN_ADDED: ListPlus,
  OPTION_ADDED: CirclePlus,
  DECISION_LOCKED: CheckCircle2,
  DECISION_CHANGED: RefreshCw,
  DECISION_REOPENED: RotateCcw,
}

export function planEventIcon(type: PlanEventType): LucideIcon {
  return ICONS[type]
}

/** Korean sentence for one event. `actor` is the already-resolved display name.
 *  Particles attach to fixed nouns (안건/선택지), so they stay grammatical for any title. */
export function planEventText(e: PlanEvent, actor: string): string {
  const p = e.payload ?? {}
  const q = (v: string | null | undefined) => `'${v ?? ''}'`
  switch (e.type) {
    case 'PLAN_CREATED': return `${actor}님이 계획을 만들었어요`
    case 'SUBPLAN_ADDED': return `${actor}님이 ${q(p.subPlanTitle)} 안건을 추가했어요`
    case 'OPTION_ADDED': return `${actor}님이 ${q(p.subPlanTitle)} 안건에 ${q(p.optionTitle)} 선택지를 추가했어요`
    case 'DECISION_LOCKED': return `${actor}님이 ${q(p.optionTitle)} 선택지로 결정했어요`
    case 'DECISION_CHANGED': return `${actor}님이 ${q(p.optionTitle)} 선택지로 결정을 바꿨어요`
    case 'DECISION_REOPENED': return `${actor}님이 ${q(p.subPlanTitle)} 안건의 결정을 다시 열었어요`
    default: return `${actor}님이 활동했어요`
  }
}
