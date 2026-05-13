import type { LabelHTMLAttributes, ReactNode } from 'react'
import s from './Field.module.css'

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[s.field, className].filter(Boolean).join(' ')}>{children}</div>
}

export function Label({
  children,
  optional,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement> & { optional?: boolean }) {
  return (
    <label className={s.label} {...rest}>
      {children}
      {optional && <span className={s.optional}>선택</span>}
    </label>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className={s.hint}>{children}</span>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <span className={s.error} role="alert">{children}</span>
}
