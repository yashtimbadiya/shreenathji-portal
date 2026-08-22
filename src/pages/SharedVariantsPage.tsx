/**
 * SharedVariantsPage
 *
 * Manage a library of reusable variant definitions (e.g. Size: M, Size: L,
 * Color: Red, Width: 25mm). These can be applied to any product instead of
 * typing the same attributes every time.
 */
import { Pencil, Plus, Save, Trash2, X, Tags } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../store/useAppStore';
import type { SharedVariant, VariantAttribute } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Inline attribute row editor
// ─────────────────────────────────────────────────────────────────────────────
interface AttrEditorProps {
  attrs: VariantAttribute[];
  onChange: (attrs: VariantAttribute[]) => void;
}

function AttributeEditor({ attrs, onChange }: AttrEditorProps) {
  const add    = () => onChange([...attrs, { key: '', value: '' }]);
  const remove = (i: number) => onChange(attrs.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) =>
    onChange(attrs.map((a, idx) => (idx === i ? { ...a, [field]: val } : a)));

  return (
    <div className="space-y-2">
      {attrs.map((a, i) => (
        <div key={i} className="attr-row flex items-center gap-2">
          <input
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            placeholder="Key (e.g. Size)"
            value={a.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Move focus to the value field of the same row
                const row = (e.target as HTMLElement).closest('.attr-row');
                const valueInput = row?.querySelector<HTMLInputElement>('.attr-value');
                valueInput?.focus();
              }
            }}
          />
          <span className="text-muted text-xs shrink-0">:</span>
          <input
            className="attr-value flex-1 px-2.5 py-1.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            placeholder="Value (e.g. M)"
            value={a.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Move to the next row's key field, or add a new row
                const allRows = document.querySelectorAll<HTMLInputElement>('.attr-row input:first-of-type');
                const nextKey = allRows[i + 1];
                if (nextKey) nextKey.focus();
                else add();
              }
            }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-muted hover:text-red-500 transition-colors shrink-0"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-brand hover:underline"
      >
        <Plus size={12} /> Add attribute
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline form (used for both Add and Edit rows)
// ─────────────────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  sku: string;
  attributes: VariantAttribute[];
  remarks: string;
}

const emptyForm: FormState = { name: '', sku: '', attributes: [{ key: 'Size', value: '' }], remarks: '' };

interface InlineFormProps {
  initial: FormState;
  onSave: (data: FormState) => void;
  onCancel: () => void;
  saveLabel?: string;
}

function InlineForm({ initial, onSave, onCancel, saveLabel = 'Save' }: InlineFormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const canSave = form.name.trim() !== '' && form.sku.trim() !== '';

  // Ctrl+Enter → save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSave) onSave(form);
        else saveBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSave, form, onSave]);

  return (
    <div className="rounded-xl border-2 border-brand/30 bg-brand/5 p-4 space-y-3">
      {/* Keyboard hint */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
        <span className="font-semibold">⌨ Keyboard Mode</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next field</span>
        <span className="text-blue-500">·</span>
        <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> on attr value — next row</span>
        <span className="text-blue-500">·</span>
        <span className="font-semibold text-blue-800">
          <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — {saveLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-form>
        <Input
          label="Variant Name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. M, L, XXL, Red, 25mm"
          autoFocus
        />
        <Input
          label="SKU Suffix *"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="e.g. M  →  product code + M"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Attributes
          <span className="ml-1 text-xs font-normal text-muted">(Enter on value → next row)</span>
        </label>
        <AttributeEditor
          attrs={form.attributes}
          onChange={(attrs) => setForm((f) => ({ ...f, attributes: attrs }))}
        />
      </div>

      <Input
        label="Remarks"
        value={form.remarks}
        onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
        placeholder="Optional notes"
      />

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

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [search,      setSearch]      = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return sharedVariants;
    const q = search.toLowerCase();
    return sharedVariants.filter(
      (sv) =>
        sv.name.toLowerCase().includes(q) ||
        sv.sku.toLowerCase().includes(q) ||
        sv.attributes.some((a) => a.value.toLowerCase().includes(q) || a.key.toLowerCase().includes(q)),
    );
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
    addSharedVariant({
      name: data.name.trim(),
      sku: data.sku.trim(),
      attributes: data.attributes.filter((a) => a.key && a.value),
      status: 'Active',
      remarks: data.remarks.trim() || undefined,
    });
    setShowAddForm(false);
  };

  const handleUpdate = (sv: SharedVariant, data: FormState) => {
    updateSharedVariant(sv.id, {
      name: data.name.trim(),
      sku: data.sku.trim(),
      attributes: data.attributes.filter((a) => a.key && a.value),
      remarks: data.remarks.trim() || undefined,
    });
    setEditingId(null);
  };

  const handleToggleStatus = (sv: SharedVariant) => {
    updateSharedVariant(sv.id, { status: sv.status === 'Active' ? 'Disabled' : 'Active' });
  };

  const handleDelete = (sv: SharedVariant) => {
    const uses = usageMap.get(sv.id) ?? 0;
    const msg =
      uses > 0
        ? `"${sv.name}" is used by ${uses} product${uses !== 1 ? 's' : ''}. Deleting it will remove it from those products' variant lists. Continue?`
        : `Delete shared variant "${sv.name}"?`;
    if (!confirm(msg)) return;
    deleteSharedVariant(sv.id);
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
                initial={{
                  name: sv.name,
                  sku: sv.sku,
                  attributes: sv.attributes.length > 0 ? sv.attributes : [{ key: 'Size', value: '' }],
                  remarks: sv.remarks ?? '',
                }}
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
                    <span className="font-mono text-xs text-muted bg-surface border border-border px-1.5 py-0.5 rounded">{sv.sku}</span>
                    <ActiveBadge active={sv.status === 'Active'} />
                    {uses > 0 && (
                      <span className="inline-flex items-center text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                        {uses} product{uses !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Attributes */}
                  {sv.attributes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sv.attributes.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded px-2 py-0.5 text-charcoal"
                        >
                          <span className="text-muted">{a.key}:</span>
                          <span className="font-medium">{a.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Remarks */}
                  {sv.remarks && (
                    <p className="text-xs text-muted mt-1.5 italic">{sv.remarks}</p>
                  )}
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
    </div>
  );
}
