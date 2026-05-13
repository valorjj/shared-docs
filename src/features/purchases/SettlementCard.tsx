import { Check, ArrowRight, X } from 'lucide-react'
import { Button, Card, IconButton } from '../../components/ui'
import { formatMoney } from '../../lib/format'
import { isSettled, type SettlementRow, type SettlementUser } from './settlement'
import {
  useCreateSettlement,
  useDeleteSettlement,
  type SettlementRecord,
} from './settlementApi'
import './purchases.css'

type Props = {
  rows: SettlementRow[]
  records: SettlementRecord[]
  yearMonth: string
  currentUserId: number | undefined
}

export function SettlementCard({ rows, records, yearMonth, currentUserId }: Props) {
  const create = useCreateSettlement()
  const del = useDeleteSettlement(yearMonth)

  if (rows.length === 0 && records.length === 0) {
    return null
  }

  const handleSettle = (row: SettlementRow) => {
    if (row.perUser.length !== 2) return
    const [a, b] = row.perUser
    const owes = a.balance < b.balance ? a : b
    const owed = a.balance < b.balance ? b : a
    const amount = Math.round(Math.abs(owes.balance) * 100) / 100
    if (amount <= 0) return
    if (!confirm(`${owes.name}이(가) ${owed.name}에게 ${formatMoney(amount, row.currency)} 정산했어요?`)) {
      return
    }
    create.mutate({
      yearMonth,
      currency: row.currency,
      payerUserId: owes.userId,
      recipientUserId: owed.userId,
      amount,
    })
  }

  return (
    <Card className="settlement" padding="md">
      <div className="settlement__header">
        <span className="settlement__title">정산</span>
        <span className="settlement__sub">이 달 기준 · 소유자와 나눔 방식으로 계산</span>
      </div>

      {rows.length > 0 && (
        <div className="settlement__rows">
          {rows.map((row) => (
            <SettlementRowView
              key={row.currency}
              row={row}
              currentUserId={currentUserId}
              busy={create.isPending}
              onSettle={() => handleSettle(row)}
            />
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="settlement__history">
          <span className="settlement__history-title">이 달 정산 기록</span>
          <ul className="settlement__history-list">
            {records.map((r) => {
              const canDelete = r.recordedBy.userId === currentUserId
              return (
                <li key={r.id} className="settlement__history-item">
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" className="settlement__history-icon" />
                  <span className="settlement__history-line">
                    <span className="settlement__history-names">
                      {r.payer.name} <ArrowRight size={12} strokeWidth={2.5} aria-hidden="true" /> {r.recipient.name}
                    </span>
                    <span className="settlement__history-amount">
                      {formatMoney(r.amount, r.currency)}
                    </span>
                  </span>
                  <time className="settlement__history-date" dateTime={r.settledAt}>
                    {formatShortDate(r.settledAt)}
                  </time>
                  {canDelete && (
                    <IconButton
                      label="정산 취소"
                      variant="ghost"
                      size="sm"
                      disabled={del.isPending}
                      onClick={() => {
                        if (confirm('이 정산 기록을 취소할까요?')) {
                          del.mutate(r.id)
                        }
                      }}
                    >
                      <X size={14} strokeWidth={2} />
                    </IconButton>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

function SettlementRowView({
  row,
  currentUserId,
  busy,
  onSettle,
}: {
  row: SettlementRow
  currentUserId: number | undefined
  busy: boolean
  onSettle: () => void
}) {
  if (isSettled(row)) {
    return (
      <div className="settlement__row settlement__row--settled">
        <span className="settlement__currency">{row.currency}</span>
        <span className="settlement__settled">
          <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          정산 완료
        </span>
      </div>
    )
  }

  if (row.perUser.length === 2) {
    const [a, b] = row.perUser
    const owes = a.balance < b.balance ? a : b
    const owed = a.balance < b.balance ? b : a
    const amount = Math.round(Math.abs(owes.balance))
    const youOwe = owes.userId === currentUserId
    const youReceive = owed.userId === currentUserId
    return (
      <div className="settlement__row">
        <span className="settlement__currency">{row.currency}</span>
        <span className="settlement__line">
          <UserChip user={owes} highlight={youOwe} />
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" className="settlement__arrow" />
          <UserChip user={owed} highlight={youReceive} />
        </span>
        <span className="settlement__amount">{formatMoney(amount, row.currency)}</span>
        <Button variant="soft" size="sm" onClick={onSettle} disabled={busy}>
          정산 완료
        </Button>
      </div>
    )
  }

  return (
    <div className="settlement__row settlement__row--multi">
      <span className="settlement__currency">{row.currency}</span>
      <ul className="settlement__list">
        {row.perUser
          .slice()
          .sort((a, b) => b.balance - a.balance)
          .map((u) => (
            <li key={u.userId} className="settlement__user-line">
              <UserChip user={u} highlight={u.userId === currentUserId} />
              <span
                className={
                  u.balance >= 0 ? 'settlement__amount settlement__amount--positive' : 'settlement__amount'
                }
              >
                {u.balance >= 0 ? '+' : '-'}
                {formatMoney(Math.round(Math.abs(u.balance)), row.currency)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}

function UserChip({ user, highlight }: { user: SettlementUser; highlight: boolean }) {
  return (
    <span className={`settlement__chip${highlight ? ' settlement__chip--me' : ''}`}>
      {user.pictureUrl ? <img className="settlement__avatar" src={user.pictureUrl} alt="" /> : null}
      <span>{user.name}</span>
    </span>
  )
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
