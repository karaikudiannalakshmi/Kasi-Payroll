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
  // Build workbook using ExcelJS-compatible XLSX approach via SheetJS
  const wb = XLSX.utils.book_new();

  // Header texts exactly matching bank template
  const H_A = 'Transaction type \n(Within Bank (WIB)/\nNEFT (NFT)/\nRTGS (RTG)/\nIMPS (IFC))';
  const H_B = 'Debit Account no\nShould be exactly 12 digit';
  const H_C = 'Amount (\u20B9)\n(Should not be more than 15 digits including decimals and paise)';
  const H_D = 'Bene ID\n(Should be pre-registered in CIB)';
  const H_E = 'Remarks\n(should not be more than 30 characters)';

  // Build aoa (array of arrays) for precise control
  const aoa = [[H_A, H_B, H_C, H_D, H_E]];
  rows.forEach(r => {
    aoa.push([
      'NFT',
      ACCOUNT,
      r.netPay,                              // numeric amount
      r.beneId ? String(r.beneId) : '',      // text bene id
      (r.name || '').substring(0, 30),       // remarks max 30 chars
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths matching original template exactly
  ws['!cols'] = [
    { wch: 18 },          // A - transaction type
    { wch: 21.4 },        // B - debit account
    { wch: 14.9 },        // C - amount
    { wch: 25 },          // D - bene ID
    { wch: 23.3 },        // E - remarks
  ];

  // Row 1 height = 141 (tall header matching template)
  ws['!rows'] = [{ hpt: 141 }];

  // Apply cell styles using SheetJS cell objects
  const thin = { style: 'thin', color: { auto: 1 } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };

  const totalRows = aoa.length;
  const cols = ['A', 'B', 'C', 'D', 'E'];

  for (let r = 0; r < totalRows; r++) {
    for (let c = 0; c < 5; c++) {
      const addr = cols[c] + (r + 1);
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };

      const isHeader = r === 0;
      const isAmountCol = c === 2;   // C - amount: numeric
      const isBeneCol   = c === 3;   // D - bene ID: text, center
      const isDebitCol  = c === 1;   // B - debit acct: text, center

      // Set correct type - only amount column (C) is numeric, all others are TEXT
      if (!isHeader) {
        if (isAmountCol) {
          ws[addr].t = 'n';  // numeric
          ws[addr].z = '0';  // integer, no decimals
        } else {
          // Force text for A, B, D, E
          const v = ws[addr].v;
          ws[addr].t = 's';
          ws[addr].v = String(v ?? '');
        }
      }

      ws[addr].s = {
        border,
        alignment: {
          wrapText: isHeader ? true : false,
          horizontal: (isDebitCol || isAmountCol || isBeneCol) ? 'center' : 'left',
          vertical: 'center',
        },
        font: { name: 'Calibri', sz: 11 },
      };
    }
  }

  // Mark ranges for SheetJS
  ws['!ref'] = 'A1:E' + totalRows;

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
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
