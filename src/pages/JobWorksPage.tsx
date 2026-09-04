import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/Card';
import { ConfirmDialog, BlockedDeleteDialog } from '../components/ui/Modal';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  formatDate,
  formatQty,
  getJobPendingTotal,
  getJobReceivedTotal,
  getJobSentTotal,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import type { JobStatus } from '../types';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';

// Jobs in these statuses can be edited or deleted
const EDITABLE_STATUSES: JobStatus[] = ['Draft', 'Sent'];

export function JobWorksPage() {
  const navigate     = useNavigate();
  const jobWorks     = useAppStore((s) => s.jobWorks);
  const vendors      = useAppStore((s) => s.vendors);
  const products     = useAppStore((s) => s.products);
  const deleteJobWork = useAppStore((s) => s.deleteJobWork);
  const checkConstraints = useAppStore((s) => s.checkJobWorkDeleteConstraints);

  const [searchParams]  = useSearchParams();
  const statusFilter    = searchParams.get('status') as JobStatus | null;
  const [search, setSearch] = useState('');

  // N → Create new job work
  useNewItemShortcut(() => navigate('/job-works/create'));

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; jobNumber: string; cascadeWarnings: string[] } | null>(null);

  const filtered = useMemo(() => {
    return jobWorks.filter((j) => {
      if (statusFilter && j.status !== statusFilter) return false;
      if (search && !j.jobNumber.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [jobWorks, statusFilter, search]);

  const title = statusFilter ? `${statusFilter} Job Works` : 'All Job Works';

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={`${filtered.length} job works`}
        action={
          <Link to="/job-works/create">
            <Button><Plus size={16} /> Create Job Work</Button>
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search job number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-brand"
          />
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface sticky top-0">
                {['Job Number', 'Vendor', 'Process', 'Sent', 'Received', 'Pending', 'Issue Date', 'Due Date', 'Priority', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((job) => {
                const vendor    = vendors.find((v) => v.id === job.vendorId);
                const unit      = products.find((p) => p.id === job.items[0]?.productId)?.unit ?? 'Pic';
                const canEdit   = EDITABLE_STATUSES.includes(job.status);
                return (
                  <tr key={job.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link to={`/job-works/${job.id}`} className="font-medium text-brand hover:underline">{job.jobNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{vendor?.name}</td>
                    <td className="px-4 py-3">{job.process}</td>
                    <td className="px-4 py-3">{formatQty(getJobSentTotal(job), unit)}</td>
                    <td className="px-4 py-3">{formatQty(getJobReceivedTotal(job), unit)}</td>
                    <td className="px-4 py-3">{formatQty(getJobPendingTotal(job), unit)}</td>
                    <td className="px-4 py-3">{formatDate(job.issueDate)}</td>
                    <td className="px-4 py-3">{formatDate(job.expectedReturnDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${job.priority === 'Urgent' ? 'text-red-600' : job.priority === 'High' ? 'text-orange-600' : 'text-muted'}`}>
                        {job.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            title="Edit job work"
                            onClick={() => navigate(`/job-works/${job.id}/edit`)}
                            className="p-1.5 rounded-lg text-muted hover:text-brand hover:bg-brand/10 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            title="Delete job work"
                            onClick={() => {
                              const reasons = checkConstraints(job.id);
                              // With cascading deletes, always allow deletion — warn if related data will also be removed
                              setDeleteTarget({ id: job.id, jobNumber: job.jobNumber, cascadeWarnings: reasons });
                            }}
                            className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null && deleteTarget.cascadeWarnings.length === 0}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteJobWork(deleteTarget.id);
        }}
        title="Delete Job Work"
        message={`Delete ${deleteTarget?.jobNumber ?? 'this job work'}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      <BlockedDeleteDialog
        open={deleteTarget !== null && (deleteTarget?.cascadeWarnings.length ?? 0) > 0}
        onClose={() => setDeleteTarget(null)}
        title="Cannot Delete Job Work"
        entityName={deleteTarget?.jobNumber ?? ''}
        reasons={deleteTarget?.cascadeWarnings ?? []}
      />
    </div>
  );
}
