import { useEffect, useState, useCallback } from 'react';
import { getEmployees, getMonthAttendance, saveEmployeeAttendance, getHolidays, saveHolidays } from '../hooks/useFirebase';
import { currentYM, daysInMonth, monthLabel } from '../utils/calculations';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDayName(ym, day) {
  const [y, m] = ym.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, day).getDay()];
}

export default function Attendance() {
  const [yearMonth, setYearMonth] = useState(currentYM());
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({}); // { empId: { "01": 9, ... } }
  const [holidays, setHolidays]     = useState([]); // ["02","09",...]
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState({}); // { empId: bool }
  const [unsaved, setUnsaved]       = useState({}); // { empId: bool }
  const [savingHolidays, setSavingHolidays] = useState(false);

  const totalDays = daysInMonth(yearMonth);
  const days = Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, att, hols] = await Promise.all([
      getEmployees(),
      getMonthAttendance(yearMonth),
      getHolidays(yearMonth),
    ]);
    setEmployees(emps.filter(e => e.active !== false));
    setAttendance(att);
    setHolidays(hols);
    setUnsaved({});
    setLoading(false);
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  // Toggle holiday
  const toggleHoliday = async (day) => {
    const updated = holidays.includes(day)
      ? holidays.filter(d => d !== day)
      : [...holidays, day].sort();
    setHolidays(updated);
    setSavingHolidays(true);
    await saveHolidays(yearMonth, updated);
    setSavingHolidays(false);
  };

  // Update cell
  const setHours = (empId, day, val) => {
    const num = val === '' ? '' : Math.max(0, Math.min(24, Number(val)));
    setAttendance(prev => ({
      ...prev,
      [empId]: { ...((prev[empId]) || {}), [day]: num === '' ? 0 : num },
    }));
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // Save one row
  const saveRow = async (emp) => {
    setSaving(prev => ({ ...prev, [emp.id]: true }));
    await saveEmployeeAttendance(yearMonth, emp.id, attendance[emp.id] || {});
    setSaving(prev => ({ ...prev, [emp.id]: false }));
    setUnsaved(prev => ({ ...prev, [emp.id]: false }));
  };

  // Save all
  const saveAll = async () => {
    for (const emp of employees) {
      if (unsaved[emp.id]) await saveRow(emp);
    }
  };

  // Fill all present (9h) for non-holiday, non-Sunday days
  const fillFullDay = (empId) => {
    const [y, m] = yearMonth.split('-').map(Number);
    const hours = { ...(attendance[empId] || {}) };
    days.forEach(d => {
      const dayOfWeek = new Date(y, m - 1, Number(d)).getDay();
      if (!holidays.includes(d) && dayOfWeek !== 0) {
        if (!hours[d]) hours[d] = 9;
      }
    });
    setAttendance(prev => ({ ...prev, [empId]: hours }));
    setUnsaved(prev => ({ ...prev, [empId]: true }));
  };

  // Row total
  const rowTotal = (empId) => {
    const h = attendance[empId] || {};
    return days.reduce((sum, d) => {
      const isHol = holidays.includes(d);
      const entered = Number(h[d] || 0);
      return sum + (isHol ? 9 + entered : entered);
    }, 0);
  };

  // Cell color
  const cellClass = (empId, day) => {
    const isHol = holidays.includes(day);
    const hrs = Number((attendance[empId] || {})[day] || 0);
    if (isHol && hrs > 0) return 'att-holiday-worked';
    if (isHol) return 'att-holiday';
    if (hrs === 9) return 'att-full';
    if (hrs > 0) return 'att-partial';
    return 'att-absent';
  };

  const anyUnsaved = Object.values(unsaved).some(Boolean);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-orange-900">📅 Attendance</h1>
        <input
          type="month"
          value={yearMonth}
          onChange={e => setYearMonth(e.target.value)}
          className="input w-40"
        />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        {anyUnsaved && (
          <button className="btn-primary ml-auto" onClick={saveAll}>💾 Save All Changes</button>
        )}
      </div>

      {/* Legend + Holiday Controls */}
      <div className="card space-y-2">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-gray-600">Legend:</span>
          {[
            ['att-full','Full day (9h)'],
            ['att-partial','Partial day'],
            ['att-absent','Absent'],
            ['att-holiday','Holiday (auto 9h)'],
            ['att-holiday-worked','Holiday + worked (extra hrs)'],
          ].map(([cls, label]) => (
            <span key={cls} className={`px-2 py-0.5 rounded text-xs ${cls}`}>{label}</span>
          ))}
          {savingHolidays && <span className="text-orange-500 text-xs">Saving holidays…</span>}
        </div>
        <div className="text-xs text-gray-500">
          💡 Click a date header to toggle <strong>Paid Holiday</strong>. For holiday days, enter <strong>extra hours worked only</strong> (base 9h is auto-credited).
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 p-4">Loading attendance…</div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr className="bg-orange-50">
                <th className="sticky left-0 bg-orange-50 px-3 py-2 text-left font-semibold text-gray-700 border-r border-orange-200 min-w-[160px] z-10">
                  Employee
                </th>
                {days.map(d => {
                  const dn = getDayName(yearMonth, Number(d));
                  const isHol = holidays.includes(d);
                  const isSun = dn === 'Sun';
                  return (
                    <th
                      key={d}
                      onClick={() => !isSun && toggleHoliday(d)}
                      className={`px-1 py-1 text-center font-medium border-r border-gray-200 min-w-[44px] select-none
                        ${isHol ? 'bg-blue-200 text-blue-800 cursor-pointer' : isSun ? 'bg-gray-100 text-gray-400' : 'text-gray-600 cursor-pointer hover:bg-orange-100'}`}
                      title={isHol ? 'Click to remove holiday' : isSun ? 'Sunday' : 'Click to mark as paid holiday'}
                    >
                      <div>{d}</div>
                      <div className="text-gray-400">{dn}</div>
                      {isHol && <div className="text-blue-600 text-[9px]">HOL</div>}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right font-semibold text-gray-700 min-w-[80px]">Total hrs</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-700 min-w-[60px]">Days</th>
                <th className="px-3 py-2 min-w-[100px]"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const hrs = attendance[emp.id] || {};
                const totalHrs = rowTotal(emp.id);
                return (
                  <tr key={emp.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                    <td className="sticky left-0 bg-white px-3 py-1 font-medium text-gray-800 border-r border-orange-200 z-10">
                      <div>{emp.name}</div>
                      <button
                        onClick={() => fillFullDay(emp.id)}
                        className="text-[10px] text-orange-500 hover:underline mt-0.5"
                      >Fill full days</button>
                    </td>

                    {days.map(d => {
                      const isHol = holidays.includes(d);
                      const dn = getDayName(yearMonth, Number(d));
                      const isSun = dn === 'Sun';
                      const val = hrs[d] ?? '';
                      return (
                        <td key={d} className={`px-0.5 py-1 text-center border-r border-gray-100 att-cell ${cellClass(emp.id, d)}`}>
                          {isSun ? (
                            <span className="text-gray-300 text-xs block text-center">—</span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={isHol ? 20 : 24}
                              step={1}
                              value={val === 0 ? '' : val}
                              placeholder={isHol ? '+h' : '0'}
                              onChange={e => setHours(emp.id, d, e.target.value)}
                              className="w-11 h-7 text-center text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-orange-400 bg-transparent"
                              title={isHol ? 'Extra hours worked on holiday (base 9h auto-credited)' : 'Hours worked (9 = full day)'}
                            />
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-1 text-right font-semibold text-gray-700">
                      {totalHrs.toFixed(1)}
                    </td>
                    <td className="px-3 py-1 text-right text-gray-600">
                      {(totalHrs / 9).toFixed(2)}
                    </td>
                    <td className="px-3 py-1">
                      <button
                        onClick={() => saveRow(emp)}
                        disabled={!unsaved[emp.id] || saving[emp.id]}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                          unsaved[emp.id]
                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                            : 'bg-gray-100 text-gray-400 cursor-default'
                        }`}
                      >
                        {saving[emp.id] ? '…' : unsaved[emp.id] ? 'Save' : '✓ Saved'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
