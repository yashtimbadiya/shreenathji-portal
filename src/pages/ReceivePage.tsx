﻿import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, PageHeader } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDate } from '../data/mockData';
import { useAppStore } from '../store/useAppStore';

// Tab index map for the Receipt form
const T = {
  receiptDate:   1,
  receivedBy:    2,
  vendorChallan: 3,
  remarks:       4,
};

export function ReceivePage() {
  const jobWorks    = useAppStore((s) => s.jobWorks);
  const dispatches  = useAppStore((s) => s.dispatches);
  const vendors     = useAppStore((s) => s.vendors);
  const products    = useAppStore((s) => s.products);
  const currentUser = useAppStore((s) => s.currentUser);
  const createReceipt = useAppStore((s) => s.createReceipt);
  const addToast    = useAppStore((s) => s.addToast);
  const navigate    = useNavigate();

  const [search,        setSearch]        = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [receiptDate,   setReceiptDate]   = useState(new Date().toISOString().slice(0, 10));
  const [receivedBy,    setReceivedBy]    = useState(currentUser?.name ?? '');
  const [vendorChallan, setVendorChallan] = useState('');
  const [remarks,       setRemarks]       = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  const confirmBtnRef     = useRef<HTMLButtonElement>(null);
  const qtyTableRef       = useRef<HTMLTableSectionElement>(null);
  const searchInputRef    = useRef<HTMLInputElement>(null);
  const firstQtyInputRef  = useRef<HTMLInputElement>(null);

  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Focus first "Receive Now" input when a job is selected
  useEffect(() => {
    if (selectedJobId) {
      // Small tick to let the table render first
      setTimeout(() => firstQtyInputRef.current?.focus(), 0);
    }
  }, [selectedJobId]);

  // Latest jobs first
  const allJobs = useMemo(() => {
    return jobWorks
      .filter((j) => ['Sent', 'Processing', 'Overdue', 'Partial'].includes(j.status))
      .slice()
      .sort((a, b) => {
        const order: Record<string, number> = { Partial: 0, Overdue: 1, Sent: 2, Processing: 3 };
        const byStatus = (order[a.status] ?? 4) - (order[b.status] ?? 4);
        return byStatus !== 0 ? byStatus : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [jobWorks]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return allJobs.slice(0, 8);
    const q = search.toLowerCase();
    return allJobs.filter((job) => {
      const vendor = vendors.find((v) => v.id === job.vendorId);
      const disp   = dispatches.find((d) => d.jobWorkId === job.id);
      return (
        job.jobNumber.toLowerCase().includes(q) ||
        (vendor?.name ?? '').toLowerCase().includes(q) ||
        (disp?.challanNumber ?? '').toLowerCase().includes(q)
      );
    }).slice(0, 8);
  }, [search, allJobs, vendors, dispatches]);

  // Pre-highlight the first result whenever results change
  useEffect(() => {
    setHighlightedIdx(searchResults.length > 0 ? 0 : -1);
  }, [searchResults]);

  const job    = jobWorks.find((j) => j.id === selectedJobId);
  const vendor = vendors.find((v) => v.id === job?.vendorId);
  const disp   = dispatches.find((d) => d.jobWorkId === selectedJobId);

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setReceiveQty({});
    const j  = jobWorks.find((jw) => jw.id === jobId);
    const d  = dispatches.find((dd) => dd.jobWorkId === jobId);
    setSearch('');
    setHighlightedIdx(-1);
    setVendorChallan(d?.challanNumber ?? '');
    if (j) {
      const prefill: Record<string, string> = {};
      j.items.forEach((item) => {
        const pending = Math.max(0, item.sentQuantity - item.receivedQuantity);
        if (pending > 0) prefill[item.id] = '0';
      });
      setReceiveQty(prefill);
    }
  };

  const clearSelection = () => {
    setSelectedJobId('');
    setReceiveQty({});
    setSearch('');
    setHighlightedIdx(-1);
    setVendorChallan('');
  };

  const setQty = (itemId: string, val: string) =>
    setReceiveQty((prev) => ({ ...prev, [itemId]: val }));

  // Ctrl+Enter -> confirm receipt
  useEffect(() => {
    if (!job) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        confirmBtnRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [job]);

  /** Move focus to the next receive-qty input, or to the Confirm button if last */
  const focusNextQtyInput = (currentItemId: string) => {
    if (!qtyTableRef.current) return;
    const inputs = Array.from(
      qtyTableRef.current.querySelectorAll<HTMLInputElement>('input[data-qty-id]'),
    );
    const idx = inputs.findIndex((el) => el.dataset.qtyId === currentItemId);
    if (idx >= 0 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    } else {
      confirmBtnRef.current?.focus();
    }
  };

  const handleConfirm = () => {
    if (!job) return;
    const items = job.items
      .map((item) => ({
        jobWorkItemId: item.id,
        variantId:     item.variantId,
        received:      Number(receiveQty[item.id] ?? 0),
        rejected:      0,
        loss:          0,
      }))
      .filter((i) => i.received > 0);

    if (items.length === 0) {
      addToast('Enter at least one received quantity.', 'error');
      return;
    }

    const invalid = items.find((i) => {
      const ji = job.items.find((ji) => ji.id === i.jobWorkItemId);
      return ji ? i.received > (ji.sentQuantity - ji.receivedQuantity) : false;
    });

    if (invalid) {
      addToast('Received quantity cannot exceed pending for any item.', 'error');
      return;
    }

    createReceipt({
      jobWorkId:           job.id,
      date:                receiptDate,
      receivedBy,
      vendorChallanNumber: vendorChallan,
      remarks,
      items,
      createdBy:           currentUser?.name ?? 'User',
    });

    navigate(`/job-works/${job.id}`);
  };

  return (
    <div>
      <PageHeader title="Receive Material" subtitle="Record material received from vendor" />

      {/* Search / select job */}
      <Card className="p-6 mb-6">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Search Job Work</p>
        <div className="relative max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchInputRef}
            autoFocus
            type="text"
            placeholder="Search by job number, vendor name, or challan..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (selectedJobId) clearSelection(); }}
            onKeyDown={(e) => {
              if (!searchResults.length || selectedJobId) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIdx((i) => Math.min(i + 1, searchResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const idx = highlightedIdx >= 0 ? highlightedIdx : 0;
                if (searchResults[idx]) handleSelectJob(searchResults[idx].id);
              } else if (e.key === 'Escape') {
                setSearch('');
              }
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-charcoal">
              <X size={14} />
            </button>
          )}
        </div>

        {!selectedJobId && searchResults.length > 0 && (
          <div className="mt-2 border border-border rounded-lg overflow-hidden max-w-xl divide-y divide-border">
            {searchResults.map((j, idx) => {
              const v = vendors.find((vv) => vv.id === j.vendorId);
              const d = dispatches.find((dd) => dd.jobWorkId === j.id);
              const isHighlighted = idx === highlightedIdx;
              return (
                <button
                  key={j.id}
                  onClick={() => handleSelectJob(j.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    isHighlighted ? 'bg-brand/10' : 'hover:bg-surface/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand text-sm">{j.jobNumber}</p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="font-medium text-charcoal">{v?.name ?? '—'}</span>
                        {d && <span> · {d.challanNumber}</span>}
                        <span> · Due {formatDate(j.expectedReturnDate)}</span>
                      </p>
                    </div>
                    <StatusBadge status={j.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {!selectedJobId && !search && allJobs.length === 0 && (
          <p className="mt-3 text-sm text-muted">No jobs currently awaiting receipt.</p>
        )}
      </Card>

      {/* Job details + receive form */}
      {job && (
        <div className="space-y-6">

          {/* Keyboard hint */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-700">
            <span className="font-semibold">⌨ Keyboard</span>
            <span className="text-blue-500">·</span>
            <span><kbd className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — next quantity row</span>
            <span className="text-blue-500">·</span>
            <span className="font-semibold text-blue-800">
              <kbd className="bg-blue-200 px-1.5 py-0.5 rounded font-mono">Ctrl+Enter</kbd> — Confirm Receipt
            </span>
          </div>

          {/* Job info card */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-charcoal">{job.jobNumber}</h2>
                  <StatusBadge status={job.status} />
                </div>
                <p className="text-sm text-muted mt-0.5">
                  {vendor?.name ?? '—'}{vendor?.mobile && <span> · {vendor.mobile}</span>}
                </p>
              </div>
              <button type="button" onClick={clearSelection}
                className="text-muted hover:text-charcoal text-xs flex items-center gap-1">
                <X size={14} /> Change job
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-0.5">Vendor</p>
                <p className="font-medium text-charcoal">{vendor?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-0.5">Process</p>
                <p className="font-medium text-charcoal">{job.process}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-0.5">Challan</p>
                <p className="font-medium text-charcoal">{disp?.challanNumber ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase font-semibold mb-0.5">Due Date</p>
                <p className="font-medium text-charcoal">{formatDate(job.expectedReturnDate)}</p>
              </div>
            </div>
          </Card>

          {/* Receive quantities table */}
          <Card>
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-charcoal">Receive Quantities</h3>
              <p className="text-xs text-muted">Pre-filled with pending quantity. Adjust as needed — each row is independent.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    {['Product', 'Sent', 'Already Received', 'Pending', 'Receive Now'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={qtyTableRef}>
                  {(() => {
                    let firstActiveAssigned = false;
                    return job.items.map((item) => {
                    const prod    = products.find((p) => p.id === item.productId);
                    const pending = Math.max(0, item.sentQuantity - item.receivedQuantity);
                    const val     = receiveQty[item.id] ?? (pending > 0 ? '0' : '');
                    const numVal  = Number(val) || 0;
                    const isOver  = numVal > pending;
                    const isFirstActive = !firstActiveAssigned && pending > 0;
                    if (isFirstActive) firstActiveAssigned = true;

                    return (
                      <tr key={item.id} className="border-b border-border">
                        <td className="px-4 py-3">
                          <p className="font-medium text-charcoal">{prod?.name ?? '—'}</p>
                          <p className="text-xs text-muted">{prod?.unit ?? 'Pic'}</p>
                        </td>
                        <td className="px-4 py-3 text-charcoal">{item.sentQuantity.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-success font-medium">{item.receivedQuantity.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${pending > 0 ? 'text-orange-600' : 'text-muted'}`}>
                            {pending.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input
                              ref={isFirstActive ? firstQtyInputRef : undefined}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              data-qty-id={item.id}
                              value={val}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9]/g, '');
                                setQty(item.id, clean);
                              }}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  focusNextQtyInput(item.id);
                                }
                              }}
                              disabled={pending === 0}
                              className={`w-28 px-2.5 py-1.5 border rounded-lg text-sm text-center focus:outline-none focus:ring-2
                                ${isOver
                                  ? 'border-red-400 focus:ring-red-300 text-red-600'
                                  : 'border-border focus:ring-brand/30 focus:border-brand'}
                                ${pending === 0 ? 'bg-surface text-muted cursor-not-allowed' : 'bg-white'}`}
                              placeholder={pending === 0 ? 'Done' : '0'}
                            />
                            {isOver && (
                              <p className="text-xs text-red-500">Max {pending}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });})()}
                </tbody>
                <tfoot>
                  <tr className="bg-brand/5 border-t-2 border-brand/30">
                    <th className="text-left px-4 py-3 text-xs font-bold text-charcoal uppercase tracking-wide">
                      Total ({job.items.length} item{job.items.length !== 1 ? 's' : ''})
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-bold text-charcoal">
                      {job.items.reduce((s, i) => s + i.sentQuantity, 0).toLocaleString('en-IN')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-bold text-success">
                      {job.items.reduce((s, i) => s + i.receivedQuantity, 0).toLocaleString('en-IN')}
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-bold text-orange-600">
                      {job.items.reduce((s, i) => s + Math.max(0, i.sentQuantity - i.receivedQuantity), 0).toLocaleString('en-IN')}
                    </th>
                    <th className="text-left px-4 py-3">
                      <span className="inline-block w-28 px-2.5 py-1.5 rounded-lg text-sm text-center font-bold text-brand bg-white border border-brand/40">
                        {job.items.reduce((s, i) => s + (Number(receiveQty[i.id]) || 0), 0).toLocaleString('en-IN')}
                      </span>
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Receipt details */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Receipt Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4" data-form>
              <Input label="Receipt Date" type="date" value={receiptDate}
                tabIndex={T.receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)} />
              <Input label="Received By" value={receivedBy}
                tabIndex={T.receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)} />
              <Input label="Vendor Challan Number" value={vendorChallan}
                tabIndex={T.vendorChallan}
                onChange={(e) => setVendorChallan(e.target.value)}
                placeholder="Optional" />
              <div className="md:col-span-2">
                <Textarea label="Remarks" value={remarks}
                  tabIndex={T.remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
              >
                Confirm Receipt
                <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">Ctrl+↵</kbd>
              </button>
              <Button variant="outline" onClick={clearSelection}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
export function ReceiptHistoryPage() {
  const receipts  = useAppStore((s) => s.receipts);
  const jobWorks  = useAppStore((s) => s.jobWorks);
  const vendors   = useAppStore((s) => s.vendors);
  const products  = useAppStore((s) => s.products);

  // Latest receipts first
  const sorted = useMemo(
    () => [...receipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [receipts],
  );

  return (
    <div>
      <PageHeader title="Receipt History" subtitle={`${receipts.length} receipts`} />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {['Date', 'Job Work', 'Vendor', 'Received By', 'Subproduct', 'Vendor Challan', 'Quantity'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    No receipts recorded yet.
                  </td>
                </tr>
              )}
              {sorted.map((r) => {
                const job    = jobWorks.find((j) => j.id === r.jobWorkId);
                const vendor = vendors.find((v) => v.id === job?.vendorId);

                const subproductNames = [...new Set(
                  r.items.map((ri) => {
                    const jobItem = job?.items.find(
                      (ji) => (ri.jobWorkItemId && ji.id === ri.jobWorkItemId) || ji.variantId === ri.variantId
                    );
                    return jobItem ? products.find((p) => p.id === jobItem.productId)?.name : undefined;
                  }).filter(Boolean)
                )] as string[];

                const totalReceived = r.items.reduce((sum, ri) => sum + ri.received, 0);

                return (
                  <tr key={r.id} className="border-b border-border hover:bg-surface/50">
                    <td className="px-4 py-3">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 font-semibold text-brand">{job?.jobNumber ?? '—'}</td>
                    <td className="px-4 py-3">{vendor?.name ?? '—'}</td>
                    <td className="px-4 py-3">{r.receivedBy}</td>
                    <td className="px-4 py-3">
                      {subproductNames.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {subproductNames.map((name) => (
                            <span key={name} className="text-charcoal text-sm">{name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.vendorChallanNumber ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-charcoal">
                      {totalReceived.toLocaleString('en-IN')} Pic
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
