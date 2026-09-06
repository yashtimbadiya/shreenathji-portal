import { Check, Link2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Select } from '../components/ui/Input';
import { BlockedDeleteDialog, ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';
import type { ProductVariant, VariantAttribute } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Subproducts list page
// ─────────────────────────────────────────────────────────────────────────────
export function ProductsPage() {
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const deleteProduct = useAppStore((s) => s.deleteProduct);
  const checkConstraints = useAppStore((s) => s.checkProductDeleteConstraints);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<{ name: string; reasons: string[] } | null>(null);

  // N → navigate to Add Subproduct page
  useNewItemShortcut(() => navigate('/products/new'));

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Subproducts"
        subtitle={`${filtered.length} subproducts`}
        action={<Link to="/products/new"><Button><Plus size={16} /> Add Subproduct</Button></Link>}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search subproducts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-brand"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            <option value="">All Products</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border text-sm"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Subproduct', 'Product', 'Code', 'Unit', 'Rate (₹)', 'Variants', 'Current Stock', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId);
                const stock = p.variants.reduce((s, v) => s + v.factoryStock, 0);
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link to={`/products/${p.id}`} className="font-medium text-brand hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3">{cat?.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3">{p.unit}</td>
                    <td className="px-4 py-3">
                      {p.rate !== undefined
                        ? <span className="font-medium text-charcoal">₹{p.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        : <span className="text-muted">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">{p.variants.length} Variants</td>
                    <td className="px-4 py-3">{stock.toLocaleString()} {p.unit === 'Pic' ? 'Pic' : p.unit === 'Piece' ? 'pcs' : ''}</td>
                    <td className="px-4 py-3"><ActiveBadge active={p.status === 'Active'} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Link to={`/products/${p.id}`} className="text-xs text-brand hover:underline">View</Link>
                        <Link to={`/products/${p.id}/edit`} className="text-xs text-muted hover:text-brand flex items-center gap-1">
                          <Pencil size={12} /> Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            const reasons = checkConstraints(p.id);
                            if (reasons.length > 0) {
                              setBlockedTarget({ name: p.name, reasons });
                            } else {
                              setDeleteTarget({ id: p.id, name: p.name });
                            }
                          }}
                          className="text-xs text-muted hover:text-red-500 flex items-center gap-1 transition-colors"
                          title="Delete subproduct"
                        >
                          <Trash2 size={12} /> Delete
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteProduct(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete Subproduct"
        message={`Delete "${deleteTarget?.name}"? This will remove all its variants and cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
      <BlockedDeleteDialog
        open={!!blockedTarget}
        onClose={() => setBlockedTarget(null)}
        title="Cannot Delete Subproduct"
        entityName={blockedTarget?.name ?? ''}
        reasons={blockedTarget?.reasons ?? []}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Subproduct page  (with inline shared-variants section)
// ─────────────────────────────────────────────────────────────────────────────
export function AddProductPage() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const categories     = useAppStore((s) => s.categories);
  const addProduct     = useAppStore((s) => s.addProduct);

  const [name,       setName]       = useState('');
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');
  const [code,       setCode]       = useState('');
  const [unit,       setUnit]       = useState('Pic');
  const [rate,       setRate]       = useState('');
  const [submitted,  setSubmitted]  = useState(false);

  const returnTo = searchParams.get('returnTo') ?? '/products';

  const submitRef = useRef<HTMLButtonElement>(null);

  // Validation: name + category required; selected category must have ≥1 shared variant
  const selectedCategory  = categories.find((c) => c.id === categoryId);
  const inheritedSvCount  = selectedCategory?.sharedVariantIds?.length ?? 0;
  const categoryHasSvs    = inheritedSvCount > 0;
  const canSave           = !!name && !!categoryId && !!rate && categoryHasSvs;

  // ESC → cancel / go back
  useEscapeBack(() => navigate(returnTo));

  // Ctrl+Enter → submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) submitRef.current?.click();
        else { setSubmitted(true); submitRef.current?.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSave) return;

    // addProduct in the store auto-attaches the parent category's sharedVariantIds as variants
    addProduct({
      name: name.trim(),
      categoryId,
      code: code.trim(),
      unit,
      rate: rate ? Number(rate) : undefined,
      status: 'Active',
    });

    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title="Add Subproduct" />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> — navigate dropdown</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Subproduct
        </span>
      </div>

      <form onSubmit={handleSubmit} data-form>
        <Card className="p-6 space-y-4 max-w-2xl">
          <h3 className="text-base font-semibold">Subproduct Details</h3>
          <Input
            label="Subproduct Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <SearchableSelect
            label="Product *"
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setSubmitted(false); }}
            placeholder="Search product..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onAddNew={() => navigate(`/categories/new?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
            addNewLabel="Add new product"
          />

          {/* Inherited variants status banner */}
          {categoryId && (
            <>
              {categoryHasSvs ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                  <Link2 size={13} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>{inheritedSvCount} shared variant{inheritedSvCount !== 1 ? 's' : ''}</strong> from "{selectedCategory?.name}" will be automatically added to this subproduct.
                  </span>
                </div>
              ) : (
                <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
                  submitted ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                  <Link2 size={13} className="shrink-0 mt-0.5" />
                  <span className="flex-1">
                    <strong>"{selectedCategory?.name}" has no shared variants.</strong>{' '}
                    At least one shared variant is required.{' '}
                    <Link
                      to={`/categories/${categoryId}/edit?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                      className="underline font-semibold hover:opacity-80"
                    >
                      Configure shared variants →
                    </Link>
                  </span>
                </div>
              )}
            </>
          )}

          {/* Prompt if submitted without selecting a category */}
          {submitted && !categoryId && (
            <p className="text-xs text-red-600">Please select a product.</p>
          )}

          <Input
            label="Subproduct Code — optional"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MAR-ELA"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              options={[
                { value: 'Pic',   label: 'Pic'   },
                { value: 'Piece', label: 'Piece' },
                { value: 'Kg',    label: 'Kg'    },
              ]}
            />
            <Input
              label="Rate (₹) *"
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </Card>

        {/* ── Actions ── */}
        <div className="mt-6 flex gap-3">
          <Button ref={submitRef} type="submit" disabled={submitted && !canSave}>
            Save Subproduct
            {canSave && (
              <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Subproduct page — full form
// ─────────────────────────────────────────────────────────────────────────────

/** Inline-editable variant row used inside the edit page */
interface EditVariantRowProps {
  variant: ProductVariant;
  unit: string;
  onSave: (data: Pick<ProductVariant, 'name' | 'sku' | 'status' | 'attributes'>) => void;
  onDelete: () => void;
  deleteBlockReasons: string[];
  linkedSharedVariantName?: string;
}

function EditVariantRow({ variant, unit, onSave, onDelete, deleteBlockReasons, linkedSharedVariantName }: EditVariantRowProps) {
  const [editing,  setEditing]  = useState(false);
  const [vName,    setVName]    = useState(variant.name);
  const [vSku,     setVSku]     = useState(variant.sku);
  const [vStatus,  setVStatus]  = useState<'Active' | 'Disabled'>(variant.status);
  // attributes as a simple comma-separated "key:value" string for easy editing
  const attrsToStr = (attrs: VariantAttribute[]) =>
    attrs.map((a) => `${a.key}:${a.value}`).join(', ');
  const [vAttrs, setVAttrs] = useState(attrsToStr(variant.attributes));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState(false);

  const total = variant.factoryStock + variant.withVendor;

  const parseAttrs = (raw: string): VariantAttribute[] =>
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const idx = s.indexOf(':');
        return idx === -1
          ? { key: s, value: '' }
          : { key: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
      });

  const handleSave = () => {
    if (!vName.trim() || !vSku.trim()) return;
    onSave({ name: vName.trim(), sku: vSku.trim(), status: vStatus, attributes: parseAttrs(vAttrs) });
    setEditing(false);
  };

  const handleCancel = () => {
    setVName(variant.name);
    setVSku(variant.sku);
    setVStatus(variant.status);
    setVAttrs(attrsToStr(variant.attributes));
    setEditing(false);
  };

  if (editing) {
    return (
      <>
        <tr className="border-b border-border bg-brand/5">
          <td className="px-3 py-2">
            <input
              autoFocus
              value={vName}
              onChange={(e) => setVName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
              placeholder="Variant name"
              className="w-full px-2.5 py-1.5 rounded-lg border border-brand/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </td>
          <td className="px-3 py-2">
            <input
              value={vSku}
              onChange={(e) => setVSku(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
              placeholder="SKU"
              className="w-full px-2.5 py-1.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </td>
          <td className="px-3 py-2">
            <input
              value={vAttrs}
              onChange={(e) => setVAttrs(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') handleCancel(); }}
              placeholder="Key:Value, Key:Value"
              title="Comma-separated key:value pairs e.g. Size:M, Color:Red"
              className="w-full px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </td>
          <td className="px-3 py-2 text-muted text-sm">{variant.factoryStock.toLocaleString()}</td>
          <td className="px-3 py-2 text-muted text-sm">{variant.withVendor.toLocaleString()}</td>
          <td className="px-3 py-2 font-medium text-sm">{total.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
          <td className="px-3 py-2">
            <button
              type="button"
              onClick={() => setVStatus((s) => s === 'Active' ? 'Disabled' : 'Active')}
              className={`px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors ${
                vStatus === 'Active'
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {vStatus}
            </button>
          </td>
          <td className="px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!vName.trim() || !vSku.trim()}
                className="p-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
                title="Save (Enter)"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-muted hover:bg-surface transition-colors"
                title="Cancel (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          </td>
        </tr>
        <tr>
          <td colSpan={8} className="px-3 pb-2 pt-0">
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-muted">
                <kbd className="bg-surface border border-border px-1 rounded font-mono">Esc</kbd> cancel
              </p>
              <p className="text-xs text-muted italic">Attributes: comma-separated <code>Key:Value</code> pairs</p>
              {linkedSharedVariantName && (
                <p className="text-xs text-brand flex items-center gap-1">
                  <Link2 size={10} />
                  Linked to shared variant "{linkedSharedVariantName}"
                </p>
              )}
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-surface/50 group">
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{variant.name}</span>
            {linkedSharedVariantName && (
              <span
                title={`Syncs from "${linkedSharedVariantName}"`}
                className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand/10 text-brand border border-brand/20 px-1.5 py-0.5 rounded-full"
              >
                <Link2 size={9} /> synced
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 font-mono text-xs text-muted">{variant.sku}</td>
        <td className="px-3 py-3 text-xs text-muted">
          {variant.attributes.length > 0
            ? variant.attributes.map((a) => `${a.key}: ${a.value}`).join(', ')
            : <span className="text-border">—</span>}
        </td>
        <td className="px-3 py-3 text-sm">{variant.factoryStock.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-3 py-3 text-sm">{variant.withVendor.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-3 py-3 font-medium text-sm">{total.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-3 py-3">
          <ActiveBadge active={variant.status === 'Active'} />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg text-muted hover:text-brand hover:bg-brand/5 transition-colors"
              title="Edit variant"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => deleteBlockReasons.length > 0 ? setBlockedDelete(true) : setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete variant"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        title="Delete Variant"
        message={`Delete variant "${variant.name}" (${variant.sku})? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
      <BlockedDeleteDialog
        open={blockedDelete}
        onClose={() => setBlockedDelete(false)}
        title="Cannot Delete Variant"
        entityName={variant.name}
        reasons={deleteBlockReasons}
      />
    </>
  );
}

export function EditProductPage() {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const categories     = useAppStore((s) => s.categories);
  const products       = useAppStore((s) => s.products);
  const sharedVariants = useAppStore((s) => s.sharedVariants);
  const updateProduct  = useAppStore((s) => s.updateProduct);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const addVariant     = useAppStore((s) => s.addVariant);
  const updateVariant  = useAppStore((s) => s.updateVariant);
  const deleteVariant  = useAppStore((s) => s.deleteVariant);
  const checkVariantDeleteConstraints = useAppStore((s) => s.checkVariantDeleteConstraints);

  const product  = products.find((p) => p.id === id);
  const category = product ? categories.find((c) => c.id === product.categoryId) : null;

  // ── Product detail fields ──
  const [name,       setName]       = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [code,       setCode]       = useState(product?.code ?? '');
  const [unit,       setUnit]       = useState(product?.unit ?? 'Pic');
  const [rate,       setRate]       = useState(product?.rate !== undefined ? String(product.rate) : '');
  const [status,     setStatus]     = useState<'Active' | 'Disabled'>(product?.status ?? 'Active');

  // ── Inherited shared variants (stored on the parent category) ──
  const [selectedSvIds, setSelectedSvIds] = useState<string[]>(
    category?.sharedVariantIds ?? [],
  );

  // ── Add-variant inline form ──
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [addMode,        setAddMode]        = useState<'shared' | 'custom'>('shared');
  const [selectedSvId,   setSelectedSvId]   = useState('');
  const [newVName,       setNewVName]       = useState('');
  const [newVSku,        setNewVSku]        = useState('');

  const activeSharedVariants = useMemo(
    () => sharedVariants.filter((sv) => sv.status === 'Active'),
    [sharedVariants],
  );

  const existingSharedIds = useMemo(
    () => new Set(product?.variants.map((v) => v.sharedVariantId).filter(Boolean) ?? []),
    [product?.variants],
  );

  const availableShared = useMemo(
    () => activeSharedVariants.filter((sv) => !existingSharedIds.has(sv.id)),
    [activeSharedVariants, existingSharedIds],
  );

  const selectedSv = sharedVariants.find((sv) => sv.id === selectedSvId);
  const canAddVariant = addMode === 'shared' ? !!selectedSvId : newVName.trim() !== '' && newVSku.trim() !== '';

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!name && !!categoryId && !!rate;

  // ESC → back
  useEscapeBack(() => navigate(product ? `/products/${product.id}` : '/products'));

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

  if (!product) {
    return (
      <div className="text-center py-16 text-muted">
        Subproduct not found.{' '}
        <Link to="/products" className="text-brand hover:underline">Back to subproducts</Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateProduct(product.id, { name, categoryId, code, unit, status, rate: rate ? Number(rate) : undefined });
    if (category) {
      updateCategory(category.id, {
        sharedVariantIds: selectedSvIds.length > 0 ? selectedSvIds : undefined,
      });
    }
    navigate(`/products/${product.id}`);
  };

  const handleAddVariant = () => {
    if (!canAddVariant) return;
    if (addMode === 'shared' && selectedSv) {
      addVariant(product.id, {
        name:            selectedSv.name,
        sku:             code ? `${code}-${selectedSv.sku}` : selectedSv.sku,
        attributes:      selectedSv.attributes,
        sharedVariantId: selectedSv.id,
        factoryStock: 0, withVendor: 0, rejected: 0, status: 'Active',
      });
    } else if (addMode === 'custom') {
      addVariant(product.id, {
        name: newVName.trim(),
        sku:  newVSku.trim(),
        attributes:   [{ key: 'Size', value: newVName.trim() }],
        factoryStock: 0, withVendor: 0, rejected: 0, status: 'Active',
      });
    }
    setSelectedSvId('');
    setNewVName('');
    setNewVSku('');
    setShowAddVariant(false);
  };

  const toggleSv = (svId: string) =>
    setSelectedSvIds((prev) =>
      prev.includes(svId) ? prev.filter((x) => x !== svId) : [...prev, svId],
    );

  return (
    <div>
      <PageHeader
        title={`Edit Subproduct — ${product.name}`}
        subtitle="Update details, manage variants, and configure inherited shared variants."
      />

      {/* Keyboard hint */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> — cancel / go back</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Changes
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6" data-form>

          {/* ── Product details card ── */}
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">Subproduct Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Subproduct Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />

              <SearchableSelect
                label="Product (Category) *"
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Search product..."
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Subproduct Code — optional"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MAR-ELA"
              />

              <Select
                label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                options={[
                  { value: 'Pic',   label: 'Pic'   },
                  { value: 'Piece', label: 'Piece' },
                  { value: 'Kg',    label: 'Kg'    },
                ]}
              />

              <Input
                label="Rate (₹) *"
                type="number"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            {/* ── Status toggle ── */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-charcoal">Status</span>
              <div className="flex rounded-lg border border-border overflow-hidden w-fit text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setStatus('Active')}
                  className={`px-4 py-2 transition-colors ${
                    status === 'Active'
                      ? 'bg-green-600 text-white'
                      : 'text-muted hover:bg-surface'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('Disabled')}
                  className={`px-4 py-2 transition-colors border-l border-border ${
                    status === 'Disabled'
                      ? 'bg-gray-500 text-white'
                      : 'text-muted hover:bg-surface'
                  }`}
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* ── Inherited Shared Variants (inline) ── */}
            {activeSharedVariants.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-brand font-bold">⬡</span>
                  <span className="text-sm font-semibold text-charcoal">Inherited Shared Variants</span>
                  <span className="text-xs text-muted">
                    — affects parent product "{category?.name ?? '—'}"
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSharedVariants.map((sv) => {
                    const checked = selectedSvIds.includes(sv.id);
                    return (
                      <label
                        key={sv.id}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                          checked ? 'border-brand/40 bg-brand/5 text-brand' : 'border-border hover:bg-surface text-charcoal'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSv(sv.id)}
                          className="accent-brand"
                        />
                        <span className="font-medium">{sv.name}</span>
                        <span className="font-mono text-xs text-muted">{sv.sku}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedSvIds.length > 0 && (
                  <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 w-fit">
                    {selectedSvIds.length} variant{selectedSvIds.length !== 1 ? 's' : ''} inherited by all sub-products
                  </p>
                )}
              </div>
            )}

            {/* ── Save / Cancel ── */}
            <div className="flex gap-3 pt-2">
              <Button ref={submitRef} type="submit" disabled={!canSave}>
                Save Changes
                {canSave && (
                  <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/products/${product.id}`)}>
                Cancel
              </Button>
            </div>
          </Card>

          {/* ── Variants card ── */}
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-charcoal">Variants</h3>
                <p className="text-xs text-muted mt-0.5">{product.variants.length} variant{product.variants.length !== 1 ? 's' : ''}</p>
              </div>
              {!showAddVariant && (
                <Button type="button" size="sm" onClick={() => setShowAddVariant(true)}>
                  <Plus size={14} /> Add Variant
                </Button>
              )}
            </div>

            {/* ── Add-variant inline form ── */}
            {showAddVariant && (
              <div className="px-6 py-4 border-b border-border bg-surface/50">
                <p className="text-sm font-semibold text-charcoal mb-3">New Variant</p>

                {/* Mode switcher */}
                <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium w-fit mb-4">
                  <button
                    type="button"
                    onClick={() => setAddMode('shared')}
                    className={`flex items-center gap-2 px-4 py-2 transition-colors ${
                      addMode === 'shared' ? 'bg-brand text-white' : 'text-muted hover:bg-surface'
                    }`}
                  >
                    <Link2 size={13} /> From Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('custom')}
                    className={`flex items-center gap-2 px-4 py-2 border-l border-border transition-colors ${
                      addMode === 'custom' ? 'bg-brand text-white' : 'text-muted hover:bg-surface'
                    }`}
                  >
                    <Plus size={13} /> Custom
                  </button>
                </div>

                {addMode === 'shared' && (
                  <div>
                    {availableShared.length === 0 ? (
                      <p className="text-sm text-muted py-2">
                        All shared variants already added.{' '}
                        <button type="button" onClick={() => setAddMode('custom')} className="text-brand hover:underline">
                          Add a custom variant instead.
                        </button>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {availableShared.map((sv) => (
                          <label
                            key={sv.id}
                            className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                              selectedSvId === sv.id ? 'border-brand bg-brand/5' : 'border-border hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="addSharedVariant"
                              value={sv.id}
                              checked={selectedSvId === sv.id}
                              onChange={() => setSelectedSvId(sv.id)}
                              className="mt-0.5 accent-brand"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-charcoal">{sv.name}</span>
                                <span className="font-mono text-xs text-muted">{sv.sku}</span>
                              </div>
                              {sv.attributes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {sv.attributes.map((a, i) => (
                                    <span key={i} className="text-xs bg-surface border border-border rounded px-1.5 py-0.5">
                                      {a.key}: <strong>{a.value}</strong>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedSv && (
                      <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
                        Will be added as <strong>{selectedSv.name}</strong> with SKU{' '}
                        <code className="font-mono">{code}-{selectedSv.sku}</code>
                      </p>
                    )}
                  </div>
                )}

                {addMode === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Input
                      label="Variant Name *"
                      value={newVName}
                      onChange={(e) => setNewVName(e.target.value)}
                      placeholder="M, L, Small, Red…"
                      autoFocus
                    />
                    <Input
                      label="SKU *"
                      value={newVSku}
                      onChange={(e) => setNewVSku(e.target.value)}
                      placeholder={code ? `${code}-M` : 'SKU'}
                    />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handleAddVariant} disabled={!canAddVariant}>
                    <Check size={13} /> Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddVariant(false);
                      setSelectedSvId('');
                      setNewVName('');
                      setNewVSku('');
                    }}
                  >
                    <X size={13} /> Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* ── Variants table ── */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {['Variant', 'SKU', 'Attributes', 'Available', 'With Vendor', 'Total', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {product.variants.length === 0 && !showAddVariant && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                        No variants yet.{' '}
                        <button
                          type="button"
                          onClick={() => setShowAddVariant(true)}
                          className="text-brand hover:underline"
                        >
                          Add one
                        </button>
                      </td>
                    </tr>
                  )}
                  {product.variants.map((v) => (
                    <EditVariantRow
                      key={v.id}
                      variant={v}
                      unit={unit}
                      onSave={(data) => updateVariant(product.id, v.id, data)}
                      onDelete={() => deleteVariant(product.id, v.id)}
                      deleteBlockReasons={checkVariantDeleteConstraints(v.id)}
                      linkedSharedVariantName={
                        v.sharedVariantId
                          ? sharedVariants.find((sv) => sv.id === v.sharedVariantId)?.name
                          : undefined
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
