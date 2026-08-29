import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import type { Category } from '../types';

// ─── Inline-editable row ──────────────────────────────────────────────────────
interface CategoryRowProps {
  category: Category;
  onSave: (name: string, status: 'Active' | 'Disabled') => void;
  onDelete: () => void;
}

function CategoryRow({ category, onSave, onDelete }: CategoryRowProps) {
  const [editing,       setEditing]       = useState(false);
  const [name,          setName]          = useState(category.name);
  const [status,        setStatus]        = useState<'Active' | 'Disabled'>(category.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), status);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(category.name);
    setStatus(category.status);
    setEditing(false);
  };

  if (editing) {
    return (
      <>
        <tr className="border-b border-border bg-brand/5">
          {/* Name input */}
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
          {/* Subproduct count — read-only */}
          <td className="px-4 py-2.5 text-muted">{category.productCount}</td>
          {/* Status toggle */}
          <td className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => setStatus((s) => s === 'Active' ? 'Disabled' : 'Active')}
              className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold transition-colors ${
                status === 'Active'
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          </td>
          {/* Created date — read-only */}
          <td className="px-4 py-2.5 text-muted">{formatDate(category.createdDate)}</td>
          {/* Save / Cancel */}
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={!name.trim()}
                className="p-1.5 rounded-lg bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
                title="Save (Enter)"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="p-1.5 rounded-lg text-muted hover:bg-surface border border-border transition-colors"
                title="Cancel (Esc)"
              >
                <X size={13} />
              </button>
            </div>
          </td>
        </tr>
        {/* Keyboard hint row */}
        <tr className="bg-brand/5">
          <td colSpan={5} className="px-4 pb-1.5">
            <p className="text-xs text-muted">
              <kbd className="bg-surface border border-border px-1 rounded font-mono">Enter</kbd> save ·{' '}
              <kbd className="bg-surface border border-border px-1 rounded font-mono">Esc</kbd> cancel
            </p>
          </td>
        </tr>

        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          title="Delete Product"
          message={`Delete "${category.name}"? This will also remove all its subproducts and cannot be undone.`}
          confirmLabel="Delete"
          danger
        />
      </>
    );
  }

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
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-muted hover:text-brand transition-colors opacity-0 group-hover:opacity-100"
              title="Edit product"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
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
    </>
  );
}

// ─── Products (Categories) list page ─────────────────────────────────────────
export function CategoriesPage() {
  const categories     = useAppStore((s) => s.categories);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

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
                  onSave={(name, status) => updateCategory(cat.id, { name, status })}
                  onDelete={() => deleteCategory(cat.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Add Product page ─────────────────────────────────────────────────────────
export function AddCategoryPage() {
  const navigate    = useNavigate();
  const addCategory = useAppStore((s) => s.addCategory);
  const [name, setName] = useState('');

  const returnTo = new URLSearchParams(window.location.search).get('returnTo') ?? '/categories';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addCategory(name.trim());
    navigate(returnTo);
  };

  return (
    <div>
      <PageHeader title="Add Product" subtitle="Create a new product" />
      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Elastic"
            required
            autoFocus
          />
          <div className="flex gap-3">
            <Button type="submit" disabled={!name.trim()}>Save Product</Button>
            <Button type="button" variant="outline" onClick={() => navigate(returnTo)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
