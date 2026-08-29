import { ChevronRight, Printer, Plus, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Breadcrumb, Card, PageHeader } from '../components/ui/Card';
import { focusNextInForm, Input, SearchableSelect, Select } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';

// ─── Session-storage keys (survive round-trip to Add Reference / Category) ───
const DRAFT_KEY  = 'shjw:create-job-draft-v2';
const SCROLL_KEY = 'shjw:create-job-scroll-v2';

interface LineItem {
  productId: string;
  variantId: string;
  quantity: number;
  rate: number;
  weight?: number;
  /** The reference number this item came from (for display grouping) */
  refNumber?: string;
}

interface DraftState {
  vendorId: string;
  process: string;
  issueDate: string;
  expectedDate: string;
  priority: 'Normal' | 'High' | 'Urgent';
  selectedRefId: string;
  draftRates: Record<string, string>;
  draftQtys: Record<string, string>;
  draftWeights: Record<string, string>;
  draftVariants: Record<string, string>;
  lineItems: LineItem[];
}

function loadDraft(): DraftState | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch { return null; }
}

function formatUnit(unit: string) {
  return /meter/i.test(unit) ? 'Pic' : unit;
}
function formatCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Inline challan print dialog ─────────────────────────────────────────────
// Renders a confirmation popup with the full challan content embedded.
// Clicking "Print" calls window.print() — the challan is shown via @media print
// while the dialog chrome is hidden, giving a clean A5 printout.

