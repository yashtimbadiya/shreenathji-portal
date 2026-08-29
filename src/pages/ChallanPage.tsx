import { Download, Printer, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { formatCurrency, formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

export function ChallansPage() {
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks = useAppStore((s) => s.jobWorks);

  return (
    <div>
      <PageHeader title="All Challans" subtitle={`${dispatches.length} challans`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Challan Number', 'Job Work', 'Date', 'Vehicle', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => {
                const job = jobWorks.find((j) => j.id === d.jobWorkId);
                return (
                  <tr key={d.id} className="border-b border-border">
                    <td className="px-4 py-3">
                      <Link to={`/challans/${d.id}`} className="font-medium text-brand hover:underline">{d.challanNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{job?.jobNumber}</td>
                    <td className="px-4 py-3">{formatDate(d.date)}</td>
                    <td className="px-4 py-3">{d.vehicleNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <Link to={`/challans/${d.id}`} className="text-xs text-brand hover:underline">View / Print</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ChallanDetailPage() {
  const { id } = useParams();
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks = useAppStore((s) => s.jobWorks);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const categories = useAppStore((s) => s.categories);
  const settings = useAppStore((s) => s.settings);

  const dispatch = dispatches.find((d) => d.id === id);
  if (!dispatch) return <div className="text-center py-16 text-muted">Challan not found</div>;

  const job = jobWorks.find((j) => j.id === dispatch.jobWorkId);
  const vendor = vendors.find((v) => v.id === job?.vendorId) ?? null;

  const items = dispatch.items
    .map((di) => {
      // Prefer matching by jobWorkItemId (unique per row) to avoid collisions when
      // multiple job items share the same variantId. Fall back to variantId for older records.
      let jobItem = job?.items.find((ji) => di.jobWorkItemId && di.jobWorkItemId === ji.id);
      if (!jobItem) jobItem = job?.items.find((ji) => ji.variantId === di.variantId);
      const product = products.find((p) => p.id === jobItem?.productId)
        ?? products.find((p) => p.variants.some((v) => v.id === di.variantId));
      const rate = jobItem?.rate ?? 0;
      return {
        product,
        quantity: di.quantity,
        weight: di.weight,
        rate,
        amount: di.quantity * rate,
      };
    })
    .filter(Boolean);

  const totalAmount = items.reduce((sum, item) => sum + (item?.amount ?? 0), 0);

  return (
    <div>
      {/* Print CSS */}
      <style>{`@media print { @page { size: A5 landscape; margin: 8mm; } .no-print { display: none !important; } }`}</style>

      {/* Screen-only action bar */}
      <div className="no-print mb-4 flex items-center gap-4">
        <BackButton to="/challans" />
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => window.print()}><Printer size={16} /> Print</Button>
          <Button variant="outline"><Download size={16} /> Download PDF</Button>
          <Button variant="outline"><Share2 size={16} /> Share</Button>
        </div>
      </div>

      {/* A5 Challan Card */}
      <Card className="max-w-2xl mx-auto p-6 print:shadow-none print:border-0 print:p-0 print:max-w-none">

        {/* Header: two-column */}
        <div className="flex items-start justify-between border-b-2 border-brand pb-3 mb-4">
          <div>
            <h1 className="text-lg font-bold text-brand">{settings.companyName}</h1>
            <p className="text-xs text-muted leading-snug mt-0.5">{settings.address}</p>
            <p className="text-xs text-muted">Ph: {settings.phone} | GST: {settings.gstin}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold text-charcoal uppercase tracking-wide">Delivery Challan</p>
            <p className="text-xs text-muted mt-0.5">No: <span className="font-semibold text-charcoal">{dispatch.challanNumber}</span></p>
            <p className="text-xs text-muted">Date: <span className="font-semibold text-charcoal">{formatDate(dispatch.date)}</span></p>
            <p className="text-xs text-muted">Job: <span className="font-semibold text-charcoal">{job?.jobNumber ?? '—'}</span></p>
            {job?.reference && (
              <p className="text-xs font-semibold text-brand mt-0.5">Ref: {job.reference}</p>
            )}
          </div>
        </div>

        {/* Vendor info */}
        <div className="mb-4 grid grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg bg-surface border border-border px-3 py-2">
            <p className="text-muted uppercase font-semibold text-[10px] mb-1">To (Vendor)</p>
            <p className="font-semibold text-charcoal">{vendor?.name ?? '—'}</p>
            <p className="text-muted">{vendor?.contactPerson} · {vendor?.mobile}</p>
            {vendor?.gstNumber && <p className="text-muted">GST: {vendor.gstNumber}</p>}
          </div>
          <div className="rounded-lg bg-surface border border-border px-3 py-2">
            <p className="text-muted uppercase font-semibold text-[10px] mb-1">Transport</p>
            <p className="font-semibold text-charcoal">{dispatch.transport}</p>
            {dispatch.vehicleNumber && <p className="text-muted">Vehicle: {dispatch.vehicleNumber}</p>}
            {dispatch.driver && <p className="text-muted">Driver: {dispatch.driver}</p>}
            <p className="text-muted">Process: <span className="font-medium text-charcoal">{job?.process ?? '—'}</span></p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-xs mb-4 border border-border">
          <thead>
            <tr className="bg-surface">
              <th className="text-left px-2 py-2 border border-border font-semibold">#</th>
              <th className="text-left px-2 py-2 border border-border font-semibold">Product</th>
              <th className="text-left px-2 py-2 border border-border font-semibold">Category</th>
              <th className="text-right px-2 py-2 border border-border font-semibold">Pieces</th>
              <th className="text-right px-2 py-2 border border-border font-semibold">Weight (kg)</th>
              <th className="text-right px-2 py-2 border border-border font-semibold">Rate</th>
              <th className="text-right px-2 py-2 border border-border font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const catName = item!.product
                ? categories.find((c) => c.id === item!.product!.categoryId)?.name ?? '—'
                : '—';
              return (
                <tr key={i}>
                  <td className="px-2 py-1.5 border border-border text-muted">{i + 1}</td>
                  <td className="px-2 py-1.5 border border-border font-medium">{item!.product?.name ?? '—'}</td>
                  <td className="px-2 py-1.5 border border-border text-muted">{catName}</td>
                  <td className="px-2 py-1.5 border border-border text-right">{item!.quantity.toLocaleString()}</td>
                  <td className="px-2 py-1.5 border border-border text-right">
                    {item!.weight != null ? `${item!.weight} kg` : '—'}
                  </td>
                  <td className="px-2 py-1.5 border border-border text-right">{formatCurrency(item!.rate ?? 0)}</td>
                  <td className="px-2 py-1.5 border border-border text-right font-semibold">{formatCurrency(item!.amount ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-surface">
              <td colSpan={3} className="px-2 py-2 border border-border font-bold uppercase text-[10px] tracking-wide">Total</td>
              <td className="px-2 py-2 border border-border text-right font-bold">
                {items.reduce((s, i) => s + (i?.quantity ?? 0), 0).toLocaleString()} Pic
              </td>
              <td className="px-2 py-2 border border-border text-right font-bold">
                {items.some((i) => i?.weight != null)
                  ? `${items.reduce((s, i) => s + (i?.weight ?? 0), 0).toFixed(3)} kg`
                  : '—'}
              </td>
              <td className="px-2 py-2 border border-border" />
              <td className="px-2 py-2 border border-border text-right font-bold text-brand">{formatCurrency(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks + Total amount */}
        <div className="flex justify-between items-start mb-6 text-xs">
          <div>
            {dispatch.remarks && (
              <p><span className="text-muted">Remarks:</span> {dispatch.remarks}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-muted uppercase font-semibold text-[10px]">Total Amount</p>
            <p className="text-xl font-bold text-brand">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Signature lines */}
        <div className="flex justify-between mt-10 text-xs">
          <div className="text-center">
            <div className="w-40 border-t border-charcoal pt-2">
              <p className="font-medium">Authorized Signature</p>
              <p className="text-muted">{settings.companyName}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="w-40 border-t border-charcoal pt-2">
              <p className="font-medium">Vendor Signature</p>
              <p className="text-muted">{vendor?.name ?? '—'}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
