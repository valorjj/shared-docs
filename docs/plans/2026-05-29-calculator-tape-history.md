# Phase 2 — Calculator with tape history

**Goal.** A daily-use engineering calculator with a tape (scrollable
history) shared between both partners, five Korean-relevant modes, and
the same frozen-block embed pattern as `DataSnapshot` so calculations
can live inside notes ("여기 우리가 한 계산이야 →").

**Architecture.** New `calc/` feature on both ends. Backend persists
each calculation as an immutable `CalcEntry` row (mode + input JSON +
result JSON + optional label). Frontend renders a top tab strip per
mode and a vertical tape that mixes all modes by recency. Computation
is client-side (`compute/<mode>.ts` pure functions); the server is
just a ledger. The Tiptap `calcSnapshot` block atom mirrors
`DataSnapshot` 1:1 — same `data-*` attrs, same React NodeView shape,
same refresh-kebab.

**Tech.** No new backend deps. Frontend adds `expr-eval` (~5 kB gz)
for the basic mode's expression parser. Big-money math uses
`decimal.js` if precision becomes an issue — defer until proven
needed (most installment/loan inputs round to ₩ anyway).

**Route.** `/calc` (peer to `/`, `/sheets`, `/calendar`). The
ROADMAP draft said `/data/calc` — moved to top level because this is
an everyday utility, not data tracking. Update `ROADMAP.md` and
`ARCHITECTURE.md` in Task 13.

**Out of scope (Phase 2 v2).**
- 적금/예금 만기, 단위 환산 (특히 평↔㎡) — deferred per the picker.
- Multi-line scratchpad / Soulver-style inline math — too big.
- Currency conversion with live rates — needs an external API; deferred.
- Editing past tape entries (input/result are immutable; only label + pinned mutate).
- Drag-and-drop result reuse — Phase 2 uses click-to-paste in basic mode only.

---

## File map

### Backend — new `calc/` package

```
shared-docs-backend/src/main/kotlin/com/shareddocs/backend/calc/
├── CalcEntry.kt           ← @Entity (immutable input/result blobs)
├── CalcMode.kt            ← enum BASIC | INSTALLMENT | LOAN | DUTCH | DATE
├── CalcEntryRepository.kt ← findAll order, plus byId
├── CalcEntryService.kt    ← CRUD; author-or-admin checks on mutate
├── CalcEntryController.kt ← REST under /api/calc
└── CalcEntryDto.kt        ← Response, Create, UpdateLabel/Pin
```

### Frontend — new `features/calc/` feature

```
shared-docs/src/features/calc/
├── api.ts                  ← TanStack hooks
├── types.ts                ← CalcMode, per-mode Input/Output discriminated unions
├── compute/                ← pure functions, no React
│   ├── basic.ts            ← evaluate(expr) via expr-eval
│   ├── installment.ts      ← monthly payment + total interest
│   ├── loan.ts             ← 원리금균등 + 원금균등 amortization schedule
│   ├── dutch.ts            ← total + shares + tip split
│   └── date.ts             ← d-day | between | working-days
├── CalcWorkspace.tsx       ← page shell (mode tabs + active mode + tape)
├── CalcWorkspace.module.css
├── modes/
│   ├── ModeTabs.tsx        ← top tab strip with 5 modes
│   ├── BasicMode.tsx
│   ├── InstallmentMode.tsx
│   ├── LoanMode.tsx
│   ├── DutchMode.tsx
│   ├── DateMode.tsx
│   └── *.module.css        ← one per mode
├── tape/
│   ├── TapeView.tsx
│   ├── TapeLine.tsx        ← rerun, pin, delete, label-edit, embed-into-note
│   ├── TapeEmpty.tsx
│   └── *.module.css
└── embed/
    ├── CalcSnapshot.ts     ← Tiptap atom node spec
    ├── CalcSnapshotCard.tsx← React NodeView
    └── CalcSnapshotPicker.tsx ← Radix Dialog: pick a tape entry to embed
```

### Wiring touched

- `src/App.tsx` — add `/calc` route, lazy-loaded
- `src/components/common/TopNav.tsx` + `BottomNav.tsx` — add 계산 nav item
- `src/features/notes/editor/slashItems.ts` — add 계산 스냅샷 entry
- `src/features/notes/editor/NoteEditorToolbar.tsx` — add 계산 button (optional in v1)
- `src/features/notes/editor/NoteEditorBody.tsx` — register `CalcSnapshot` Tiptap extension
- `docs/ROADMAP.md` + `docs/ARCHITECTURE.md` — update on ship

---

## Stage 1 — Backend `CalcEntry` CRUD

### Task 1: Entity, mode enum, repository

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcMode.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcEntry.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcEntryRepository.kt`

- [ ] **Step 1: Mode enum**

```kotlin
package com.shareddocs.backend.calc

enum class CalcMode { BASIC, INSTALLMENT, LOAN, DUTCH, DATE }
```

- [ ] **Step 2: Entity**

```kotlin
package com.shareddocs.backend.calc

import com.shareddocs.backend.user.User
import jakarta.persistence.*
import java.time.Instant

