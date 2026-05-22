import type { SheetData } from '../types'
import { parseCellNumber } from './sheetData'

/**
 * Excel-flavoured formula engine. Scope is intentionally modest for a
 * 2-person sheet:
 *
 *   ✓ cell refs        A1, B2, AA3   (column letter + 1-based row)
 *   ✓ range refs       A1:C5         (rectangular, used by aggregations & lookups)
 *   ✓ arithmetic       + - * / ( ) ^   with unary minus
 *   ✓ comparison       > < >= <= = <>
 *   ✓ literals         1.5, "text", TRUE / FALSE
 *   ✓ functions        see FUNCTIONS catalog below
 *   ✓ refs of refs     A1 = "=B1", B1 = "=C1+1"
 *   ✓ cycle detection  returns #CYCLE
 *
 * Column references are positional, like Excel cells. Sorting or
 * inserting/deleting columns shifts existing refs — there's no
 * absolute (`$A$1`) form, no fill-down, no array formulas.
 *
 * Storage: a cell whose value starts with `=` is treated as a formula.
 * The raw `=…` string lives in the row data; evaluation happens at
 * render time via `buildFormulaResolver(data)`.
 */

const A_CODE = 'A'.charCodeAt(0)

export function isFormulaCell(raw: string | undefined | null): boolean {
  if (raw == null) return false
  return raw.trimStart().startsWith('=')
}

export function columnLetterToIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return -1
    n = n * 26 + (ch.charCodeAt(0) - A_CODE + 1)
  }
  return n - 1
}

export type FormulaResult =
  | { ok: true; value: Scalar }
  | { ok: false; error: string }

export type FormulaResolver = (colIndex: number, rowIndex: number) => FormulaResult

type Scalar = number | string | boolean

/** Rectangular range value. Internal — functions consume it for shape,
 *  the rest of the engine flattens it. */
type RangeValue = {
  __range: true
  width: number
  height: number
  rows: Scalar[][]
}

type EvalValue = Scalar | RangeValue

function isRange(v: EvalValue): v is RangeValue {
  return typeof v === 'object' && v !== null && (v as RangeValue).__range === true
}

/**
 * Per-data resolver that evaluates a cell's formula on demand and
 * memoizes the result. Cycles surface as #CYCLE; OOB coords as #REF.
 */
export function buildFormulaResolver(data: SheetData): FormulaResolver {
  const cache = new Map<string, FormulaResult>()
  const visiting = new Set<string>()

  const resolve: FormulaResolver = (colIndex, rowIndex) => {
    if (colIndex < 0 || colIndex >= data.columns.length) {
      return { ok: false, error: '#REF' }
    }
    if (rowIndex < 0 || rowIndex >= data.rows.length) {
      return { ok: false, error: '#REF' }
    }
    const key = `${colIndex},${rowIndex}`
    const cached = cache.get(key)
    if (cached) return cached
    if (visiting.has(key)) return { ok: false, error: '#CYCLE' }

    const col = data.columns[colIndex]
    const raw = String(data.rows[rowIndex][col.key] ?? '')
    if (!isFormulaCell(raw)) {
      const n = parseCellNumber(raw)
      const result: FormulaResult =
        n != null ? { ok: true, value: n } : { ok: true, value: raw }
      cache.set(key, result)
      return result
    }

    visiting.add(key)
    let result: FormulaResult
    try {
      const value = evalExpression(raw.replace(/^\s*=/, ''), resolve)
      result = { ok: true, value }
    } catch (e) {
      const msg = e instanceof FormulaError ? e.code : '#ERR'
      result = { ok: false, error: msg }
    }
    visiting.delete(key)
    cache.set(key, result)
    return result
  }

  return resolve
}

class FormulaError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

// ─── Tokenizer ────────────────────────────────────────────────────────

type Token =
  | { type: 'num'; value: number }
  | { type: 'str'; value: string }
  | { type: 'ref'; col: number; row: number }
  | { type: 'range'; fromCol: number; fromRow: number; toCol: number; toRow: number }
  | { type: 'ident'; name: string }
  | { type: 'op'; op: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }

