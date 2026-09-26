import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Printer, Trash2, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDate } from '../data/mockData';
import type { Payment, PaymentMethod } from '../types';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';
import { sortByDateDesc } from '../lib/sorting';
import { useListPointerNavigation } from '../hooks/useListPointerNavigation';
import { printPaymentReceipt } from '../components/ui/PaymentReceipt';
import { jobOwedAmount, monthKey, monthLabel } from '../lib/vendorAccounting';

const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Other'];

interface VendorRow {
  vendorId: string;
  vendorName: string;
  owed: number;
  paid: number;
  balance: number;
  jobCount: number;
}

export function PaymentsPage() {
  const payments = useAppStore((s) => s.payments);
  const vendors = useAppStore((s) => s.vendors);
  const jobWorks = useAppStore((s) => s.jobWorks);
  const settings = useAppStore((s) => s.settings);
  const payVendor = useAppStore((s) => s.payVendor);
  const deletePayment = useAppStore((s) => s.deletePayment);

  // ── Month filter ────────────────────────────────────────────────────────
  // Build the list of months that have any received work or any payment.
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    jobWorks.forEach((j) => {
      // Use issueDate as the month a job belongs to for settlement grouping
      if (jobOwedAmount(j) > 0) set.add(monthKey(j.issueDate));
    });
    payments.forEach((p) => set.add(monthKey(p.date)));
    return Array.from(set).filter(Boolean).sort().reverse();
  }, [jobWorks, payments]);

  const [selectedMonth, setSelectedMonth] = useState<string>(''); // '' = all time
  const [showPaid, setShowPaid] = useState(false);

  // ── Per-vendor outstanding for the selected scope ─────────────────────────
  const vendorRows = useMemo<VendorRow[]>(() => {
    const inScope = (iso: string) => selectedMonth === '' || monthKey(iso) === selectedMonth;

    const map = new Map<string, VendorRow>();
    const ensure = (vendorId: string): VendorRow => {
      let row = map.get(vendorId);
      if (!row) {
        row = {
          vendorId,
          vendorName: vendors.find((v) => v.id === vendorId)?.name ?? 'Unknown vendor',
          owed: 0,
          paid: 0,
          balance: 0,
          jobCount: 0,
        };
        map.set(vendorId, row);
      }
      return row;
    };

    jobWorks.forEach((j) => {
      const owed = jobOwedAmount(j);
      if (owed <= 0) return;
      if (!inScope(j.issueDate)) return;
      const row = ensure(j.vendorId);
      row.owed += owed;
      row.jobCount += 1;
    });

    payments.forEach((p) => {
      if (!inScope(p.date)) return;
      const row = ensure(p.vendorId);
      row.paid += p.paid;
    });

    map.forEach((row) => {
      row.balance = Math.max(0, row.owed - row.paid);
    });

    return Array.from(map.values())
      // Only vendors that actually have owed work or recorded payments in scope
      .filter((r) => r.owed > 0 || r.paid > 0)
      .sort((a, b) => b.balance - a.balance || a.vendorName.localeCompare(b.vendorName));
  }, [jobWorks, payments, vendors, selectedMonth]);

  const visibleVendorRows = useMemo(
    () => vendorRows.filter((r) => showPaid || r.balance > 0),
    [vendorRows, showPaid],
  );

  const totals = useMemo(() => {
    let owed = 0, paid = 0;
    vendorRows.forEach((r) => { owed += r.owed; paid += r.paid; });
    return { owed, paid, outstanding: Math.max(0, owed - paid) };
  }, [vendorRows]);

  const activeRowIndex = useListPointerNavigation({
    itemCount: visibleVendorRows.length,
    rowSelector: '[data-vendor-row="true"]',
  });

  // ── Pay dialog state ──────────────────────────────────────────────────────
  const [payVendorId, setPayVendorId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payRemarks, setPayRemarks] = useState('');

  const payRow = payVendorId ? vendorRows.find((r) => r.vendorId === payVendorId) : null;
  const payAmtNum = Number(payAmt) || 0;
  const afterPay = payRow ? Math.max(0, payRow.balance - payAmtNum) : 0;

  const openPay = (vendorId: string) => {
    const row = vendorRows.find((r) => r.vendorId === vendorId);
    if (!row || row.balance <= 0) return;
    setPayVendorId(vendorId);
    setPayAmt(String(row.balance)); // default to full balance; editable for partial
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayMethod('Bank Transfer');
    setPayReference('');
    setPayRemarks('');
  };

  const closePay = () => setPayVendorId(null);

  // N → open pay dialog for the vendor with the largest balance
  useNewItemShortcut(() => {
    if (payVendorId) return;
    const first = visibleVendorRows.find((r) => r.balance > 0);
    if (first) openPay(first.vendorId);
  });

  const handlePay = () => {
    if (!payRow || payAmtNum <= 0) return;

    const created = payVendor({
      vendorId: payRow.vendorId,
      amount: payAmtNum,
      date: payDate,
      method: payMethod,
      reference: payReference || undefined,
      period: selectedMonth || monthKey(payDate),
      remarks: payRemarks || undefined,
    });

    if (created) {
      // Print the receipt right away (Miracle-style: pay → receipt)
      printReceiptFor(created, payRow);
    }
    closePay();
  };

  // ── Receipt history & printing ────────────────────────────────────────────
  const vendorPayments = useMemo(
    () => sortByDateDesc(
      payments.filter((p) => p.receiptNumber), // only vendor-level receipts
      (p) => p.date,
    ),
    [payments],
  );

  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  const printReceiptFor = (payment: Payment, row?: VendorRow | null) => {
    const vendor = vendors.find((v) => v.id === payment.vendorId) ?? null;
    // Recompute owed/previously-paid context for an accurate reprint
    const owed = jobWorks
      .filter((j) => j.vendorId === payment.vendorId)
      .reduce((s, j) => s + jobOwedAmount(j), 0);
    const paidIncluding = payments
      .filter((p) => p.vendorId === payment.vendorId && p.date <= payment.date)
      .reduce((s, p) => s + p.paid, 0);
    const previouslyPaid = Math.max(0, paidIncluding - payment.paid);
    const balance = row ? Math.max(0, row.balance - payment.paid) : Math.max(0, owed - paidIncluding);

    printPaymentReceipt({
      receiptNumber: payment.receiptNumber ?? '—',
      date: payment.date,
      period: payment.period,
      vendor: vendor
        ? { name: vendor.name, contactPerson: vendor.contactPerson, mobile: vendor.mobile, gstNumber: vendor.gstNumber }
        : null,
      owed,
      previouslyPaid,
      amountPaid: payment.paid,
      balance,
      method: payment.method,
      reference: payment.reference,
      remarks: payment.remarks,
      settings,
    });
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`Owed ${formatCurrency(totals.owed)} · Paid ${formatCurrency(totals.paid)} · Outstanding ${formatCurrency(totals.outstanding)}`}
      />

      {/* ── Filter bar ── */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted" htmlFor="month-filter">Month</label>
          <select
            id="month-filter"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            <option value="">All time</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
              className="rounded border-border text-brand focus:ring-brand"
            />
            Show fully-settled vendors
          </label>

          <span className="ml-auto text-sm text-muted">{visibleVendorRows.length} vendors</span>
        </div>
      </Card>

      {/* ── Vendor outstanding table ── */}
      <Card className="mb-6">
        <div className="px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold text-charcoal">Amount Payable by Vendor</span>
          <span className="text-xs text-muted ml-2">— based on received quantity × rate</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Vendor', 'Jobs', 'Owed', 'Paid', 'Balance', 'Status', 'Action'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleVendorRows.map((row, idx) => {
                const settled = row.balance <= 0;
                return (
                  <tr
                    key={row.vendorId}
                    data-vendor-row="true"
                    tabIndex={activeRowIndex === idx ? 0 : -1}
                    className={`border-b border-border hover:bg-surface/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/50 ${activeRowIndex === idx ? 'ring-2 ring-inset ring-brand/50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-charcoal">
                      <Link to={`/vendors/${row.vendorId}/statement`} className="text-brand hover:underline inline-flex items-center gap-1.5">
                        <FileText size={13} className="shrink-0 text-muted" />
                        {row.vendorName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.jobCount}</td>
                    <td className="px-4 py-3">{formatCurrency(row.owed)}</td>
                    <td className="px-4 py-3 text-success font-medium">{formatCurrency(row.paid)}</td>
                    <td className={`px-4 py-3 font-semibold ${settled ? 'text-success' : 'text-danger'}`}>
                      {settled ? '—' : formatCurrency(row.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        settled
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : row.paid > 0
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {settled ? 'Settled' : row.paid > 0 ? 'Partial' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {settled ? (
                        <span className="text-xs text-success font-medium">✓ Paid</span>
                      ) : (
                        <button
                          onClick={() => openPay(row.vendorId)}
                          className="text-xs font-medium text-brand hover:underline"
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleVendorRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    {showPaid ? 'No vendors with work in this period.' : 'Nothing outstanding — all vendors are settled.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Payment receipt history ── */}
      <Card>
        <div className="px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold text-charcoal">Payment Receipts</span>
          <span className="text-xs text-muted ml-2">{vendorPayments.length} receipts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Receipt No.', 'Date', 'Vendor', 'Method', 'Reference', 'Amount', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendorPayments.map((p) => {
                const vendor = vendors.find((v) => v.id === p.vendorId);
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3 font-semibold text-brand">{p.receiptNumber}</td>
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">{vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3">{p.method ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{p.reference || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(p.paid)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Print / reprint receipt"
                          onClick={() => printReceiptFor(p)}
                          className="p-1 rounded text-muted hover:text-brand hover:bg-brand/5 transition-colors"
                          aria-label={`Print receipt ${p.receiptNumber}`}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete this receipt"
                          onClick={() => setDeleteTarget(p)}
                          className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label={`Delete receipt ${p.receiptNumber}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {vendorPayments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    No payment receipts yet. Pay a vendor to generate one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Pay dialog ── */}
      {payVendorId && payRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-charcoal">Pay Vendor</h2>
                <p className="text-xs text-muted">{payRow.vendorName}{selectedMonth ? ` · ${monthLabel(selectedMonth)}` : ''}</p>
              </div>
              <button onClick={closePay} className="text-muted hover:text-charcoal" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg bg-surface border border-border p-3 mb-4 grid grid-cols-3 gap-3 text-sm text-center">
              <div>
                <p className="text-xs text-muted mb-0.5">Owed</p>
                <p className="font-bold">{formatCurrency(payRow.owed)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Already Paid</p>
                <p className="font-bold text-success">{formatCurrency(payRow.paid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Balance</p>
                <p className="font-bold text-danger">{formatCurrency(payRow.balance)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                label="Amount to Pay (₹)"
                type="number"
                min="0"
                max={payRow.balance}
                step="0.01"
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                placeholder={`Max: ${formatCurrency(payRow.balance)}`}
              />
              <Select
                label="Payment Method"
                value={payMethod}
                options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              />
              <Input
                label="Reference (Cheque no. / UTR)"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="Optional"
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
                  <span className={`font-bold ${afterPay > 0 ? 'text-danger' : 'text-success'}`}>
                    {afterPay > 0 ? `${formatCurrency(afterPay)} due` : '✓ Fully Settled'}
                  </span>
                </div>
              )}
              {payAmtNum > payRow.balance && (
                <p className="text-xs text-danger">Amount exceeds the outstanding balance.</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={closePay}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={payAmtNum <= 0 || payAmtNum > payRow.balance}
                onClick={handlePay}
              >
                Pay &amp; Print Receipt
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete receipt confirmation ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deletePayment(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete Payment Receipt"
        message={
          deleteTarget
            ? `Delete receipt ${deleteTarget.receiptNumber} of ${formatCurrency(deleteTarget.paid)} for ${vendors.find((v) => v.id === deleteTarget.vendorId)?.name ?? 'this vendor'}? This will increase the vendor's outstanding balance again.`
            : ''
        }
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