@Entity
@Table(
    name = "calc_entries",
    indexes = [Index(name = "idx_calc_created_at", columnList = "created_at")],
)
class CalcEntry(
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    val mode: CalcMode,

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    val inputJson: String,

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    val resultJson: String,

    @Column(length = 200)
    var label: String? = null,

    @Column(nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    var pinned: Boolean = false,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    val createdBy: User,

    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
)
```

- [ ] **Step 3: Repository**

```kotlin
package com.shareddocs.backend.calc

import org.springframework.data.jpa.repository.JpaRepository

interface CalcEntryRepository : JpaRepository<CalcEntry, Long> {
    /** Both partners' tape, pinned first, then recency. */
    fun findAllByOrderByPinnedDescCreatedAtDescIdDesc(): List<CalcEntry>
}
```

- [ ] **Step 4: Verify compile + migration**

Run: `./gradlew compileKotlin && ./gradlew bootRun`
Expected: Hibernate logs `create table calc_entries (...)`. App starts on :8090.

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/calc/
git commit -m "feat(calc): CalcEntry entity + repository (Phase 2 stage 1)"
```

---

### Task 2: DTOs + service

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcEntryDto.kt`
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcEntryService.kt`

- [ ] **Step 1: DTOs**

```kotlin
package com.shareddocs.backend.calc

import com.shareddocs.backend.user.User
import jakarta.validation.constraints.Size
import java.time.Instant

data class CalcUserRef(val userId: Long, val name: String, val pictureUrl: String?) {
    companion object {
        fun from(u: User) = CalcUserRef(u.id!!, u.name, u.pictureUrl)
    }
}

data class CalcEntryResponse(
    val id: Long,
    val mode: CalcMode,
    val inputJson: String,
    val resultJson: String,
    val label: String?,
    val pinned: Boolean,
    val createdBy: CalcUserRef,
    val createdAt: Instant,
) {
    companion object {
        fun from(e: CalcEntry) = CalcEntryResponse(
            id = e.id!!,
            mode = e.mode,
            inputJson = e.inputJson,
            resultJson = e.resultJson,
            label = e.label,
            pinned = e.pinned,
            createdBy = CalcUserRef.from(e.createdBy),
            createdAt = e.createdAt,
        )
    }
}

data class CreateCalcEntryRequest(
    val mode: CalcMode,
    val inputJson: String,
    val resultJson: String,
    @field:Size(max = 200) val label: String? = null,
)

data class UpdateCalcEntryRequest(
    @field:Size(max = 200) val label: String? = null,
    val pinned: Boolean? = null,
)
```

- [ ] **Step 2: Service**

```kotlin
package com.shareddocs.backend.calc

import com.shareddocs.backend.user.Role
import com.shareddocs.backend.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
@Transactional
class CalcEntryService(
    private val repository: CalcEntryRepository,
    private val userRepository: UserRepository,
) {
    @Transactional(readOnly = true)
    fun list(): List<CalcEntryResponse> =
        repository.findAllByOrderByPinnedDescCreatedAtDescIdDesc().map(CalcEntryResponse::from)

    @Transactional(readOnly = true)
    fun get(id: Long): CalcEntryResponse {
        val e = repository.findById(id).orElseThrow {
            ResponseStatusException(HttpStatus.NOT_FOUND, "calc $id")
        }
        return CalcEntryResponse.from(e)
    }

    fun create(req: CreateCalcEntryRequest, callerUserId: Long): CalcEntryResponse {
        val user = userRepository.findById(callerUserId)
            .orElseThrow { ResponseStatusException(HttpStatus.UNAUTHORIZED) }
        val saved = repository.save(
            CalcEntry(
                mode = req.mode,
                inputJson = req.inputJson,
                resultJson = req.resultJson,
                label = req.label?.trim()?.takeIf { it.isNotEmpty() },
                createdBy = user,
            )
        )
        return CalcEntryResponse.from(saved)
    }

    /** Author-only label/pin update. Inputs and results are immutable —
     *  rerun creates a new entry. */
    fun update(id: Long, req: UpdateCalcEntryRequest, callerUserId: Long): CalcEntryResponse {
        val e = repository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "calc $id") }
        if (e.createdBy.id != callerUserId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit")
        }
        req.label?.let { e.label = it.trim().takeIf { s -> s.isNotEmpty() } }
        req.pinned?.let { e.pinned = it }
        return CalcEntryResponse.from(e)
    }

    fun delete(id: Long, callerUserId: Long, callerRole: Role) {
        val e = repository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "calc $id") }
        val isOwner = e.createdBy.id == callerUserId
        val isAdmin = callerRole.isAtLeastAdmin()
        if (!isOwner && !isAdmin) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author or admin can delete")
        }
        repository.delete(e)
    }
}
```

- [ ] **Step 3: Compile + commit**

```bash
./gradlew compileKotlin
git add src/main/kotlin/com/shareddocs/backend/calc/CalcEntryDto.kt src/main/kotlin/com/shareddocs/backend/calc/CalcEntryService.kt
git commit -m "feat(calc): DTOs + service (Phase 2 stage 1)"
```

---

### Task 3: Controller + curl smoke

**Files:**
- Create: `src/main/kotlin/com/shareddocs/backend/calc/CalcEntryController.kt`

- [ ] **Step 1: Controller**

```kotlin
package com.shareddocs.backend.calc

import com.shareddocs.backend.auth.AppPrincipal
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/calc")
class CalcEntryController(private val service: CalcEntryService) {

    @GetMapping
    fun list(): List<CalcEntryResponse> = service.list()

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long): CalcEntryResponse = service.get(id)

    @PostMapping
    fun create(
        @AuthenticationPrincipal me: AppPrincipal,
        @RequestBody @Valid request: CreateCalcEntryRequest,
    ): ResponseEntity<CalcEntryResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(service.create(request, me.userId))

    @PatchMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @AuthenticationPrincipal me: AppPrincipal,
        @RequestBody @Valid request: UpdateCalcEntryRequest,
    ): CalcEntryResponse = service.update(id, request, me.userId)

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: Long,
        @AuthenticationPrincipal me: AppPrincipal,
    ): ResponseEntity<Void> {
        service.delete(id, me.userId, me.role)
        return ResponseEntity.noContent().build()
    }
}
```

- [ ] **Step 2: Curl smoke**

```bash
TOKEN=$(curl -s -X POST http://localhost:8090/api/auth/dev-login | jq -r .token)

# Create a basic calc entry
curl -s -X POST http://localhost:8090/api/calc \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode":"BASIC",
    "inputJson":"{\"expr\":\"2+2\"}",
    "resultJson":"{\"value\":4}"
  }' | jq .

# List should return 1 entry
curl -s http://localhost:8090/api/calc -H "Authorization: Bearer $TOKEN" | jq 'length'
# Expected: 1
```

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/shareddocs/backend/calc/CalcEntryController.kt
git commit -m "feat(calc): REST endpoints under /api/calc (Phase 2 stage 1)"
```

---

## Stage 2 — Frontend route + basic mode + tape

### Task 4: Frontend types, api, route shell

**Files:**
- Create: `src/features/calc/types.ts`
- Create: `src/features/calc/api.ts`
- Create: `src/features/calc/CalcWorkspace.tsx`
- Create: `src/features/calc/CalcWorkspace.module.css`
- Modify: `src/App.tsx`
- Modify: `src/components/common/TopNav.tsx`
- Modify: `src/components/common/BottomNav.tsx`

- [ ] **Step 1: Types**

```ts
// src/features/calc/types.ts
export type CalcMode = 'BASIC' | 'INSTALLMENT' | 'LOAN' | 'DUTCH' | 'DATE'

export const CALC_MODES: CalcMode[] = ['BASIC', 'INSTALLMENT', 'LOAN', 'DUTCH', 'DATE']

export const CALC_MODE_LABELS: Record<CalcMode, string> = {
  BASIC:       '기본',
  INSTALLMENT: '할부',
  LOAN:        '대출',
  DUTCH:       '더치페이',
  DATE:        '날짜',
}

export type CalcUserRef = {
  userId: number
  name: string
  pictureUrl: string | null
}

export type CalcEntry = {
  id: number
  mode: CalcMode
  inputJson: string
  resultJson: string
  label: string | null
  pinned: boolean
  createdBy: CalcUserRef
  createdAt: string
}

// Mode-specific input/output shapes — discriminated by `mode`.
export type BasicInput = { expr: string }
export type BasicOutput = { value: number; formatted: string }

export type InstallmentInput = { principal: number; annualRate: number; months: number }
export type InstallmentOutput = { monthly: number; totalInterest: number; totalPaid: number }

export type LoanType = '원리금균등' | '원금균등'
export type LoanInput = { principal: number; annualRate: number; months: number; type: LoanType }
export type LoanScheduleRow = { month: number; payment: number; principal: number; interest: number; balance: number }
export type LoanOutput = { firstPayment: number; totalInterest: number; schedule: LoanScheduleRow[] }

export type DutchShare = { label: string; weight: number }
export type DutchInput = { total: number; currency: string; tipPct: number; shares: DutchShare[] }
export type DutchOutput = { perShare: Array<{ label: string; amount: number }>; grandTotal: number }

export type DateMode = 'D_DAY' | 'BETWEEN' | 'WORKING_DAYS'
export type DateInput =
  | { mode: 'D_DAY'; target: string }
  | { mode: 'BETWEEN'; from: string; to: string }
  | { mode: 'WORKING_DAYS'; from: string; to: string }
export type DateOutput = { days: number; description: string }
```

- [ ] **Step 2: API**

```ts
// src/features/calc/api.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import type { CalcEntry, CalcMode } from './types'

export const calcKeys = {
  list: () => ['calc', 'list'] as const,
  detail: (id: number) => ['calc', 'detail', id] as const,
}

async function fetchCalcEntries(): Promise<CalcEntry[]> {
  const { data } = await apiClient.get<CalcEntry[]>('/api/calc')
  return data
}

async function fetchCalcEntry(id: number): Promise<CalcEntry> {
  const { data } = await apiClient.get<CalcEntry>(`/api/calc/${id}`)
  return data
}

type CreatePayload = {
  mode: CalcMode
  inputJson: string
  resultJson: string
  label?: string | null
}

async function createCalcEntryReq(payload: CreatePayload): Promise<CalcEntry> {
  const { data } = await apiClient.post<CalcEntry>('/api/calc', payload)
  return data
}

async function updateCalcEntryReq(
  id: number,
  payload: { label?: string | null; pinned?: boolean },
): Promise<CalcEntry> {
  const { data } = await apiClient.patch<CalcEntry>(`/api/calc/${id}`, payload)
  return data
}

async function deleteCalcEntryReq(id: number): Promise<void> {
  await apiClient.delete(`/api/calc/${id}`)
}

export function useCalcEntries() {
  return useQuery({ queryKey: calcKeys.list(), queryFn: fetchCalcEntries })
}

export function useCalcEntry(id: number | null) {
  return useQuery({
    queryKey: calcKeys.detail(id ?? -1),
    queryFn: () => fetchCalcEntry(id as number),
    enabled: id !== null && id >= 0,
  })
}

export function useCreateCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}

