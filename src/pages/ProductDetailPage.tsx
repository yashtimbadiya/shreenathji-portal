import { Pencil, Plus, Link2, Trash2, Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal, ConfirmDialog, BlockedDeleteDialog } from '../components/ui/Modal';
import { getCategoryById } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import type { ProductVariant } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Inline variant row — shows either read or edit mode
// ─────────────────────────────────────────────────────────────────────────────
interface VariantRowProps {
  variant: ProductVariant;
  unit: string;
  onSave: (data: Pick<ProductVariant, 'name' | 'sku' | 'status'>) => void;
  onDelete: () => void;
  /** Pre-computed blocking reasons — if non-empty, delete is blocked */
  deleteBlockReasons: string[];
}

function VariantRow({ variant, unit, onSave, onDelete, deleteBlockReasons }: VariantRowProps) {
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(variant.name);
  const [sku,      setSku]      = useState(variant.sku);
  const [status,   setStatus]   = useState<'Active' | 'Disabled'>(variant.status);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState(false);

  const total = variant.factoryStock + variant.withVendor;

  const handleSave = () => {
    if (!name.trim() || !sku.trim()) return;
    onSave({ name: name.trim(), sku: sku.trim(), status });
    setEditing(false);
  };

  const handleCancel = () => {
    setName(variant.name);
    setSku(variant.sku);
    setStatus(variant.status);
    setEditing(false);
  };

  if (editing) {
    return (
      <>
        <tr className="border-b border-border bg-brand/5">
          {/* Name */}
          <td className="px-4 py-2.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') handleCancel();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-brand/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </td>
          {/* SKU */}
          <td className="px-4 py-2.5">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') handleCancel();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </td>
          {/* Attributes — read-only in inline edit; full edit via modal */}
          <td className="px-4 py-2.5 text-xs text-muted">
            {variant.attributes.map((a) => `${a.key}: ${a.value}`).join(', ') || '—'}
          </td>
          {/* Stock fields — read-only */}
          <td className="px-4 py-2.5 text-muted">{variant.factoryStock.toLocaleString()}</td>
          <td className="px-4 py-2.5 text-muted">{variant.withVendor.toLocaleString()}</td>
          <td className="px-4 py-2.5 font-medium">{total.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
          {/* Status toggle */}
          <td className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => setStatus((s) => s === 'Active' ? 'Disabled' : 'Active')}
              className={`px-2 py-0.5 rounded-full border text-xs font-semibold transition-colors ${
                status === 'Active'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
            >
              {status}
            </button>
          </td>
          {/* Save / Cancel */}
          <td className="px-3 py-2.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim() || !sku.trim()}
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
          <td colSpan={8} className="px-4 pb-1">
            <p className="text-xs text-muted">
              <kbd className="bg-surface border border-border px-1 rounded font-mono">Enter</kbd> save ·{' '}
              <kbd className="bg-surface border border-border px-1 rounded font-mono">Esc</kbd> cancel
            </p>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-surface/50 group">
        <td className="px-4 py-3 font-medium">{variant.name}</td>
        <td className="px-4 py-3 font-mono text-xs">{variant.sku}</td>
        <td className="px-4 py-3 text-xs text-muted">
          {variant.attributes.map((a) => `${a.key}: ${a.value}`).join(', ') || '—'}
        </td>
        <td className="px-4 py-3">{variant.factoryStock.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-4 py-3">{variant.withVendor.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-4 py-3 font-medium">{total.toLocaleString()}{unit === 'Pic' ? ' Pic' : ''}</td>
        <td className="px-4 py-3"><ActiveBadge active={variant.status === 'Active'} /></td>
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
        onConfirm={onDelete}
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

// ─────────────────────────────────────────────────────────────────────────────
// Product Detail Page
// ─────────────────────────────────────────────────────────────────────────────
export function ProductDetailPage() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const products        = useAppStore((s) => s.products);
  const categories      = useAppStore((s) => s.categories);
  const sharedVariants  = useAppStore((s) => s.sharedVariants);
  const addVariant      = useAppStore((s) => s.addVariant);
  const updateVariant   = useAppStore((s) => s.updateVariant);
  const deleteVariant   = useAppStore((s) => s.deleteVariant);
  const updateProduct   = useAppStore((s) => s.updateProduct);
  const checkVariantDeleteConstraints = useAppStore((s) => s.checkVariantDeleteConstraints);

  // Add-variant modal
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [mode,          setMode]          = useState<'shared' | 'custom'>('shared');
  const [selectedSvId,  setSelectedSvId]  = useState('');
  const [variantName,   setVariantName]   = useState('');
  const [sku,           setSku]           = useState('');

  const product = products.find((p) => p.id === id);

  const category = product ? categories.find((c) => c.id === product.categoryId) ?? getCategoryById(product.categoryId) : null;

  const existingVariantIds = useMemo(
    () => new Set(product?.variants.map((v) => v.id) ?? []),
    [product?.variants],
  );

  const availableShared = useMemo(
    () => sharedVariants.filter((sv) => sv.status === 'Active' && !existingVariantIds.has(sv.id)),
    [sharedVariants, existingVariantIds],
  );

  const selectedSv = sharedVariants.find((sv) => sv.id === selectedSvId);

  if (!product) return <div className="text-center py-16 text-muted">Product not found</div>;

  const resetAddModal = () => {
    setMode('shared');
    setSelectedSvId('');
    setVariantName('');
    setSku('');
    setShowAddModal(false);
  };

  const handleAddVariant = () => {
    if (mode === 'shared') {
      if (!selectedSv) return;
      addVariant(product.id, {
        name:         selectedSv.name,
        sku:          `${product.code}-${selectedSv.sku}`,
        attributes:   selectedSv.attributes,
        factoryStock: 0,
        withVendor:   0,
        rejected:     0,
        status:       'Active',
      });
    } else {
      if (!variantName || !sku) return;
      addVariant(product.id, {
        name:         variantName,
        sku,
        attributes:   [{ key: 'Size', value: variantName }],
        factoryStock: 0,
        withVendor:   0,
        rejected:     0,
        status:       'Active',
      });
    }
    resetAddModal();
  };

  const canAddSave = mode === 'shared' ? !!selectedSvId : variantName.trim() !== '' && sku.trim() !== '';

  const handleToggleProductStatus = () => {
    updateProduct(product.id, { status: product.status === 'Active' ? 'Disabled' : 'Active' });
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <BackButton to="/products" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-charcoal">{product.name}</h1>
            <ActiveBadge active={product.status === 'Active'} />
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted">
            <span>Product: <strong className="text-charcoal">{category?.name ?? '—'}</strong></span>
            <span>Unit: <strong className="text-charcoal">{product.unit}</strong></span>
            <span>Code: <strong className="text-charcoal font-mono">{product.code}</strong></span>
            {product.rate !== undefined && (
              <span>Rate: <strong className="text-charcoal">₹{product.rate}</strong></span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => navigate(`/products/${product.id}/edit`)}
          >
            <Pencil size={14} /> Edit Subproduct
          </Button>
          <button
            type="button"
            onClick={handleToggleProductStatus}
            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
              product.status === 'Active'
                ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                : 'border-green-200 text-green-700 hover:bg-green-50'
            }`}
          >
            {product.status === 'Active' ? 'Disable' : 'Enable'}
          </button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Variant
          </Button>
        </div>
      </div>

      {/* ── Variants table ── */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Variant', 'SKU', 'Attributes', 'Available', 'With Vendor', 'Total', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {product.variants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                    No variants yet.{' '}
                    <button onClick={() => setShowAddModal(true)} className="text-brand hover:underline">
                      Add one
                    </button>
                    {availableShared.length > 0 && (
                      <span> — or pick from the{' '}
                        <Link to="/shared-variants" className="text-brand hover:underline">
                          shared variant library
                        </Link>.
                      </span>
                    )}
                  </td>
                </tr>
              )}
              {product.variants.map((v) => (
                <VariantRow
                  key={v.id}
                  variant={v}
                  unit={product.unit}
                  onSave={(data) => updateVariant(product.id, v.id, data)}
                  onDelete={() => deleteVariant(product.id, v.id)}
                  deleteBlockReasons={checkVariantDeleteConstraints(v.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Add Variant Modal ── */}
      <Modal
        open={showAddModal}
        onClose={resetAddModal}
        title="Add Variant"
        footer={
          <>
            <Button variant="outline" onClick={resetAddModal}>Cancel</Button>
            <Button onClick={handleAddVariant} disabled={!canAddSave}>Add Variant</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Mode switcher */}
          <div className="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('shared')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors
                ${mode === 'shared' ? 'bg-brand text-white' : 'text-muted hover:bg-surface'}`}
            >
              <Link2 size={14} /> From Library
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors
                ${mode === 'custom' ? 'bg-brand text-white' : 'text-muted hover:bg-surface'}`}
            >
              <Plus size={14} /> Custom
            </button>
          </div>

          {/* Shared variant picker */}
          {mode === 'shared' && (
            <div>
              {availableShared.length === 0 ? (
                <div className="rounded-lg bg-surface border border-border px-4 py-5 text-center text-sm text-muted">
                  <p>No shared variants available to add.</p>
                  <p className="mt-1">
                    <Link to="/shared-variants" onClick={resetAddModal} className="text-brand hover:underline">
                      Manage the shared variant library
                    </Link>
                    {' '}or switch to Custom mode.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {availableShared.map((sv) => (
                    <label
                      key={sv.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedSvId === sv.id ? 'border-brand bg-brand/5' : 'border-border hover:bg-surface'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sharedVariant"
                        value={sv.id}
                        checked={selectedSvId === sv.id}
                        onChange={() => setSelectedSvId(sv.id)}
                        className="mt-0.5 accent-brand"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-charcoal text-sm">{sv.name}</span>
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
                        {sv.remarks && <p className="text-xs text-muted mt-1 italic">{sv.remarks}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedSv && (
                <div className="mt-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                  Will be added as <strong>{selectedSv.name}</strong> with SKU{' '}
                  <code className="font-mono">{product.code}-{selectedSv.sku}</code>
                </div>
              )}
              <p className="text-xs text-muted mt-2">
                <Link to="/shared-variants" onClick={resetAddModal} className="text-brand hover:underline">
                  Manage shared variant library →
                </Link>
              </p>
            </div>
          )}

          {/* Custom variant form */}
          {mode === 'custom' && (
            <div className="space-y-3" data-form>
              <Input
                label="Variant Name *"
                value={variantName}
                onChange={(e) => setVariantName(e.target.value)}
                placeholder="M, L, Small, Red…"
                autoFocus
              />
              <Input
                label="SKU *"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder={`${product.code}-M`}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
