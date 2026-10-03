import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './layouts/AppLayout';
import RequireAuth from './components/RequireAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analyze from './pages/Analyze';
import Processing from './pages/Processing';
import Report from './pages/Report';
import Agreements from './pages/Agreements';
import AgreementDetails from './pages/AgreementDetails';
import Reports from './pages/Reports';
import History from './pages/History';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

/**
 * Route map for LoanLens.
 * /login                sign in / create account (public)
 * /dashboard            landing dashboard
 * /analyze              upload + start analysis
 * /analyze/:id/processing  live pipeline status (polls the API)
 * /report/:id           clause-by-clause report
 * /agreements + /agreements/:id  library / details
 * /reports              risk-focused list
 * /history              analysis activity
 * /settings             configuration + transparency
 *
 * Everything below /login is wrapped in RequireAuth, so an anonymous visitor
 * is always sent to the sign-in screen first.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/analyze/:id/processing" element={<Processing />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/agreements" element={<Agreements />} />
        <Route path="/agreements/:id" element={<AgreementDetails />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
