import { createContext } from 'react'

export type Role = 'USER' | 'ADMIN'

export type AuthUser = {
  userId: number
  email: string
  name: string
  pictureUrl: string | null
  role: Role
}

export type AuthContextValue = {
  user: AuthUser | null
  loginWithToken: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
