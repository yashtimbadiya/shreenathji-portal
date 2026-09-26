import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card, KPICard } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrency, formatDate, formatQty } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { priorityRowClass, PriorityBadge } from '../components/ui/PriorityBadge';
import { buildVendorStatement } from '../lib/vendorAccounting';
import type { DispatchRecord } from '../types';

const TABS = ['Overview', 'Job Works', 'Material Ledger', 'Payments', 'Documents'];

export function VendorDetailPage() {
  const { id } = useParams();
  const vendors = useAppStore((s) => s.vendors);
  const jobWorks = useAppStore((s) => s.jobWorks);
  const dispatches = useAppStore((s) => s.dispatches);
  const products = useAppStore((s) => s.products);
  const payments = useAppStore((s) => s.payments);
  const [activeTab, setActiveTab] = useState('Overview');

  const vendor = vendors.find((v) => v.id === id);
  if (!vendor) return <div className="text-center py-16 text-muted">Vendor not found</div>;

  const getProductById = (productId: string) => products.find((p) => p.id === productId);
  const getJobSentTotal = (job: typeof jobWorks[number]) => job.items.reduce((sum, item) => sum + item.sentQuantity, 0);
  const getJobReceivedTotal = (job: typeof jobWorks[number]) => job.items.reduce((sum, item) => sum + item.receivedQuantity, 0);
  const getJobPendingTotal = (job: typeof jobWorks[number]) => job.items.reduce(
    (sum, item) => sum + Math.max(0, item.sentQuantity - item.receivedQuantity - item.rejectedQuantity - item.lossQuantity),
    0,
  );

  const vendorJobs = jobWorks.filter((j) => j.vendorId === vendor.id);

  /** Map from jobWorkId → list of dispatch records (challans) for that job */
  const challansByJob = vendorJobs.reduce<Record<string, DispatchRecord[]>>((acc, job) => {
    acc[job.id] = dispatches.filter((d) => d.jobWorkId === job.id);
    return acc;
  }, {});
  const materialSent = vendorJobs.reduce((sum, job) => sum + getJobSentTotal(job), 0);
  const materialReceived = vendorJobs.reduce((sum, job) => sum + getJobReceivedTotal(job), 0);
  const materialPending = vendorJobs.reduce((sum, job) => sum + getJobPendingTotal(job), 0);
  const activeJobs = vendorJobs.filter((job) => !['Completed', 'Cancelled', 'Draft'].includes(job.status)).length;
  const overdue = vendorJobs.filter((job) => job.status === 'Overdue').length;
  // Outstanding is derived from the vendor account (owed on received qty − paid)
  const statement = buildVendorStatement(vendor.id, jobWorks, payments, '');
  const outstanding = statement.balance;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <BackButton to="/vendors" />
        <Link to={`/vendors/${vendor.id}/statement`}>
          <Button variant="outline"><FileText size={16} /> View Statement</Button>
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-charcoal mb-2">{vendor.name}</h1>
      <p className="text-sm text-muted mb-6">{vendor.contactPerson} · {vendor.mobile} · {vendor.specialization}</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KPICard label="Material Sent" value={formatQty(materialSent, 'Pic')} color="info" />
        <KPICard label="Material Received" value={formatQty(materialReceived, 'Pic')} color="success" />
        <KPICard label="Material Pending" value={formatQty(materialPending, 'Pic')} color="warning" />
        <KPICard label="Active Jobs" value={activeJobs} color="brand" />
        <KPICard label="Overdue" value={overdue} color="danger" />
        <KPICard label="Outstanding" value={formatCurrency(outstanding)} color="danger" />
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${
              activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {(activeTab === 'Overview' || activeTab === 'Job Works' || activeTab === 'Material Ledger') && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  {['Issue Date', 'Job Number', 'Challan No.', 'Product', 'Variant', 'Sent', 'Received', 'Pending', 'Due Date', 'Status'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorJobs.map((job) => {
                  const item = job.items[0];
                  const product = item ? getProductById(item.productId) : null;
                  const variant = product?.variants.find((v) => v.id === item?.variantId);
                  const jobChallans = challansByJob[job.id] ?? [];
                  return (
                    <tr key={job.id} className={`border-b border-border ${priorityRowClass(job.priority)}`}>
                      <td className="px-4 py-3">{formatDate(job.issueDate)}</td>
                      <td className="px-4 py-3">
                        <Link to={`/job-works/${job.id}`} className="text-brand hover:underline">{job.jobNumber}</Link>
                        <span className="ml-2"><PriorityBadge priority={job.priority} /></span>
                      </td>
                      {/* Challan No. — may be multiple challans per job */}
                      <td className="px-4 py-3">
                        {jobChallans.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {jobChallans.map((ch) => (
                              <Link
                                key={ch.id}
                                to={`/challans/${ch.id}`}
                                className="inline-block font-mono text-xs font-semibold text-brand hover:underline bg-brand/5 border border-brand/20 rounded px-1.5 py-0.5 transition-colors hover:bg-brand/10"
                              >
                                {ch.challanNumber}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{product?.name}</td>
                      <td className="px-4 py-3">{variant?.name}</td>
                      <td className="px-4 py-3">{formatQty(getJobSentTotal(job), product?.unit ?? '')}</td>
                      <td className="px-4 py-3">{formatQty(getJobReceivedTotal(job), product?.unit ?? '')}</td>
                      <td className="px-4 py-3">{formatQty(getJobPendingTotal(job), product?.unit ?? '')}</td>
                      <td className="px-4 py-3">{formatDate(job.expectedReturnDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'Payments' && (
        <Card>
          <div className="px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
            <div className="flex gap-6 text-sm">
              <span className="text-muted">Owed <strong className="text-charcoal ml-1">{formatCurrency(statement.owed)}</strong></span>
              <span className="text-muted">Paid <strong className="text-success ml-1">{formatCurrency(statement.paidInScope)}</strong></span>
              <span className="text-muted">Balance <strong className={`ml-1 ${statement.balance > 0 ? 'text-danger' : 'text-success'}`}>{statement.balance > 0 ? formatCurrency(statement.balance) : 'Settled'}</strong></span>
            </div>
            <Link to={`/vendors/${vendor.id}/statement`} className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-1">
              <FileText size={13} /> Full statement
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Date', 'Receipt No.', 'Method', 'Reference', 'Paid'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.paymentsInScope.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 font-semibold text-brand">{p.receiptNumber ?? '—'}</td>
                  <td className="px-4 py-3">{p.method ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{p.reference || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(p.paid)}</td>
                </tr>
              ))}
              {statement.paymentsInScope.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No payments recorded for this vendor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'Documents' && (
        <Card className="p-6 text-sm text-muted">Vendor documents and agreements will be stored here.</Card>
      )}
    </div>
  );
}
