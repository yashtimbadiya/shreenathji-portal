import type { JobStatus } from '../../types';

const statusStyles: Record<JobStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700 border-gray-200',
  Sent: 'bg-blue-50 text-blue-700 border-blue-200',
  Processing: 'bg-purple-50 text-purple-700 border-purple-200',
  Partial: 'bg-orange-50 text-orange-700 border-orange-200',
  Completed: 'bg-green-50 text-green-700 border-green-200',
  Overdue: 'bg-red-50 text-red-700 border-red-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200 line-through',
};

export function StatusBadge({ status }: { status: JobStatus | string }) {
  const style = statusStyles[status as JobStatus] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
