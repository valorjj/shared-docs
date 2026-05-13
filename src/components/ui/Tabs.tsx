import type { ReactNode } from 'react'
import s from './Tabs.module.css'

export interface TabItem<K extends string> {
  key: K
  label: ReactNode
  disabled?: boolean
}

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div className={[s.tabs, className].filter(Boolean).join(' ')} role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          disabled={t.disabled}
          onClick={() => onChange(t.key)}
          className={[s.tab, value === t.key && s.active].filter(Boolean).join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
