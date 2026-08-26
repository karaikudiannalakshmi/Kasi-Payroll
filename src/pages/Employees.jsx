import { useEffect, useState, useRef } from 'react';
import { getEmployees, saveEmployee, toggleEmployee } from '../hooks/useFirebase';
import { fmt } from '../utils/calculations';
import * as XLSX from 'xlsx';

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
  name: '', salary: '', designation: '', ifsc: '', accountNo: '',
  beneId: '', customerId: '', fullPayAlways: false, active: true,
};

export default function Employees() {
  const [employees, setEmployees]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modal, setModal]               = useState(null);
  const [form, setForm]                 = useState(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef    = useRef();
  const custFileRef = useRef();

  const load = () => getEmployees().then(e => { setEmployees(e); setLoading(false); });
  useEffect(() => { load(); }, []);

  // ── Export employees to Excel ─────────────────────────────────────────────
  const exportEmployees = () => {
    const data = employees
      .filter(e => e.active !== false)
      .map((e, i) => ({
        name:          e.name,
        designation:   e.designation || '',
        salary:        e.salary,
        ifsc:          e.ifsc || '',
        accountNo:     String(e.accountNo || ''),
        beneId:        String(e.beneId || ''),
        customerId:    String(e.customerId || e.beneId || ''),
        fullPayAlways: e.fullPayAlways ? 'true' : 'false',
      }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
      { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    // Force text format for account/ID columns
    const textCols = ['E','F','G'];
    for (let row = 2; row <= data.length + 1; row++) {
      textCols.forEach(col => {
        const addr = col + row;
        if (ws[addr]) { ws[addr].t = 's'; ws[addr].z = '@'; }
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'Employees_Export.xlsx');
  };

  // ── CSV Import (safe - updates by name, never deletes) ────────────────────
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('This will UPDATE existing employees and add new ones. Loans and advances will NOT be affected. Continue?')) {
      e.target.value = ''; return;
    }
    setImporting(true); setImportResult(null);
    try {
      let rows;
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        rows = data.map(r => ({
          name:          String(r.name || '').trim(),
          designation:   String(r.designation || '').trim(),
          salary:        r.salary,
          ifsc:          String(r.ifsc || '').trim(),
          accountNo:     String(r.accountNo || '').trim(),
          beneId:        String(r.beneId || '').trim(),
          customerId:    String(r.customerId || r.beneId || '').trim(),
          fullPayAlways: r.fullPayAlways === true || r.fullPayAlways === 'true',
        })).filter(r => r.name);
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }
      if (!rows.length) { setImportResult({ success: false, error: 'No valid rows found.' }); return; }

      const existing = await getEmployees();
      const nameMap  = {};
      existing.forEach(emp => { nameMap[emp.name.trim().toLowerCase()] = emp; });

      let count = 0;
      for (const row of rows) {
        const name    = row.name.trim();
        const empData = {
          name,
          designation:   (row.designation || '').trim(),
          salary:        Number(row.salary) || 0,
          ifsc:          (row.ifsc || '').trim(),
          accountNo:     String((row.accountNo || '').trim()),
          customerId:    String((row.customerId || row.beneId || '').trim()),
          beneId:        String((row.customerId || row.beneId || '').trim()),
          fullPayAlways: (row.fullPayAlways === 'true' || row.fullPayAlways === true) || false,
          sortOrder:     count + 1,
          active:        true,
        };
        const existingEmp = nameMap[name.toLowerCase()];
        if (existingEmp) {
          await saveEmployee({ ...empData, id: existingEmp.id });
        } else {
          await saveEmployee(empData);
        }
        count++;
      }
      await load();
      setImportResult({ success: true, count });
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally { setImporting(false); e.target.value = ''; }
  };

  // ── Customer ID update ────────────────────────────────────────────────────
  const handleCustomerIdUpdate = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const text   = await file.text();
      const lines  = text.trim().split(/\r?\n/).slice(1);
      const existing = await getEmployees();
      const nameMap  = {};
      existing.forEach(emp => { nameMap[emp.name.trim().toLowerCase()] = emp; });
      let updated = 0, skipped = 0;
      for (const line of lines) {
        const [name, customerId] = line.split(',').map(s => s.trim());
        if (!name || !customerId) continue;
        const emp = nameMap[name.toLowerCase()];
        if (!emp) { skipped++; continue; }
        await saveEmployee({ ...emp, customerId: String(customerId), beneId: String(customerId) });
        updated++;
      }
      await load();
      setImportResult({ success: true, count: updated,
        msg: `Updated ${updated} Customer IDs${skipped ? `, ${skipped} not matched` : ''}` });
    } catch (err) {
      setImportResult({ success: false, error: err.message });
    } finally { setImporting(false); e.target.value = ''; }
  };

  const openAdd  = () => { setForm(EMPTY); setModal({ emp: null }); };
  const openEdit = (emp) => { setForm({ ...emp }); setModal({ emp }); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.salary) return;
    setSaving(true);
    try {
      await saveEmployee({
        ...form, salary: Number(form.salary),
        accountNo:  String(form.accountNo || ''),
        customerId: String(form.customerId || form.beneId || ''),
        beneId:     String(form.customerId || form.beneId || ''),
      });
      await load(); setModal(null);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-orange-900">👥 Employee Master</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>

          {/* Export button */}
          <button className="btn-secondary" onClick={exportEmployees} disabled={loading}>
            📥 Export Excel
          </button>

          {/* CSV Import */}
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImportCSV} />
          <button className="btn-secondary" onClick={() => fileRef.current.click()} disabled={importing}>
            {importing ? '⏳ Importing…' : '📂 Import CSV/Excel'}
          </button>

          {/* Customer ID update */}
          <input ref={custFileRef} type="file" accept=".csv" className="hidden" onChange={handleCustomerIdUpdate} />
          <button className="btn-secondary" onClick={() => custFileRef.current.click()} disabled={importing} title="CSV: name,customerId">
            🔑 Update Customer IDs
          </button>

          <button className="btn-primary" onClick={openAdd}>+ Add Employee</button>
        </div>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${importResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {importResult.success
            ? `✅ ${importResult.msg || `Successfully imported ${importResult.count} employees!`}`
            : `❌ ${importResult.error}`}
          <button className="ml-3 text-xs underline" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? <p className="p-4 text-sm text-gray-500">Loading…</p> : (
          <table className="w-full text-sm min-w-[750px]">
            <thead><tr className="border-b">
              {['#','Name','Designation','Salary','Customer ID','Account No','Status',''].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {visible.map((emp, i) => (
                <tr key={emp.id} className={`border-b hover:bg-orange-50 ${emp.active === false ? 'opacity-50' : ''}`}>
                  <td className="td text-gray-400">{i+1}</td>
                  <td className="td font-medium">{emp.name}</td>
                  <td className="td text-gray-500">{emp.designation || '—'}</td>
                  <td className="td font-semibold text-green-700">{fmt(emp.salary)}</td>
                  <td className="td font-mono text-xs">{emp.customerId || emp.beneId || '—'}</td>
                  <td className="td font-mono text-xs">{emp.accountNo || '—'}</td>
                  <td className="td">
                    <div className="flex flex-col gap-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-fit ${emp.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {emp.active !== false ? 'Active' : 'Inactive'}
                      </span>
                      {emp.fullPayAlways && <span className="px-2 py-0.5 rounded-full text-xs font-medium w-fit bg-orange-100 text-orange-700">Full Pay</span>}
                    </div>
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
                <tr><td colSpan={8} className="td text-center text-gray-400 py-10">No employees. Import CSV or add manually.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
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
                  <input className="input" value={form.designation} onChange={e => setForm(f => ({...f, designation: e.target.value}))} placeholder="Cook / Helper…" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monthly Salary (₹) *</label>
                  <input className="input" type="number" value={form.salary} onChange={e => setForm(f => ({...f, salary: e.target.value}))} required placeholder="12000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">IFSC Code</label>
                  <input className="input font-mono" value={form.ifsc} onChange={e => setForm(f => ({...f, ifsc: e.target.value.toUpperCase()}))} placeholder="SBIN0001234" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Account Number (text)</label>
                  <input className="input font-mono" value={form.accountNo} onChange={e => setForm(f => ({...f, accountNo: String(e.target.value)}))} placeholder="Bank account number" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Customer ID (text)</label>
                  <input className="input font-mono" value={form.customerId || form.beneId || ''}
                    onChange={e => setForm(f => ({...f, customerId: String(e.target.value), beneId: String(e.target.value)}))}
                    placeholder="e.g. 271214084" />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={!!form.fullPayAlways} onChange={e => setForm(f => ({...f, fullPayAlways: e.target.checked}))} className="w-4 h-4 accent-orange-600" />
                    <div>
                      <div className="text-sm font-medium text-orange-900">Always Full Pay</div>
                      <div className="text-xs text-orange-600">Pays full monthly salary regardless of attendance (e.g. Manager)</div>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
