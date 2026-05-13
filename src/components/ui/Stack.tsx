import type { ReactNode } from 'react'
import s from './Stack.module.css'

type Gap = 1 | 2 | 3 | 4 | 5 | 6
type Align = 'start' | 'center' | 'end' | 'baseline' | 'stretch'
type Justify = 'start' | 'center' | 'end' | 'between'

interface StackProps {
  gap?: Gap
  align?: Align
  justify?: Justify
  wrap?: boolean
  className?: string
  children: ReactNode
}

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Stack({ gap = 3, align, justify, wrap, className, children }: StackProps) {
  return (
    <div
      className={cx(
        s.stack,
        s[`gap-${gap}`],
        align && s[`align-${align}`],
        justify && s[`justify-${justify}`],
        wrap && s.wrap,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Row({ gap = 2, align = 'center', justify, wrap, className, children }: StackProps) {
  return (
    <div
      className={cx(
        s.row,
        s[`gap-${gap}`],
        s[`align-${align}`],
        justify && s[`justify-${justify}`],
        wrap && s.wrap,
        className,
      )}
    >
      {children}
    </div>
  )
}
