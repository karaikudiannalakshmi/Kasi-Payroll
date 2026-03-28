import { db } from '../firebase/config';
import {
  collection, doc, getDocs, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

// ── Employees ────────────────────────────────────────────────────────────────
export const employeesRef = () => collection(db, 'employees');

export async function getEmployees() {
  const snap = await getDocs(query(employeesRef(), orderBy('sortOrder', 'asc')));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (rows.length && rows[0].sortOrder == null) {
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  return rows;
}

export async function saveEmployee(emp) {
  if (emp.id) {
    const { id, ...rest } = emp;
    await updateDoc(doc(db, 'employees', id), { ...rest, updatedAt: serverTimestamp() });
    return emp.id;
  } else {
    // assign sortOrder = current count + 1 if not provided
    if (emp.sortOrder == null) {
      const snap = await getDocs(employeesRef());
      emp.sortOrder = snap.size + 1;
    }
    const ref = await addDoc(employeesRef(), { ...emp, active: true, createdAt: serverTimestamp() });
    return ref.id;
  }
}

export async function toggleEmployee(id, active) {
  await updateDoc(doc(db, 'employees', id), { active });
}

export async function deleteAllEmployees() {
  const snap = await getDocs(employeesRef());
  const deletes = snap.docs.map(d => deleteDoc(doc(db, 'employees', d.id)));
  await Promise.all(deletes);
}

// ── Attendance ────────────────────────────────────────────────────────────────
// Path: attendance/{YYYY-MM}/employees/{empId}  → { hours: {"01":9,"02":0,...} }
export async function getMonthAttendance(yearMonth) {
  const snap = await getDocs(collection(db, 'attendance', yearMonth, 'employees'));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data().hours || {}; });
  return map;
}

export async function saveEmployeeAttendance(yearMonth, empId, hours) {
  await setDoc(doc(db, 'attendance', yearMonth, 'employees', empId), { hours });
}

// ── Holidays ─────────────────────────────────────────────────────────────────
// Path: holidays/{YYYY-MM}  → { paid: ["01","15",...] }
export async function getHolidays(yearMonth) {
  const snap = await getDoc(doc(db, 'holidays', yearMonth));
  return snap.exists() ? (snap.data().paid || []) : [];
}

export async function saveHolidays(yearMonth, paid) {
  await setDoc(doc(db, 'holidays', yearMonth), { paid });
}

// ── Advances ─────────────────────────────────────────────────────────────────
export async function getAdvances(filters = {}) {
  let q = collection(db, 'advances');
  const snap = await getDocs(q);
  let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (filters.empId) rows = rows.filter(r => r.empId === filters.empId);
  if (filters.deductMonth) rows = rows.filter(r => r.deductMonth === filters.deductMonth);
  // For salary calculation, skip advances already deducted
  if (filters.deductMonth) rows = rows.filter(r => !r.deducted);
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function addAdvance(data) {
  return addDoc(collection(db, 'advances'), { ...data, createdAt: serverTimestamp() });
}

export async function updateAdvance(id, data) {
  return updateDoc(doc(db, 'advances', id), data);
}

export async function deleteAdvance(id) {
  return deleteDoc(doc(db, 'advances', id));
}

// ── Loans ─────────────────────────────────────────────────────────────────────
export async function getLoans() {
  const snap = await getDocs(collection(db, 'loans'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
}

export async function addLoan(data) {
  return addDoc(collection(db, 'loans'), {
    ...data,
    paidInstallments: 0,
    balance: data.principalAmount,
    status: 'active',
    createdAt: serverTimestamp(),
  });
}

export async function updateLoan(id, data) {
  return updateDoc(doc(db, 'loans', id), data);
}

export async function getLoanPayments(loanId) {
  const snap = await getDocs(collection(db, 'loans', loanId, 'payments'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.month || '').localeCompare(b.month || ''));
}

export async function recordLoanPayment(loanId, month, amount, newBalance) {
  await setDoc(doc(db, 'loans', loanId, 'payments', month), { amount, balance: newBalance, month });
  const status = newBalance <= 0 ? 'closed' : 'active';
  await updateDoc(doc(db, 'loans', loanId), {
    paidInstallments: (await getLoans()).find(l => l.id === loanId)?.paidInstallments + 1 || 1,
    balance: Math.max(0, newBalance),
    status,
  });
}

// ── Salary Records ────────────────────────────────────────────────────────────
export async function getSalaryRecords(yearMonth) {
  const snap = await getDocs(collection(db, 'salaries', yearMonth, 'employees'));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  return map;
}

export async function saveSalaryRecord(yearMonth, empId, data) {
  await setDoc(doc(db, 'salaries', yearMonth, 'employees', empId), { ...data, savedAt: serverTimestamp() });
}
