import { useEffect, useState, useCallback } from 'react';
import { getEmployees, getMonthAttendance, getHolidays } from '../hooks/useFirebase';
import { calcEmployeeSalary, currentYM, monthLabel, daysInMonth, fmt, getRates, HOURS_PER_DAY } from '../utils/calculations';
import * as XLSX from 'xlsx';

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function DailySheet() {
  const [yearMonth, setYearMonth] = useState(currentYM());
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [holidays, setHolidays]     = useState([]);
  const [loading, setLoading]       = useState(true);

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
    setLoading(false);
  }, [yearMonth]);

  useEffect(() => { load(); }, [load]);

  const [yr, mo] = yearMonth.split('-').map(Number);
  const totalDays = daysInMonth(yearMonth);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Build daily salary grid: emp → day → { hours, salary }
  const grid = employees.map(emp => {
    const { hourly } = getRates(emp.salary);
    const hrs = attendance[emp.id] || {};
    const dailyData = days.map(d => {
      const key = String(d).padStart(2, '0');
      const isHol = holidays.includes(key);
      const entered = Number(hrs[key] || 0);
      const effective = isHol ? HOURS_PER_DAY + entered : entered;
      const salary = Math.round(effective * hourly);
      return { d, key, isHol, entered, effective, salary };
    });
    const totalHours  = dailyData.reduce((s, x) => s + x.effective, 0);
    const totalSalary = Math.round(totalHours * hourly);
    return { emp, dailyData, totalHours, totalSalary };
  });

  const dayTotals = days.map((_, i) => grid.reduce((s, r) => s + r.dailyData[i].salary, 0));
  const grandTotal = grid.reduce((s, r) => s + r.totalSalary, 0);

  const getDayName = (d) => DAY_NAMES[new Date(yr, mo - 1, d).getDay()];

  const exportExcel = () => {
    const headers = ['S.No', 'Name', 'Monthly', ...days.map(d => `${d}\n${getDayName(d)}`), 'Total Hrs', 'Total Sal'];
    const data = [headers];
    grid.forEach((r, i) => {
      const row = [i + 1, r.emp.name, r.emp.salary, ...r.dailyData.map(x => x.salary || ''), r.totalHours.toFixed(1), r.totalSalary];
      data.push(row);
    });
    // Totals row
    data.push(['', 'TOTAL', '', ...dayTotals.map(t => t || ''), grid.reduce((s,r) => s + r.totalHours, 0).toFixed(1), grandTotal]);

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 22 }, { wch: 10 }, ...days.map(() => ({ wch: 6 })), { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Daily ${yearMonth}`);
    XLSX.writeFile(wb, `DailySalary_${yearMonth}.xlsx`);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-orange-900">📊 Daily Salary Sheet</h1>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="input w-40" />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        <button onClick={exportExcel} className="btn-green ml-auto">📥 Export Excel</button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 p-4">Loading…</div>
      ) : (
        <div className="card p-0 overflow-hidden" style={{height:"calc(100vh - 220px)"}}>
          <div className="overflow-auto h-full">
          <table className="text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-20">
              <tr className="bg-orange-50">
                <th className="sticky left-0 bg-orange-50 px-3 py-2 text-left font-semibold text-gray-700 border-r border-orange-200 min-w-[160px] z-30">#  Name</th>
                <th className="px-2 py-1 text-right font-semibold text-gray-600 border-r border-gray-200 min-w-[60px]">CTC</th>
                {days.map(d => {
                  const dn = getDayName(d);
                  const isHol = holidays.includes(String(d).padStart(2,'0'));
                  return (
                    <th key={d} className={`px-1 py-1 text-center font-medium border-r border-gray-200 min-w-[42px] ${isHol ? 'bg-blue-100 text-blue-800' : 'text-gray-600'}`}>
                      <div>{d}</div>
                      <div className="text-gray-400 font-normal">{dn}</div>
                    </th>
                  );
                })}
                <th className="px-2 py-1 text-right font-semibold text-gray-700 min-w-[60px]">Hrs</th>
                <th className="px-2 py-1 text-right font-semibold text-gray-700 min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {grid.map((r, i) => (
                <tr key={r.emp.id} className="border-b border-gray-100 hover:bg-amber-50/50">
                  <td className="sticky left-0 bg-white px-3 py-1 font-medium text-gray-800 border-r border-orange-200 z-10">
                    {i + 1}. {r.emp.name}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-500 border-r border-gray-200">
                    {(r.emp.salary / 1000).toFixed(0)}k
                  </td>
                  {r.dailyData.map(x => (
                    <td key={x.d} className={`px-1 py-1 text-center border-r border-gray-100 ${
                      x.isHol && x.entered > 0 ? 'bg-indigo-50' :
                      x.isHol ? 'bg-blue-50' :
                      x.salary > 0 ? '' : 'bg-gray-50'
                    }`}>
                      {x.salary > 0 ? (
                        <div>
                          <div className={`font-medium ${x.isHol ? 'text-blue-700' : 'text-gray-700'}`}>
                            {x.salary >= 1000 ? `${(x.salary/1000).toFixed(1)}k` : x.salary}
                          </div>
                          <div className="text-gray-400">{x.effective}h</div>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-semibold text-gray-700">
                    {r.totalHours.toFixed(1)}
                  </td>
                  <td className="px-2 py-1 text-right font-bold text-green-700">
                    {fmt(r.totalSalary)}
                  </td>
                </tr>
              ))}
              {/* Day totals */}
              <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                <td className="sticky left-0 bg-orange-50 px-3 py-1 text-gray-700 border-r border-orange-200 z-10">TOTAL</td>
                <td className="px-2 py-1 border-r border-gray-200"></td>
                {dayTotals.map((t, i) => (
                  <td key={i} className="px-1 py-1 text-center text-xs font-bold text-orange-700 border-r border-gray-200">
                    {t > 0 ? (t >= 1000 ? `${(t/1000).toFixed(0)}k` : t) : ''}
                  </td>
                ))}
                <td className="px-2 py-1 text-right text-gray-700">
                  {grid.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}
                </td>
                <td className="px-2 py-1 text-right text-green-700">{fmt(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
