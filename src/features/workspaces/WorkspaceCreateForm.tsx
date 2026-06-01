import { useState, type FormEvent } from 'react'
import { Button, ErrorText, Field, Input, Label, Stack } from '../../components/ui'
import { useActiveWorkspace } from '../../auth/useActiveWorkspace'
import { useCreateWorkspace } from '../../api/workspaces'

/**
 * The one place workspace creation is implemented. Shared by CreateWorkspaceModal
 * (opened from the switcher) and WorkspaceOnboarding (zero-state), so there's a
 * single create form rather than two divergent ones.
 *
 * Collects a name only — the server generates the slug. On success it makes the
 * new workspace active (which clears the query cache and refetches), then calls
 * `onCreated` so the host can close the modal / move on.
 */
export function WorkspaceCreateForm({
  onCreated,
  autoFocus = false,
}: {
  onCreated?: () => void
  autoFocus?: boolean
}) {
  const create = useCreateWorkspace()
  const { setActiveId } = useActiveWorkspace()
  const [name, setName] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    create.mutate(
      { name: trimmed },
      {
        onSuccess: (ws) => {
          setActiveId(ws.id)
          onCreated?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap={3}>
        <Field>
          <Label htmlFor="ws-name">워크스페이스 이름</Label>
          <Input
            id="ws-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoFocus={autoFocus}
            placeholder="예: 직장, 취미"
          />
        </Field>
        {create.error && <ErrorText>{create.error.message}</ErrorText>}
        <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
          {create.isPending ? '만드는 중…' : '워크스페이스 만들기'}
        </Button>
      </Stack>
    </form>
  )
}