const REF_RE = /^([A-Za-z]+)(\d+)/

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch === '(') { out.push({ type: 'lparen' }); i++; continue }
    if (ch === ')') { out.push({ type: 'rparen' }); i++; continue }
    if (ch === ',') { out.push({ type: 'comma' }); i++; continue }
    if (ch === '"') {
      let j = i + 1
      let s = ''
      while (j < input.length && input[j] !== '"') { s += input[j]; j++ }
      if (j >= input.length) throw new FormulaError('#PARSE', 'unterminated string')
      out.push({ type: 'str', value: s })
      i = j + 1
      continue
    }
    const two = input.slice(i, i + 2)
    if (two === '>=' || two === '<=' || two === '<>') {
      out.push({ type: 'op', op: two }); i += 2; continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' ||
        ch === '>' || ch === '<' || ch === '=' || ch === '^' || ch === '%') {
      out.push({ type: 'op', op: ch }); i++; continue
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i
      while (j < input.length && (
        (input[j] >= '0' && input[j] <= '9') || input[j] === '.'
      )) j++
      const num = Number(input.slice(i, j))
      if (!Number.isFinite(num)) throw new FormulaError('#NUM', `bad number "${input.slice(i, j)}"`)
      out.push({ type: 'num', value: num })
      i = j
      continue
    }
    if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
      const slice = input.slice(i)
      const refMatch = REF_RE.exec(slice)
      if (refMatch) {
        const after = i + refMatch[0].length
        const fromCol = columnLetterToIndex(refMatch[1])
        const fromRow = parseInt(refMatch[2], 10) - 1
        if (input[after] === ':') {
          const rest = input.slice(after + 1)
          const refMatch2 = REF_RE.exec(rest)
          if (refMatch2) {
            const toCol = columnLetterToIndex(refMatch2[1])
            const toRow = parseInt(refMatch2[2], 10) - 1
            out.push({
              type: 'range',
              fromCol: Math.min(fromCol, toCol),
              fromRow: Math.min(fromRow, toRow),
              toCol: Math.max(fromCol, toCol),
              toRow: Math.max(fromRow, toRow),
            })
            i = after + 1 + refMatch2[0].length
            continue
          }
        }
        out.push({ type: 'ref', col: fromCol, row: fromRow })
        i = after
        continue
      }
      let j = i
      while (j < input.length && (
        (input[j] >= 'A' && input[j] <= 'Z') ||
        (input[j] >= 'a' && input[j] <= 'z') ||
        (input[j] >= '0' && input[j] <= '9') ||
        input[j] === '_'
      )) j++
      out.push({ type: 'ident', name: input.slice(i, j).toUpperCase() })
      i = j
      continue
    }
    throw new FormulaError('#PARSE', `unexpected character "${ch}"`)
  }
  return out
}

// ─── Parser + Evaluator (recursive descent) ───────────────────────────

