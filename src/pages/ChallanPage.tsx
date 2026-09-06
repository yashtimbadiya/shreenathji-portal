import { Download, Pencil, Printer, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { buildChallanPrintData, CHALLAN_PRINT_CSS, ChallanPrintPreview, printChallan } from '../components/ui/ChallanPrint';
import { Breadcrumb, Card, PageHeader } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';

export function ChallansPage() {
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks = useAppStore((s) => s.jobWorks);

  return (
    <div>
      <PageHeader title="All Challans" subtitle={`${dispatches.length} challans`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Challan Number', 'Job Work', 'Date', 'Vehicle', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => {
                const job = jobWorks.find((j) => j.id === d.jobWorkId);
                return (
                  <tr key={d.id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <Link to={`/challans/${d.id}`} className="font-medium text-brand hover:underline">{d.challanNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{job?.jobNumber}</td>
                    <td className="px-4 py-3">{formatDate(d.date)}</td>
                    <td className="px-4 py-3">{d.vehicleNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <Link to={`/challans/${d.id}`} className="text-xs text-brand hover:underline">View / Print</Link>
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

export function ChallanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks   = useAppStore((s) => s.jobWorks);
  const vendors    = useAppStore((s) => s.vendors);
  const products   = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const settings   = useAppStore((s) => s.settings);

  const dispatch = dispatches.find((d) => d.id === id);
  if (!dispatch) return <div className="text-center py-16 text-muted">Challan not found</div>;

  const job    = jobWorks.find((j) => j.id === dispatch.jobWorkId);
  const vendor = vendors.find((v) => v.id === job?.vendorId) ?? null;

  const printData = buildChallanPrintData(dispatch, job, vendor, products, categories, settings);

  return (
    <div>
      {/* ── Print CSS: A5 landscape, zero margins, show only #challan-print-area ── */}
      <style>{CHALLAN_PRINT_CSS}</style>

      {/* ── Screen action bar (hidden on print via .no-print) ── */}
      <div className="no-print mb-6 flex items-center gap-3 flex-wrap">
        <BackButton />
        <div className="flex gap-2 ml-auto flex-wrap">
          <Button variant="outline" onClick={() => navigate(`/challans/${dispatch.id}/edit`)}>
            <Pencil size={16} /> Edit
          </Button>
          <Button variant="outline" onClick={() => printChallan(printData)}>
            <Printer size={16} /> Print A5
          </Button>
          <Button variant="outline">
            <Download size={16} /> Download PDF
          </Button>
          <Button variant="outline">
            <Share2 size={16} /> Share
          </Button>
        </div>
      </div>

      {/* ── Page label (screen only) ── */}
      <div className="no-print flex items-center justify-between bg-gray-700 rounded-t-xl px-4 py-1.5 text-xs text-gray-300 max-w-[860px] mx-auto">
        <span className="font-medium">A5 Landscape — Print Preview</span>
        <span className="font-mono text-gray-400">{dispatch.challanNumber}</span>
      </div>

      {/* ── A5 preview card — this is also the print target ── */}
      <div className="max-w-[860px] mx-auto shadow-2xl ring-1 ring-black/10 rounded-b-xl bg-white">
        <ChallanPrintPreview data={printData} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Challan Page
// ─────────────────────────────────────────────────────────────────────────────

export function EditChallanPage() {
  const { id }            = useParams<{ id: string }>();
  const navigate          = useNavigate();
  const dispatches        = useAppStore((s) => s.dispatches);
  const jobWorks          = useAppStore((s) => s.jobWorks);
  const updateDispatch    = useAppStore((s) => s.updateDispatch);

  const dispatch = dispatches.find((d) => d.id === id);
  const job      = jobWorks.find((j) => j.id === dispatch?.jobWorkId);

  // ── Local form state ──────────────────────────────────────────────────────
  const [date,          setDate]          = useState(dispatch?.date ?? '');
  const [transport,     setTransport]     = useState(dispatch?.transport ?? 'Own Vehicle');
  const [vehicleNumber, setVehicleNumber] = useState(dispatch?.vehicleNumber ?? '');
  const [driver,        setDriver]        = useState(dispatch?.driver ?? '');
  const [remarks,       setRemarks]       = useState(dispatch?.remarks ?? '');

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!date;

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) submitRef.current?.click();
        else submitRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave]);

  // ESC → back to challan detail
  useEscapeBack(() => navigate(dispatch ? `/challans/${dispatch.id}` : '/challans'));

  if (!dispatch) {
    return (
      <div className="text-center py-16 text-muted">
        Challan not found.{' '}
        <button onClick={() => navigate('/challans')} className="text-brand hover:underline">Back to list</button>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateDispatch(dispatch.id, {
      date,
      transport,
      vehicleNumber,
      driver,
      remarks: remarks || undefined,
    });
    navigate(`/challans/${dispatch.id}`);
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Challans', path: '/challans' },
          { label: dispatch.challanNumber, path: `/challans/${dispatch.id}` },
          { label: 'Edit' },
        ]}
      />
      <PageHeader
        title={`Edit — ${dispatch.challanNumber}`}
        subtitle="Update transport, vehicle, and dispatch details."
      />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Changes
        </span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> — cancel</span>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 mb-4">
          {/* Read-only summary */}
          <div className="mb-5 rounded-lg bg-surface border border-border px-4 py-3 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted mb-0.5 uppercase font-semibold tracking-wide">Challan No.</p>
              <p className="font-semibold text-charcoal">{dispatch.challanNumber}</p>
            </div>
            {job && (
              <div>
                <p className="text-xs text-muted mb-0.5 uppercase font-semibold tracking-wide">Job Work</p>
                <p className="font-semibold text-charcoal">{job.jobNumber}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted mb-0.5 uppercase font-semibold tracking-wide">Items</p>
              <p className="font-semibold text-charcoal">{dispatch.items.length} line(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Dispatch Date *"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              tabIndex={1}
            />

            <Input
              label="Vehicle Number"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. GJ05AX1234"
              tabIndex={2}
            />

            <Input
              label="Driver Name"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              placeholder="Driver full name"
              tabIndex={3}
            />

            <Select
              label="Transport"
              value={transport}
              tabIndex={4}
              onChange={(e) => setTransport(e.target.value)}
              options={[
                { value: 'Own Vehicle',   label: 'Own Vehicle'   },
                { value: 'Courier',       label: 'Courier'       },
                { value: 'Hand Delivery', label: 'Hand Delivery' },
                { value: 'Third Party',   label: 'Third Party'   },
              ]}
            />

            <div className="md:col-span-2">
              <Textarea
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              ref={submitRef}
              type="submit"
              disabled={!canSave}
            >
              Save Changes
              {canSave && (
                <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/challans/${dispatch.id}`)}
            >
              Cancel
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
