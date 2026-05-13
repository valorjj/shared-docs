import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import s from './Select.module.css'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <span className={s.wrap}>
      <select
        ref={ref}
        className={[s.select, size === 'sm' && s.sm, className].filter(Boolean).join(' ')}
        {...rest}
      >
        {children}
      </select>
      <span className={s.chevron} aria-hidden="true">
        <ChevronDown size={size === 'sm' ? 14 : 16} strokeWidth={2} />
      </span>
    </span>
  )
})