function evalExpression(src: string, resolve: FormulaResolver): Scalar {
  const tokens = tokenize(src)
  let pos = 0

  const peek = () => tokens[pos]
  const consume = () => tokens[pos++]
  const expect = (pred: (t: Token | undefined) => boolean, what: string) => {
    const t = peek()
    if (!pred(t)) throw new FormulaError('#PARSE', `expected ${what}`)
    return consume()
  }

  function parseExpr(): EvalValue {
    let left = parseAdd()
    while (peek()?.type === 'op' && isCompareOp((peek() as { op: string }).op)) {
      const op = (consume() as { op: string }).op
      const right = parseAdd()
      left = compareValues(left, right, op)
    }
    return left
  }

  function parseAdd(): EvalValue {
    let left = parseMul()
    while (peek()?.type === 'op') {
      const op = (peek() as { op: string }).op
      if (op !== '+' && op !== '-') break
      consume()
      const right = parseMul()
      left = applyArith(left, right, op)
    }
    return left
  }

  function parseMul(): EvalValue {
    let left = parsePow()
    while (peek()?.type === 'op') {
      const op = (peek() as { op: string }).op
      if (op !== '*' && op !== '/') break
      consume()
      const right = parsePow()
      left = applyArith(left, right, op)
    }
    return left
  }

  function parsePow(): EvalValue {
    let left = parseUnary()
    while (peek()?.type === 'op' && (peek() as { op: string }).op === '^') {
      consume()
      const right = parseUnary()
      left = Math.pow(toNumber(left), toNumber(right))
    }
    return left
  }

  function parseUnary(): EvalValue {
    const t = peek()
    if (t?.type === 'op' && t.op === '-') {
      consume()
      const v = parseUnary()
      return -toNumber(v)
    }
    if (t?.type === 'op' && t.op === '+') {
      consume()
      return parseUnary()
    }
    return parsePrimary()
  }

  function parsePrimary(): EvalValue {
    const t = consume()
    if (!t) throw new FormulaError('#PARSE', 'unexpected end of expression')
    if (t.type === 'num') return t.value
    if (t.type === 'str') return t.value
    if (t.type === 'ref') {
      const r = resolve(t.col, t.row)
      if (!r.ok) throw new FormulaError(r.error)
      return r.value
    }
    if (t.type === 'range') {
      return collectRange(t.fromCol, t.fromRow, t.toCol, t.toRow)
    }
    if (t.type === 'lparen') {
      const v = parseExpr()
      expect((x) => x?.type === 'rparen', "')'")
      return v
    }
    if (t.type === 'ident') {
      if (peek()?.type === 'lparen') {
        consume()
        const args: EvalValue[] = []
        if (peek()?.type !== 'rparen') {
          do {
            const next = peek()
            if (next?.type === 'range') {
              consume()
              args.push(collectRange(next.fromCol, next.fromRow, next.toCol, next.toRow))
            } else {
              args.push(parseExpr())
            }
          } while (peek()?.type === 'comma' && (consume(), true))
        }
        expect((x) => x?.type === 'rparen', "')'")
        return callFunction(t.name, args)
      }
      if (t.name === 'TRUE') return true
      if (t.name === 'FALSE') return false
      throw new FormulaError('#NAME', `unknown name "${t.name}"`)
    }
    throw new FormulaError('#PARSE', `unexpected token`)
  }

  function collectRange(c0: number, r0: number, c1: number, r1: number): RangeValue {
    const rows: Scalar[][] = []
    for (let r = r0; r <= r1; r++) {
      const row: Scalar[] = []
      for (let c = c0; c <= c1; c++) {
        const res = resolve(c, r)
        if (!res.ok) throw new FormulaError(res.error)
        row.push(res.value)
      }
      rows.push(row)
    }
    return {
      __range: true,
      width: c1 - c0 + 1,
      height: r1 - r0 + 1,
      rows,
    }
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new FormulaError('#PARSE', 'trailing input')
  if (isRange(result)) {
    // Single-cell range collapses to that cell; otherwise scalar context error.
    if (result.width === 1 && result.height === 1) return result.rows[0][0]
    throw new FormulaError('#VAL', 'range as scalar')
  }
  return result
}

function isCompareOp(op: string): boolean {
  return op === '=' || op === '<>' || op === '>' || op === '<' || op === '>=' || op === '<='
}

function toNumber(v: EvalValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    if (v === '') return 0
    const n = parseCellNumber(v)
    if (n == null) throw new FormulaError('#VAL', `not numeric: "${v}"`)
    return n
  }
  throw new FormulaError('#VAL', 'range in numeric position')
}

function applyArith(a: EvalValue, b: EvalValue, op: string): number {
  const x = toNumber(a)
  const y = toNumber(b)
  switch (op) {
    case '+': return x + y
    case '-': return x - y
    case '*': return x * y
    case '/':
      if (y === 0) throw new FormulaError('#DIV0', 'divide by zero')
      return x / y
    default:
      throw new FormulaError('#PARSE', `unknown op ${op}`)
  }
}

function compareValues(a: EvalValue, b: EvalValue, op: string): boolean {
  const an = tryNum(a)
  const bn = tryNum(b)
  if (an != null && bn != null) {
    switch (op) {
      case '=':  return an === bn
      case '<>': return an !== bn
      case '>':  return an > bn
      case '<':  return an < bn
      case '>=': return an >= bn
      case '<=': return an <= bn
    }
  }
  const as = stringify(a)
  const bs = stringify(b)
  switch (op) {
    case '=':  return as === bs
    case '<>': return as !== bs
    case '>':  return as > bs
    case '<':  return as < bs
    case '>=': return as >= bs
    case '<=': return as <= bs
    default:   throw new FormulaError('#PARSE', `unknown compare ${op}`)
  }
}

function tryNum(v: EvalValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') return parseCellNumber(v)
  return null
}

function stringify(v: EvalValue): string {
  if (isRange(v)) return ''
  return String(v)
}

// ─── Built-in functions ────────────────────────────────────────────────

function callFunction(name: string, args: EvalValue[]): EvalValue {
  const fn = FUNCTION_IMPL[name]
  if (!fn) throw new FormulaError('#NAME', `unknown function ${name}`)
  return fn(args)
}

function* flatten(args: EvalValue[]): Generator<Scalar> {
  for (const a of args) {
    if (isRange(a)) {
      for (const row of a.rows) for (const cell of row) yield cell
    } else {
      yield a
    }
  }
}

