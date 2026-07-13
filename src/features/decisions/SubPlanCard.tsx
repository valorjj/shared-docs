import {
  Pencil, Trash2, Link2, ChevronDown, ChevronRight, Plus,
  Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock, X, type LucideIcon,
} from 'lucide-react'
import DeadlineChip from './DeadlineChip'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconButton, Badge, Skeleton,
  ContextMenu, ContextMenuItem, ContextMenuDivider, ContextMenuGroup, useContextMenu,
} from '../../components/ui'
import TitleDescModal from './TitleDescModal'
import {
  useAddSubPlan, useSubPlanDetail, useUpdateSubPlan, useDeleteSubPlan,
  useSetSubPlanDeadline, useClearSubPlanDeadline, useSetAppearance,
} from './api'
import styles from './SubPlanCard.module.css'
import { ACCENT_COLORS, ACCENT_ICONS, type AccentIcon, type SubPlanNode } from './types'

const ICON_MAP: Record<AccentIcon, LucideIcon> = {
  Flag, Star, AlertTriangle, Home, Car, Heart, Briefcase, Clock,
}

const STATUS_LABEL: Record<SubPlanNode['status'], string> = {
  EMPTY: '대기', IN_PROGRESS: '진행 중', DECIDED: '결정됨',
}

export type SubPlanHighlight = 'normal' | 'source' | 'linked' | 'dim'

type SubPlanLink = { id: number; title: string }

type Props = {
  subPlan: SubPlanNode
  planId: number
  index: number
  /** Smaller visual — used one level deep for children rendered inside the
   *  foldable 서브안건 block. Nested cards don't get their own fold/expand
   *  (that would recurse-fetch indefinitely) — deeper nesting is reached by
   *  navigating into the child's own detail page. */
  nested?: boolean
  links?: { outgoing: SubPlanLink[]; incoming: SubPlanLink[] }
  onJumpToSubPlan?: (id: number) => void
  highlight?: SubPlanHighlight
  onHoverChange?: (hovered: boolean) => void
  /** Top-level cards get edit/delete/deadline wired to PlanDetail's shared
   *  modal + mutation instances. When omitted (nested children), the card
   *  manages its own local modal + mutations — it's a fully self-contained unit. */
  onEdit?: () => void
  onDelete?: () => void
  onOpenConnect?: () => void
  dragHandle?: ReactNode
  locked?: boolean
  onSetDeadline?: (deadline: string) => void
  onClearDeadline?: () => void
  deadlineBusy?: boolean
}

