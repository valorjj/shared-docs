import { Outlet } from 'react-router-dom'
import Forbidden from '../pages/Forbidden'
import { useAuth } from './useAuth'
import type { Role } from './authContext'

type Props = {
  role: Role
}

export default function RequireRole({ role }: Props) {
  const { user } = useAuth()

  if (!user || user.role !== role) {
    return <Forbidden />
  }

  return <Outlet />
}