function scalarOrFirst(args: EvalValue[], fnName: string): Scalar {
  if (args.length !== 1) throw new FormulaError('#ARG', `${fnName} takes one arg`)
  const a = args[0]
  if (isRange(a)) {
    if (a.width === 1 && a.height === 1) return a.rows[0][0]
    throw new FormulaError('#ARG', `${fnName} expects a single value`)
  }
  return a
}

function requireRange(v: EvalValue, fnName: string): RangeValue {
  if (!isRange(v)) throw new FormulaError('#ARG', `${fnName} expects a range`)
  return v
}

function compareForLookup(a: Scalar, b: Scalar): boolean {
  const an = parseCellNumber(String(a))
  const bn = parseCellNumber(String(b))
  if (an != null && bn != null) return an === bn
  return String(a).toLowerCase() === String(b).toLowerCase()
}

function matchesCriterion(value: Scalar, criterion: Scalar): boolean {
  // Excel's COUNTIF/SUMIF criteria can be ">10", "<>0", or a literal.
  const s = String(criterion).trim()
  const opMatch = /^(>=|<=|<>|>|<|=)(.*)$/.exec(s)
  if (opMatch) {
    const [, op, rest] = opMatch
    const numTarget = parseCellNumber(rest.trim())
    const numValue = parseCellNumber(String(value))
    if (numTarget != null && numValue != null) {
      switch (op) {
        case '>':  return numValue > numTarget
        case '<':  return numValue < numTarget
        case '>=': return numValue >= numTarget
        case '<=': return numValue <= numTarget
        case '=':  return numValue === numTarget
        case '<>': return numValue !== numTarget
      }
    }
    // String comparison fallback
    const sv = String(value).toLowerCase()
    const sc = rest.trim().toLowerCase()
    switch (op) {
      case '=':  return sv === sc
      case '<>': return sv !== sc
      case '>':  return sv > sc
      case '<':  return sv < sc
      case '>=': return sv >= sc
      case '<=': return sv <= sc
    }
  }
  return compareForLookup(value, criterion)
}

const KRW_DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }

