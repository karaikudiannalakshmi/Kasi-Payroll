import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  getEmployees,
  getNewMonthAttendance, saveNewEmployeeAttendance,
  getMonthAttendance, saveEmployeeAttendance,
  getHolidays, saveHolidays,
} from '../hooks/useFirebase';
import { currentYM, daysInMonth, monthLabel, isNewSystem } from '../utils/calculations';
import * as XLSX from 'xlsx';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Attendance() {
  const [yearMonth,  setYearMonth]  = useState(currentYM());
  const [employees,  setEmployees]  = useState([]);
  const [attendance, setAttendance] = useState({});
  const [holidays,   setHolidays]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState({});
  const [unsaved,    setUnsaved]    = useState({});
  const [savingHols, setSavingHols] = useState(false);
  const [importing,  setImporting]  = useState(false);
  const [importMsg,  setImportMsg]  = useState(null);
  const attFileRef = useRef();

  const newSys = isNewSystem(yearMonth);
  const [yr, mo] = yearMonth.split('-').map(Number);
  const totalDays = daysInMonth(yearMonth);
  const days = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, att, hols] = await Promise.all([
      getEmployees(),
      newSys ? getNewMonthAttendance(yearMonth) : getMonthAttendance(yearMonth),
      getHolidays(yearMonth),
    ]);
    setEmployees(emps.filter(e => e.active !== false));
    setAttendance(att);
    setHolidays(hols);
    setUnsaved({});
    setLoading(false);
  }, [yearMonth, newSys]);

  useEffect(() => { load(); }, [load]);

  const toggleHoliday = async (day) => {
    const updated = holidays.includes(day)
      ? holidays.filter(d => d !== day)
      : [...holidays, day].sort();
    setHolidays(updated);
    setSavingHols(true);
    await saveHolidays(yearMonth, updated);
    setSavingHols(false);
  };

  // ── NEW system: tick per day + OT/Permission per day ─────────────────────
  const toggleTick = (empId, day) => {
    if (holidays.includes(day)) return;
    setAttendance(prev => {
      const emp  = prev[empId] || { ticks: {}, ot: {}, perm: {} };
      const cur  = emp.ticks?.[day] === true;
      return { ...prev, [empId]: { ...emp, ticks: { ...emp.ticks, [day]: !cur } } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const setDayOT = (empId, day, val) => {
    setAttendance(prev => {
      const emp = prev[empId] || { ticks: {}, ot: {}, perm: {} };
      const v   = Math.max(0, Number(val) || 0);
      return { ...prev, [empId]: { ...emp, ot: { ...emp.ot, [day]: v } } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const setDayPerm = (empId, day, val) => {
    setAttendance(prev => {
      const emp = prev[empId] || { ticks: {}, ot: {}, perm: {} };
      const v   = Math.max(0, Number(val) || 0);
      return { ...prev, [empId]: { ...emp, perm: { ...emp.perm, [day]: v } } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const fillAllPresent = (empId) => {
    setAttendance(prev => {
      const emp   = prev[empId] || { ticks: {}, ot: {}, perm: {} };
      const ticks = { ...emp.ticks };
      days.forEach(d => { if (!holidays.includes(d)) ticks[d] = true; });
      return { ...prev, [empId]: { ...emp, ticks } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // ── OLD system: hours per day ─────────────────────────────────────────────
  const setHours = (empId, day, val) => {
    const num = val === '' ? 0 : Math.max(0, Math.min(24, Number(val)));
    setAttendance(prev => ({ ...prev, [empId]: { ...(prev[empId] || {}), [day]: num } }));
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const fillFullDay = (empId) => {
    const hrs = { ...(attendance[empId] || {}) };
    days.forEach(d => { if (!holidays.includes(d) && !hrs[d]) hrs[d] = 9; });
    setAttendance(prev => ({ ...prev, [empId]: hrs }));
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveRow = async (emp) => {
    setSaving(prev => ({ ...prev, [emp.id]: true }));
    if (newSys) {
      const data = attendance[emp.id] || { ticks: {}, ot: {}, perm: {} };
      await saveNewEmployeeAttendance(yearMonth, emp.id, data);
    } else {
      await saveEmployeeAttendance(yearMonth, emp.id, attendance[emp.id] || {});
    }
    setSaving(prev => ({ ...prev, [emp.id]: false }));
    setUnsaved(prev => ({ ...prev, [emp.id]: false }));
  };

  const saveAll = async () => {
    for (const emp of employees) {
      if (unsaved[emp.id]) await saveRow(emp);
    }
  };

  // ── Row totals ────────────────────────────────────────────────────────────
  const getRowStats = (empId) => {
    if (newSys) {
      const data  = attendance[empId] || { ticks: {}, ot: {}, perm: {} };
      let present = 0, ot = 0, perm = 0;
      days.forEach(d => {
        if (holidays.includes(d) || data.ticks?.[d] === true) present++;
        ot   += Number(data.ot?.[d]   || 0);
        perm += Number(data.perm?.[d] || 0);
      });
      return { present, ot, perm, effDays: (present * 9 + ot - perm) / 9 };
    } else {
      const hrs = attendance[empId] || {};
      const total = days.reduce((s, d) => {
        const isHol = holidays.includes(d);
        return s + (isHol ? 9 + Number(hrs[d] || 0) : Number(hrs[d] || 0));
      }, 0);
      return { effHours: total, effDays: (total / 9).toFixed(2) };
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handleAttImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const buffer  = await file.arrayBuffer();
      const wb      = XLSX.read(buffer, { raw: true });
      const ws      = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (allRows.length < 2) { setImportMsg({ ok: false, msg: 'No data found.' }); return; }

      let hdrIdx = 0;
      for (let i = 0; i < Math.min(5, allRows.length); i++) {
        if (allRows[i].some(c => String(c).toLowerCase().trim() === 'name')) { hdrIdx = i; break; }
      }
      const hdrRow  = allRows[hdrIdx];
      const nameIdx = hdrRow.findIndex(c => String(c).toLowerCase().trim() === 'name');
      if (nameIdx === -1) { setImportMsg({ ok: false, msg: 'Cannot find Name column.' }); return; }

      const nameMap = {};
      employees.forEach(emp => { nameMap[emp.name.trim().toLowerCase()] = emp.id; });

      const colDayMap = {};
      hdrRow.forEach((cell, idx) => {
        const n = Number(cell);
        if (!isNaN(n) && n >= 1 && n <= 31) { colDayMap[idx] = n; return; }
        if (typeof cell === 'number' && cell > 40000) {
          const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
          if (d.getMonth() + 1 === mo) colDayMap[idx] = d.getDate();
        }
      });

      let saved = 0, skipped = 0;
      for (let i = hdrIdx + 1; i < allRows.length; i++) {
        const row  = allRows[i];
        const name = String(row[nameIdx] || '').trim();
        if (!name || /^\d+$/.test(name)) continue;
        const empId = nameMap[name.toLowerCase()];
        if (!empId) { skipped++; continue; }

        if (newSys) {
          const ticks = {};
          Object.entries(colDayMap).forEach(([ci, dayNum]) => {
            if (dayNum > totalDays) return;
            const v   = row[Number(ci)];
            const key = String(dayNum).padStart(2, '0');
            if (v === 1 || v === '1' || String(v).toLowerCase() === 'p' || String(v) === '✓') ticks[key] = true;
          });
          await saveNewEmployeeAttendance(yearMonth, empId, { ticks, ot: {}, perm: {} });
        } else {
          const hours = {};
          Object.entries(colDayMap).forEach(([ci, dayNum]) => {
            if (dayNum > totalDays) return;
            const n = parseFloat(row[Number(ci)]);
            if (!isNaN(n) && n > 0) hours[String(dayNum).padStart(2, '0')] = n;
          });
          await saveEmployeeAttendance(yearMonth, empId, hours);
        }
        saved++;
      }
      await load();
      setImportMsg({ ok: true, msg: `Imported ${saved} employees${skipped ? `, ${skipped} not matched` : ''}` });
    } catch (err) {
      setImportMsg({ ok: false, msg: 'Error: ' + err.message });
    } finally { setImporting(false); e.target.value = ''; }
  };

  const anyUnsaved = Object.values(unsaved).some(Boolean);

  return (
    <div className="p-3 space-y-2" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <h1 className="text-xl font-bold text-orange-900">📅 Attendance</h1>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="input w-40" />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        <div className="ml-auto flex gap-2 items-center">
          {anyUnsaved && <button className="btn-primary text-xs" onClick={saveAll}>💾 Save All</button>}
          <input ref={attFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleAttImport} />
          <button onClick={() => attFileRef.current.click()} disabled={importing} className="btn-primary text-xs">
            {importing ? '⏳ Importing…' : '📂 Import'}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium ${importMsg.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {importMsg.ok ? '✅' : '❌'} {importMsg.msg}
          <button className="ml-2 underline" onClick={() => setImportMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* Legend */}
      <div className="card shrink-0 py-2 px-3">
        {newSys ? (
          <div className="flex flex-wrap gap-4 text-xs items-center">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-green-100 border border-green-300 rounded flex items-center justify-center text-green-700 font-bold text-xs">✓</span> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">✗</span> Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-blue-700 font-bold text-xs">H</span> Holiday (auto ✓)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-5 bg-blue-50 border border-blue-200 rounded text-center text-blue-700 text-xs leading-5">OT</span> OT hours per day
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-8 h-5 bg-amber-50 border border-amber-200 rounded text-center text-amber-700 text-xs leading-5">PM</span> Permission hours per day
            </span>
            <span className="text-gray-400 ml-2">· Click date header = holiday · Click cell = toggle present</span>
            {savingHols && <span className="text-orange-500">Saving…</span>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-xs items-center">
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Full day (9h)</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">Partial</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Absent</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Holiday</span>
            <span className="text-gray-400">· Click date header to toggle holiday</span>
            {savingHols && <span className="text-orange-500">Saving…</span>}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 p-4">Loading…</div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-sm">
          <div className="overflow-auto h-full">
            <table className="text-xs border-collapse min-w-max">
              <thead className="sticky top-0 z-20">

                {/* Row 1: Date numbers */}
                <tr className="bg-orange-50 border-b border-orange-200">
                  <th className="sticky left-0 bg-orange-50 px-3 py-2 text-left font-semibold text-gray-700 border-r border-orange-200 min-w-[160px] z-30" rowSpan={newSys ? 2 : 1}>
                    Employee
                  </th>
                  {days.map(d => {
                    const isHol  = holidays.includes(d);
                    const dayName = DAY_NAMES[new Date(yr, mo - 1, Number(d)).getDay()];
                    return (
                      <th key={d}
                        colSpan={newSys ? 3 : 1}
                        onClick={() => toggleHoliday(d)}
                        className={`px-1 py-1 text-center font-medium border-r border-gray-200 cursor-pointer select-none
                          ${isHol ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-orange-100'}`}
                        title={isHol ? 'Click to remove holiday' : 'Click to mark paid holiday'}
                        style={{ minWidth: newSys ? '90px' : '36px' }}>
                        <div className="font-semibold">{d}</div>
                        <div className="text-[9px] text-gray-400 font-normal">{dayName}</div>
                        {isHol && <div className="text-[8px] text-blue-600">HOL</div>}
                      </th>
                    );
                  })}
                  {newSys ? (
                    <>
                      <th className="px-2 py-1 text-center font-semibold text-gray-700 min-w-[55px] border-r border-gray-200" rowSpan={2}>Days</th>
                      <th className="px-2 py-1 text-center font-semibold text-gray-700 min-w-[70px] border-r border-gray-200" rowSpan={2}>Eff Days</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-1 text-right font-semibold text-gray-700 min-w-[55px]" rowSpan={1}>Hrs</th>
                      <th className="px-2 py-1 min-w-[60px]" rowSpan={1}></th>
                    </>
                  )}
                </tr>

                {/* Row 2 (new system only): sub-headers P/OT/PM per day */}
                {newSys && (
                  <tr className="bg-orange-50 border-b border-orange-300">
                    {days.map(d => (
                      <React.Fragment key={d}>
                        <th className={`px-0 py-1 text-center text-[9px] font-medium border-r border-gray-100 w-8
                          ${holidays.includes(d) ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>P</th>
                        <th className="px-0 py-1 text-center text-[9px] font-medium border-r border-gray-100 w-8 bg-blue-50 text-blue-600">OT</th>
                        <th className="px-0 py-1 text-center text-[9px] font-medium border-r border-gray-200 w-8 bg-amber-50 text-amber-600">PM</th>
                      </React.Fragment>
                    ))}
                  </tr>
                )}
              </thead>

              <tbody>
                {employees.map((emp, idx) => {
                  const stats = getRowStats(emp.id);
                  const data  = attendance[emp.id] || (newSys ? { ticks: {}, ot: {}, perm: {} } : {});
                  return (
                    <tr key={emp.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/20'} hover:bg-orange-50/30`}>
                      <td className="sticky left-0 px-3 py-1.5 font-medium text-gray-800 border-r border-orange-200 z-10 bg-inherit">
                        {emp.name}
                        <button onClick={() => newSys ? fillAllPresent(emp.id) : fillFullDay(emp.id)}
                          className="block text-[9px] text-orange-500 hover:underline mt-0.5">
                          Fill all present
                        </button>
                      </td>

                      {days.map(d => {
                        const isHol = holidays.includes(d);
                        if (newSys) {
                          const isPresent = isHol || data.ticks?.[d] === true;
                          const otVal     = data.ot?.[d]   || '';
                          const permVal   = data.perm?.[d] || '';
                          return (
                            <React.Fragment key={d}>
                              {/* Present tick */}
                              <td onClick={() => !isHol && toggleTick(emp.id, d)}
                                className={`px-0 py-0.5 text-center border-r border-gray-100 w-8
                                  ${isHol ? 'bg-blue-50' : isPresent ? 'bg-green-50' : 'bg-gray-50'}
                                  ${!isHol ? 'cursor-pointer' : ''}`}>
                                <div className={`mx-auto w-6 h-5 rounded flex items-center justify-center text-xs font-bold
                                  ${isHol ? 'text-blue-600' : isPresent ? 'text-green-600' : 'text-gray-300'}`}>
                                  {isHol ? 'H' : isPresent ? '✓' : '✗'}
                                </div>
                              </td>
                              {/* OT */}
                              <td className="px-0 py-0.5 text-center border-r border-gray-100 w-8 bg-blue-50/50">
                                <input type="number" min={0} max={12} value={otVal}
                                  onChange={e => setDayOT(emp.id, d, e.target.value)}
                                  className="w-7 h-5 text-center text-[10px] border border-blue-200 rounded bg-blue-50 text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                              </td>
                              {/* Permission */}
                              <td className="px-0 py-0.5 text-center border-r border-gray-200 w-8 bg-amber-50/50">
                                <input type="number" min={0} max={9} value={permVal}
                                  onChange={e => setDayPerm(emp.id, d, e.target.value)}
                                  className="w-7 h-5 text-center text-[10px] border border-amber-200 rounded bg-amber-50 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                              </td>
                            </React.Fragment>
                          );
                        } else {
                          const val = data[d] ?? '';
                          const n   = Number(val);
                          const cls = isHol ? 'bg-blue-100' : n === 9 ? 'bg-green-100' : n > 0 ? 'bg-yellow-100' : 'bg-gray-50';
                          return (
                            <td key={d} className={`px-0.5 py-1 text-center border-r border-gray-100 ${cls}`}>
                              <input type="number" min={0} max={isHol ? 20 : 24} step={1}
                                value={val === 0 ? '' : val} placeholder={isHol ? '+h' : '0'}
                                onChange={e => setHours(emp.id, d, e.target.value)}
                                className="w-10 h-6 text-center text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 bg-transparent" />
                            </td>
                          );
                        }
                      })}

                      {newSys ? (
                        <>
                          <td className="px-2 py-1 text-center font-semibold text-gray-700 border-r border-gray-200">
                            {stats.present}/{totalDays}
                          </td>
                          <td className="px-2 py-1 text-center font-semibold text-green-700">
                            {stats.effDays.toFixed(2)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1 text-right font-semibold text-gray-700">
                            {stats.effHours.toFixed(1)}
                          </td>
                          <td className="px-2 py-1">
                            <button onClick={() => saveRow(emp)} disabled={!unsaved[emp.id] || saving[emp.id]}
                              className={`text-xs px-2 py-1 rounded font-medium ${unsaved[emp.id] ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 text-gray-400 cursor-default'}`}>
                              {saving[emp.id] ? '…' : unsaved[emp.id] ? 'Save' : '✓'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
