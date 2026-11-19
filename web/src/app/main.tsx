import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '../styles/brand.css';
import '../styles/admin.css';
import { isSignedIn, onAuthChange } from './lib/auth';
import { Shell } from './Shell';
import { ToastProvider } from './ui';
import { Login } from './pages/Login';
import { Today } from './pages/Today';
import { Leads } from './pages/Leads';
import { LeadDetail } from './pages/LeadDetail';
import { Estimator } from './pages/Estimator';
import { CalendarPage } from './pages/Calendar';
import { SettingsPage } from './pages/Settings';
import { CustomerEstimate } from './pages/CustomerEstimate';

function useSignedIn() {
  const [signed, setSigned] = useState(isSignedIn());
  useEffect(() => {
    const off = onAuthChange(() => setSigned(isSignedIn()));
    return () => {
      off();
    };
  }, []);
  return signed;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const signed = useSignedIn();
  const loc = useLocation();
  if (!signed) return <Navigate to="/admin/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/e/:id" element={<CustomerEstimate />} />
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route index element={<Today />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/new" element={<LeadDetail />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="estimate" element={<Estimator />} />
        <Route path="estimate/:id" element={<Estimator />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
