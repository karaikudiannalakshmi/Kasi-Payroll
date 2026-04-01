import { useEffect, useState } from 'react';
import { getEmployees, getAdvances, addAdvance, updateAdvance, deleteAdvance } from '../hooks/useFirebase';
import { currentYM, monthLabel, fmt } from '../utils/calculations';

const EMPTY = { empId: '', amount: '', date: '', deductMonth: '', remarks: '' };

export default function Advances() {
  const [employees, setEmployees]   = useState([]);
  const [advances, setAdvances]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [filterEmp, setFilterEmp]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const load = async () => {
    setLoading(true);
    const [emps, advs] = await Promise.all([getEmployees(), getAdvances()]);
    setEmployees(emps.filter(e => e.active !== false));
    setAdvances(advs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

  const today = new Date().toISOString().split('T')[0];
  const ym = currentYM();

  const openAdd = () => {
    setForm({ ...EMPTY, date: today, deductMonth: ym });
    setModal('add');
  };
  const openEdit = (adv) => {
    setForm({ ...adv });
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.empId || !form.amount || !form.deductMonth) return;
    setSaving(true);
    try {
      if (modal === 'edit' && form.id) {
        const { id, ...rest } = form;
        await updateAdvance(id, { ...rest, amount: Number(form.amount) });
      } else {
        await addAdvance({ ...form, amount: Number(form.amount) });
      }
      await load();
      setModal(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (adv) => {
    if (!window.confirm(`Delete advance of ${fmt(adv.amount)} for ${empMap[adv.empId]}?`)) return;
    await deleteAdvance(adv.id);
    await load();
  };

  const filtered = advances.filter(a => {
    if (filterEmp && a.empId !== filterEmp) return false;
    if (filterMonth && a.deductMonth !== filterMonth) return false;
    return true;
  });

  const totalAmount = filtered.reduce((s, a) => s + Number(a.amount || 0), 0);

  // Summary per employee
  const empSummary = {};
  advances.forEach(a => {
    const name = empMap[a.empId] || a.empId;
    if (!empSummary[name]) empSummary[name] = 0;
    empSummary[name] += Number(a.amount || 0);
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-orange-900">💵 Advance Management</h1>
        <button className="btn-primary ml-auto" onClick={openAdd}>+ Record Advance</button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-center">
        <select className="input w-48" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <input type="month" className="input w-40" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        {(filterEmp || filterMonth) && (
          <button className="btn-secondary text-xs" onClick={() => { setFilterEmp(''); setFilterMonth(''); }}>
            Clear Filters
          </button>
        )}
        <span className="ml-auto text-sm font-semibold text-gray-700">
          Total: <span className="text-orange-700">{fmt(totalAmount)}</span>
          <span className="text-gray-400 font-normal ml-1">({filtered.length} records)</span>
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              {['S.No', 'Employee', 'Amount', 'Date', 'Deduct Month', 'Remarks', 'Status', ''].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((adv, i) => (
                <tr key={adv.id} className="border-b hover:bg-orange-50">
                  <td className="td text-gray-400">{i + 1}</td>
                  <td className="td font-medium">
                    {empMap[adv.empId] 
                      ? empMap[adv.empId]
                      : <span className="text-red-500 text-xs">⚠ {adv.empId.substring(0,8)}… (delete this)</span>
                    }
                  </td>
                  <td className="td font-bold text-orange-700">{fmt(adv.amount)}</td>
                  <td className="td text-gray-500">{adv.date || '—'}</td>
                  <td className="td">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {adv.deductMonth ? monthLabel(adv.deductMonth) : '—'}
                    </span>
                  </td>
                  <td className="td text-gray-500">{adv.remarks || '—'}</td>
                  <td className="td">
                    {adv.deducted
                      ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">✓ Deducted</span>
                      : <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>
                    }
                  </td>
                  <td className="td">
                    <div className="flex gap-2">
                      {!adv.deducted && <button onClick={() => openEdit(adv)} className="text-xs text-blue-600 hover:underline">Edit</button>}
                      <button onClick={() => handleDelete(adv)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-10">No advance records found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-Employee Summary */}
      {Object.keys(empSummary).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">📊 Total Advances per Employee (all time)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(empSummary)
              .sort((a, b) => b[1] - a[1])
              .map(([name, total]) => (
                <div key={name} className="bg-orange-50 rounded-lg px-3 py-2">
                  <div className="text-xs text-gray-500 truncate">{name}</div>
                  <div className="font-bold text-orange-700 text-sm">{fmt(total)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4 text-orange-900">
              {modal === 'edit' ? '✏️ Edit Advance' : '💵 Record Advance'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Employee *</label>
                <select className="input" value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required>
                  <option value="">— Select Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₹) *</label>
                  <input className="input" type="number" min={1} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="e.g. 2000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date Given</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Deduct from Month *</label>
                <input className="input" type="month" value={form.deductMonth} onChange={e => setForm(f => ({ ...f, deductMonth: e.target.value }))} required />
                <p className="text-xs text-gray-400 mt-0.5">This amount will be deducted from the selected month's salary.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Remarks</label>
                <input className="input" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional note…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
