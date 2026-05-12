import { Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Honeymoon from './pages/Honeymoon'
import Cleaning from './pages/Cleaning'
import Stock from './pages/Stock'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Admin from './pages/Admin'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Hub />} />
        <Route path="/honeymoon" element={<Honeymoon />} />
        <Route path="/cleaning" element={<Cleaning />} />
        <Route path="/stock" element={<Stock />} />

        <Route element={<RequireRole role="ADMIN" />}>
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
