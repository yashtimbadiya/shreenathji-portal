import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Textarea } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../data/mockData';
import type { ReferenceItem } from '../types';
import { useEscapeBack } from '../hooks/useEscapeBack';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveItems(ref: {
  categoryId: string; productId: string;
  variantId?: string; pieces: number; items?: ReferenceItem[];
}): ReferenceItem[] {
  if (ref.items && ref.items.length > 0) return ref.items;
  return [{ categoryId: ref.categoryId, productId: ref.productId, variantId: ref.variantId, pieces: ref.pieces }];
}

// ─────────────────────────────────────────────────────────────────────────────
// List page
// ─────────────────────────────────────────────────────────────────────────────

export function ReferencesPage() {
  const references      = useAppStore((s) => s.references);
  const categories      = useAppStore((s) => s.categories);
  const products        = useAppStore((s) => s.products);
  const jobWorks        = useAppStore((s) => s.jobWorks);
  const deleteReference = useAppStore((s) => s.deleteReference);
  const checkConstraints = useAppStore((s) => s.checkReferenceDeleteConstraints);
  const navigate        = useNavigate();

  // N → Add new reference
  useNewItemShortcut(() => navigate('/references/new'));

  const usedReferenceNumbers = useMemo(() => {
    const set = new Set<string>();
    jobWorks.forEach((j) => { if (j.reference) set.add(j.reference.trim().toLowerCase()); });
    return set;
  }, [jobWorks]);

  const [deleteTarget,  setDeleteTarget]  = useState<{ id: string; refNumber: string; cascadeWarnings: string[] } | null>(null);

  const handleDeleteClick = (id: string, refNumber: string) => {
    const reasons = checkConstraints(id);
    // With cascade unlink behavior, always allow deletion — warn if job works will be unlinked
    setDeleteTarget({ id, refNumber, cascadeWarnings: reasons });
  };

  return (
    <div>
      <PageHeader
        title="References"
        subtitle={`${references.length} reference${references.length !== 1 ? 's' : ''}`}
        action={<Link to="/references/new"><Button>Add Reference</Button></Link>}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Reference No.', 'Subproducts', 'Total Pieces', 'Weight (kg)', 'Remarks', 'Created', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {references.map((ref) => {
                const items       = resolveItems(ref);
                const isUsed      = usedReferenceNumbers.has(ref.referenceNumber.trim().toLowerCase());
                const totalPieces = items.reduce((s, i) => s + i.pieces, 0);
                return (
                  <tr key={ref.id} className={`border-b border-border hover:bg-surface/50 ${isUsed ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-brand">{ref.referenceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {items.map((item, idx) => {
                          const cat  = categories.find((c) => c.id === item.categoryId);
                          const prod = products.find((p) => p.id === item.productId);
                          return (
                            <span key={idx} className="text-xs">
                              <span className="text-muted">{cat?.name ?? '—'} / </span>
                              <span className="font-medium text-charcoal">{prod?.name ?? '—'}</span>
                              <span className="text-muted ml-1">({item.pieces.toLocaleString('en-IN')} pcs)</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">{totalPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-muted">
                      {ref.weight != null
                        ? <span className="font-medium text-charcoal">{ref.weight.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{ref.remarks ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(ref.createdDate)}</td>
                    <td className="px-4 py-3">
                      {isUsed
                        ? <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 border-gray-200">Used</span>
                        : <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-50 text-green-700 border-green-200">Available</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!isUsed && (
                          <Link to={`/references/${ref.id}/edit`} className="text-muted hover:text-brand transition-colors" title="Edit">
                            <Pencil size={14} />
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteClick(ref.id, ref.referenceNumber)}
                          className="text-muted hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {references.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No references yet. <Link to="/references/new" className="text-brand hover:underline">Add one</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteReference(deleteTarget.id); setDeleteTarget(null); } }}
        title="Delete Reference"
        message={
          deleteTarget?.cascadeWarnings && deleteTarget.cascadeWarnings.length > 0
            ? `Delete reference "${deleteTarget?.refNumber}"? The reference field will be cleared on the following linked job works:\n• ${deleteTarget.cascadeWarnings.join('\n• ')}`
            : `Delete reference "${deleteTarget?.refNumber}"? This cannot be undone.`
        }
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared multi-product reference form
// ─────────────────────────────────────────────────────────────────────────────

interface RefFormProps {
  mode: 'add' | 'edit';
  initialRefNumber?: string;
  initialItems?: ReferenceItem[];
  initialRemarks?: string;
  initialWeight?: number;
  takenRefNumbers: Set<string>;
  /** Called when the form is saved */
  onSave: (data: { refNumber: string; items: ReferenceItem[]; remarks: string; weight?: number }) => void;
  onCancel: () => void;
  /** URL to redirect to for adding a new category (with ?returnTo= appended) */
  returnPath: string;
}

function ReferenceForm({
  mode, initialRefNumber = '', initialItems = [], initialRemarks = '', initialWeight,
  takenRefNumbers, onSave, onCancel, returnPath,
}: RefFormProps) {
  const navigate   = useNavigate();
  const categories = useAppStore((s) => s.categories);
  const products   = useAppStore((s) => s.products);

  const [refNumber, setRefNumber] = useState(initialRefNumber);
  const [remarks,   setRemarks]   = useState(initialRemarks);
  const [totalWeight, setTotalWeight] = useState(initialWeight != null ? String(initialWeight) : '');
  const [refError,  setRefError]  = useState('');

  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [draftProductId,  setDraftProductId]  = useState('');
  const [draftVariantId,  setDraftVariantId]  = useState('');
  const [draftPieces,     setDraftPieces]     = useState('');

  const [items, setItems] = useState<ReferenceItem[]>(initialItems);

  // Ref to the save button so Ctrl+Enter can trigger it
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  // Ref to the Category SearchableSelect trigger — after Add Product we cycle focus back here
  const draftCategoryTriggerRef = useRef<HTMLButtonElement>(null);

  const draftCategoryProducts = useMemo(
    () => products.filter((p) => p.categoryId === draftCategoryId && p.status === 'Active'),
    [products, draftCategoryId],
  );
  const draftProductData = products.find((p) => p.id === draftProductId);
  const draftVariants    = draftProductData?.variants.filter((v) => v.status === 'Active') ?? [];

  const canAddItem = !!draftCategoryId && !!draftProductId && !!draftPieces;
  const canSave    = !!refNumber && items.length > 0 && !refError;

  // ESC → cancel (same as clicking the Cancel button)
  useEscapeBack(onCancel);

  // ── Ctrl+Enter → save ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) {
          onSave({ refNumber, items, remarks, weight: totalWeight ? Number(totalWeight) : undefined });
        } else {
          saveBtnRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, refNumber, items, remarks, totalWeight, onSave]);

  const handleRefNumberChange = (value: string) => {
    setRefNumber(value);
    setRefError(takenRefNumbers.has(value.trim().toLowerCase()) ? `"${value}" already exists` : '');
  };

  const addDraftItem = () => {
    if (!canAddItem) return;
    setItems((prev) => [...prev, {
      categoryId: draftCategoryId,
      productId:  draftProductId,
      variantId:  draftVariantId || undefined,
      pieces:     Number(draftPieces),
    }]);
    setDraftCategoryId('');
    setDraftProductId('');
    setDraftVariantId('');
    setDraftPieces('');
    // Cycle focus back to the first field so the user can immediately add another product
    setTimeout(() => draftCategoryTriggerRef.current?.focus(), 0);
  };

  const removeDraftItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSave({ refNumber, items, remarks, weight: totalWeight ? Number(totalWeight) : undefined });
  };

  return (
    <div>
      {/* ── Keyboard hint ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on Pieces — Add Subproduct &amp; cycle back to Product</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> — navigate options</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Reference
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" data-form>
        {/* ── Header fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input
              label="Reference Number *"
              value={refNumber}
              onChange={(e) => handleRefNumberChange(e.target.value)}
              placeholder="e.g. REF-001"
              required
              disabled={mode === 'edit'}
              autoFocus={mode === 'add'}
            />
            {refError && <p className="text-xs text-red-500 mt-1">{refError}</p>}
          </div>
          <Textarea
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional notes"
          />
        </div>

        {/* ── Total weight for this reference ── */}
        <div className="rounded-lg border border-border bg-surface/50 px-4 py-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[180px] max-w-xs">
              <Input
                label="Total Weight (kg) — optional"
                type="number"
                min="0"
                step="0.001"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
                placeholder="e.g. 12.500"
              />
              <p className="text-xs text-muted mt-1">
                Enter the total weight for this entire reference (not per subproduct).
              </p>
            </div>
            {totalWeight && Number(totalWeight) > 0 && (
              <div className="flex items-center gap-2 mt-6">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 border border-brand/20 px-3 py-1.5 text-sm font-semibold text-brand">
                  ⚖ {Number(totalWeight).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Committed product lines ── */}
        <div>
          <h4 className="text-sm font-semibold text-charcoal mb-3">
            Subproducts
            <span className="ml-2 text-xs font-normal text-muted">({items.length} added)</span>
          </h4>

          {items.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    {['#', 'Product', 'Subproduct', 'Variant', 'Pieces', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const cat  = categories.find((c) => c.id === item.categoryId);
                    const prod = products.find((p) => p.id === item.productId);
                    const vari = prod?.variants.find((v) => v.id === item.variantId);
                    return (
                      <tr key={idx} className="border-b border-border last:border-0 hover:bg-surface/40">
                        <td className="px-3 py-2.5 text-muted text-xs">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-muted">{cat?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-charcoal">{prod?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted">{vari?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 font-semibold">{item.pieces.toLocaleString('en-IN')}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button type="button" onClick={() => removeDraftItem(idx)}
                            className="text-muted hover:text-red-500 transition-colors" title="Remove">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Draft add row ── */}
          <div className="rounded-lg border border-dashed border-border p-4 bg-surface/40">
            <p className="text-xs font-semibold text-muted uppercase mb-3">Add Subproduct</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {/* Product with "+ Add new product" */}
              <SearchableSelect
                label="Product *"
                value={draftCategoryId}
                onChange={(val) => { setDraftCategoryId(val); setDraftProductId(''); setDraftVariantId(''); }}
                placeholder="Product…"
                options={categories.filter((c) => c.status === 'Active').map((c) => ({ value: c.id, label: c.name }))}
                onAddNew={() => navigate(`/categories/new?returnTo=${encodeURIComponent(returnPath)}`)}
                addNewLabel="Add new product"
                triggerRef={draftCategoryTriggerRef}
              />
              <SearchableSelect
                label="Subproduct *"
                value={draftProductId}
                onChange={(val) => { setDraftProductId(val); setDraftVariantId(''); }}
                placeholder={draftCategoryId ? 'Subproduct…' : 'Select product first'}
                disabled={!draftCategoryId}
                options={draftCategoryProducts.map((p) => ({ value: p.id, label: p.name }))}
                onAddNew={
                  draftCategoryId
                    ? () => navigate(`/products/new?category=${encodeURIComponent(draftCategoryId)}&returnTo=${encodeURIComponent(returnPath)}`)
                    : undefined
                }
                addNewLabel={draftCategoryId ? 'Add new subproduct' : 'Select product first'}
              />
              {draftVariants.length > 0 && (
                <SearchableSelect
                  label="Variant (optional)"
                  value={draftVariantId}
                  onChange={setDraftVariantId}
                  placeholder="Variant…"
                  options={draftVariants.map((v) => ({ value: v.id, label: v.name }))}
                />
              )}
              <Input
                label="Pieces *"
                type="number"
                min="1"
                value={draftPieces}
                onChange={(e) => setDraftPieces(e.target.value)}
                placeholder="0"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftItem(); } }}
              />
            </div>
            <Button type="button" variant="outline" disabled={!canAddItem} onClick={addDraftItem}>
              <Plus size={14} className="mr-1.5" />
              Add Subproduct
            </Button>
          </div>

          {items.length === 0 && (
            <p className="text-xs text-orange-600 mt-2">Add at least one subproduct line to save.</p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3">
          <button
            ref={saveBtnRef}
            type="submit"
            disabled={!canSave}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mode === 'add' ? 'Save Reference' : 'Update Reference'}
            {canSave && (
              <kbd className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
            )}
          </button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add page
// ─────────────────────────────────────────────────────────────────────────────

export function AddReferencePage() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const references    = useAppStore((s) => s.references);
  const addReference  = useAppStore((s) => s.addReference);

  // Support ?returnTo=/job-works/create so after saving we go back to job work
  const returnTo = searchParams.get('returnTo') ?? '/references';

  const takenRefNumbers = useMemo(
    () => new Set(references.map((r) => r.referenceNumber.trim().toLowerCase())),
    [references],
  );

  // The current page path (including search params) — passed down so the
  // category add page can come back here
  const selfPath = `/references/new${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const handleSave = ({ refNumber, items, remarks, weight }: { refNumber: string; items: ReferenceItem[]; remarks: string; weight?: number }) => {
    const first = items[0];
    addReference({
      referenceNumber: refNumber,
      categoryId:  first.categoryId,
      productId:   first.productId,
      variantId:   first.variantId,
      pieces:      items.reduce((s, i) => s + i.pieces, 0),
      weight:      weight,
      items,
      remarks: remarks || undefined,
      createdDate: new Date().toISOString().slice(0, 10),
    });
    // If the return path requests the new ref number (placeholder), inject it
    // so the caller (e.g. Create Job Work) can auto-select it + restore form.
    try {
      const url = new URL(returnTo, window.location.origin);
      if (url.searchParams.has('newRef')) {
        url.searchParams.set('newRef', refNumber);
        navigate(url.pathname + url.search);
        return;
      }
    } catch { /* ignore malformed return paths */ }
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader
        title="Add Reference"
        subtitle={returnTo !== '/references' ? '← Will return to job work after saving' : undefined}
      />
      <Card className="p-6 max-w-3xl">
        <ReferenceForm
          mode="add"
          takenRefNumbers={takenRefNumbers}
          onSave={handleSave}
          onCancel={() => navigate(returnTo)}
          returnPath={selfPath}
        />
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit page
// ─────────────────────────────────────────────────────────────────────────────

export function EditReferencePage() {
  const { id }          = useParams<{ id: string }>();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const references      = useAppStore((s) => s.references);
  const updateReference = useAppStore((s) => s.updateReference);

  const returnTo = searchParams.get('returnTo') ?? '/references';
  const ref      = references.find((r) => r.id === id);

  const takenRefNumbers = useMemo(
    () => new Set(references.filter((r) => r.id !== id).map((r) => r.referenceNumber.trim().toLowerCase())),
    [references, id],
  );

  const selfPath = `/references/${id}/edit${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  if (!ref) {
    return (
      <div>
        <PageHeader title="Edit Reference" />
        <Card className="p-6">
          <p className="text-sm text-muted">Reference not found.</p>
          <Button className="mt-4" onClick={() => navigate('/references')}>Back</Button>
        </Card>
      </div>
    );
  }

  const initialItems = resolveItems(ref);

  const handleSave = ({ items, remarks, weight }: { refNumber: string; items: ReferenceItem[]; remarks: string; weight?: number }) => {
    const first = items[0];
    updateReference(ref.id, {
      categoryId: first.categoryId,
      productId:  first.productId,
      variantId:  first.variantId,
      pieces:     items.reduce((s, i) => s + i.pieces, 0),
      weight,
      items,
      remarks: remarks || undefined,
    });
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title={`Edit Reference — ${ref.referenceNumber}`} />
      <Card className="p-6 max-w-3xl">
        <ReferenceForm
          mode="edit"
          initialRefNumber={ref.referenceNumber}
          initialItems={initialItems}
          initialRemarks={ref.remarks ?? ''}
          initialWeight={ref.weight}
          takenRefNumbers={takenRefNumbers}
          onSave={handleSave}
          onCancel={() => navigate(returnTo)}
          returnPath={selfPath}
        />
      </Card>
    </div>
  );
}
