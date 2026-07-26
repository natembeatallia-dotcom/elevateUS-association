import { type ReactNode } from 'react';

export { Modal, ConfirmDialog } from './Modal';

export function PageHeader({
  title, subtitle, actions,
}: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children, className = '', hover = false,
}: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{children}</h2>
  );
}

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-12 text-center">
      {icon && <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-400 shadow-card">{icon}</div>}
      <div>
        <p className="text-sm font-semibold text-ink-700">{title}</p>
        {description && <p className="mt-1 text-xs text-ink-500">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string }> = {
    Paid: { cls: 'badge-success' },
    Active: { cls: 'badge-success' },
    Confirmed: { cls: 'badge-success' },
    Approved: { cls: 'badge-success' },
    Disbursed: { cls: 'badge-info' },
    Partial: { cls: 'badge-warning' },
    Unpaid: { cls: 'badge-danger' },
    Overdue: { cls: 'badge-danger' },
    Defaulted: { cls: 'badge-danger' },
    'Carried Forward': { cls: 'badge-info' },
    Rejected: { cls: 'badge-danger' },
    Draft: { cls: 'badge-neutral' },
    Submitted: { cls: 'badge-info' },
    'Under Review': { cls: 'badge-warning' },
    Invited: { cls: 'badge-neutral' },
    Expired: { cls: 'badge-danger' },
    Sent: { cls: 'badge-success' },
    Logged: { cls: 'badge-warning' },
    Delivered: { cls: 'badge-success' },
    Failed: { cls: 'badge-danger' },
    Accrued: { cls: 'badge-info' },
    'High Risk': { cls: 'badge-danger' },
    Suspended: { cls: 'badge-warning' },
    Inactive: { cls: 'badge-neutral' },
  };
  const cls = map[status]?.cls ?? 'badge-neutral';
  return <span className={cls}>{status}</span>;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const palette = [
    'bg-brand-100 text-brand-700',
    'bg-success-100 text-success-700',
    'bg-warning-100 text-warning-700',
    'bg-danger-100 text-danger-700',
    'bg-ink-200 text-ink-700',
  ];
  const idx = name.charCodeAt(0) % palette.length;
  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold ${palette[idx]}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}
