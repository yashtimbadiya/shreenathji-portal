import { Pencil, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../data/mockData';
import { sortByDateDesc } from '../lib/sorting';

/**
 * Production Register — the imported challan register (tab 4 of the production
 * workbook). Distinct from the job-work dispatch challans at /challans.
 */
export function ProductionRegisterPage() {
  const challans = useAppStore((s) => s.challans);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const importChallanRegister = useAppStore((s) => s.importChallanRegister);
  const deleteChallan = useAppStore((s) => s.deleteChallan);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; number: string } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    await importChallanRegister(file);
    setImporting(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? challans.filter(
          (c) =>
            c.challanNumber.toLowerCase().includes(q) ||
            c.productName.toLowerCase().includes(q) ||
            c.partyName.toLowerCase().includes(q),
        )
      : challans;
    return sortByDateDesc(list, (c) => c.date);
  }, [challans, search]);

  return (
    <div>
      <PageHeader
        title="Production Register"
        subtitle={`${challans.length} challan${challans.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              title="Import the challan register (.xlsx)"
            >
              <Upload size={16} /> {importing ? 'Importing…' : 'Import Register'}
            </Button>
            <Link to="/production/new"><Button><Plus size={16} /> Add Challan</Button></Link>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <Input
          placeholder="Search by challan no, product, or party…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Challan', 'Date', 'Product', 'Party', 'Sizes', 'Total Pcs', 'Total Mtr', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const product = products.find((p) => p.id === c.productId);
                const vendor = vendors.find((v) => v.id === c.vendorId);
                const sizes = c.lines.map((l) => `${l.size}×${l.round}`).join(', ');
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <Link to={`/production/${c.id}/slip`} className="font-semibold text-brand hover:underline">{c.challanNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.date ? formatDate(c.date) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-charcoal">{c.productName}</span>
                      {!product && c.productName && (
                        <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-orange-50 text-orange-600 border-orange-200">
                          unlinked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.partyName}
                      {vendor && <span className="ml-1.5 text-[10px] text-green-600">✓</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{sizes || '—'}</td>
                    <td className="px-4 py-3">{c.totalPieces.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-muted">
                      {c.totalMeters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/production/${c.id}/slip`} className="text-muted hover:text-brand transition-colors" title="Print slip">
                          <Printer size={14} />
                        </Link>
                        <Link to={`/production/${c.id}/edit`} className="text-muted hover:text-brand transition-colors" title="Edit">
                          <Pencil size={14} />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget({ id: c.id, number: c.challanNumber })}
                          className="text-muted hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {challans.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No production challans yet. Use <span className="font-medium">Import Register</span> to load the challan register sheet (.xlsx).
                  </td>
                </tr>
              )}
              {challans.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                    No challans match “{search}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { deleteChallan(deleteTarget.id); setDeleteTarget(null); } }}
        title="Delete Challan"
        message={`Delete challan "${deleteTarget?.number}" from the production register? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
