import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Plus, Trash2, UserMinus, Users } from 'lucide-react'
import {
  BackLink,
  Button,
  Field,
  Input,
  Label,
  Modal,
  Page,
  PageHeader,
  PageTitle,
  Spinner,
} from '../components/ui'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuth } from '../auth/useAuth'
import { useActiveWorkspace } from '../auth/useActiveWorkspace'
import { ApiError } from '../api/client'
import {
  useCreateInvitation,
  useInvitations,
  useLeaveWorkspace,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  type Invitation,
  type WorkspaceMember,
} from '../features/workspaces/membersApi'
import styles from './SettingsMembers.module.css'

const ROLE_LABEL = { OWNER: '소유자', MEMBER: '멤버' } as const

/**
 * Per-workspace member management (Phase D). Any member sees the roster; the
 * OWNER can invite (copy-link) and remove members; a non-owner member can leave.
 * Scoped to the active workspace via the same pattern as /settings/categories.
 */
export default function SettingsMembers() {
  const { activeId } = useActiveWorkspace()
  const { user } = useAuth()
  const navigate = useNavigate()

  const members = useMembers(activeId)
  const myRole = members.data?.find((m) => m.userId === user?.userId)?.role
  const isOwner = myRole === 'OWNER'

  const invitations = useInvitations(activeId, isOwner)
  const revokeInvite = useRevokeInvitation(activeId)
  const removeMember = useRemoveMember(activeId)
  const leave = useLeaveWorkspace(activeId)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [removing, setRemoving] = useState<WorkspaceMember | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const onLeave = async () => {
    setLeaveError(null)
    try {
      await leave.mutateAsync()
      setLeaveOpen(false)
      navigate('/', { replace: true }) // provider re-resolves to a remaining workspace
    } catch (e) {
      setLeaveError(e instanceof ApiError ? e.message : '나가기에 실패했어요.')
    }
  }

  return (
    <Page>
      <PageHeader>
        <BackLink to="/" mobileOnly>홈</BackLink>
        <PageTitle icon={<Users size={22} strokeWidth={2} />}>멤버</PageTitle>
      </PageHeader>

      <p className={styles.intro}>
        이 워크스페이스의 멤버를 관리해요. {isOwner ? '이메일로 초대 링크를 만들어 전달하세요.' : '소유자가 멤버를 초대하고 관리할 수 있어요.'}
      </p>

      {/* ── Members ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>멤버 ({members.data?.length ?? 0})</h2>
        </div>
        {members.isLoading && <Spinner label="불러오는 중…" />}
        {members.data && (
          <ul className={styles.list}>
            {members.data.map((m) => (
              <li key={m.userId} className={styles.row}>
                {m.pictureUrl ? (
                  <img className={styles.avatar} src={m.pictureUrl} alt="" />
                ) : (
                  <span className={styles.avatar} aria-hidden="true">{m.name.charAt(0).toUpperCase()}</span>
                )}
                <div className={styles.identity}>
                  <div className={styles.name}>
                    {m.name}{m.userId === user?.userId ? ' (나)' : ''}
                  </div>
                  <div className={styles.sub}>{m.email}</div>
                </div>
                <span className={`${styles.roleChip}${m.role === 'OWNER' ? ` ${styles.roleOwner}` : ''}`}>
                  {ROLE_LABEL[m.role]}
                </span>
                {isOwner && m.userId !== user?.userId && (
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={`${m.name} 내보내기`}
                    title="내보내기"
                    onClick={() => setRemoving(m)}
                  >
                    <UserMinus size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Invitations (owner only) ──────────────────────────── */}
      {isOwner && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>대기 중인 초대</h2>
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              초대
            </Button>
          </div>
          {invitations.data && invitations.data.length === 0 && (
            <p className={styles.empty}>대기 중인 초대가 없어요.</p>
          )}
          {invitations.data && invitations.data.length > 0 && (
            <ul className={styles.list}>
              {invitations.data.map((inv) => (
                <li key={inv.id} className={styles.row}>
                  <div className={styles.identity}>
                    <div className={styles.name}>{inv.email}</div>
                    <div className={styles.sub}>
                      만료 {new Date(inv.expiresAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <CopyButton url={inv.inviteUrl} compact />
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="초대 취소"
                    title="초대 취소"
                    onClick={() => revokeInvite.mutate(inv.id)}
                  >
                    <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Leave (non-owner member) ──────────────────────────── */}
      {myRole === 'MEMBER' && (
        <div className={styles.leave}>
          <Button variant="outline" onClick={() => setLeaveOpen(true)}>워크스페이스 나가기</Button>
          {leaveError && <p className={styles.error}>{leaveError}</p>}
        </div>
      )}

      {isOwner && (
        <InviteModal key={inviteOpen ? 'open' : 'closed'} open={inviteOpen} onClose={() => setInviteOpen(false)} workspaceId={activeId} />
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `${removing.name} 님을 내보낼까요?` : ''}
        description="이 멤버는 더 이상 이 워크스페이스에 접근할 수 없어요. 작성한 항목은 그대로 남아요."
        confirmLabel="내보내기"
        cancelLabel="취소"
        destructive
        onConfirm={() => {
          if (removing) removeMember.mutate(removing.userId, { onSuccess: () => setRemoving(null) })
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={(open) => !open && setLeaveOpen(false)}
        title="이 워크스페이스를 나갈까요?"
        description="다시 들어오려면 새 초대가 필요해요. 작성한 항목은 그대로 남아요."
        confirmLabel="나가기"
        cancelLabel="취소"
        destructive
        onConfirm={onLeave}
      />
    </Page>
  )
}

function InviteModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean
  onClose: () => void
  workspaceId: number | null
}) {
  const create = useCreateInvitation(workspaceId)
  const [email, setEmail] = useState('')
  const [created, setCreated] = useState<Invitation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const inv = await create.mutateAsync(email.trim())
      setCreated(inv)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '초대 생성에 실패했어요.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="멤버 초대">
      {created ? (
        <div>
          <p className={styles.intro}>
            <span className={styles.name}>{created.email}</span> 님을 위한 초대 링크가 만들어졌어요.
            아래 링크를 복사해서 전달하세요.
          </p>
          <div className={styles.linkRow}>
            <span className={styles.linkField}>{created.inviteUrl}</span>
            <CopyButton url={created.inviteUrl} />
          </div>
          <p className={styles.hint}>이 링크는 14일 후 만료돼요. 받는 분이 같은 이메일로 로그인해야 수락할 수 있어요.</p>
          <div className={styles.linkRow} style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={onClose}>완료</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field>
            <Label htmlFor="invite-email">이메일</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              autoFocus
              required
              maxLength={255}
            />
          </Field>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.linkRow} style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={onClose} disabled={create.isPending}>취소</Button>
            <Button variant="primary" type="submit" disabled={create.isPending || !email.trim()}>
              {create.isPending ? '만드는 중…' : '초대 링크 만들기'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function CopyButton({ url, compact }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. insecure context) — leave state unchanged.
    }
  }
  if (compact) {
    return (
      <button type="button" className={styles.iconBtn} onClick={copy} aria-label="링크 복사" title="링크 복사">
        {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={2} />}
      </button>
    )
  }
  return (
    <Button variant="outline" size="sm" className={styles.copyBtn} onClick={copy}>
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
      {copied ? '복사됨' : '복사'}
    </Button>
  )
}