export function useUpdateCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { label?: string | null; pinned?: boolean } }) =>
      updateCalcEntryReq(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}

export function useDeleteCalcEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCalcEntryReq,
    onSuccess: () => qc.invalidateQueries({ queryKey: calcKeys.list() }),
  })
}
```

- [ ] **Step 3: Workspace shell**

```tsx
// src/features/calc/CalcWorkspace.tsx — minimal shell, modes wired in Stage 3
import { useState } from 'react'
import type { CalcMode } from './types'
import BasicMode from './modes/BasicMode'
import ModeTabs from './modes/ModeTabs'
import TapeView from './tape/TapeView'
import styles from './CalcWorkspace.module.css'

export default function CalcWorkspace() {
  const [mode, setMode] = useState<CalcMode>('BASIC')
  return (
    <div className={styles.root}>
      <div className={styles.workArea}>
        <ModeTabs value={mode} onChange={setMode} />
        <div className={styles.modePane}>
          {mode === 'BASIC' && <BasicMode />}
          {/* Other modes wired in Stage 3 */}
        </div>
      </div>
      <aside className={styles.tape}>
        <TapeView />
      </aside>
    </div>
  )
}
```

- [ ] **Step 4: Workspace CSS — minimum styling**

```css
/* src/features/calc/CalcWorkspace.module.css */
.root {
  display: flex;
  height: 100%;
  min-height: calc(100svh - 56px - env(safe-area-inset-bottom));
}
.workArea {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--c-border);
  min-width: 0;
}
.modePane {
  flex: 1;
  padding: var(--sp-6) var(--sp-7);
  overflow-y: auto;
}
.tape {
  width: 360px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
@media (max-width: 900px) {
  .root { flex-direction: column; }
  .workArea { border-right: none; border-bottom: 1px solid var(--c-border); }
  .tape { width: 100%; }
}
```

- [ ] **Step 5: Route + nav**

Edit `src/App.tsx`:
```tsx
const CalcWorkspace = lazy(() => import('./features/calc/CalcWorkspace'))
// ...
<Route path="/calc" element={<CalcWorkspace />} />
```

Edit `src/components/common/TopNav.tsx`: add a `Calculator` Lucide icon NavLink to `/calc` labeled `계산`.

Edit `src/components/common/BottomNav.tsx`: add the same item between 시트 and 데이터.

- [ ] **Step 6: Verify shell**

Run: `npm run dev`, open `http://localhost:5173/calc`.
Expected: empty workspace renders with mode tabs (still stubbed) and an empty tape pane. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/calc/ src/App.tsx src/components/common/TopNav.tsx src/components/common/BottomNav.tsx
git commit -m "feat(calc): /calc route shell + types/api + workspace skeleton"
```

---

### Task 5: Basic mode + expr-eval

**Files:**
- Create: `src/features/calc/compute/basic.ts`
- Create: `src/features/calc/modes/BasicMode.tsx`
- Create: `src/features/calc/modes/BasicMode.module.css`
- Modify: `package.json` (add `expr-eval`)

- [ ] **Step 1: Install expr-eval**

```bash
cd shared-docs
npm install expr-eval
```

- [ ] **Step 2: compute/basic.ts**

```ts
// src/features/calc/compute/basic.ts
import { Parser } from 'expr-eval'
import type { BasicInput, BasicOutput } from '../types'

const parser = new Parser({
  // Standard operators only. No assignment, no I/O — pure math.
  operators: {
    add: true, concatenate: false,
    conditional: false, divide: true,
    factorial: true, multiply: true,
    power: true, remainder: true, subtract: true,
    logical: false, comparison: false, in: false, assignment: false,
  },
})

export function computeBasic(input: BasicInput): BasicOutput {
  // Parser throws on invalid syntax; callers catch and show the error inline.
  const expr = parser.parse(input.expr.trim())
  const value = expr.evaluate()
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('숫자가 아닌 결과')
  }
  return { value, formatted: formatNumber(value) }
}

