import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Breadcrumb, Card, KPICard, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Select, Textarea } from '../components/ui/Input';
import { ConfirmDialog, BlockedDeleteDialog } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  formatCurrency,
  formatDate,
  formatQty,
  getJobPendingTotal,
  getJobReceivedTotal,
  getJobSentTotal,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';

const TIMELINE_STEPS = ['Job Created', 'Material Dispatched', 'Vendor Processing', 'Partial Receipt', 'QC', 'Completed'];

const TABS = ['Overview', 'Items', 'Lifecycle', 'Payments', 'Activity'];

export function JobWorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { from?: string } | null)?.from ?? '/job-works';
  const jobWorks = useAppStore((s) => s.jobWorks);
  const dispatches = useAppStore((s) => s.dispatches);
  const receipts = useAppStore((s) => s.receipts);
  const activityLogs = useAppStore((s) => s.activityLogs);
  const payments = useAppStore((s) => s.payments);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const addPayment = useAppStore((s) => s.addPayment);
  const deleteJobWork = useAppStore((s) => s.deleteJobWork);
  const checkConstraints = useAppStore((s) => s.checkJobWorkDeleteConstraints);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBlockReasons, setDeleteBlockReasons] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    paymentType: 'Advance' as 'Advance' | 'Running' | 'Final' | 'Balance',
    paid: '',
    date: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const job = jobWorks.find((j) => j.id === id);
  if (!job) return <div className="text-center py-16 text-muted">Job work not found</div>;

  const vendor = vendors.find((v) => v.id === job.vendorId);
  const jobDispatches = dispatches.filter((d) => d.jobWorkId === job.id);
  const jobReceipts = receipts.filter((r) => r.jobWorkId === job.id);
  const jobActivities = activityLogs.filter((a) => a.entityId === job.id);
  const jobPayments = payments.filter((p) => p.jobWorkId === job.id);

  const timelineIndex = job.status === 'Completed' ? 5 : job.status === 'Partial' ? 3 : job.status === 'Processing' ? 2 : job.status === 'Sent' ? 1 : 0;

  const jobTotalQty = job.items.reduce((s, i) => s + i.sentQuantity, 0);
  const jobTotalAmount = job.items.reduce((s, i) => s + i.sentQuantity * (i.rate ?? 0), 0);
  const jobAvgRate = jobTotalQty > 0 ? jobTotalAmount / jobTotalQty : 0;

  // Total already paid across all previous payment entries for this job
  const alreadyPaid = jobPayments.reduce((s, p) => s + p.paid, 0);
  const remainingAfterPrevious = Math.max(0, jobTotalAmount - alreadyPaid);

  const paidAmount = Number(paymentForm.paid) || 0;

  // Status for THIS new entry: compare cumulative paid vs total bill
  const cumulativePaid = alreadyPaid + paidAmount;
  const derivedStatus: 'Paid' | 'Partial' | 'Pending' =
    cumulativePaid >= jobTotalAmount && jobTotalAmount > 0
      ? 'Paid'
      : cumulativePaid > 0
      ? 'Partial'
      : 'Pending';

  const handleAddPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paidAmount || !job) return;

    addPayment({
      vendorId: job.vendorId,
      jobWorkId: job.id,
      process: job.process,
      quantity: jobTotalQty,
      rate: jobAvgRate,
      amount: jobTotalAmount,  // full bill amount for reference
      paid: paidAmount,        // this installment only
      status: derivedStatus,
      paymentType: paymentForm.paymentType,
      date: paymentForm.date,
      remarks: paymentForm.remarks,
    });

    setPaymentForm({
      paymentType: 'Running',
      paid: '',
      date: new Date().toISOString().slice(0, 10),
      remarks: '',
    });
  };

  const canEdit = job.status === 'Draft' || job.status === 'Sent';

  return (
    <div>
      <div className="space-y-3 mb-6">
        <BackButton to={backTo} />
        <Breadcrumb items={[{ label: 'Job Work', path: '/job-works' }, { label: job.jobNumber }]} />
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-charcoal">{job.jobNumber}</h1>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
            <span>Vendor: <strong className="text-charcoal">{vendor?.name}</strong></span>
            <span>Process: <strong className="text-charcoal">{job.process}</strong></span>
            <span>Issue: <strong className="text-charcoal">{formatDate(job.issueDate)}</strong></span>
            <span>Expected: <strong className="text-charcoal">{formatDate(job.expectedReturnDate)}</strong></span>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => navigate(`/job-works/${job.id}/edit`)}
            >
              <Pencil size={14} /> Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const reasons = checkConstraints(job.id);
                setDeleteBlockReasons(reasons);
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Sent" value={formatQty(getJobSentTotal(job), 'Pic')} color="info" />
        <KPICard label="Received" value={formatQty(getJobReceivedTotal(job), 'Pic')} color="success" />
        <KPICard label="Pending" value={formatQty(getJobPendingTotal(job), 'Pic')} color="warning" />
      </div>

      <Card className="mb-6 p-6">
        <h3 className="text-sm font-semibold mb-4">Progress Timeline</h3>
        <div className="flex items-center gap-2 overflow-x-auto">
          {TIMELINE_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2 shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                i <= timelineIndex ? 'bg-brand text-white' : 'bg-surface text-muted border border-border'
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs ${i <= timelineIndex ? 'text-charcoal font-medium' : 'text-muted'}`}>{step}</span>
              {i < TIMELINE_STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < timelineIndex ? 'bg-brand' : 'bg-border'}`} />}
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <Card className="p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Priority:</span> <strong>{job.priority}</strong></div>
            <div><span className="text-muted">Reference:</span> <strong>{job.reference ?? '—'}</strong></div>
            <div><span className="text-muted">Created By:</span> <strong>{job.createdBy}</strong></div>
            <div><span className="text-muted">Remarks:</span> <strong>{job.remarks ?? '—'}</strong></div>
          </div>
        </Card>
      )}

      {activeTab === 'Items' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['Product', 'Variant', 'Sent', 'Received', 'Pending'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.items.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  const variant = product?.variants.find((v) => v.id === item.variantId);
                  const pending = Math.max(0, item.sentQuantity - item.receivedQuantity - item.rejectedQuantity - item.lossQuantity);
                  return (
                    <tr key={item.id} className="border-b border-border">
                      <td className="px-4 py-3">{product?.name}</td>
                      <td className="px-4 py-3">{variant?.name}</td>
                      <td className="px-4 py-3">{formatQty(item.sentQuantity, product?.unit ?? '')}</td>
                      <td className="px-4 py-3">{formatQty(item.receivedQuantity, product?.unit ?? '')}</td>
                      <td className="px-4 py-3 font-medium">{formatQty(pending, product?.unit ?? '')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'Lifecycle' && (
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Dispatch / Challan</p>
              {jobDispatches.length === 0 ? (
                <p className="text-sm text-muted">No dispatch entry logged for this job yet.</p>
              ) : (
                <div className="space-y-2">
                  {jobDispatches.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3">
                      <div>
                        <Link to={`/challans/${d.id}`} className="font-medium text-brand">{d.challanNumber}</Link>
                        <p className="text-xs text-muted">{formatDate(d.date)} — {d.vehicleNumber || 'Own Vehicle'}</p>
                      </div>
                      <span className="text-sm text-charcoal">{d.driver || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Receipts / QC</p>
              {jobReceipts.length === 0 ? (
                <p className="text-sm text-muted">No receipt has been recorded yet. QC will appear after material is returned.</p>
              ) : (
                <div className="space-y-2">
                  {jobReceipts.map((r) => (
                    <div key={r.id}>
                      <p className="font-medium">{formatDate(r.date)}</p>
                      <p className="text-xs text-muted">Received by {r.receivedBy} | VC: {r.vendorChallanNumber ?? '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 text-sm text-muted">
            <span className="font-medium text-charcoal">Lifecycle summary:</span> this job already advances through dispatch and receipt stages as part of one job-work cycle, so the progress is tracked in a single timeline rather than separate sections.
          </div>
        </Card>
      )}

      {activeTab === 'Activity' && (
        <Card className="p-4">
          {jobActivities.map((a) => (
            <div key={a.id} className="flex gap-3 py-3 border-b border-border last:border-0">
              <div className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />
              <div>
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted">{new Date(a.timestamp).toLocaleString('en-IN')} — {a.user}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {activeTab === 'Payments' && (<div className="space-y-4">
          {/* ── Fully paid banner OR payment form ── */}
          {remainingAfterPrevious === 0 && jobTotalAmount > 0 ? (
            <Card className="p-6">
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-2xl">✓</span>
                </div>
                <h3 className="text-base font-bold text-green-700">Payment Fully Settled</h3>
                <p className="text-sm text-muted">
                  {formatCurrency(alreadyPaid)} has been paid in full for this job.
                </p>
                <div className="mt-1 rounded-lg bg-green-50 border border-green-200 px-6 py-3 text-sm text-green-700 font-semibold">
                  {job.jobNumber} · {formatCurrency(jobTotalAmount)} · Paid
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <div className="mb-5">
                <h3 className="text-sm font-semibold">Record Payment</h3>
                <p className="text-sm text-muted mt-0.5">
                  Billed {formatCurrency(jobTotalAmount)} · Paid {formatCurrency(alreadyPaid)} · Remaining {formatCurrency(remainingAfterPrevious)}
                </p>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-5">
                {/* Auto-filled read-only job details */}
                <div className="rounded-lg bg-surface border border-border p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">Vendor</p>
                    <p className="font-semibold text-charcoal">{vendors.find((v) => v.id === job.vendorId)?.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">Process</p>
                    <p className="font-semibold text-charcoal">{job.process}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">Total Quantity</p>
                    <p className="font-semibold text-charcoal">{jobTotalQty.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">Bill Amount</p>
                    <p className="font-semibold text-charcoal">{formatCurrency(jobTotalAmount)}</p>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <Select
                    label="Payment Type"
                    value={paymentForm.paymentType}
                    options={[
                      { value: 'Advance', label: 'Advance' },
                      { value: 'Running', label: 'Running' },
                      { value: 'Final', label: 'Final' },
                      { value: 'Balance', label: 'Balance' },
                    ]}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value as typeof prev.paymentType }))}
                  />
                  <Input
                    label="Payment Date"
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, date: e.target.value }))}
                  />
                  <div>
                    <Input
                      label="Amount to Pay (₹)"
                      type="number"
                      min="0"
                      max={remainingAfterPrevious}
                      step="0.01"
                      value={paymentForm.paid}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paid: e.target.value }))}
                      placeholder={`Max ₹${remainingAfterPrevious.toLocaleString('en-IN')}`}
                      required
                    />
                  </div>
                  {/* Live status indicator */}
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">Status</p>
                    <span className={`inline-flex items-center self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      derivedStatus === 'Paid'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : derivedStatus === 'Partial'
                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {derivedStatus === 'Pending' ? 'Unpaid' : derivedStatus}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Textarea
                    label="Remarks"
                    value={paymentForm.remarks}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Payment notes, reference, etc."
                  />
                  {/* Balance preview */}
                  <div className="rounded-lg bg-surface border border-border p-4 text-sm space-y-2 self-start mt-auto">
                    <div className="flex justify-between">
                      <span className="text-muted">Total Bill</span>
                      <span className="font-semibold">{formatCurrency(jobTotalAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Already Paid</span>
                      <span className="font-semibold text-success">{formatCurrency(alreadyPaid)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted">Due Before This</span>
                      <span className="font-semibold text-danger">{formatCurrency(remainingAfterPrevious)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Paying Now</span>
                      <span className="font-semibold text-brand">{formatCurrency(paidAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted">Remaining After</span>
                      <span className={`font-bold ${Math.max(0, jobTotalAmount - cumulativePaid) > 0 ? 'text-danger' : 'text-success'}`}>
                        {formatCurrency(Math.max(0, jobTotalAmount - cumulativePaid))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={!paidAmount || paidAmount > remainingAfterPrevious}>
                    Save Payment
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Payment history for this job */}
          <Card>
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Payment History</h4>
              {jobPayments.length > 0 && (
                <div className="text-sm text-muted">
                  <span className="text-success font-semibold">{formatCurrency(alreadyPaid)}</span>
                  <span> paid of </span>
                  <span className="font-semibold">{formatCurrency(jobTotalAmount)}</span>
                  {remainingAfterPrevious > 0 && (
                    <span className="ml-2 text-danger font-semibold">· {formatCurrency(remainingAfterPrevious)} due</span>
                  )}
                </div>
              )}
            </div>
            {jobPayments.length === 0 ? (
              <p className="px-6 pb-6 text-muted text-sm">No payments recorded for this job yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      {['#', 'Type', 'Date', 'Paid (this entry)', 'Cumulative Paid', 'Remaining', 'Status', 'Remarks'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let running = 0;
                      return jobPayments.map((p, i) => {
                        running += p.paid;
                        const remaining = Math.max(0, jobTotalAmount - running);
                        // derive status from cumulative, not stored value
                        const status: 'Paid' | 'Partial' | 'Pending' =
                          running >= jobTotalAmount && jobTotalAmount > 0
                            ? 'Paid'
                            : running > 0
                            ? 'Partial'
                            : 'Pending';
                        return (
                          <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                            <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                            <td className="px-4 py-3">{p.paymentType}</td>
                            <td className="px-4 py-3">{formatDate(p.date)}</td>
                            <td className="px-4 py-3 font-semibold text-brand">{formatCurrency(p.paid)}</td>
                            <td className="px-4 py-3 font-semibold text-success">{formatCurrency(running)}</td>
                            <td className="px-4 py-3 font-semibold text-danger">{formatCurrency(remaining)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                status === 'Paid'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : status === 'Partial'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {status === 'Pending' ? 'Unpaid' : status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted">{p.remarks ?? '—'}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface border-t-2 border-border">
                      <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted uppercase">Total</td>
                      <td className="px-4 py-3 font-bold text-brand">{formatCurrency(alreadyPaid)}</td>
                      <td colSpan={2} className="px-4 py-3 font-bold text-danger">
                        {remainingAfterPrevious > 0 ? `${formatCurrency(remainingAfterPrevious)} due` : '✓ Fully Paid'}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}


      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteDialog && deleteBlockReasons.length === 0}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          deleteJobWork(job.id);
          navigate('/job-works');
        }}
        title="Delete Job Work"
        message={`Are you sure you want to delete ${job.jobNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      <BlockedDeleteDialog
        open={showDeleteDialog && deleteBlockReasons.length > 0}
        onClose={() => { setShowDeleteDialog(false); setDeleteBlockReasons([]); }}
        title="Cannot Delete Job Work"
        entityName={job.jobNumber}
        reasons={deleteBlockReasons}
      />
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// Edit Job Work Page
// ─────────────────────────────────────────────────────────────────────────────

export function EditJobWorkPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const jobWorks     = useAppStore((s) => s.jobWorks);
  const vendors      = useAppStore((s) => s.vendors);
  const products     = useAppStore((s) => s.products);
  const dispatches   = useAppStore((s) => s.dispatches);
  const receipts     = useAppStore((s) => s.receipts);
  const updateJobWork = useAppStore((s) => s.updateJobWork);

  const job = jobWorks.find((j) => j.id === id);

  // ── Local form state ──────────────────────────────────────────────────────
  const [vendorId,      setVendorId]      = useState(job?.vendorId ?? '');
  const [process,       setProcess]       = useState(job?.process ?? 'Printing');
  const [issueDate,     setIssueDate]     = useState(job?.issueDate ?? '');
  const [expectedDate,  setExpectedDate]  = useState(job?.expectedReturnDate ?? '');
  const [priority,      setPriority]      = useState<'Normal' | 'High' | 'Urgent'>(job?.priority ?? 'Normal');
  const [remarks,       setRemarks]       = useState(job?.remarks ?? '');

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!vendorId && !!expectedDate;

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) submitRef.current?.click();
        else submitRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave]);

  // ESC → back to job detail
  useEscapeBack(() => navigate(job ? `/job-works/${job.id}` : '/job-works'));

  if (!job) {
    return (
      <div className="text-center py-16 text-muted">
        Job work not found.{' '}
        <button onClick={() => navigate('/job-works')} className="text-brand hover:underline">Back to list</button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateJobWork(job.id, {
      vendorId,
      process,
      issueDate,
      expectedReturnDate: expectedDate,
      priority,
      remarks: remarks || undefined,
    });
    navigate(`/job-works/${job.id}`);
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Job Work', path: '/job-works' },
          { label: job.jobNumber, path: `/job-works/${job.id}` },
          { label: 'Edit' },
        ]}
      />
      <PageHeader
        title={`Edit — ${job.jobNumber}`}
        subtitle="Update job work header details. Line items are managed from the job detail page."
      />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Changes
        </span>
      </div>

      <div className="space-y-6">

        {/* ── Editable fields ── */}
        <form onSubmit={handleSubmit} data-form>
          <Card className="p-6 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job number — read-only */}
              <Input
                label="Job Number"
                value={job.jobNumber}
                disabled
                tabIndex={-1}
              />

              <SearchableSelect
                label="Vendor *"
                value={vendorId}
                onChange={setVendorId}
                placeholder="Search vendor…"
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                tabIndex={1}
              />

              <Select
                label="Process"
                value={process}
                tabIndex={2}
                onChange={(e) => setProcess(e.target.value)}
                options={[
                  { value: 'Printing',   label: 'Printing'   },
                  { value: 'Packaging',  label: 'Packaging'  },
                ]}
              />

              <Select
                label="Priority"
                value={priority}
                tabIndex={3}
                onChange={(e) => setPriority(e.target.value as 'Normal' | 'High' | 'Urgent')}
                options={[
                  { value: 'Normal', label: 'Normal' },
                  { value: 'High',   label: 'High'   },
                  { value: 'Urgent', label: 'Urgent' },
                ]}
              />

              <Input
                label="Issue Date"
                type="date"
                value={issueDate}
                tabIndex={4}
                onChange={(e) => setIssueDate(e.target.value)}
              />

              <Input
                label="Expected Return Date *"
                type="date"
                value={expectedDate}
                tabIndex={5}
                onChange={(e) => setExpectedDate(e.target.value)}
                required
              />

              <div className="md:col-span-2">
                <Textarea
                  label="Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                ref={submitRef}
                type="submit"
                disabled={!canSave}
              >
                Save Changes
                {canSave && (
                  <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/job-works/${job.id}`)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </form>

        {/* ── Read-only: Reference ── */}
        {job.reference && (
          <Card className="p-5 max-w-2xl">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Reference</p>
            <p className="text-base font-bold text-brand">{job.reference}</p>
          </Card>
        )}

        {/* ── Read-only: Line Items ── */}
        <Card className="max-w-2xl">
          <div className="px-5 pt-5 pb-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">
              Line Items
              <span className="ml-2 font-normal normal-case text-muted">({job.items.length} item{job.items.length !== 1 ? 's' : ''}) — view only</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['#', 'Subproduct', 'Variant', 'Sent', 'Received', 'Pending', 'Rate (₹)'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.items.map((item, idx) => {
                  const prod    = products.find((p) => p.id === item.productId);
                  const variant = prod?.variants.find((v) => v.id === item.variantId);
                  const pending = Math.max(0, item.sentQuantity - item.receivedQuantity - item.rejectedQuantity - item.lossQuantity);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-muted text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-charcoal">{prod?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted">{variant?.name ?? '—'}</td>
                      <td className="px-4 py-3">{formatQty(item.sentQuantity, prod?.unit ?? '')}</td>
                      <td className="px-4 py-3 text-success font-medium">{formatQty(item.receivedQuantity, prod?.unit ?? '')}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${pending > 0 ? 'text-orange-600' : 'text-muted'}`}>
                          {formatQty(pending, prod?.unit ?? '')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {item.rate != null ? `₹${item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand/5 border-t-2 border-brand/20">
                  <td colSpan={3} className="px-4 py-3 text-xs font-bold text-charcoal uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3 font-bold text-charcoal">
                    {formatQty(job.items.reduce((s, i) => s + i.sentQuantity, 0), 'Pic')}
                  </td>
                  <td className="px-4 py-3 font-bold text-success">
                    {formatQty(job.items.reduce((s, i) => s + i.receivedQuantity, 0), 'Pic')}
                  </td>
                  <td className="px-4 py-3 font-bold text-orange-600">
                    {formatQty(job.items.reduce((s, i) => s + Math.max(0, i.sentQuantity - i.receivedQuantity - i.rejectedQuantity - i.lossQuantity), 0), 'Pic')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* ── Read-only: Challans ── */}
        {(() => {
          const jobDispatches = dispatches.filter((d) => d.jobWorkId === job.id);
          if (jobDispatches.length === 0) return null;
          return (
            <Card className="max-w-2xl">
              <div className="px-5 pt-5 pb-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Challans
                  <span className="ml-2 font-normal normal-case text-muted">({jobDispatches.length}) — view only</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      {['Challan No.', 'Date', 'Vehicle', 'Driver', 'Transport'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobDispatches.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link to={`/challans/${d.id}`} className="font-medium text-brand hover:underline">{d.challanNumber}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(d.date)}</td>
                        <td className="px-4 py-3 text-muted">{d.vehicleNumber || '—'}</td>
                        <td className="px-4 py-3 text-muted">{d.driver || '—'}</td>
                        <td className="px-4 py-3 text-muted">{d.transport}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })()}

        {/* ── Read-only: Receipts ── */}
        {(() => {
          const jobReceipts = receipts.filter((r) => r.jobWorkId === job.id);
          if (jobReceipts.length === 0) return null;
          return (
            <Card className="max-w-2xl">
              <div className="px-5 pt-5 pb-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Receipts
                  <span className="ml-2 font-normal normal-case text-muted">({jobReceipts.length}) — view only</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      {['Date', 'Received By', 'Vendor Challan', 'Remarks'].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jobReceipts.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-charcoal font-medium">{formatDate(r.date)}</td>
                        <td className="px-4 py-3 text-muted">{r.receivedBy}</td>
                        <td className="px-4 py-3 text-muted">{r.vendorChallanNumber ?? '—'}</td>
                        <td className="px-4 py-3 text-muted">{r.remarks ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })()}

      </div>
    </div>
  );
}
