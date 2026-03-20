import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout    from './components/Layout';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Salary    from './pages/Salary';
import Advances  from './pages/Advances';
import Loans     from './pages/Loans';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="employees"  element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="salary"     element={<Salary />} />
          <Route path="advances"   element={<Advances />} />
          <Route path="loans"      element={<Loans />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
