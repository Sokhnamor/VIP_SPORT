import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { RequireRole } from './components/RequireRole'
import { Loading } from './components/ui'
import { AppLayout } from './layouts/AppLayout'
import { AuthProvider } from './lib/auth'
import ChangePassword from './pages/auth/ChangePassword'
import Login from './pages/auth/Login'

// Écrans chargés à la demande : le poste de scan ne télécharge que ce dont il a besoin.
const ReceptionHome = lazy(() => import('./pages/reception/Home'))
const Members = lazy(() => import('./pages/reception/Members'))
const MemberForm = lazy(() => import('./pages/reception/MemberForm'))
const MemberDetail = lazy(() => import('./pages/reception/MemberDetail'))
const Sale = lazy(() => import('./pages/reception/Sale'))
const Receipts = lazy(() => import('./pages/reception/Receipts'))
const PaymentDetail = lazy(() => import('./pages/reception/PaymentDetail'))
const Cash = lazy(() => import('./pages/reception/Cash'))
const CashSessionDetail = lazy(() => import('./pages/reception/CashSessionDetail'))
const Expenses = lazy(() => import('./pages/reception/Expenses'))
const Presences = lazy(() => import('./pages/reception/Presences'))
const TicketView = lazy(() => import('./pages/reception/TicketView'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Alerts = lazy(() => import('./pages/admin/Alerts'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const CashSessions = lazy(() => import('./pages/admin/CashSessions'))
const AccessLogs = lazy(() => import('./pages/admin/AccessLogs'))
const Plans = lazy(() => import('./pages/admin/Plans'))
const Users = lazy(() => import('./pages/admin/Users'))
const Audit = lazy(() => import('./pages/admin/Audit'))
const SettingsPage = lazy(() => import('./pages/admin/Settings'))
const Scan = lazy(() => import('./pages/scan/Scan'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/connexion" element={<Login />} />
            <Route path="/mot-de-passe" element={<ChangePassword />} />

            <Route
              path="/scan"
              element={
                <RequireRole roles={['scanner', 'receptionniste', 'admin']}>
                  <Scan />
                </RequireRole>
              }
            />

            <Route
              element={
                <RequireRole roles={['receptionniste', 'admin']}>
                  <AppLayout />
                </RequireRole>
              }
            >
              <Route index element={<ReceptionHome />} />
              <Route path="membres" element={<Members />} />
              <Route path="membres/nouveau" element={<MemberForm />} />
              <Route path="membres/:id" element={<MemberDetail />} />
              <Route path="membres/:id/modifier" element={<MemberForm />} />
              <Route path="vente" element={<Sale />} />
              <Route path="recus" element={<Receipts />} />
              <Route path="recus/:id" element={<PaymentDetail />} />
              <Route path="tickets/:id" element={<TicketView />} />
              <Route path="caisse" element={<Cash />} />
              <Route path="caisse/:id" element={<CashSessionDetail />} />
              <Route path="depenses" element={<Expenses />} />
              <Route path="presences" element={<Presences />} />

              <Route path="admin" element={<RequireRole roles={['admin']}><Dashboard /></RequireRole>} />
              <Route path="admin/alertes" element={<RequireRole roles={['admin']}><Alerts /></RequireRole>} />
              <Route path="admin/rapports" element={<RequireRole roles={['admin']}><Reports /></RequireRole>} />
              <Route path="admin/caisses" element={<RequireRole roles={['admin']}><CashSessions /></RequireRole>} />
              <Route path="admin/acces" element={<RequireRole roles={['admin']}><AccessLogs /></RequireRole>} />
              <Route path="admin/formules" element={<RequireRole roles={['admin']}><Plans /></RequireRole>} />
              <Route path="admin/utilisateurs" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
              <Route path="admin/audit" element={<RequireRole roles={['admin']}><Audit /></RequireRole>} />
              <Route path="admin/parametres" element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
