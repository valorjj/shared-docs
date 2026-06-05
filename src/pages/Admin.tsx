import { Link } from 'react-router-dom'
import {
  useAdminOverview,
  useUpdateUserActive,
  useUpdateUserRole,
  type AdminUser,
} from '../api/admin'
import { useAuth } from '../auth/useAuth'
import { ErrorState, Spinner } from '../components/ui'
import type { Role } from '../auth/authContext'
import './Admin.css'

/** Roles an admin can assign via the picker. SUPER_ADMIN is config-
 *  controlled (see `app.auth.bootstrap-admins`) and intentionally
 *  absent — the row gets a read-only pill when it's already held. */
const ROLE_OPTIONS: Role[] = ['USER', 'ADMIN']

const ROLE_LABELS: Record<Role, string> = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER ADMIN',
}

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

      {isLoading && (
        <p className="admin__status">
          <Spinner label="불러오는 중…" />
        </p>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && <UsersSection users={data.users} currentUserId={me?.userId ?? -1} />}
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
                      {u.role === 'SUPER_ADMIN' && (
                        <span className="admin__super-tag" title="설정 파일로만 부여됩니다">
                          SUPER ADMIN
                        </span>
                      )}
                    </td>
                    <td>{u.name}</td>
                    <td>
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="admin__role-readonly">{ROLE_LABELS.SUPER_ADMIN}</span>
                      ) : (
                        <select
                          className="admin__select"
                          value={u.role}
                          disabled={isMe || updateRole.isPending}
                          onChange={(e) =>
                            updateRole.mutate({ id: u.id, role: e.target.value as Role })
                          }
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      )}
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
