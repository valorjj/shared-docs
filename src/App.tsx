import { Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Honeymoon from './pages/Honeymoon'
import Cleaning from './pages/Cleaning'
import Stock from './pages/Stock'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Admin from './pages/Admin'
import Doc from './pages/Doc'
import DataHub from './pages/DataHub'
import CalendarPage from './pages/CalendarPage'
import NotFound from './pages/NotFound'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import MobileShell from './components/common/MobileShell'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<RequireAuth />}>
        <Route element={<MobileShell />}>
          <Route path="/" element={<Hub />} />
          <Route path="/data" element={<DataHub />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/honeymoon" element={<Honeymoon />} />
          <Route path="/cleaning" element={<Cleaning />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/doc/*" element={<Doc />} />

          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
