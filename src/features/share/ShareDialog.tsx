import { useState, type FormEvent } from 'react'
import { Mail, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import {
  useCreateShare,
  useDeleteShare,
  useShares,
  useUpdateShare,
} from './api'
import type { ResourceKind, Share, SharePermission } from './types'
import s from './ShareDialog.module.css'

type Props = {
  kind: ResourceKind
  resourceId: number
  open: boolean
  onClose: () => void
}

/**
 * Bear-styled per-resource share dialog. Top section invites a new
 * recipient by email; bottom section lists current shares with inline
 * permission swap and revoke.
 *
 * The public-link half from the blueprint's mockup lives in Phase D —
 * once `public_share_links` exists it slots in below the "공유됨" list.
 */
export default function ShareDialog({ kind, resourceId, open, onClose }: Props) {
  const sharesQuery = useShares(kind, open ? resourceId : null)
  const createShare = useCreateShare(kind, resourceId)
  const updateShare = useUpdateShare(kind, resourceId)
  const deleteShare = useDeleteShare(kind, resourceId)

  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<SharePermission>('VIEW')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setEmail('')
    setPermission('VIEW')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      setError('이메일을 입력해 주세요.')
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('이메일 형식이 올바르지 않습니다.')
      return
    }
    createShare.mutate(
      { email: trimmed, permission },
      {
        onSuccess: () => {
          setEmail('')
          setPermission('VIEW')
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : '공유에 실패했습니다.'
          setError(msg)
        },
      },
    )
  }

  const shares = sharesQuery.data ?? []

  return (
    <Modal open={open} onClose={handleClose} title="공유">
      <form className={s.invite} onSubmit={handleSubmit}>
        <label className={s.inviteLabel}>
          <Mail size={14} strokeWidth={1.75} aria-hidden="true" />
          <span>이메일로 초대</span>
        </label>
        <div className={s.inviteRow}>
          <input
            type="email"
            className={s.inviteInput}
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className={s.inviteAdd}
            disabled={createShare.isPending || email.trim().length === 0}
            aria-label="공유 추가"
          >
            <UserPlus size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>초대</span>
          </button>
        </div>
        <div className={s.permRow} role="radiogroup" aria-label="권한">
          <button
            type="button"
            role="radio"
            aria-checked={permission === 'VIEW'}
            className={
              permission === 'VIEW' ? `${s.permPill} ${s.permPillActive}` : s.permPill
            }
            onClick={() => setPermission('VIEW')}
          >
            보기
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={permission === 'EDIT'}
            className={
              permission === 'EDIT' ? `${s.permPill} ${s.permPillActive}` : s.permPill
            }
            onClick={() => setPermission('EDIT')}
          >
            편집
          </button>
        </div>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </form>

      <div className={s.divider}>
        <span>공유됨 {shares.length > 0 ? shares.length : ''}</span>
      </div>

      {sharesQuery.isLoading ? (
        <p className={s.empty}>불러오는 중…</p>
      ) : shares.length === 0 ? (
        <p className={s.empty}>아직 아무에게도 공유되지 않았습니다.</p>
      ) : (
        <ul className={s.shareList}>
          {shares.map((share) => (
            <ShareRow
              key={share.id}
              share={share}
              onChangePermission={(perm) =>
                updateShare.mutate({ shareId: share.id, payload: { permission: perm } })
              }
              onRevoke={() => deleteShare.mutate(share.id)}
            />
          ))}
        </ul>
      )}
    </Modal>
  )
}

type RowProps = {
  share: Share
  onChangePermission: (p: SharePermission) => void
  onRevoke: () => void
}

function ShareRow({ share, onChangePermission, onRevoke }: RowProps) {
  return (
    <li className={s.shareRow}>
      <div className={s.shareWho}>
        {share.pictureUrl ? (
          <img src={share.pictureUrl} alt="" className={s.shareAvatar} />
        ) : (
          <span className={s.shareAvatarInitial} aria-hidden="true">
            {(share.name ?? share.email).charAt(0).toUpperCase()}
          </span>
        )}
        <div className={s.shareIdentity}>
          <span className={s.shareName}>{share.name ?? share.email}</span>
          {share.name && <span className={s.shareEmail}>{share.email}</span>}
          {share.pending && <span className={s.sharePending}>초대 보낸 중</span>}
        </div>
      </div>
      <div className={s.shareActions}>
        <select
          className={s.sharePerm}
          value={share.permission}
          onChange={(e) => onChangePermission(e.target.value as SharePermission)}
          aria-label="권한 변경"
        >
          <option value="VIEW">보기</option>
          <option value="EDIT">편집</option>
        </select>
        <button
          type="button"
          className={s.shareRevoke}
          onClick={onRevoke}
          aria-label="공유 해제"
          title="공유 해제"
        >
          <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
