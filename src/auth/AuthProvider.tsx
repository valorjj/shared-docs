import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import { clearToken, getToken, setToken, TOKEN_STORAGE_KEY } from './tokenStorage'
import { clearActiveWorkspaceId } from './workspaceStorage'
import { AuthContext, type AuthUser, type Role } from './authContext'

type JwtClaims = {
  sub: string
  email: string
  name: string
  picture?: string | null
  role: Role
  iat: number
  exp: number
}

function userFromToken(token: string | null): AuthUser | null {
  if (!token) return null
  try {
    const claims = jwtDecode<JwtClaims>(token)
    const nowSec = Math.floor(Date.now() / 1000)
    if (typeof claims.exp === 'number' && claims.exp <= nowSec) return null
    return {
      userId: Number(claims.sub),
      email: claims.email,
      name: claims.name,
      pictureUrl: claims.picture ?? null,
      role: claims.role,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => userFromToken(getToken()))

  const loginWithToken = useCallback((token: string) => {
    setToken(token)
    setUser(userFromToken(token))
  }, [])

  const logout = useCallback(() => {
    clearToken()
    clearActiveWorkspaceId()
    setUser(null)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_STORAGE_KEY) return
      setUser(userFromToken(getToken()))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({ user, loginWithToken, logout }),
    [user, loginWithToken, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
