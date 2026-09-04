import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, SearchableSelect, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { formatQty } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';
import { useEscapeBack } from '../hooks/useEscapeBack';

export function DispatchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobWorks = useAppStore((s) => s.jobWorks);
  const vendors = useAppStore((s) => s.vendors);
  const products = useAppStore((s) => s.products);
  const currentUser = useAppStore((s) => s.currentUser);
  const createDispatch = useAppStore((s) => s.createDispatch);

  const [jobId, setJobId] = useState(searchParams.get('job') ?? '');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driver, setDriver] = useState('');
  const [transport, setTransport] = useState('Own Vehicle');
  const [remarks, setRemarks] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastDispatchId, setLastDispatchId] = useState('');

  // ESC → go back
  useEscapeBack(() => navigate(-1));

  const job = jobWorks.find((j) => j.id === jobId);

  const items = useMemo(() => {
    if (!job) return [];
    return job.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const variant = product?.variants.find((v) => v.id === item.variantId);
      const required = item.sentQuantity === 0 ? item.sentQuantity : Math.max(0, item.sentQuantity - item.receivedQuantity);
      return { ...item, product, variant, required };
    });
  }, [job, products]);

  const handleDispatch = () => {
    if (!job) return;
    const dispatchItems = job.items
      .map((item) => ({
        jobWorkItemId: item.id,
        variantId: item.variantId,
        quantity: quantities[item.id] ?? 0,
      }))
      .filter((i) => i.quantity > 0);

    if (dispatchItems.length === 0) return;

    const id = createDispatch({
      jobWorkId: job.id,
      date: new Date().toISOString().slice(0, 10),
      vehicleNumber,
      driver,
      transport,
      remarks,
      items: dispatchItems,
      createdBy: currentUser?.name ?? 'User',
    });

    setLastDispatchId(id);
    setShowSuccess(true);
  };

  return (
    <div>
      <PageHeader title="Material Dispatch" subtitle="Dispatch material and generate challan" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="p-6">
            <SearchableSelect
              label="Job Work"
              value={jobId}
              onChange={(val) => { setJobId(val); setQuantities({}); }}
              placeholder="Search job number or vendor..."
              options={jobWorks
                .filter((j) => j.status !== 'Completed' && j.status !== 'Cancelled')
                .map((j) => ({
                  value: j.id,
                  label: `${j.jobNumber} — ${vendors.find((v) => v.id === j.vendorId)?.name ?? ''}`,
                }))}
            />

            {job && (
              <div className="mt-4 p-3 bg-surface rounded-lg text-sm">
                <p>Vendor: <strong>{vendors.find((v) => v.id === job.vendorId)?.name}</strong></p>
                <p>Process: <strong>{job.process}</strong></p>
              </div>
            )}
          </Card>

          {job && (
            <Card className="p-6">
              <h3 className="text-base font-semibold mb-4">Job Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface">
                      {['Product', 'Variant', 'Available', 'Required', 'Dispatch Now'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-muted uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-3 py-2">{item.product?.name}</td>
                        <td className="px-3 py-2">{item.variant?.name}</td>
                        <td className="px-3 py-2">{formatQty(item.required || item.sentQuantity, item.product?.unit ?? '')}</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={quantities[item.id] ?? ''}
                            onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                            className="w-24 px-2 py-1 border border-border rounded text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-brand/5 border-t-2 border-brand/30">
                      <th className="text-left px-3 py-2.5 text-xs font-bold text-charcoal uppercase tracking-wide" colSpan={2}>
                        Total ({items.length} item{items.length !== 1 ? 's' : ''})
                      </th>
                      <th className="text-left px-3 py-2.5 text-sm font-bold text-charcoal">
                        {items.reduce((s, i) => s + (i.required || i.sentQuantity || 0), 0).toLocaleString('en-IN')}
                      </th>
                      <th className="px-3 py-2.5" />
                      <th className="text-left px-3 py-2.5">
                        <span className="inline-block w-24 px-2 py-1 rounded text-sm text-center font-bold text-brand bg-white border border-brand/40">
                          {items.reduce((s, i) => s + (quantities[i.id] ?? 0), 0).toLocaleString('en-IN')}
                        </span>
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="text-base font-semibold mb-4">Transport Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Vehicle Number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="GJ-05-AB-1234" />
              <Input label="Driver" value={driver} onChange={(e) => setDriver(e.target.value)} />
              <Input label="Transport" value={transport} onChange={(e) => setTransport(e.target.value)} />
              <div className="md:col-span-2">
                <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 h-fit sticky top-6">
          <Button className="w-full mb-3" onClick={handleDispatch} disabled={!job}>
            Dispatch & Generate Challan
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate('/dispatch/history')}>
            View History
          </Button>
        </Card>
      </div>

      <Modal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Material Dispatched Successfully"
        footer={
          <>
            <Button variant="outline" onClick={() => navigate(`/challans/${lastDispatchId}`)}>Print Challan</Button>
            <Button onClick={() => navigate(`/job-works/${jobId}`)}>View Job</Button>
          </>
        }
      >
        <p className="text-sm text-muted">Material has been dispatched and challan generated successfully.</p>
      </Modal>
    </div>
  );
}

export function DispatchHistoryPage() {
  const navigate = useNavigate();
  const dispatches = useAppStore((s) => s.dispatches);
  const jobWorks = useAppStore((s) => s.jobWorks);

  return (
    <div>
      <PageHeader title="Dispatch History" subtitle={`${dispatches.length} dispatches`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Challan', 'Job Work', 'Date', 'Vehicle', 'Driver', 'Transport', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => {
                const job = jobWorks.find((j) => j.id === d.jobWorkId);
                return (
                  <tr key={d.id} className="border-b border-border">
                    <td className="px-4 py-3 font-medium text-brand">{d.challanNumber}</td>
                    <td className="px-4 py-3">{job?.jobNumber}</td>
                    <td className="px-4 py-3">{d.date}</td>
                    <td className="px-4 py-3">{d.vehicleNumber}</td>
                    <td className="px-4 py-3">{d.driver}</td>
                    <td className="px-4 py-3">{d.transport}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/challans/${d.id}`)} className="text-xs text-brand hover:underline">View Challan</button>
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
