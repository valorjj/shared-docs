import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import DataHub from './pages/DataHub'
import NotFound from './pages/NotFound'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import MobileShell from './components/common/MobileShell'

const Hub              = lazy(() => import('./pages/Hub'))
const SheetsPage       = lazy(() => import('./pages/SheetsPage'))
const PurchaseList     = lazy(() => import('./features/purchases/PurchaseList'))
const TodoList         = lazy(() => import('./features/todos/TodoList'))
const AnniversaryList  = lazy(() => import('./features/anniversaries/AnniversaryList'))
const CalendarPage     = lazy(() => import('./pages/CalendarPage'))
const Admin            = lazy(() => import('./pages/Admin'))

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--c-text-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--fs-base)',
      }}
    >
      불러오는 중…
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route element={<RequireAuth />}>
          <Route element={<MobileShell />}>
            <Route path="/" element={<Hub />} />
            <Route path="/sheets" element={<SheetsPage />} />
            <Route path="/data" element={<DataHub />} />
            <Route path="/data/purchases" element={<PurchaseList />} />
            <Route path="/data/todos" element={<TodoList />} />
            <Route path="/data/anniversaries" element={<AnniversaryList />} />
            <Route path="/calendar" element={<CalendarPage />} />

            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default App
