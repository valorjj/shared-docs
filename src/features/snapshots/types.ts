/**
 * Data-snapshot types — embedded in memo bodies as Tiptap `dataSnapshot`
 * block nodes. See `shared-docs-backend/docs/REFERENCES_BLUEPRINT.md`
 * Part 1 for the design rationale.
 *
 * Snapshots are deliberately frozen at insertion: money/dates/state
 * should not silently drift under the user. A manual refresh button
 * on the card re-captures the values.
 */

export const SNAPSHOT_KINDS = [
  'purchase-total',
  'settlement',
  'todo-subset',
  'anniversary',
] as const
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number]

export const SNAPSHOT_KIND_LABELS: Record<SnapshotKind, string> = {
  'purchase-total': '구매 합계',
  settlement: '정산 상태',
  'todo-subset': '할 일',
  anniversary: '기념일',
}

export const SNAPSHOT_KIND_HINTS: Record<SnapshotKind, string> = {
  'purchase-total': '한 달치 카테고리별 지출 합계',
  settlement: '한 달치 정산 잔액 + 완료 여부',
  'todo-subset': '남은 일 / 완료된 일 한 묶음',
  anniversary: '가까운 / 지난 기념일 모음',
}

// ── Per-kind filter shapes ────────────────────────────────────────────
export type PurchaseTotalFilter = {
  /** "YYYY-MM" */
  month: string
  /** Category name. "ALL" or undefined = all categories. */
  category?: string
}

export type SettlementFilter = {
  /** "YYYY-MM" */
  month: string
}

export type TodoSubsetFilter = {
  status: 'open' | 'done' | 'all'
  /** Category name. "ALL" or undefined = all categories. */
  category?: string
}

export type AnniversaryFilter = {
  window: 'upcoming-30' | 'past-year' | 'all'
}

export type SnapshotFilter =
  | { kind: 'purchase-total'; filter: PurchaseTotalFilter }
  | { kind: 'settlement'; filter: SettlementFilter }
  | { kind: 'todo-subset'; filter: TodoSubsetFilter }
  | { kind: 'anniversary'; filter: AnniversaryFilter }

// ── Frozen payload (the rendered card content) ────────────────────────
export type SnapshotFrozen = {
  /** Top-of-card heading (e.g. "구매 내역 · 2026-05 · 식비"). */
  label: string
  /** Large primary value (e.g. "₩382,000" or "5건 남음"). */
  primary: string
  /** Small secondary line (e.g. "11건" or "가장 가까운 날: 5월 20일"). */
  secondary?: string
  /** ISO timestamp captured at insertion / last refresh. */
  capturedAt: string
}

// ── Full node attrs (what lives on the Tiptap block node) ─────────────
export type SnapshotAttrs = {
  kind: SnapshotKind
  /** Stored as JSON string in the DOM (HTML attrs only support strings). */
  filter: PurchaseTotalFilter | SettlementFilter | TodoSubsetFilter | AnniversaryFilter
  frozen: SnapshotFrozen
  /** Deep-link to the source view (e.g. "/data/purchases?month=2026-05"). */
  sourceLink: string
}
