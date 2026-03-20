import { useEffect, useState } from 'react';
import {
  getEmployees, getMonthAttendance, getHolidays,
  getAdvances, getLoans, saveSalaryRecord, getSalaryRecords,
} from '../hooks/useFirebase';
import { calcEmployeeSalary, calcNetPay, currentYM, monthLabel, fmt } from '../utils/calculations';
import { exportBankUpload, exportSalaryStatement, exportPayslips } from '../utils/exportUtils';

export default function Salary() {
  const [yearMonth, setYearMonth] = useState(currentYM());
  const [data, setData]           = useState([]); // processed salary rows
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [payslipEmp, setPayslipEmp] = useState(null);
  const [debitAccount, setDebitAccount] = useState('606905019773');

  const calculate = async () => {
    setLoading(true);
    try {
      const [employees, attendance, holidays, advances, loans, savedRecords] = await Promise.all([
        getEmployees(),
        getMonthAttendance(yearMonth),
        getHolidays(yearMonth),
        getAdvances({ deductMonth: yearMonth }),
        getLoans(),
        getSalaryRecords(yearMonth),
      ]);

      const active = employees.filter(e => e.active !== false);

      // Advance deductions per employee this month
      const advMap = {};
      advances.forEach(a => {
        advMap[a.empId] = (advMap[a.empId] || 0) + Number(a.amount || 0);
      });

      // Loan EMI deductions
      const loanMap = {};
      loans.filter(l => l.status === 'active' && l.startDate <= yearMonth).forEach(l => {
        const emi = Math.min(Number(l.emi), Number(l.balance));
        loanMap[l.empId] = (loanMap[l.empId] || 0) + emi;
      });

      const rows = active.map(emp => {
        const calc = calcEmployeeSalary(
          emp.salary,
          attendance[emp.id] || {},
          holidays,
          yearMonth,
        );
        const advanceDeduction = advMap[emp.id] || 0;
        const loanDeduction    = loanMap[emp.id] || 0;
        const netPay = calcNetPay(calc.grossSalary, advanceDeduction, loanDeduction);
        const saved  = savedRecords[emp.id];
        return {
          ...emp,
          ...calc,
          monthlySalary: emp.salary,
          advanceDeduction,
          loanDeduction,
          netPay,
          isSaved: !!saved,
        };
      });

      setData(rows);
    } finally { setLoading(false); }
  };

  const processSalary = async () => {
    if (!window.confirm(`Finalise salary for ${monthLabel(yearMonth)}? This saves all records.`)) return;
    setSaving(true);
    for (const row of data) {
      await saveSalaryRecord(yearMonth, row.id, {
        grossSalary: row.grossSalary,
        totalEffectiveHours: row.totalEffectiveHours,
        effectiveDays: row.effectiveDays,
        advanceDeduction: row.advanceDeduction,
        loanDeduction: row.loanDeduction,
        netPay: row.netPay,
      });
    }
    setSaving(false);
    await calculate();
    alert('Salary records saved!');
  };

  useEffect(() => { calculate(); }, [yearMonth]);

  const totals = data.reduce((acc, r) => ({
    gross:    acc.gross    + r.grossSalary,
    advance:  acc.advance  + r.advanceDeduction,
    loan:     acc.loan     + r.loanDeduction,
    net:      acc.net      + r.netPay,
  }), { gross: 0, advance: 0, loan: 0, net: 0 });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-orange-900">💰 Salary Processing</h1>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)} className="input w-40" />
        <span className="text-sm text-gray-500">{monthLabel(yearMonth)}</span>
        <button onClick={calculate} disabled={loading} className="btn-secondary ml-auto">
          {loading ? '⏳ Calculating…' : '🔄 Recalculate'}
        </button>
      </div>

      {/* Debit account setting */}
      <div className="card flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Organisation Debit A/c:</label>
        <input className="input w-48 font-mono" value={debitAccount} onChange={e => setDebitAccount(e.target.value)} maxLength={12} />
        <span className="text-xs text-gray-400">(12-digit CIB account for bank upload)</span>
      </div>

      {/* Totals summary */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Gross Salary', value: fmt(totals.gross), color: 'bg-green-50 border-green-200' },
            { label: 'Advance Deductions', value: fmt(totals.advance), color: 'bg-yellow-50 border-yellow-200' },
            { label: 'Loan EMIs', value: fmt(totals.loan), color: 'bg-orange-50 border-orange-200' },
            { label: 'Total Net Pay', value: fmt(totals.net), color: 'bg-blue-50 border-blue-200' },
          ].map(c => (
            <div key={c.label} className={`card border ${c.color}`}>
              <div className="text-xs text-gray-500">{c.label}</div>
              <div className="text-lg font-bold text-gray-800 mt-0.5">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {data.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => exportBankUpload(data.map(r => ({
            name: r.name, beneId: r.beneId, netPay: r.netPay
          })), yearMonth)} className="btn-green">
            🏦 Export Bank Upload
          </button>
          <button onClick={() => exportSalaryStatement(data, yearMonth)} className="btn-secondary">
            📊 Export Salary Statement
          </button>
          <button onClick={() => exportPayslips(data, yearMonth)} className="btn-secondary">
            🧾 Export Payslips (Excel)
          </button>
          <button onClick={processSalary} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : '✅ Finalise & Save Salary'}
          </button>
        </div>
      )}

      {/* Salary Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Calculating…</div>
        ) : data.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No active employees found.</div>
        ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead><tr className="border-b">
              {['S.No','Name','Monthly CTC','Eff. Days','Total Hours','Gross Salary','Advance Ded.','Loan EMI','Net Pay','Status',''].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.id} className="border-b hover:bg-orange-50">
                  <td className="td">{i + 1}</td>
                  <td className="td font-medium">{r.name}</td>
                  <td className="td">{fmt(r.monthlySalary)}</td>
                  <td className="td">{r.effectiveDays.toFixed(2)}</td>
                  <td className="td">{r.totalEffectiveHours.toFixed(1)}</td>
                  <td className="td font-semibold text-green-700">{fmt(r.grossSalary)}</td>
                  <td className="td text-red-600">{r.advanceDeduction > 0 ? `−${fmt(r.advanceDeduction)}` : '—'}</td>
                  <td className="td text-orange-600">{r.loanDeduction > 0 ? `−${fmt(r.loanDeduction)}` : '—'}</td>
                  <td className="td font-bold text-blue-700">{fmt(r.netPay)}</td>
                  <td className="td">
                    {r.isSaved ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Saved</span>
                               : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Draft</span>}
                  </td>
                  <td className="td">
                    <button onClick={() => setPayslipEmp(r)} className="text-xs text-blue-600 hover:underline">
                      Payslip
                    </button>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-orange-50 font-bold border-t-2 border-orange-200">
                <td className="td" colSpan={5}>TOTAL ({data.length} employees)</td>
                <td className="td text-green-700">{fmt(totals.gross)}</td>
                <td className="td text-red-600">{totals.advance > 0 ? `−${fmt(totals.advance)}` : '—'}</td>
                <td className="td text-orange-600">{totals.loan > 0 ? `−${fmt(totals.loan)}` : '—'}</td>
                <td className="td text-blue-700">{fmt(totals.net)}</td>
                <td className="td" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Payslip Modal */}
      {payslipEmp && (
        <PayslipModal emp={payslipEmp} yearMonth={yearMonth} onClose={() => setPayslipEmp(null)} />
      )}
    </div>
  );
}

