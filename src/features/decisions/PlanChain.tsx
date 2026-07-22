import { useState, type FormEvent } from 'react'
import { Check, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useMembers } from '../workspaces/membersApi'
import { collabColorForUser } from '../notes/collab/collabColor'
import { useAddOption, useAddSubPlan, useSetOptionConfirmed } from './api'
import { decidedAt, isDecided } from './decidedState'
import OptionSheet from './OptionSheet'
import styles from './PlanChain.module.css'
import type { OptionNode, PlanTree, SubPlanNode } from './types'

type Props = { tree: PlanTree; planId: number }

function formatDecidedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd}`
}

/** Dashed inline add row: tap to reveal a text field, submit to create. */
function AddRow({
  label,
  placeholder,
  onSubmit,
  pending,
}: {
  label: string
  placeholder: string
  onSubmit: (title: string) => void
  pending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSubmit(t)
    setText('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        <Plus size={15} />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <form className={styles.addForm} onSubmit={submit}>
      <input
        className={styles.addInput}
        value={text}
        placeholder={placeholder}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setText('') } }}
      />
      <button type="submit" className={styles.addSubmit} disabled={pending || !text.trim()}>
        추가
      </button>
    </form>
  )
}

function VotePips({ voterUserIds, nameOf }: { voterUserIds: number[]; nameOf: (uid: number) => string }) {
  if (voterUserIds.length === 0) return null
  return (
    <span className={styles.votes}>
      {voterUserIds.map((uid) => (
        <span
          key={uid}
          className={styles.av}
          style={{ background: collabColorForUser(uid) }}
          title={nameOf(uid)}
        >
          {nameOf(uid).slice(0, 1)}
        </span>
      ))}
    </span>
  )
}

export default function PlanChain({ tree, planId }: Props) {
  const { user } = useAuth()
  const myUserId = user?.userId ?? -1
  const { activeId } = useActiveWorkspace()
  const { data: members } = useMembers(activeId)
  const nameOf = (uid: number) =>
    uid === myUserId ? '나' : members?.find((m) => m.userId === uid)?.name ?? '?'

  const confirm = useSetOptionConfirmed()
  const addOption = useAddOption()
  const addSubPlan = useAddSubPlan(planId)

  // Hold only the id; resolve the live option from the tree so vote/confirm
  // changes reflect in the open sheet after a refetch (no stale snapshot).
  const [sheetOptionId, setSheetOptionId] = useState<number | null>(null)

  const toggleConfirm = (o: OptionNode) => confirm.mutate({ id: o.id, confirmed: !o.confirmed })

  const stations = tree.subPlans
  const sheetOwner = sheetOptionId == null
    ? null
    : stations.find((sp) => sp.options.some((o) => o.id === sheetOptionId)) ?? null
  const sheetOption = sheetOwner?.options.find((o) => o.id === sheetOptionId) ?? null
  const last = stations[stations.length - 1]
  // Reveal the "next 안건" affordance only once the frontier 안건 is decided.
  const canAddNext = stations.length > 0 && isDecided(last)

  if (stations.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>첫 안건을 추가하고 후보를 쌓아가 보세요.</p>
        <AddRow
          label="첫 안건 추가"
          placeholder="안건 이름 (예: 이사 갈 동네)"
          pending={addSubPlan.isPending}
          onSubmit={(title) => addSubPlan.mutate({ title })}
        />
      </div>
    )
  }

  return (
    <div className={styles.chain}>
      {stations.map((sp: SubPlanNode) => {
        const decided = isDecided(sp)
        const confirmedCount = sp.options.filter((o) => o.confirmed).length
        const when = decidedAt(sp)
        return (
          <div
            key={sp.id}
            className={`${styles.station} ${decided ? styles.decided : styles.pending}`}
          >
            <div className={styles.rail}>
              <span className={styles.dot} />
            </div>
            <div className={styles.body}>
              <div className={styles.agHead}>
                <span className={styles.agName}>{sp.title}</span>
                {decided && <span className={styles.badge}>{confirmedCount}개 확정</span>}
              </div>
              {decided && when && (
                <div className={styles.meta}>{formatDecidedAt(when)} 결정 · 되돌릴 수 있어요</div>
              )}

              <ul className={styles.cands}>
                {sp.options.map((o) => (
                  <li key={o.id} className={`${styles.cand} ${o.confirmed ? styles.candOn : ''}`}>
                    <button
                      type="button"
                      className={styles.chk}
                      aria-pressed={o.confirmed}
                      aria-label={o.confirmed ? '확정 취소' : '확정'}
                      disabled={confirm.isPending}
                      onClick={() => toggleConfirm(o)}
                    >
                      {o.confirmed && <Check size={13} strokeWidth={3} />}
                    </button>
                    <button
                      type="button"
                      className={styles.candBody}
                      onClick={() => setSheetOptionId(o.id)}
                    >
                      <span className={styles.cName}>{o.title}</span>
                      <VotePips voterUserIds={o.voterUserIds} nameOf={nameOf} />
                      <ChevronRight size={17} className={styles.chev} />
                    </button>
                  </li>
                ))}
              </ul>

              <AddRow
                label="후보 추가"
                placeholder="후보 이름"
                pending={addOption.isPending}
                onSubmit={(title) => addOption.mutate({ subPlanId: sp.id, payload: { title } })}
              />
            </div>
          </div>
        )
      })}

      {canAddNext && (
        <div className={`${styles.station} ${styles.pending}`}>
          <div className={styles.rail}>
            <span className={styles.dot} />
          </div>
          <div className={styles.body}>
            <AddRow
              label="다음 안건 추가"
              placeholder="다음 안건 이름"
              pending={addSubPlan.isPending}
              onSubmit={(title) => addSubPlan.mutate({ title })}
            />
          </div>
        </div>
      )}

      {sheetOption && sheetOwner && (
        <OptionSheet
          option={sheetOption}
          subPlanId={sheetOwner.id}
          onClose={() => setSheetOptionId(null)}
        />
      )}
    </div>
  )
}
