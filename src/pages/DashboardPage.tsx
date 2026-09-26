import { AlertTriangle, Clock, Eye, IndianRupee, Inbox, Pencil, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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
  formatCurrency,
  formatDate,
  formatQty,
  getJobPendingTotal,
  getJobReceivedTotal,
  getJobSentTotal,
} from '../data/mockData';
import type { JobWork, Vendor } from '../types';
import { useAppStore } from '../store/useAppStore';
import { sortByDateDesc } from '../lib/sorting';
import { priorityRowClass } from '../components/ui/PriorityBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { buildVendorStatement } from '../lib/vendorAccounting';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8',
  Sent: '#2563eb',
  Processing: '#7c3aed',
  Partial: '#ea580c',
  Completed: '#16a34a',
  Overdue: '#dc2626',
};

// ─── Month helpers ────────────────────────────────────────────────────────────
function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
function prevMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return monthKey(d);
}
function nextMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1);
  return monthKey(d);
}

// ─── Custom tooltip for the product chart ────────────────────────────────────
function ProductChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-charcoal mb-1 truncate max-w-[180px]">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold">{p.value.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Action Needed panel ──────────────────────────────────────────────────────
interface ActionNeededData {
  todayIso: string;
  overdue: JobWork[];
  dueSoon: JobWork[];
  awaitingReceipt: JobWork[];
  outstandingVendors: { vendor: Vendor; balance: number }[];
  totalOutstanding: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function ActionTile({
  icon, label, count, sub, tone, active, onClick,
}: {
  icon: React.ReactNode; label: string; count: number | string; sub?: string;
  tone: 'danger' | 'warning' | 'info' | 'success'; active: boolean; onClick: () => void;
}) {
  const tones: Record<string, string> = {
    danger:  'border-red-200 bg-red-50 text-red-700',
    warning: 'border-orange-200 bg-orange-50 text-orange-700',
    info:    'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-green-200 bg-green-50 text-green-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-shadow hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/30 ${tones[tone]} ${active ? 'ring-2 ring-brand/40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="shrink-0">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold leading-none text-charcoal">{count}</div>
      {sub && <div className="text-xs mt-1 opacity-80">{sub}</div>}
    </button>
  );
}

function ActionNeededPanel({
  data, vendors, onOpenJob, onOpenReceive, onOpenPayments, onOpenStatement,
}: {
  data: ActionNeededData;
  vendors: Vendor[];
  onOpenJob: (jobId: string) => void;
  onOpenReceive: () => void;
  onOpenPayments: () => void;
  onOpenStatement: (vendorId: string) => void;
}) {
  const [tab, setTab] = useState<'overdue' | 'dueSoon' | 'receive' | 'pay'>('overdue');

  const nothing =
    data.overdue.length === 0 &&
    data.dueSoon.length === 0 &&
    data.awaitingReceipt.length === 0 &&
    data.outstandingVendors.length === 0;

  if (nothing) {
    return (
      <Card className="mb-6 p-5 flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center">✓</span>
        <div>
          <p className="text-sm font-semibold text-charcoal">You're all caught up</p>
          <p className="text-xs text-muted">No overdue jobs, nothing due soon, and no outstanding vendor balances.</p>
        </div>
      </Card>
    );
  }

  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? '—';

  // Auto-pick the most urgent non-empty tab as default
  const defaultTab: typeof tab =
    data.overdue.length ? 'overdue'
    : data.dueSoon.length ? 'dueSoon'
    : data.awaitingReceipt.length ? 'receive'
    : 'pay';
  const activeTab = ([data.overdue, data.dueSoon, data.awaitingReceipt, data.outstandingVendors][
    { overdue: 0, dueSoon: 1, receive: 2, pay: 3 }[tab]
  ]?.length ?? 0) > 0 ? tab : defaultTab;

  return (
    <Card className="mb-6 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={16} className="text-orange-500" />
        <h2 className="text-sm font-bold text-charcoal uppercase tracking-wide">Action Needed</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <ActionTile
          icon={<AlertTriangle size={16} />} label="Overdue" count={data.overdue.length}
          sub="Past due date" tone="danger"
          active={activeTab === 'overdue'} onClick={() => setTab('overdue')}
        />
        <ActionTile
          icon={<Clock size={16} />} label="Due Soon" count={data.dueSoon.length}
          sub="Next 3 days" tone="warning"
          active={activeTab === 'dueSoon'} onClick={() => setTab('dueSoon')}
        />
        <ActionTile
          icon={<Inbox size={16} />} label="Awaiting Receipt" count={data.awaitingReceipt.length}
          sub="Material out with vendor" tone="info"
          active={activeTab === 'receive'} onClick={() => setTab('receive')}
        />
        <ActionTile
          icon={<IndianRupee size={16} />} label="To Pay" count={data.outstandingVendors.length}
          sub={formatCurrency(data.totalOutstanding) + ' outstanding'} tone="success"
          active={activeTab === 'pay'} onClick={() => setTab('pay')}
        />
      </div>

      {/* Detail list for the active tile */}
      <div className="rounded-lg border border-border overflow-hidden">
        {(activeTab === 'overdue' || activeTab === 'dueSoon') && (
          <ul className="divide-y divide-border">
            {(activeTab === 'overdue' ? data.overdue : data.dueSoon).slice(0, 6).map((j) => {
              const days = daysBetween(data.todayIso, j.expectedReturnDate);
              return (
                <li key={j.id}>
                  <button
                    onClick={() => onOpenJob(j.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-brand">{j.jobNumber}</span>
                      <PriorityBadge priority={j.priority} />
                      <span className="text-muted text-sm truncate">{vendorName(j.vendorId)} · {j.process}</span>
                    </span>
                    <span className={`text-xs font-medium shrink-0 ${activeTab === 'overdue' ? 'text-red-600' : 'text-orange-600'}`}>
                      {activeTab === 'overdue'
                        ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} late`
                        : days === 0 ? 'Due today' : `Due in ${days} day${days !== 1 ? 's' : ''}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {activeTab === 'receive' && (
          <ul className="divide-y divide-border">
            {data.awaitingReceipt.slice(0, 6).map((j) => {
              const pending = j.items.reduce(
                (s, i) => s + Math.max(0, i.sentQuantity - i.receivedQuantity - i.rejectedQuantity - i.lossQuantity), 0,
              );
              return (
                <li key={j.id}>
                  <button
                    onClick={() => onOpenJob(j.id)}
                    className="w-full text-left px-4 py-2.5 hover:bg-surface flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-brand">{j.jobNumber}</span>
                      <span className="text-muted text-sm truncate">{vendorName(j.vendorId)} · {j.process}</span>
                    </span>
                    <span className="text-xs font-medium text-blue-600 shrink-0">{formatQty(pending, 'Pic')} pending</span>
                  </button>
                </li>
              );
            })}
            <li className="px-4 py-2 bg-surface/50">
              <button onClick={onOpenReceive} className="text-xs font-medium text-brand hover:underline">
                Go to Receive Material →
              </button>
            </li>
          </ul>
        )}

        {activeTab === 'pay' && (
          <ul className="divide-y divide-border">
            {data.outstandingVendors.slice(0, 6).map(({ vendor, balance }) => (
              <li key={vendor.id}>
                <button
                  onClick={() => onOpenStatement(vendor.id)}
                  className="w-full text-left px-4 py-2.5 hover:bg-surface flex items-center justify-between gap-3"
                >
                  <span className="font-medium text-charcoal truncate">{vendor.name}</span>
                  <span className="text-xs font-semibold text-danger shrink-0">{formatCurrency(balance)}</span>
                </button>
              </li>
            ))}
            <li className="px-4 py-2 bg-surface/50">
              <button onClick={onOpenPayments} className="text-xs font-medium text-brand hover:underline">
                Go to Payments →
              </button>
            </li>
          </ul>
        )}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const jobWorks   = useAppStore((s) => s.jobWorks);
  const vendors    = useAppStore((s) => s.vendors);
  const products   = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const dispatches = useAppStore((s) => s.dispatches);
  const receipts   = useAppStore((s) => s.receipts);
  const payments   = useAppStore((s) => s.payments);
  const recentDispatches = useMemo(() => sortByDateDesc(dispatches, (dispatch) => dispatch.date).slice(0, 5), [dispatches]);
  const recentReceipts = useMemo(() => sortByDateDesc(receipts, (receipt) => receipt.date).slice(0, 5), [receipts]);

  // ── Month selector state ──────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(() => monthKey(new Date()));
  const currentMonthKey = monthKey(new Date());
  const isCurrentMonth  = selectedMonth === currentMonthKey;

  // ── Shortcut: press N to open Create New Job Work ────────────────────────
  const navigate = useNavigate();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        navigate('/job-works/create');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  // ── Lookup: variantId → { categoryId, unit } ─────────────────────────────
  const variantToCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; unit: string }>();
    products.forEach((p) =>
      p.variants.forEach((v) => map.set(v.id, { categoryId: p.categoryId, unit: p.unit }))
    );
    return map;
  }, [products]);

  // ── Lookup: categoryId → category name ───────────────────────────────────
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // ── Product-type-wise sent/received for the selected month ───────────────
  const productStats = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; unit: string; sent: number; received: number }>();

    // Sent — from dispatches in this month
    dispatches.forEach((d) => {
      if (!d.date.startsWith(selectedMonth)) return;
      d.items.forEach((item) => {
        const info = variantToCategory.get(item.variantId);
        if (!info) return;
        const { categoryId, unit } = info;
        const name  = categoryMap.get(categoryId) ?? 'Unknown';
        const entry = map.get(categoryId) ?? { categoryId, name, unit, sent: 0, received: 0 };
        entry.sent += item.quantity;
        map.set(categoryId, entry);
      });
    });

    // Received — from receipts in this month
    receipts.forEach((r) => {
      if (!r.date.startsWith(selectedMonth)) return;
      r.items.forEach((item) => {
        const info = variantToCategory.get(item.variantId);
        if (!info) return;
        const { categoryId, unit } = info;
        const name  = categoryMap.get(categoryId) ?? 'Unknown';
        const entry = map.get(categoryId) ?? { categoryId, name, unit, sent: 0, received: 0 };
        entry.received += item.received;
        map.set(categoryId, entry);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.sent - a.sent);
  }, [dispatches, receipts, selectedMonth, variantToCategory, categoryMap]);

  // Grand totals
  const grandSent     = productStats.reduce((s, p) => s + p.sent,     0);
  const grandReceived = productStats.reduce((s, p) => s + p.received, 0);
  const grandPending  = Math.max(0, grandSent - grandReceived);

  // Chart data — truncate product names for X axis
  const chartData = productStats.map((p) => ({
    name:     p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name,
    fullName: p.name,
    Sent:     p.sent,
    Received: p.received,
    Pending:  Math.max(0, p.sent - p.received),
  }));

  // ── KPI values ────────────────────────────────────────────────────────────
  const activeJobs = jobWorks.filter((j) => !['Completed', 'Cancelled', 'Draft'].includes(j.status)).length;
  const overdueJobs = jobWorks.filter((j) => j.status === 'Overdue').length;
  const materialWithVendors = products.reduce(
    (s, p) => s + p.variants.reduce((vs, v) => vs + v.withVendor, 0), 0,
  );
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = dispatches.filter((d) => d.date === today)
    .reduce((s, d) => s + d.items.reduce((is, i) => is + i.quantity, 0), 0);
  const receivedToday = receipts.filter((r) => r.date === today)
    .reduce((s, r) => s + r.items.reduce((is, i) => is + i.received, 0), 0);

  const pendingJobs = jobWorks.filter((j) =>
    ['Partial', 'Sent', 'Processing', 'Overdue'].includes(j.status),
  );

  const statusData = Object.entries(
    jobWorks.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const vendorPending = vendors.map((v) => {
    const jobs    = jobWorks.filter((j) => j.vendorId === v.id);
    const pending = jobs.reduce((s, j) => s + getJobPendingTotal(j), 0);
    return { name: v.name, pending };
  }).filter((v) => v.pending > 0).sort((a, b) => b.pending - a.pending).slice(0, 5);

  // ── Action Needed: what to act on today ───────────────────────────────────
  const actionNeeded = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const isOpen = (s: string) => !['Completed', 'Cancelled', 'Draft'].includes(s);

    // Overdue: past due date and still open
    const overdue = jobWorks
      .filter((j) => isOpen(j.status) && j.expectedReturnDate && j.expectedReturnDate < todayIso)
      .sort((a, b) => a.expectedReturnDate.localeCompare(b.expectedReturnDate));

    // Due soon: due within the next 3 days (inclusive), not yet overdue
    const dueSoon = jobWorks
      .filter((j) => isOpen(j.status) && j.expectedReturnDate >= todayIso && j.expectedReturnDate <= in3Days)
      .sort((a, b) => a.expectedReturnDate.localeCompare(b.expectedReturnDate));

    // Awaiting receipt: material sent out but not fully received back
    const awaitingReceipt = jobWorks.filter((j) => {
      if (!isOpen(j.status)) return false;
      const pending = j.items.reduce(
        (s, i) => s + Math.max(0, i.sentQuantity - i.receivedQuantity - i.rejectedQuantity - i.lossQuantity),
        0,
      );
      const sent = j.items.reduce((s, i) => s + i.sentQuantity, 0);
      return sent > 0 && pending > 0;
    });

    // Vendors with an outstanding balance (all-time), largest first
    const outstandingVendors = vendors
      .map((v) => ({ vendor: v, balance: buildVendorStatement(v.id, jobWorks, payments, '').balance }))
      .filter((x) => x.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const totalOutstanding = outstandingVendors.reduce((s, x) => s + x.balance, 0);

    return { todayIso, overdue, dueSoon, awaitingReceipt, outstandingVendors, totalOutstanding };
  }, [jobWorks, vendors, payments]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-charcoal">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-700 font-medium">
            <kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[11px]">N</kbd>
            New Job Card
          </span>
          <Link
            to="/job-works/create"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            <Plus size={16} />
            Create New Job Work
          </Link>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <KPICard label="Active Job Works"       value={activeJobs}                        color="brand"   />
        <KPICard label="Material With Vendors"  value={formatQty(materialWithVendors, 'Pic')} color="info" />
        <KPICard label="Overdue Jobs"           value={overdueJobs}                       color="danger"  />
        <KPICard label="Sent Today"             value={formatQty(sentToday, 'Pic')}       color="info"    />
        <KPICard label="Received Today"         value={formatQty(receivedToday, 'Pic')}   color="success" />
      </div>

      {/* ── Action Needed ──────────────────────────────────────────────────── */}
      <ActionNeededPanel
        data={actionNeeded}
        vendors={vendors}
        onOpenJob={(jobId) => navigate(`/job-works/${jobId}`)}
        onOpenReceive={() => navigate('/receive/new')}
        onOpenPayments={() => navigate('/payments')}
        onOpenStatement={(vendorId) => navigate(`/vendors/${vendorId}/statement`)}
      />

      {/* ── Pending Job Work table ─────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader title="Pending Job Work" subtitle={`${pendingJobs.length} active jobs`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Issue Date','Job Number','Vendor','Product','Variant','Sent','Received','Pending','Due Date','Status','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingJobs.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-muted">No pending jobs.</td></tr>
              )}
              {pendingJobs.map((job) => {
                const vendor    = vendors.find((v) => v.id === job.vendorId);
                const firstItem = job.items[0];
                const product   = firstItem ? products.find((p) => p.id === firstItem.productId) : null;
                const variant   = product?.variants.find((v) => v.id === firstItem?.variantId);
                return (
                  <tr key={job.id} className={`border-b border-border hover:bg-surface/50 ${priorityRowClass(job.priority)}`}>
                    <td className="px-4 py-3">{formatDate(job.issueDate)}</td>
                    <td className="px-4 py-3 font-medium text-brand">{job.jobNumber}</td>
                    <td className="px-4 py-3">{vendor?.name}</td>
                    <td className="px-4 py-3">{product?.name}{job.items.length > 1 ? ` +${job.items.length - 1}` : ''}</td>
                    <td className="px-4 py-3">{variant?.name ?? '—'}</td>
                    <td className="px-4 py-3">{formatQty(getJobSentTotal(job),      product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3">{formatQty(getJobReceivedTotal(job),  product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3 font-medium">{formatQty(getJobPendingTotal(job), product?.unit ?? 'Unit')}</td>
                    <td className="px-4 py-3">{formatDate(job.expectedReturnDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/job-works/${job.id}`}       className="text-muted hover:text-brand transition-colors" title="View"><Eye size={16} /></Link>
                        <Link to={`/job-works/${job.id}/edit`}  className="text-muted hover:text-brand transition-colors" title="Edit"><Pencil size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Product-wise Monthly Sent vs Received ──────────────────────────── */}
      <Card className="mb-6">
        {/* Header row with month navigator */}
        <div className="px-6 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-border">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-charcoal">Monthly Sent vs Received — Product Type Wise</h3>
            <p className="text-xs text-muted mt-0.5">
              Quantities dispatched and received per product type for the selected month
            </p>
          </div>

          {/* Month navigator */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedMonth(prevMonth(selectedMonth))}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-charcoal hover:bg-surface transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-charcoal min-w-[140px] text-center">
              {monthLabel(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth(nextMonth(selectedMonth))}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-lg border border-border text-muted hover:text-charcoal hover:bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next month"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Grand-total summary strip */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-6 py-3 text-center">
            <p className="text-xs text-muted uppercase tracking-wide">Total Sent</p>
            <p className="text-xl font-bold text-brand mt-0.5">{grandSent.toLocaleString('en-IN')}</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-xs text-muted uppercase tracking-wide">Total Received</p>
            <p className="text-xl font-bold text-green-600 mt-0.5">{grandReceived.toLocaleString('en-IN')}</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-xs text-muted uppercase tracking-wide">Total Pending</p>
            <p className={`text-xl font-bold mt-0.5 ${grandPending > 0 ? 'text-orange-600' : 'text-muted'}`}>
              {grandPending.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted">
            No dispatch or receipt activity recorded for {monthLabel(selectedMonth)}.
          </div>
        ) : (
          <>
            {/* ── Bar chart ── */}
            <div className="px-4 pt-4 pb-2" style={{ height: Math.max(240, chartData.length * 52 + 60) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12, fill: '#374151' }}
                  />
                  <Tooltip content={<ProductChartTooltip />} />
                  <Legend
                    iconType="square"
                    iconSize={10}
                    formatter={(val) => <span className="text-xs text-charcoal">{val}</span>}
                  />
                  <Bar dataKey="Sent"     fill="#c41e3a" radius={[0, 4, 4, 0]} name="Sent"     />
                  <Bar dataKey="Received" fill="#16a34a" radius={[0, 4, 4, 0]} name="Received" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Product-wise breakdown table ── */}
            <div className="px-6 pb-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Product Type Breakdown
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface text-left text-xs font-semibold text-muted uppercase tracking-wide">
                      <th className="px-3 py-2">Product Type</th>
                      <th className="px-3 py-2 text-right">Sent</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Pending</th>
                      <th className="px-3 py-2 text-right">% of Total Sent</th>
                      <th className="px-3 py-2 text-right">Recovery %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productStats.map((p) => {
                      const pending     = Math.max(0, p.sent - p.received);
                      const pctOfTotal  = grandSent > 0 ? (p.sent / grandSent) * 100 : 0;
                      const recovery    = p.sent > 0 ? (p.received / p.sent) * 100 : 0;
                      return (
                        <tr key={p.categoryId} className="hover:bg-surface/50">
                          <td className="px-3 py-2.5 font-medium text-charcoal">{p.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-brand font-semibold">
                            {p.sent.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-green-700 font-semibold">
                            {p.received.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={pending > 0 ? 'text-orange-600 font-semibold' : 'text-muted'}>
                              {pending.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-brand"
                                  style={{ width: `${Math.min(100, pctOfTotal)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted tabular-nums w-10 text-right">
                                {pctOfTotal.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${recovery >= 100 ? 'bg-green-500' : recovery >= 70 ? 'bg-green-400' : 'bg-orange-400'}`}
                                  style={{ width: `${Math.min(100, recovery)}%` }}
                                />
                              </div>
                              <span className={`text-xs tabular-nums w-10 text-right font-semibold ${recovery >= 100 ? 'text-green-600' : recovery >= 70 ? 'text-green-600' : 'text-orange-600'}`}>
                                {recovery.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr className="border-t-2 border-brand/30 bg-brand/5 font-bold">
                      <td className="px-3 py-2.5 text-xs uppercase tracking-wide text-muted">
                        Total ({productStats.length} product type{productStats.length !== 1 ? 's' : ''})
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-brand">
                        {grandSent.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-green-700">
                        {grandReceived.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-orange-600">
                        {grandPending.toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-right text-muted text-xs">100%</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-bold ${grandSent > 0 && grandReceived / grandSent >= 0.7 ? 'text-green-600' : 'text-orange-600'}`}>
                          {grandSent > 0 ? ((grandReceived / grandSent) * 100).toFixed(1) : '0.0'}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Status pie + bottom cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader title="Job Work Status" />
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}>
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
          <CardHeader title="Vendor-wise Material Pending" />
          {vendorPending.length === 0 ? (
            <p className="px-6 py-10 text-sm text-muted text-center">No pending material across vendors.</p>
          ) : (
            <div className="divide-y divide-border">
              {vendorPending.map((v) => (
                <div key={v.name} className="px-4 py-3 flex justify-between text-sm">
                  <p className="font-medium">{v.name}</p>
                  <p className="text-orange-600 font-semibold">{v.pending.toLocaleString('en-IN')} Pic</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Recent Dispatches" />
          <div className="divide-y divide-border">
            {dispatches.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">No dispatches recorded yet.</p>
            )}
            {recentDispatches.map((d) => (
              <div key={d.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{d.challanNumber}</p>
                  <p className="text-xs text-muted">{formatDate(d.date)}</p>
                </div>
                <p className="text-muted">{d.vehicleNumber || '—'}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Receipts" />
          <div className="divide-y divide-border">
            {receipts.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">No receipts recorded yet.</p>
            )}
            {recentReceipts.map((r) => {
              const job = jobWorks.find((j) => j.id === r.jobWorkId);
              return (
                <div key={r.id} className="px-4 py-3 flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{job?.jobNumber} {job && <PriorityBadge priority={job.priority} />}</p>
                    <p className="text-xs text-muted">{formatDate(r.date)}</p>
                  </div>
                  <p className="text-muted">{r.receivedBy}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}