const FUNCTION_IMPL: Record<string, (args: EvalValue[]) => EvalValue> = {
  // ─── Math / aggregate ───────────────────────────────────────────────
  SUM: (args) => {
    let s = 0
    for (const v of flatten(args)) {
      const n = tryNum(v)
      if (n != null) s += n
    }
    return s
  },
  AVERAGE: (args) => avg(args),
  AVG: (args) => avg(args),
  COUNT: (args) => {
    let c = 0
    for (const v of flatten(args)) if (tryNum(v) != null && v !== '') c++
    return c
  },
  COUNTA: (args) => {
    let c = 0
    for (const v of flatten(args)) if (v !== '' && v != null) c++
    return c
  },
  MIN: (args) => minMax(args, false),
  MAX: (args) => minMax(args, true),
  PRODUCT: (args) => {
    let p = 1
    let any = false
    for (const v of flatten(args)) {
      const n = tryNum(v)
      if (n != null) { p *= n; any = true }
    }
    return any ? p : 0
  },
  MEDIAN: (args) => {
    const nums: number[] = []
    for (const v of flatten(args)) {
      const n = tryNum(v)
      if (n != null) nums.push(n)
    }
    if (nums.length === 0) throw new FormulaError('#NUM', 'MEDIAN of empty range')
    nums.sort((a, b) => a - b)
    const mid = Math.floor(nums.length / 2)
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2
  },
  ABS: (args) => Math.abs(toNumber(scalarOrFirst(args, 'ABS'))),
  SQRT: (args) => {
    const x = toNumber(scalarOrFirst(args, 'SQRT'))
    if (x < 0) throw new FormulaError('#NUM', 'SQRT of negative')
    return Math.sqrt(x)
  },
  POWER: (args) => {
    if (args.length !== 2) throw new FormulaError('#ARG', 'POWER takes 2 args')
    return Math.pow(toNumber(args[0]), toNumber(args[1]))
  },
  MOD: (args) => {
    if (args.length !== 2) throw new FormulaError('#ARG', 'MOD takes 2 args')
    const b = toNumber(args[1])
    if (b === 0) throw new FormulaError('#DIV0', 'MOD by zero')
    return toNumber(args[0]) - b * Math.floor(toNumber(args[0]) / b)
  },
  INT: (args) => Math.floor(toNumber(scalarOrFirst(args, 'INT'))),
  ROUND: (args) => {
    const x = toNumber(args[0])
    const digits = args[1] != null ? Math.trunc(toNumber(args[1])) : 0
    const f = Math.pow(10, digits)
    return Math.round(x * f) / f
  },
  ROUNDUP: (args) => {
    const x = toNumber(args[0])
    const digits = args[1] != null ? Math.trunc(toNumber(args[1])) : 0
    const f = Math.pow(10, digits)
    return (x >= 0 ? Math.ceil(x * f) : Math.floor(x * f)) / f
  },
  ROUNDDOWN: (args) => {
    const x = toNumber(args[0])
    const digits = args[1] != null ? Math.trunc(toNumber(args[1])) : 0
    const f = Math.pow(10, digits)
    return (x >= 0 ? Math.floor(x * f) : Math.ceil(x * f)) / f
  },
  // ─── Conditional aggregate ──────────────────────────────────────────
  COUNTIF: (args) => {
    if (args.length !== 2) throw new FormulaError('#ARG', 'COUNTIF takes 2 args')
    const range = requireRange(args[0], 'COUNTIF')
    const crit = isRange(args[1]) ? args[1].rows[0]?.[0] ?? '' : args[1]
    let n = 0
    for (const row of range.rows) {
      for (const v of row) if (matchesCriterion(v, crit)) n++
    }
    return n
  },
  SUMIF: (args) => {
    if (args.length !== 2 && args.length !== 3) throw new FormulaError('#ARG', 'SUMIF takes 2-3 args')
    const range = requireRange(args[0], 'SUMIF')
    const crit = isRange(args[1]) ? args[1].rows[0]?.[0] ?? '' : args[1]
    const sumRange = args[2] != null ? requireRange(args[2], 'SUMIF') : range
    let s = 0
    for (let r = 0; r < range.rows.length; r++) {
      for (let c = 0; c < range.rows[r].length; c++) {
        if (!matchesCriterion(range.rows[r][c], crit)) continue
        const candidate = sumRange.rows[r]?.[c]
        const n = candidate != null ? tryNum(candidate) : null
        if (n != null) s += n
      }
    }
    return s
  },
  // ─── Logical ────────────────────────────────────────────────────────
  IF: (args) => {
    if (args.length < 2 || args.length > 3) throw new FormulaError('#ARG', 'IF takes 2 or 3 args')
    const cond = args[0]
    const truthy =
      typeof cond === 'boolean' ? cond :
      typeof cond === 'number'  ? cond !== 0 :
      typeof cond === 'string'  ? cond !== '' && cond.toLowerCase() !== 'false' :
      false
    if (truthy) return args[1]
    return args.length === 3 ? args[2] : false
  },
  AND: (args) => {
    for (const v of flatten(args)) {
      if (typeof v === 'boolean' && !v) return false
      if (typeof v === 'number' && v === 0) return false
      if (typeof v === 'string' && (v === '' || v.toLowerCase() === 'false')) return false
    }
    return true
  },
  OR: (args) => {
    for (const v of flatten(args)) {
      if (typeof v === 'boolean' && v) return true
      if (typeof v === 'number' && v !== 0) return true
      if (typeof v === 'string' && v !== '' && v.toLowerCase() !== 'false') return true
    }
    return false
  },
  NOT: (args) => {
    const v = scalarOrFirst(args, 'NOT')
    if (typeof v === 'boolean') return !v
    if (typeof v === 'number') return v === 0
    if (typeof v === 'string') return v === '' || v.toLowerCase() === 'false'
    return false
  },
  // ─── Lookup ─────────────────────────────────────────────────────────
  VLOOKUP: (args) => {
    // VLOOKUP(lookup, range, col_index, [exact])
    if (args.length < 3 || args.length > 4) throw new FormulaError('#ARG', 'VLOOKUP takes 3-4 args')
    const lookup = scalarOrFirst([args[0]], 'VLOOKUP')
    const range = requireRange(args[1], 'VLOOKUP')
    const colIdx = Math.trunc(toNumber(args[2])) - 1
    if (colIdx < 0 || colIdx >= range.width) return '#REF'
    // Default to exact match (Excel defaults to approx; we choose exact
    // because it's safer for daily-life use and easier to reason about).
    const exact = args[3] == null ? true : !asBool(args[3])
    for (const row of range.rows) {
      if (compareForLookup(row[0], lookup) === exact || (exact && compareForLookup(row[0], lookup))) {
        return row[colIdx]
      }
    }
    return '#N/A'
  },
  HLOOKUP: (args) => {
    // HLOOKUP(lookup, range, row_index, [exact])
    if (args.length < 3 || args.length > 4) throw new FormulaError('#ARG', 'HLOOKUP takes 3-4 args')
    const lookup = scalarOrFirst([args[0]], 'HLOOKUP')
    const range = requireRange(args[1], 'HLOOKUP')
    const rowIdx = Math.trunc(toNumber(args[2])) - 1
    if (rowIdx < 0 || rowIdx >= range.height) return '#REF'
    if (range.rows.length === 0) return '#N/A'
    const top = range.rows[0]
    for (let c = 0; c < top.length; c++) {
      if (compareForLookup(top[c], lookup)) return range.rows[rowIdx][c]
    }
    return '#N/A'
  },
  MATCH: (args) => {
    // MATCH(lookup, range, [match_type]) — returns 1-based index
    if (args.length < 2 || args.length > 3) throw new FormulaError('#ARG', 'MATCH takes 2-3 args')
    const lookup = scalarOrFirst([args[0]], 'MATCH')
    const range = requireRange(args[1], 'MATCH')
    // Flatten — MATCH operates on a vector
    const flat: Scalar[] = []
    for (const row of range.rows) for (const c of row) flat.push(c)
    for (let i = 0; i < flat.length; i++) {
      if (compareForLookup(flat[i], lookup)) return i + 1
    }
    return '#N/A'
  },
  INDEX: (args) => {
    // INDEX(range, row, [col])
    if (args.length < 2 || args.length > 3) throw new FormulaError('#ARG', 'INDEX takes 2-3 args')
    const range = requireRange(args[0], 'INDEX')
    const rIdx = Math.trunc(toNumber(args[1])) - 1
    const cIdx = args[2] != null ? Math.trunc(toNumber(args[2])) - 1 : 0
    if (rIdx < 0 || rIdx >= range.height) return '#REF'
    if (cIdx < 0 || cIdx >= range.width) return '#REF'
    return range.rows[rIdx][cIdx]
  },
  // ─── Text ───────────────────────────────────────────────────────────
  CONCAT: (args) => {
    let s = ''
    for (const v of flatten(args)) s += stringifyScalar(v)
    return s
  },
  CONCATENATE: (args) => {
    let s = ''
    for (const v of flatten(args)) s += stringifyScalar(v)
    return s
  },
  LEN: (args) => stringifyScalar(scalarOrFirst(args, 'LEN')).length,
  TRIM: (args) => stringifyScalar(scalarOrFirst(args, 'TRIM')).trim().replace(/\s+/g, ' '),
  LOWER: (args) => stringifyScalar(scalarOrFirst(args, 'LOWER')).toLowerCase(),
  UPPER: (args) => stringifyScalar(scalarOrFirst(args, 'UPPER')).toUpperCase(),
  LEFT: (args) => {
    const s = stringifyScalar(args[0])
    const n = args[1] != null ? Math.max(0, Math.trunc(toNumber(args[1]))) : 1
    return s.slice(0, n)
  },
  RIGHT: (args) => {
    const s = stringifyScalar(args[0])
    const n = args[1] != null ? Math.max(0, Math.trunc(toNumber(args[1]))) : 1
    return n === 0 ? '' : s.slice(-n)
  },
  MID: (args) => {
    if (args.length !== 3) throw new FormulaError('#ARG', 'MID takes 3 args')
    const s = stringifyScalar(args[0])
    const start = Math.trunc(toNumber(args[1])) - 1
    const len = Math.trunc(toNumber(args[2]))
    return s.slice(Math.max(0, start), Math.max(0, start) + Math.max(0, len))
  },
  // ─── Date ───────────────────────────────────────────────────────────
  TODAY: (args) => {
    if (args.length !== 0) throw new FormulaError('#ARG', 'TODAY takes no args')
    const d = new Date()
    return d.toLocaleDateString('ko-KR', KRW_DATE_FMT).replace(/\.\s?/g, '.').replace(/\.$/, '')
  },
  NOW: (args) => {
    if (args.length !== 0) throw new FormulaError('#ARG', 'NOW takes no args')
    return new Date().toLocaleString('ko-KR')
  },
}

