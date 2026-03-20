import * as XLSX from 'xlsx';
import { monthLabel } from './calculations';

const DEBIT_ACCOUNT = '606905019773'; // organisation's bank account

/**
 * Generate Bank Upload Excel (NEFT format matching existing template)
 * @param {Array} rows - [{name, beneId, netPay}]
 * @param {string} yearMonth
 */
export function exportBankUpload(rows, yearMonth) {
  const data = rows.map(r => ({
    'Transaction type \n(Within Bank (WIB)/\nNEFT (NFT)/\nRTGS (RTG)/\nIMPS (IFC))': 'NFT',
    'Debit Account no\nShould be exactly 12 digit': DEBIT_ACCOUNT,
    'Amount (₹)\n(Should not be more than 15 digits including decimals and paise)': r.netPay,
    'Bene ID\n(Should be pre-registered in CIB)': r.beneId || '',
    'Remarks\n(should not be more than 30 characters)': (r.name || '').substring(0, 30),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bank Upload');
  XLSX.writeFile(wb, `BankUpload_${yearMonth}.xlsx`);
}

/**
 * Export full salary statement
 */
export function exportSalaryStatement(rows, yearMonth) {
  const data = rows.map((r, i) => ({
    'S.No': i + 1,
    'Name': r.name,
    'Monthly Salary': r.monthlySalary,
    'Effective Days': +r.effectiveDays.toFixed(2),
    'Total Hours': +r.totalEffectiveHours.toFixed(1),
    'Daily Rate': +r.daily.toFixed(2),
    'Gross Salary': r.grossSalary,
    'Advance Deduction': r.advanceDeduction || 0,
    'Loan EMI': r.loanDeduction || 0,
    'Net Pay': r.netPay,
    'Bank Bene ID': r.beneId || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [6,24,14,14,14,12,14,16,12,12,16].map(w => ({ wch: w }));

  // Add total row
  const totalRow = {
    'S.No': '', 'Name': 'TOTAL',
    'Gross Salary': rows.reduce((s, r) => s + r.grossSalary, 0),
    'Advance Deduction': rows.reduce((s, r) => s + (r.advanceDeduction || 0), 0),
    'Loan EMI': rows.reduce((s, r) => s + (r.loanDeduction || 0), 0),
    'Net Pay': rows.reduce((s, r) => s + r.netPay, 0),
  };
  XLSX.utils.sheet_add_json(ws, [totalRow], { skipHeader: true, origin: -1 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Salary Statement');
  XLSX.writeFile(wb, `SalaryStatement_${yearMonth}.xlsx`);
}

/**
 * Export individual payslip data as Excel
 */
export function exportPayslips(rows, yearMonth) {
  const label = monthLabel(yearMonth);
  const data = rows.map((r, i) => ({
    'S.No': i + 1,
    'Employee Name': r.name,
    'Month': label,
    'Monthly CTC': r.monthlySalary,
    'Daily Rate (₹)': +r.daily.toFixed(2),
    'Full Days': +r.effectiveDays.toFixed(2),
    'Total Hours': +r.totalEffectiveHours.toFixed(1),
    'Gross Salary': r.grossSalary,
    'Advance Deduction': r.advanceDeduction || 0,
    'Loan EMI Deduction': r.loanDeduction || 0,
    'Net Salary Paid': r.netPay,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [6,24,16,14,16,12,12,14,16,18,16].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payslips');
  XLSX.writeFile(wb, `Payslips_${yearMonth}.xlsx`);
}
