import { Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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

  const returnTo = searchParams.get('returnTo') ?? '/products';

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!name && !!categoryId;

  // Show which shared variants will be auto-inherited from the selected category
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const inheritedSvCount = selectedCategory?.sharedVariantIds?.length ?? 0;

  // ESC → cancel / go back
  useEscapeBack(() => navigate(returnTo));

  // Ctrl+Enter → submit
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !categoryId) return;

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
            onChange={setCategoryId}
            placeholder="Search product..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onAddNew={() => navigate(`/categories/new?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
            addNewLabel="Add new product"
          />

          {/* Inherited variants info banner */}
          {categoryId && (
            <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
              inheritedSvCount > 0
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-surface border-border text-muted'
            }`}>
              <Link2 size={13} className="shrink-0 mt-0.5" />
              {inheritedSvCount > 0
                ? <span><strong>{inheritedSvCount} shared variant{inheritedSvCount !== 1 ? 's' : ''}</strong> from "{selectedCategory?.name}" will be automatically added to this subproduct.</span>
                : <span>The selected product has no inherited shared variants. You can add variants manually after saving.</span>
              }
            </div>
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
              label="Rate (₹) — optional"
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </Card>

        {/* ── Actions ── */}
        <div className="mt-6 flex gap-3">
          <Button ref={submitRef} type="submit" disabled={!canSave}>
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
// Edit Subproduct page
// ─────────────────────────────────────────────────────────────────────────────
export function EditProductPage() {
  const { id }        = useParams<{ id: string }>();
  const navigate      = useNavigate();
  const categories    = useAppStore((s) => s.categories);
  const products      = useAppStore((s) => s.products);
  const updateProduct = useAppStore((s) => s.updateProduct);

  const product = products.find((p) => p.id === id);

  const [name,       setName]       = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [code,       setCode]       = useState(product?.code ?? '');
  const [unit,       setUnit]       = useState(product?.unit ?? 'Pic');
  const [rate,       setRate]       = useState(product?.rate !== undefined ? String(product.rate) : '');

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!name && !!categoryId && !!code;

  // ESC → cancel / go back
  useEscapeBack(() => navigate(product ? `/products/${product.id}` : '/products'));

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
    updateProduct(product.id, { name, categoryId, code, unit, rate: rate ? Number(rate) : undefined });
    navigate(`/products/${product.id}`);
  };

  return (
    <div>
      <PageHeader
        title={`Edit Subproduct — ${product.name}`}
        subtitle="Update subproduct details. Variant changes are managed from the subproduct detail page."
      />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Changes
        </span>
      </div>

      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4" data-form>
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
            onChange={setCategoryId}
            placeholder="Search product..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            label="Subproduct Code *"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MAR-ELA"
            required
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
            label="Rate (₹) — optional"
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0.00"
          />
          <div className="flex gap-3">
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
        </form>
      </Card>
    </div>
  );
}
