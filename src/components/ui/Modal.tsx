import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmLabel = 'Confirm',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Optional list of warning lines rendered below the main message */
  details?: string[];
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">{message}</p>
        {details && details.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1.5">
            <p className="text-xs font-semibold text-amber-700">The following related data will also be deleted:</p>
            <ul className="space-y-1">
              {details.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * BlockedDeleteDialog — shown when a delete is blocked because the entity
 * is still referenced by other data. Explains why and lists what's in the way.
 */
export function BlockedDeleteDialog({
  open,
  onClose,
  title,
  entityName,
  reasons,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  entityName: string;
  /** Each reason is one sentence explaining why deletion is blocked */
  reasons: string[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <Button variant="outline" onClick={onClose}>
          OK
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <span className="text-red-500 text-base leading-none mt-0.5 shrink-0">⛔</span>
          <p className="text-sm font-medium text-red-700">
            <strong>"{entityName}"</strong> cannot be deleted because it is still in use.
          </p>
        </div>
        <ul className="space-y-1.5">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted">
              <span className="text-red-400 shrink-0 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted pt-1 border-t border-border">
          Remove or reassign the above references first, then try deleting again.
        </p>
      </div>
    </Modal>
  );
}
