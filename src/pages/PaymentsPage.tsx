import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { BlockedDeleteDialog, ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDate } from '../data/mockData';
import type { Payment } from '../types';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'Paid', label: 'Paid' },
  { key: 'Partial', label: 'Partial' },
  { key: 'Pending', label: 'Unpaid' },
];

function badgeClass(status: string) {
  switch (status) {
    case 'Paid':    return 'bg-green-50 text-green-700 border-green-200';
    case 'Partial': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Pending': return 'bg-red-50 text-red-700 border-red-200';
    default:        return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function PaymentsPage() {
  const navigate   = useNavigate();
  const payments   = useAppStore((s) => s.payments);
  const vendors    = useAppStore((s) => s.vendors);
  const jobWorks   = useAppStore((s) => s.jobWorks);
  const addPayment = useAppStore((s) => s.addPayment);
  const deletePayment = useAppStore((s) => s.deletePayment);

  const [selectedStatus, setSelectedStatus] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<(Payment & { derivedStatus: string; totalPaid: number; totalBill: number }) | null>(null);

  // Modal state
  const [modalJobId, setModalJobId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payType, setPayType] = useState<'Advance' | 'Running' | 'Final' | 'Balance'>('Running');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRemarks, setPayRemarks] = useState('');

  // Per-job cumulative payment summary
  const jobSummaries = useMemo(() => {
    const map = new Map<string, { totalBill: number; totalPaid: number }>();
    jobWorks.forEach((j) => {
      const bill = j.items.reduce((s, i) => s + i.sentQuantity * (i.rate ?? 0), 0);
      map.set(j.id, { totalBill: bill, totalPaid: 0 });
    });
    payments.forEach((p) => {
      const entry = map.get(p.jobWorkId);
      if (entry) entry.totalPaid += p.paid;
    });
    return map;
  }, [jobWorks, payments]);

  // Job works with a bill but ZERO payment entries (never paid at all)
  const unpaidJobs = useMemo(() => {
    const jobsWithPayments = new Set(payments.map((p) => p.jobWorkId));
    return jobWorks.filter((j) => {
      if (jobsWithPayments.has(j.id)) return false;
      return j.items.some((i) => i.sentQuantity > 0 && (i.rate ?? 0) > 0);
    });
  }, [jobWorks, payments]);

  // Enrich each payment row with cumulative derived status
  const enrichedPayments = useMemo(() => {
    return payments.map((p) => {
      const summary = jobSummaries.get(p.jobWorkId);
      const totalBill = summary?.totalBill ?? p.amount;
      const totalPaid = summary?.totalPaid ?? p.paid;
      const derivedStatus: 'Paid' | 'Partial' | 'Pending' =
        totalPaid >= totalBill && totalBill > 0 ? 'Paid'
        : totalPaid > 0 ? 'Partial'
        : 'Pending';
      return { ...p, derivedStatus, totalBill, totalPaid };
    });
  }, [payments, jobSummaries]);

  const filteredPayments = useMemo(() => {
    return enrichedPayments.filter(
      (p) => selectedStatus === 'all' || p.derivedStatus === selectedStatus,
    );
  }, [enrichedPayments, selectedStatus]);

  const totals = useMemo(() => {
    let billed = 0; let paid = 0;
    jobSummaries.forEach((s) => { billed += s.totalBill; paid += s.totalPaid; });
    return { billed, paid, outstanding: Math.max(0, billed - paid) };
  }, [jobSummaries]);

  // Tab counts — "Pending" includes both Pending entries AND never-paid jobs
  const tabCount = (key: string) => {
    if (key === 'all') return enrichedPayments.length + unpaidJobs.length;
    if (key === 'Pending') return enrichedPayments.filter((p) => p.derivedStatus === 'Pending').length + unpaidJobs.length;
    return enrichedPayments.filter((p) => p.derivedStatus === key).length;
  };

  const showUnpaidSection = selectedStatus === 'all' || selectedStatus === 'Pending';

  // Modal
  const modalJob = modalJobId ? jobWorks.find((j) => j.id === modalJobId) : null;
  const modalSummary = modalJobId ? jobSummaries.get(modalJobId) : null;
  const modalRemaining = modalSummary ? Math.max(0, modalSummary.totalBill - modalSummary.totalPaid) : 0;
  const payAmtNum = Number(payAmt) || 0;
  const afterPay = Math.max(0, modalRemaining - payAmtNum);
  const newStatus: 'Paid' | 'Partial' | 'Pending' =
    modalSummary && (modalSummary.totalPaid + payAmtNum) >= modalSummary.totalBill && modalSummary.totalBill > 0
      ? 'Paid' : payAmtNum > 0 ? 'Partial' : 'Pending';

  const openModal = (jobId: string) => {
    const summary = jobSummaries.get(jobId);
    if (summary && summary.totalPaid >= summary.totalBill && summary.totalBill > 0) return;
    setModalJobId(jobId);
    setPayAmt('');
    setPayType('Running');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayRemarks('');
  };

  const closeModal = () => setModalJobId(null);

  // N → open payment modal for the first unpaid job (no-op if modal already open)
  useNewItemShortcut(() => {
    if (modalJobId) return;
    const first = unpaidJobs[0];
    if (first) openModal(first.id);
  });

  const handleRecordPayment = () => {
    if (!modalJob || !payAmtNum) return;
    const qty = modalJob.items.reduce((s, i) => s + i.sentQuantity, 0);
    const bill = modalSummary?.totalBill ?? 0;
    const avgRate = qty > 0 ? bill / qty : 0;
    addPayment({
      vendorId: modalJob.vendorId,
      jobWorkId: modalJob.id,
      process: modalJob.process,
      quantity: qty,
      rate: avgRate,
      amount: bill,
      paid: payAmtNum,
      status: newStatus,
      paymentType: payType,
      date: payDate,
      remarks: payRemarks,
    });
    closeModal();
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`Billed ${formatCurrency(totals.billed)} · Paid ${formatCurrency(totals.paid)} · Outstanding ${formatCurrency(totals.outstanding)}`}
      />

      {/* Status filter tabs */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.key;
            const count = tabCount(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition flex items-center gap-1.5
                  ${isActive ? 'border-brand bg-brand text-white' : 'border-border bg-white text-charcoal hover:bg-surface'}`}
              >
                {tab.label}
                <span className={`text-xs rounded-full px-1.5 ${isActive ? 'bg-white/20' : 'bg-surface'}`}>{count}</span>
              </button>
            );
          })}
          <span className="ml-auto text-sm text-muted">{filteredPayments.length} entries</span>
        </div>
      </Card>

      {/* ── Unpaid Jobs section ── */}
      {showUnpaidSection && unpaidJobs.length > 0 && (
        <Card className="mb-6">
          <div className="px-4 py-3 border-b border-border bg-red-50/60 flex items-center gap-2">
            <span className="text-sm font-semibold text-red-700">Unpaid Jobs</span>
            <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5 font-semibold">
              {unpaidJobs.length}
            </span>
            <span className="text-xs text-muted ml-1">— billed but no payment recorded yet</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['Job Number', 'Vendor', 'Process', 'Issue Date', 'Bill Amount', 'Status', 'Action'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unpaidJobs.map((job) => {
                  const vendor = vendors.find((v) => v.id === job.vendorId);
                  const billAmount = job.items.reduce((s, i) => s + i.sentQuantity * (i.rate ?? 0), 0);
                  return (
                    <tr key={job.id} className="border-b border-border hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/job-works/${job.id}`, { state: { from: '/payments' } })}
                          className="font-semibold text-brand hover:underline"
                        >
                          {job.jobNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3">{vendor?.name ?? '—'}</td>
                      <td className="px-4 py-3">{job.process}</td>
                      <td className="px-4 py-3">{formatDate(job.issueDate)}</td>
                      <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(billAmount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-red-700 border-red-200">
                          Unpaid
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openModal(job.id)}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Record Payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Payments table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Job Number', 'Vendor', 'Process', 'Type', 'Date', 'Paid (entry)', 'Total Paid', 'Total Bill', 'Balance', 'Status', 'Action'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => {
                const vendor = vendors.find((v) => v.id === payment.vendorId);
                const job    = jobWorks.find((j) => j.id === payment.jobWorkId);
                const balance = Math.max(0, payment.totalBill - payment.totalPaid);
                return (
                  <tr key={payment.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <button
                          type="button"
                          onClick={() => navigate(`/job-works/${payment.jobWorkId}`, { state: { from: '/payments' } })}
                          className="font-semibold text-brand hover:underline"
                        >
                          {job?.jobNumber ?? 'N/A'}
                        </button>
                    </td>
                    <td className="px-4 py-3">{vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3">{payment.process}</td>
                    <td className="px-4 py-3">{payment.paymentType}</td>
                    <td className="px-4 py-3">{formatDate(payment.date)}</td>
                    <td className="px-4 py-3 font-semibold text-brand">{formatCurrency(payment.paid)}</td>
                    <td className="px-4 py-3 font-semibold text-success">{formatCurrency(payment.totalPaid)}</td>
                    <td className="px-4 py-3">{formatCurrency(payment.totalBill)}</td>
                    <td className="px-4 py-3 font-semibold text-danger">{formatCurrency(balance)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass(payment.derivedStatus)}`}>
                        {payment.derivedStatus === 'Pending' ? 'Unpaid' : payment.derivedStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {payment.derivedStatus !== 'Paid' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openModal(payment.jobWorkId)}
                            className="text-xs font-medium text-brand hover:underline"
                          >
                            Record Payment
                          </button>
                          <button
                            type="button"
                            title="Delete this payment entry"
                            onClick={() => setDeleteTarget(payment)}
                            className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-success font-medium">✓ Settled</span>
                          {/* Trash icon opens blocked dialog — fully paid entries cannot be deleted */}
                          <button
                            type="button"
                            title="Cannot delete — job is fully paid"
                            onClick={() => setDeleteTarget(payment)}
                            className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredPayments.length === 0 && !showUnpaidSection && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">
                    No {selectedStatus === 'all' ? '' : selectedStatus.toLowerCase() + ' '}payments found.
                  </td>
                </tr>
              )}
              {filteredPayments.length === 0 && showUnpaidSection && unpaidJobs.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">
                    No unpaid payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Record Payment Modal ── */}
      {modalJobId && modalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-charcoal">Record Payment</h2>
                <p className="text-xs text-muted">{modalJob.jobNumber} · {vendors.find((v) => v.id === modalJob.vendorId)?.name}</p>
              </div>
              <button onClick={closeModal} className="text-muted hover:text-charcoal">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-surface border border-border p-3 mb-4 grid grid-cols-3 gap-3 text-sm text-center">
              <div>
                <p className="text-xs text-muted mb-0.5">Total Bill</p>
                <p className="font-bold">{formatCurrency(modalSummary?.totalBill ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Already Paid</p>
                <p className="font-bold text-success">{formatCurrency(modalSummary?.totalPaid ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Due</p>
                <p className="font-bold text-danger">{formatCurrency(modalRemaining)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Select
                label="Payment Type"
                value={payType}
                options={[
                  { value: 'Advance', label: 'Advance' },
                  { value: 'Running', label: 'Running' },
                  { value: 'Final', label: 'Final' },
                  { value: 'Balance', label: 'Balance' },
                ]}
                onChange={(e) => setPayType(e.target.value as typeof payType)}
              />
              <Input
                label="Amount to Pay (₹)"
                type="number"
                min="0"
                max={modalRemaining}
                step="0.01"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                placeholder={`Max: ${formatCurrency(modalRemaining)}`}
              />
              <Input
                label="Payment Date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
              <Input
                label="Remarks"
                value={payRemarks}
                onChange={(e) => setPayRemarks(e.target.value)}
                placeholder="Optional notes"
              />
              {payAmtNum > 0 && (
                <div className="rounded-lg bg-surface border border-border px-4 py-3 text-sm flex justify-between items-center">
                  <span className="text-muted">After this payment:</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${afterPay > 0 ? 'text-danger' : 'text-success'}`}>
                      {afterPay > 0 ? `${formatCurrency(afterPay)} due` : '✓ Fully Paid'}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeClass(newStatus)}`}>
                      {newStatus === 'Pending' ? 'Unpaid' : newStatus}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={closeModal}>Cancel</Button>
              <Button className="flex-1" disabled={!payAmtNum || payAmtNum > modalRemaining} onClick={handleRecordPayment}>
                Save Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete payment dialogs ── */}
      {/* Blocked: job is fully paid — deleting would revert settled status */}
      <BlockedDeleteDialog
        open={deleteTarget !== null && deleteTarget.derivedStatus === 'Paid'}
        onClose={() => setDeleteTarget(null)}
        title="Cannot Delete Payment Entry"
        entityName={`${deleteTarget?.paymentType ?? ''} payment of ${deleteTarget ? formatCurrency(deleteTarget.paid) : ''}`}
        reasons={[
          `This job (${jobWorks.find((j) => j.id === deleteTarget?.jobWorkId)?.jobNumber ?? ''}) is fully settled — total paid ${formatCurrency(deleteTarget?.totalPaid ?? 0)} covers the full bill of ${formatCurrency(deleteTarget?.totalBill ?? 0)}.`,
          'Deleting this entry would revert the job to a partial/unpaid state.',
          'To correct a payment, add a new entry with the adjusted amount instead.',
        ]}
      />

      {/* Allowed: job is not fully paid — safe to delete this entry */}
      <ConfirmDialog
        open={deleteTarget !== null && deleteTarget.derivedStatus !== 'Paid'}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deletePayment(deleteTarget.id); }}
        title="Delete Payment Entry"
        message={`Delete this ${deleteTarget?.paymentType ?? ''} payment of ${deleteTarget ? formatCurrency(deleteTarget.paid) : ''}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
