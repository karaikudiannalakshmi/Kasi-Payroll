import { useEffect, useState, useRef } from 'react';
import { getEmployees, saveEmployee, toggleEmployee } from '../hooks/useFirebase';
import { fmt } from '../utils/calculations';

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  }).filter(r => r.name && r.name.trim());
}

const EMPTY = {
  name: '', salary: '', designation: '', ifsc: '', accountNo: '', beneId: '', active: true,
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const load = () => getEmployees().then(e => { setEmployees(e); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setImportResult({ success: false, error: 'No valid rows found in CSV. Check the file format.' });
        return;
      }
      let count = 0;
      for (const row of rows) {
        await saveEmployee({
          name: row.name.trim(),
          designation: (row.designation || '').trim(),
          salary: Number(row.salary) || 0,
          ifsc: (row.ifsc || '').trim(),
          accountNo: (row.accountNo || '').trim(),
          beneId: (row.beneId || '').trim(),
          active: true,
        });
        count++;
      }
      await load();
      setImportResult({ success: true, count });
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const openAdd  = () => { setForm(EMPTY); setModal({ emp: null }); };
  const openEdit = (emp) => { setForm({ ...emp }); setModal({ emp }); };
  const closeModal = () => setModal(null);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.salary) return;
    setSaving(true);
    try {
      await saveEmployee({ ...form, salary: Number(form.salary) });
      await load();
      closeModal();
    } finally { setSaving(false); }
  };

  const handleToggle = async (emp) => {
    if (!window.confirm(`${emp.active !== false ? 'Deactivate' : 'Activate'} ${emp.name}?`)) return;
    await toggleEmployee(emp.id, emp.active === false);
    await load();
  };

  const visible = showInactive ? employees : employees.filter(e => e.active !== false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-orange-900">👥 Employee Master</h1>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <button
            className="btn-secondary"
            onClick={() => fileRef.current.click()}
            disabled={importing}
          >
            {importing ? '⏳ Importing…' : '📂 Import CSV'}
          </button>
          <button className="btn-primary" onClick={openAdd}>+ Add Employee</button>
        </div>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${importResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {importResult.success
            ? `✅ Successfully imported ${importResult.count} employees!`
            : `❌ Import failed: ${importResult.error}`}
          <button className="ml-3 text-xs underline" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? <p className="text-sm text-gray-500">Loading…</p> : (
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="border-b">
              {['S.No','Name','Designation','Monthly Salary','IFSC','Account No','Bene ID','Status',''].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visible.map((emp, i) => (
                <tr key={emp.id} className={`border-b hover:bg-orange-50 ${emp.active === false ? 'opacity-50' : ''}`}>
                  <td className="td">{i + 1}</td>
                  <td className="td font-medium">{emp.name}</td>
                  <td className="td text-gray-500">{emp.designation || '—'}</td>
                  <td className="td font-semibold text-green-700">{fmt(emp.salary)}</td>
                  <td className="td text-xs font-mono">{emp.ifsc || '—'}</td>
                  <td className="td text-xs font-mono">{emp.accountNo || '—'}</td>
                  <td className="td text-xs font-mono">{emp.beneId || '—'}</td>
                  <td className="td">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {emp.active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(emp)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleToggle(emp)} className={`text-xs hover:underline ${emp.active !== false ? 'text-red-500' : 'text-green-600'}`}>
                        {emp.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={9} className="td text-center text-gray-400 py-8">No employees found. Add one!</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold mb-4 text-orange-900">
              {modal.emp ? '✏️ Edit Employee' : '➕ Add Employee'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name *</label>
                  <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder="Employee Name" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Designation</label>
                  <input className="input" value={form.designation} onChange={e => setForm(f => ({...f, designation: e.target.value}))} placeholder="Cook / Helper / Manager" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monthly Salary (₹) *</label>
                  <input className="input" type="number" value={form.salary} onChange={e => setForm(f => ({...f, salary: e.target.value}))} required placeholder="12000" min={0} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">IFSC Code</label>
                  <input className="input font-mono" value={form.ifsc} onChange={e => setForm(f => ({...f, ifsc: e.target.value.toUpperCase()}))} placeholder="SBIN0001234" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Account Number</label>
                  <input className="input font-mono" value={form.accountNo} onChange={e => setForm(f => ({...f, accountNo: e.target.value}))} placeholder="Bank account number" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Bank Bene ID (CIB pre-registered)</label>
                  <input className="input font-mono" value={form.beneId} onChange={e => setForm(f => ({...f, beneId: e.target.value}))} placeholder="e.g. 271214084" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Employee'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
