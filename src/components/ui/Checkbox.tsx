import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import s from './Checkbox.module.css'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, disabled, className, ...rest },
  ref,
) {
  return (
    <label className={[s.wrap, className].filter(Boolean).join(' ')} data-disabled={disabled ? 'true' : undefined}>
      <input ref={ref} type="checkbox" className={s.input} disabled={disabled} {...rest} />
      <span>{label}</span>
    </label>
  )
})