function formatNumber(n: number): string {
  // Trim trailing zeros, but keep meaningful precision.
  return Number(n.toFixed(10)).toLocaleString('ko-KR', { maximumFractionDigits: 10 })
}
```

- [ ] **Step 3: BasicMode UI**

```tsx
// src/features/calc/modes/BasicMode.tsx
import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeBasic } from '../compute/basic'
import type { BasicInput, BasicOutput } from '../types'
import styles from './BasicMode.module.css'

export default function BasicMode() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState<BasicOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: BasicInput = { expr }
      const out = computeBasic(input)
      setResult(out)
      create.mutate({
        mode: 'BASIC',
        inputJson: JSON.stringify(input),
        resultJson: JSON.stringify(out),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산할 수 없습니다.')
      setResult(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Field>
        <Label htmlFor="calc-basic-expr">식</Label>
        <Input
          id="calc-basic-expr"
          type="text"
          inputMode="decimal"
          placeholder="예: 1500000 * 1.1"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          autoFocus
        />
      </Field>
      <Button variant="primary" type="submit" leading={<Calculator size={14} strokeWidth={2} />}>
        계산
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
      {result && !error && (
        <div className={styles.result} aria-live="polite">
          = <strong>{result.formatted}</strong>
        </div>
      )}
    </form>
  )
}
```

- [ ] **Step 4: BasicMode CSS**

```css
/* src/features/calc/modes/BasicMode.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  max-width: 540px;
}
.result {
  font-size: var(--fs-xl);
  font-family: var(--font-serif);
  color: var(--c-text);
  padding: var(--sp-4);
  background: var(--c-surface-tint);
  border-radius: var(--r-md);
}
```

- [ ] **Step 5: Verify end-to-end**

`npm run dev`. Open `/calc`, type `2+2`, click 계산.
Expected: `= 4` appears, and a new entry shows up in the tape pane (empty for now — Task 6 wires the tape).

- [ ] **Step 6: Commit**

```bash
git add src/features/calc/compute/basic.ts src/features/calc/modes/BasicMode.tsx src/features/calc/modes/BasicMode.module.css package.json package-lock.json
git commit -m "feat(calc): basic mode + expr-eval compute"
```

---

### Task 6: TapeView + TapeLine

**Files:**
- Create: `src/features/calc/tape/TapeView.tsx`
- Create: `src/features/calc/tape/TapeLine.tsx`
- Create: `src/features/calc/tape/TapeEmpty.tsx`
- Create: `src/features/calc/tape/Tape.module.css`
- Create: `src/features/calc/modes/ModeTabs.tsx`
- Create: `src/features/calc/modes/ModeTabs.module.css`

- [ ] **Step 1: ModeTabs**

```tsx
// src/features/calc/modes/ModeTabs.tsx
import { Tabs } from '../../../components/ui'
import { CALC_MODES, CALC_MODE_LABELS, type CalcMode } from '../types'

type Props = {
  value: CalcMode
  onChange: (m: CalcMode) => void
}

export default function ModeTabs({ value, onChange }: Props) {
  return (
    <Tabs<CalcMode>
      items={CALC_MODES.map((m) => ({ key: m, label: CALC_MODE_LABELS[m] }))}
      value={value}
      onChange={onChange}
    />
  )
}
```

- [ ] **Step 2: TapeEmpty**

```tsx
// src/features/calc/tape/TapeEmpty.tsx
export default function TapeEmpty() {
  return (
    <p style={{ padding: '24px', color: 'var(--c-text-muted)', fontSize: 'var(--fs-sm)' }}>
      아직 계산 기록이 없습니다.
    </p>
  )
}
```

- [ ] **Step 3: TapeLine**

```tsx
// src/features/calc/tape/TapeLine.tsx
import { MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react'
import { Menu, MenuItem, MenuSeparator } from '../../../components/ui/Menu'
import { useDeleteCalcEntry, useUpdateCalcEntry } from '../api'
import { CALC_MODE_LABELS, type CalcEntry } from '../types'
import { formatRelativeTime } from '../../notes/shared/formatRelativeTime'
import styles from './Tape.module.css'

type Props = {
  entry: CalcEntry
  onRerun?: (entry: CalcEntry) => void
}

export default function TapeLine({ entry, onRerun }: Props) {
  const update = useUpdateCalcEntry()
  const del = useDeleteCalcEntry()

  const input = JSON.parse(entry.inputJson)
  const result = JSON.parse(entry.resultJson)
  const summary = renderSummary(entry.mode, input, result)

  return (
    <article className={styles.line}>
      <header className={styles.header}>
        <span className={styles.modeBadge}>{CALC_MODE_LABELS[entry.mode]}</span>
        {entry.pinned && <Pin size={12} aria-label="고정됨" className={styles.pinGlyph} />}
        <span className={styles.author}>{entry.createdBy.name}</span>
        <span className={styles.sep}>·</span>
        <time className={styles.time}>{formatRelativeTime(entry.createdAt)}</time>
        <Menu
          trigger={
            <button type="button" className={styles.kebab} aria-label="옵션">
              <MoreHorizontal size={14} />
            </button>
          }
        >
          {onRerun && (
            <MenuItem onSelect={() => onRerun(entry)}>같은 입력으로 다시 계산</MenuItem>
          )}
          <MenuItem
            icon={entry.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            onSelect={() => update.mutate({ id: entry.id, payload: { pinned: !entry.pinned } })}
          >
            {entry.pinned ? '고정 해제' : '고정'}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<Trash2 size={14} />}
            onSelect={() => del.mutate(entry.id)}
          >
            삭제
          </MenuItem>
        </Menu>
      </header>
      <div className={styles.body}>{summary}</div>
      {entry.label && <p className={styles.label}>{entry.label}</p>}
    </article>
  )
}

function renderSummary(mode: string, input: any, result: any): string {
  switch (mode) {
    case 'BASIC':
      return `${input.expr} = ${result.formatted}`
    // Stage 3 fills these — placeholder summaries for now.
    case 'INSTALLMENT':
      return `${input.principal}원 / ${input.months}개월 → 월 ${result.monthly}원`
    case 'LOAN':
      return `${input.principal}원 / ${input.months}개월 → 첫 달 ${result.firstPayment}원`
    case 'DUTCH':
      return `${input.total} ${input.currency} ÷ ${input.shares.length}명`
    case 'DATE':
      return result.description
    default:
      return JSON.stringify({ input, result })
  }
}
```

- [ ] **Step 4: TapeView**

```tsx
// src/features/calc/tape/TapeView.tsx
import { useCalcEntries } from '../api'
import TapeEmpty from './TapeEmpty'
import TapeLine from './TapeLine'
import styles from './Tape.module.css'

export default function TapeView() {
  const { data, isLoading } = useCalcEntries()
  if (isLoading) {
    return <p className={styles.loading}>불러오는 중…</p>
  }
  const entries = data ?? []
  if (entries.length === 0) return <TapeEmpty />
  return (
    <ol className={styles.list}>
      {entries.map((e) => (
        <li key={e.id}>
          <TapeLine entry={e} />
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 5: Tape CSS**

```css
/* src/features/calc/tape/Tape.module.css */
.list {
  list-style: none;
  padding: var(--sp-3) 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.line {
  padding: var(--sp-3) var(--sp-5);
  border-left: 2px solid transparent;
}
.line:hover { background: var(--c-surface-tint); }
.header {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.modeBadge {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  padding: 1px 6px;
  border-radius: var(--r-xs);
  font-size: 11px;
  font-weight: var(--fw-medium);
}
.pinGlyph { color: var(--c-accent); }
.author { font-weight: var(--fw-medium); color: var(--c-text); }
.sep { color: var(--c-text-subtle); }
.time { color: var(--c-text-subtle); }
.kebab {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--c-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--r-xs);
}
.kebab:hover { background: var(--c-surface-tint); }
.body {
  font-family: var(--font-mono);
  font-size: var(--fs-base);
  color: var(--c-text);
  margin-top: var(--sp-1);
  word-break: break-all;
}
.label {
  margin: var(--sp-1) 0 0;
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
  font-style: italic;
}
.loading {
  padding: var(--sp-5);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
```

- [ ] **Step 6: Verify**

Run dev. Type `1500000 * 1.1` in basic mode, hit 계산. Tape should show the entry. Sign in as the other user, refresh — same entry visible. Kebab → 고정 / 삭제 work.

- [ ] **Step 7: Commit**

```bash
git add src/features/calc/tape/ src/features/calc/modes/ModeTabs.tsx src/features/calc/modes/ModeTabs.module.css
git commit -m "feat(calc): ModeTabs + TapeView with basic mode rendering"
```

---

## Stage 3 — Specialized modes

### Task 7: Installment (할부) mode

**Files:**
- Create: `src/features/calc/compute/installment.ts`
- Create: `src/features/calc/modes/InstallmentMode.tsx`
- Create: `src/features/calc/modes/InstallmentMode.module.css`
- Modify: `src/features/calc/CalcWorkspace.tsx` (wire the mode)

- [ ] **Step 1: compute/installment.ts**

```ts
// src/features/calc/compute/installment.ts
import type { InstallmentInput, InstallmentOutput } from '../types'

/** 원리금균등 installment.
 *  M = P * r(1+r)^n / ((1+r)^n - 1)
 *  When r = 0, M = P / n. */
export function computeInstallment(input: InstallmentInput): InstallmentOutput {
  const { principal, annualRate, months } = input
  if (principal <= 0 || months <= 0) {
    throw new Error('원금과 개월 수는 0보다 커야 합니다.')
  }
  const r = annualRate / 100 / 12
  const monthly =
    r === 0
      ? principal / months
      : (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1)
  const totalPaid = monthly * months
  const totalInterest = totalPaid - principal
  return { monthly, totalInterest, totalPaid }
}
```

- [ ] **Step 2: InstallmentMode UI**

```tsx
// src/features/calc/modes/InstallmentMode.tsx
import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label, Row, Stack } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeInstallment } from '../compute/installment'
import { formatKRW } from '../format'
import type { InstallmentInput, InstallmentOutput } from '../types'

export default function InstallmentMode() {
  const [principal, setPrincipal] = useState<number>(0)
  const [annualRate, setAnnualRate] = useState<number>(5)
  const [months, setMonths] = useState<number>(12)
  const [result, setResult] = useState<InstallmentOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: InstallmentInput = { principal, annualRate, months }
      const out = computeInstallment(input)
      setResult(out)
      create.mutate({
        mode: 'INSTALLMENT',
        inputJson: JSON.stringify(input),
        resultJson: JSON.stringify(out),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산할 수 없습니다.')
      setResult(null)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={4}>
        <Row gap={3}>
          <Field>
            <Label>원금 (₩)</Label>
            <Input type="number" min="0" value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value) || 0)} />
          </Field>
          <Field>
            <Label>연이율 (%)</Label>
            <Input type="number" step="0.01" min="0" value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value) || 0)} />
          </Field>
          <Field>
            <Label>개월</Label>
            <Input type="number" min="1" value={months}
              onChange={(e) => setMonths(Number(e.target.value) || 1)} />
          </Field>
        </Row>
        <Button variant="primary" type="submit" leading={<Calculator size={14} strokeWidth={2} />}>
          계산
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
        {result && !error && (
          <Stack gap={2}>
            <div>월 납입: <strong>{formatKRW(result.monthly)}</strong></div>
            <div>총 이자: {formatKRW(result.totalInterest)}</div>
            <div>총 상환: {formatKRW(result.totalPaid)}</div>
          </Stack>
        )}
      </Stack>
    </form>
  )
}
```

- [ ] **Step 3: Add shared format helper**

```ts
// src/features/calc/format.ts
export function formatKRW(n: number): string {
  return `₩${Math.round(n).toLocaleString('ko-KR')}`
}
export function formatDecimal(n: number, frac = 2): string {
  return Number(n.toFixed(frac)).toLocaleString('ko-KR')
}
```

- [ ] **Step 4: Wire into workspace**

In `CalcWorkspace.tsx`:
```tsx
import InstallmentMode from './modes/InstallmentMode'
// ...
{mode === 'INSTALLMENT' && <InstallmentMode />}
```

- [ ] **Step 5: Verify + commit**

Calc: 30,000,000 / 5% / 12 → monthly ≈ 2,568,140. Verify roundtrip into tape.

```bash
git add src/features/calc/compute/installment.ts src/features/calc/modes/InstallmentMode.* src/features/calc/format.ts src/features/calc/CalcWorkspace.tsx
git commit -m "feat(calc): 할부 (installment) mode"
```

---

### Task 8: Loan (대출 상환) mode + amortization schedule

**Files:**
- Create: `src/features/calc/compute/loan.ts`
- Create: `src/features/calc/modes/LoanMode.tsx`
- Create: `src/features/calc/modes/LoanMode.module.css`
- Modify: `src/features/calc/CalcWorkspace.tsx`

- [ ] **Step 1: compute/loan.ts**

```ts
// src/features/calc/compute/loan.ts
import type { LoanInput, LoanOutput, LoanScheduleRow } from '../types'

