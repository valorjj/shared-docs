import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import DataLayout from './pages/DataLayout'
import NotFound from './pages/NotFound'
import RequireAuth from './auth/RequireAuth'
import RequireRole from './auth/RequireRole'
import MobileShell from './components/common/MobileShell'
import { Spinner } from './components/ui'

const Hub              = lazy(() => import('./pages/Hub'))
const SheetsPage       = lazy(() => import('./pages/SheetsPage'))
const PurchaseList     = lazy(() => import('./features/purchases/PurchaseList'))
const TodoList         = lazy(() => import('./features/todos/TodoList'))
const AnniversaryList  = lazy(() => import('./features/anniversaries/AnniversaryList'))
const LinkList         = lazy(() => import('./features/links/LinkList'))
const RecipeList       = lazy(() => import('./features/recipes/RecipeList'))
const RecipeEditor     = lazy(() => import('./features/recipes/RecipeEditor'))
const CalendarPage     = lazy(() => import('./pages/CalendarPage'))
const Admin            = lazy(() => import('./pages/Admin'))
const AdminCategories  = lazy(() => import('./pages/AdminCategories'))

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-sans)',
      }}
      aria-busy="true"
    >
      <Spinner label="불러오는 중…" />
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
            <Route path="/data" element={<DataLayout />}>
              <Route path="purchases" element={<PurchaseList />} />
              <Route path="todos" element={<TodoList />} />
              <Route path="anniversaries" element={<AnniversaryList />} />
              <Route path="links" element={<LinkList />} />
              <Route path="recipes" element={<RecipeList />} />
              <Route path="recipes/:id" element={<RecipeEditor />} />
            </Route>
            <Route path="/calendar" element={<CalendarPage />} />

            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default App
