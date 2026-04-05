import { useEffect, useState, useCallback } from 'react';
import { getEmployees, getAdvances, addAdvance, updateAdvance, deleteAdvance } from '../hooks/useFirebase';
import { currentYM, monthLabel, fmt, daysInMonth } from '../utils/calculations';

export default function Advances() {
  const [yearMonth, setYearMonth] = useState(currentYM());
  const [employees, setEmployees] = useState([]);
  const [advances, setAdvances]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({ empId:'', amount:'', date:'', remarks:'' });
  const [saving, setSaving]       = useState(false);
  const [editAdv, setEditAdv]     = useState(null);

  const [yr, mo] = yearMonth.split('-').map(Number);
  const totalDays = daysInMonth(yearMonth);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);
  const today = new Date().toISOString().split('T')[0];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, advs] = await Promise.all([
      getEmployees(),
      getAdvances({ deductMonth: yearMonth, includeDeducted: true }),
    ]);
    setEmployees(emps.filter(e => e.active !== false));
    setAdvances(advs);
    setLoading(false);
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  // Build grid: empId => day => [advances]
  const grid = {};
  employees.forEach(e => { grid[e.id] = {}; });
  advances.forEach(a => {
    if (!a.date) return;
    const day = parseInt(a.date.split('-')[2]);
    if (grid[a.empId] !== undefined) {
      if (!grid[a.empId][day]) grid[a.empId][day] = [];
      grid[a.empId][day].push(a);
    }
  });

  const rowTotal = (empId) => advances.filter(a => a.empId === empId).reduce((s,a) => s + Number(a.amount||0), 0);
  const dayTotal = (day) => advances.filter(a => a.date && parseInt(a.date.split('-')[2]) === day).reduce((s,a) => s + Number(a.amount||0), 0);
  const grandTotal = advances.reduce((s,a) => s + Number(a.amount||0), 0);

  const openAdd = (empId, day) => {
    const dateStr = yearMonth + '-' + String(day).padStart(2,'0');
    setForm({ empId, amount:'', date: dateStr, remarks:'' });
    setEditAdv(null);
    setModal('form');
  };

  const openEdit = (adv, e) => {
    e.stopPropagation();
    setForm({ empId: adv.empId, amount: adv.amount, date: adv.date||'', remarks: adv.remarks||'' });
    setEditAdv(adv);
    setModal('form');
  };

  const handleDelete = async (adv, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this advance of ' + fmt(adv.amount) + '?')) return;
    await deleteAdvance(adv.id);
    await load();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.empId || !form.amount) return;
    setSaving(true);
    try {
      const deductMonth = form.date ? form.date.substring(0,7) : yearMonth;
      if (editAdv) {
        await updateAdvance(editAdv.id, { ...form, amount: Number(form.amount), deductMonth });
      } else {
        await addAdvance({ ...form, amount: Number(form.amount), deductMonth });
      }
      await load();
      setModal(null);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-4 space-y-3" style={{height:'100vh', display:'flex', flexDirection:'column'}}>
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <h1 className="text-xl font-bold text-orange-900">💵 Advances</h1>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="input w-40" />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm font-semibold text-orange-700">Total: {fmt(grandTotal)}</span>
          <button className="btn-primary" onClick={() => { setForm({ empId: employees[0]?.id||'', amount:'', date: today, remarks:'' }); setEditAdv(null); setModal('form'); }}>
            + Record Advance
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 shrink-0">Click any cell to add · Hover over amount to edit/delete</div>

      {loading ? (
        <div className="text-sm text-gray-500 p-4">Loading…</div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
          <div className="overflow-auto h-full">
            <table className="text-xs border-collapse min-w-max w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-orange-50 border-b border-orange-200">
                  <th className="sticky left-0 bg-orange-50 px-3 py-2.5 text-left font-semibold text-gray-700 border-r border-orange-200 min-w-[170px] z-30">
                    Employee
                  </th>
                  {days.map(d => (
                    <th key={d} className="px-1 py-2 text-center font-medium text-gray-600 border-r border-gray-200 min-w-[56px]">
                      <div className="font-semibold">{d}</div>
                      <div className="text-gray-400 font-normal text-[10px]">{DAY_NAMES[new Date(yr, mo-1, d).getDay()]}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 min-w-[80px] bg-orange-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr key={emp.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'} hover:bg-orange-50/40`}>
                    <td className="sticky left-0 px-3 py-2 font-medium text-gray-800 border-r border-orange-200 z-10 bg-inherit">
                      {emp.name}
                    </td>
                    {days.map(d => {
                      const cell = grid[emp.id]?.[d] || [];
                      const cellTotal = cell.reduce((s,a) => s + Number(a.amount||0), 0);
                      return (
                        <td key={d} onClick={() => openAdd(emp.id, d)}
                          className="px-0.5 py-1 text-center border-r border-gray-100 cursor-pointer hover:bg-orange-100/50 min-w-[56px]"
                          style={{background: cellTotal > 0 ? '#fff7ed' : undefined}}>
                          {cell.length > 0 ? (
                            <div className="space-y-0.5">
                              {cell.map(a => (
                                <div key={a.id} className="group relative inline-flex flex-col items-center w-full">
                                  <div className={`text-[11px] font-bold px-1 py-0.5 rounded w-full text-center ${a.deducted ? 'text-green-700 bg-green-50' : 'text-orange-800 bg-orange-100'}`}>
                                    {Number(a.amount).toLocaleString('en-IN')}
                                  </div>
                                  <div className="absolute hidden group-hover:flex gap-1 bg-white border border-gray-200 shadow-lg rounded px-1.5 py-1 z-50 top-full left-1/2 -translate-x-1/2 whitespace-nowrap mt-0.5">
                                    <button onClick={(e) => openEdit(a, e)} className="text-blue-600 hover:underline px-1">Edit</button>
                                    <span className="text-gray-300">|</span>
                                    <button onClick={(e) => handleDelete(a, e)} className="text-red-500 hover:underline px-1">Del</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-200">+</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-bold text-orange-700 bg-orange-50">
                      {rowTotal(emp.id) > 0 ? fmt(rowTotal(emp.id)) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
                {/* Totals row - sticky bottom */}
                <tr className="sticky bottom-0 bg-orange-100 border-t-2 border-orange-300 z-10 font-bold">
                  <td className="sticky left-0 bg-orange-100 px-3 py-2 text-gray-800 border-r border-orange-200 z-20">TOTAL</td>
                  {days.map(d => {
                    const t = dayTotal(d);
                    return (
                      <td key={d} className="px-1 py-2 text-center text-orange-800 border-r border-orange-200">
                        {t > 0 ? <span className="font-bold">{t.toLocaleString('en-IN')}</span> : ''}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right text-orange-800">{fmt(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal === 'form' && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4 text-orange-900">
              {editAdv ? '✏️ Edit Advance' : '💵 Record Advance'}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Employee *</label>
                <select className="input" value={form.empId} onChange={e => setForm(f => ({...f, empId: e.target.value}))} required>
                  <option value="">— Select —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Amount (₹) *</label>
                  <input className="input" type="number" min={1} value={form.amount}
                    onChange={e => setForm(f => ({...f, amount: e.target.value}))} required placeholder="e.g. 2000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Date *</label>
                  <input className="input" type="date" value={form.date}
                    onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Remarks</label>
                <input className="input" value={form.remarks}
                  onChange={e => setForm(f => ({...f, remarks: e.target.value}))} placeholder="Optional…" />
              </div>
              {editAdv && (
                <div className={`text-xs px-2 py-1 rounded ${editAdv.deducted ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {editAdv.deducted ? '✓ Already deducted from salary' : '⏳ Pending deduction'}
                </div>
              )}
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
