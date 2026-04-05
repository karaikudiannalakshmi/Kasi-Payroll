import * as XLSX from 'xlsx';
import { monthLabel } from './calculations';

const DEBIT_ACCOUNT = '606905019773';

export function exportBankUpload(rows, yearMonth, debitAccountOverride) {
  const ACCOUNT = debitAccountOverride || DEBIT_ACCOUNT;
  const wb = XLSX.utils.book_new();

  const H_A = 'Transaction type \n(Within Bank (WIB)/\nNEFT (NFT)/\nRTGS (RTG)/\nIMPS (IFC))';
  const H_B = 'Debit Account no\nShould be exactly 12 digit';
  const H_C = 'Amount (\u20B9)\n(Should not be more than 15 digits including decimals and paise)';
  const H_D = 'Bene ID\n(Should be pre-registered in CIB)';
  const H_E = 'Remarks\n(should not be more than 30 characters)';

  const ws = {};
  const thin   = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  const setCell = (addr, value, isText, isCenter, isWrap) => {
    ws[addr] = {
      v: value,
      t: isText ? 's' : (typeof value === 'number' ? 'n' : 's'),
      z: isText ? '@' : (typeof value === 'number' ? '0' : '@'),
      s: {
        border,
        alignment: { horizontal: isCenter ? 'center' : 'left', vertical: 'center', wrapText: isWrap || false },
        font: { name: 'Calibri', sz: 11 },
      },
    };
  };

  setCell('A1', H_A, true, false, true);
  setCell('B1', H_B, true, false, true);
  setCell('C1', H_C, true, false, true);
  setCell('D1', H_D, true, true,  true);
  setCell('E1', H_E, true, false, true);

  rows.forEach((r, i) => {
    const row = i + 2;
    setCell(`A${row}`, 'NFT',                                       true,  false, true);
    setCell(`B${row}`, String(ACCOUNT),                              true,  true,  true);
    setCell(`C${row}`, Number(r.netPay),                             false, true,  true);
    setCell(`D${row}`, String(r.customerId || r.beneId || ''),       true,  true,  true);
    setCell(`E${row}`, String(r.name || '').substring(0, 30),        true,  false, true);
  });

  ws['!ref']  = `A1:E${rows.length + 1}`;
  ws['!cols'] = [{ wch: 18 }, { wch: 21.43 }, { wch: 14.86 }, { wch: 25.0 }, { wch: 23.29 }];
  ws['!rows'] = [{ hpt: 141 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `BankUpload_${yearMonth}.xlsx`);
}

/**
 * Comprehensive monthly export:
 * Sheet1: Salary Statement
 * Sheet2: Advances this month
 * Sheet3: Loan EMIs this month
 */
export function exportMonthlyReport(salaryRows, advances, loans, yearMonth) {
  const label = monthLabel(yearMonth);
  const wb    = XLSX.utils.book_new();
  const thin  = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  // ── Sheet 1: Salary ───────────────────────────────────────────────────────
  const salData = salaryRows.map((r, i) => ({
    'S.No': i + 1,
    'Name': r.name,
    'Monthly CTC': r.monthlySalary,
    'Effective Days': +r.effectiveDays.toFixed(2),
    'Total Hours': +r.totalEffectiveHours.toFixed(1),
    'Gross Salary': r.grossSalary,
    'Advance Deduction': r.advanceDeduction || 0,
    'Loan EMI': r.loanDeduction || 0,
    'Net Pay': r.netPay,
    'Customer ID': r.customerId || r.beneId || '',
  }));
  // Total row
  salData.push({
    'S.No': '', 'Name': 'TOTAL',
    'Monthly CTC': '', 'Effective Days': '', 'Total Hours': '',
    'Gross Salary': salaryRows.reduce((s, r) => s + r.grossSalary, 0),
    'Advance Deduction': salaryRows.reduce((s, r) => s + (r.advanceDeduction || 0), 0),
    'Loan EMI': salaryRows.reduce((s, r) => s + (r.loanDeduction || 0), 0),
    'Net Pay': salaryRows.reduce((s, r) => s + r.netPay, 0),
    'Customer ID': '',
  });

  const ws1 = XLSX.utils.json_to_sheet(salData);
  ws1['!cols'] = [6, 24, 13, 14, 12, 13, 17, 11, 11, 16].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, `Salary ${label}`);

  // ── Sheet 2: Advances ─────────────────────────────────────────────────────
  const advData = advances.map((a, i) => ({
    'S.No': i + 1,
    'Employee': a.empName || a.empId,
    'Amount': a.amount,
    'Date': a.date || '',
    'Remarks': a.remarks || '',
    'Status': a.deducted ? 'Deducted' : 'Pending',
  }));
  advData.push({
    'S.No': '', 'Employee': 'TOTAL',
    'Amount': advances.reduce((s, a) => s + Number(a.amount || 0), 0),
    'Date': '', 'Remarks': '', 'Status': '',
  });
  const ws2 = XLSX.utils.json_to_sheet(advData);
  ws2['!cols'] = [6, 24, 12, 12, 20, 10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, `Advances ${label}`);

  // ── Sheet 3: Loans ────────────────────────────────────────────────────────
  const loanData = loans.map((l, i) => ({
    'S.No': i + 1,
    'Employee': l.empName || l.empId,
    'Principal': l.principalAmount,
    'EMI/Month': l.emi,
    'Opening Balance': l.openingBalance || l.balance,
    'EMI Deducted': l.emiDeducted || l.emi,
    'Closing Balance': l.closingBalance || Math.max(0, l.balance - l.emi),
    'Purpose': l.purpose || '',
    'Status': l.status,
  }));
  const ws3 = XLSX.utils.json_to_sheet(loanData);
  ws3['!cols'] = [6, 24, 12, 12, 16, 14, 15, 16, 10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws3, `Loans ${label}`);

  XLSX.writeFile(wb, `KasiKitchen_${yearMonth}_Report.xlsx`);
}

