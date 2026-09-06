import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ConfirmDialog, BlockedDeleteDialog } from '../components/ui/Modal';
import {
  formatCurrency,
  getJobPendingTotal,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import type { Vendor } from '../types';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';

// â”€â”€â”€ Blank form state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const blankForm = {
  name: '', contactPerson: '', mobile: '', gstNumber: '', specialization: '',
};

type VendorFormState = typeof blankForm;

// â”€â”€â”€ Shared Add / Edit inline form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function VendorForm({
  initial,
  onSave,
  onCancel,
  saveLabel = 'Save Vendor',
}: {
  initial: VendorFormState;
  onSave: (data: VendorFormState) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [form, setForm] = useState(initial);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const canSave = !!form.name && !!form.contactPerson;
  const canSaveRef = useRef(canSave);
  canSaveRef.current = canSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSaveRef.current) submitBtnRef.current?.click();
        else submitBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const field = (key: keyof VendorFormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Card className="mb-6 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">âŒ¨ Keyboard</span>
        <span className="text-blue-500">Â·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> â€” next field</span>
        <span className="text-blue-500">Â·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> â€” {saveLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-form>
        <Input label="Vendor Name *"     autoFocus  placeholder="Vendor Name"         {...field('name')} />
        <Input label="Contact Person *"             placeholder="Contact Person"       {...field('contactPerson')} />
        <Input label="Mobile" inputMode="tel" placeholder="Mobile Number (optional)"  {...field('mobile')} />
        <Input label="GST Number"                   placeholder="GST Number (optional)" {...field('gstNumber')} />
        <Input label="Specialization"               placeholder="e.g. Printing, Packaging" {...field('specialization')} />
        <div className="flex items-end gap-2">
          <button
            ref={submitBtnRef}
            type="submit"
            disabled={!canSave}
            onClick={() => canSave && onSave(form)}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
              ${canSave
                ? 'bg-brand text-white hover:bg-brand/90'
                : 'bg-surface text-muted border border-border cursor-not-allowed'}`}
          >
            {saveLabel}
            {canSave && <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+â†µ</kbd>}
          </button>
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function VendorsPage() {
  const vendors      = useAppStore((s) => s.vendors);
  const jobWorks     = useAppStore((s) => s.jobWorks);
  const payments     = useAppStore((s) => s.payments);
  const addVendor    = useAppStore((s) => s.addVendor);
  const updateVendor = useAppStore((s) => s.updateVendor);
  const deleteVendor = useAppStore((s) => s.deleteVendor);
  const checkConstraints = useAppStore((s) => s.checkVendorDeleteConstraints);

  const [mode, setMode]             = useState<'idle' | 'add' | { edit: Vendor }>('idle');
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleteTargetWarnings, setDeleteTargetWarnings] = useState<string[]>([]);

  // N â†’ open Add Vendor form
  useNewItemShortcut(() => setMode((m) => (m === 'add' ? 'idle' : 'add')));

  const handleAdd = (data: VendorFormState) => {
    addVendor({ ...data, status: 'Active' });
    setMode('idle');
  };

  const handleEdit = (vendor: Vendor, data: VendorFormState) => {
    updateVendor(vendor.id, data);
    setMode('idle');
  };

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendors`}
        action={
          <Button onClick={() => setMode((m) => (m === 'add' ? 'idle' : 'add'))}>
            <Plus size={16} /> Add Vendor
          </Button>
        }
      />

      {/* â”€â”€ Add form â”€â”€ */}
      {mode === 'add' && (
        <VendorForm
          initial={blankForm}
          onSave={handleAdd}
          onCancel={() => setMode('idle')}
          saveLabel="Add Vendor"
        />
      )}

      {/* â”€â”€ Edit form â”€â”€ */}
      {typeof mode === 'object' && 'edit' in mode && (
        <VendorForm
          initial={{
            name:           mode.edit.name,
            contactPerson:  mode.edit.contactPerson,
            mobile:         mode.edit.mobile,
            gstNumber:      mode.edit.gstNumber ?? '',
            specialization: mode.edit.specialization ?? '',
          }}
          onSave={(data) => handleEdit(mode.edit, data)}
          onCancel={() => setMode('idle')}
          saveLabel="Save Changes"
        />
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Vendor', 'Contact', 'Mobile', 'GST', 'Specialization', 'Active Jobs', 'Material Pending', 'Outstanding', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                    No vendors yet. Click "Add Vendor" to create one.
                  </td>
                </tr>
              )}
              {vendors.map((v) => {
                const jobs        = jobWorks.filter((j) => j.vendorId === v.id && !['Completed', 'Cancelled'].includes(j.status));
                const pending     = jobWorks.filter((j) => j.vendorId === v.id).reduce((s, j) => s + getJobPendingTotal(j), 0);
                const outstanding = payments.filter((p) => p.vendorId === v.id).reduce((s, p) => s + (p.amount - p.paid), 0);
                const isEditing   = typeof mode === 'object' && 'edit' in mode && mode.edit.id === v.id;
                return (
                  <tr key={v.id} className={`border-b border-border hover:bg-surface/50 ${isEditing ? 'bg-brand/5' : ''}`}>
                    <td className="px-4 py-3">
                      <Link to={`/vendors/${v.id}`} className="font-medium text-brand hover:underline">{v.name}</Link>
                    </td>
                    <td className="px-4 py-3">{v.contactPerson}</td>
                    <td className="px-4 py-3">{v.mobile}</td>
                    <td className="px-4 py-3 font-mono text-xs">{v.gstNumber}</td>
                    <td className="px-4 py-3">{v.specialization}</td>
                    <td className="px-4 py-3">{jobs.length}</td>
                    <td className="px-4 py-3">{pending.toLocaleString()} Pic</td>
                    <td className="px-4 py-3">{formatCurrency(outstanding)}</td>
                    <td className="px-4 py-3"><ActiveBadge active={v.status === 'Active'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/vendors/${v.id}`} className="text-xs text-brand hover:underline">View</Link>
                        <button
                          type="button"
                          title="Edit vendor"
                          onClick={() => setMode({ edit: v })}
                          className="p-1.5 rounded-lg text-muted hover:text-brand hover:bg-brand/10 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          title="Delete vendor"
                          onClick={() => {
                            const reasons = checkConstraints(v.id);
                            setDeleteTargetWarnings(reasons);
                            setDeleteTarget(v);
                          }}
                          className="p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null && deleteTargetWarnings.length === 0}
        onClose={() => { setDeleteTarget(null); setDeleteTargetWarnings([]); }}
        onConfirm={() => { if (deleteTarget) deleteVendor(deleteTarget.id); }}
        title="Delete Vendor"
        message={`Delete vendor "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      <BlockedDeleteDialog
        open={deleteTarget !== null && deleteTargetWarnings.length > 0}
        onClose={() => { setDeleteTarget(null); setDeleteTargetWarnings([]); }}
        title="Cannot Delete Vendor"
        entityName={deleteTarget?.name ?? ''}
        reasons={deleteTargetWarnings}
      />
    </div>
  );
}

