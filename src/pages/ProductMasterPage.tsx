import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Textarea } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';
import { deriveCategory } from '../api/productMasterImport';
import type { Product, ProductSpec } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// List page — products that carry a textile spec (the "master")
// ─────────────────────────────────────────────────────────────────────────────

export function ProductMasterPage() {
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const deleteProduct = useAppStore((s) => s.deleteProduct);
  const importProductMaster = useAppStore((s) => s.importProductMaster);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    await importProductMaster(file);
    setImporting(false);
  };

  // Show every product; the master fields live in spec (may be empty for demo products)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.spec?.folderNo ?? '').toLowerCase().includes(q) || (p.spec?.designNo ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search]);

  return (
    <div>
      <PageHeader
        title="Product Master"
        subtitle={`${products.length} product${products.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />
            <Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()} title="Import product-master sheet (.xlsx)">
              <Upload size={16} /> {importing ? 'Importing…' : 'Import'}
            </Button>
            <Link to="/production/master/new"><Button><Plus size={16} /> Add Product</Button></Link>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <Input placeholder="Search by name, folder no, or design no…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Product Name', 'Category', 'Design', 'Folder', 'Pick', 'Patti', 'Mtr/Pic', 'Rate', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId);
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-charcoal">
                      <Link to={`/production/master/${p.id}/edit`} className="text-brand hover:underline">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{cat?.name ?? '—'}</td>
                    <td className="px-4 py-3">{p.spec?.designNo ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{p.spec?.folderNo ?? '—'}</td>
                    <td className="px-4 py-3">{p.spec?.pick ?? '—'}</td>
                    <td className="px-4 py-3">{p.spec?.machinePatti ?? '—'}</td>
                    <td className="px-4 py-3">{p.spec?.meterPerRoll ?? '—'}</td>
                    <td className="px-4 py-3">{p.rate != null ? `₹${p.rate}` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/production/master/${p.id}/edit`} className="text-muted hover:text-brand" title="Edit"><Pencil size={14} /></Link>
                        <button onClick={() => setDeleteTarget({ id: p.id, name: p.name })} className="text-muted hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                  No products yet. <Link to="/production/master/new" className="text-brand hover:underline">Add one</Link> or Import a master sheet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteProduct(deleteTarget.id); setDeleteTarget(null); } }}
        title="Delete Product"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared form
// ─────────────────────────────────────────────────────────────────────────────

interface MasterFormValues {
  name: string;
  categoryId: string;
  rate: string;
  spec: Record<keyof ProductSpec, string>;
}

const EMPTY_SPEC: Record<keyof ProductSpec, string> = {
  designNo: '', folderNo: '', colour: '', geping: '', meterPerRoll: '',
  machinePatti: '', pick: '', ratePerMtr: '', cutMark: '', mirName: '', tikdiNote: '',
};

function numOrUndef(v: string): number | undefined {
  const s = v.trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function strOrUndef(v: string): string | undefined {
  const s = v.trim();
  return s ? s : undefined;
}

function ProductMasterForm({
  mode, initial, onSubmit, onCancel,
}: {
  mode: 'add' | 'edit';
  initial: MasterFormValues;
  onSubmit: (v: MasterFormValues) => void;
  onCancel: () => void;
}) {
  const categories = useAppStore((s) => s.categories);
  const addCategory = useAppStore((s) => s.addCategory);

  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [rate, setRate] = useState(initial.rate);
  const [spec, setSpec] = useState(initial.spec);
  const submitRef = useRef<HTMLButtonElement>(null);

  // Auto-suggest category from the name (add mode only, until user picks one)
  const suggestedCategoryName = useMemo(() => (name ? deriveCategory(name) : ''), [name]);

  const setSpecField = (k: keyof ProductSpec, v: string) => setSpec((prev) => ({ ...prev, [k]: v }));
  const canSave = !!name.trim() && !!categoryId;

  useEscapeBack(onCancel);
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
    if (!canSave) return;
    onSubmit({ name, categoryId, rate, spec });
  };

  const ensureSuggestedCategory = () => {
    // If no category chosen yet, create/select the suggested one
    const existing = categories.find((c) => c.name.trim().toUpperCase() === suggestedCategoryName.toUpperCase());
    if (existing) { setCategoryId(existing.id); return; }
    addCategory(suggestedCategoryName);
    // addCategory is sync-ish; find it on next tick
    setTimeout(() => {
      const created = useAppStore.getState().categories.find((c) => c.name.trim().toUpperCase() === suggestedCategoryName.toUpperCase());
      if (created) setCategoryId(created.id);
    }, 0);
  };

  return (
    <form onSubmit={handleSubmit} data-form>
      <Card className="p-6 space-y-5 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input label="Product Name *" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NANA MARUN 67-(1.25 - MII) - 300 PCS" required autoFocus={mode === 'add'} />
          </div>

          <div>
            <SearchableSelect
              label="Category *"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Select category…"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            {mode === 'add' && !categoryId && suggestedCategoryName && (
              <button type="button" onClick={ensureSuggestedCategory} className="mt-1 text-xs text-brand hover:underline">
                Use suggested category “{suggestedCategoryName}”
              </button>
            )}
          </div>
          <Input label="Rate per Mtr (₹)" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1.75" />
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-charcoal mb-3">Manufacturing Spec</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Input label="Design No" value={spec.designNo} onChange={(e) => setSpecField('designNo', e.target.value)} placeholder="67" />
            <Input label="Folder No" value={spec.folderNo} onChange={(e) => setSpecField('folderNo', e.target.value)} placeholder="LB-67-46-320" />
            <Input label="Colour" value={spec.colour} onChange={(e) => setSpecField('colour', e.target.value)} placeholder="MARUN + CHEMPIYEN" />
            <Input label="Geping" type="number" step="0.01" value={spec.geping} onChange={(e) => setSpecField('geping', e.target.value)} placeholder="1.25" />
            <Input label="Mtr per Roll / Pic" type="number" step="0.01" value={spec.meterPerRoll} onChange={(e) => setSpecField('meterPerRoll', e.target.value)} placeholder="9.20" />
            <Input label="Machine Patti" type="number" step="0.01" value={spec.machinePatti} onChange={(e) => setSpecField('machinePatti', e.target.value)} placeholder="30" />
            <Input label="Pick" type="number" value={spec.pick} onChange={(e) => setSpecField('pick', e.target.value)} placeholder="46" />
            <Input label="Rate per Mtr (spec)" type="number" step="0.01" value={spec.ratePerMtr} onChange={(e) => setSpecField('ratePerMtr', e.target.value)} placeholder="1.75" />
            <Input label="Cut Mark" value={spec.cutMark} onChange={(e) => setSpecField('cutMark', e.target.value)} placeholder="55-SNF-3RR - 320 ( III )" />
            <div className="sm:col-span-2 md:col-span-3">
              <Input label="MIR / Mirecal Name" value={spec.mirName} onChange={(e) => setSpecField('mirName', e.target.value)} placeholder="2- [0.50 MII ]MR-300/1.25" />
            </div>
            <div className="sm:col-span-2 md:col-span-3">
              <Textarea label="Tikdi / Setup Note" value={spec.tikdiNote} onChange={(e) => setSpecField('tikdiNote', e.target.value)} placeholder="290 तिकड़ी सेट करना हे" />
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button ref={submitRef} type="submit" disabled={!canSave}>
          {mode === 'add' ? 'Save Product' : 'Update Product'}
          {canSave && <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function valuesToSpec(v: MasterFormValues): ProductSpec {
  return {
    designNo: strOrUndef(v.spec.designNo),
    folderNo: strOrUndef(v.spec.folderNo),
    colour: strOrUndef(v.spec.colour),
    geping: numOrUndef(v.spec.geping),
    meterPerRoll: numOrUndef(v.spec.meterPerRoll),
    machinePatti: numOrUndef(v.spec.machinePatti),
    pick: numOrUndef(v.spec.pick),
    ratePerMtr: numOrUndef(v.spec.ratePerMtr),
    cutMark: strOrUndef(v.spec.cutMark),
    mirName: strOrUndef(v.spec.mirName),
    tikdiNote: strOrUndef(v.spec.tikdiNote),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Add page
// ─────────────────────────────────────────────────────────────────────────────

export function AddProductMasterPage() {
  const navigate = useNavigate();
  const addProduct = useAppStore((s) => s.addProduct);

  const handleSubmit = (v: MasterFormValues) => {
    const spec = valuesToSpec(v);
    addProduct({
      name: v.name.trim(),
      categoryId: v.categoryId,
      code: spec.folderNo ?? (spec.designNo ? `D-${spec.designNo}` : v.name.trim().slice(0, 40)),
      unit: 'Pic',
      rate: numOrUndef(v.rate) ?? spec.ratePerMtr,
      status: 'Active',
      spec,
    });
    navigate('/production/master');
  };

  return (
    <div>
      <PageHeader title="Add Product" subtitle="Product master with manufacturing spec" />
      <ProductMasterForm
        mode="add"
        initial={{ name: '', categoryId: '', rate: '', spec: { ...EMPTY_SPEC } }}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/production/master')}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit page
// ─────────────────────────────────────────────────────────────────────────────

export function EditProductMasterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const products = useAppStore((s) => s.products);
  const updateProduct = useAppStore((s) => s.updateProduct);
  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <div>
        <PageHeader title="Edit Product" />
        <Card className="p-6"><p className="text-sm text-muted">Product not found.</p><Button className="mt-4" onClick={() => navigate('/production/master')}>Back</Button></Card>
      </div>
    );
  }

  const s = product.spec ?? {};
  const initial: MasterFormValues = {
    name: product.name,
    categoryId: product.categoryId,
    rate: product.rate != null ? String(product.rate) : '',
    spec: {
      designNo: s.designNo ?? '', folderNo: s.folderNo ?? '', colour: s.colour ?? '',
      geping: s.geping != null ? String(s.geping) : '',
      meterPerRoll: s.meterPerRoll != null ? String(s.meterPerRoll) : '',
      machinePatti: s.machinePatti != null ? String(s.machinePatti) : '',
      pick: s.pick != null ? String(s.pick) : '',
      ratePerMtr: s.ratePerMtr != null ? String(s.ratePerMtr) : '',
      cutMark: s.cutMark ?? '', mirName: s.mirName ?? '', tikdiNote: s.tikdiNote ?? '',
    },
  };

  const handleSubmit = (v: MasterFormValues) => {
    const spec = valuesToSpec(v);
    const patch: Partial<Product> = {
      name: v.name.trim(),
      categoryId: v.categoryId,
      rate: numOrUndef(v.rate) ?? spec.ratePerMtr,
      spec,
    };
    updateProduct(product.id, patch);
    navigate('/production/master');
  };

  return (
    <div>
      <PageHeader title={`Edit — ${product.name}`} subtitle="Product master with manufacturing spec" />
      <ProductMasterForm mode="edit" initial={initial} onSubmit={handleSubmit} onCancel={() => navigate('/production/master')} />
    </div>
  );
}
