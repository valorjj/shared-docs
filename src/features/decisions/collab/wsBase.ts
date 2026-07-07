// Derive the WS origin from the REST base URL (never window.location) — prod
// frontend (Vercel) and backend (Cloudflare Tunnel) are different hosts. Same
// rule as notes' useNoteCollaboration.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090'
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? API_BASE.replace(/^http/, 'ws')
