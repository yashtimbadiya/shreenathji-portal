import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, PageHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import type { JobWork } from '../types';

const STATUS_OPTIONS = ['Any', 'Draft', 'Sent', 'Processing', 'Partial', 'Completed', 'Overdue', 'Cancelled', 'Rejected'];

function parseCity(address = '') {
  return address.split(',')[0].trim();
}

function getPendingQuantity(job: JobWork) {
  return job.items.reduce(
    (sum, item) =>
      sum + Math.max(0, item.sentQuantity - item.receivedQuantity - item.rejectedQuantity - item.lossQuantity),
    0,
  );
}

function getPaymentStatus(payments: any[]) {
  const totalPaid   = payments.reduce((sum, p) => sum + p.paid,   0);
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  if (!payments.length)        return 'Pending';
  if (totalPaid >= totalAmount) return 'Paid';
  if (totalPaid > 0)            return 'Partial';
  return 'Pending';
}

export function ReportsPage() {
  const settings   = useAppStore((s) => s.settings);
  const jobWorks   = useAppStore((s) => s.jobWorks);
  const vendors    = useAppStore((s) => s.vendors);
  const products   = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const dispatches = useAppStore((s) => s.dispatches);
  const receipts   = useAppStore((s) => s.receipts);
  const payments   = useAppStore((s) => s.payments);

  const today        = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({
    from:     thirtyDaysAgo,
    to:       today,
    vendor:   'all',
    category: 'all',   // "Product" filter (categoryId)
    product:  'all',   // "Sub Product" filter (productId)
    status:   'Any',
  });

  const filteredJobWorks = useMemo(() => {
    return jobWorks.filter((job) => {
      if (filters.from   && job.issueDate < filters.from) return false;
      if (filters.to     && job.issueDate > filters.to)   return false;
      if (filters.vendor !== 'all' && job.vendorId !== filters.vendor) return false;
      if (filters.status !== 'Any' && job.status  !== filters.status)  return false;
      if (filters.category !== 'all') {
        const match = job.items.some((item) => {
          const p = products.find((pr) => pr.id === item.productId);
          return p?.categoryId === filters.category;
        });
        if (!match) return false;
      }
      if (filters.product !== 'all') {
        if (!job.items.some((item) => item.productId === filters.product)) return false;
      }
      return true;
    });
  }, [filters, jobWorks, products]);

  const filteredJobIds = useMemo(
    () => new Set(filteredJobWorks.map((j) => j.id)),
    [filteredJobWorks],
  );

  const filteredDispatches = useMemo(
    () => dispatches.filter((d) => d.date >= filters.from && d.date <= filters.to && filteredJobIds.has(d.jobWorkId)),
    [dispatches, filters.from, filters.to, filteredJobIds],
  );

  const filteredReceipts = useMemo(
    () => receipts.filter((r) => r.date >= filters.from && r.date <= filters.to && filteredJobIds.has(r.jobWorkId)),
    [receipts, filters.from, filters.to, filteredJobIds],
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => p.date >= filters.from && p.date <= filters.to && filteredJobIds.has(p.jobWorkId)),
    [payments, filters.from, filters.to, filteredJobIds],
  );

  const filteredSubProducts = useMemo(
    () => products.filter((p) => filters.category === 'all' || p.categoryId === filters.category),
    [products, filters.category],
  );

  const unifiedReportRows = useMemo(() => {
    return filteredJobWorks.map((job) => {
      const vendor         = vendors.find((v) => v.id === job.vendorId);
      const dispatchEntries = filteredDispatches.filter((d) => d.jobWorkId === job.id);
      const receiptEntries  = filteredReceipts.filter((r)  => r.jobWorkId === job.id);
      const paymentEntries  = filteredPayments.filter((p)  => p.jobWorkId === job.id);

      const sentQuantity     = job.items.reduce((s, i) => s + i.sentQuantity, 0);
      const receivedQuantity = job.items.reduce((s, i) => s + i.receivedQuantity + i.rejectedQuantity + i.lossQuantity, 0);
      const pendingQuantity  = getPendingQuantity(job);

      const totalPaidAmount  = paymentEntries.reduce((s, p) => s + p.paid,   0);
      const totalAmount      = paymentEntries.reduce((s, p) => s + p.amount, 0);
      const remainingAmount  = Math.max(0, totalAmount - totalPaidAmount);

      const latestDispatch = [...dispatchEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestReceipt  = [...receiptEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestPayment  = [...paymentEntries].sort((a, b) => b.date.localeCompare(a.date))[0];

      return {
        vendor:             vendor?.name ?? '',
        city:               parseCity(vendor?.address ?? ''),
        jobNumber:          job.jobNumber,
        process:            job.process,
        issueDate:          job.issueDate,
        expectedReturnDate: job.expectedReturnDate,
        status:             job.status,
        sentQuantity,
        receivedQuantity,
        pendingQuantity,
        dispatchDate:  latestDispatch?.date ?? '',
        receiptDate:   latestReceipt?.date  ?? '',
        paymentDate:   latestPayment?.date  ?? '',
        paymentType:   latestPayment?.paymentType ?? '—',
        paymentAmount: totalPaidAmount,
        remainingAmount,
        paymentStatus: totalAmount > 0 ? getPaymentStatus(paymentEntries) : 'Pending',
      };
    });
  }, [filteredDispatches, filteredJobWorks, filteredPayments, filteredReceipts, vendors]);

  // ── Totals row ──────────────────────────────────────────────────────────────
  const totals = useMemo(
    () => ({
      sentQuantity:     unifiedReportRows.reduce((s, r) => s + r.sentQuantity,     0),
      receivedQuantity: unifiedReportRows.reduce((s, r) => s + r.receivedQuantity, 0),
      pendingQuantity:  unifiedReportRows.reduce((s, r) => s + r.pendingQuantity,  0),
      paymentAmount:    unifiedReportRows.reduce((s, r) => s + r.paymentAmount,    0),
      remainingAmount:  unifiedReportRows.reduce((s, r) => s + r.remainingAmount,  0),
    }),
    [unifiedReportRows],
  );

  const csvEscape = (value: any) => {
    const s = value == null ? '' : String(value);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const buildCsv = (headers: string[], rows: Array<Array<any>>) => {
    const headerLine = headers.map(csvEscape).join(',');
    const bodyLines  = rows.map((row) => row.map(csvEscape).join(','));
    return [headerLine, ...bodyLines].join('\r\n');
  };

  const getExportData = () => {
    const vendorName = filters.vendor === 'all'
      ? 'all_vendors'
      : vendors.find((v) => v.id === filters.vendor)?.name ?? 'selected_vendor';
    return {
      filename: `unified_report_${vendorName}_${filters.from}_${filters.to}.csv`,
      headers: [
        'Vendor', 'City', 'Job Number', 'Process', 'Issue Date', 'Expected Return',
        'Status', 'Sent Qty', 'Received Qty', 'Pending Qty',
        'Dispatch Date', 'Receipt Date', 'Payment Type', 'Payment Date',
        'Payment Amount', 'Remaining Amount', 'Payment Status',
      ],
      rows: unifiedReportRows.map((row) => [
        row.vendor, row.city, row.jobNumber, row.process,
        row.issueDate, row.expectedReturnDate, row.status,
        row.sentQuantity, row.receivedQuantity, row.pendingQuantity,
        row.dispatchDate, row.receiptDate, row.paymentType, row.paymentDate,
        row.paymentAmount, row.remainingAmount, row.paymentStatus,
      ]),
    };
  };

  const downloadCsv = () => {
    const { filename, headers, rows } = getExportData();
    const csvContent = buildCsv(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url  = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reportOptions = [
    { value: 'all', label: 'All Vendors' },
    ...vendors.map((v) => ({ value: v.id, label: v.name })),
  ];

  // ── "Product" filter options (was Category) ─────────────────────────────
  const productFilterOptions = [
    { value: 'all', label: 'All Products' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  // ── "Sub Product" filter options (was Product) ──────────────────────────
  const subProductFilterOptions = [
    { value: 'all', label: 'All Sub Products' },
    ...filteredSubProducts.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter reports by date, vendor, product, sub product, and status." />

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card className="mb-6 p-6">
        <CardHeader title="Filters" />
        <div className="grid gap-4 md:grid-cols-6 mt-4 items-end">
          <Input
            label="From"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Input
            label="To"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
          <Select
            label="Vendor"
            value={filters.vendor}
            options={reportOptions}
            onChange={(e) => setFilters((prev) => ({ ...prev, vendor: e.target.value }))}
          />
          <Select
            label="Product"
            value={filters.category}
            options={productFilterOptions}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, category: e.target.value, product: 'all' }))
            }
          />
          <Select
            label="Sub Product"
            value={filters.product}
            options={subProductFilterOptions}
            onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.status}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <Button
            variant="outline"
            onClick={() =>
              setFilters({ from: thirtyDaysAgo, to: today, vendor: 'all', category: 'all', product: 'all', status: 'Any' })
            }
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* ── Export bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <p className="text-sm text-muted">
          Showing <strong>{unifiedReportRows.length}</strong> job work{unifiedReportRows.length !== 1 ? 's' : ''} for the selected filters.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button onClick={downloadCsv}>Download CSV</Button>
        </div>
      </div>

      {/* ── Report metadata strip ──────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Company</p>
          <p className="font-semibold text-charcoal mt-1">{settings.companyName}</p>
          <p className="text-xs text-muted mt-0.5">{settings.address}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Report Range</p>
          <p className="font-semibold text-charcoal mt-1">{filters.from}</p>
          <p className="text-xs text-muted mt-0.5">to {filters.to}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Selected Vendor</p>
          <p className="font-semibold text-charcoal mt-1">
            {filters.vendor === 'all'
              ? 'All Vendors'
              : vendors.find((v) => v.id === filters.vendor)?.name ?? 'Selected Vendor'}
          </p>
        </div>
      </div>

      {/* ── Main table ─────────────────────────────────────────────────────── */}
      <Card className="p-6">
        <CardHeader
          title="Unified Vendor Ledger"
          subtitle="Single lifecycle view of pending quantity, dispatch, receipts, and payments"
        />

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide">
                <th className="px-3 py-3 whitespace-nowrap">Vendor</th>
                <th className="px-3 py-3 whitespace-nowrap">City</th>
                <th className="px-3 py-3 whitespace-nowrap">Job</th>
                <th className="px-3 py-3 whitespace-nowrap">Process</th>
                <th className="px-3 py-3 whitespace-nowrap">Issue Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Expected Return</th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Sent Qty</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Received Qty</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Pending Qty</th>
                <th className="px-3 py-3 whitespace-nowrap">Dispatch Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Receipt Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Payment Type</th>
                <th className="px-3 py-3 whitespace-nowrap">Payment Date</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Paid Amount</th>
                <th className="px-3 py-3 whitespace-nowrap text-right">Remaining</th>
                <th className="px-3 py-3 whitespace-nowrap">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {unifiedReportRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-3 py-10 text-center text-sm text-muted">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                unifiedReportRows.map((row) => (
                  <tr key={`${row.vendor}-${row.jobNumber}`} className="hover:bg-surface/50">
                    <td className="px-3 py-2.5 font-semibold text-charcoal whitespace-nowrap">{row.vendor}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.city}</td>
                    <td className="px-3 py-2.5 font-medium text-brand whitespace-nowrap">{row.jobNumber}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.process}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.issueDate}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.expectedReturnDate}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-muted">{row.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.sentQuantity.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{row.receivedQuantity.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-brand">{row.pendingQuantity.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.dispatchDate || '—'}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.receiptDate || '—'}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.paymentType}</td>
                    <td className="px-3 py-2.5 text-muted whitespace-nowrap">{row.paymentDate || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">₹{row.paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">₹{row.remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                        ${row.paymentStatus === 'Paid'    ? 'bg-green-50 text-green-700 border border-green-200' :
                          row.paymentStatus === 'Partial' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                          'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                        {row.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* ── Totals row ─────────────────────────────────────────────── */}
            {unifiedReportRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-brand/30 bg-brand/5 font-bold text-charcoal">
                  <td colSpan={7} className="px-3 py-3 text-xs uppercase tracking-wide text-muted">
                    Total ({unifiedReportRows.length} job{unifiedReportRows.length !== 1 ? 's' : ''})
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {totals.sentQuantity.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-green-700">
                    {totals.receivedQuantity.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-brand">
                    {totals.pendingQuantity.toLocaleString('en-IN')}
                  </td>
                  <td colSpan={4} />
                  <td className="px-3 py-3 text-right tabular-nums">
                    ₹{totals.paymentAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    ₹{totals.remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
