import { Plus, Search, Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Select } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';

export function ProductsPage() {
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '');
  const [statusFilter, setStatusFilter] = useState('');

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
        title="Products"
        subtitle={`${filtered.length} products`}
        action={<Link to="/products/new"><Button><Plus size={16} /> Add Product</Button></Link>}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search products..."
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
            <option value="">All Categories</option>
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
                {['Product', 'Category', 'Code', 'Unit', 'Rate (₹)', 'Variants', 'Current Stock', 'Status', 'Actions'].map((h) => (
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
                      </div>
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

export function AddProductPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categories = useAppStore((s) => s.categories);
  const addProduct = useAppStore((s) => s.addProduct);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(searchParams.get('category') ?? '');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('Pic');
  const [rate, setRate] = useState('');

  // Support ?returnTo=/some/path so we can come back to reference/job after saving
  const returnTo = searchParams.get('returnTo') ?? '/products';

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!name && !!categoryId && !!code;

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
    if (!name || !categoryId || !code) return;
    addProduct({ name, categoryId, code, unit, rate: rate ? Number(rate) : undefined, status: 'Active' });
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title="Add Product" />

      {/* Keyboard hint */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> — navigate dropdown</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Product
        </span>
      </div>

      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4" data-form>
          <Input label="Product Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <SearchableSelect
            label="Category"
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Search category..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input label="Product Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAR-ELA" required />
          <Select
            label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            options={[{ value: 'Pic', label: 'Pic' }, { value: 'Piece', label: 'Piece' }, { value: 'Kg', label: 'Kg' }]}
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
              Save Product
              {canSave && <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Product Page
// ─────────────────────────────────────────────────────────────────────────────
export function EditProductPage() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const categories   = useAppStore((s) => s.categories);
  const products     = useAppStore((s) => s.products);
  const updateProduct = useAppStore((s) => s.updateProduct);

  const product = products.find((p) => p.id === id);

  const [name,       setName]       = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [code,       setCode]       = useState(product?.code ?? '');
  const [unit,       setUnit]       = useState(product?.unit ?? 'Pic');
  const [rate,       setRate]       = useState(product?.rate !== undefined ? String(product.rate) : '');

  const submitRef = useRef<HTMLButtonElement>(null);
  const canSave   = !!name && !!categoryId && !!code;

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
        Product not found.{' '}
        <Link to="/products" className="text-brand hover:underline">Back to products</Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    updateProduct(product.id, {
      name,
      categoryId,
      code,
      unit,
      rate: rate ? Number(rate) : undefined,
    });
    navigate(`/products/${product.id}`);
  };

  return (
    <div>
      <PageHeader
        title={`Edit Product — ${product.name}`}
        subtitle="Update product details. Variant changes are managed from the product detail page."
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
            label="Product Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <SearchableSelect
            label="Category *"
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Search category..."
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Input
            label="Product Code *"
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