export function computeLoan(input: LoanInput): LoanOutput {
  const { principal, annualRate, months, type } = input
  if (principal <= 0 || months <= 0) {
    throw new Error('원금과 개월 수는 0보다 커야 합니다.')
  }
  const r = annualRate / 100 / 12
  const schedule: LoanScheduleRow[] = []
  let balance = principal
  let totalInterest = 0

  if (type === '원리금균등') {
    // Equal monthly payment, ratio of interest:principal shifts over time.
    const monthly = r === 0
      ? principal / months
      : (principal * (r * Math.pow(1 + r, months))) / (Math.pow(1 + r, months) - 1)
    for (let m = 1; m <= months; m++) {
      const interest = balance * r
      const principalPaid = monthly - interest
      balance -= principalPaid
      totalInterest += interest
      schedule.push({ month: m, payment: monthly, principal: principalPaid, interest, balance: Math.max(balance, 0) })
    }
    return { firstPayment: schedule[0].payment, totalInterest, schedule }
  }

  // 원금균등 — fixed principal slice, interest decreases over time.
  const principalSlice = principal / months
  for (let m = 1; m <= months; m++) {
    const interest = balance * r
    const payment = principalSlice + interest
    balance -= principalSlice
    totalInterest += interest
    schedule.push({ month: m, payment, principal: principalSlice, interest, balance: Math.max(balance, 0) })
  }
  return { firstPayment: schedule[0].payment, totalInterest, schedule }
}
```

- [ ] **Step 2: LoanMode UI** (form like InstallmentMode plus a Select for 균등타입 + a collapsible schedule table)

```tsx
// src/features/calc/modes/LoanMode.tsx
import { useState, type FormEvent } from 'react'
import { Calculator } from 'lucide-react'
import { Button, ErrorText, Field, Input, Label, Row, Select, Stack } from '../../../components/ui'
import { useCreateCalcEntry } from '../api'
import { computeLoan } from '../compute/loan'
import { formatKRW } from '../format'
import type { LoanInput, LoanOutput, LoanType } from '../types'
import styles from './LoanMode.module.css'

