import { Plus } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Fab.module.css'

interface FabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  icon?: ReactNode
}

export function Fab({ label, icon, className, ...rest }: FabProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[s.fab, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon ?? <Plus size={26} strokeWidth={2.5} aria-hidden="true" />}
    </button>
  )
}
