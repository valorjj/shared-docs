import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getToken } from '../../../auth/tokenStorage'

export type NoteCollaboration = { yDoc: Y.Doc; provider: WebsocketProvider } | null

// Derive the WS origin from the same API base URL the REST client uses
// (src/api/client.ts) rather than window.location.hostname — in prod the
// frontend is on Vercel while the backend sits behind a Cloudflare Tunnel on
// a different host/port, so reconstructing from the page's own origin picks
// the wrong host, the wrong scheme (ws:// from an https:// page is blocked as
// mixed content), and the wrong port. Swapping http(s) -> ws(s) on
// VITE_API_BASE_URL yields the correct origin in both dev and prod.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'
const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? API_BASE.replace(/^http/, 'ws')

/**
 * Owns the Y.Doc + WebsocketProvider lifecycle for one note's live
 * collaboration session. Returns null when disabled (PRIVATE notes have
 * nothing to co-edit — v1 scope is WORKSPACE notes only) or when no auth
 * token is available. The Y.Doc is ephemeral — it lives only as long as this
 * hook is mounted; persistence stays the existing debounced PATCH of
 * editor.getHTML(), untouched by this hook.
 */
export function useNoteCollaboration(noteId: number, enabled: boolean): NoteCollaboration {
  const store = useRef<{ value: NoteCollaboration; listeners: Set<() => void> }>({
    value: null,
    listeners: new Set(),
  })

  const setValue = useCallback((next: NoteCollaboration) => {
    store.current.value = next
    store.current.listeners.forEach((listener) => listener())
  }, [])

  const subscribe = useCallback((onStoreChange: () => void) => {
    store.current.listeners.add(onStoreChange)
    return () => {
      store.current.listeners.delete(onStoreChange)
    }
  }, [])

  const getSnapshot = useCallback(() => store.current.value, [])
  const getServerSnapshot = () => null

  useEffect(() => {
    if (!enabled) {
      setValue(null)
      return
    }
    const token = getToken()
    if (!token) {
      setValue(null)
      return
    }

    const yDoc = new Y.Doc()
    const provider = new WebsocketProvider(`${WS_BASE}/ws/notes`, String(noteId), yDoc, {
      params: { token },
    })
    setValue({ yDoc, provider })

    return () => {
      provider.destroy()
      yDoc.destroy()
      setValue(null)
    }
  }, [noteId, enabled, setValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