export default function SubPlanCard({
  subPlan, planId, index, nested = false, links, onJumpToSubPlan, highlight = 'normal', onHoverChange,
  onEdit, onDelete, onOpenConnect, dragHandle, locked, onSetDeadline, onClearDeadline, deadlineBusy,
}: Props) {
  const navigate = useNavigate()
  const detailPath = `/decisions/${planId}/subplans/${subPlan.id}`
  const openDetail = () => navigate(detailPath)
  const { decision } = subPlan
  const hasLinks = links != null && (links.outgoing.length > 0 || links.incoming.length > 0)

  const [subOpen, setSubOpen] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [localEditOpen, setLocalEditOpen] = useState(false)

  const addChild = useAddSubPlan(planId)
  const updateThis = useUpdateSubPlan()
  const deleteThis = useDeleteSubPlan()
  const setDeadlineThis = useSetSubPlanDeadline()
  const clearDeadlineThis = useClearSubPlanDeadline()
  const setAppearance = useSetAppearance()
  const menu = useContextMenu()

  // personal, per-device — lazy init (no setState-in-effect), mirrors discussion-open-{planId}
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`subplan-collapsed-${subPlan.id}`) === '1',
  )
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      localStorage.setItem(`subplan-collapsed-${subPlan.id}`, v ? '0' : '1')
      return !v
    })

  const AccentIconCmp = subPlan.icon && subPlan.icon in ICON_MAP
    ? ICON_MAP[subPlan.icon as AccentIcon]
    : null

  // Lazy fetch: only queries once expanded. Passing NaN while collapsed keeps
  // the query disabled (Number.isFinite guard already inside useSubPlanDetail)
  // without needing an extra `enabled` param on the hook.
  const { data: childDetail, isLoading: childrenLoading } = useSubPlanDetail(subOpen ? subPlan.id : NaN)

  const handleEdit = onEdit ?? (() => setLocalEditOpen(true))
  const handleDelete = onDelete ?? (() => {
    if (window.confirm('삭제할까요? 되돌릴 수 없어요.')) deleteThis.mutate(subPlan.id)
  })
  const handleSetDeadline = onSetDeadline ?? ((deadline: string) => setDeadlineThis.mutate({ id: subPlan.id, deadline }))
  const handleClearDeadline = onClearDeadline ?? (() => clearDeadlineThis.mutate(subPlan.id))
  const deadlineBusyResolved = deadlineBusy ?? (setDeadlineThis.isPending || clearDeadlineThis.isPending)

  const eyebrowLabel = nested ? '서브안건' : '안건'

  return (
    <section
      id={`subplan-${subPlan.id}`}
      className={[
        styles.section,
        nested && styles.nested,
        subPlan.accentColor && styles.accented,
        collapsed && styles.collapsed,
        highlight !== 'normal' && styles[highlight],
      ].filter(Boolean).join(' ')}
      style={subPlan.accentColor ? ({ ['--card-accent' as string]: `var(--c-tag-${subPlan.accentColor})` }) : undefined}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      {...menu.triggerProps}
    >
      <header className={styles.head}>
        <div className={styles.titleGroup}>
          <span className={styles.qno}>
            {subPlan.accentColor && <span className={styles.colorDot} aria-hidden="true" />}
            {eyebrowLabel} {index}
          </span>
          <button
            type="button"
            className={styles.titleButton}
            onClick={openDetail}
          >
            {AccentIconCmp && <AccentIconCmp size={14} aria-hidden="true" className={styles.titleIcon} />}
            {subPlan.title}
          </button>
        </div>
        {collapsed && <Badge>{STATUS_LABEL[subPlan.status]}</Badge>}
        {!locked && (
          <div className={styles.actions}>
            {dragHandle}
            {onOpenConnect && (
              <IconButton variant="ghost" size="sm" label="안건 연결" onClick={onOpenConnect}><Link2 size={14} /></IconButton>
            )}
            <IconButton variant="ghost" size="sm" label={`${eyebrowLabel} 수정`} onClick={handleEdit}><Pencil size={14} /></IconButton>
            <IconButton variant="ghost" size="sm" label={`${eyebrowLabel} 삭제`} onClick={handleDelete}><Trash2 size={14} /></IconButton>
          </div>
        )}
      </header>

      {!collapsed && (
        <>
          <div className={styles.metaRow}>
            <Badge>{STATUS_LABEL[subPlan.status]}</Badge>
            <DeadlineChip
              deadline={subPlan.deadline}
              settledAt={decision?.decidedAt ?? null}
              settledNoun="결정"
              editable={!locked && decision == null}
              busy={deadlineBusyResolved}
              onSet={handleSetDeadline}
              onClear={handleClearDeadline}
            />
          </div>

          {hasLinks && (
            <div className={styles.links}>
              {links!.outgoing.length > 0 && (
                <div className={styles.linkRow}>
                  <span className={styles.linkLabel}>연결 →</span>
                  {links!.outgoing.map((l) => (
                    <button key={`o-${l.id}`} type="button" className={styles.linkChip} onClick={() => onJumpToSubPlan?.(l.id)}>
                      {l.title}
                    </button>
                  ))}
                </div>
              )}
              {links!.incoming.length > 0 && (
                <div className={styles.linkRow}>
                  <span className={styles.linkLabel}>← 연결</span>
                  {links!.incoming.map((l) => (
                    <button key={`i-${l.id}`} type="button" className={styles.linkChip} onClick={() => onJumpToSubPlan?.(l.id)}>
                      {l.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button type="button" className={styles.openBody} onClick={openDetail} aria-label={`${subPlan.title} 열기`}>
            {subPlan.description && <span className={styles.desc}>{subPlan.description}</span>}
            <span className={styles.openRow}>
              <span className={styles.optionCount}>선택지 {subPlan.options.length}</span>
              <span className={styles.openHint}>열기<ChevronRight size={14} /></span>
            </span>
          </button>

          {!nested && (
            <div className={styles.subSection}>
              <div className={styles.subControls}>
                {subPlan.childSubPlanCount > 0 && (
                  <button
                    type="button"
                    className={styles.subToggle}
                    onClick={() => setSubOpen((v) => !v)}
                    aria-expanded={subOpen}
                  >
                    {subOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>서브안건 {subPlan.childSubPlanCount}</span>
                  </button>
                )}
                {!locked && (
                  <button type="button" className={styles.addChildBtn} onClick={() => setAddingChild(true)}>
                    <Plus size={12} />
                    <span>서브안건 추가</span>
                  </button>
                )}
              </div>

              {subOpen && (
                <div className={styles.childList}>
                  {childrenLoading && <Skeleton height={56} radius="var(--r-md)" />}
                  {childDetail?.children.map((child, i) => (
                    <SubPlanCard key={child.id} subPlan={child} planId={planId} index={i + 1} nested locked={locked} />
                  ))}
                </div>
              )}

              <TitleDescModal
                open={addingChild}
                onClose={() => setAddingChild(false)}
                entityLabel="서브안건"
                busy={addChild.isPending}
                onSubmit={(payload) => addChild.mutate(
                  { ...payload, parentSubPlanId: subPlan.id },
                  { onSuccess: () => setAddingChild(false) },
                )}
              />
            </div>
          )}
        </>
      )}

      {!onEdit && (
        <TitleDescModal
          open={localEditOpen}
          onClose={() => setLocalEditOpen(false)}
          entityLabel={eyebrowLabel}
          initial={{ title: subPlan.title, description: subPlan.description }}
          busy={updateThis.isPending}
          onSubmit={(payload) => updateThis.mutate(
            { id: subPlan.id, payload },
            { onSuccess: () => setLocalEditOpen(false) },
          )}
        />
      )}

      <ContextMenu open={menu.open} position={menu.position} onClose={menu.close}>
        <ContextMenuItem onSelect={() => { menu.close(); openDetail() }}>열기</ContextMenuItem>
        {!locked && <ContextMenuItem onSelect={() => { menu.close(); handleEdit() }}>수정</ContextMenuItem>}
        {!locked && onOpenConnect && (
          <ContextMenuItem onSelect={() => { menu.close(); onOpenConnect() }}>연결</ContextMenuItem>
        )}
        <ContextMenuDivider />
        <ContextMenuGroup label="색">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.swatch} ${subPlan.accentColor === c ? styles.swatchOn : ''}`}
              style={{ background: `var(--c-tag-${c})` }}
              aria-label={c}
              onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: c, icon: subPlan.icon })}
            />
          ))}
          <button
            type="button"
            className={`${styles.swatch} ${styles.swatchClear} ${!subPlan.accentColor ? styles.swatchOn : ''}`}
            aria-label="색 없음"
            onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: null, icon: subPlan.icon })}
          />
        </ContextMenuGroup>
        <ContextMenuGroup label="아이콘">
          {ACCENT_ICONS.map((name) => {
            const Ico = ICON_MAP[name]
            return (
              <button
                key={name}
                type="button"
                className={`${styles.iconChip} ${subPlan.icon === name ? styles.iconChipOn : ''}`}
                aria-label={name}
                onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: subPlan.accentColor, icon: name })}
              >
                <Ico size={15} />
              </button>
            )
          })}
          <button
            type="button"
            className={`${styles.iconChip} ${!subPlan.icon ? styles.iconChipOn : ''}`}
            aria-label="아이콘 없음"
            onClick={() => setAppearance.mutate({ id: subPlan.id, accentColor: subPlan.accentColor, icon: null })}
          >
            <X size={14} />
          </button>
        </ContextMenuGroup>
        <ContextMenuItem onSelect={() => { menu.close(); toggleCollapsed() }}>
          {collapsed ? '카드 펼치기' : '기본으로 접기'}
        </ContextMenuItem>
        {!locked && (
          <>
            <ContextMenuDivider />
            <ContextMenuItem danger onSelect={() => { menu.close(); handleDelete() }}>삭제</ContextMenuItem>
          </>
        )}
      </ContextMenu>
    </section>
  )
}
