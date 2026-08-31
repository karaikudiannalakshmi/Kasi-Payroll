import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getEmployees, getMonthAttendance, saveEmployeeAttendance,
  getNewMonthAttendance, saveNewEmployeeAttendance,
  getHolidays, saveHolidays,
} from '../hooks/useFirebase';
import { currentYM, daysInMonth, monthLabel, isNewSystem, HOURS_PER_DAY_NEW } from '../utils/calculations';
import * as XLSX from 'xlsx';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function Attendance() {
  const [yearMonth,  setYearMonth]  = useState(currentYM());
  const [employees,  setEmployees]  = useState([]);
  const [attendance, setAttendance] = useState({});  // old: {empId: {day:hours}} | new: {empId: {ticks,otHours,permHours}}
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
  const days = Array.from({ length: totalDays }, (_, i) => String(i+1).padStart(2,'0'));

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
    const updated = holidays.includes(day) ? holidays.filter(d=>d!==day) : [...holidays,day].sort();
    setHolidays(updated);
    setSavingHols(true);
    await saveHolidays(yearMonth, updated);
    setSavingHols(false);
  };

  // ── NEW SYSTEM handlers ───────────────────────────────────────────────────
  const toggleTick = (empId, day) => {
    const isHol = holidays.includes(day);
    if (isHol) return; // holidays auto-credited
    setAttendance(prev => {
      const emp = prev[empId] || { ticks:{}, otHours:0, permHours:0 };
      const cur = emp.ticks?.[day] === true;
      return { ...prev, [empId]: { ...emp, ticks: { ...emp.ticks, [day]: !cur } } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const setOT = (empId, val) => {
    setAttendance(prev => {
      const emp = prev[empId] || { ticks:{}, otHours:0, permHours:0 };
      return { ...prev, [empId]: { ...emp, otHours: Math.max(0, Number(val)||0) } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const setPerm = (empId, val) => {
    setAttendance(prev => {
      const emp = prev[empId] || { ticks:{}, otHours:0, permHours:0 };
      return { ...prev, [empId]: { ...emp, permHours: Math.max(0, Number(val)||0) } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  const fillAllPresent = (empId) => {
    setAttendance(prev => {
      const emp = prev[empId] || { ticks:{}, otHours:0, permHours:0 };
      const ticks = { ...emp.ticks };
      days.forEach(d => { if (!holidays.includes(d)) ticks[d] = true; });
      return { ...prev, [empId]: { ...emp, ticks } };
    });
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // ── OLD SYSTEM handlers ───────────────────────────────────────────────────
  const setHours = (empId, day, val) => {
    const num = val === '' ? 0 : Math.max(0, Math.min(24, Number(val)));
    setAttendance(prev => ({ ...prev, [empId]: { ...(prev[empId]||{}), [day]: num } }));
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveRow = async (emp) => {
    setSaving(prev => ({ ...prev, [emp.id]: true }));
    if (newSys) {
      const data = attendance[emp.id] || { ticks:{}, otHours:0, permHours:0 };
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

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = () => {
    if (newSys) {
      const rows = employees.map(emp => {
        const row = { Name: emp.name };
        days.forEach(d => { row[d] = holidays.includes(d) ? 'H' : ''; });
        row['OT_Hours'] = 0;
        row['Permission_Hours'] = 0;
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch:26 }, ...days.map(()=>({ wch:4 })), { wch:10 }, { wch:16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `Attendance_Template_${yearMonth}.xlsx`);
    } else {
      const rows = employees.map(emp => {
        const row = { Name: emp.name };
        days.forEach(d => { row[Number(d)] = ''; });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch:26 }, ...days.map(()=>({ wch:5 }))];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      XLSX.writeFile(wb, `Attendance_Template_${yearMonth}.xlsx`);
    }
  };

  // ── Import attendance ─────────────────────────────────────────────────────
  const handleAttImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
      if (allRows.length < 2) { setImportMsg({ ok:false, msg:'No data found.' }); return; }

      let hdrIdx = 0;
      for (let i=0; i<Math.min(5,allRows.length); i++) {
        if (allRows[i].some(c => String(c).toLowerCase().trim()==='name')) { hdrIdx=i; break; }
      }
      const hdrRow  = allRows[hdrIdx];
      const nameIdx = hdrRow.findIndex(c => String(c).toLowerCase().trim()==='name');
      if (nameIdx===-1) { setImportMsg({ ok:false, msg:'Cannot find Name column.' }); return; }

      const nameMap = {};
      employees.forEach(emp => { nameMap[emp.name.trim().toLowerCase()] = emp.id; });

      let saved=0, skipped=0;
      if (newSys) {
        // New format: tick columns (✓/1/P) + OT_Hours + Permission_Hours
        const otIdx   = hdrRow.findIndex(c => String(c).toLowerCase().includes('ot'));
        const permIdx = hdrRow.findIndex(c => String(c).toLowerCase().includes('perm'));
        const colDayMap = {};
        hdrRow.forEach((cell,idx) => {
          const n = Number(cell);
          if (!isNaN(n) && n>=1 && n<=31) colDayMap[idx] = n;
          if (typeof cell==='number' && cell>40000) {
            const d = new Date(Math.round((cell-25569)*86400*1000));
            if (d.getMonth()+1===mo) colDayMap[idx] = d.getDate();
          }
        });
        for (let i=hdrIdx+1; i<allRows.length; i++) {
          const row  = allRows[i];
          const name = String(row[nameIdx]||'').trim();
          if (!name || /^\d+$/.test(name)) continue;
          const empId = nameMap[name.toLowerCase()];
          if (!empId) { skipped++; continue; }
          const ticks = {};
          Object.entries(colDayMap).forEach(([ci,dayNum]) => {
            if (dayNum>totalDays) return;
            const v = row[Number(ci)];
            const key = String(dayNum).padStart(2,'0');
            if (v===1||v==='1'||String(v).toLowerCase()==='p'||String(v).toLowerCase()==='✓'||v===true) ticks[key]=true;
          });
          const otHours   = otIdx>-1   ? Math.max(0,Number(row[otIdx])||0)   : 0;
          const permHours = permIdx>-1 ? Math.max(0,Number(row[permIdx])||0) : 0;
          await saveNewEmployeeAttendance(yearMonth, empId, { ticks, otHours, permHours });
          saved++;
        }
      } else {
        // Old format: numeric hours
        const [selYr,selMo] = yearMonth.split('-').map(Number);
        const colDayMap = {};
        hdrRow.forEach((cell,idx) => {
          const n = Number(cell);
          if (!isNaN(n)&&n>=1&&n<=31) { colDayMap[idx]=n; return; }
          if (typeof cell==='number'&&cell>40000) {
            const d=new Date(Math.round((cell-25569)*86400*1000));
            if (d.getFullYear()===selYr&&d.getMonth()+1===selMo) colDayMap[idx]=d.getDate();
          }
        });
        for (let i=hdrIdx+1; i<allRows.length; i++) {
          const row  = allRows[i];
          const name = String(row[nameIdx]||'').trim();
          if (!name||/^\d+$/.test(name)) continue;
          const empId = nameMap[name.toLowerCase()];
          if (!empId) { skipped++; continue; }
          const hours = {};
          Object.entries(colDayMap).forEach(([ci,dayNum]) => {
            if (dayNum>totalDays) return;
            const n = parseFloat(row[Number(ci)]);
            if (!isNaN(n)&&n>0) hours[String(dayNum).padStart(2,'0')]=n;
          });
          await saveEmployeeAttendance(yearMonth, empId, hours);
          saved++;
        }
      }
      await load();
      setImportMsg({ ok:true, msg:`Imported ${saved} employees${skipped?`, ${skipped} not matched`:''}` });
    } catch(err) {
      setImportMsg({ ok:false, msg:'Error: '+err.message });
    } finally { setImporting(false); e.target.value=''; }
  };

  // ── Row stats ─────────────────────────────────────────────────────────────
  const getRowStats = (empId) => {
    if (newSys) {
      const data = attendance[empId] || { ticks:{}, otHours:0, permHours:0 };
      let pres = 0;
      days.forEach(d => { if (holidays.includes(d) || data.ticks?.[d]===true) pres++; });
      const ot   = Number(data.otHours)||0;
      const perm = Number(data.permHours)||0;
      return { presentDays: pres, effHours: pres*HOURS_PER_DAY_NEW + ot - perm, ot, perm };
    } else {
      const hrs = attendance[empId]||{};
      const total = days.reduce((s,d) => {
        const isHol = holidays.includes(d);
        const entered = Number(hrs[d]||0);
        return s + (isHol ? 9+entered : entered);
      }, 0);
      return { effHours: total, presentDays: (total/9).toFixed(2) };
    }
  };

  const anyUnsaved = Object.values(unsaved).some(Boolean);

  return (
    <div className="p-4 space-y-3" style={{height:'100vh',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <h1 className="text-xl font-bold text-orange-900">📅 Attendance</h1>
        <input type="month" value={yearMonth} onChange={e=>setYearMonth(e.target.value)} className="input w-40" />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        {newSys && (
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
            New system — tick + OT/Permission · ÷24 days · 8h/day
          </span>
        )}
        <div className="ml-auto flex gap-2 items-center flex-wrap">
          {anyUnsaved && <button className="btn-primary text-xs" onClick={saveAll}>💾 Save All</button>}
          <button onClick={downloadTemplate} disabled={!employees.length} className="btn-secondary text-xs">📥 Template</button>
          <input ref={attFileRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleAttImport} />
          <button onClick={()=>attFileRef.current.click()} disabled={importing} className="btn-primary text-xs">
            {importing?'⏳ Importing…':'📂 Import'}
          </button>
        </div>
      </div>

      {importMsg && (
        <div className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium ${importMsg.ok?'bg-green-50 text-green-800 border border-green-200':'bg-red-50 text-red-800 border border-red-200'}`}>
          {importMsg.ok?'✅':'❌'} {importMsg.msg}
          <button className="ml-2 underline" onClick={()=>setImportMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* Legend */}
      <div className="card shrink-0 py-2">
        {newSys ? (
          <div className="flex flex-wrap gap-4 text-xs items-center">
            <span className="flex items-center gap-1"><span className="w-5 h-5 bg-green-100 border border-green-300 rounded flex items-center justify-center text-green-700">✓</span> Present</span>
            <span className="flex items-center gap-1"><span className="w-5 h-5 bg-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400">✗</span> Absent</span>
            <span className="flex items-center gap-1"><span className="w-5 h-5 bg-blue-100 border border-blue-300 rounded flex items-center justify-center text-blue-700">H</span> Holiday (auto ✓)</span>
            <span className="flex items-center gap-1"><span className="w-10 h-5 bg-blue-50 border border-blue-300 rounded text-center text-blue-700 text-xs leading-5">+h</span> OT hrs (month total)</span>
            <span className="flex items-center gap-1"><span className="w-10 h-5 bg-amber-50 border border-amber-300 rounded text-center text-amber-700 text-xs leading-5">−h</span> Permission hrs</span>
            <span className="text-gray-400">· Click any cell to toggle · 8h per day · ÷24</span>
            {savingHols && <span className="text-orange-500">Saving holidays…</span>}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-xs items-center">
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded">Full day (9h)</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">Partial</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Absent</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Holiday (+9h)</span>
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
                <tr className="bg-orange-50 border-b border-orange-200">
                  <th className="sticky left-0 bg-orange-50 px-3 py-2 text-left font-semibold text-gray-700 border-r border-orange-200 min-w-[160px] z-30">
                    Employee
                  </th>
                  {days.map(d => {
                    const isHol = holidays.includes(d);
                    const dayName = DAY_NAMES[new Date(yr,mo-1,Number(d)).getDay()];
                    return (
                      <th key={d} onClick={()=>toggleHoliday(d)}
                        className={`px-1 py-1 text-center font-medium border-r border-gray-200 min-w-[36px] select-none cursor-pointer
                          ${isHol?'bg-blue-100 text-blue-800':'text-gray-600 hover:bg-orange-100'}`}
                        title={isHol?'Click to remove holiday':'Click to mark paid holiday'}>
                        <div>{d}</div>
                        <div className="text-gray-400 font-normal text-[9px]">{dayName}</div>
                        {isHol && <div className="text-blue-600 text-[8px]">HOL</div>}
                      </th>
                    );
                  })}
                  {newSys && <>
                    <th className="px-2 py-2 text-center font-semibold text-blue-700 bg-blue-50 min-w-[52px] border-r border-blue-200">OT<br/>hrs</th>
                    <th className="px-2 py-2 text-center font-semibold text-amber-700 bg-amber-50 min-w-[56px] border-r border-amber-200">Perm<br/>hrs</th>
                  </>}
                  <th className="px-2 py-2 text-right font-semibold text-gray-700 min-w-[60px]">{newSys?'Days':'Hrs'}</th>
                  {newSys && <th className="px-2 py-2 text-right font-semibold text-gray-700 min-w-[60px]">Eff hrs</th>}
                  <th className="px-2 py-2 min-w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp,idx) => {
                  const stats = getRowStats(emp.id);
                  const data  = attendance[emp.id] || (newSys ? {ticks:{},otHours:0,permHours:0} : {});
                  return (
                    <tr key={emp.id} className={`border-b border-gray-100 ${idx%2===0?'bg-white':'bg-amber-50/20'} hover:bg-orange-50/30`}>
                      <td className="sticky left-0 px-3 py-1.5 font-medium text-gray-800 border-r border-orange-200 z-10 bg-inherit">
                        {emp.name}
                        {newSys && (
                          <button onClick={()=>fillAllPresent(emp.id)}
                            className="block text-[9px] text-orange-500 hover:underline mt-0.5">Fill all present</button>
                        )}
                      </td>

                      {days.map(d => {
                        const isHol = holidays.includes(d);
                        if (newSys) {
                          const isPresent = isHol || data.ticks?.[d]===true;
                          return (
                            <td key={d} onClick={()=>!isHol&&toggleTick(emp.id,d)}
                              className={`px-0.5 py-1 text-center border-r border-gray-100 ${isHol?'bg-blue-50':isPresent?'bg-green-50':'bg-gray-50'} ${!isHol?'cursor-pointer':''}`}>
                              <div className={`w-7 h-6 mx-auto rounded flex items-center justify-center font-bold text-sm
                                ${isHol?'bg-blue-100 text-blue-700':isPresent?'bg-green-100 text-green-700':'text-gray-300'}`}>
                                {isHol?'H':isPresent?'✓':'✗'}
                              </div>
                            </td>
                          );
                        } else {
                          const isHol2 = holidays.includes(d);
                          const val = (data[d] ?? '');
                          const n   = Number(val);
                          const cls = isHol2?'att-holiday':n===9?'att-full':n>0?'att-partial':'att-absent';
                          return (
                            <td key={d} className={`px-0.5 py-1 text-center border-r border-gray-100 ${cls}`}>
                              <input type="number" min={0} max={isHol2?20:24} step={1}
                                value={val===0?'':val} placeholder={isHol2?'+h':'0'}
                                onChange={e=>setHours(emp.id,d,e.target.value)}
                                className="w-10 h-6 text-center text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 bg-transparent" />
                            </td>
                          );
                        }
                      })}

                      {newSys && <>
                        <td className="px-1 py-1 border-r border-blue-100 bg-blue-50">
                          <input type="number" min={0} max={99} value={data.otHours||0}
                            onChange={e=>setOT(emp.id,e.target.value)}
                            className="w-11 h-6 text-center text-xs border border-blue-200 rounded bg-blue-50 text-blue-800 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </td>
                        <td className="px-1 py-1 border-r border-amber-100 bg-amber-50">
                          <input type="number" min={0} max={99} value={data.permHours||0}
                            onChange={e=>setPerm(emp.id,e.target.value)}
                            className="w-11 h-6 text-center text-xs border border-amber-200 rounded bg-amber-50 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400" />
                        </td>
                      </>}

                      <td className="px-2 py-1 text-right font-semibold text-gray-700">
                        {newSys ? `${stats.presentDays}/${totalDays}` : stats.effHours.toFixed(1)}
                      </td>
                      {newSys && (
                        <td className="px-2 py-1 text-right font-semibold text-blue-700">
                          {stats.effHours}h
                        </td>
                      )}
                      <td className="px-2 py-1">
                        <button onClick={()=>saveRow(emp)} disabled={!unsaved[emp.id]||saving[emp.id]}
                          className={`text-xs px-2 py-1 rounded font-medium transition-colors ${unsaved[emp.id]?'bg-orange-500 text-white hover:bg-orange-600':'bg-gray-100 text-gray-400 cursor-default'}`}>
                          {saving[emp.id]?'…':unsaved[emp.id]?'Save':'✓'}
                        </button>
                      </td>
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
