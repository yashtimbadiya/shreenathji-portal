import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import {
  formatCurrency,
  getJobPendingTotal,
} from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

export function VendorsPage() {
  const vendors   = useAppStore((s) => s.vendors);
  const jobWorks  = useAppStore((s) => s.jobWorks);
  const payments  = useAppStore((s) => s.payments);
  const addVendor = useAppStore((s) => s.addVendor);

  const [showVendorForm,  setShowVendorForm]  = useState(false);
  const [vendorName,      setVendorName]      = useState('');
  const [contactPerson,   setContactPerson]   = useState('');
  const [mobile,          setMobile]          = useState('');
  const [gstNumber,       setGstNumber]       = useState('');
  const [specialization,  setSpecialization]  = useState('');

  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const canSaveRef   = useRef(false);

  const canSave = !!vendorName && !!contactPerson && !!mobile;
  canSaveRef.current = canSave;

  // Ctrl+Enter → submit (only while form is open); reads canSaveRef to avoid stale closure
  useEffect(() => {
    if (!showVendorForm) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSaveRef.current) submitBtnRef.current?.click();
        else submitBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showVendorForm]); // only re-register when form open state changes

  const handleAddVendor = () => {
    if (!canSave) return;
    addVendor({
      name:           vendorName,
      contactPerson,
      mobile,
      gstNumber,
      specialization,
      status: 'Active',
    });
    // Reset fields and close form
    setVendorName('');
    setContactPerson('');
    setMobile('');
    setGstNumber('');
    setSpecialization('');
    setShowVendorForm(false);
  };

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} vendors`}
        action={
          <Button onClick={() => setShowVendorForm((open) => !open)}>
            <Plus size={16} /> Add Vendor
          </Button>
        }
      />

      {showVendorForm && (
        <Card className="mb-6 p-6">
          {/* Keyboard hint */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
            <span className="font-semibold">⌨ Keyboard</span>
            <span className="text-blue-500">·</span>
            <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
            <span className="text-blue-500">·</span>
            <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Shift+Enter</kbd> — previous field</span>
            <span className="text-blue-500">·</span>
            <span className="font-semibold text-blue-800">
              <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Vendor
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2" data-form>
            <Input
              label="Vendor Name *"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor Name"
              autoFocus
            />
            <Input
              label="Contact Person *"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Contact Person"
            />
            <Input
              label="Mobile *"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Mobile Number"
              inputMode="tel"
            />
            <Input
              label="GST Number"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="GST Number (optional)"
            />
            <Input
              label="Specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. Printing, Packaging"
            />
            <div className="flex items-end gap-2">
              <button
                ref={submitBtnRef}
                type="submit"
                disabled={!canSave}
                onClick={handleAddVendor}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
                  ${canSave
                    ? 'bg-brand text-white hover:bg-brand/90'
                    : 'bg-surface text-muted border border-border cursor-not-allowed'}`}
              >
                Add Vendor
                {canSave && (
                  <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                )}
              </button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowVendorForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
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
              {vendors.map((v) => {
                const jobs        = jobWorks.filter((j) => j.vendorId === v.id && !['Completed', 'Cancelled'].includes(j.status));
                const pending     = jobWorks.filter((j) => j.vendorId === v.id).reduce((s, j) => s + getJobPendingTotal(j), 0);
                const outstanding = payments.filter((p) => p.vendorId === v.id).reduce((s, p) => s + (p.amount - p.paid), 0);
                return (
                  <tr key={v.id} className="border-b border-border hover:bg-surface/50">
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
                      <Link to={`/vendors/${v.id}`} className="text-xs text-brand hover:underline">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
