import { Outlet } from 'react-router-dom'
import Forbidden from '../pages/Forbidden'
import { useAuth, type Role } from './AuthContext'

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
