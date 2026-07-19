import { useEffect, useState } from 'react';
import { getEmployees, getLoans, addLoan, updateLoan, getLoanPayments, recordLoanPayment } from '../hooks/useFirebase';
import { currentYM, monthLabel, fmt } from '../utils/calculations';

const EMPTY_LOAN = {
  empId: '', principalAmount: '', emi: '', startDate: '',
  purpose: '', remarks: '',
};

export default function Loans() {
  const [employees, setEmployees] = useState([]);
  const [loans, setLoans]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);       // 'add' | 'view' | 'edit' | null
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [payments, setPayments]   = useState([]);
  const [form, setForm]           = useState(EMPTY_LOAN);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);
  const [payModal, setPayModal]   = useState(null);
  const [payForm, setPayForm]     = useState({ month: currentYM(), amount: '' });
  const [filterStatus, setFilterStatus] = useState('active');

  const load = async () => {
    setLoading(true);
    const [emps, lns] = await Promise.all([getEmployees(), getLoans()]);
    setEmployees(emps.filter(e => e.active !== false));
    setLoans(lns);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));

  const openAdd = () => {
    setForm({ ...EMPTY_LOAN, startDate: currentYM() });
    setModal('add');
  };

  const openView = async (loan) => {
    setSelectedLoan(loan);
    const pmts = await getLoanPayments(loan.id);
    setPayments(pmts);
    setModal('view');
  };

  const openEdit = (loan) => {
    setSelectedLoan(loan);
    setEditForm({
      empId:           loan.empId ?? '',
      balance:         String(loan.balance ?? ''),
      emi:             String(loan.emi ?? ''),
      principalAmount: String(loan.principalAmount ?? ''),
      status:          loan.status ?? 'active',
      purpose:         loan.purpose ?? '',
      remarks:         loan.remarks ?? '',
    });
    setModal('edit');
  };

  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (!form.empId || !form.principalAmount || !form.emi || !form.startDate) return;
    setSaving(true);
    try {
      await addLoan({
        ...form,
        principalAmount: Number(form.principalAmount),
        emi: Number(form.emi),
        balance: Number(form.principalAmount),
      });
      await load();
      setModal(null);
    } finally { setSaving(false); }
  };

  const handleEditLoan = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const balance = Number(editForm.balance);
      const status  = balance <= 0 ? 'closed' : editForm.status;
      await updateLoan(selectedLoan.id, {
        empId:           editForm.empId,
        balance,
        status,
        emi:             Number(editForm.emi),
        principalAmount: Number(editForm.principalAmount),
        purpose:         editForm.purpose,
        remarks:         editForm.remarks,
      });
      await load();
      setModal(null);
    } finally { setSaving(false); }
  };

  const openPayment = (loan) => {
    setPayForm({ month: currentYM(), amount: String(Math.min(loan.emi, loan.balance)) });
    setPayModal(loan);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!payForm.month || !payForm.amount) return;
    setSaving(true);
    try {
      const newBalance = Math.max(0, payModal.balance - Number(payForm.amount));
      await recordLoanPayment(payModal.id, payForm.month, Number(payForm.amount), newBalance);
      await load();
      setPayModal(null);
    } finally { setSaving(false); }
  };

  const handleClose = async (loan) => {
    if (!window.confirm(`Mark loan for ${empMap[loan.empId]} as CLOSED?`)) return;
    await updateLoan(loan.id, { status: 'closed', balance: 0 });
    await load();
  };

  const filtered = loans.filter(l => filterStatus === 'all' || l.status === filterStatus);

  const totalPrincipal = filtered.reduce((s, l) => s + Number(l.principalAmount || 0), 0);
  const totalBalance   = filtered.reduce((s, l) => s + Number(l.balance || 0), 0);
  const totalEMI       = filtered.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.emi || 0), 0);

  return (
    <div className="p-3 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-orange-900">🏦 Loan Ledger</h1>
        <button className="btn-primary ml-auto" onClick={openAdd}>+ New Loan</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card bg-blue-50 border border-blue-200">
          <div className="text-xs text-gray-500">Total Principal</div>
          <div className="text-xl font-bold text-blue-800">{fmt(totalPrincipal)}</div>
        </div>
        <div className="card bg-orange-50 border border-orange-200">
          <div className="text-xs text-gray-500">Outstanding Balance</div>
          <div className="text-xl font-bold text-orange-800">{fmt(totalBalance)}</div>
        </div>
        <div className="card bg-green-50 border border-green-200 col-span-2 sm:col-span-1">
          <div className="text-xs text-gray-500">Monthly EMI (active loans)</div>
          <div className="text-xl font-bold text-green-800">{fmt(totalEMI)}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card flex gap-2">
        {['active', 'closed', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${filterStatus === s ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-500">{filtered.length} records</span>
      </div>

      {/* Mobile card list */}
      {loading ? (
        <div className="card p-6 text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-6 text-center text-gray-400">No loans found.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(loan => {
              const paidPct = loan.principalAmount > 0
                ? Math.round(((loan.principalAmount - loan.balance) / loan.principalAmount) * 100)
                : 100;
              const months = loan.emi > 0 ? Math.ceil(loan.principalAmount / loan.emi) : '?';
              return (
                <div key={loan.id} className="card border border-orange-100 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-gray-800">
                      {empMap[loan.empId] || <span className="text-red-500 text-xs">⚠ Unknown employee</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {loan.status}
                    </span>
                  </div>
                  {loan.purpose && <div className="text-xs text-gray-500">{loan.purpose}</div>}
                  <div className="text-xs text-gray-400">{loan.emi > 0 ? `${months}-month loan` : ''} · started {loan.startDate ? monthLabel(loan.startDate) : '—'}</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Principal</div>
                      <div className="font-bold text-blue-700">{fmt(loan.principalAmount)}</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">EMI/mo</div>
                      <div className="font-bold text-orange-700">{fmt(loan.emi)}</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-500">Balance</div>
                      <div className="font-bold text-red-700">{fmt(loan.balance)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{paidPct}% paid</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${paidPct}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1 flex-wrap">
                    <button onClick={() => openView(loan)} className="text-sm text-blue-600 hover:underline">📋 History</button>
                    <button onClick={() => openEdit(loan)} className="text-sm text-orange-600 hover:underline">✏️ Edit</button>
                    {loan.status === 'active' && (
                      <>
                        <button onClick={() => openPayment(loan)} className="text-sm text-green-600 hover:underline">💳 Record EMI</button>
                        <button onClick={() => handleClose(loan)} className="text-sm text-red-500 hover:underline">Close</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead><tr className="border-b">
                {['Employee', 'Principal', 'EMI/Month', 'Outstanding', 'Months', 'Start Month', 'Purpose', 'Status', ''].map(h => (
                  <th key={h} className="th">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(loan => {
                  const paidPct = loan.principalAmount > 0
                    ? Math.round(((loan.principalAmount - loan.balance) / loan.principalAmount) * 100)
                    : 100;
                  const totalMonths = loan.emi > 0 ? Math.ceil(loan.principalAmount / loan.emi) : '?';
                  const paidMonths  = loan.paidInstallments || 0;
                  return (
                    <tr key={loan.id} className="border-b hover:bg-orange-50">
                      <td className="td font-medium">
                        {empMap[loan.empId] || <span className="text-red-500 text-xs">⚠ Employee not found</span>}
                      </td>
                      <td className="td">{fmt(loan.principalAmount)}</td>
                      <td className="td text-orange-700 font-semibold">{fmt(loan.emi)}</td>
                      <td className="td">
                        <div className="font-bold text-red-700">{fmt(loan.balance)}</div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div className="bg-green-500 h-1 rounded-full" style={{ width: `${paidPct}%` }} />
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{paidPct}% paid</div>
                      </td>
                      <td className="td text-center">
                        <span className="text-xs font-mono">
                          {paidMonths}/{totalMonths}
                        </span>
                      </td>
                      <td className="td text-gray-500">{loan.startDate ? monthLabel(loan.startDate) : '—'}</td>
                      <td className="td text-gray-500 max-w-[100px] truncate">{loan.purpose || '—'}</td>
                      <td className="td">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          loan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>{loan.status}</span>
                      </td>
                      <td className="td">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => openView(loan)} className="text-xs text-blue-600 hover:underline">History</button>
                          <button onClick={() => openEdit(loan)} className="text-xs text-orange-600 hover:underline">Edit</button>
                          {loan.status === 'active' && (
                            <>
                              <button onClick={() => openPayment(loan)} className="text-xs text-green-600 hover:underline">Record EMI</button>
                              <button onClick={() => handleClose(loan)} className="text-xs text-red-500 hover:underline">Close</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="td text-center text-gray-400 py-10">No loans found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Add Loan Modal ── */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4 text-orange-900">🏦 New Loan</h2>
            <form onSubmit={handleAddLoan} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Employee *</label>
                <select className="input" value={form.empId} onChange={e => setForm(f => ({ ...f, empId: e.target.value }))} required>
                  <option value="">— Select Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Principal (₹) *</label>
                  <input className="input" type="number" min={1} value={form.principalAmount} onChange={e => setForm(f => ({ ...f, principalAmount: e.target.value }))} required placeholder="e.g. 10000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monthly EMI (₹) *</label>
                  <input className="input" type="number" min={1} value={form.emi} onChange={e => setForm(f => ({ ...f, emi: e.target.value }))} required placeholder="e.g. 1000" />
                </div>
              </div>
              {form.principalAmount && form.emi && (
                <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                  Repayment: <strong>{Math.ceil(form.principalAmount / form.emi)} months</strong>
                  {form.principalAmount % form.emi !== 0 && (
                    <span className="ml-1 text-orange-600">
                      (last EMI: ₹{form.principalAmount % form.emi})
                    </span>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Start Month *</label>
                <input className="input" type="month" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Purpose</label>
                <input className="input" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Medical / Personal / Emergency…" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Remarks</label>
                <input className="input" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Create Loan'}</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Loan Modal ── */}
      {modal === 'edit' && selectedLoan && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-1 text-orange-900">✏️ Edit Loan</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
              ⚠ Use this to correct wrong balances, reopen a closed loan, or reassign to the correct employee.
            </div>
            <form onSubmit={handleEditLoan} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Employee</label>
                <select className="input" value={editForm.empId}
                  onChange={e => setEditForm(f => ({ ...f, empId: e.target.value }))} required>
                  <option value="">— Select Employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {!empMap[editForm.empId] && editForm.empId && (
                  <p className="text-xs text-red-500 mt-0.5">⚠ Current employee not found — please reassign above</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Correct Balance (₹)</label>
                  <input className="input" type="number" min={0} value={editForm.balance}
                    onChange={e => setEditForm(f => ({ ...f, balance: e.target.value }))} required />
                  <p className="text-xs text-gray-400 mt-0.5">
                    Set to 0 → auto-closes loan
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Monthly EMI (₹)</label>
                  <input className="input" type="number" min={1} value={editForm.emi}
                    onChange={e => setEditForm(f => ({ ...f, emi: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Principal (₹)</label>
                  <input className="input" type="number" min={1} value={editForm.principalAmount}
                    onChange={e => setEditForm(f => ({ ...f, principalAmount: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                  <select className="input" value={editForm.balance <= 0 ? 'closed' : editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    disabled={Number(editForm.balance) <= 0}>
                    <option value="active">active</option>
                    <option value="closed">closed</option>
                  </select>
                </div>
              </div>
              {editForm.emi && editForm.balance && Number(editForm.balance) > 0 && (
                <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                  Remaining: <strong>{Math.ceil(Number(editForm.balance) / Number(editForm.emi))} more months</strong> to close
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Purpose</label>
                <input className="input" value={editForm.purpose}
                  onChange={e => setEditForm(f => ({ ...f, purpose: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment History Modal ── */}
      {modal === 'view' && selectedLoan && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-1 text-orange-900">📜 Loan History</h2>
            <div className="text-sm text-gray-500 mb-1">
              {empMap[selectedLoan.empId]} · Principal: {fmt(selectedLoan.principalAmount)}
            </div>
            <div className="text-sm mb-4">
              Balance: <strong className="text-red-600">{fmt(selectedLoan.balance)}</strong>
              {selectedLoan.emi > 0 && (
                <span className="text-xs text-gray-400 ml-2">
                  ({Math.ceil(selectedLoan.principalAmount / selectedLoan.emi)}-month loan @ {fmt(selectedLoan.emi)}/mo)
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {payments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No EMI payments recorded yet.</p>
              ) : (
                payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <span className="font-medium">{monthLabel(p.month)}</span>
                    <span className="text-green-700 font-bold">−{fmt(p.amount)}</span>
                    <span className="text-gray-500 text-xs">Bal: {fmt(p.balance)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              {selectedLoan.status === 'active' && (
                <button onClick={() => { openPayment(selectedLoan); setModal(null); }} className="btn-green flex-1">
                  💳 Record EMI
                </button>
              )}
              <button onClick={() => { openEdit(selectedLoan); }} className="btn-secondary flex-1">
                ✏️ Edit Loan
              </button>
              <button className="btn-secondary flex-1" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Payment Modal ── */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm max-h-[80vh] overflow-y-auto p-5 sm:p-6">
            <h2 className="text-lg font-bold mb-4 text-orange-900">💳 Record EMI Payment</h2>
            <div className="bg-orange-50 rounded-lg p-3 mb-4 text-sm">
              <div className="font-medium">{empMap[payModal.empId]}</div>
              <div className="text-gray-500 text-xs mt-0.5">
                Outstanding: <strong className="text-red-600">{fmt(payModal.balance)}</strong> · EMI: {fmt(payModal.emi)}
              </div>
            </div>
            <form onSubmit={handlePayment} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Month *</label>
                <input className="input" type="month" value={payForm.month} onChange={e => setPayForm(f => ({ ...f, month: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Amount Deducted (₹) *</label>
                <input className="input" type="number" min={1} max={payModal.balance} value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required />
                <p className="text-xs text-gray-400 mt-0.5">
                  New balance: <strong>{fmt(Math.max(0, payModal.balance - Number(payForm.amount || 0)))}</strong>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving…' : 'Record Payment'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setPayModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
