import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card, KPICard } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatDate, formatQty } from '../data/mockData';
import { buildVendorStatement, monthLabel, vendorAvailableMonths } from '../lib/vendorAccounting';
import { printVendorStatement } from '../components/ui/VendorStatementPrint';

export function VendorStatementPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const vendors = useAppStore((s) => s.vendors);
  const jobWorks = useAppStore((s) => s.jobWorks);
  const payments = useAppStore((s) => s.payments);
  const settings = useAppStore((s) => s.settings);

  const vendor = vendors.find((v) => v.id === id);

  const months = useMemo(
    () => (vendor ? vendorAvailableMonths(vendor.id, jobWorks, payments) : []),
    [vendor, jobWorks, payments],
  );
  const [period, setPeriod] = useState<string>(''); // '' = all time

  const statement = useMemo(
    () => (vendor ? buildVendorStatement(vendor.id, jobWorks, payments, period) : null),
    [vendor, jobWorks, payments, period],
  );

  if (!vendor) return <div className="text-center py-16 text-muted">Vendor not found</div>;
  if (!statement) return null;

  const jobStatusById = (jobId: string) => jobWorks.find((j) => j.id === jobId)?.status ?? 'Draft';

  const handlePrint = () => {
    printVendorStatement({
      statement,
      vendor: { name: vendor.name, contactPerson: vendor.contactPerson, mobile: vendor.mobile, gstNumber: vendor.gstNumber },
      settings,
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <BackButton to={`/vendors/${vendor.id}`} label="Back to vendor" />
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
            aria-label="Statement period"
          >
            <option value="">All time</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <Button variant="outline" onClick={handlePrint}>
            <Printer size={16} /> Print Statement
          </Button>
          {statement.balance > 0 && (
            <Button onClick={() => navigate('/payments')}>Go to Payments</Button>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-bold text-charcoal mb-1">{vendor.name}</h1>
      <p className="text-sm text-muted mb-6">
        Account statement · {monthLabel(period)} · {vendor.contactPerson} · {vendor.mobile}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Jobs (payable)" value={statement.jobCount} color="brand" />
        <KPICard label="Total Owed" value={formatCurrency(statement.owed)} color="info" />
        <KPICard label="Total Paid" value={formatCurrency(statement.paidInScope)} color="success" />
        <KPICard
          label="Balance"
          value={statement.balance > 0 ? formatCurrency(statement.balance) : 'Settled'}
          color={statement.balance > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* ── Work done (payable) ── */}
      <Card className="mb-6">
        <div className="px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold text-charcoal">Work Done</span>
          <span className="text-xs text-muted ml-2">— payable on received quantity × rate</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Date', 'Job No.', 'Process', 'Sent', 'Received', 'Rej/Loss', 'Rate', 'Amount', 'Status'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.jobs.map((row) => (
                <tr key={row.jobId} className="border-b border-border hover:bg-surface/50">
                  <td className="px-4 py-3">{formatDate(row.issueDate)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/job-works/${row.jobId}`} className="font-semibold text-brand hover:underline">
                      {row.jobNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.process}</td>
                  <td className="px-4 py-3 text-muted">{formatQty(row.sentQty, 'Pic')}</td>
                  <td className="px-4 py-3 font-medium">{formatQty(row.receivedQty, 'Pic')}</td>
                  <td className="px-4 py-3 text-muted">{row.rejectedQty > 0 ? formatQty(row.rejectedQty, 'Pic') : '—'}</td>
                  <td className="px-4 py-3 text-muted">{formatCurrency(row.rate)}</td>
                  <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3"><StatusBadge status={jobStatusById(row.jobId)} /></td>
                </tr>
              ))}
              {statement.jobs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted">
                    No payable work in this period.
                  </td>
                </tr>
              )}
            </tbody>
            {statement.jobs.length > 0 && (
              <tfoot>
                <tr className="bg-brand/5 border-t-2 border-brand/20">
                  <td colSpan={7} className="px-4 py-3 text-sm font-bold text-charcoal uppercase tracking-wide">Total Owed</td>
                  <td className="px-4 py-3 font-bold text-brand">{formatCurrency(statement.owed)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ── Payments ── */}
      <Card>
        <div className="px-4 py-3 border-b border-border bg-surface">
          <span className="text-sm font-semibold text-charcoal">Payments</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Date', 'Receipt No.', 'Method', 'Reference', 'Paid'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statement.paymentsInScope.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3 font-semibold text-brand">{p.receiptNumber ?? '—'}</td>
                  <td className="px-4 py-3">{p.method ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{p.reference || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-charcoal">{formatCurrency(p.paid)}</td>
                </tr>
              ))}
              {statement.paymentsInScope.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                    No payments in this period.
                  </td>
                </tr>
              )}
            </tbody>
            {statement.paymentsInScope.length > 0 && (
              <tfoot>
                <tr className="bg-green-50 border-t-2 border-green-200">
                  <td colSpan={4} className="px-4 py-3 text-sm font-bold text-charcoal uppercase tracking-wide">Total Paid</td>
                  <td className="px-4 py-3 font-bold text-success">{formatCurrency(statement.paidInScope)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
