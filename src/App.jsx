import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout     from './components/Layout';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import Employees  from './pages/Employees';
import Attendance from './pages/Attendance';
import Salary     from './pages/Salary';
import DailySheet from './pages/DailySheet';
import Advances   from './pages/Advances';
import Loans      from './pages/Loans';

function RequireAuth({ children, adminOnly = false }) {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && role !== 'admin') return <Navigate to="/attendance" replace />;
  return children;
}

function AppRoutes() {
  const { user, role } = useAuth();
  const home = role === 'admin' ? '/dashboard' : '/attendance';

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to={home} replace />} />

      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to={home} replace />} />

        {/* Admin only pages */}
        <Route path="dashboard"  element={<RequireAuth adminOnly><Dashboard /></RequireAuth>} />
        <Route path="employees"  element={<RequireAuth adminOnly><Employees /></RequireAuth>} />
        <Route path="salary"     element={<RequireAuth adminOnly><Salary /></RequireAuth>} />
        <Route path="daily"      element={<RequireAuth adminOnly><DailySheet /></RequireAuth>} />
        <Route path="advances"   element={<RequireAuth adminOnly><Advances /></RequireAuth>} />
        <Route path="loans"      element={<RequireAuth adminOnly><Loans /></RequireAuth>} />

        {/* Admin + Operator */}
        <Route path="attendance" element={<RequireAuth><Attendance /></RequireAuth>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
