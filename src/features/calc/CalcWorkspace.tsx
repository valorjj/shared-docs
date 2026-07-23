import { useState } from 'react'
import { Tabs } from '../../components/ui'
import { useMediaQuery } from '../../lib/useMediaQuery'
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

  // ≤900px the calc form and the tape (history) don't fit side by side, so a
  // 계산/기록 toggle switches between them. Above 900px both panes show and
  // this is ignored. Both panes stay mounted (hidden via CSS) so in-progress
  // inputs and tape scroll survive a toggle.
  const isMobile = useMediaQuery('(max-width: 900px)')
  const [mobileView, setMobileView] = useState<'calc' | 'tape'>('calc')

  const handleSelectEntry = (entry: CalcEntry) => {
    if (seedEntry?.id === entry.id) {
      // Clicking the active row again deselects — convenient when the
      // user wants to bounce back to a fresh editor without scrolling.
      setSeedEntry(null)
      return
    }
    setMode(entry.mode)
    setSeedEntry(entry)
    // Recalling a past entry jumps back to the form so the seeded values show.
    setMobileView('calc')
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
      {isMobile && (
        <div className={styles.mobileToggle}>
          <Tabs
            items={[{ key: 'calc', label: '계산' }, { key: 'tape', label: '기록' }]}
            value={mobileView}
            onChange={setMobileView}
          />
        </div>
      )}
      <div
        className={`${styles.workArea}${isMobile && mobileView !== 'calc' ? ` ${styles.hidden}` : ''}`}
      >
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
      <aside
        className={`${styles.tape}${isMobile && mobileView !== 'tape' ? ` ${styles.hidden}` : ''}`}
      >
        <TapeView
          onSelectEntry={handleSelectEntry}
          activeEntryId={seedEntry?.id ?? null}
        />
      </aside>
    </div>
  )
}
