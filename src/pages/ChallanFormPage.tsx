import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';
import { computeTotalMeters, computeTotalPieces, sumRounds } from '../lib/challanMath';
import { isInternalParty } from '../api/challanImport';
import type { Challan, ChallanSizeLine } from '../types';

interface ChallanFormValues {
  challanNumber: string;
  date: string;
  productId: string;
  productName: string;
  designNo: string;
  pick: string;
  folderNo: string;
  partyName: string;
  vendorId: string;
  machinePatti: string;
  mtrPerPic: string;
  lines: ChallanSizeLine[];
}

const INTERNAL_PARTY = 'EXTRA';

function ChallanForm({
  mode, initial, takenNumbers, onSubmit, onCancel,
}: {
  mode: 'add' | 'edit';
  initial: ChallanFormValues;
  takenNumbers: Set<string>;
  onSubmit: (v: ChallanFormValues) => void;
  onCancel: () => void;
}) {
  const products = useAppStore((s) => s.products);
  const vendors = useAppStore((s) => s.vendors);

  const [v, setV] = useState<ChallanFormValues>(initial);
  const [draftSize, setDraftSize] = useState('');
  const [draftRound, setDraftRound] = useState('');
  const [numberError, setNumberError] = useState('');
  const submitRef = useRef<HTMLButtonElement>(null);

  const set = <K extends keyof ChallanFormValues>(k: K, val: ChallanFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  // Auto-fill master fields when a product is selected (VLOOKUP behaviour)
  const applyProduct = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) { setV((prev) => ({ ...prev, productId: '', productName: '' })); return; }
    setV((prev) => ({
      ...prev,
      productId: p.id,
      productName: p.name,
      designNo: p.spec?.designNo ?? prev.designNo,
      pick: p.spec?.pick != null ? String(p.spec.pick) : prev.pick,
      folderNo: p.spec?.folderNo ?? prev.folderNo,
      machinePatti: p.spec?.machinePatti != null ? String(p.spec.machinePatti) : prev.machinePatti,
      mtrPerPic: p.spec?.meterPerRoll != null ? String(p.spec.meterPerRoll) : prev.mtrPerPic,
    }));
  };

  const totalRounds = useMemo(() => sumRounds(v.lines), [v.lines]);
  const totalPieces = useMemo(() => computeTotalPieces(v.lines, Number(v.machinePatti) || 0), [v.lines, v.machinePatti]);
  const totalMeters = useMemo(() => computeTotalMeters(v.lines, Number(v.mtrPerPic) || 0), [v.lines, v.mtrPerPic]);

  const canAddLine = !!draftSize.trim() && !!draftRound.trim() && Number(draftRound) > 0;
  const canSave = !!v.challanNumber.trim() && !!v.date && !!v.productName.trim() && v.lines.length > 0 && !numberError;

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

  const onNumberChange = (val: string) => {
    set('challanNumber', val);
    setNumberError(mode === 'add' && takenNumbers.has(val.trim().toLowerCase()) ? `"${val}" already exists` : '');
  };

  const addLine = () => {
    if (!canAddLine) return;
    setV((prev) => ({ ...prev, lines: [...prev.lines, { size: draftSize.trim(), round: Number(draftRound) }] }));
    setDraftSize('');
    setDraftRound('');
  };
  const removeLine = (i: number) => setV((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSubmit(v);
  };

  return (
    <form onSubmit={handleSubmit} data-form>
      <Card className="p-6 space-y-5 max-w-3xl">
        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input label="Challan No *" value={v.challanNumber} onChange={(e) => onNumberChange(e.target.value)} placeholder="2111" required disabled={mode === 'edit'} autoFocus={mode === 'add'} />
            {numberError && <p className="text-xs text-red-500 mt-1">{numberError}</p>}
          </div>
          <Input label="Date *" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} required />
          <Input label="Machine Patti *" type="number" step="0.01" value={v.machinePatti} onChange={(e) => set('machinePatti', e.target.value)} placeholder="30" />
        </div>

        {/* Product select (auto-fills master fields) */}
        <SearchableSelect
          label="Product *"
          value={v.productId}
          onChange={applyProduct}
          placeholder="Select product from master…"
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />
        {!v.productId && v.productName && (
          <p className="text-xs text-muted -mt-2">Unlinked product: “{v.productName}”. Select from master to auto-fill spec.</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input label="Design No" value={v.designNo} onChange={(e) => set('designNo', e.target.value)} placeholder="67" />
          <Input label="Pick" type="number" value={v.pick} onChange={(e) => set('pick', e.target.value)} placeholder="46" />
          <Input label="Folder No" value={v.folderNo} onChange={(e) => set('folderNo', e.target.value)} placeholder="LB-67-46-320" />
          <Input label="Mtr per Pic" type="number" step="0.01" value={v.mtrPerPic} onChange={(e) => set('mtrPerPic', e.target.value)} placeholder="9.20" />
        </div>

        {/* Party */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label="Party (Vendor)"
            value={v.vendorId}
            onChange={(vendorId) => {
              const vend = vendors.find((x) => x.id === vendorId);
              setV((prev) => ({ ...prev, vendorId, partyName: vend?.name ?? prev.partyName }));
            }}
            placeholder="Select party…"
            options={vendors.map((x) => ({ value: x.id, label: x.name }))}
          />
          <Input
            label="Party Name (or type EXTRA for internal)"
            value={v.partyName}
            onChange={(e) => set('partyName', e.target.value)}
            placeholder={INTERNAL_PARTY}
          />
        </div>

        {/* Size / Round grid */}
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-charcoal mb-3">Sizes & Rounds <span className="ml-2 text-xs font-normal text-muted">({v.lines.length} added)</span></h4>

          {v.lines.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden mb-3">
              <table className="w-full text-sm">
                <thead><tr className="bg-surface border-b border-border">
                  {['#', 'Size', 'Round', ''].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase">{h}</th>)}
                </tr></thead>
                <tbody>
                  {v.lines.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{l.size}</td>
                      <td className="px-3 py-2">{l.round}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeLine(i)} className="text-muted hover:text-red-500" title="Remove"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-lg border border-dashed border-border p-4 bg-surface/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Input label="Size" value={draftSize} onChange={(e) => setDraftSize(e.target.value)} placeholder="S / XL / 44 / 3XL" />
              <Input label="Round" type="number" min="1" value={draftRound} onChange={(e) => setDraftRound(e.target.value)} placeholder="10"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLine(); } }} />
              <Button type="button" variant="outline" disabled={!canAddLine} onClick={addLine}><Plus size={14} className="mr-1.5" /> Add</Button>
            </div>
          </div>
          {v.lines.length === 0 && <p className="text-xs text-orange-600 mt-2">Add at least one size/round line.</p>}
        </div>

        {/* Live totals */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-brand/5 border border-brand/20 px-4 py-3">
          <div>
            <p className="text-xs text-muted uppercase font-semibold">Total Rounds</p>
            <p className="text-lg font-bold text-charcoal">{totalRounds}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase font-semibold">Total Pieces</p>
            <p className="text-lg font-bold text-brand">{totalPieces.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-muted">patti × rounds</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase font-semibold">Total Meters</p>
            <p className="text-lg font-bold text-brand">{totalMeters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-muted">rounds × mtr/pic</p>
          </div>
        </div>
      </Card>

      <div className="mt-6 flex gap-3">
        <Button ref={submitRef} type="submit" disabled={!canSave}>
          {mode === 'add' ? 'Save Challan' : 'Update Challan'}
          {canSave && <kbd className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function buildChallanPayload(v: ChallanFormValues): Omit<Challan, 'id'> {
  const internal = isInternalParty(v.partyName);
  return {
    challanNumber: v.challanNumber.trim(),
    date: v.date,
    productName: v.productName.trim(),
    productId: v.productId || undefined,
    designNo: v.designNo.trim(),
    pick: Number(v.pick) || 0,
    folderNo: v.folderNo.trim(),
    partyName: v.partyName.trim() || INTERNAL_PARTY,
    vendorId: internal ? undefined : (v.vendorId || undefined),
    machinePatti: Number(v.machinePatti) || 0,
    mtrPerPic: Number(v.mtrPerPic) || 0,
    lines: v.lines,
    totalPieces: computeTotalPieces(v.lines, Number(v.machinePatti) || 0),
    totalMeters: computeTotalMeters(v.lines, Number(v.mtrPerPic) || 0),
    source: 'manual',
  };
}

// ── Add ──
export function AddChallanPage() {
  const navigate = useNavigate();
  const challans = useAppStore((s) => s.challans);
  const addChallan = useAppStore((s) => s.addChallan);
  const taken = useMemo(() => new Set(challans.map((c) => c.challanNumber.trim().toLowerCase())), [challans]);

  const handleSubmit = (v: ChallanFormValues) => {
    const created = addChallan(buildChallanPayload(v));
    if (created) navigate('/production');
  };

  return (
    <div>
      <PageHeader title="Add Challan" subtitle="Production register entry" />
      <ChallanForm
        mode="add"
        takenNumbers={taken}
        initial={{
          challanNumber: '', date: new Date().toISOString().slice(0, 10),
          productId: '', productName: '', designNo: '', pick: '', folderNo: '',
          partyName: '', vendorId: '', machinePatti: '', mtrPerPic: '', lines: [],
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/production')}
      />
    </div>
  );
}

// ── Edit ──
export function EditChallanRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const challans = useAppStore((s) => s.challans);
  const updateChallan = useAppStore((s) => s.updateChallan);
  const c = challans.find((x) => x.id === id);

  if (!c) {
    return (
      <div>
        <PageHeader title="Edit Challan" />
        <Card className="p-6"><p className="text-sm text-muted">Challan not found.</p><Button className="mt-4" onClick={() => navigate('/production')}>Back</Button></Card>
      </div>
    );
  }

  const handleSubmit = (v: ChallanFormValues) => {
    const payload = buildChallanPayload(v);
    // Preserve original challan number on edit (field is disabled)
    updateChallan(c.id, { ...payload, challanNumber: c.challanNumber });
    navigate('/production');
  };

  return (
    <div>
      <PageHeader title={`Edit Challan — ${c.challanNumber}`} subtitle="Production register entry" />
      <ChallanForm
        mode="edit"
        takenNumbers={new Set()}
        initial={{
          challanNumber: c.challanNumber, date: c.date,
          productId: c.productId ?? '', productName: c.productName,
          designNo: c.designNo, pick: String(c.pick || ''), folderNo: c.folderNo,
          partyName: c.partyName, vendorId: c.vendorId ?? '',
          machinePatti: String(c.machinePatti || ''), mtrPerPic: String(c.mtrPerPic || ''),
          lines: c.lines,
        }}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/production')}
      />
    </div>
  );
}
