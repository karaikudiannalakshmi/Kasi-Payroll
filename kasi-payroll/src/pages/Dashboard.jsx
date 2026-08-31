import { useEffect, useState } from 'react';
import { getEmployees } from '../hooks/useFirebase';
import { currentYM, monthLabel, fmt } from '../utils/calculations';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const { isAdmin } = useAuth();
  const ym = currentYM();

  useEffect(() => {
    getEmployees().then(e => { setEmployees(e); setLoading(false); });
  }, []);

  const active    = employees.filter(e => e.active !== false);
  const totalCTC  = active.reduce((s, e) => s + (Number(e.salary) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-orange-900">🕉️ Kasi Kitchen — Payroll</h1>
      <p className="text-gray-500 text-sm">Kasi Visvanathar Koviloor Foundation · Varanasi Kitchen · {monthLabel(ym)}</p>

      {loading ? <div className="text-gray-500 text-sm">Loading…</div> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Active Employees', value: active.length, color: 'bg-blue-50 border-blue-200' },
              { label: 'Monthly CTC', value: fmt(totalCTC), color: 'bg-green-50 border-green-200' },
              { label: 'Month', value: monthLabel(ym), color: 'bg-orange-50 border-orange-200' },
            ].map(c => (
              <div key={c.label} className={`card border ${c.color}`}>
                <div className="text-xs text-gray-500">{c.label}</div>
                <div className="text-xl font-bold text-gray-800 mt-1">{c.value}</div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-3">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Link to="/attendance" className="btn-primary">📅 Attendance</Link>
                <Link to="/salary"     className="btn-green">💰 Salary</Link>
                <Link to="/daily"      className="btn-secondary">📊 Daily Sheet</Link>
                <Link to="/employees"  className="btn-secondary">👥 Employees</Link>
                <Link to="/advances"   className="btn-secondary">💵 Advances</Link>
                <Link to="/loans"      className="btn-secondary">🏦 Loans</Link>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold text-gray-700 mb-3">Employees ({active.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="th">S.No</th><th className="th">Name</th>
                  <th className="th">Salary</th><th className="th">Customer ID</th>
                </tr></thead>
                <tbody>
                  {active.map((e, i) => (
                    <tr key={e.id} className="border-b hover:bg-orange-50">
                      <td className="td">{i+1}</td>
                      <td className="td font-medium">{e.name}</td>
                      <td className="td">{fmt(e.salary)}</td>
                      <td className="td font-mono text-xs text-gray-500">{e.customerId || e.beneId || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
