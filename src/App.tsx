import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Hub from './pages/Hub'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import DataHub from './pages/DataHub'
import NotFound from './pages/NotFound'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import MobileShell from './components/common/MobileShell'

const PurchaseList     = lazy(() => import('./features/purchases/PurchaseList'))
const TodoList         = lazy(() => import('./features/todos/TodoList'))
const AnniversaryList  = lazy(() => import('./features/anniversaries/AnniversaryList'))
const CalendarPage     = lazy(() => import('./pages/CalendarPage'))
const Admin            = lazy(() => import('./pages/Admin'))
const Doc              = lazy(() => import('./pages/Doc'))
const Honeymoon        = lazy(() => import('./pages/Honeymoon'))
const Cleaning         = lazy(() => import('./pages/Cleaning'))
const Stock            = lazy(() => import('./pages/Stock'))

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
            <Route path="/data" element={<DataHub />} />
            <Route path="/data/purchases" element={<PurchaseList />} />
            <Route path="/data/todos" element={<TodoList />} />
            <Route path="/data/anniversaries" element={<AnniversaryList />} />
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
    </Suspense>
  )
}

export default App
