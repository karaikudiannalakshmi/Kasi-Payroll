import * as XLSX from 'xlsx';
import { monthLabel } from './calculations';

const DEBIT_ACCOUNT = '606905019773'; // organisation's bank account

/**
 * Generate Bank Upload Excel (NEFT format matching existing template)
 * @param {Array} rows - [{name, beneId, netPay}]
 * @param {string} yearMonth
 */
export function exportBankUpload(rows, yearMonth, debitAccountOverride) {
  const ACCOUNT = debitAccountOverride || DEBIT_ACCOUNT;

  const wb = XLSX.utils.book_new();

  // Header row
  const H_A = 'Transaction type \n(Within Bank (WIB)/\nNEFT (NFT)/\nRTGS (RTG)/\nIMPS (IFC))';
  const H_B = 'Debit Account no\nShould be exactly 12 digit';
  const H_C = 'Amount (\u20B9)\n(Should not be more than 15 digits including decimals and paise)';
  const H_D = 'Bene ID\n(Should be pre-registered in CIB)';
  const H_E = 'Remarks\n(should not be more than 30 characters)';

  const ws = {};
  const thin = { style: 'thin', color: { rgb: '000000' } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  const setCell = (addr, value, isText, isCenter, isWrap) => {
    ws[addr] = {
      v: value,
      t: isText ? 's' : (typeof value === 'number' ? 'n' : 's'),
      z: isText ? '@' : (typeof value === 'number' ? '0' : '@'),
      s: {
        border,
        alignment: {
          horizontal: isCenter ? 'center' : 'left',
          vertical: 'center',
          wrapText: isWrap || false,
        },
        font: { name: 'Calibri', sz: 11 },
      },
    };
  };

  // Header row (row 1) - all wrap text, tall row
  setCell('A1', H_A, true, false, true);
  setCell('B1', H_B, true, false, true);
  setCell('C1', H_C, true, false, true);
  setCell('D1', H_D, true, true,  true);
  setCell('E1', H_E, true, false, true);

  // Data rows
  rows.forEach((r, i) => {
    const row = i + 2;
    setCell(`A${row}`, 'NFT',                               true,  false, true);
    setCell(`B${row}`, String(ACCOUNT),                     true,  true,  true);
    setCell(`C${row}`, Number(r.netPay),                    false, true,  true);
    setCell(`D${row}`, String(r.customerId || r.beneId || ''), true, true, true);
    setCell(`E${row}`, String(r.name || '').substring(0, 30), true, false, true);
  });

  const totalRows = rows.length + 1;
  ws['!ref'] = `A1:E${totalRows}`;

  ws['!cols'] = [
    { wch: 18 },
    { wch: 21.43 },
    { wch: 14.86 },
    { wch: 25.0 },
    { wch: 23.29 },
  ];

  ws['!rows'] = [{ hpt: 141 }]; // header row height = 141pt

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `BankUpload_${yearMonth}.xlsx`);
}


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
