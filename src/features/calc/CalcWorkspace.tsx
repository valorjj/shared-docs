import { useState } from 'react'
import BasicMode from './modes/BasicMode'
import DateMode from './modes/DateMode'
import DutchMode from './modes/DutchMode'
import InstallmentMode from './modes/InstallmentMode'
import LoanMode from './modes/LoanMode'
import ModeTabs from './modes/ModeTabs'
import TapeView from './tape/TapeView'
import type { CalcEntry, CalcMode } from './types'
import styles from './CalcWorkspace.module.css'

export default function CalcWorkspace() {
  const [mode, setMode] = useState<CalcMode>('BASIC')
  /** When non-null, the active mode editor seeds its inputs from this
   *  entry. Clicking the same entry again clears it (back to a fresh
   *  editor). Mode components are keyed on `seedEntry?.id ?? 'fresh'`
   *  so changing the seed remounts the form and re-initializes state. */
  const [seedEntry, setSeedEntry] = useState<CalcEntry | null>(null)

  const handleSelectEntry = (entry: CalcEntry) => {
    if (seedEntry?.id === entry.id) {
      // Clicking the active row again deselects — convenient when the
      // user wants to bounce back to a fresh editor without scrolling.
      setSeedEntry(null)
      return
    }
    setMode(entry.mode)
    setSeedEntry(entry)
  }

  const handleModeChange = (next: CalcMode) => {
    if (next !== mode) {
      // Switching tabs while a seed is loaded clears the seed — a loaded
      // entry is bound to its source mode, no cross-mode seeding.
      setSeedEntry(null)
    }
    setMode(next)
  }

  // Each mode is rendered re-keyed by the seed id so its useState
  // initializers re-run when the seed changes.
  const seedKey = seedEntry?.id ?? 'fresh'
  const seedForMode = (m: CalcMode) =>
    seedEntry && seedEntry.mode === m ? seedEntry : null

  return (
    <div className={styles.root}>
      <div className={styles.workArea}>
        <div className={styles.modeBar}>
          <ModeTabs value={mode} onChange={handleModeChange} />
        </div>
        <div className={styles.modePane}>
          {mode === 'BASIC' && (
            <BasicMode key={`basic-${seedKey}`} seedEntry={seedForMode('BASIC')} />
          )}
          {mode === 'INSTALLMENT' && (
            <InstallmentMode key={`inst-${seedKey}`} seedEntry={seedForMode('INSTALLMENT')} />
          )}
          {mode === 'LOAN' && (
            <LoanMode key={`loan-${seedKey}`} seedEntry={seedForMode('LOAN')} />
          )}
          {mode === 'DUTCH' && (
            <DutchMode key={`dutch-${seedKey}`} seedEntry={seedForMode('DUTCH')} />
          )}
          {mode === 'DATE' && (
            <DateMode key={`date-${seedKey}`} seedEntry={seedForMode('DATE')} />
          )}
        </div>
      </div>
      <aside className={styles.tape}>
        <TapeView
          onSelectEntry={handleSelectEntry}
          activeEntryId={seedEntry?.id ?? null}
        />
      </aside>
    </div>
  )
}
