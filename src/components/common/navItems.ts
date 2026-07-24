import {
  BookOpen,
  Calculator,
  Calendar,
  Database,
  Settings,
  Share2,
  Table2,
  Vote,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  Icon: LucideIcon
  label: string
  /** true → its own slot in both navs; false → lives under 더보기. */
  primary: boolean
  adminOnly?: boolean
}

/** Single source of truth for the app's primary navigation, shared by
 *  TopNav (desktop) and BottomNav (mobile) so the two never drift. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/',          Icon: BookOpen,   label: '메모',   primary: true },
  { to: '/decisions', Icon: Vote,       label: '결정',   primary: true },
  { to: '/calendar',  Icon: Calendar,   label: '캘린더', primary: true },
  { to: '/calc',      Icon: Calculator, label: '계산',   primary: true },
  { to: '/sheets',    Icon: Table2,     label: '시트',   primary: false },
  { to: '/data',      Icon: Database,   label: '데이터', primary: false },
  { to: '/shared',    Icon: Share2,     label: '공유',   primary: false },
  { to: '/admin',     Icon: Settings,   label: '관리',   primary: false, adminOnly: true },
]

/** Primary destinations — their own slot in both navs. */
export const primaryItems = (): NavItem[] => NAV_ITEMS.filter((i) => i.primary)

/** Secondary (더보기) destinations, admin-filtered. One place for the
 *  predicate so it can't drift across BottomNav / TopNav / MoreSheet. */
export const secondaryItems = (isAdmin: boolean): NavItem[] =>
  NAV_ITEMS.filter((i) => !i.primary && (!i.adminOnly || isAdmin))

/** True when the current path belongs to a secondary (더보기) destination —
 *  used to light up the 더보기 tab/dropdown. All secondary routes are
 *  non-root, so a prefix match is safe. */
export function isSecondaryActive(pathname: string, isAdmin: boolean): boolean {
  return NAV_ITEMS.some(
    (i) => !i.primary && (!i.adminOnly || isAdmin) && pathname.startsWith(i.to),
  )
}