function avg(args: EvalValue[]): number {
  let s = 0
  let c = 0
  for (const v of flatten(args)) {
    const n = tryNum(v)
    if (n != null && v !== '') { s += n; c++ }
  }
  if (c === 0) throw new FormulaError('#DIV0', 'average of empty range')
  return s / c
}

function minMax(args: EvalValue[], max: boolean): number {
  let best: number | null = null
  for (const v of flatten(args)) {
    const n = tryNum(v)
    if (n == null) continue
    if (best == null) best = n
    else best = max ? Math.max(best, n) : Math.min(best, n)
  }
  if (best == null) throw new FormulaError('#VAL', `${max ? 'MAX' : 'MIN'} of empty range`)
  return best
}

function stringifyScalar(v: EvalValue): string {
  if (isRange(v)) {
    // Fall back to first cell for accidental range-in-string-arg cases.
    return v.rows.length && v.rows[0].length ? String(v.rows[0][0]) : ''
  }
  return String(v)
}

function asBool(v: EvalValue): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v.toLowerCase() !== 'false'
  return false
}

// ─── Public helpers ───────────────────────────────────────────────────

/**
 * Cheap regex-based extraction of cell + range references — used by
 * the grid to paint precedent highlights. Distinct from the parser.
 */
export type ExtractedRef =
  | { kind: 'cell'; col: number; row: number; refIndex: number }
  | {
      kind: 'range'
      fromCol: number; fromRow: number; toCol: number; toRow: number; refIndex: number
    }

