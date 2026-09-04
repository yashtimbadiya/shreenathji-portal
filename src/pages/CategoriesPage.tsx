import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEscapeBack } from '../hooks/useEscapeBack';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { focusNextInForm, Input } from '../components/ui/Input';
import { BlockedDeleteDialog, ConfirmDialog } from '../components/ui/Modal';
import { formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import type { Category } from '../types';

// ─── Inline-editable row ──────────────────────────────────────────────────────
interface CategoryRowProps {
  category: Category;
  onDelete: () => void;
  /** Pre-computed blocking reasons — if non-empty, delete is blocked */
  deleteBlockReasons: string[];
}

function CategoryRow({ category, onDelete, deleteBlockReasons }: CategoryRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState(false);

  return (
    <>
      <tr className="border-b border-border hover:bg-surface/50 group">
        <td className="px-4 py-3 font-medium">{category.name}</td>
        <td className="px-4 py-3 text-muted">{category.productCount}</td>
        <td className="px-4 py-3"><ActiveBadge active={category.status === 'Active'} /></td>
        <td className="px-4 py-3 text-muted">{formatDate(category.createdDate)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/products?category=${category.id}`}
              className="text-xs text-brand hover:underline"
            >
              View Subproducts
            </Link>
            <Link
              to={`/categories/${category.id}/edit`}
              className="flex items-center gap-1 text-xs text-muted hover:text-brand transition-colors opacity-0 group-hover:opacity-100"
            >
              <Pencil size={12} /> Edit
            </Link>
            <button
              type="button"
              onClick={() => deleteBlockReasons.length > 0 ? setBlockedDelete(true) : setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Delete product"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </td>
      </tr>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        title="Delete Product"
        message={`Delete "${category.name}"? This will also remove all its subproducts (${category.productCount}) and cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
      <BlockedDeleteDialog
        open={blockedDelete}
        onClose={() => setBlockedDelete(false)}
        title="Cannot Delete Product"
        entityName={category.name}
        reasons={deleteBlockReasons}
      />
    </>
  );
}

// ─── Products (Categories) list page ─────────────────────────────────────────
export function CategoriesPage() {
  const categories     = useAppStore((s) => s.categories);
  const deleteCategory = useAppStore((s) => s.deleteCategory);
  const checkConstraints = useAppStore((s) => s.checkCategoryDeleteConstraints);
  const navigate       = useNavigate();

  // N → navigate to Add Product page
  useNewItemShortcut(() => navigate('/categories/new'));

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${categories.length} product${categories.length !== 1 ? 's' : ''}`}
        action={
          <Link to="/categories/new">
            <Button><Plus size={16} /> Add Product</Button>
          </Link>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Product', 'Subproducts', 'Status', 'Created Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    No products yet.{' '}
                    <Link to="/categories/new" className="text-brand hover:underline">Add one</Link>
                  </td>
                </tr>
              )}
              {categories.map((cat) => (
                <CategoryRow
                  key={cat.id}
                  category={cat}
                  onDelete={() => deleteCategory(cat.id)}
                  deleteBlockReasons={checkConstraints(cat.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Shared variant selector panel (reused in Add + Edit) ────────────────────
interface SharedVariantPanelProps {
  selectedSvIds: string[];
  onChange: (ids: string[]) => void;
  /** Ref to the first checkbox — used for keyboard focus from name field */
  firstCheckboxRef: React.RefObject<HTMLInputElement | null>;
  /** Ref to the save button — Enter on last checkbox lands here */
  saveBtnRef: React.RefObject<HTMLButtonElement | null>;
  /** When true the panel shows a red validation border if nothing is selected */
  required?: boolean;
}

function SharedVariantPanel({ selectedSvIds, onChange, firstCheckboxRef, saveBtnRef, required }: SharedVariantPanelProps) {
  const sharedVariants      = useAppStore((s) => s.sharedVariants);
  const addSharedVariant    = useAppStore((s) => s.addSharedVariant);
  const updateSharedVariant = useAppStore((s) => s.updateSharedVariant);

  const [showAddForm,  setShowAddForm]  = useState(false);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [newSvName,    setNewSvName]    = useState('');
  const [editSvName,   setEditSvName]   = useState('');

  const activeSharedVariants = useMemo(
    () => sharedVariants.filter((sv) => sv.status === 'Active'),
    [sharedVariants],
  );

  const showError = required && selectedSvIds.length === 0;

  const toggle = (id: string) =>
    onChange(
      selectedSvIds.includes(id)
        ? selectedSvIds.filter((s) => s !== id)
        : [...selectedSvIds, id],
    );

  const handleAddSv = () => {
    const trimmed = newSvName.trim();
    if (!trimmed) return;
    addSharedVariant({
      name:       trimmed,
      sku:        trimmed.toUpperCase().replace(/\s+/g, '-'),
      attributes: [],
      status:     'Active',
    });
    setNewSvName('');
    setShowAddForm(false);
  };

  const handleUpdateSv = (id: string) => {
    const trimmed = editSvName.trim();
    if (!trimmed) return;
    updateSharedVariant(id, {
      name: trimmed,
      sku:  trimmed.toUpperCase().replace(/\s+/g, '-'),
    });
    setEditingId(null);
    setEditSvName('');
  };

  const startEdit = (sv: { id: string; name: string }) => {
    setEditingId(sv.id);
    setEditSvName(sv.name);
    setShowAddForm(false);
  };

  return (
    <Card className={`p-6 ${showError ? 'ring-2 ring-red-400 border-red-300' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-brand font-bold text-base">⬡</span>
          <h3 className="text-base font-semibold">
            Inherited Variants{required && <span className="text-red-500 ml-0.5">*</span>}
          </h3>
        </div>
        {!showAddForm && editingId === null && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-medium"
          >
            <Plus size={12} /> New variant
          </button>
        )}
      </div>
      <p className="text-xs text-muted mb-3">
        Every sub-product under this product will automatically get these shared variants.
      </p>

      {showError && (
        <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          At least one shared variant must be selected.
        </p>
      )}

      {/* ── Inline Add form ── */}
      {showAddForm && (
        <div className="mb-3 rounded-lg border-2 border-brand/30 bg-brand/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-charcoal">New Shared Variant</p>
          <input
            autoFocus
            value={newSvName}
            onChange={(e) => setNewSvName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddSv(); }
              if (e.key === 'Escape') { setShowAddForm(false); setNewSvName(''); }
            }}
            placeholder="e.g. M, L, Red, 25mm"
            className="w-full px-2.5 py-1.5 rounded-lg border border-brand/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddSv}
              disabled={!newSvName.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              <Check size={12} /> Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewSvName(''); }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
            >
              <X size={12} /> Cancel
            </button>
          </div>
        </div>
      )}

      {activeSharedVariants.length === 0 && !showAddForm ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
          <p>No shared variants in the library yet.</p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="text-brand hover:underline text-xs mt-1"
          >
            Create one now →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeSharedVariants.map((sv, idx) => {
            const checked = selectedSvIds.includes(sv.id);
            const isLast  = idx === activeSharedVariants.length - 1;
            const isEditing = editingId === sv.id;

            if (isEditing) {
              return (
                <div key={sv.id} className="rounded-lg border-2 border-brand/30 bg-brand/5 px-3 py-2.5 space-y-2">
                  <p className="text-xs font-semibold text-charcoal">Edit Shared Variant</p>
                  <input
                    autoFocus
                    value={editSvName}
                    onChange={(e) => setEditSvName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleUpdateSv(sv.id); }
                      if (e.key === 'Escape') { setEditingId(null); setEditSvName(''); }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-brand/40 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateSv(sv.id)}
                      disabled={!editSvName.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      <Save size={12} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setEditSvName(''); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface"
                    >
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <label
                key={sv.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors group ${
                  checked ? 'border-brand/40 bg-brand/5' : 'border-border hover:bg-surface'
                }`}
              >
                <input
                  ref={idx === 0 ? firstCheckboxRef : undefined}
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(sv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      toggle(sv.id);
                      if (isLast) {
                        saveBtnRef.current?.focus();
                      } else {
                        focusNextInForm(e.currentTarget);
                      }
                    }
                  }}
                  className="accent-brand shrink-0"
                />
                <span className="flex-1 text-sm font-medium text-charcoal">{sv.name}</span>
                {/* Edit button — only visible on hover */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); startEdit(sv); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted hover:text-brand transition-opacity"
                  title="Edit variant name"
                >
                  <Pencil size={11} />
                </button>
              </label>
            );
          })}
        </div>
      )}

      {selectedSvIds.length > 0 && (
        <p className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {selectedSvIds.length} variant{selectedSvIds.length !== 1 ? 's' : ''} will be inherited by all sub-products
        </p>
      )}
    </Card>
  );
}

// ─── Add Product page ─────────────────────────────────────────────────────────
export function AddCategoryPage() {
  const navigate    = useNavigate();
  const addCategory = useAppStore((s) => s.addCategory);

  const [name,          setName]          = useState('');
  const [selectedSvIds, setSelectedSvIds] = useState<string[]>([]);
  const [submitted,     setSubmitted]     = useState(false);

  const returnTo         = new URLSearchParams(window.location.search).get('returnTo') ?? '/categories';
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const saveBtnRef       = useRef<HTMLButtonElement>(null);

  const canSave = !!name.trim() && selectedSvIds.length > 0;

  useEscapeBack(() => navigate(returnTo));

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) saveBtnRef.current?.click();
        else { setSubmitted(true); saveBtnRef.current?.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSave) return;
    addCategory(name.trim(), selectedSvIds);
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title="Add Product" subtitle="Create a new product and choose which shared variants every sub-product will inherit." />

      {/* Keyboard hint */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on name → move to variants</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on variant → toggle &amp; move</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Product
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-3xl" data-form>
          {/* ── Product name ── */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="space-y-4">
                <Input
                  label="Product Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Elastic"
                  required
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      firstCheckboxRef.current ? firstCheckboxRef.current.focus() : saveBtnRef.current?.focus();
                    }
                  }}
                />
                <div className="flex gap-3 pt-2">
                  <Button ref={saveBtnRef} type="submit" disabled={submitted && !canSave}>
                    Save Product
                    {canSave && (
                      <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>Cancel</Button>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Shared Variants to inherit ── */}
          <div>
            <SharedVariantPanel
              selectedSvIds={selectedSvIds}
              onChange={setSelectedSvIds}
              firstCheckboxRef={firstCheckboxRef}
              saveBtnRef={saveBtnRef}
              required={submitted}
            />
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Edit Product (Category) page ────────────────────────────────────────────
export function EditCategoryPage() {
  const { id }           = useParams<{ id: string }>();
  const navigate         = useNavigate();
  const categories       = useAppStore((s) => s.categories);
  const updateCategory   = useAppStore((s) => s.updateCategory);

  const category = categories.find((c) => c.id === id);

  const [name,          setName]          = useState(category?.name ?? '');
  const [selectedSvIds, setSelectedSvIds] = useState<string[]>(category?.sharedVariantIds ?? []);
  const [submitted,     setSubmitted]     = useState(false);

  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const saveBtnRef       = useRef<HTMLButtonElement>(null);

  const canSave = !!name.trim() && selectedSvIds.length > 0;

  useEscapeBack(() => navigate('/categories'));

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) saveBtnRef.current?.click();
        else { setSubmitted(true); saveBtnRef.current?.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave]);

  if (!category) {
    return (
      <div className="text-center py-16 text-muted">
        Product not found.{' '}
        <Link to="/categories" className="text-brand hover:underline">Back to products</Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!canSave) return;
    updateCategory(category.id, {
      name:             name.trim(),
      sharedVariantIds: selectedSvIds,
    });
    navigate('/categories');
  };

  return (
    <div>
      <PageHeader
        title={`Edit Product — ${category.name}`}
        subtitle="Update the product name and the shared variants every sub-product will inherit."
      />

      {/* Keyboard hint */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on name → move to variants</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on variant → toggle &amp; move</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Save Changes
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-3xl" data-form>
          {/* ── Product name + actions ── */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="space-y-4">
                <Input
                  label="Product Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Elastic"
                  required
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      firstCheckboxRef.current ? firstCheckboxRef.current.focus() : saveBtnRef.current?.focus();
                    }
                  }}
                />

                {/* Status info (read-only — status is managed separately) */}
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>Status:</span>
                  <ActiveBadge active={category.status === 'Active'} />
                  <span className="text-border">·</span>
                  <span>{category.productCount} subproduct{category.productCount !== 1 ? 's' : ''}</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button ref={saveBtnRef} type="submit" disabled={submitted && !canSave}>
                    Save Changes
                    {canSave && (
                      <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/categories')}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* ── Shared Variants ── */}
          <div>
            <SharedVariantPanel
              selectedSvIds={selectedSvIds}
              onChange={setSelectedSvIds}
              firstCheckboxRef={firstCheckboxRef}
              saveBtnRef={saveBtnRef}
              required={submitted}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
