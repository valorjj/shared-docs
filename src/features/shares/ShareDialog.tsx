import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button } from '../../components/ui'
import { ApiError } from '../../api/client'
import { useNoteShares, useGrantShare, useRevokeShare, useUpdateGrant } from './api'
import type { SharePermission } from './types'
import styles from './ShareDialog.module.css'

type Props = { noteId: number; open: boolean; onClose: () => void }

export default function ShareDialog({ noteId, open, onClose }: Props) {
  const shares = useNoteShares(noteId, open)
  const grant = useGrantShare(noteId)
  const revoke = useRevokeShare(noteId)
  const updateGrant = useUpdateGrant(noteId)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('VIEW')
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    setError(null)
    setEmail('')
    onClose()
  }

  const submit = () => {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) return
    grant.mutate({ email: trimmed, permission }, {
      onSuccess: () => { setEmail(''); setError(null) },
      onError: (e) => {
        const body = e instanceof ApiError ? e.body : null
        setError(body?.detail ?? '공유할 수 없어요.')
      },
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title="메모 공유">
      <div className={styles.addRow}>
        <input
          type="email"
          className={styles.email}
          placeholder="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        <select
          className={styles.perm}
          value={permission}
          onChange={(e) => setPermission(e.target.value as SharePermission)}
        >
          <option value="VIEW">보기</option>
          <option value="EDIT">편집</option>
        </select>
        <Button variant="primary" size="sm" onClick={submit} disabled={grant.isPending}>공유</Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.list}>
        {shares.data?.length === 0 && (
          <li className={styles.empty}>아직 공유한 사람이 없어요.</li>
        )}
        {shares.data?.map((s) => (
          <li key={s.grantedToUserId} className={styles.item}>
            <div className={styles.who}>
              <span className={styles.name}>{s.recipientName}</span>
              <span className={styles.mail}>{s.recipientEmail}</span>
            </div>
            <select
              className={styles.perm}
              value={s.permission}
              onChange={(e) =>
                updateGrant.mutate({
                  recipientId: s.grantedToUserId,
                  payload: { permission: e.target.value as SharePermission },
                })
              }
            >
              <option value="VIEW">보기</option>
              <option value="EDIT">편집</option>
            </select>
            <button
              type="button"
              className={styles.remove}
              aria-label="공유 해제"
              onClick={() => revoke.mutate(s.grantedToUserId)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
