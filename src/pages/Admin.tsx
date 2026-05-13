import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  useAdminOverview,
  useAddAllowedEmail,
  useDeleteAllowedEmail,
  useUpdateAllowedEmailRole,
  useUpdateUserActive,
  useUpdateUserRole,
  type AdminUser,
  type AllowedEmail,
} from '../api/admin'
import { useAuth } from '../auth/useAuth'
import type { Role } from '../auth/authContext'
import './Admin.css'

const ROLE_OPTIONS: Role[] = ['USER', 'ADMIN']

export default function Admin() {
  const { user: me } = useAuth()
  const { data, isLoading, isError, error, refetch } = useAdminOverview()

  return (
    <div className="admin">
      <header className="admin__header">
        <Link to="/" className="admin__back">
          ← 홈으로
        </Link>
        <h1 className="admin__title">관리</h1>
        <p className="admin__sub">
          접속 권한과 사용자 역할을 관리합니다. 본인 계정의 권한은 변경할 수 없습니다.
        </p>
      </header>

      {isLoading && <p className="admin__status">불러오는 중…</p>}
      {isError && (
        <p className="admin__status admin__status--error">
          {error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.'}{' '}
          <button type="button" onClick={() => refetch()}>다시 시도</button>
        </p>
      )}

      {data && (
        <>
          <UsersSection users={data.users} currentUserId={me?.userId ?? -1} />
          <AllowedEmailsSection
            entries={data.pendingAllowedEmails}
            currentUserEmail={me?.email ?? ''}
          />
        </>
      )}
    </div>
  )
}

function UsersSection({ users, currentUserId }: { users: AdminUser[]; currentUserId: number }) {
  const updateRole = useUpdateUserRole()
  const updateActive = useUpdateUserActive()

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">사용자 ({users.length})</h2>
      <p className="admin__section-hint">한 번이라도 로그인한 사용자 목록입니다.</p>

      {users.length === 0 ? (
        <p className="admin__status">사용자가 없습니다.</p>
      ) : (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th></th>
                <th>이메일</th>
                <th>이름</th>
                <th>권한</th>
                <th>활성</th>
                <th>최근 로그인</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === currentUserId
                return (
                  <tr key={u.id} className={isMe ? 'admin__row--me' : ''}>
                    <td>
                      {u.pictureUrl ? (
                        <img className="admin__avatar" src={u.pictureUrl} alt="" />
                      ) : (
                        <span className="admin__avatar admin__avatar--initial">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td>
                      {u.email}
                      {isMe && <span className="admin__me-tag">나</span>}
                    </td>
                    <td>{u.name}</td>
                    <td>
                      <select
                        className="admin__select"
                        value={u.role}
                        disabled={isMe || updateRole.isPending}
                        onChange={(e) =>
                          updateRole.mutate({ id: u.id, role: e.target.value as Role })
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <label className="admin__toggle">
                        <input
                          type="checkbox"
                          checked={u.active}
                          disabled={isMe || updateActive.isPending}
                          onChange={(e) =>
                            updateActive.mutate({ id: u.id, active: e.target.checked })
                          }
                        />
                        <span>{u.active ? '활성' : '비활성'}</span>
                      </label>
                    </td>
                    <td className="admin__time">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ko-KR') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {updateRole.isError && (
        <p className="admin__status admin__status--error">
          권한 변경 실패: {(updateRole.error as Error).message}
        </p>
      )}
      {updateActive.isError && (
        <p className="admin__status admin__status--error">
          활성 변경 실패: {(updateActive.error as Error).message}
        </p>
      )}
    </section>
  )
}

function AllowedEmailsSection({
  entries,
  currentUserEmail,
}: {
  entries: AllowedEmail[]
  currentUserEmail: string
}) {
  const addAllowed = useAddAllowedEmail()
  const updateAllowedRole = useUpdateAllowedEmailRole()
  const deleteAllowed = useDeleteAllowedEmail()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('USER')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    addAllowed.mutate(
      { email: trimmed, defaultRole: role },
      {
        onSuccess: () => {
          setEmail('')
          setRole('USER')
        },
      },
    )
  }

  return (
    <section className="admin__section">
      <h2 className="admin__section-title">허용된 이메일 ({entries.length} 대기)</h2>
      <p className="admin__section-hint">
        아직 로그인하지 않은 사용자입니다. 첫 로그인 시 여기 설정된 권한이 부여됩니다.
      </p>

      <form className="admin__add-form" onSubmit={handleSubmit}>
        <input
          className="admin__input"
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select
          className="admin__select"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="submit"
          className="admin__btn admin__btn--primary"
          disabled={addAllowed.isPending}
        >
          {addAllowed.isPending ? '추가 중…' : '추가'}
        </button>
      </form>

      {addAllowed.isError && (
        <p className="admin__status admin__status--error">
          추가 실패: {(addAllowed.error as Error).message}
        </p>
      )}

      {entries.length > 0 && (
        <div className="admin__table-wrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>이메일</th>
                <th>기본 권한</th>
                <th>추가일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isMine = e.email === currentUserEmail.toLowerCase()
                return (
                  <tr key={e.id}>
                    <td>
                      {e.email}
                      {isMine && <span className="admin__me-tag">나</span>}
                    </td>
                    <td>
                      <select
                        className="admin__select"
                        value={e.defaultRole}
                        disabled={updateAllowedRole.isPending}
                        onChange={(ev) =>
                          updateAllowedRole.mutate({
                            id: e.id,
                            role: ev.target.value as Role,
                          })
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="admin__time">
                      {new Date(e.addedAt).toLocaleString('ko-KR')}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin__btn admin__btn--danger"
                        disabled={isMine || deleteAllowed.isPending}
                        onClick={() => {
                          if (confirm(`${e.email}을(를) 허용 목록에서 제거하시겠습니까?`)) {
                            deleteAllowed.mutate(e.id)
                          }
                        }}
                      >
                        제거
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
