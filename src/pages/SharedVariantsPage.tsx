/**
 * SharedVariantsPage
 *
 * Manage a library of reusable variant definitions (e.g. Size: M, Size: L,
 * Color: Red, Width: 25mm). These can be applied to any product instead of
 * typing the same attributes every time.
 */
import { Pencil, Plus, Save, Trash2, Tags } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ConfirmDialog, BlockedDeleteDialog } from '../components/ui/Modal';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../store/useAppStore';
import type { SharedVariant } from '../types';
import { useNewItemShortcut } from '../hooks/useNewItemShortcut';

// ─────────────────────────────────────────────────────────────────────────────
// Inline form (used for both Add and Edit rows)
// ─────────────────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
}

const emptyForm: FormState = { name: '' };

interface InlineFormProps {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function InlineForm({ initial, onSave, onCancel, saveLabel = 'Save' }: InlineFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const canSave = form.name.trim() !== '';

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) onSave(form);
        else saveBtnRef.current?.focus();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, form, onSave, onCancel]);

  return (
    <div className="rounded-xl border-2 border-brand/30 bg-brand/5 p-4 space-y-3">
      {/* Keyboard hint */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — {saveLabel}
        </span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> — Cancel</span>
      </div>

      <div className="max-w-sm">
        <Input
          label="Variant Name *"
          value={form.name}
          onChange={(e) => setForm({ name: e.target.value })}
          placeholder="e.g. M, L, XXL, Red, 25mm"
          autoFocus
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          ref={saveBtnRef}
          type="button"
          disabled={!canSave}
          onClick={() => onSave(form)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} /> {saveLabel}
          {canSave && <kbd className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>}
        </button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export function SharedVariantsPage() {
  const sharedVariants    = useAppStore((s) => s.sharedVariants);
  const addSharedVariant  = useAppStore((s) => s.addSharedVariant);
  const updateSharedVariant = useAppStore((s) => s.updateSharedVariant);
  const deleteSharedVariant = useAppStore((s) => s.deleteSharedVariant);
  const products          = useAppStore((s) => s.products);
  const checkConstraints  = useAppStore((s) => s.checkSharedVariantDeleteConstraints);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [deleteTarget,  setDeleteTarget]  = useState<SharedVariant | null>(null);
  const [blockedTarget, setBlockedTarget] = useState<{ name: string; reasons: string[] } | null>(null);

  // N → open Add Variant form
  useNewItemShortcut(() => { setShowAddForm(true); setEditingId(null); });

  const filtered = useMemo(() => {
    if (!search.trim()) return sharedVariants;
    const q = search.toLowerCase();
    return sharedVariants.filter((sv) => sv.name.toLowerCase().includes(q));
  }, [sharedVariants, search]);

  // Count how many products use each shared variant (by matching variant id)
  const usageMap = useMemo(() => {
    const map = new Map<string, number>();
    sharedVariants.forEach((sv) => {
      const count = products.filter((p) => p.variants.some((v) => v.id === sv.id)).length;
      map.set(sv.id, count);
    });
    return map;
  }, [sharedVariants, products]);

  const handleAdd = (data: FormState) => {
    const trimmedName = data.name.trim();
    addSharedVariant({
      name: trimmedName,
      sku: trimmedName.toUpperCase().replace(/\s+/g, '-'),
      attributes: [],
      status: 'Active',
    });
    setShowAddForm(false);
  };

  const handleUpdate = (sv: SharedVariant, data: FormState) => {
    const trimmedName = data.name.trim();
    updateSharedVariant(sv.id, {
      name: trimmedName,
      sku: trimmedName.toUpperCase().replace(/\s+/g, '-'),
      attributes: [],
    });
    setEditingId(null);
  };

  const handleToggleStatus = (sv: SharedVariant) => {
    updateSharedVariant(sv.id, { status: sv.status === 'Active' ? 'Disabled' : 'Active' });
  };

  const handleDelete = (sv: SharedVariant) => {
    const reasons = checkConstraints(sv.id);
    if (reasons.length > 0) {
      setBlockedTarget({ name: sv.name, reasons });
    } else {
      setDeleteTarget(sv);
    }
  };

  return (
    <div>
      <PageHeader
        title="Shared Variants"
        subtitle={`${sharedVariants.length} variant${sharedVariants.length !== 1 ? 's' : ''} in library`}
        action={
          !showAddForm ? (
            <Button onClick={() => { setShowAddForm(true); setEditingId(null); }}>
              <Plus size={16} className="mr-1" /> Add Variant
            </Button>
          ) : undefined
        }
      />

      {/* ── What is this? info banner ── */}
      <div className="mb-4 flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
        <Tags size={15} className="shrink-0 mt-0.5 text-blue-500" />
        <span>
          <strong>Shared Variants</strong> are reusable variant definitions (e.g. Size&nbsp;M, Size&nbsp;L, Color&nbsp;Red).
          Define them once here, then apply them to any product from the product detail page — no re-typing needed.
        </span>
      </div>

      {/* ── Add form ── */}
      {showAddForm && (
        <div className="mb-4">
          <InlineForm
            initial={emptyForm}
            onSave={handleAdd}
            onCancel={() => setShowAddForm(false)}
            saveLabel="Add Variant"
          />
        </div>
      )}

      {/* ── Search ── */}
      {sharedVariants.length > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU or attribute…"
            className="w-full max-w-sm px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      )}

      {/* ── List ── */}
      <div className="space-y-3">
        {filtered.length === 0 && !showAddForm && (
          <Card className="p-10 text-center text-sm text-muted">
            {sharedVariants.length === 0
              ? 'No shared variants yet. Click "Add Variant" to create your first one.'
              : 'No variants match your search.'}
          </Card>
        )}

        {filtered.map((sv) => {
          const uses = usageMap.get(sv.id) ?? 0;
          const isEditing = editingId === sv.id;

          if (isEditing) {
            return (
              <InlineForm
                key={sv.id}
                initial={{ name: sv.name }}
                onSave={(data) => handleUpdate(sv, data)}
                onCancel={() => setEditingId(null)}
                saveLabel="Update Variant"
              />
            );
          }

          return (
            <Card key={sv.id} className="p-4">
              <div className="flex items-start gap-4">
                {/* Icon badge */}
                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand font-bold text-sm">{sv.name.slice(0, 2).toUpperCase()}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-charcoal">{sv.name}</span>
                    <ActiveBadge active={sv.status === 'Active'} />
                    {uses > 0 && (
                      <span className="inline-flex items-center text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                        {uses} product{uses !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditingId(sv.id); setShowAddForm(false); }}
                    className="p-1.5 text-muted hover:text-brand hover:bg-brand/5 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(sv)}
                    className={`px-2 py-1 text-xs rounded-lg border transition-colors font-medium ${
                      sv.status === 'Active'
                        ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                    title={sv.status === 'Active' ? 'Disable' : 'Enable'}
                  >
                    {sv.status === 'Active' ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sv)}
                    className="p-1.5 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteSharedVariant(deleteTarget.id);
        }}
        title="Delete Shared Variant"
        message={`Delete shared variant "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
      <BlockedDeleteDialog
        open={!!blockedTarget}
        onClose={() => setBlockedTarget(null)}
        title="Cannot Delete Shared Variant"
        entityName={blockedTarget?.name ?? ''}
        reasons={blockedTarget?.reasons ?? []}
      />
    </div>
  );
}
