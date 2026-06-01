import { Modal } from '../../components/ui'
import { WorkspaceCreateForm } from './WorkspaceCreateForm'

/**
 * Modal home for the create form, opened from the workspace switcher. The form
 * is keyed on `open` so it re-mounts (name field resets) each time it opens.
 */
export default function CreateWorkspaceModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title="새 워크스페이스">
      <WorkspaceCreateForm key={open ? 'open' : 'closed'} autoFocus onCreated={onClose} />
    </Modal>
  )
}
