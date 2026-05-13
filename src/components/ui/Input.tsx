import { forwardRef, type InputHTMLAttributes } from 'react'
import s from './Input.module.css'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  align?: 'left' | 'right'
  size?: 'sm' | 'md'
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { align = 'left', size = 'md', invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[
        s.input,
        align === 'right' && s.right,
        size === 'sm' && s.sm,
        invalid && s.invalid,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})