const REF_OR_RANGE_RE = /([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?/g

export function extractRefs(formula: string): ExtractedRef[] {
  if (!isFormulaCell(formula)) return []
  const body = formula.replace(/^\s*=/, '')
  const stripped = body.replace(/"[^"]*"/g, '')
  const out: ExtractedRef[] = []
  let m: RegExpExecArray | null
  let i = 0
  REF_OR_RANGE_RE.lastIndex = 0
  while ((m = REF_OR_RANGE_RE.exec(stripped)) !== null) {
    const fromCol = columnLetterToIndex(m[1])
    const fromRow = parseInt(m[2], 10) - 1
    if (fromCol < 0 || fromRow < 0) continue
    if (m[3] != null && m[4] != null) {
      const toCol = columnLetterToIndex(m[3])
      const toRow = parseInt(m[4], 10) - 1
      if (toCol < 0 || toRow < 0) continue
      out.push({
        kind: 'range',
        fromCol: Math.min(fromCol, toCol),
        fromRow: Math.min(fromRow, toRow),
        toCol: Math.max(fromCol, toCol),
        toRow: Math.max(fromRow, toRow),
        refIndex: i++,
      })
    } else {
      out.push({ kind: 'cell', col: fromCol, row: fromRow, refIndex: i++ })
    }
  }
  return out
}

export function evaluateForDisplay(
  raw: string,
  resolve: FormulaResolver,
): Scalar {
  if (!isFormulaCell(raw)) return raw
  try {
    return evalExpression(raw.replace(/^\s*=/, ''), resolve)
  } catch (e) {
    if (e instanceof FormulaError) return e.code
    return '#ERR'
  }
}

// ─── Function autocomplete catalog ────────────────────────────────────

export type FunctionMeta = {
  name: string
  signature: string
  description: string
}

/** Surfaced to the autocomplete popup. Order = display order. */
export const FUNCTIONS: FunctionMeta[] = [
  { name: 'SUM', signature: 'SUM(범위, …)', description: '합계' },
  { name: 'AVERAGE', signature: 'AVERAGE(범위, …)', description: '평균' },
  { name: 'COUNT', signature: 'COUNT(범위)', description: '숫자 셀 개수' },
  { name: 'COUNTA', signature: 'COUNTA(범위)', description: '비어 있지 않은 셀 개수' },
  { name: 'MIN', signature: 'MIN(범위, …)', description: '최솟값' },
  { name: 'MAX', signature: 'MAX(범위, …)', description: '최댓값' },
  { name: 'MEDIAN', signature: 'MEDIAN(범위, …)', description: '중앙값' },
  { name: 'PRODUCT', signature: 'PRODUCT(범위, …)', description: '곱' },
  { name: 'ABS', signature: 'ABS(값)', description: '절댓값' },
  { name: 'SQRT', signature: 'SQRT(값)', description: '제곱근' },
  { name: 'POWER', signature: 'POWER(밑, 지수)', description: '거듭제곱' },
  { name: 'MOD', signature: 'MOD(값, 제수)', description: '나머지' },
  { name: 'INT', signature: 'INT(값)', description: '정수 부분 (내림)' },
  { name: 'ROUND', signature: 'ROUND(값, 자리수)', description: '반올림' },
  { name: 'ROUNDUP', signature: 'ROUNDUP(값, 자리수)', description: '올림' },
  { name: 'ROUNDDOWN', signature: 'ROUNDDOWN(값, 자리수)', description: '내림' },
  { name: 'COUNTIF', signature: 'COUNTIF(범위, 조건)', description: '조건 만족 셀 개수' },
  { name: 'SUMIF', signature: 'SUMIF(범위, 조건, [합계범위])', description: '조건 만족 셀의 합' },
  { name: 'IF', signature: 'IF(조건, 참값, [거짓값])', description: '조건 분기' },
  { name: 'AND', signature: 'AND(조건, …)', description: '모두 참이면 참' },
  { name: 'OR', signature: 'OR(조건, …)', description: '하나라도 참이면 참' },
  { name: 'NOT', signature: 'NOT(조건)', description: '논리 부정' },
  { name: 'VLOOKUP', signature: 'VLOOKUP(찾을값, 범위, 열번호, [정확])', description: '세로 방향 조회' },
  { name: 'HLOOKUP', signature: 'HLOOKUP(찾을값, 범위, 행번호, [정확])', description: '가로 방향 조회' },
  { name: 'MATCH', signature: 'MATCH(찾을값, 범위)', description: '값의 위치 (1-based)' },
  { name: 'INDEX', signature: 'INDEX(범위, 행, [열])', description: '범위에서 항목 가져오기' },
  { name: 'CONCAT', signature: 'CONCAT(값, …)', description: '문자열 연결' },
  { name: 'LEN', signature: 'LEN(문자열)', description: '글자 수' },
  { name: 'TRIM', signature: 'TRIM(문자열)', description: '앞/뒤 공백 제거' },
  { name: 'LOWER', signature: 'LOWER(문자열)', description: '소문자' },
  { name: 'UPPER', signature: 'UPPER(문자열)', description: '대문자' },
  { name: 'LEFT', signature: 'LEFT(문자열, [개수])', description: '왼쪽 N글자' },
  { name: 'RIGHT', signature: 'RIGHT(문자열, [개수])', description: '오른쪽 N글자' },
  { name: 'MID', signature: 'MID(문자열, 시작, 길이)', description: '부분 문자열' },
  { name: 'TODAY', signature: 'TODAY()', description: '오늘 날짜' },
  { name: 'NOW', signature: 'NOW()', description: '현재 날짜·시각' },
]

const FUNCTION_NAME_SET = new Set(FUNCTIONS.map((f) => f.name))

/**
 * Given the in-flight formula text + caret, find the function-name
 * token the user is currently typing (if any). Used by the cell editor
 * to drive the autocomplete popup.
 */
export type AutocompleteContext = {
  /** Letters captured so far, uppercased. Empty string right after `=`. */
  query: string
  /** Doc-offsets of the identifier slice — caller replaces this range
   *  with `name(` on selection. */
  start: number
  end: number
}

const TRIGGER_PREVS = new Set(['=', '(', ',', '+', '-', '*', '/', ' '])

export function getAutocompleteContext(text: string, caret: number): AutocompleteContext | null {
  if (!isFormulaCell(text)) return null
  if (caret < 1) return null
  // Walk back to the start of the letter run containing the caret.
  let s = caret
  while (s > 0 && /[A-Za-z_]/.test(text[s - 1])) s--
  // Walk forward to the end of the same letter+digit run.
  let e = caret
  while (e < text.length && /[A-Za-z_0-9]/.test(text[e])) e++
  const prev = s > 0 ? text[s - 1] : ''
  if (!TRIGGER_PREVS.has(prev)) return null
  return { query: text.slice(s, e).toUpperCase(), start: s, end: e }
}

export function matchFunctions(query: string): FunctionMeta[] {
  if (!query) return FUNCTIONS
  // Prefix match first, then substring; both case-insensitive.
  const q = query.toUpperCase()
  const prefix: FunctionMeta[] = []
  const substr: FunctionMeta[] = []
  for (const fn of FUNCTIONS) {
    if (fn.name === q || fn.name.startsWith(q)) prefix.push(fn)
    else if (fn.name.includes(q)) substr.push(fn)
  }
  return [...prefix, ...substr]
}

export function isKnownFunctionName(name: string): boolean {
  return FUNCTION_NAME_SET.has(name.toUpperCase())
}
