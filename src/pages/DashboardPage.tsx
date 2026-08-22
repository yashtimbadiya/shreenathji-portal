import { Eye, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { Card, CardHeader, KPICard } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  formatDate,
  formatQty,
  getJobPendingTotal,
  getJobReceivedTotal,
  getJobSentTotal,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8',
  Sent: '#2563eb',
  Processing: '#7c3aed',
  Partial: '#ea580c',
  Completed: '#16a34a',
  Overdue: '#dc2626',
};

export function DashboardPage() {
  const jobWorks = useAppStore((s) => s.jobWorks);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const dispatches = useAppStore((s) => s.dispatches);
  const receipts = useAppStore((s) => s.receipts);

  const activeJobs = jobWorks.filter((j) => !['Completed', 'Cancelled', 'Draft'].includes(j.status)).length;
  const overdueJobs = jobWorks.filter((j) => j.status === 'Overdue').length;
  const materialWithVendors = products.reduce(
    (s, p) => s + p.variants.reduce((vs, v) => vs + v.withVendor, 0),
    0,
  );
  const sentToday = dispatches.filter((d) => d.date === '2026-07-25').reduce(
    (s, d) => s + d.items.reduce((is, i) => is + i.quantity, 0),
    0,
  );
  const receivedToday = receipts.filter((r) => r.date === '2026-07-27').reduce(
    (s, r) => s + r.items.reduce((is, i) => is + i.received, 0),
    0,
  );
  const pendingJobs = jobWorks.filter((j) => ['Partial', 'Sent', 'Processing', 'Overdue'].includes(j.status));

  const statusData = Object.entries(
    jobWorks.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const monthlyData = [
    { month: 'Mar', sent: 42000, received: 38000 },
    { month: 'Apr', sent: 55000, received: 48000 },
    { month: 'May', sent: 48000, received: 45000 },
    { month: 'Jun', sent: 62000, received: 58000 },
    { month: 'Jul', sent: 45000, received: 41200 },
  ];

  const vendorPending = useAppStore((s) => s.vendors).map((v) => {
    const jobs = jobWorks.filter((j) => j.vendorId === v.id);
    const pending = jobs.reduce((s, j) => s + getJobPendingTotal(j), 0);
    return { name: v.name, pending };
  }).filter((v) => v.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Dashboard</h1>
        <Link
          to="/job-works/create"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          <Plus size={16} />
          Create New Job Work
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <KPICard label="Active Job Works" value={activeJobs} color="brand" />
        <KPICard label="Material With Vendors" value={formatQty(materialWithVendors, 'Pic')} color="info" />
        <KPICard label="Overdue Jobs" value={overdueJobs} color="danger" />
        <KPICard label="Sent Today" value={formatQty(sentToday, 'Pic')} color="info" />
        <KPICard label="Received Today" value={formatQty(receivedToday, 'Pic')} color="success" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Pending Job Work" subtitle={`${pendingJobs.length} active jobs`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Job Number', 'Vendor', 'Product', 'Variant', 'Sent', 'Received', 'Pending', 'Issue Date', 'Due Date', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingJobs.map((job) => {
                const vendor = vendors.find((v) => v.id === job.vendorId);
                const firstItem = job.items[0];
                const product = firstItem ? products.find((p) => p.id === firstItem.productId) : null;
                const variant = product?.variants.find((v) => v.id === firstItem?.variantId);
                return (
                  <tr key={job.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-brand">{job.jobNumber}</td>
                    <td className="px-4 py-3">{vendor?.name}</td>
                    <td className="px-4 py-3">{product?.name}{job.items.length > 1 ? ` +${job.items.length - 1}` : ''}</td>
                    <td className="px-4 py-3">{variant?.name ?? '—'}</td>
                    <td className="px-4 py-3">{formatQty(getJobSentTotal(job), product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3">{formatQty(getJobReceivedTotal(job), product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3 font-medium">{formatQty(getJobPendingTotal(job), product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3">{formatDate(job.issueDate)}</td>
                    <td className="px-4 py-3">{formatDate(job.expectedReturnDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">
                      <Link to={`/job-works/${job.id}`} className="text-brand hover:underline">
                        <Eye size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader title="Job Work Status" />
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Monthly Sent vs Received" />
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#c41e3a" name="Sent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="received" fill="#16a34a" name="Received" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader title="Recent Dispatches" />
          <div className="divide-y divide-border">
            {dispatches.slice(0, 5).map((d) => (
              <div key={d.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{d.challanNumber}</p>
                  <p className="text-xs text-muted">{formatDate(d.date)}</p>
                </div>
                <p className="text-muted">{d.vehicleNumber}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Receipts" />
          <div className="divide-y divide-border">
            {receipts.slice(0, 5).map((r) => {
              const job = jobWorks.find((j) => j.id === r.jobWorkId);
              return (
                <div key={r.id} className="px-4 py-3 flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{job?.jobNumber}</p>
                    <p className="text-xs text-muted">{formatDate(r.date)}</p>
                  </div>
                  <p className="text-muted">{r.receivedBy}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Vendor-wise Material Pending" />
          <div className="divide-y divide-border">
            {vendorPending.map((v) => (
              <div key={v.name} className="px-4 py-3 flex justify-between text-sm">
                <p className="font-medium">{v.name}</p>
                <p className="text-orange-600 font-medium">{v.pending.toLocaleString()} Pic</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
