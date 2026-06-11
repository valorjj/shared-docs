import { Flag, ListPlus, CirclePlus, CheckCircle2, RefreshCw, RotateCcw, Lock, LockOpen, type LucideIcon } from 'lucide-react'
import type { PlanEvent, PlanEventType } from './types'

const ICONS: Record<PlanEventType, LucideIcon> = {
  PLAN_CREATED: Flag,
  SUBPLAN_ADDED: ListPlus,
  OPTION_ADDED: CirclePlus,
  DECISION_LOCKED: CheckCircle2,
  DECISION_CHANGED: RefreshCw,
  DECISION_REOPENED: RotateCcw,
  PLAN_LOCKED: Lock,
  PLAN_UNLOCKED: LockOpen,
  PLAN_COMPLETED: CheckCircle2,
  PLAN_UNCOMPLETED: RotateCcw,
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
    case 'PLAN_LOCKED': return `${actor}님이 계획을 잠갔어요`
    case 'PLAN_UNLOCKED': return `${actor}님이 계획 잠금을 해제했어요`
    case 'PLAN_COMPLETED': return `${actor}님이 계획을 완료했어요`
    case 'PLAN_UNCOMPLETED': return `${actor}님이 계획을 다시 진행했어요`
    default: return `${actor}님이 활동했어요`
  }
}