export function exportSalaryStatement(rows, yearMonth) {
  const label = monthLabel(yearMonth);
  const data = rows.map((r, i) => ({
    'S.No': i + 1, 'Name': r.name,
    'Monthly CTC': r.monthlySalary,
    'Effective Days': +r.effectiveDays.toFixed(2),
    'Total Hours': +r.totalEffectiveHours.toFixed(1),
    'Gross Salary': r.grossSalary,
    'Advance Deduction': r.advanceDeduction || 0,
    'Loan EMI': r.loanDeduction || 0,
    'Net Pay': r.netPay,
    'Customer ID': r.customerId || r.beneId || '',
  }));
  data.push({
    'S.No': '', 'Name': 'TOTAL', 'Monthly CTC': '', 'Effective Days': '', 'Total Hours': '',
    'Gross Salary': rows.reduce((s, r) => s + r.grossSalary, 0),
    'Advance Deduction': rows.reduce((s, r) => s + (r.advanceDeduction || 0), 0),
    'Loan EMI': rows.reduce((s, r) => s + (r.loanDeduction || 0), 0),
    'Net Pay': rows.reduce((s, r) => s + r.netPay, 0),
    'Customer ID': '',
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [6, 24, 13, 14, 12, 13, 17, 11, 11, 16].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label);
  XLSX.writeFile(wb, `SalaryStatement_${yearMonth}.xlsx`);
}

export function exportPayslips(rows, yearMonth) {
  const label = monthLabel(yearMonth);
  const data = rows.map((r, i) => ({
    'S.No': i + 1, 'Employee': r.name, 'Month': label,
    'Monthly CTC': r.monthlySalary, 'Daily Rate': +r.daily.toFixed(2),
    'Effective Days': +r.effectiveDays.toFixed(2), 'Total Hours': +r.totalEffectiveHours.toFixed(1),
    'Gross Salary': r.grossSalary, 'Advance Deduction': r.advanceDeduction || 0,
    'Loan EMI': r.loanDeduction || 0, 'Net Salary': r.netPay,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [6, 24, 16, 14, 12, 14, 12, 13, 17, 11, 12].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payslips');
  XLSX.writeFile(wb, `Payslips_${yearMonth}.xlsx`);
}