function PayslipModal({ emp, yearMonth, onClose }) {
  const lines = [
    { label: 'Monthly CTC',           value: fmt(emp.monthlySalary) },
    { label: 'Daily Rate (÷26)',       value: fmt(emp.daily?.toFixed(2)) },
    { label: 'Standard Hours / Day',   value: '9 hours' },
    { label: 'Total Effective Hours',  value: emp.totalEffectiveHours?.toFixed(1) + ' hrs' },
    { label: 'Effective Days',         value: emp.effectiveDays?.toFixed(4) },
    { label: 'Gross Salary',           value: fmt(emp.grossSalary), bold: true },
    { label: '', value: '', hr: true },
    { label: 'Advance Deduction',      value: emp.advanceDeduction > 0 ? `−${fmt(emp.advanceDeduction)}` : 'Nil', color: 'text-red-600' },
    { label: 'Loan EMI Deduction',     value: emp.loanDeduction > 0 ? `−${fmt(emp.loanDeduction)}` : 'Nil', color: 'text-orange-600' },
    { label: '', value: '', hr: true },
    { label: 'NET SALARY PAYABLE',     value: fmt(emp.netPay), bold: true, color: 'text-blue-700 text-base' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md payslip-page" id="payslip-print">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-700 to-red-800 text-white p-4 rounded-t-xl">
          <div className="text-center">
            <div className="font-bold text-lg">🕉️ Kasi Visvanathar Koviloor Foundation</div>
            <div className="text-orange-200 text-xs mt-0.5">Varanasi Kitchen · Pay Slip</div>
          </div>
        </div>

        <div className="p-5 space-y-1">
          <div className="flex justify-between text-sm mb-3">
            <div>
              <span className="text-gray-500 text-xs">Employee: </span>
              <span className="font-bold">{emp.name}</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs">Month: </span>
              <span className="font-semibold">{monthLabel(yearMonth)}</span>
            </div>
          </div>

          {lines.map((l, i) => l.hr ? (
            <hr key={i} className="my-2 border-gray-200" />
          ) : (
            <div key={i} className="flex justify-between py-0.5">
              <span className={`text-sm text-gray-600 ${l.bold ? 'font-semibold' : ''}`}>{l.label}</span>
              <span className={`text-sm font-medium ${l.bold ? 'font-bold' : ''} ${l.color || ''}`}>{l.value}</span>
            </div>
          ))}

          {emp.beneId && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
              Bank Bene ID: <span className="font-mono">{emp.beneId}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button onClick={() => window.print()} className="btn-secondary flex-1">🖨️ Print</button>
          <button onClick={onClose} className="btn-primary flex-1">Close</button>
        </div>
      </div>
    </div>
  );
}
