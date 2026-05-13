import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import s from './IconButton.module.css'

type Variant = 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = 'ghost', size = 'sm', label, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={[s.btn, s[`v-${variant}`], s[`sz-${size}`], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
})
