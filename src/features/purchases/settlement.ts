import type { Purchase, PurchaseAuthor } from './api'
import type { SettlementRecord } from './settlementApi'

export type SettlementUser = {
  userId: number
  name: string
  pictureUrl: string | null
  paid: number
  owed: number
  balance: number  // paid - owed; positive = others owe this user
}

export type SettlementRow = {
  currency: string
  perUser: SettlementUser[]
}

type UserInfo = Pick<PurchaseAuthor, 'userId' | 'name' | 'pictureUrl'>

/**
 * Compute per-currency settlement from purchases + settlement records.
 *
 * Household = unique users seen across purchases, settlements, and {currentUser if supplied}.
 * Each purchase: author pays full `amount`; "owed" distributed by splitMode.
 *   SHARED  → share evenly across household
 *   MINE    → author owes full amount (net 0)
 *   THEIRS  → split evenly across non-authors
 * Each settlement record neutralizes outstanding debt: equivalent to a THEIRS purchase
 *   where the payer "paid for" the recipient.
 */
export function computeSettlement(
  purchases: Purchase[],
  settlements: SettlementRecord[],
  currentUser: UserInfo | null,
): SettlementRow[] {
  const users = new Map<number, UserInfo>()
  for (const p of purchases) {
    if (!users.has(p.createdBy.userId)) {
      users.set(p.createdBy.userId, {
        userId: p.createdBy.userId,
        name: p.createdBy.name,
        pictureUrl: p.createdBy.pictureUrl,
      })
    }
  }
  for (const s of settlements) {
    for (const ref of [s.payer, s.recipient]) {
      if (!users.has(ref.userId)) {
        users.set(ref.userId, {
          userId: ref.userId,
          name: ref.name,
          pictureUrl: ref.pictureUrl,
        })
      }
    }
  }
  if (currentUser && !users.has(currentUser.userId)) {
    users.set(currentUser.userId, currentUser)
  }
  const household = Array.from(users.values())
  if (household.length === 0) return []

  const byCurrency = new Map<string, Map<number, SettlementUser>>()

  const ensureBucket = (currency: string) => {
    let bucket = byCurrency.get(currency)
    if (!bucket) {
      bucket = new Map()
      for (const u of household) {
        bucket.set(u.userId, { ...u, paid: 0, owed: 0, balance: 0 })
      }
      byCurrency.set(currency, bucket)
    }
    return bucket
  }

  for (const p of purchases) {
    const bucket = ensureBucket(p.currency)
    const author = bucket.get(p.createdBy.userId)
    if (!author) continue
    author.paid += p.amount

    if (p.splitMode === 'SHARED') {
      const share = p.amount / household.length
      for (const acc of bucket.values()) acc.owed += share
    } else if (p.splitMode === 'MINE') {
      author.owed += p.amount
    } else if (p.splitMode === 'THEIRS') {
      const others = household.filter((u) => u.userId !== author.userId)
      if (others.length === 0) {
        author.owed += p.amount
      } else {
        const share = p.amount / others.length
        for (const o of others) {
          const acc = bucket.get(o.userId)
          if (acc) acc.owed += share
        }
      }
    }
  }

  // A settlement is a real cash transfer from payer to recipient.
  // Modeled as the payer "paying for" the recipient (THEIRS), which
  // increases the payer's paid and the recipient's owed by `amount`.
  for (const s of settlements) {
    const bucket = ensureBucket(s.currency)
    const payer = bucket.get(s.payer.userId)
    const recipient = bucket.get(s.recipient.userId)
    if (!payer || !recipient) continue
    payer.paid += s.amount
    recipient.owed += s.amount
  }

  const rows: SettlementRow[] = []
  for (const [currency, bucket] of byCurrency.entries()) {
    const perUser = Array.from(bucket.values()).map((u) => ({
      ...u,
      balance: u.paid - u.owed,
    }))
    rows.push({ currency, perUser })
  }
  rows.sort((a, b) => (a.currency === 'KRW' ? -1 : b.currency === 'KRW' ? 1 : a.currency.localeCompare(b.currency)))
  return rows
}

/** True when every user's balance rounds to zero (settled). */
export function isSettled(row: SettlementRow): boolean {
  return row.perUser.every((u) => Math.round(u.balance) === 0)
}
