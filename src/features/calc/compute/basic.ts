import { Parser } from 'expr-eval'
import type { BasicInput, BasicOutput } from '../types'

// Sandbox the parser: pure math only, no string ops, no assignment, no I/O.
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

export function computeBasic(input: BasicInput): BasicOutput {
  const trimmed = input.expr.trim()
  if (!trimmed) {
    throw new Error('식을 입력하세요.')
  }
  const expr = parser.parse(trimmed)
  const value = expr.evaluate()
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('숫자가 아닌 결과')
  }
  return { value, formatted: formatNumber(value) }
}

function formatNumber(n: number): string {
  // Trim trailing zeros while preserving meaningful precision.
  return Number(n.toFixed(10)).toLocaleString('ko-KR', { maximumFractionDigits: 10 })
}
