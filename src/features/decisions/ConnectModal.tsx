import { Modal, Button, Checkbox } from '../../components/ui'
import styles from './ConnectModal.module.css'

export type ConnectCandidate = {
  id: number
  title: string
  edgeId: number | null        // non-null when already connected (either direction)
  outgoing: boolean            // true if the existing edge is source→this
}

type Props = {
  open: boolean
  onClose: () => void
  sourceTitle: string
  candidates: ConnectCandidate[]
  busy?: boolean
  onConnect: (targetId: number) => void
  onDisconnect: (edgeId: number) => void
}

export default function ConnectModal({ open, onClose, sourceTitle, candidates, busy, onConnect, onDisconnect }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${sourceTitle} — 연결`}
      footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}
    >
      <p className={styles.empty} hidden={candidates.length > 0}>연결할 다른 안건이 없어요.</p>
      <div className={styles.list}>
        {candidates.map((c) => {
          const connected = c.edgeId != null
          return (
            <div key={c.id} className={styles.row} data-connected={connected ? 'true' : 'false'}>
              <Checkbox
                label={c.title}
                checked={connected}
                disabled={busy}
                onChange={() => (connected ? onDisconnect(c.edgeId!) : onConnect(c.id))}
              />
              {connected && <span className={styles.dir}>{c.outgoing ? '연결됨 →' : '← 연결됨'}</span>}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
