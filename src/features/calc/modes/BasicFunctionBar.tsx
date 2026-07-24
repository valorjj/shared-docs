import styles from './BasicFunctionBar.module.css'

type Chip = { label: string; insert: string; caret?: number }
type Group = { name: string; chips: Chip[] }

// caret = caret offset from the insert start; default = end of inserted text.
const GROUPS: Group[] = [
  {
    name: '기본',
    chips: [
      { label: '√', insert: 'sqrt()', caret: 5 },
      { label: 'x²', insert: '^2' },
      { label: 'xʸ', insert: '^' },
      { label: '( )', insert: '()', caret: 1 },
      { label: '!', insert: '!' },
    ],
  },
  {
    name: '함수',
    chips: [
      { label: 'sin', insert: 'sin()', caret: 4 },
      { label: 'cos', insert: 'cos()', caret: 4 },
      { label: 'tan', insert: 'tan()', caret: 4 },
      { label: 'ln', insert: 'ln()', caret: 3 },
      { label: 'log', insert: 'log()', caret: 4 },
      { label: 'abs', insert: 'abs()', caret: 4 },
    ],
  },
  {
    name: '상수',
    chips: [
      { label: 'π', insert: 'PI' },
      { label: 'e', insert: 'E' },
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
              aria-label={c.label}
            >
              {c.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
