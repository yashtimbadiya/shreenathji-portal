import { ChevronRight, Plus, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Breadcrumb, Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Select } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';

// ─── Session-storage keys (survive round-trip to Add Reference / Category) ───
const DRAFT_KEY  = 'shjw:create-job-draft-v2';
const SCROLL_KEY = 'shjw:create-job-scroll-v2';

interface LineItem {
  productId: string;
  variantId: string;
  quantity: number;
  rate: number;
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
  const [lineItems,     setLineItems]     = useState<LineItem[]>(saved?.lineItems ?? []);

  // Refs
  const confirmBtnRef       = useRef<HTMLButtonElement>(null);
  const formRef             = useRef<HTMLDivElement>(null);
  const refSelectTriggerRef = useRef<HTMLButtonElement>(null);
  const productCardRef      = useRef<HTMLDivElement>(null);

  // ── Persist draft to sessionStorage on every change ──────────────────────
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        vendorId, process, issueDate, expectedDate, priority,
        selectedRefId, draftRates, draftQtys, lineItems,
      } satisfies DraftState));
    } catch { /* quota errors – ignore */ }
  }, [vendorId, process, issueDate, expectedDate, priority,
      selectedRefId, draftRates, draftQtys, lineItems]);

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

  // ── Ctrl+Enter → Confirm & Dispatch ──────────────────────────────────────
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
    if (!selectedRefData) { setDraftRates({}); setDraftQtys({}); return; }
    const rates: Record<string, string> = {};
    const qtys:  Record<string, string> = {};
    refItems.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      qtys[item.productId]  = String(item.pieces);
      rates[item.productId] = prod?.rate ? String(prod.rate) : '';
    });
    setDraftRates(rates);
    setDraftQtys(qtys);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRefId]);

  // Scroll product card into view when ref selected
  useEffect(() => {
    if (selectedRefId && productCardRef.current) {
      productCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
  const updateLineItem = (idx: number, field: 'quantity' | 'rate', value: number) =>
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
    const qty  = Number(draftQtys[productId])  || 0;
    const rate = Number(draftRates[productId]) || 0;
    if (!qty) return;
    const refNumber = selectedRefData?.referenceNumber;
    setLineItems((prev) => [...prev, { productId, variantId, quantity: qty, rate, refNumber }]);
    const newDraftQtys  = { ...draftQtys };  delete newDraftQtys[productId];
    const newDraftRates = { ...draftRates }; delete newDraftRates[productId];
    setDraftQtys(newDraftQtys);
    setDraftRates(newDraftRates);
    // How many items will remain pending after this removal?
    const remaining = pendingRefItems.filter((i) => i.productId !== productId).length;
    resetRefAfterAdd(remaining);
  };

  const addAllRefItems = () => {
    const refNumber = selectedRefData?.referenceNumber;
    const newItems: LineItem[] = [];
    refItems.forEach((item) => {
      const qty  = Number(draftQtys[item.productId])  || 0;
      const rate = Number(draftRates[item.productId]) || 0;
      if (!qty) return;
      const prod      = products.find((p) => p.id === item.productId);
      const variantId = item.variantId ?? prod?.variants[0]?.id ?? '';
      newItems.push({ productId: item.productId, variantId, quantity: qty, rate, refNumber });
    });
    if (newItems.length === 0) return;
    setLineItems((prev) => [...prev, ...newItems]);
    setDraftQtys({});
    setDraftRates({});
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
      createDispatch({
        jobWorkId:    jobId,
        date:         issueDate,
        vehicleNumber: '',
        driver:        '',
        transport:     'Own Vehicle',
        items:         rawItems.map((i) => ({ jobWorkItemId: i.id, variantId: i.variantId, quantity: i._dispatchQty ?? 0 })),
        createdBy:     currentUser?.name ?? 'User',
      });
    }

    clearDraft();
    navigate(`/job-works/${jobId}`);
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
                <h3 className="text-base font-semibold mb-1">Product Selection</h3>
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
                        — {pendingRefItems.length} product{pendingRefItems.length !== 1 ? 's' : ''} pending
                      </span>
                    </div>

                    {pendingRefItems.map((item, itemIndex) => {
                      const cat       = categories.find((c) => c.id === item.categoryId);
                      const prod      = products.find((p) => p.id === item.productId);
                      const variantId = item.variantId ?? prod?.variants[0]?.id ?? '';
                      const qty       = draftQtys[item.productId]  ?? '';
                      const rate      = draftRates[item.productId] ?? '';
                      const amount    = (Number(qty) || 0) * (Number(rate) || 0);
                      const hasQty    = Number(qty) > 0;
                      const isFirst   = itemIndex === 0;

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

                          <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
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
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    // Move to the Pieces input for this product
                                    const qtyInput = formRef.current?.querySelector<HTMLInputElement>(
                                      `input[data-product-qty="${item.productId}"]`
                                    );
                                    qtyInput?.focus();
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
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      if (hasQty) {
                                        // Add this item — resetRefAfterAdd handles focus
                                        addRefItemToJob(item.productId, variantId);
                                      }
                                      // If qty is empty, do nothing (don't jump away)
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
                                onClick={() => addRefItemToJob(item.productId, variantId)}
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
                      );
                    })}

                    {/* Add all at once (when >1 item) */}
                    {pendingRefItems.length > 1 && (
                      <button
                        type="button"
                        onClick={addAllRefItems}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand/40 px-4 py-2.5 text-sm font-medium text-brand hover:bg-brand/5 transition-colors"
                      >
                        <Plus size={14} />
                        Add All {pendingRefItems.length} Products to Job
                      </button>
                    )}
                  </div>
                )}

                {/* Placeholder: no ref selected */}
                {!selectedRefData && (
                  <div className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted mb-5">
                    Select a reference number above to load products
                  </div>
                )}

                {/* All products from current ref added */}
                {selectedRefData && pendingRefItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-green-300 bg-green-50 px-6 py-4 text-center text-sm text-green-700 mb-5">
                    ✓ All products from <strong>{selectedRefData.referenceNumber}</strong> have been added.
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
                              {['#', 'Category', 'Product', 'Rate (₹)', 'Pieces', 'Amount', ''].map((h) => (
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
    </div>
  );
}
