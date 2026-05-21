import type { SheetData } from '../types'
import { parseCellNumber } from './sheetData'

/**
 * Tiny Excel-flavoured formula engine. Scope is deliberately small for
 * a 2-person app:
 *
 *   ✓ cell refs        A1, B2, AA3   (column letter + 1-based row)
 *   ✓ range refs       A1:A5         (used by SUM/AVERAGE/etc.)
 *   ✓ arithmetic       + - * / ( )   with unary minus
 *   ✓ functions        SUM, AVG, AVERAGE, COUNT, MIN, MAX, IF
 *   ✓ comparison       > < >= <= = <>   (for IF conditions)
 *   ✓ literals         1, 1.5, .5, "text"
 *   ✓ refs of refs     A1 = "=B1", B1 = "=C1+1"
 *   ✓ cycle detection  returns #CYCLE
 *
 * Column references map by *position*, not by `key`. That mirrors Excel:
 * delete column A and what was B becomes A; existing formulas keep
 * referencing the leftmost-now-current column, not the data that moved.
 * Same caveat applies — users editing column kinds or order should
 * eyeball their formulas.
 *
 * Storage: a cell whose value starts with `=` is treated as a formula.
 * The raw `=…` string lives in the row data; evaluation happens at
 * render time via `buildFormulaResolver(data)`.
 */

const A_CODE = 'A'.charCodeAt(0)

