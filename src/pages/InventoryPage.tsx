import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { getCategoryById } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

export function InventoryPage() {
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [productFilter, setProductFilter] = useState(searchParams.get('product') ?? '');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const result: {
      productId: string;
      variantId: string;
      productName: string;
      variantName: string;
      category: string;
      factoryStock: number;
      withVendor: number;
      rejected: number;
      total: number;
      unit: string;
    }[] = [];

    products.forEach((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return;
      if (productFilter && p.id !== productFilter) return;
      p.variants.forEach((v) => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !v.name.toLowerCase().includes(search.toLowerCase())) return;
        result.push({
          productId: p.id,
          variantId: v.id,
          productName: p.name,
          variantName: v.name,
          category: getCategoryById(p.categoryId)?.name ?? '',
          factoryStock: v.factoryStock,
          withVendor: v.withVendor,
          rejected: v.rejected,
          total: v.factoryStock + v.withVendor + v.rejected,
          unit: p.unit,
        });
      });
    });

    return result;
  }, [products, categoryFilter, productFilter, search]);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`${rows.length} stock entries`}
        action={
          <Link to="/inventory/new">
            <Button><Plus size={16} /> Add Inventory</Button>
          </Link>
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search product or variant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border text-sm"
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-border text-sm">
            <option value="">All Products</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface sticky top-0">
                {['Product', 'Variant', 'Category', 'Factory Stock', 'With Vendor', 'Total', 'Unit'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.variantId} className="border-b border-border hover:bg-surface/50">
                  <td className="px-4 py-3 font-medium">{row.productName}</td>
                  <td className="px-4 py-3">
                    <Link to={`/inventory/ledger/${row.variantId}`} className="text-brand hover:underline">{row.variantName}</Link>
                  </td>
                  <td className="px-4 py-3">{row.category}</td>
                  <td className="px-4 py-3">{row.factoryStock.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.withVendor.toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium">{row.total.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AddInventoryPage() {
  const navigate = useNavigate();
  const products = useAppStore((s) => s.products);
  const addInventoryStock = useAppStore((s) => s.addInventoryStock);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [transaction, setTransaction] = useState('Stock Add');

  const variantOptions = products.flatMap((product) =>
    product.variants.map((variant) => ({
      value: variant.id,
      label: `${product.name} — ${variant.name}`,
    })),
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!variantId || !quantity || !reference) return;

    addInventoryStock({
      variantId,
      quantity: Number(quantity),
      reference,
      transaction,
    });

    navigate('/inventory');
  };

  return (
    <div>
      <PageHeader title="Add Inventory" subtitle="Create a fresh stock entry for a product variant." />
      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Variant"
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            options={[{ value: '', label: 'Select variant...' }, ...variantOptions]}
          />
          <Input
            label="Quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
          <Input
            label="Reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="PO-001, GRN-001, etc."
            required
          />
          <Select
            label="Transaction"
            value={transaction}
            onChange={(event) => setTransaction(event.target.value)}
            options={[
              { value: 'Stock Add', label: 'Stock Add' },
              { value: 'Purchase', label: 'Purchase' },
              { value: 'Adjustment', label: 'Adjustment' },
            ]}
          />
          <div className="flex gap-3">
            <Button type="submit">Save Inventory</Button>
            <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function StockLedgerPage() {
  const { variantId } = useParams();
  const stockTransactions = useAppStore((s) => s.stockTransactions);
  const products = useAppStore((s) => s.products);
  const vendors = useAppStore((s) => s.vendors);

  let productName = '';
  let variantName = '';
  for (const p of products) {
    const v = p.variants.find((vr) => vr.id === variantId);
    if (v) {
      productName = p.name;
      variantName = v.name;
      break;
    }
  }

  const transactions = stockTransactions.filter((t) => t.variantId === variantId);

  return (
    <div>
      <div className="mb-4">
        <BackButton to="/inventory" label="Back to Inventory" />
      </div>
      <PageHeader title="Stock Ledger" subtitle={`${productName} — ${variantName}`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Date', 'Transaction', 'Reference', 'Vendor', 'IN', 'OUT', 'Balance', 'User'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No transactions yet</td></tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="px-4 py-3">{t.date}</td>
                    <td className="px-4 py-3">{t.transaction}</td>
                    <td className="px-4 py-3 font-medium text-brand">{t.reference}</td>
                    <td className="px-4 py-3">{vendors.find((v) => v.id === t.vendorId)?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-green-600">{t.inQty > 0 ? t.inQty.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 text-red-600">{t.outQty > 0 ? t.outQty.toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 font-medium">{t.balance.toLocaleString()}</td>
                    <td className="px-4 py-3">{t.user}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
