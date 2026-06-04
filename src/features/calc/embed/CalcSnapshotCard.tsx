import { useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { ArrowUpRight, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react'
import { Menu, MenuItem } from '../../../components/ui/Menu'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'
import { apiClient } from '../../../api/client'
import { useActiveWorkspace } from '../../../auth/useActiveWorkspace'
import { calcKeys } from '../api'
import { formatCurrency, formatKRW } from '../format'
import { CALC_MODE_LABELS, type CalcEntry, type CalcMode } from '../types'
import styles from './CalcSnapshotCard.module.css'

type Attrs = {
  entryId: number
  mode: CalcMode
  input: string
  result: string
  label: string
  capturedAt: string
  tombstone: boolean
}

export default function CalcSnapshotCard(props: NodeViewProps) {
  const attrs = props.node.attrs as Attrs
  const qc = useQueryClient()
  const { activeId } = useActiveWorkspace()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const input = safeParse(attrs.input)
  const result = safeParse(attrs.result)
  const summary = renderSummary(attrs.mode, input, result)

  const handleRefresh = async () => {
    if (refreshing || !attrs.entryId) return
    setRefreshing(true)
    try {
      const fresh = await qc.fetchQuery<CalcEntry>({
        queryKey: calcKeys.detail(activeId, attrs.entryId),
        queryFn: async () => {
          const { data } = await apiClient.get<CalcEntry>(`/api/calc/${attrs.entryId}`)
          return data
        },
        staleTime: 0,
      })
      props.updateAttributes({
        input: fresh.inputJson,
        result: fresh.resultJson,
        label: fresh.label ?? '',
        capturedAt: new Date().toISOString(),
        tombstone: false,
      })
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // The source entry was deleted — switch the card into a tombstone
        // state. The frozen input/result stay visible so the user still
        // sees what was originally there.
        props.updateAttributes({ tombstone: true })
      } else {
        console.error('calc snapshot refresh failed', err)
        window.alert('새로고침에 실패했어요. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setRefreshing(false)
    }
  }

  const formattedCapturedAt = formatCapturedAt(attrs.capturedAt)
  const modeBadge = CALC_MODE_LABELS[attrs.mode] ?? attrs.mode

  return (
    <NodeViewWrapper className={styles.wrap}>
      <div
        className={`${styles.card}${attrs.tombstone ? ` ${styles.cardTombstone}` : ''}`}
        contentEditable={false}
      >
        <div
          className={`${styles.accent}${attrs.tombstone ? ` ${styles.accentTombstone}` : ''}`}
          aria-hidden="true"
        />
        <div className={styles.body}>
          <div className={styles.headerRow}>
            <span className={styles.label}>
              {modeBadge}{attrs.tombstone ? ' · 원본 없음' : ''}
            </span>
            <Menu
              trigger={
                <button type="button" className={styles.iconBtn} aria-label="옵션">
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
              }
            >
              <MenuItem onSelect={handleRefresh} icon={<RefreshCw size={14} />}>
                새로고침
              </MenuItem>
              <MenuItem
                onSelect={() => setConfirmOpen(true)}
                icon={<Trash2 size={14} />}
                destructive
              >
                삭제
              </MenuItem>
            </Menu>
          </div>
          <div className={styles.primary}>{summary}</div>
          {attrs.label && <div className={styles.caption}>{attrs.label}</div>}
          <div className={styles.footer}>
            <span className={styles.captured}>{formattedCapturedAt}</span>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={handleRefresh}
              disabled={refreshing || !attrs.entryId}
              title="현재 값으로 갱신"
            >
              <RefreshCw
                size={11}
                strokeWidth={2}
                className={refreshing ? styles.spinning : ''}
                aria-hidden="true"
              />
              {refreshing ? '갱신 중…' : '새로고침'}
            </button>
            <a
              className={styles.footerBtn}
              href={`/calc`}
              title="계산 페이지 열기"
            >
              <ArrowUpRight size={11} strokeWidth={2} aria-hidden="true" />
              원본
            </a>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="이 계산 스냅샷을 삭제할까요?"
        description="본문에서 계산 카드가 제거됩니다. 원본 계산은 그대로 남아있어요."
        confirmLabel="삭제"
        destructive
        onConfirm={() => props.deleteNode()}
      />
    </NodeViewWrapper>
  )
}

function safeParse(json: string): any {
  try {
    return JSON.parse(json)
  } catch {
    return {}
  }
}

function renderSummary(mode: CalcMode, input: any, result: any): string {
  switch (mode) {
    case 'BASIC':
      return summarizeBasic(input, result)
    case 'INSTALLMENT':
      return `${formatKRW(input.principal ?? 0)} / ${input.months ?? 0}개월 → 월 ${formatKRW(result.monthly ?? 0)}`
    case 'LOAN':
      return `${formatKRW(input.principal ?? 0)} / ${input.months ?? 0}개월 (${input.type ?? ''}) → 첫달 ${formatKRW(result.firstPayment ?? 0)}`
    case 'DUTCH': {
      const cur = input.currency ?? 'KRW'
      const lines = (result.perShare ?? [])
        .map((s: { label: string; amount: number }) => `${s.label} ${formatCurrency(s.amount, cur)}`)
        .join(' · ')
      return lines || `${formatCurrency(input.total ?? 0, cur)} 분할`
    }
    case 'DATE':
      return result.description ?? ''
    default:
      return JSON.stringify({ input, result })
  }
}

function summarizeBasic(input: any, result: any): string {
  // Legacy single-line shape kept for back-compat with pre-2026-05-29 entries.
  if (typeof input?.expr === 'string') {
    return `${input.expr} = ${result?.formatted ?? result?.value ?? '?'}`
  }
  const lines = Array.isArray(result?.lines) ? result.lines : []
  const meaningful = lines.filter(
    (l: any) => l?.kind !== 'blank' && l?.kind !== 'comment',
  )
  if (meaningful.length === 0) return '(빈 계산)'
  if (meaningful.length === 1) {
    const only = meaningful[0]
    const src = String(only.source ?? '').trim()
    return src && only.formatted ? `${src} = ${only.formatted}` : (only.formatted ?? '?')
  }
  const fin = result?.finalFormatted
  return fin ? `${meaningful.length}단계 · 최종 ${fin}` : `${meaningful.length}단계`
}

function formatCapturedAt(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd} ${hh}:${mi} 캡처`
  } catch {
    return ''
  }
}
