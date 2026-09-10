import { db } from '../firebase/config';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, orderBy, query, serverTimestamp } from 'firebase/firestore';

// New tick-based system starts from September 2026
const NEW_SYSTEM_FROM = '2026-09';
const isNewSys = ym => ym >= NEW_SYSTEM_FROM;

// ── Employees ────────────────────────────────────────────────────────────────
export const employeesRef = () => collection(db, 'employees');
export async function getEmployees() {
  const snap = await getDocs(query(employeesRef(), orderBy('sortOrder','asc')));
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (rows.length && rows[0].sortOrder == null) return rows.sort((a,b) => a.name.localeCompare(b.name));
  return rows;
}
export async function saveEmployee(emp) {
  if (emp.id) {
    const { id, ...rest } = emp;
    await updateDoc(doc(db,'employees',id), {...rest, updatedAt: serverTimestamp()});
    return emp.id;
  } else {
    if (emp.sortOrder == null) { const s = await getDocs(employeesRef()); emp.sortOrder = s.size+1; }
    const ref = await addDoc(employeesRef(), {...emp, active:true, createdAt: serverTimestamp()});
    return ref.id;
  }
}
export async function toggleEmployee(id, active) { await updateDoc(doc(db,'employees',id), { active }); }
export async function deleteAllEmployees() {
  const snap = await getDocs(employeesRef());
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db,'employees',d.id))));
}

// ── Attendance (OLD: hour-based, pre-Sep 2026) ────────────────────────────────
export async function getMonthAttendance(ym) {
  if (isNewSys(ym)) {
    // Route to new collection; also compute otHours/permHours totals for salary
    const snap = await getDocs(collection(db,'attendance_new',ym,'employees'));
    const map = {};
    snap.docs.forEach(d => {
      const data = d.data();
      const otHours   = Object.values(data.ot   || {}).reduce((s,v) => s + Number(v||0), 0);
      const permHours = Object.values(data.perm  || {}).reduce((s,v) => s + Number(v||0), 0);
      map[d.id] = { ...data, otHours, permHours };
    });
    return map;
  }
  const snap = await getDocs(collection(db,'attendance',ym,'employees'));
  const map = {}; snap.docs.forEach(d => { map[d.id] = d.data().hours||{}; }); return map;
}
export async function saveEmployeeAttendance(ym, empId, hours) {
  await setDoc(doc(db,'attendance',ym,'employees',empId), { hours });
}

// ── Attendance (NEW: tick + OT + Permission, Sep 2026+) ──────────────────────
export async function getNewMonthAttendance(ym) {
  const snap = await getDocs(collection(db,'attendance_new',ym,'employees'));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  return map;
}
export async function saveNewEmployeeAttendance(ym, empId, data) {
  await setDoc(doc(db,'attendance_new',ym,'employees',empId), data);
}

// ── Holidays ─────────────────────────────────────────────────────────────────
export async function getHolidays(ym) {
  const snap = await getDoc(doc(db,'holidays',ym));
  return snap.exists() ? (snap.data().paid||[]) : [];
}
export async function saveHolidays(ym, paid) { await setDoc(doc(db,'holidays',ym), { paid }); }

// ── Advances ─────────────────────────────────────────────────────────────────
export async function getAllAdvancesForMonth(ym) {
  const snap = await getDocs(collection(db,'advances'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.deductMonth===ym);
}
export async function getAdvances(filters={}) {
  const snap = await getDocs(collection(db,'advances'));
  let rows = snap.docs.map(d=>({id:d.id,...d.data()}));
  if (filters.empId) rows = rows.filter(r=>r.empId===filters.empId);
  if (filters.deductMonth) {
    rows = rows.filter(r=>r.deductMonth===filters.deductMonth);
    if (!filters.includeDeducted) rows = rows.filter(r=>!r.deducted);
  }
  return rows.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
export async function addAdvance(data) { return addDoc(collection(db,'advances'),{...data, createdAt:serverTimestamp()}); }
export async function updateAdvance(id, data) { return updateDoc(doc(db,'advances',id), data); }
export async function deleteAdvance(id) { return deleteDoc(doc(db,'advances',id)); }

// ── Loans ─────────────────────────────────────────────────────────────────────
export async function getLoans() {
  const snap = await getDocs(collection(db,'loans'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.startDate||'').localeCompare(a.startDate||''));
}
export async function addLoan(data) {
  return addDoc(collection(db,'loans'),{...data, paidInstallments:0, balance:data.principalAmount, status:'active', createdAt:serverTimestamp()});
}
export async function updateLoan(id, data) { return updateDoc(doc(db,'loans',id), data); }
export async function getLoanPayments(loanId) {
  const snap = await getDocs(collection(db,'loans',loanId,'payments'));
  return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.month||'').localeCompare(b.month||''));
}
export async function recordLoanPayment(loanId, month, amount, newBalance) {
  const paymentRef = doc(db,'loans',loanId,'payments',month);
  const existing   = await getDoc(paymentRef);
  const isNew      = !existing.exists();
  // Write / overwrite the payment document
  await setDoc(paymentRef, {amount, balance:newBalance, month});
  const status = newBalance<=0 ? 'closed' : 'active';
  if (isNew) {
    // New payment: increment paidInstallments
    const lsnap = await getDoc(doc(db,'loans',loanId));
    const paid  = (lsnap.data()?.paidInstallments||0)+1;
    await updateDoc(doc(db,'loans',loanId), {paidInstallments:paid, balance:Math.max(0,newBalance), status});
  } else {
    // Re-recording same month: just update balance and status, don't double-count
    await updateDoc(doc(db,'loans',loanId), {balance:Math.max(0,newBalance), status});
  }
}

// ── Salary Records ────────────────────────────────────────────────────────────
export async function getSalaryRecords(ym) {
  const snap = await getDocs(collection(db,'salaries',ym,'employees'));
  const map = {}; snap.docs.forEach(d=>{ map[d.id]=d.data(); }); return map;
}
export async function saveSalaryRecord(ym, empId, data) {
  await setDoc(doc(db,'salaries',ym,'employees',empId),{...data, savedAt:serverTimestamp()});
}
