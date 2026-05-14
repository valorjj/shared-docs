import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { ReactNode } from 'react'
import styles from './Menu.module.css'

type MenuProps = {
  trigger: ReactNode
  children: ReactNode
  /** Defaults to 'end' so the menu hangs from the right edge of the trigger. */
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

export function Menu({ trigger, children, align = 'end', sideOffset = 4 }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={sideOffset}
          className={styles.content}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

type MenuItemProps = {
  onSelect: () => void
  children: ReactNode
  icon?: ReactNode
  destructive?: boolean
}

export function MenuItem({ onSelect, children, icon, destructive = false }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={`${styles.item}${destructive ? ` ${styles.destructive}` : ''}`}
      onSelect={(e) => {
        // Default behavior closes the menu — that's what we want.
        void e
        onSelect()
      }}
    >
      {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      <span className={styles.label}>{children}</span>
    </DropdownMenu.Item>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />
}
