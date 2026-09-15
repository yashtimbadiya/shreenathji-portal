import type { JobWork } from '../../types';

export function priorityRowClass(priority: JobWork['priority']): string {
  if (priority === 'Urgent') return 'bg-red-50/70 border-l-4 border-l-red-500';
  if (priority === 'High') return 'bg-yellow-50/80 border-l-4 border-l-yellow-400';
  return '';
}

export function PriorityBadge({ priority }: { priority: JobWork['priority'] }) {
  const style = priority === 'Urgent'
    ? 'bg-red-100 text-red-800 border-red-300'
    : priority === 'High'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${style}`}>
      {priority}
    </span>
  );
}
