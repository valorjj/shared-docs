import styles from './BasicFunctionBar.module.css'

// caret = caret offset from the insert start; default = end of inserted text.
// aria = spoken label when the glyph isn't self-descriptive.
type Chip = { label: string; insert: string; caret?: number; aria?: string }
type Group = { name: string; chips: Chip[] }

const GROUPS: Group[] = [
  {
    name: '기본',
    chips: [
      { label: '√', insert: 'sqrt()', caret: 5, aria: '제곱근' },
      { label: 'x²', insert: '^2', aria: '제곱' },
      { label: 'xʸ', insert: '^', aria: '거듭제곱' },
      { label: '( )', insert: '()', caret: 1, aria: '괄호' },
      { label: '!', insert: '!', aria: '팩토리얼' },
    ],
  },
  {
    name: '함수',
    chips: [
      { label: 'sin', insert: 'sin()', caret: 4 },
      { label: 'cos', insert: 'cos()', caret: 4 },
      { label: 'tan', insert: 'tan()', caret: 4 },
      // expr-eval's `log` is the natural log (== ln); base-10 is `log10`.
      { label: 'ln', insert: 'ln()', caret: 3, aria: '자연로그' },
      { label: 'log₁₀', insert: 'log10()', caret: 6, aria: '상용로그' },
      { label: 'abs', insert: 'abs()', caret: 4, aria: '절댓값' },
    ],
  },
  {
    name: '상수',
    chips: [
      { label: 'π', insert: 'PI', aria: '원주율' },
      { label: 'e', insert: 'E', aria: '자연상수' },
    ],
  },
]

type Props = {
  onInsert: (text: string, caretOffset?: number) => void
}

export default function BasicFunctionBar({ onInsert }: Props) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="함수 삽입">
      {GROUPS.map((g) => (
        <div key={g.name} className={styles.group}>
          <span className={styles.groupLabel}>{g.name}</span>
          {g.chips.map((c) => (
            <button
              key={c.label}
              type="button"
              className={styles.chip}
              // pointerdown + preventDefault keeps the textarea selection
              // intact so the insert lands at the caret, not at position 0
              // after a blur.
              onPointerDown={(e) => {
                e.preventDefault()
                onInsert(c.insert, c.caret)
              }}
              aria-label={c.aria ?? c.label}
            >
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
