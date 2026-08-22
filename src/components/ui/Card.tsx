import { type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border shadow-sm ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div>
        <h3 className="text-base font-semibold text-charcoal">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function KPICard({
  label,
  value,
  sub,
  color = 'brand',
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const colors = {
    brand: 'border-l-brand',
    success: 'border-l-success',
    warning: 'border-l-warning',
    danger: 'border-l-danger',
    info: 'border-l-info',
  };
  return (
    <Card className={`border-l-4 ${colors[color]} p-5`}>
      <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-charcoal mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </Card>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
        <span className="text-2xl">📋</span>
      </div>
      <h3 className="text-base font-semibold text-charcoal">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; path?: string }[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>/</span>}
          <span className={i === items.length - 1 ? 'text-charcoal font-medium' : ''}>{item.label}</span>
        </span>
      ))}
    </nav>
  );
}
