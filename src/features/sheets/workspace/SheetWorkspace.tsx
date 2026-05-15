import { useSearchParams } from 'react-router-dom'
import { Spinner } from '../../../components/ui'
import { useCreateSheet, useSheet, useSheets } from '../api'
import { defaultSheetData, stringifySheetData } from '../shared/sheetData'
import SheetEditor from '../editor/SheetEditor'
import SheetEditorEmpty from '../editor/SheetEditorEmpty'
import SheetList from '../list/SheetList'
import { useIsMobile } from '../../../lib/useMediaQuery'
import styles from './SheetWorkspace.module.css'

export default function SheetWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sheetsQuery = useSheets()
  const createSheet = useCreateSheet()
  const isMobile = useIsMobile()

  const sheetParam = searchParams.get('sheet')
  const activeId = sheetParam ? Number(sheetParam) : null
  const activeSheetQuery = useSheet(activeId)

  const summaries = sheetsQuery.data ?? []

  const selectSheet = (id: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('sheet', String(id))
    setSearchParams(next)
  }
  const clearSheet = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('sheet')
    setSearchParams(next)
  }

  const handleCreate = () => {
    createSheet.mutate(
      { title: null, data: stringifySheetData(defaultSheetData()) },
      { onSuccess: (s) => selectSheet(s.id) },
    )
  }

  const showEditor = isMobile ? activeId !== null : true
  const showList = isMobile ? activeId === null : true

  return (
    <div className={styles.root}>
      {showList && (
        <div className={styles.list}>
          <SheetList
            sheets={summaries}
            activeId={activeId}
            loading={sheetsQuery.isLoading}
            onSelect={selectSheet}
            onCreate={handleCreate}
          />
        </div>
      )}
      {showEditor && (
        <div className={styles.editor}>
          {activeSheetQuery.data ? (
            <SheetEditor
              key={activeSheetQuery.data.id}
              sheet={activeSheetQuery.data}
              onDeleted={clearSheet}
              onBack={clearSheet}
            />
          ) : activeId !== null && activeSheetQuery.isLoading ? (
            <div className={styles.loading}>
              <Spinner label="시트 불러오는 중…" />
            </div>
          ) : (
            <SheetEditorEmpty />
          )}
        </div>
      )}
    </div>
  )
}
