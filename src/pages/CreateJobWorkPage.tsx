import { ChevronRight, ExternalLink, Printer, Plus, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Breadcrumb, Card, PageHeader } from '../components/ui/Card';
import { buildChallanPrintData, CHALLAN_PRINT_CSS, ChallanPrintPreview, printChallan } from '../components/ui/ChallanPrint';
import { focusNextInForm, Input, SearchableSelect, Select } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';

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

/**
 * Stable per-item key that prevents collision when two items in the same
 * reference share the same productId but differ by variantId or position.
 *
 * Format: "<productId>::<variantId|idx>"
 */
function makeItemKey(productId: string, variantId: string | undefined, idx: number): string {
  return `${productId}::${variantId ?? idx}`;
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
// Shows a full A5-landscape preview of the challan inside a scrollable modal.
// Clicking "Print" calls window.print() which hides everything except the
// #challan-print-area div (via CHALLAN_PRINT_CSS).

function PrintChallanDialog({
  challanId,
  jobId,
  onClose,
}: {
  challanId: string;
  jobId: string;
  onClose: () => void;
}) {
  const navigate   = useNavigate();
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks   = useAppStore((s) => s.jobWorks);
  const vendors    = useAppStore((s) => s.vendors);
  const products   = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const settings   = useAppStore((s) => s.settings);

  const printBtnRef = useRef<HTMLButtonElement>(null);

  const dispatch = dispatches.find((d) => d.id === challanId);
  const job      = jobWorks.find((j) => j.id === jobId);
  const vendor   = vendors.find((v) => v.id === job?.vendorId) ?? null;

  // ── ESC closes the dialog ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  // ── Auto-focus Print button ──────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => printBtnRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  if (!dispatch || !job) return null;

  const printData = buildChallanPrintData(dispatch, job, vendor, products, categories, settings);

  const handlePrint  = () => printChallan(printData);
  const handleViewChallan = () => navigate(`/challans/${challanId}`);

  return (
    <>
      {/* ── Print CSS injected globally: hides everything except the preview ── */}
      <style>{CHALLAN_PRINT_CSS}</style>

      {/* ── Modal overlay (hidden on print via .no-print) ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Challan preview"
        className="no-print fixed inset-0 z-50 flex flex-col items-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8"
      >
        {/* ── Top bar: title + action buttons ── */}
        <div className="no-print w-full max-w-[860px] px-4 mb-4 flex items-center gap-3 flex-shrink-0">
          {/* Left: success badge */}
          <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <span className="text-green-600 text-lg leading-none">✓</span>
            <div>
              <p className="text-sm font-bold text-green-800">Dispatched Successfully</p>
              <p className="text-xs text-green-600">{job.jobNumber} · {dispatch.challanNumber}</p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleViewChallan}
              className="no-print inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-white text-sm font-medium text-charcoal hover:bg-surface transition-colors"
            >
              <ExternalLink size={14} />
              View Challan
            </button>
            <button
              ref={printBtnRef}
              type="button"
              onClick={handlePrint}
              className="no-print inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 shadow-sm"
            >
              <Printer size={15} />
              Print A5
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="no-print ml-1 p-2 rounded-lg border border-border bg-white text-muted hover:text-charcoal hover:bg-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── A5 preview card — this IS the print target ── */}
        <div className="w-full max-w-[860px] px-4 flex-shrink-0">
          {/* Paper shadow / frame */}
          <div className="rounded-xl shadow-2xl ring-1 ring-black/10 bg-white">
            {/* Page label */}
            <div className="no-print flex items-center justify-between bg-gray-700 rounded-t-xl px-4 py-1.5 text-xs text-gray-300">
              <span className="font-medium">A5 Landscape — Print Preview</span>
              <span className="font-mono text-gray-400">{dispatch.challanNumber}</span>
            </div>

            {/* The actual A5 content — also the print target */}
            <ChallanPrintPreview data={printData} />
          </div>
        </div>

        {/* ── Keyboard hint ── */}
        <p className="no-print mt-4 text-xs text-white/60">
          <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">Esc</kbd> — close &nbsp;·&nbsp;
          <kbd className="bg-white/10 px-1.5 py-0.5 rounded font-mono">Ctrl+P</kbd> — print
        </p>
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
  const vendorTriggerRef    = useRef<HTMLButtonElement>(null);
  const productCardRef      = useRef<HTMLDivElement>(null);
  const addAllBtnRef        = useRef<HTMLButtonElement>(null);
  /** Ref for the Add button on single-item references — auto-focused on ref select */
  const addSingleBtnRef     = useRef<HTMLButtonElement>(null);

  // Auto-focus vendor field on mount
  useEffect(() => {
    setTimeout(() => vendorTriggerRef.current?.focus(), 0);
  }, []);

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

  // ESC → discard draft and go back to job works list
  useEscapeBack(() => { clearDraft(); navigate('/job-works'); }, !printDialog?.open);

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

  // Pre-fill drafts when reference changes.
  // Keys are itemKey = "<productId>::<variantId|idx>" so that two items in the
  // same reference that share the same productId (but differ by variantId) never
  // stomp each other's qty/rate/variant values.
  useEffect(() => {
    if (!selectedRefData) { setDraftRates({}); setDraftQtys({}); setDraftWeights({}); setDraftVariants({}); return; }
    const rates:    Record<string, string> = {};
    const qtys:     Record<string, string> = {};
    const weights:  Record<string, string> = {};
    const variants: Record<string, string> = {};
    refItems.forEach((item, idx) => {
      const prod          = products.find((p) => p.id === item.productId);
      const activeVars    = prod?.variants.filter((v) => v.status === 'Active') ?? [];
      // Resolve the correct variant: prefer the one stored on the reference item,
      // then first active variant, then first variant of any status.
      const resolvedVar   =
        item.variantId ??
        activeVars[0]?.id ??
        prod?.variants[0]?.id ??
        '';
      const key           = makeItemKey(item.productId, resolvedVar, idx);
      qtys[key]           = String(item.pieces);
      rates[key]          = prod?.rate ? String(prod.rate) : '';
      weights[key]        = '';
      variants[key]       = resolvedVar;
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

  // Auto-focus behavior when a reference is selected:
  //   • multi-item  → focus "Add All" button
  //   • single-item → focus the Add button directly (user can hit Enter immediately)
  useEffect(() => {
    if (!selectedRefId) return;
    if (refItems.length > 1) {
      setTimeout(() => addAllBtnRef.current?.focus(), 80);
    } else if (refItems.length === 1) {
      setTimeout(() => addSingleBtnRef.current?.focus(), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRefId]);

  // An item is "pending" when its itemKey is still present in draftQtys.
  // We annotate each refItem with its key so all downstream handlers stay in sync.
  const pendingRefItems = useMemo(
    () =>
      refItems
        .map((item, idx) => {
          const resolvedVariant = draftVariants[makeItemKey(item.productId, item.variantId, idx)]
            ?? item.variantId
            ?? '';
          const key = makeItemKey(item.productId, resolvedVariant || item.variantId, idx);
          return { ...item, _key: key, _idx: idx, _resolvedVariant: resolvedVariant };
        })
        .filter((item) => item._key in draftQtys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refItems, draftQtys, draftVariants],
  );

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

  /** Remove every line item that belongs to a reference group, freeing the reference for reuse */
  const removeRefGroup = (refNum: string) =>
    setLineItems((prev) => prev.filter((li) => (li.refNumber ?? '(no reference)') !== refNum));
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

  /**
   * Add a single pending item to the job by its itemKey.
   * itemKey format: "<productId>::<resolvedVariantId|idx>"
   */
  const addRefItemToJob = (itemKey: string, productId: string, resolvedVariantId: string) => {
    const qty    = Number(draftQtys[itemKey])    || 0;
    const rate   = Number(draftRates[itemKey])   || 0;
    const weight = Number(draftWeights[itemKey]) || undefined;
    if (!qty) return;
    const refNumber = selectedRefData?.referenceNumber;
    setLineItems((prev) => [...prev, { productId, variantId: resolvedVariantId, quantity: qty, rate, weight, refNumber }]);
    // Remove just this key from all four draft maps
    const newDraftQtys     = { ...draftQtys };     delete newDraftQtys[itemKey];
    const newDraftRates    = { ...draftRates };    delete newDraftRates[itemKey];
    const newDraftWeights  = { ...draftWeights };  delete newDraftWeights[itemKey];
    const newDraftVariants = { ...draftVariants }; delete newDraftVariants[itemKey];
    setDraftQtys(newDraftQtys);
    setDraftRates(newDraftRates);
    setDraftWeights(newDraftWeights);
    setDraftVariants(newDraftVariants);
    // How many items will remain pending after this removal?
    const remaining = pendingRefItems.filter((i) => i._key !== itemKey).length;
    resetRefAfterAdd(remaining);
  };

  const addAllRefItems = () => {
    const refNumber = selectedRefData?.referenceNumber;
    const newItems: LineItem[] = [];
    pendingRefItems.forEach((item) => {
      const qty    = Number(draftQtys[item._key])    || 0;
      const rate   = Number(draftRates[item._key])   || 0;
      const weight = Number(draftWeights[item._key]) || undefined;
      if (!qty) return;
      newItems.push({
        productId:  item.productId,
        variantId:  item._resolvedVariant || item.variantId || '',
        quantity:   qty,
        rate,
        weight,
        refNumber,
      });
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
        // Always start at 0 — createDispatch will increment sentQuantity
        // on the 'confirm' path, so pre-setting it here would double-count.
        sentQuantity: 0,
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
                  triggerRef={vendorTriggerRef}
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
                          // Use the already-resolved variant from the item key
                          const selectedVariantId = item._resolvedVariant || variantOptions[0]?.id || '';
                          const variant = variantOptions.find((v) => v.id === selectedVariantId) ?? variantOptions[0];
                          const qty    = Number(draftQtys[item._key])  || 0;
                          const rate   = Number(draftRates[item._key]) || 0;
                          const amount = qty * rate;

                          return (
                            <div key={item._key} className="rounded-lg border border-border overflow-hidden">
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
                      /* ── SINGLE-ITEM: editable form ── */
                      pendingRefItems.map((item) => {
                        const cat            = categories.find((c) => c.id === item.categoryId);
                        const prod           = products.find((p) => p.id === item.productId);
                        const activeVariants = prod?.variants.filter((v) => v.status === 'Active') ?? [];
                        const variantOptions = activeVariants.length > 0 ? activeVariants : (prod?.variants ?? []);
                        const hasMultipleVariants = variantOptions.length > 1;

                        // selectedVariantId: prefer what the user last picked (stored by _key),
                        // then the ref's own variantId, then first available.
                        const selectedVariantId =
                          draftVariants[item._key] ||
                          item._resolvedVariant ||
                          item.variantId ||
                          variantOptions[0]?.id ||
                          '';

                        const qty    = draftQtys[item._key]  ?? '';
                        const rate   = draftRates[item._key] ?? '';
                        const amount = (Number(qty) || 0) * (Number(rate) || 0);
                        const hasQty = Number(qty) > 0;

                        // When variant changes we need to update the draft key.
                        // Because key encodes the variant, we rebuild key on variant toggle.
                        const handleVariantChange = (newVariantId: string) => {
                          const oldKey = item._key;
                          const newKey = makeItemKey(item.productId, newVariantId, item._idx);
                          if (oldKey === newKey) return;
                          setDraftVariants((prev) => {
                            const next = { ...prev };
                            delete next[oldKey];
                            next[newKey] = newVariantId;
                            return next;
                          });
                          setDraftQtys((prev) => {
                            const next = { ...prev };
                            next[newKey] = next[oldKey] ?? '';
                            delete next[oldKey];
                            return next;
                          });
                          setDraftRates((prev) => {
                            const next = { ...prev };
                            next[newKey] = next[oldKey] ?? '';
                            delete next[oldKey];
                            return next;
                          });
                          setDraftWeights((prev) => {
                            const next = { ...prev };
                            next[newKey] = next[oldKey] ?? '';
                            delete next[oldKey];
                            return next;
                          });
                        };

                        return (
                          <div key={item._key} className="rounded-lg border border-border overflow-hidden">
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
                                        onClick={() => handleVariantChange(v.id)}
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
                                  data-product-rate={item._key}
                                  value={rate}
                                  onChange={(e) => setDraftRates((prev) => ({ ...prev, [item._key]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (e.shiftKey) {
                                        focusNextInForm(e.currentTarget, true);
                                      } else {
                                        const qtyInput = formRef.current?.querySelector<HTMLInputElement>(
                                          `input[data-product-qty="${item._key}"]`
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
                                    data-product-qty={item._key}
                                    value={qty}
                                    onChange={(e) => setDraftQtys((prev) => ({ ...prev, [item._key]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (e.shiftKey) {
                                          focusNextInForm(e.currentTarget, true);
                                        } else if (hasQty) {
                                          addRefItemToJob(item._key, item.productId, selectedVariantId);
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

                              {/* Add button — ref'd so it can be auto-focused for single-item refs */}
                              <div>
                                <button
                                  ref={addSingleBtnRef}
                                  type="button"
                                  disabled={!hasQty}
                                  onClick={() => addRefItemToJob(item._key, item.productId, selectedVariantId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && hasQty) {
                                      e.preventDefault();
                                      addRefItemToJob(item._key, item.productId, selectedVariantId);
                                    }
                                  }}
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
                                        <button
                                          type="button"
                                          tabIndex={-1}
                                          onClick={() => removeRefGroup(refNum)}
                                          className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-red-500 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                                          title={`Remove all items from ${refNum}`}
                                        >
                                          <Trash2 size={11} />
                                          <span>Remove group</span>
                                        </button>
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
