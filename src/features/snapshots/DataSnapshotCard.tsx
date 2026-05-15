import { useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react'
import { Menu, MenuItem } from '../../components/ui/Menu'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../auth/useAuth'
import { refreshSnapshot } from './refresh'
import type { SnapshotAttrs } from './types'
import styles from './DataSnapshotCard.module.css'

/**
 * React node view for the `dataSnapshot` Tiptap block node.
 *
 * Renders the *frozen* payload — never auto-refetches on mount, so a
 * snapshot taken in March still reads "March" data when viewed in May.
 * The user can hit the refresh button to explicitly recapture.
 */
export default function DataSnapshotCard(props: NodeViewProps) {
  const attrs = props.node.attrs as SnapshotAttrs
  const qc = useQueryClient()
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const frozen = await refreshSnapshot(qc, attrs, user?.userId)
      props.updateAttributes({ frozen })
    } catch (err) {
      console.error('snapshot refresh failed', err)
      window.alert('새로고침에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpenSource = () => {
    // NodeView lives inside an editor — we can't useNavigate here without
    // a Router context, which we *do* have (Hub is wrapped in Routes), so
    // window.location works but a soft nav is nicer. Use a plain anchor
    // with href so middle-click / cmd-click do the right thing too.
  }

  const formattedCapturedAt = formatCapturedAt(attrs.frozen.capturedAt)

  return (
    <NodeViewWrapper className={styles.wrap}>
      <div className={styles.card} contentEditable={false}>
        <div className={styles.accent} aria-hidden="true" />
        <div className={styles.body}>
          <div className={styles.headerRow}>
            <span className={styles.label}>{attrs.frozen.label}</span>
            <Menu
              trigger={
                <button type="button" className={styles.iconBtn} aria-label="스냅샷 메뉴">
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
              }
            >
              <MenuItem onSelect={handleRefresh} icon={<RefreshCw size={14} />}>
                새로고침
              </MenuItem>
              <MenuItem onSelect={() => setConfirmOpen(true)} icon={<Trash2 size={14} />} destructive>
                삭제
              </MenuItem>
            </Menu>
          </div>
          <div className={styles.primary}>{attrs.frozen.primary}</div>
          {attrs.frozen.secondary && (
            <div className={styles.secondary}>{attrs.frozen.secondary}</div>
          )}
          <div className={styles.footer}>
            <span className={styles.captured}>{formattedCapturedAt}</span>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={handleRefresh}
              disabled={refreshing}
              title="현재 값으로 갱신"
            >
              <RefreshCw size={11} strokeWidth={2} className={refreshing ? styles.spinning : ''} aria-hidden="true" />
              {refreshing ? '갱신 중…' : '새로고침'}
            </button>
            <a
              className={styles.footerBtn}
              href={attrs.sourceLink}
              onClick={handleOpenSource}
              title="원본 페이지 열기"
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
        title="이 스냅샷을 삭제할까요?"
        description="본문에서 스냅샷 카드가 제거됩니다."
        confirmLabel="삭제"
        destructive
        onConfirm={() => props.deleteNode()}
      />
    </NodeViewWrapper>
  )
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
