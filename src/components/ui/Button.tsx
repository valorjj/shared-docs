import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import s from './Button.module.css'

type Variant = 'primary' | 'ghost' | 'outline' | 'soft' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', full, leading, trailing, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[s.btn, s[`v-${variant}`], s[`sz-${size}`], full && s.full, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {leading}
      {children && <span>{children}</span>}
      {trailing}
    </button>
  )
})
