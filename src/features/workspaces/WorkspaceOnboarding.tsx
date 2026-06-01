import { WorkspaceCreateForm } from './WorkspaceCreateForm'
import styles from './WorkspaceOnboarding.module.css'

/**
 * Shown when a signed-in user has no active workspace — the never-stuck guard.
 * Normally the sign-in bootstrap means you always have one, so this covers edge
 * cases (a wiped or left workspace). Creating one here makes it active, which
 * flips MobileShell back to the normal app — no `onCreated` needed, the gate
 * re-renders once `active` is set.
 */
export default function WorkspaceOnboarding() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>아직 워크스페이스가 없어요</h1>
        <p className={styles.lede}>워크스페이스를 만들면 메모와 데이터를 모아둘 수 있어요.</p>
        <WorkspaceCreateForm autoFocus />
      </div>
    </div>
  )
}
