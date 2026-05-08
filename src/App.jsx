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
  const { user, role, loading } = useAuth();

  // Wait for Firebase onAuthStateChanged to resolve before redirecting
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,background:'#7c2d12'}}>
      <div style={{width:36,height:36,border:'3px solid rgba(255,255,255,0.2)',borderTop:'3px solid #fb923c',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <div style={{color:'rgba(255,255,255,0.5)',fontSize:13,fontFamily:'sans-serif'}}>Loading…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && role !== 'admin') return <Navigate to="/attendance" replace />;
  return children;
}

function AppRoutes() {
  const { user, role, loading } = useAuth();

  // Don't redirect until Firebase has resolved auth state
  if (loading) return null;

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