export function isFormulaCell(raw: string | undefined | null): boolean {
  if (raw == null) return false
  // Trim leading whitespace so "= A1" still counts.
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
  | { ok: true; value: number | string | boolean }
  | { ok: false; error: string }

export type FormulaResolver = (colIndex: number, rowIndex: number) => FormulaResult

/**
 * Build a per-data resolver that evaluates a cell's formula on demand
 * and memoizes the result inside the call so chained refs (A1→B1→C1)
 * resolve in O(n) instead of O(2^n). The same resolver protects
 * against cycles via a `visiting` set.
 *
 * Returned resolver returns `{ ok: false, error: '#REF' }` for OOB
 * coordinates so the caller can still render a sensible placeholder.
 */
export function buildFormulaResolver(data: SheetData): FormulaResolver {
  // Memoized evaluated results keyed by "col,row".
  const cache = new Map<string, FormulaResult>()
  // Track in-flight cells to detect cycles. We don't return early on
  // re-entry; we return #CYCLE so the originating formula reports it.
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
    // 2-char operators first so `>=` doesn't tokenize as `>` `=`.
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
      // Could be a cell ref (A1), a range (A1:B5), or an identifier (SUM).
      const slice = input.slice(i)
      const refMatch = REF_RE.exec(slice)
      if (refMatch) {
        const after = i + refMatch[0].length
        const fromCol = columnLetterToIndex(refMatch[1])
        const fromRow = parseInt(refMatch[2], 10) - 1
        // Range?
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
      // Plain identifier (function name, etc.)
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
//
// Grammar (precedence climbing):
//   expr     := compare
//   compare  := add ( ('=' | '<>' | '>' | '<' | '>=' | '<=') add )*
//   add      := mul ( ('+' | '-') mul )*
//   mul      := unary ( ('*' | '/') unary )*
//   unary    := '-' unary | call
//   call     := primary ( '(' args ')' )?
//   args     := expr ( ',' expr )*
//   primary  := num | str | ref | range | ident | '(' expr ')'

type EvalValue = number | string | boolean | EvalValue[]

function evalExpression(src: string, resolve: FormulaResolver): number | string | boolean {
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
    let left = parseUnary()
    while (peek()?.type === 'op') {
      const op = (peek() as { op: string }).op
      if (op !== '*' && op !== '/') break
      consume()
      const right = parseUnary()
      left = applyArith(left, right, op)
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
      // A bare range outside a function call doesn't make sense in
      // scalar context — flatten to a list so SUM-arg path can use it.
      return collectRange(t.fromCol, t.fromRow, t.toCol, t.toRow)
    }
    if (t.type === 'lparen') {
      const v = parseExpr()
      expect((x) => x?.type === 'rparen', "')'")
      return v
    }
    if (t.type === 'ident') {
      // Function call? `SUM(...)` etc.
      if (peek()?.type === 'lparen') {
        consume()
        const args: EvalValue[] = []
        if (peek()?.type !== 'rparen') {
          // Special-case range args so SUM(A1:A5) doesn't lose the range shape.
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
      // Bareword identifier — treat as the literal name (Excel allows
      // `TRUE` / `FALSE` as booleans).
      if (t.name === 'TRUE') return true
      if (t.name === 'FALSE') return false
      throw new FormulaError('#NAME', `unknown name "${t.name}"`)
    }
    throw new FormulaError('#PARSE', `unexpected token`)
  }

  function collectRange(c0: number, r0: number, c1: number, r1: number): EvalValue[] {
    const out: EvalValue[] = []
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const res = resolve(c, r)
        if (!res.ok) throw new FormulaError(res.error)
        out.push(res.value)
      }
    }
    return out
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new FormulaError('#PARSE', 'trailing input')
  // Final flatten of any single-element range that snuck through.
  if (Array.isArray(result)) {
    if (result.length === 1) return scalarize(result[0])
    throw new FormulaError('#VAL', 'range as scalar')
  }
  return scalarize(result)
}

function scalarize(v: EvalValue): number | string | boolean {
  if (Array.isArray(v)) throw new FormulaError('#VAL', 'unexpected range')
  return v
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
  // Numeric compare when both sides parse as numbers; else string compare.
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
  const as = String(a)
  const bs = String(b)
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

// ─── Built-in functions ────────────────────────────────────────────────

function callFunction(name: string, args: EvalValue[]): EvalValue {
  switch (name) {
    case 'SUM':     return sumOver(args)
    case 'AVG':
    case 'AVERAGE': return avgOver(args)
    case 'COUNT':   return countOver(args)
    case 'MIN':     return minMaxOver(args, false)
    case 'MAX':     return minMaxOver(args, true)
    case 'IF': {
      if (args.length < 2 || args.length > 3) {
        throw new FormulaError('#ARG', 'IF takes 2 or 3 args')
      }
      const cond = args[0]
      const truthy =
        typeof cond === 'boolean' ? cond :
        typeof cond === 'number'  ? cond !== 0 :
        typeof cond === 'string'  ? cond !== '' :
        Array.isArray(cond) && cond.length > 0
      if (truthy) return args[1]
      return args.length === 3 ? args[2] : false
    }
    case 'ABS':     return Math.abs(toNumber(scalarOrFirst(args, 'ABS')))
    case 'ROUND': {
      const x = toNumber(scalarOrFirst([args[0]], 'ROUND'))
      const digits = args[1] != null ? Math.trunc(toNumber(args[1])) : 0
      const f = Math.pow(10, digits)
      return Math.round(x * f) / f
    }
    case 'CONCAT': {
      let s = ''
      for (const a of args) {
        if (Array.isArray(a)) for (const x of a) s += String(x)
        else s += String(a)
      }
      return s
    }
    default:
      throw new FormulaError('#NAME', `unknown function ${name}`)
  }
}

function scalarOrFirst(args: EvalValue[], fnName: string): EvalValue {
  if (args.length !== 1) throw new FormulaError('#ARG', `${fnName} takes one arg`)
  const a = args[0]
  if (Array.isArray(a)) {
    if (a.length === 1) return a[0]
    throw new FormulaError('#ARG', `${fnName} expects a single value`)
  }
  return a
}

function* flatten(args: EvalValue[]): Generator<EvalValue> {
  for (const a of args) {
    if (Array.isArray(a)) for (const x of a) yield x
    else yield a
  }
}

function sumOver(args: EvalValue[]): number {
  let s = 0
  for (const v of flatten(args)) {
    if (v === '' || v == null) continue
    const n = tryNum(v)
    if (n != null) s += n
  }
  return s
}

function avgOver(args: EvalValue[]): number {
  let s = 0
  let c = 0
  for (const v of flatten(args)) {
    if (v === '' || v == null) continue
    const n = tryNum(v)
    if (n != null) { s += n; c++ }
  }
  if (c === 0) throw new FormulaError('#DIV0', 'average of empty range')
  return s / c
}

function countOver(args: EvalValue[]): number {
  let c = 0
  for (const v of flatten(args)) {
    if (v === '' || v == null) continue
    if (tryNum(v) != null) c++
  }
  return c
}

function minMaxOver(args: EvalValue[], max: boolean): number {
  let best: number | null = null
  for (const v of flatten(args)) {
    if (v === '' || v == null) continue
    const n = tryNum(v)
    if (n == null) continue
    if (best == null) best = n
    else best = max ? Math.max(best, n) : Math.min(best, n)
  }
  if (best == null) throw new FormulaError('#VAL', `${max ? 'MAX' : 'MIN'} of empty range`)
  return best
}

/**
 * Cheap regex-based extraction of cell + range references from a
 * formula string, used by the grid to paint precedent highlights when
 * a formula cell is focused. Doesn't fully parse — just finds tokens
 * shaped like `A1` and `A1:B5`. Good enough for the highlight UI; the
 * canonical evaluator runs separately.
 */
export type ExtractedRef =
  | { kind: 'cell'; col: number; row: number; refIndex: number }
  | { kind: 'range'; fromCol: number; fromRow: number; toCol: number; toRow: number; refIndex: number }

const REF_OR_RANGE_RE = /([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?/g

export function extractRefs(formula: string): ExtractedRef[] {
  if (!isFormulaCell(formula)) return []
  const body = formula.replace(/^\s*=/, '')
  // Strip strings so `"A1"` inside the formula doesn't get matched.
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

/** Convenience for callers that just want a final display value.
 *  Returns the evaluated number / string / boolean, or the error code
 *  (e.g. "#REF") if evaluation failed. */
export function evaluateForDisplay(
  raw: string,
  resolve: FormulaResolver,
): number | string | boolean {
  if (!isFormulaCell(raw)) return raw
  try {
    return evalExpression(raw.replace(/^\s*=/, ''), resolve)
  } catch (e) {
    if (e instanceof FormulaError) return e.code
    return '#ERR'
  }
}
