import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAppStore } from '../store/useAppStore';
import type { RateCard, RateCardKgRow, RateCardMeterRow } from '../types';

const DEFAULT_RATE_CARD: RateCard = {
  lowPickMax: 70,
  meterRates: [
    { type: 'LB', lowPickRate: 1.75, highPickRate: 2.25 },
    { type: 'maharani', lowPickRate: 1.5, highPickRate: 1.75 },
    { type: 'JQ', lowPickRate: 0.65 },
  ],
  kgRates: [{ type: 'TONY PATTI', rate: 30 }],
};

export function RateCardPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [card, setCard] = useState<RateCard>(settings.rateCard ?? DEFAULT_RATE_CARD);

  const setMeterRow = (i: number, patch: Partial<RateCardMeterRow>) =>
    setCard((c) => ({ ...c, meterRates: c.meterRates.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const setKgRow = (i: number, patch: Partial<RateCardKgRow>) =>
    setCard((c) => ({ ...c, kgRates: c.kgRates.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));

  const addMeterRow = () => setCard((c) => ({ ...c, meterRates: [...c.meterRates, { type: '' }] }));
  const removeMeterRow = (i: number) => setCard((c) => ({ ...c, meterRates: c.meterRates.filter((_, idx) => idx !== i) }));
  const addKgRow = () => setCard((c) => ({ ...c, kgRates: [...c.kgRates, { type: '' }] }));
  const removeKgRow = (i: number) => setCard((c) => ({ ...c, kgRates: c.kgRates.filter((_, idx) => idx !== i) }));

  const numOrUndef = (s: string) => { const n = Number(s); return s.trim() && Number.isFinite(n) ? n : undefined; };

  const handleSave = () => {
    // Drop rows with no type label
    const clean: RateCard = {
      lowPickMax: card.lowPickMax || 70,
      meterRates: card.meterRates.filter((r) => r.type.trim()),
      kgRates: card.kgRates.filter((r) => r.type.trim()),
    };
    updateSettings({ rateCard: clean });
    setCard(clean);
  };

  return (
    <div>
      <PageHeader title="Rate Card" subtitle="Production rates — per meter (by pick) and per kg." action={<Button onClick={handleSave}><Save size={16} /> Save</Button>} />

      <Card className="p-6 mb-5 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <h4 className="text-sm font-semibold text-charcoal">Rate per Meter (pick-wise)</h4>
          <Button type="button" variant="outline" onClick={addMeterRow} className="ml-auto"><Plus size={14} /> Row</Button>
        </div>
        <div className="flex items-center gap-2 mb-3 text-xs text-muted">
          <span>Low-pick column covers picks 1 to</span>
          <input
            type="number"
            value={card.lowPickMax}
            onChange={(e) => setCard((c) => ({ ...c, lowPickMax: Number(e.target.value) || 0 }))}
            className="w-16 rounded border border-border px-2 py-1 text-sm"
          />
          <span>; high-pick column covers the rest.</span>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface border-b border-border">
              {['Type', `1–${card.lowPickMax} pick (₹)`, `${card.lowPickMax + 1}+ pick (₹)`, ''].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {card.meterRates.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2"><Input value={r.type} onChange={(e) => setMeterRow(i, { type: e.target.value })} placeholder="LB" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={r.lowPickRate ?? ''} onChange={(e) => setMeterRow(i, { lowPickRate: numOrUndef(e.target.value) })} placeholder="1.75" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={r.highPickRate ?? ''} onChange={(e) => setMeterRow(i, { highPickRate: numOrUndef(e.target.value) })} placeholder="2.25" /></td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeMeterRow(i)} className="text-muted hover:text-red-500"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <h4 className="text-sm font-semibold text-charcoal">Rate per Kg</h4>
          <Button type="button" variant="outline" onClick={addKgRow} className="ml-auto"><Plus size={14} /> Row</Button>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-surface border-b border-border">
              {['Type', 'Rate per Kg (₹)', ''].map((h) => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {card.kgRates.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2"><Input value={r.type} onChange={(e) => setKgRow(i, { type: e.target.value })} placeholder="TONY PATTI" /></td>
                  <td className="px-3 py-2"><Input type="number" step="0.01" value={r.rate ?? ''} onChange={(e) => setKgRow(i, { rate: numOrUndef(e.target.value) })} placeholder="30" /></td>
                  <td className="px-3 py-2 text-right"><button type="button" onClick={() => removeKgRow(i)} className="text-muted hover:text-red-500"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
