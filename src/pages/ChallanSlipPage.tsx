import { Printer } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/Card';
import { useAppStore } from '../store/useAppStore';
import { formatDate } from '../data/mockData';
import { sumRounds } from '../lib/challanMath';

const SLIP_PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #slip-print-area, #slip-print-area * { visibility: visible; }
  #slip-print-area { position: absolute; left: 0; top: 0; width: 100%; }
  .no-print { display: none !important; }
  @page { size: A5 portrait; margin: 8mm; }
}
`;

export function ChallanSlipPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const challans = useAppStore((s) => s.challans);
  const products = useAppStore((s) => s.products);
  const vendors = useAppStore((s) => s.vendors);
  const settings = useAppStore((s) => s.settings);

  const c = challans.find((x) => x.id === id);
  if (!c) {
    return (
      <div>
        <PageHeader title="Challan Slip" />
        <p className="text-sm text-muted">Challan not found. <button onClick={() => navigate('/production')} className="text-brand hover:underline">Back</button></p>
      </div>
    );
  }

  const product = products.find((p) => p.id === c.productId);
  const vendor = vendors.find((v) => v.id === c.vendorId);
  const totalRounds = sumRounds(c.lines);
  const rate = product?.spec?.ratePerMtr ?? product?.rate;
  const billValue = rate != null ? Math.round(c.totalMeters * rate * 100) / 100 : undefined;

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-3 py-1 border-b border-dashed border-gray-300">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-right">{value ?? '—'}</span>
    </div>
  );

  return (
    <div>
      <style>{SLIP_PRINT_CSS}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <BackButton />
        <Button className="ml-auto" onClick={() => window.print()}><Printer size={16} /> Print Slip (A5)</Button>
      </div>

      <div id="slip-print-area" className="max-w-[560px] mx-auto bg-white ring-1 ring-black/10 rounded-lg p-6 text-sm">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-2 mb-3">
          <h2 className="text-lg font-bold">{settings.companyName}</h2>
          <p className="text-xs text-gray-500">Production Slip / पर्ची</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6">
          <Row label="Challan No" value={c.challanNumber} />
          <Row label="तारीख / Date" value={c.date ? formatDate(c.date) : '—'} />
          <Row label="प्रोडक्ट / Product" value={c.productName} />
          <Row label="Party" value={c.partyName} />
          <Row label="डिजाइन / Design" value={c.designNo} />
          <Row label="Pick" value={c.pick || '—'} />
          <Row label="फोल्डर / Folder" value={c.folderNo} />
          <Row label="Machine Patti" value={c.machinePatti || '—'} />
          <Row label="Mtr per Pic" value={c.mtrPerPic || '—'} />
          <Row label="MIR Dez No" value={product?.spec?.mirName ?? '—'} />
        </div>

        {/* Sizes */}
        <div className="mt-4">
          <p className="font-semibold text-gray-700 mb-1">Sizes / तेग</p>
          <table className="w-full text-sm border border-gray-300">
            <thead><tr className="bg-gray-100">
              <th className="text-left px-2 py-1 border-b border-gray-300">Size</th>
              <th className="text-left px-2 py-1 border-b border-gray-300">Round</th>
            </tr></thead>
            <tbody>
              {c.lines.map((l, i) => (
                <tr key={i}><td className="px-2 py-1 border-b border-gray-200">{l.size}</td><td className="px-2 py-1 border-b border-gray-200">{l.round}</td></tr>
              ))}
              <tr className="font-semibold bg-gray-50">
                <td className="px-2 py-1">Total Rounds</td><td className="px-2 py-1">{totalRounds}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-4 grid grid-cols-2 gap-x-6">
          <Row label="TOTAL PIC" value={c.totalPieces.toLocaleString('en-IN')} />
          <Row label="TOTAL MTR" value={c.totalMeters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
          {rate != null && <Row label="Rate / Mtr" value={`₹${rate}`} />}
          {billValue != null && <Row label="Bill Value" value={`₹${billValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />}
        </div>

        {vendor && <p className="mt-3 text-xs text-gray-500">Vendor: {vendor.name}</p>}

        <div className="mt-8 flex justify-between text-xs text-gray-500">
          <span>ये पर्ची ऑफिस में देना है</span>
          <span>Sign: ____________</span>
        </div>
      </div>
    </div>
  );
}