function PrintChallanDialog({
  challanId,
  jobId,
  onClose,
}: {
  challanId: string;
  jobId: string;
  onClose: () => void;
}) {
  const navigate    = useNavigate();
  const dispatches  = useAppStore((s) => s.dispatches);
  const jobWorks    = useAppStore((s) => s.jobWorks);
  const vendors     = useAppStore((s) => s.vendors);
  const products    = useAppStore((s) => s.products);
  const categories  = useAppStore((s) => s.categories);
  const settings    = useAppStore((s) => s.settings);

  const dispatch = dispatches.find((d) => d.id === challanId);
  const job      = jobWorks.find((j) => j.id === jobId);
  const vendor   = vendors.find((v) => v.id === job?.vendorId) ?? null;

  const items = (dispatch?.items ?? []).map((di) => {
    let jobItem = job?.items.find((ji) => di.jobWorkItemId && di.jobWorkItemId === ji.id);
    if (!jobItem) jobItem = job?.items.find((ji) => ji.variantId === di.variantId);
    const product = products.find((p) => p.id === jobItem?.productId)
      ?? products.find((p) => p.variants.some((v) => v.id === di.variantId));
    const rate = jobItem?.rate ?? 0;
    return { product, quantity: di.quantity, weight: di.weight, rate, amount: di.quantity * rate };
  });

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const totalPieces = items.reduce((s, i) => s + i.quantity, 0);
  const totalWeight = items.some((i) => i.weight != null)
    ? items.reduce((s, i) => s + (i.weight ?? 0), 0)
    : null;

  const handlePrint = () => {
    window.print();
  };

  const handleViewJob = () => {
    onClose();
  };

  const handleViewChallan = () => {
    navigate(`/challans/${challanId}`);
  };

  if (!dispatch) return null;

  return (
    <>
      {/* ── Print CSS: hide everything except challan, size A5 landscape ── */}
      <style>{`
        @media print {
          @page { size: A5 landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          #challan-print-root,
          #challan-print-root * { visibility: visible !important; }
          #challan-print-root {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* ── Challan content — hidden on screen (no !important), shown on print ── */}
      <div
        id="challan-print-root"
        style={{ display: 'none', fontFamily: 'sans-serif', fontSize: '11px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #c41e3a', paddingBottom: '8px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#c41e3a' }}>{settings.companyName}</div>
            <div style={{ color: '#6b7280', lineHeight: 1.4, marginTop: '2px' }}>{settings.address}</div>
            <div style={{ color: '#6b7280' }}>Ph: {settings.phone} | GST: {settings.gstin}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Challan</div>
            <div style={{ color: '#6b7280', marginTop: '2px' }}>No: <strong style={{ color: '#111' }}>{dispatch.challanNumber}</strong></div>
            <div style={{ color: '#6b7280' }}>Date: <strong style={{ color: '#111' }}>{dispatch.date}</strong></div>
            <div style={{ color: '#6b7280' }}>Job: <strong style={{ color: '#111' }}>{job?.jobNumber ?? '—'}</strong></div>
            {job?.reference && <div style={{ color: '#c41e3a', fontWeight: 600, marginTop: '2px' }}>Ref: {job.reference}</div>}
            {totalWeight != null && (
              <div style={{ color: '#374151', fontWeight: 600, marginTop: '2px' }}>
                Total Weight: <strong style={{ color: '#111' }}>{totalWeight.toFixed(3)} kg</strong>
              </div>
            )}
          </div>
        </div>

        {/* Vendor + Transport */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: '4px' }}>To (Vendor)</div>
            <div style={{ fontWeight: 600 }}>{vendor?.name ?? '—'}</div>
            <div style={{ color: '#6b7280' }}>{vendor?.contactPerson} · {vendor?.mobile}</div>
            {vendor?.gstNumber && <div style={{ color: '#6b7280' }}>GST: {vendor.gstNumber}</div>}
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: '4px' }}>Transport</div>
            <div style={{ fontWeight: 600 }}>{dispatch.transport}</div>
            {dispatch.vehicleNumber && <div style={{ color: '#6b7280' }}>Vehicle: {dispatch.vehicleNumber}</div>}
            {dispatch.driver && <div style={{ color: '#6b7280' }}>Driver: {dispatch.driver}</div>}
            <div style={{ color: '#6b7280' }}>Process: <strong style={{ color: '#111' }}>{job?.process ?? '—'}</strong></div>
          </div>
        </div>

        {/* Per-reference weight summary — shown after Ref line in header */}
        {(() => {
          // Group items by reference number
          const refGroups = new Map<string, typeof items>();
          items.forEach((item, idx) => {
            const dispatchItem = dispatch!.items[idx];
            let jobItem = job?.items.find((ji) => dispatchItem.jobWorkItemId && dispatchItem.jobWorkItemId === ji.id);
            if (!jobItem) jobItem = job?.items.find((ji) => ji.variantId === dispatchItem.variantId);
            // Try to get refNumber from job reference field; fall back to single ref
            const refLabel = job?.reference ?? '—';
            const key = refLabel;
            if (!refGroups.has(key)) refGroups.set(key, []);
            refGroups.get(key)!.push(item);
          });
          // Weight per reference
          const refWeights: { ref: string; pieces: number; weight: number | null }[] = [];
          refGroups.forEach((grpItems, ref) => {
            const hasWeight = grpItems.some((i) => i.weight != null);
            refWeights.push({
              ref,
              pieces: grpItems.reduce((s, i) => s + i.quantity, 0),
              weight: hasWeight ? grpItems.reduce((s, i) => s + (i.weight ?? 0), 0) : null,
            });
          });
          if (!refWeights.some((r) => r.weight != null)) return null;
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {refWeights.map((r) => r.weight != null && (
                <div key={r.ref} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '5px 10px', fontSize: '10px' }}>
                  <span style={{ fontWeight: 700, color: '#c41e3a' }}>Ref: {r.ref}</span>
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>{r.pieces.toLocaleString('en-IN')} Pic</span>
                  <span style={{ color: '#374151', fontWeight: 600, marginLeft: '8px' }}>{r.weight!.toFixed(3)} kg</span>
                </div>
              ))}
              {totalWeight != null && refWeights.length > 1 && (
                <div style={{ border: '1px solid #c41e3a', borderRadius: '6px', padding: '5px 10px', fontSize: '10px', background: '#fff5f5' }}>
                  <span style={{ fontWeight: 700, color: '#c41e3a' }}>Total Weight:</span>
                  <span style={{ color: '#374151', fontWeight: 600, marginLeft: '8px' }}>{totalWeight.toFixed(3)} kg</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Items table — no weight column */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '10px' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['#', 'Product', 'Category', 'Pieces', 'Rate (₹)', 'Amount (₹)'].map((h) => (
                <th key={h} style={{ border: '1px solid #d1d5db', padding: '5px 7px', textAlign: h === '#' ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const catName = item.product
                ? (categories.find((c) => c.id === item.product!.categoryId)?.name ?? '—')
                : '—';
              return (
                <tr key={i}>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', color: '#6b7280' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', fontWeight: 500 }}>{item.product?.name ?? '—'}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', color: '#6b7280' }}>{catName}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', textAlign: 'right' }}>{item.quantity.toLocaleString('en-IN')}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', textAlign: 'right' }}>₹{item.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '4px 7px', textAlign: 'right', fontWeight: 600 }}>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f9fafb' }}>
              <td colSpan={3} style={{ border: '1px solid #d1d5db', padding: '5px 7px', fontWeight: 700, fontSize: '9px', textTransform: 'uppercase' }}>Total</td>
              <td style={{ border: '1px solid #d1d5db', padding: '5px 7px', textAlign: 'right', fontWeight: 700 }}>{totalPieces.toLocaleString('en-IN')} Pic</td>
              <td style={{ border: '1px solid #d1d5db', padding: '5px 7px' }} />
              <td style={{ border: '1px solid #d1d5db', padding: '5px 7px', textAlign: 'right', fontWeight: 700, color: '#c41e3a' }}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '160px', borderTop: '1px solid #111', paddingTop: '6px' }}>
              <div style={{ fontWeight: 600 }}>Authorized Signature</div>
              <div style={{ color: '#6b7280' }}>{settings.companyName}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '160px', borderTop: '1px solid #111', paddingTop: '6px' }}>
              <div style={{ fontWeight: 600 }}>Vendor Signature</div>
              <div style={{ color: '#6b7280' }}>{vendor?.name ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen dialog overlay ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm print:hidden">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="text-green-700 text-xl">✓</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-charcoal">Dispatched Successfully</h2>
              <p className="text-xs text-muted mt-0.5">
                {job?.jobNumber} · Challan {dispatch.challanNumber}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Challan summary card */}
            <div className="rounded-xl border border-border bg-surface p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Vendor</span>
                <span className="font-semibold text-charcoal">{vendor?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Challan No.</span>
                <span className="font-semibold text-brand">{dispatch.challanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Pieces</span>
                <span className="font-semibold text-charcoal">{totalPieces.toLocaleString('en-IN')} Pic</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted">Total Amount</span>
                <span className="font-bold text-brand">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Print prompt */}
            <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
              <Printer size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Do you want to print the delivery challan for this dispatch?
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={handleViewJob}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-charcoal hover:bg-surface transition-colors"
            >
              Skip, View Job
            </button>
            <button
              type="button"
              onClick={handleViewChallan}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:bg-surface transition-colors"
            >
              View Challan
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              <Printer size={15} />
              Yes, Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function CreateJobWorkPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const vendors        = useAppStore((s) => s.vendors);
  const categories     = useAppStore((s) => s.categories);
  const products       = useAppStore((s) => s.products);
  const references     = useAppStore((s) => s.references);
  const jobWorks       = useAppStore((s) => s.jobWorks);
  const currentUser    = useAppStore((s) => s.currentUser);
  const createJobWork  = useAppStore((s) => s.createJobWork);
  const createDispatch = useAppStore((s) => s.createDispatch);
  const jobCounter     = useAppStore((s) => s.jobCounter);

  const nextJobNumber = `JW-2026-${String(jobCounter + 1).padStart(5, '0')}`;

  // ── Hydrate from sessionStorage ──────────────────────────────────────────
  const saved = loadDraft();

  // Job info
  const [vendorId,     setVendorId]     = useState<string>(saved?.vendorId ?? '');
  const [process,      setProcess]      = useState<string>(saved?.process ?? 'Printing');
  const [issueDate,    setIssueDate]    = useState<string>(saved?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState<string>(saved?.expectedDate ?? '');
  const [priority,     setPriority]     = useState<'Normal' | 'High' | 'Urgent'>(saved?.priority ?? 'Normal');

  // Reference / product entry
  const [selectedRefId, setSelectedRefId] = useState<string>(saved?.selectedRefId ?? '');
  const [draftRates,    setDraftRates]    = useState<Record<string, string>>(saved?.draftRates ?? {});
  const [draftQtys,     setDraftQtys]     = useState<Record<string, string>>(saved?.draftQtys ?? {});
  const [draftWeights,  setDraftWeights]  = useState<Record<string, string>>(saved?.draftWeights ?? {});
  const [draftVariants, setDraftVariants] = useState<Record<string, string>>(saved?.draftVariants ?? {});
  const [lineItems,     setLineItems]     = useState<LineItem[]>(saved?.lineItems ?? []);

  // Print dialog after dispatch
  const [printDialog, setPrintDialog] = useState<{ open: boolean; jobId: string; challanId: string } | null>(null);

  // Refs
  const confirmBtnRef       = useRef<HTMLButtonElement>(null);
  const formRef             = useRef<HTMLDivElement>(null);
  const refSelectTriggerRef = useRef<HTMLButtonElement>(null);
  const productCardRef      = useRef<HTMLDivElement>(null);
  const addAllBtnRef        = useRef<HTMLButtonElement>(null);

  // ── Persist draft to sessionStorage on every change ──────────────────────
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        vendorId, process, issueDate, expectedDate, priority,
        selectedRefId, draftRates, draftQtys, draftWeights, draftVariants, lineItems,
      } satisfies DraftState));
    } catch { /* quota errors – ignore */ }
  }, [vendorId, process, issueDate, expectedDate, priority,
      selectedRefId, draftRates, draftQtys, draftWeights, draftVariants, lineItems]);

  // ── Restore / capture scroll position ────────────────────────────────────
  useEffect(() => {
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY) ?? '0');
      if (y > 0) {
        setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), 0);
        sessionStorage.removeItem(SCROLL_KEY);
      }
    } catch { /* ignore */ }

    const save = () => {
      try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch { /* ignore */ }
    };
    let t = 0;
    const debounced = () => { clearTimeout(t); t = window.setTimeout(save, 80); };
    window.addEventListener('scroll', debounced, { passive: true });
    return () => { window.removeEventListener('scroll', debounced); clearTimeout(t); };
  }, []);

  const clearDraft = () => {
    try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(SCROLL_KEY); } catch { /* ignore */ }
  };

  // ── Ctrl+Enter → Confirm & Dispatch ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (vendorId && expectedDate && lineItems.length > 0) handleSave('confirm');
        else confirmBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, expectedDate, lineItems]);

  // ── Shift+R → New Job Card ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only when Shift+R pressed and focus is NOT inside an input/select/textarea
      if (e.shiftKey && e.key === 'R' && !e.ctrlKey && !e.metaKey) {
        const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
        e.preventDefault();
        clearDraft();
        navigate('/job-works/create');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-select newly created reference on return ─────────────────────────
  const newRefNumber = searchParams.get('newRef');
  useEffect(() => {
    if (!newRefNumber) return;
    const found = references.find(
      (r) => r.referenceNumber.trim().toLowerCase() === newRefNumber.trim().toLowerCase(),
    );
    if (found) {
      setSelectedRefId(found.id);
      const next = new URLSearchParams(searchParams);
      next.delete('newRef');
      navigate({ search: next.toString() }, { replace: true });
      setTimeout(() => {
        refSelectTriggerRef.current?.focus();
        productCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newRefNumber, references]);

  // ── Computed values ───────────────────────────────────────────────────────

  // Reference numbers already used in *existing* job works
  const usedInJobWorks = useMemo(() => {
    const set = new Set<string>();
    jobWorks.forEach((j) => { if (j.reference) j.reference.split(',').forEach((r) => set.add(r.trim().toLowerCase())); });
    return set;
  }, [jobWorks]);

  // Reference numbers already added to the *current* draft
  const usedInDraft = useMemo(() => {
    const set = new Set<string>();
    lineItems.forEach((li) => { if (li.refNumber) set.add(li.refNumber.trim().toLowerCase()); });
    return set;
  }, [lineItems]);

  // Available = not used anywhere AND not already in this draft
  const availableRefs = useMemo(
    () => references.filter(
      (r) =>
        !usedInJobWorks.has(r.referenceNumber.trim().toLowerCase()) &&
        !usedInDraft.has(r.referenceNumber.trim().toLowerCase()),
    ),
    [references, usedInJobWorks, usedInDraft],
  );

  const selectedRefData = references.find((r) => r.id === selectedRefId);

  const refItems = useMemo(() => {
    if (!selectedRefData) return [];
    if (selectedRefData.items && selectedRefData.items.length > 0) return selectedRefData.items;
    return [{
      categoryId: selectedRefData.categoryId,
      productId:  selectedRefData.productId,
      variantId:  selectedRefData.variantId,
      pieces:     selectedRefData.pieces,
    }];
  }, [selectedRefData]);

  // Pre-fill drafts when reference changes
  useEffect(() => {
    if (!selectedRefData) { setDraftRates({}); setDraftQtys({}); setDraftWeights({}); setDraftVariants({}); return; }
    const rates: Record<string, string> = {};
    const qtys:  Record<string, string> = {};
    const weights: Record<string, string> = {};
    const variants: Record<string, string> = {};
    refItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      qtys[item.productId]     = String(item.pieces);
      rates[item.productId]    = prod?.rate ? String(prod.rate) : '';
      weights[item.productId]  = '';
      // Pre-select the variant from the reference, or fall back to first active variant
      const activeVariants     = prod?.variants.filter((v) => v.status === 'Active') ?? [];
      const defaultVariant     = item.variantId ?? activeVariants[0]?.id ?? prod?.variants[0]?.id ?? '';
      variants[item.productId] = defaultVariant;
    });
    setDraftRates(rates);
    setDraftQtys(qtys);
    setDraftWeights(weights);
    setDraftVariants(variants);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRefId]);

  // Scroll product card into view when ref selected
  useEffect(() => {
    if (selectedRefId && productCardRef.current) {
      productCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedRefId]);

  // When a multi-item reference is selected, auto-focus the "Add All" button
  useEffect(() => {
    if (selectedRefId && refItems.length > 1) {
      setTimeout(() => addAllBtnRef.current?.focus(), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRefId]);

  const pendingRefItems = refItems.filter((item) => item.productId in draftQtys);

  const grandTotals = useMemo(
    () => lineItems.reduce(
      (acc, li) => ({ qty: acc.qty + li.quantity, amount: acc.amount + li.quantity * li.rate }),
      { qty: 0, amount: 0 },
    ),
    [lineItems],
  );

  // Group line items by refNumber for display
  const groupedLineItems = useMemo(() => {
    const groups = new Map<string, LineItem[]>();
    lineItems.forEach((li) => {
      const key = li.refNumber ?? '(no reference)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(li);
    });
    return groups;
  }, [lineItems]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const removeLineItem = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));
  const updateLineItem = (idx: number, field: 'quantity' | 'rate' | 'weight', value: number) =>
    setLineItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  /** After adding item(s), if no more pending → clear ref and focus selector */
  const resetRefAfterAdd = (newPendingCount: number) => {
    if (newPendingCount === 0) {
      // All items from this ref added — clear and let user pick the next ref
      setSelectedRefId('');
      setDraftRates({});
      setDraftQtys({});
      setTimeout(() => {
        refSelectTriggerRef.current?.focus();
        productCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else {
      // Still has pending items — focus the first pending Rate field
      setTimeout(() => {
        const first = formRef.current?.querySelector<HTMLElement>('[data-product-rate]');
        first?.focus();
      }, 50);
    }
  };

  const addRefItemToJob = (productId: string, variantId: string) => {
    const qty    = Number(draftQtys[productId])    || 0;
    const rate   = Number(draftRates[productId])   || 0;
    const weight = Number(draftWeights[productId]) || undefined;
    if (!qty) return;
    // Use the user-selected variant from draftVariants (falls back to passed variantId)
    const resolvedVariantId = draftVariants[productId] || variantId;
    const refNumber = selectedRefData?.referenceNumber;
    setLineItems((prev) => [...prev, { productId, variantId: resolvedVariantId, quantity: qty, rate, weight, refNumber }]);
    const newDraftQtys     = { ...draftQtys };     delete newDraftQtys[productId];
    const newDraftRates    = { ...draftRates };    delete newDraftRates[productId];
    const newDraftWeights  = { ...draftWeights };  delete newDraftWeights[productId];
    const newDraftVariants = { ...draftVariants }; delete newDraftVariants[productId];
    setDraftQtys(newDraftQtys);
    setDraftRates(newDraftRates);
    setDraftWeights(newDraftWeights);
    setDraftVariants(newDraftVariants);
    // How many items will remain pending after this removal?
    const remaining = pendingRefItems.filter((i) => i.productId !== productId).length;
    resetRefAfterAdd(remaining);
  };

  const addAllRefItems = () => {
    const refNumber = selectedRefData?.referenceNumber;
    const newItems: LineItem[] = [];
    refItems.forEach((item) => {
      const qty    = Number(draftQtys[item.productId])    || 0;
      const rate   = Number(draftRates[item.productId])   || 0;
      const weight = Number(draftWeights[item.productId]) || undefined;
      if (!qty) return;
      const prod = products.find((p) => p.id === item.productId);
      // Use the user-selected variant; fall back to reference variantId or first active variant
      const activeVariants = prod?.variants.filter((v) => v.status === 'Active') ?? [];
      const variantId =
        draftVariants[item.productId] ||
        item.variantId ||
        activeVariants[0]?.id ||
        prod?.variants[0]?.id ||
        '';
      newItems.push({ productId: item.productId, variantId, quantity: qty, rate, weight, refNumber });
    });
    if (newItems.length === 0) return;
    setLineItems((prev) => [...prev, ...newItems]);
    setDraftQtys({});
    setDraftRates({});
    setDraftWeights({});
    setDraftVariants({});
    setSelectedRefId('');
    setTimeout(() => {
      refSelectTriggerRef.current?.focus();
      productCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const buildItems = () =>
    lineItems.map((li, i) => ({
      id:               `new_${i}`,
      productId:         li.productId,
      variantId:         li.variantId,
      sentQuantity:      0,
      receivedQuantity:  0,
      rejectedQuantity:  0,
      lossQuantity:      0,
      rate:              li.rate,
      weight:            li.weight,
      _dispatchQty:      li.quantity,
    }));

  const handleSave = (mode: 'draft' | 'confirm') => {
    if (!vendorId || !expectedDate) return;
    const rawItems = buildItems();
    if (rawItems.length === 0) return;

    const jobReference = [...new Set(lineItems.map((li) => li.refNumber).filter(Boolean))].join(', ');

    const jobId = createJobWork({
      vendorId,
      process,
      issueDate,
      expectedReturnDate: expectedDate,
      priority,
      reference: jobReference,
      remarks: '',
      status: mode === 'confirm' ? 'Sent' : 'Draft',
      createdBy: currentUser?.name ?? 'User',
      items: rawItems.map(({ _dispatchQty, ...rest }) => ({
        ...rest,
        sentQuantity: mode === 'confirm' ? (_dispatchQty ?? 0) : 0,
      })),
    });

    if (mode === 'confirm') {
      const challanId = createDispatch({
        jobWorkId:    jobId,
        date:         issueDate,
        vehicleNumber: '',
        driver:        '',
        transport:     'Own Vehicle',
        items:         rawItems.map((i) => ({ jobWorkItemId: i.id, variantId: i.variantId, quantity: i._dispatchQty ?? 0, weight: i.weight })),
        createdBy:     currentUser?.name ?? 'User',
      });
      clearDraft();
      // Show print dialog before navigating
      setPrintDialog({ open: true, jobId, challanId });
    } else {
      clearDraft();
      navigate(`/job-works/${jobId}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <Breadcrumb items={[{ label: 'Job Work' }, { label: 'Create Job Work' }]} />
      <PageHeader title="Create Job Work" subtitle="Send material to vendor for processing" />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on Pieces — add &amp; go to next ref</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> Confirm &amp; Dispatch
        </span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Shift+R</kbd> New Job Card (anywhere)
        </span>
      </div>

      <div data-form ref={formRef}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">

            {/* ── Job Information ── */}
            <Card className="p-6">
              <h3 className="text-base font-semibold mb-4">Job Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Job Number" value={nextJobNumber} disabled tabIndex={-1} />
                <SearchableSelect
                  label="Vendor *"
                  value={vendorId}
                  onChange={setVendorId}
                  placeholder="Search vendor…"
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                  tabIndex={1}
                />
                <Select
                  label="Process"
                  value={process}
                  tabIndex={2}
                  onChange={(e) => setProcess(e.target.value)}
                  options={[{ value: 'Printing', label: 'Printing' }, { value: 'Packaging', label: 'Packaging' }]}
                />
                <Input label="Issue Date" type="date" value={issueDate} tabIndex={3}
                  onChange={(e) => setIssueDate(e.target.value)} />
                <Input label="Expected Return Date *" type="date" value={expectedDate} tabIndex={4}
                  onChange={(e) => setExpectedDate(e.target.value)} required />
                <Select
                  label="Priority"
                  value={priority}
                  tabIndex={5}
                  onChange={(e) => setPriority(e.target.value as 'Normal' | 'High' | 'Urgent')}
                  options={[{ value: 'Normal', label: 'Normal' }, { value: 'High', label: 'High' }, { value: 'Urgent', label: 'Urgent' }]}
                />
              </div>
            </Card>

            {/* ── Product Selection ── */}
            <div ref={productCardRef}>
              <Card className="p-6">
                <h3 className="text-base font-semibold mb-1">Subproduct Selection</h3>
                <p className="text-xs text-muted mb-4">
                  Pick a reference → enter Rate &amp; Pieces → <kbd className="font-mono bg-surface px-1 rounded text-[11px]">Enter</kbd> adds &amp; auto-moves to next reference
                </p>

                {/* Reference selector */}
                <div className="mb-5">
                  <SearchableSelect
                    label="Reference No."
                    value={selectedRefId}
                    triggerRef={refSelectTriggerRef}
                    onChange={(val) => {
                      setSelectedRefId(val);
                      if (!val) { setDraftRates({}); setDraftQtys({}); }
                    }}
                    placeholder={availableRefs.length === 0 ? 'No available references' : 'Search reference number…'}
                    options={availableRefs.map((r) => ({ value: r.id, label: r.referenceNumber }))}
                    tabIndex={6}
                    onAddNew={() => navigate(`/references/new?returnTo=${encodeURIComponent('/job-works/create?newRef=__PLACEHOLDER__')}`)}
                    addNewLabel="Add new reference"
                    disabled={availableRefs.length === 0 && !selectedRefId}
                  />
                  {availableRefs.length === 0 && lineItems.length > 0 && (
                    <p className="mt-1.5 text-xs text-green-600 font-medium">
                      ✓ All available references have been added to this job.
                    </p>
                  )}
                  {availableRefs.length === 0 && lineItems.length === 0 && references.length > 0 && (
                    <p className="mt-1.5 text-xs text-orange-600">All references are already used in other job works.</p>
                  )}
                </div>

                {/* ── Per-product entry rows for current reference ── */}
                {selectedRefData && pendingRefItems.length > 0 && (
                  <div className="space-y-3 mb-5">
                    {/* Reference badge */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand/8 border border-brand/20">
                      <Tag size={13} className="text-brand shrink-0" />
                      <span className="text-xs font-semibold text-brand">
                        Ref: {selectedRefData.referenceNumber}
                      </span>
                      <span className="text-xs text-muted ml-1">
                        — {pendingRefItems.length} subproduct{pendingRefItems.length !== 1 ? 's' : ''} pending
                      </span>
                    </div>

                    {/* ── MULTI-ITEM: read-only summary + single "Add All" button ── */}
                    {pendingRefItems.length > 1 ? (
                      <>
                        {/* Read-only item rows */}
                        {pendingRefItems.map((item) => {
                          const cat            = categories.find((c) => c.id === item.categoryId);
                          const prod           = products.find((p) => p.id === item.productId);
                          const activeVariants = prod?.variants.filter((v) => v.status === 'Active') ?? [];
                          const variantOptions = activeVariants.length > 0 ? activeVariants : (prod?.variants ?? []);
                          const selectedVariantId =
                            draftVariants[item.productId] ||
                            item.variantId ||
                            variantOptions[0]?.id ||
                            '';
                          const variant = variantOptions.find((v) => v.id === selectedVariantId) ?? variantOptions[0];
                          const qty    = Number(draftQtys[item.productId])  || 0;
                          const rate   = Number(draftRates[item.productId]) || 0;
                          const amount = qty * rate;

                          return (
                            <div key={item.productId} className="rounded-lg border border-border overflow-hidden">
                              {/* Product header */}
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-brand/5 border-b border-border">
                                <span className="text-xs font-semibold text-brand uppercase tracking-wide">
                                  {cat?.name ?? '—'}
                                </span>
                                <ChevronRight size={12} className="text-muted" />
                                <span className="text-sm font-semibold text-charcoal">{prod?.name ?? '—'}</span>
                                <span className="ml-auto text-xs text-muted">{formatUnit(prod?.unit ?? 'Pic')}</span>
                              </div>

                              <div className="px-4 py-3">
                                {/* Variant badge */}
                                {variant && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-xs text-muted">Variant:</span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-medium border border-brand/20">
                                      {variant.name}
                                      {variant.sku && (
                                        <span className="font-mono text-[10px] text-brand/60">{variant.sku}</span>
                                      )}
                                    </span>
                                  </div>
                                )}

                                {/* Read-only fields grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase mb-1">Rate (₹ / Pic)</p>
                                    <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-charcoal font-medium opacity-60 cursor-not-allowed select-none">
                                      {rate > 0 ? `₹${rate}` : <span className="text-muted">—</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase mb-1">No. of Pieces</p>
                                    <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm text-charcoal font-medium opacity-60 cursor-not-allowed select-none">
                                      {qty > 0 ? qty : <span className="text-muted">—</span>}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted uppercase mb-1">Amount</p>
                                    <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm font-semibold text-charcoal">
                                      {amount > 0 ? formatCurrency(amount) : <span className="text-muted font-normal">—</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Single "Add All" button — auto-focused, Enter triggers it */}
                        <button
                          ref={addAllBtnRef}
                          type="button"
                          onClick={addAllRefItems}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addAllRefItems(); }
                          }}
                          className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand text-white px-4 py-3 text-sm font-semibold hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/40 transition-colors shadow-sm"
                        >
                          <Plus size={15} />
                          Add All {pendingRefItems.length} Products to Job
                          <kbd className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">↵</kbd>
                        </button>
                      </>
                    ) : (
                      /* ── SINGLE-ITEM: editable form as before ── */
                      pendingRefItems.map((item, itemIndex) => {
                        const cat            = categories.find((c) => c.id === item.categoryId);
                        const prod           = products.find((p) => p.id === item.productId);
                        const activeVariants = prod?.variants.filter((v) => v.status === 'Active') ?? [];
                        const variantOptions = activeVariants.length > 0 ? activeVariants : (prod?.variants ?? []);
                        const hasMultipleVariants = variantOptions.length > 1;
                        const selectedVariantId =
                          draftVariants[item.productId] ||
                          item.variantId ||
                          variantOptions[0]?.id ||
                          '';
                        const qty    = draftQtys[item.productId]  ?? '';
                        const rate   = draftRates[item.productId] ?? '';
                        const amount = (Number(qty) || 0) * (Number(rate) || 0);
                        const hasQty = Number(qty) > 0;
                        const isFirst = itemIndex === 0;

                        return (
                          <div key={item.productId} className="rounded-lg border border-border overflow-hidden">
                            {/* Product header */}
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-brand/5 border-b border-border">
                              <span className="text-xs font-semibold text-brand uppercase tracking-wide">
                                {cat?.name ?? '—'}
                              </span>
                              <ChevronRight size={12} className="text-muted" />
                              <span className="text-sm font-semibold text-charcoal">{prod?.name ?? '—'}</span>
                              <span className="ml-auto text-xs text-muted">{formatUnit(prod?.unit ?? 'Pic')}</span>
                            </div>

                            <div className="px-4 py-4 space-y-3">
                              {/* ── Variant selector (only when product has multiple variants) ── */}
                              {hasMultipleVariants ? (
                                <div>
                                  <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                                    Variant <span className="normal-case font-normal text-brand">(select one)</span>
                                  </label>
                                  <div className="flex flex-wrap gap-2">
                                    {variantOptions.map((v) => (
                                      <button
                                        key={v.id}
                                        type="button"
                                        onClick={() =>
                                          setDraftVariants((prev) => ({ ...prev, [item.productId]: v.id }))
                                        }
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                                          selectedVariantId === v.id
                                            ? 'bg-brand text-white border-brand shadow-sm'
                                            : 'bg-white text-charcoal border-border hover:border-brand/60 hover:bg-brand/5'
                                        }`}
                                      >
                                        <span className="font-semibold">{v.name}</span>
                                        {v.sku && (
                                          <span className={`font-mono text-[10px] ${selectedVariantId === v.id ? 'text-white/70' : 'text-muted'}`}>
                                            {v.sku}
                                          </span>
                                        )}
                                        {v.attributes.slice(0, 2).map((a, ai) => (
                                          <span
                                            key={ai}
                                            className={`text-[10px] ${selectedVariantId === v.id ? 'text-white/70' : 'text-muted'}`}
                                          >
                                            {a.key}:{a.value}
                                          </span>
                                        ))}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : variantOptions.length === 1 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted">Variant:</span>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand text-xs font-medium border border-brand/20">
                                    {variantOptions[0].name}
                                    {variantOptions[0].sku && (
                                      <span className="font-mono text-[10px] text-brand/60">{variantOptions[0].sku}</span>
                                    )}
                                  </span>
                                </div>
                              ) : null}

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                              {/* Rate */}
                              <div>
                                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                                  Rate (₹ / Pic)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  data-product-rate={item.productId}
                                  value={rate}
                                  autoFocus={isFirst}
                                  onChange={(e) => setDraftRates((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (e.shiftKey) {
                                        focusNextInForm(e.currentTarget, true);
                                      } else {
                                        const qtyInput = formRef.current?.querySelector<HTMLInputElement>(
                                          `input[data-product-qty="${item.productId}"]`
                                        );
                                        qtyInput?.focus();
                                      }
                                    }
                                  }}
                                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                                  placeholder="0.00"
                                  autoComplete="off"
                                />
                              </div>

                              {/* Pieces */}
                              <div>
                                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">
                                  No. of Pieces
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    data-product-qty={item.productId}
                                    value={qty}
                                    onChange={(e) => setDraftQtys((prev) => ({ ...prev, [item.productId]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (e.shiftKey) {
                                          focusNextInForm(e.currentTarget, true);
                                        } else if (hasQty) {
                                          addRefItemToJob(item.productId, selectedVariantId);
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                                    placeholder="0"
                                    autoComplete="off"
                                  />
                                  <span className="text-xs text-muted whitespace-nowrap">
                                    {formatUnit(prod?.unit ?? 'Pic')}
                                  </span>
                                </div>
                              </div>

                              {/* Amount (read-only) */}
                              <div>
                                <label className="block text-xs font-semibold text-muted uppercase mb-1.5">Amount</label>
                                <div className="px-3 py-2 rounded-lg bg-surface border border-border text-sm font-semibold text-charcoal min-h-[38px] flex items-center">
                                  {amount > 0
                                    ? formatCurrency(amount)
                                    : <span className="text-muted font-normal">—</span>
                                  }
                                </div>
                              </div>

                              {/* Add button */}
                              <div>
                                <button
                                  type="button"
                                  disabled={!hasQty}
                                  onClick={() => addRefItemToJob(item.productId, selectedVariantId)}
                                  className={`w-full flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors
                                    ${hasQty
                                      ? 'bg-brand text-white hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand/40'
                                      : 'bg-surface text-muted border border-border cursor-not-allowed'}`}
                                >
                                  <Plus size={14} />
                                  Add
                                  {hasQty && <kbd className="ml-1 text-[10px] bg-white/20 px-1 py-0.5 rounded font-mono">↵</kbd>}
                                </button>
                              </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Placeholder: no ref selected */}
                {!selectedRefData && (
                  <div className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted mb-5">
                    Select a reference number above to load subproducts
                  </div>
                )}

                {/* All products from current ref added */}
                {selectedRefData && pendingRefItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-green-300 bg-green-50 px-6 py-4 text-center text-sm text-green-700 mb-5">
                    ✓ All subproducts from <strong>{selectedRefData.referenceNumber}</strong> have been added.
                  </div>
                )}

                {/* ── Job Items — grouped by reference ── */}
                {lineItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-charcoal mb-3">
                      Job Items
                      <span className="ml-2 text-xs font-normal text-muted">
                        ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})
                      </span>
                    </h4>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-surface border-b border-border">
                              {['#', 'Product', 'Subproduct', 'Rate (₹)', 'Pieces', 'Amount', ''].map((h) => (
                                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from(groupedLineItems.entries()).map(([refNum, items]) => {
                              // Global index offset for this group
                              const groupOffset = lineItems.findIndex(
                                (li) => (li.refNumber ?? '(no reference)') === refNum,
                              );
                              return (
                                <>
                                  {/* Reference group header row */}
                                  <tr key={`hdr-${refNum}`} className="bg-brand/5 border-b border-brand/10">
                                    <td colSpan={7} className="px-4 py-1.5">
                                      <div className="flex items-center gap-2">
                                        <Tag size={11} className="text-brand shrink-0" />
                                        <span className="text-xs font-semibold text-brand">{refNum}</span>
                                        <span className="text-xs text-muted">
                                          — {items.length} product{items.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Items in this group */}
                                  {items.map((li, gIdx) => {
                                    const globalIdx = groupOffset + gIdx;
                                    const prod   = products.find((p) => p.id === li.productId);
                                    const cat    = categories.find((c) => c.id === prod?.categoryId);
                                    const amount = li.quantity * li.rate;
                                    return (
                                      <tr key={globalIdx} className="border-b border-border last:border-0 hover:bg-surface/50">
                                        <td className="px-4 py-2.5 text-muted text-xs pl-8">{globalIdx + 1}</td>
                                        <td className="px-4 py-2.5 text-muted">{cat?.name ?? '—'}</td>
                                        <td className="px-4 py-2.5 font-medium text-charcoal">{prod?.name ?? '—'}</td>
                                        <td className="px-4 py-2.5">
                                          <input
                                            type="number" min={0} step="0.01"
                                            value={li.rate || ''}
                                            tabIndex={-1}
                                            onChange={(e) => updateLineItem(globalIdx, 'rate', Number(e.target.value))}
                                            className="w-24 px-2 py-1 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                                          />
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="number" min={0}
                                              value={li.quantity || ''}
                                              tabIndex={-1}
                                              onChange={(e) => updateLineItem(globalIdx, 'quantity', Number(e.target.value))}
                                              className="w-24 px-2 py-1 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                                            />
                                            <span className="text-xs text-muted">{formatUnit(prod?.unit ?? 'Pic')}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-charcoal">
                                          {formatCurrency(amount)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <button type="button" tabIndex={-1}
                                            onClick={() => removeLineItem(globalIdx)}
                                            className="text-muted hover:text-red-500 transition-colors" title="Remove">
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-brand/5 border-t-2 border-brand/20">
                              <td colSpan={4} className="px-4 py-3 text-sm font-bold text-charcoal uppercase tracking-wide">Grand Total</td>
                              <td className="px-4 py-3 font-bold text-charcoal">
                                {grandTotals.qty.toLocaleString('en-IN')} Pic
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-brand text-base">
                                {formatCurrency(grandTotals.amount)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* ── Summary sidebar ── */}
          <div>
            <Card className="p-6 sticky top-6">
              <h3 className="text-base font-semibold mb-4">Summary</h3>

              {/* References used */}
              {usedInDraft.size > 0 && (
                <div className="mb-4 space-y-1">
                  <p className="text-xs font-semibold text-muted uppercase">References in this job</p>
                  {[...usedInDraft].map((rn) => (
                    <div key={rn} className="flex items-center gap-1.5 text-xs">
                      <Tag size={11} className="text-brand shrink-0" />
                      <span className="font-medium text-brand">{rn}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between">
                  <span className="text-muted">Total Items</span>
                  <span className="font-medium">{lineItems.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total Quantity</span>
                  <span className="font-bold text-charcoal">{grandTotals.qty.toLocaleString('en-IN')} Pic</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="text-muted">Total Amount</span>
                  <span className="font-bold text-brand text-base">{formatCurrency(grandTotals.amount)}</span>
                </div>
              </div>

              {(!vendorId || !expectedDate) && (
                <p className="text-xs text-orange-600 mb-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  Fill in Vendor and Expected Date to save.
                </p>
              )}
              {lineItems.length === 0 && (
                <p className="text-xs text-muted mb-3 bg-surface border border-border rounded-lg px-3 py-2">
                  Select a reference and add products to the job.
                </p>
              )}

              <div className="space-y-2">
                <button
                  ref={confirmBtnRef}
                  type="button"
                  className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => handleSave('confirm')}
                  disabled={!vendorId || !expectedDate || lineItems.length === 0}
                >
                  Confirm &amp; Dispatch
                  <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                </button>
                <Button type="button" variant="outline" className="w-full"
                  onClick={() => handleSave('draft')}
                  disabled={!vendorId || !expectedDate || lineItems.length === 0}>
                  Save as Draft
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => window.print()}>
                  Print
                </Button>
                <Button type="button" variant="ghost" className="w-full"
                  onClick={() => { clearDraft(); navigate('/job-works'); }}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Print Challan dialog after Confirm & Dispatch ── */}
      {printDialog?.open && (
        <PrintChallanDialog
          challanId={printDialog.challanId}
          jobId={printDialog.jobId}
          onClose={() => { setPrintDialog(null); navigate(`/job-works/${printDialog.jobId}`); }}
        />
      )}
    </div>
  );
}
