import { Parser } from 'expr-eval'
import type { BasicInput, BasicLine, BasicOutput } from '../types'

// Sandbox the parser: pure math only, no string ops, no assignment (we
// handle `name = expr` ourselves), no I/O.
const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    remainder: true,
    power: true,
    factorial: true,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    assignment: false,
  },
})

const ASSIGNMENT = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/

/**
 * Multi-line scratchpad evaluator. Soulver-style:
 *   - `# anything` is a comment
 *   - blank lines pass through with no result
 *   - `a = 1000 * 2`  defines `a` and evaluates the RHS
 *   - `a / 10`        is a bare expression; references `a` from above
 *   - errors are scoped to a single line; later lines keep evaluating
 *
 * The "final value" is the last line that produced a number — useful
 * for the tape summary and for the embedded snapshot card.
 */
export function computeBasic(input: BasicInput): BasicOutput {
  const sources = input.body.split('\n')
  const vars: Record<string, number> = {}
  const lines: BasicLine[] = []

  for (const source of sources) {
    const trimmed = source.trim()

    if (trimmed === '') {
      lines.push({ source, kind: 'blank' })
      continue
    }
    if (trimmed.startsWith('#')) {
      lines.push({ source, kind: 'comment' })
      continue
    }

    const assign = trimmed.match(ASSIGNMENT)
    if (assign) {
      const [, name, expr] = assign
      try {
        const value = evaluateNumeric(expr, vars)
        vars[name] = value
        lines.push({
          source,
          kind: 'assign',
          name,
          value,
          formatted: formatNumber(value),
        })
      } catch (err) {
        lines.push({ source, kind: 'error', error: errorMessage(err) })
      }
      continue
    }

    try {
      const value = evaluateNumeric(trimmed, vars)
      lines.push({ source, kind: 'expr', value, formatted: formatNumber(value) })
    } catch (err) {
      lines.push({ source, kind: 'error', error: errorMessage(err) })
    }
  }

  const finalLine = [...lines].reverse().find((l) => l.value !== undefined)
  return {
    lines,
    finalValue: finalLine?.value ?? null,
    finalFormatted: finalLine?.formatted ?? '',
  }
}

function evaluateNumeric(expr: string, vars: Record<string, number>): number {
  const v = parser.parse(expr).evaluate(vars)
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('숫자가 아닌 결과')
  }
  return v
}

function formatNumber(n: number): string {
  // Trim trailing zeros, keep enough precision for finance amounts.
  return Number(n.toFixed(10)).toLocaleString('ko-KR', { maximumFractionDigits: 10 })
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    // expr-eval errors are noisy ("parse error [1:5]: unexpected ..."). Trim.
    const msg = err.message
    const colon = msg.indexOf(':')
    return colon > 0 && colon < 30 ? msg.slice(colon + 1).trim() : msg
  }
  return '계산할 수 없습니다.'
}
