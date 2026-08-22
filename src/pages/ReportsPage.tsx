import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  return job.items.reduce((sum, item) => sum + Math.max(0, item.sentQuantity - item.receivedQuantity - item.rejectedQuantity - item.lossQuantity), 0);
}

function getPaymentStatus(payments: any[]) {
  const totalPaid = payments.reduce((sum, payment) => sum + payment.paid, 0);
  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

  if (!payments.length) return 'Pending';
  if (totalPaid >= totalAmount) return 'Paid';
  if (totalPaid > 0) return 'Partial';
  return 'Pending';
}

export function ReportsPage() {
  const settings = useAppStore((s) => s.settings);
  const jobWorks = useAppStore((s) => s.jobWorks);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const dispatches = useAppStore((s) => s.dispatches);
  const receipts = useAppStore((s) => s.receipts);
  const payments = useAppStore((s) => s.payments);

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  const [filters, setFilters] = useState({
    from: thirtyDaysAgo,
    to: today,
    vendor: 'all',
    category: 'all',
    product: 'all',
    status: 'Any',
  });

  const filteredJobWorks = useMemo(() => {
    return jobWorks.filter((job) => {
      if (filters.from && job.issueDate < filters.from) return false;
      if (filters.to && job.issueDate > filters.to) return false;
      if (filters.vendor !== 'all' && job.vendorId !== filters.vendor) return false;
      if (filters.status !== 'Any' && job.status !== filters.status) return false;
      if (filters.category !== 'all') {
        const categoryMatch = job.items.some((item) => {
          const product = products.find((productItem) => productItem.id === item.productId);
          return product?.categoryId === filters.category;
        });
        if (!categoryMatch) return false;
      }
      if (filters.product !== 'all') {
        if (!job.items.some((item) => item.productId === filters.product)) return false;
      }
      return true;
    });
  }, [filters, jobWorks, products]);

  const filteredJobIds = useMemo(() => new Set(filteredJobWorks.map((job) => job.id)), [filteredJobWorks]);

  const filteredDispatches = useMemo(
    () =>
      dispatches.filter(
        (dispatch) =>
          dispatch.date >= filters.from &&
          dispatch.date <= filters.to &&
          filteredJobIds.has(dispatch.jobWorkId),
      ),
    [dispatches, filters.from, filters.to, filteredJobIds],
  );

  const filteredReceipts = useMemo(
    () =>
      receipts.filter(
        (receipt) =>
          receipt.date >= filters.from &&
          receipt.date <= filters.to &&
          filteredJobIds.has(receipt.jobWorkId),
      ),
    [receipts, filters.from, filters.to, filteredJobIds],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          payment.date >= filters.from &&
          payment.date <= filters.to &&
          filteredJobIds.has(payment.jobWorkId),
      ),
    [payments, filters.from, filters.to, filteredJobIds],
  );

  const filteredProducts = useMemo(
    () => products.filter((product) => filters.category === 'all' || product.categoryId === filters.category),
    [products, filters.category],
  );

  const unifiedReportRows = useMemo(() => {
    return filteredJobWorks.map((job) => {
      const vendor = vendors.find((item) => item.id === job.vendorId);
      const dispatchEntries = filteredDispatches.filter((dispatch) => dispatch.jobWorkId === job.id);
      const receiptEntries = filteredReceipts.filter((receipt) => receipt.jobWorkId === job.id);
      const paymentEntries = filteredPayments.filter((payment) => payment.jobWorkId === job.id);
      const sentQuantity = job.items.reduce((sum, item) => sum + item.sentQuantity, 0);
      const receivedQuantity = job.items.reduce((sum, item) => sum + item.receivedQuantity + item.rejectedQuantity + item.lossQuantity, 0);
      const pendingQuantity = getPendingQuantity(job);
      const totalPaidAmount = paymentEntries.reduce((sum, payment) => sum + payment.paid, 0);
      const totalAmount = paymentEntries.reduce((sum, payment) => sum + payment.amount, 0);
      const latestDispatch = [...dispatchEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestReceipt = [...receiptEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      const latestPayment = [...paymentEntries].sort((a, b) => b.date.localeCompare(a.date))[0];
      const remainingAmount = Math.max(0, totalAmount - totalPaidAmount);

      return {
        vendor: vendor?.name ?? '',
        city: parseCity(vendor?.address ?? ''),
        jobNumber: job.jobNumber,
        process: job.process,
        issueDate: job.issueDate,
        expectedReturnDate: job.expectedReturnDate,
        status: job.status,
        sentQuantity,
        receivedQuantity,
        pendingQuantity,
        dispatchDate: latestDispatch?.date ?? '',
        receiptDate: latestReceipt?.date ?? '',
        paymentDate: latestPayment?.date ?? '',
        paymentType: latestPayment?.paymentType ?? '—',
        paymentAmount: totalPaidAmount,
        remainingAmount,
        paymentStatus: totalAmount > 0 ? getPaymentStatus(paymentEntries) : 'Pending',
      };
    });
  }, [filteredDispatches, filteredJobWorks, filteredPayments, filteredReceipts, vendors]);

  const vendorPendingReport = useMemo(() => {
    return vendors.map((vendor) => {
      const jobs = filteredJobWorks.filter((job) => job.vendorId === vendor.id);
      const pending = jobs.reduce((sum, job) => sum + getPendingQuantity(job), 0);
      return { vendor: vendor.name, city: parseCity(vendor.address), pending };
    }).filter((item) => item.pending > 0);
  }, [filteredJobWorks, vendors]);

  const paymentStatusTotals = useMemo(() => {
    return Object.entries(
      unifiedReportRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.paymentStatus] = (acc[row.paymentStatus] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([name, value]) => ({ name, value }));
  }, [unifiedReportRows]);

  const regionData = useMemo(() => {
    const totals = vendorPendingReport.reduce<Record<string, number>>((acc, item) => {
      acc[item.city] = (acc[item.city] ?? 0) + item.pending;
      return acc;
    }, {});

    return Object.entries(totals).map(([city, value]) => ({ city, value }));
  }, [vendorPendingReport]);

  const csvEscape = (value: any) => {
    const stringValue = value == null ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const buildCsv = (headers: string[], rows: Array<Array<any>>) => {
    const headerLine = headers.map(csvEscape).join(',');
    const bodyLines = rows.map((row) => row.map(csvEscape).join(','));
    return [headerLine, ...bodyLines].join('\r\n');
  };

  const getExportData = () => {
    const selectedVendor = filters.vendor === 'all' ? 'all_vendors' : vendors.find((vendor) => vendor.id === filters.vendor)?.name ?? 'selected_vendor';
    const filenameBase = `unified_report_${selectedVendor}_${filters.from}_${filters.to}`;

    return {
      filename: `${filenameBase}.csv`,
      headers: ['Vendor', 'City', 'Job Number', 'Process', 'Issue Date', 'Expected Return', 'Status', 'Sent Qty', 'Received Qty', 'Pending Qty', 'Dispatch Date', 'Receipt Date', 'Payment Type', 'Payment Date', 'Payment Amount', 'Remaining Amount', 'Payment Status'],
      rows: unifiedReportRows.map((row) => [
        row.vendor,
        row.city,
        row.jobNumber,
        row.process,
        row.issueDate,
        row.expectedReturnDate,
        row.status,
        row.sentQuantity,
        row.receivedQuantity,
        row.pendingQuantity,
        row.dispatchDate,
        row.receiptDate,
        row.paymentType,
        row.paymentDate,
        row.paymentAmount,
        row.remainingAmount,
        row.paymentStatus,
      ]),
    };
  };

  const downloadCsv = () => {
    const { filename, headers, rows } = getExportData();
    const csvContent = buildCsv(headers, rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  const reportOptions = [
    { value: 'all', label: 'All Vendors' },
    ...vendors.map((vendor) => ({ value: vendor.id, label: vendor.name })),
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((category) => ({ value: category.id, label: category.name })),
  ];

  const productOptions = [
    { value: 'all', label: 'All Products' },
    ...filteredProducts.map((product) => ({ value: product.id, label: product.name })),
  ];

  const activeVendorCities = useMemo(
    () => Array.from(new Set(vendors.map((vendor) => parseCity(vendor.address)))),
    [vendors],
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Filter reports by date, vendor, product, category, and status." />

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
            label="Category"
            value={filters.category}
            options={categoryOptions}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          />
          <Select
            label="Product"
            value={filters.product}
            options={productOptions}
            onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.status}
            options={STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <Button onClick={() => setFilters({ from: thirtyDaysAgo, to: today, vendor: 'all', category: 'all', product: 'all', status: 'Any' })} variant="outline">
            Reset
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <p className="text-sm text-muted">Export the current filtered report data for the selected date range.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={printReport}>Print</Button>
          <Button onClick={downloadCsv}>Download Excel</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-4">
          <Card className="p-6">
            <CardHeader title="Unified Vendor Ledger" subtitle="Single lifecycle view of pending quantity, dispatch, receipts, and payments" />
            <div className="mt-5 space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Company</p>
                  <p className="font-semibold text-charcoal mt-2">{settings.companyName}</p>
                  <p className="text-sm text-muted mt-1">{settings.address}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Report range</p>
                  <p className="font-semibold text-charcoal mt-2">{filters.from}</p>
                  <p className="text-sm text-muted mt-1">to {filters.to}</p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <p className="text-xs uppercase tracking-wide text-muted">Selected vendor</p>
                  <p className="font-semibold text-charcoal mt-2">{filters.vendor === 'all' ? 'All vendors' : vendors.find((vendor) => vendor.id === filters.vendor)?.name ?? 'Selected vendor'}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  <CardHeader title="Pending by location" />
                  <div className="h-56 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={regionData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="city" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4">
                  <CardHeader title="Payment status mix" />
                  <div className="h-56 mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={paymentStatusTotals} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} label />
                        {paymentStatusTotals.map((entry, index) => (
                          <Cell key={entry.name} fill={['#2563eb', '#10b981', '#f97316'][index % 3]} />
                        ))}
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-3 py-2">Vendor</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Process</th>
                      <th className="px-3 py-2">Issue Date</th>
                      <th className="px-3 py-2">Expected Return</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Sent Qty</th>
                      <th className="px-3 py-2">Received Qty</th>
                      <th className="px-3 py-2">Pending Qty</th>
                      <th className="px-3 py-2">Dispatch Date</th>
                      <th className="px-3 py-2">Receipt Date</th>
                      <th className="px-3 py-2">Payment Type</th>
                      <th className="px-3 py-2">Payment Date</th>
                      <th className="px-3 py-2">Paid Amount</th>
                      <th className="px-3 py-2">Remaining</th>
                      <th className="px-3 py-2">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedReportRows.map((row) => (
                      <tr key={`${row.vendor}-${row.jobNumber}`} className="rounded-2xl bg-white shadow-sm">
                        <td className="px-3 py-3 font-semibold text-charcoal">{row.vendor}</td>
                        <td className="px-3 py-3 text-muted">{row.city}</td>
                        <td className="px-3 py-3 text-charcoal">{row.jobNumber}</td>
                        <td className="px-3 py-3 text-muted">{row.process}</td>
                        <td className="px-3 py-3 text-muted">{row.issueDate}</td>
                        <td className="px-3 py-3 text-muted">{row.expectedReturnDate}</td>
                        <td className="px-3 py-3 text-muted">{row.status}</td>
                        <td className="px-3 py-3 text-muted">{row.sentQuantity}</td>
                        <td className="px-3 py-3 text-muted">{row.receivedQuantity}</td>
                        <td className="px-3 py-3 font-semibold text-brand">{row.pendingQuantity}</td>
                        <td className="px-3 py-3 text-muted">{row.dispatchDate || '-'}</td>
                        <td className="px-3 py-3 text-muted">{row.receiptDate || '-'}</td>
                        <td className="px-3 py-3 text-muted">{row.paymentType}</td>
                        <td className="px-3 py-3 text-muted">{row.paymentDate || '-'}</td>
                        <td className="px-3 py-3 text-muted">{row.paymentAmount}</td>
                        <td className="px-3 py-3 text-muted">{row.remainingAmount}</td>
                        <td className="px-3 py-3 text-muted">{row.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {unifiedReportRows.length === 0 && <p className="text-sm text-muted mt-4">No report rows match the current filter selection.</p>}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <CardHeader title="Company Snapshot" />
            <div className="mt-4 space-y-3 text-sm text-muted">
              <div>
                <p className="font-semibold text-charcoal">GSTIN</p>
                <p>{settings.gstin}</p>
              </div>
              <div>
                <p className="font-semibold text-charcoal">Phone</p>
                <p>{settings.phone}</p>
              </div>
              <div>
                <p className="font-semibold text-charcoal">Email</p>
                <p>{settings.email}</p>
              </div>
              <div>
                <p className="font-semibold text-charcoal">Website</p>
                <p>{settings.website}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <CardHeader title="Geography Insights" />
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm text-muted">Vendor cities</p>
                <p className="mt-2 font-semibold text-charcoal">{activeVendorCities.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-sm text-muted">Top regions by pending material</p>
                {regionData.slice(0, 3).map((region) => (
                  <div key={region.city} className="mt-3 flex items-center justify-between text-sm">
                    <span>{region.city}</span>
                    <strong>{region.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