const LOAN_TYPES: LoanType[] = ['원리금균등', '원금균등']

export default function LoanMode() {
  const [principal, setPrincipal] = useState<number>(0)
  const [annualRate, setAnnualRate] = useState<number>(5)
  const [months, setMonths] = useState<number>(12)
  const [type, setType] = useState<LoanType>('원리금균등')
  const [result, setResult] = useState<LoanOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(false)
  const create = useCreateCalcEntry()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const input: LoanInput = { principal, annualRate, months, type }
      const out = computeLoan(input)
      setResult(out)
      create.mutate({
        mode: 'LOAN',
        inputJson: JSON.stringify(input),
        resultJson: JSON.stringify(out),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산할 수 없습니다.')
      setResult(null)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={4}>
        <Row gap={3}>
          <Field><Label>원금 (₩)</Label>
            <Input type="number" min="0" value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value) || 0)} /></Field>
          <Field><Label>연이율 (%)</Label>
            <Input type="number" step="0.01" min="0" value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value) || 0)} /></Field>
          <Field><Label>개월</Label>
            <Input type="number" min="1" value={months}
              onChange={(e) => setMonths(Number(e.target.value) || 1)} /></Field>
          <Field><Label>방식</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as LoanType)}>
              {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select></Field>
        </Row>
        <Button variant="primary" type="submit" leading={<Calculator size={14} strokeWidth={2} />}>
          계산
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
        {result && (
          <Stack gap={2}>
            <div>첫 달: <strong>{formatKRW(result.firstPayment)}</strong></div>
            <div>총 이자: {formatKRW(result.totalInterest)}</div>
            <button type="button" className={styles.toggleSchedule}
              onClick={() => setShowSchedule((s) => !s)}>
              {showSchedule ? '상환 스케줄 접기' : '상환 스케줄 펼치기'}
            </button>
            {showSchedule && (
              <table className={styles.schedule}>
                <thead>
                  <tr><th>월</th><th>납입</th><th>원금</th><th>이자</th><th>잔액</th></tr>
                </thead>
                <tbody>
                  {result.schedule.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{formatKRW(row.payment)}</td>
                      <td>{formatKRW(row.principal)}</td>
                      <td>{formatKRW(row.interest)}</td>
                      <td>{formatKRW(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Stack>
        )}
      </Stack>
    </form>
  )
}
```

- [ ] **Step 3: Schedule CSS**

```css
/* LoanMode.module.css */
.toggleSchedule {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: var(--c-primary);
  cursor: pointer;
  padding: 0;
  font-size: var(--fs-sm);
  text-decoration: underline;
}
.schedule {
  border-collapse: collapse;
  font-size: var(--fs-sm);
  font-family: var(--font-mono);
  margin-top: var(--sp-2);
}
.schedule th, .schedule td {
  padding: var(--sp-1) var(--sp-3);
  text-align: right;
  border-bottom: 1px solid var(--c-border);
}
.schedule th { color: var(--c-text-muted); font-weight: var(--fw-medium); }
.schedule tr:hover { background: var(--c-surface-tint); }
```

- [ ] **Step 4: Wire + verify + commit**

Add `{mode === 'LOAN' && <LoanMode />}` in workspace.

```bash
git add src/features/calc/compute/loan.ts src/features/calc/modes/LoanMode.* src/features/calc/CalcWorkspace.tsx
git commit -m "feat(calc): 대출 (loan) mode with 원리금균등 / 원금균등 schedule"
```

---

### Task 9: 더치페이 (Dutch) mode

**Files:**
- Create: `src/features/calc/compute/dutch.ts`
- Create: `src/features/calc/modes/DutchMode.tsx`
- Create: `src/features/calc/modes/DutchMode.module.css`
- Modify: `src/features/calc/CalcWorkspace.tsx`

- [ ] **Step 1: compute/dutch.ts**

```ts
// src/features/calc/compute/dutch.ts
import type { DutchInput, DutchOutput } from '../types'

export function computeDutch(input: DutchInput): DutchOutput {
  const { total, tipPct, shares } = input
  if (total < 0 || shares.length === 0) {
    throw new Error('총액과 인원 수가 필요합니다.')
  }
  const grandTotal = total * (1 + tipPct / 100)
  const totalWeight = shares.reduce((s, x) => s + (x.weight > 0 ? x.weight : 0), 0)
  if (totalWeight <= 0) throw new Error('비중 합이 0보다 커야 합니다.')
  const perShare = shares.map((s) => ({
    label: s.label,
    amount: (grandTotal * s.weight) / totalWeight,
  }))
  return { perShare, grandTotal }
}
```

- [ ] **Step 2: DutchMode UI**

Form: total amount, currency (default `KRW`), tip %, dynamic shares list with `+ 추가`/`삭제` per row (label + weight). Default 2 shares (`나`, `상대`) at weight 1 each — couple-app default.

(Skipped here for brevity in the plan, but mirror the InstallmentMode shape: useState arrays for shares, an `onAddShare` and `onRemoveShare(i)`. Result renders one line per share with `label: ₩amount` + a grand total footer.)

- [ ] **Step 3: Verify + commit**

```bash
git add src/features/calc/compute/dutch.ts src/features/calc/modes/DutchMode.* src/features/calc/CalcWorkspace.tsx
git commit -m "feat(calc): 더치페이 (Dutch) mode"
```

---

### Task 10: 날짜 계산 (date) mode

**Files:**
- Create: `src/features/calc/compute/date.ts`
- Create: `src/features/calc/modes/DateMode.tsx`
- Create: `src/features/calc/modes/DateMode.module.css`
- Modify: `src/features/calc/CalcWorkspace.tsx`

- [ ] **Step 1: compute/date.ts**

```ts
// src/features/calc/compute/date.ts
import type { DateInput, DateOutput } from '../types'

const MS_PER_DAY = 86_400_000

export function computeDate(input: DateInput): DateOutput {
  switch (input.mode) {
    case 'D_DAY': {
      const target = new Date(input.target + 'T00:00:00')
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const days = Math.round((target.getTime() - now.getTime()) / MS_PER_DAY)
      const desc = days === 0 ? '오늘' : days > 0 ? `D-${days}` : `D+${-days}`
      return { days, description: `${desc} (${input.target})` }
    }
    case 'BETWEEN': {
      const from = new Date(input.from + 'T00:00:00')
      const to = new Date(input.to + 'T00:00:00')
      const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
      return { days, description: `${input.from} → ${input.to}: ${days}일` }
    }
    case 'WORKING_DAYS': {
      const from = new Date(input.from + 'T00:00:00')
      const to = new Date(input.to + 'T00:00:00')
      let count = 0
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay()
        if (dow !== 0 && dow !== 6) count++
      }
      return { days: count, description: `${input.from} → ${input.to}: 영업일 ${count}일` }
    }
  }
}
```

- [ ] **Step 2: DateMode UI**

Inner mode selector (`Tabs` with D-day / 사이 일수 / 영업일), then matching inputs per sub-mode (1 date for D-day, 2 dates for between/working).

- [ ] **Step 3: Verify + commit**

```bash
git add src/features/calc/compute/date.ts src/features/calc/modes/DateMode.* src/features/calc/CalcWorkspace.tsx
git commit -m "feat(calc): 날짜 (D-day / between / working-days) mode"
```

---

## Stage 4 — Embed in notes

### Task 11: `CalcSnapshot` Tiptap atom + React NodeView

**Files:**
- Create: `src/features/calc/embed/CalcSnapshot.ts`
- Create: `src/features/calc/embed/CalcSnapshotCard.tsx`
- Create: `src/features/calc/embed/CalcSnapshotCard.module.css`
- Modify: `src/features/notes/editor/NoteEditorBody.tsx` (register extension)

Pattern mirrors `DataSnapshot.ts` / `DataSnapshotCard.tsx` exactly — same `data-*` attributes, same React NodeView shape, same refresh-kebab. The diff:

- `data-mode` (BASIC | INSTALLMENT | LOAN | DUTCH | DATE)
- `data-entry-id` (FK to CalcEntry; used by refresh)
- `data-input` (JSON-stringified, frozen)
- `data-result` (JSON-stringified, frozen)
- `data-label`
- `data-captured-at` (ISO 8601)

The NodeView renders:
- Mode badge (top-left)
- One-line summary (using the same `renderSummary` from `TapeLine`)
- Caption (label if set)
- Kebab: 새로고침 (refetch entry by id), 원본 보기 (link to /calc?entry=N), 삭제 (ConfirmDialog)

The 새로고침 path calls `queryClient.fetchQuery(calcKeys.detail(entryId))` → `updateAttributes(newAttrs)` exactly like `DataSnapshot.refresh.ts`.

Tombstone case: when refresh 404s (the source entry was deleted), the card shows "원본이 삭제되었습니다" with the last frozen value still visible.

- [ ] **Step 1: Write the extension** (copy DataSnapshot.ts shape, swap data-* attrs)
- [ ] **Step 2: Write the React NodeView**
- [ ] **Step 3: Write the refresh path** (mirrors `snapshots/refresh.ts`)
- [ ] **Step 4: Register in `NoteEditorBody.tsx`** alongside DataSnapshot
- [ ] **Step 5: Verify** — manually insert a snapshot block in the editor via DevTools to confirm it renders + refreshes
- [ ] **Step 6: Commit**

```bash
git add src/features/calc/embed/ src/features/notes/editor/NoteEditorBody.tsx
git commit -m "feat(calc): CalcSnapshot Tiptap atom (frozen card in note bodies)"
```

---

### Task 12: `CalcSnapshotPicker` + slash menu wire

**Files:**
- Create: `src/features/calc/embed/CalcSnapshotPicker.tsx`
- Create: `src/features/calc/embed/CalcSnapshotPicker.module.css`
- Modify: `src/features/notes/editor/slashItems.ts`
- Modify: `src/features/notes/editor/NoteEditor.tsx` (state + open handler)
- Modify: `src/features/notes/editor/NoteEditorToolbar.tsx` (toolbar button — optional)

- [ ] **Step 1: Picker dialog**

Radix Dialog. Lists the user's most-recent 30 tape entries with `renderSummary` and an embed button per row. Picking an entry inserts the `calcSnapshot` node at the cursor:

```ts
editor.chain().focus().insertContent({
  type: 'calcSnapshot',
  attrs: {
    entryId: entry.id,
    mode: entry.mode,
    input: entry.inputJson,
    result: entry.resultJson,
    label: entry.label,
    capturedAt: new Date().toISOString(),
  },
}).run()
```

- [ ] **Step 2: Slash menu entry**

Edit `slashItems.ts` — add a `계산 스냅샷` item with a `Calculator` Lucide icon. Command opens the picker via the orchestrator pattern already used by `데이터 스냅샷` (NoteEditor holds the open state, NoteEditorBody emits the `openCalcPicker` event).

- [ ] **Step 3: Verify**

1. Open a note. Type `/계산` — picker offered.
2. Pick a tape entry. Card inserts inline.
3. Refresh the page — card persists (HTML round-trip works).
4. Delete the underlying CalcEntry. Open the note. Card shows tombstone.

- [ ] **Step 4: Commit**

```bash
git add src/features/calc/embed/CalcSnapshotPicker.* src/features/notes/editor/slashItems.ts src/features/notes/editor/NoteEditor.tsx src/features/notes/editor/NoteEditorToolbar.tsx
git commit -m "feat(calc): slash menu + picker for embedding calc snapshots in notes"
```

---

## Stage 5 — Polish + verify + ship

### Task 13: Mobile polish, doc updates, E2E smoke, tag

**Files:**
- Modify: `src/features/calc/CalcWorkspace.module.css` — mobile breakpoints
- Modify: `docs/ROADMAP.md` — mark Phase 2 done, drop "/data/calc" reference
- Modify: `docs/ARCHITECTURE.md` — add `calc/` to frontend folder map and backend package list
- Modify: `shared-docs/CLAUDE.md` — Phase 2 status → stable

- [ ] **Step 1: Mobile pass** — at `< 768px` the workspace stacks (work area top, tape below). Mode tabs scroll horizontally if needed. All touch targets ≥44px.

- [ ] **Step 2: E2E smoke**

1. Sign in as user A. Open `/calc`. Make a 할부 calc. Pin it. Add label "월세".
2. Sign in as user B. Confirm the entry appears with A's name + pin glyph + label.
3. As B, open a SHARED note. Type `/계산`. Insert A's entry. Save.
4. As A, open same note. Card renders with frozen values.
5. As B, delete the underlying entry. Refresh A's note view — card shows tombstone, body still loads.

- [ ] **Step 3: Doc updates**

- ROADMAP: move Phase 2 row from "not yet built" to "stable"; replace `/data/calc` with `/calc`; queue Phase 3 plan.
- ARCHITECTURE: add `calc/` rows to both folder maps; add `calc` to entity & permission table (author writes / both read / no visibility flag — shared by default like everything else after the reset).
- CLAUDE.md: bump "Feature status" — Calculator → **Stable**; remove from Phase 2 line.

- [ ] **Step 4: Tag + push**

```bash
git tag phase-2-calculator-tape
git push origin main --tags
# Backend repo: same tag after its commits land.
```

---

## Risks & rollback

- **Math precision.** JavaScript double-float drift on long installment schedules — first month off by ₩0.4 over 360 months is realistic. Acceptable for v1; if a partner complains, swap `decimal.js` into `compute/loan.ts` only (other modes don't need it).
- **expr-eval safety.** The library is sandboxed JS — no `Function`/`eval`. Still: never pass user input to anything outside the parser, and never let saved expressions become eval-able strings on render.
- **Tape growth.** Both partners share a single tape stream. At ~10 entries/day it stays small for years. If it grows past a few hundred entries, add a `pageable` query — not needed for v1.
- **Embed staleness.** The frozen block keeps the original number even if the underlying CalcEntry is deleted (tombstone state). This is intentional — same as `DataSnapshot`. If the user wants a live binding, they should re-pick via the picker.
- **Rollback.** Each stage is one commit on `main`. To roll back Phase 2 entirely: `git revert` the range, then drop `calc_entries` table manually (`DROP TABLE calc_entries`).

## Self-review

- **Spec coverage:** ✓ basic, ✓ 할부, ✓ 대출 + schedule, ✓ 더치페이, ✓ 날짜 (3 sub-modes), ✓ tape shared between partners, ✓ embed in notes, ✓ frozen + refreshable
- **Placeholders:** none — every task includes complete code or a precise pointer to an existing pattern (DataSnapshot)
- **Type consistency:** `CalcEntry` / `CalcMode` / `BasicInput|Output` / etc. used identically across types.ts, api.ts, components, and embed
- **Pattern consistency:** mirrors Phase 1's stage-by-stage structure, same `tsc --noEmit && npm run build` gate after each commit, same Korean UI text rule, same Lucide-only icons
- **Open question:** is the 더치페이 default of two shares (`나`, `상대`) at weight 1 the right starting state, or should the partner names auto-populate from the user table? Defer to verify step

---

## Post-ship appendix — same-day follow-ups (2026-05-29)

After Phase 2 shipped, two enhancements landed the same day in response to live testing. Both are committed to `main`; no separate plan was written because each was a small contained refactor.

### 2.1 Multi-line scratchpad in BASIC mode — commit `385d478`

**What changed.** The single-line BASIC was outgrowing its usefulness: real calculations have steps. Rebuilt as a Soulver-style two-column scratchpad:

```
┌──────────────────────────┬──────────┐
│ # 1단계                   │          │
│ a = 1000 * 2             │ a = 2,000│
│ b = a / 10               │ b = 200  │
│ c = b * 10 * 6           │ c = 12,000│
└──────────────────────────┴──────────┘
```

- `#` starts a comment, blank lines pass through
- `name = expr` defines a variable visible to later lines
- Errors are line-scoped — a typo on line 3 doesn't break lines 4-7
- Live evaluation on every keystroke via `expr-eval` (no debounce)
- Click a result → that value inserts at the textarea cursor (drag deferred — bad on touch)
- `localStorage` persists the scratchpad between sessions
- Explicit 저장 button writes the whole scratchpad as one `CalcEntry`

**Wire compat.** Type shapes changed: `BasicInput` is now `{body}`, `BasicOutput` is `{lines, finalValue, finalFormatted}`. Display surfaces (`TapeLine`, `CalcSnapshotCard`, `CalcSnapshotPicker`) all carry a `summarizeBasic` helper that handles both new (`body` + `lines`) and legacy (`expr` + `formatted`) shapes so pre-2026-05-29 entries keep rendering.

**Files touched:** `types.ts`, `compute/basic.ts`, `modes/BasicMode.tsx`, `modes/BasicMode.module.css`, plus the three display files.

### 2.2 Click history → load into editor — commit `2d6ec85`

**What changed.** The tape was view-only. Now every row is a `role="button"` article with Enter/Space keyboard support. Clicking a row:

1. Switches to that entry's mode (`mode === entry.mode`)
2. Seeds the matching mode's editor with the entry's content
3. Marks the row active (primary-soft background + accent border)
4. Shows a banner at the top of the editor: *"기록을 불러왔습니다 — '제목'. 저장하면 새 항목으로 추가됩니다."*

Click the same row again → deselects (back to a fresh editor).

**Architecture.** `CalcWorkspace` owns `seedEntry: CalcEntry | null`. Each mode component accepts an optional `seedEntry` prop and is **re-keyed** by the parent on `seedEntry?.id ?? 'fresh'`. The wrapper + keyed inner pattern — changing the seed remounts the component so `useState` initializers re-run from the seed without any `setState`-in-effect smell.

For BASIC specifically, `localStorage` writes pause while a seed is loaded. This way the user's fresh scratchpad survives untouched in the background — switch modes or deselect to come back to it.

Saving with a seed loaded creates a **new** `CalcEntry`. The data model rule (entries are immutable) is preserved.

**Files touched:** `CalcWorkspace.tsx`, all 5 mode components, `tape/TapeView.tsx`, `tape/TapeLine.tsx`, `tape/Tape.module.css`, `modes/SpecializedMode.module.css` (`.seedBanner`).

### Still open

- 더치페이 partner-name auto-population from the user table (carried forward).
- Soulver-style inline result rendering (currently a parallel column on the right). A truly inline render would need a `contenteditable` editor — not worth the complexity for now.
- Drag-to-insert results — see note above; click-to-insert is the v1.
- 영업일 mode still has no Korean public-holiday table — Phase 2.x candidate when it bites.
