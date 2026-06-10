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
const CalcWorkspace    = lazy(() => import('./features/calc/CalcWorkspace'))
const DecisionList     = lazy(() => import('./features/decisions/DecisionList'))
const PlanDetail       = lazy(() => import('./features/decisions/PlanDetail'))
const SharedItemList   = lazy(() => import('./features/shares/SharedItemList'))
const Admin            = lazy(() => import('./pages/Admin'))
const SettingsCategories = lazy(() => import('./pages/SettingsCategories'))
const SettingsMembers  = lazy(() => import('./pages/SettingsMembers'))
const InviteClaim      = lazy(() => import('./pages/InviteClaim'))
const LegalPage        = lazy(() => import('./pages/legal/LegalPage'))

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
        {/* Public: the page itself sends the visitor through Google sign-in if needed. */}
        <Route path="/invite/:token" element={<InviteClaim />} />
        <Route path="/privacy" element={<LegalPage doc="privacy" />} />
        <Route path="/terms" element={<LegalPage doc="terms" />} />

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
            <Route path="/calc" element={<CalcWorkspace />} />
            <Route path="/decisions" element={<DecisionList />} />
            <Route path="/decisions/:planId" element={<PlanDetail />} />
            <Route path="/shared" element={<SharedItemList />} />
            <Route path="/shared/:noteId" element={<SharedItemList />} />
            {/* Per-workspace category management — any member (Phase C). */}
            <Route path="/settings/categories" element={<SettingsCategories />} />
            {/* Per-workspace member management + invitations (Phase D). */}
            <Route path="/settings/members" element={<SettingsMembers />} />

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
