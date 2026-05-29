import { useState } from 'react'
import BasicMode from './modes/BasicMode'
import ModeTabs from './modes/ModeTabs'
import TapeView from './tape/TapeView'
import type { CalcMode } from './types'
import styles from './CalcWorkspace.module.css'

export default function CalcWorkspace() {
  const [mode, setMode] = useState<CalcMode>('BASIC')
  return (
    <div className={styles.root}>
      <div className={styles.workArea}>
        <div className={styles.modeBar}>
          <ModeTabs value={mode} onChange={setMode} />
        </div>
        <div className={styles.modePane}>
          {mode === 'BASIC' && <BasicMode />}
          {mode !== 'BASIC' && (
            <p className={styles.placeholder}>
              {/* Filled in Stage 3 — placeholder keeps the tabs functional in v1 */}
              이 모드는 곧 추가됩니다.
            </p>
          )}
        </div>
      </div>
      <aside className={styles.tape}>
        <TapeView />
      </aside>
    </div>
  )
}
