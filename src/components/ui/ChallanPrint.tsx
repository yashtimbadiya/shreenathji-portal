/**
 * ChallanPrintPreview
 * ────────────────────────────────────────────────────────────────────────────
 * Renders an A5-landscape delivery challan that looks identical on-screen and
 * when printed.  Both CreateJobWorkPage (inline dialog) and ChallanDetailPage
 * import and reuse this component.
 *
 * On-screen sizing
 * ─────────────────
 * A5 landscape = 210 mm × 148 mm.
 * At 96 dpi that is ≈ 794 px × 560 px.
 * We render the card at exactly those CSS pixel dimensions so the user sees a
 * true WYSIWYG preview before hitting Print.
 *
 * Print behaviour
 * ────────────────
 * The parent page/dialog injects a <style> block with:
 *   @page { size: A5 landscape; margin: 0; }
 * This component uses id="challan-print-area" so the parent CSS can target it.
 * All non-print UI (action bars, modal chrome) carries className="no-print".
 */

import type { Category, Product, Settings, Vendor } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChallanLineItem {
  productName: string;
  categoryName: string;
  variantName?: string;
  quantity: number;
  weight?: number | null;
  rate: number;
  amount: number;
}

export interface ChallanPrintData {
  challanNumber: string;
  date: string;               // ISO date string, displayed as-is or formatted by caller
  jobNumber: string;
  reference?: string;
  process: string;
  vendor: Pick<Vendor, 'name' | 'contactPerson' | 'mobile' | 'gstNumber'> | null;
  transport: string;
  vehicleNumber?: string;
  driver?: string;
  remarks?: string;
  items: ChallanLineItem[];
  settings: Pick<Settings, 'companyName' | 'address' | 'phone' | 'gstin'>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Pure presentational component — no hooks, no store access.
 * All data is passed as props so it can be used inside dialogs, detail pages,
 * and anywhere a print preview is needed.
 */
export function ChallanPrintPreview({ data }: { data: ChallanPrintData }) {
  const { challanNumber, date, jobNumber, reference, process, vendor,
          transport, vehicleNumber, driver, remarks, items, settings } = data;

  const totalPieces = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const totalWeight = items.some((i) => i.weight != null)
    ? items.reduce((s, i) => s + (i.weight ?? 0), 0)
    : null;

  // ── A5 landscape at 96 dpi → 794 × 560 px ───────────────────────────────
  const PAGE: React.CSSProperties = {
    width:      '794px',
    minHeight:  '560px',
    padding:    '24px 28px',
    background: '#ffffff',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize:   '11px',
    color:      '#111827',
    boxSizing:  'border-box',
    // NOTE: no overflow:hidden, no position:relative here — either would
    // prevent position:fixed from escaping the element during @media print.
  };

  const TH: React.CSSProperties = {
    border: '1px solid #d1d5db',
    padding: '5px 8px',
    fontWeight: 700,
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    background: '#f9fafb',
    letterSpacing: '0.02em',
  };

  const TD: React.CSSProperties = {
    border: '1px solid #d1d5db',
    padding: '4px 8px',
  };

  return (
    <div id="challan-print-area" style={PAGE}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: '2.5px solid #c41e3a', paddingBottom: '10px', marginBottom: '12px' }}>
        {/* Left: company */}
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#c41e3a', letterSpacing: '-0.01em' }}>
            {settings.companyName}
          </div>
          <div style={{ color: '#6b7280', fontSize: '10px', lineHeight: 1.5, marginTop: '2px', maxWidth: '280px' }}>
            {settings.address}
          </div>
          <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '1px' }}>
            Ph: {settings.phone} &nbsp;|&nbsp; GST: {settings.gstin}
          </div>
        </div>

        {/* Right: challan meta */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: '#111827', marginBottom: '4px' }}>
            Delivery Challan
          </div>
          <table style={{ marginLeft: 'auto', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              <MetaRow label="Challan No." value={challanNumber} highlight />
              <MetaRow label="Date"        value={fmtDate(date)} />
              <MetaRow label="Job No."     value={jobNumber} />
              {reference && <MetaRow label="Reference" value={reference} highlight />}
              {totalWeight != null && (
                <MetaRow label="Total Weight" value={`${totalWeight.toFixed(3)} kg`} />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VENDOR + TRANSPORT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        {/* Vendor box */}
        <InfoBox title="To (Vendor)">
          <BoldLine>{vendor?.name ?? '—'}</BoldLine>
          {vendor?.contactPerson && <MutedLine>{vendor.contactPerson} · {vendor.mobile}</MutedLine>}
          {vendor?.gstNumber && <MutedLine>GST: {vendor.gstNumber}</MutedLine>}
        </InfoBox>

        {/* Transport box */}
        <InfoBox title="Transport / Dispatch">
          <BoldLine>{transport || '—'}</BoldLine>
          {vehicleNumber && <MutedLine>Vehicle: {vehicleNumber}</MutedLine>}
          {driver        && <MutedLine>Driver: {driver}</MutedLine>}
          <MutedLine>Process: <strong style={{ color: '#111' }}>{process}</strong></MutedLine>
        </InfoBox>
      </div>

      {/* ── ITEMS TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: 'center',  width: '28px'  }}>#</th>
            <th style={{ ...TH, textAlign: 'left'                    }}>Product (Sub-product)</th>
            <th style={{ ...TH, textAlign: 'left'                    }}>Category</th>
            {items.some((i) => i.variantName) &&
              <th style={{ ...TH, textAlign: 'left'                  }}>Variant</th>}
            <th style={{ ...TH, textAlign: 'right', width: '70px'   }}>Pieces</th>
            {totalWeight != null &&
              <th style={{ ...TH, textAlign: 'right', width: '80px' }}>Wt (kg)</th>}
            <th style={{ ...TH, textAlign: 'right', width: '72px'   }}>Rate (₹)</th>
            <th style={{ ...TH, textAlign: 'right', width: '82px'   }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <td style={{ ...TD, textAlign: 'center', color: '#9ca3af' }}>{i + 1}</td>
              <td style={{ ...TD, fontWeight: 600 }}>{item.productName}</td>
              <td style={{ ...TD, color: '#6b7280' }}>{item.categoryName}</td>
              {items.some((it) => it.variantName) &&
                <td style={{ ...TD, color: '#6b7280' }}>{item.variantName ?? '—'}</td>}
              <td style={{ ...TD, textAlign: 'right' }}>{item.quantity.toLocaleString('en-IN')}</td>
              {totalWeight != null &&
                <td style={{ ...TD, textAlign: 'right', color: '#6b7280' }}>
                  {item.weight != null ? item.weight.toFixed(3) : '—'}
                </td>}
              <td style={{ ...TD, textAlign: 'right', color: '#6b7280' }}>
                {fmt(item.rate)}
              </td>
              <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>
                {fmt(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f3f4f6' }}>
            <td colSpan={items.some((i) => i.variantName) ? 4 : 3}
                style={{ ...TD, fontWeight: 800, fontSize: '10px',
                         textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Grand Total
            </td>
            <td style={{ ...TD, textAlign: 'right', fontWeight: 800 }}>
              {totalPieces.toLocaleString('en-IN')} Pic
            </td>
            {totalWeight != null &&
              <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>
                {totalWeight.toFixed(3)} kg
              </td>}
            <td style={{ ...TD }} />
            <td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#c41e3a', fontSize: '12px' }}>
              {fmt(totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── REMARKS ── */}
      {remarks && (
        <div style={{ marginBottom: '8px', fontSize: '10px', color: '#6b7280' }}>
          <strong style={{ color: '#374151' }}>Remarks:</strong> {remarks}
        </div>
      )}

      {/* ── SIGNATURES ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto',
                    paddingTop: '32px' }}>
        <SignatureLine label="Authorised Signatory" name={settings.companyName} />
        <SignatureLine label="Receiver's Signature"  name={vendor?.name ?? ''} />
        <SignatureLine label="Driver / Transporter"  name={driver ?? transport} />
      </div>

    </div>
  );
}

// ── Small layout helpers (defined once, shared within this file) ──────────────

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ padding: '1px 6px 1px 0', color: '#6b7280', whiteSpace: 'nowrap', fontSize: '10px' }}>
        {label}
      </td>
      <td style={{ padding: '1px 0', fontWeight: highlight ? 700 : 600,
                   color: highlight ? '#c41e3a' : '#111827', whiteSpace: 'nowrap' }}>
        {value}
      </td>
    </tr>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 10px' }}>
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: '#9ca3af', marginBottom: '4px' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BoldLine({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '2px' }}>{children}</div>;
}

function MutedLine({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#6b7280', fontSize: '10px', lineHeight: 1.4 }}>{children}</div>;
}

function SignatureLine({ label, name }: { label: string; name: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '150px' }}>
      <div style={{ height: '32px' }} />   {/* blank signing space */}
      <div style={{ borderTop: '1px solid #374151', paddingTop: '5px' }}>
        <div style={{ fontWeight: 600, fontSize: '10px' }}>{label}</div>
        {name && <div style={{ color: '#6b7280', fontSize: '10px' }}>{name}</div>}
      </div>
    </div>
  );
}

// ── Helper: build ChallanPrintData from store objects ─────────────────────────
// Both pages call this so the mapping logic lives in one place.

export function buildChallanPrintData(
  dispatch: {
    challanNumber: string;
    date: string;
    transport: string;
    vehicleNumber?: string;
    driver?: string;
    remarks?: string;
    items: { jobWorkItemId?: string; variantId: string; quantity: number; weight?: number }[];
  },
  job: {
    jobNumber: string;
    process: string;
    reference?: string;
    items: { id: string; productId: string; variantId: string; rate?: number }[];
  } | undefined,
  vendor: Pick<Vendor, 'name' | 'contactPerson' | 'mobile' | 'gstNumber'> | null,
  products: Product[],
  categories: Category[],
  settings: Pick<Settings, 'companyName' | 'address' | 'phone' | 'gstin'>,
): ChallanPrintData {
  const lineItems: ChallanLineItem[] = dispatch.items.map((di) => {
    // Prefer jobWorkItemId match (unique); fall back to variantId for old records
    let jobItem = job?.items.find((ji) => di.jobWorkItemId && di.jobWorkItemId === ji.id);
    if (!jobItem) jobItem = job?.items.find((ji) => ji.variantId === di.variantId);

    const product  = jobItem
      ? products.find((p) => p.id === jobItem!.productId)
      : products.find((p) => p.variants.some((v) => v.id === di.variantId));

    const variant  = product?.variants.find((v) => v.id === di.variantId);
    const category = product ? categories.find((c) => c.id === product.categoryId) : undefined;
    const rate     = jobItem?.rate ?? 0;

    return {
      productName:  product?.name   ?? '—',
      categoryName: category?.name  ?? '—',
      variantName:  variant?.name,
      quantity:     di.quantity,
      weight:       di.weight ?? null,
      rate,
      amount:       di.quantity * rate,
    };
  });

  return {
    challanNumber: dispatch.challanNumber,
    date:          dispatch.date,
    jobNumber:     job?.jobNumber ?? '—',
    reference:     job?.reference,
    process:       job?.process ?? '—',
    vendor,
    transport:     dispatch.transport,
    vehicleNumber: dispatch.vehicleNumber,
    driver:        dispatch.driver,
    remarks:       dispatch.remarks,
    items:         lineItems,
    settings,
  };
}

/**
 * printChallan(data)
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens a dedicated popup window containing only the challan HTML, then
 * triggers window.print() on it. This is the only approach that works
 * reliably across Chrome/Edge/Firefox because it avoids the entire React DOM
 * tree and any CSS interference from the app shell.
 *
 * The popup is closed automatically after the print dialog dismisses.
 */
export function printChallan(data: ChallanPrintData): void {
  const { challanNumber, date, jobNumber, reference, process,
          vendor, transport, vehicleNumber, driver, remarks, items, settings } = data;

  const totalPieces = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const totalWeight = items.some((i) => i.weight != null)
    ? items.reduce((s, i) => s + (i.weight ?? 0), 0)
    : null;
  const hasVariants = items.some((i) => i.variantName);

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtN = (n: number) =>
    '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtD = (iso: string) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // ── Item rows ─────────────────────────────────────────────────────────────
  const itemRows = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="text-align:center;color:#9ca3af">${i + 1}</td>
      <td style="font-weight:600">${esc(item.productName)}</td>
      <td style="color:#6b7280">${esc(item.categoryName)}</td>
      ${hasVariants ? `<td style="color:#6b7280">${esc(item.variantName ?? '—')}</td>` : ''}
      <td style="text-align:right">${item.quantity.toLocaleString('en-IN')}</td>
      ${totalWeight != null ? `<td style="text-align:right;color:#6b7280">${item.weight != null ? (item.weight as number).toFixed(3) : '—'}</td>` : ''}
      <td style="text-align:right;color:#6b7280">${fmtN(item.rate)}</td>
      <td style="text-align:right;font-weight:700">${fmtN(item.amount)}</td>
    </tr>`).join('');



  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Challan ${esc(challanNumber)}</title>
  <style>
    @page { size: A5 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #111827;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #c41e3a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .company-name { font-size: 13pt; font-weight: 800; color: #c41e3a; }
    .company-sub  { font-size: 8pt;  color: #6b7280; line-height: 1.5; margin-top: 2px; }
    .doc-title    { font-size: 12pt; font-weight: 800; text-transform: uppercase;
                    letter-spacing: .06em; text-align: right; margin-bottom: 4px; }
    .meta-table   { margin-left: auto; border-collapse: collapse; font-size: 9pt; }
    .meta-table td { padding: 1px 0 1px 8px; white-space: nowrap; }
    .meta-label   { color: #6b7280; padding-right: 6px !important; padding-left: 0 !important; }
    .meta-val     { font-weight: 600; }
    .meta-hi      { font-weight: 700; color: #c41e3a; }
    .info-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
    .info-box     { border: 1px solid #e5e7eb; border-radius: 5px; padding: 7px 9px; font-size: 9pt; }
    .info-label   { font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
                    letter-spacing: .06em; color: #9ca3af; margin-bottom: 3px; }
    .info-bold    { font-weight: 700; margin-bottom: 2px; }
    .info-muted   { color: #6b7280; line-height: 1.4; }
    table.items   { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9pt; }
    table.items th {
      border: 1px solid #d1d5db; padding: 4px 6px;
      font-weight: 700; font-size: 8pt; text-transform: uppercase;
      background: #f9fafb; letter-spacing: .02em;
    }
    table.items td { border: 1px solid #d1d5db; padding: 3px 6px; }
    table.items tfoot td {
      background: #f3f4f6; font-weight: 800; font-size: 8.5pt;
    }
    .remarks { font-size: 8.5pt; color: #6b7280; margin-bottom: 6px; }
    .sigs     { display: flex; justify-content: space-between; margin-top: 28px; }
    .sig-box  { text-align: center; min-width: 140px; }
    .sig-line { height: 28px; }
    .sig-rule { border-top: 1px solid #374151; padding-top: 4px; }
    .sig-name { font-weight: 600; font-size: 8.5pt; }
    .sig-sub  { color: #6b7280; font-size: 8pt; }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="company-name">${esc(settings.companyName)}</div>
      <div class="company-sub">${esc(settings.address)}</div>
      <div class="company-sub">Ph: ${esc(settings.phone)} &nbsp;|&nbsp; GST: ${esc(settings.gstin)}</div>
    </div>
    <div>
      <div class="doc-title">Delivery Challan</div>
      <table class="meta-table">
        <tr><td class="meta-label">Challan No.</td><td class="meta-hi">${esc(challanNumber)}</td></tr>
        <tr><td class="meta-label">Date</td><td class="meta-val">${fmtD(date)}</td></tr>
        <tr><td class="meta-label">Job No.</td><td class="meta-val">${esc(jobNumber)}</td></tr>
        ${reference ? `<tr><td class="meta-label">Reference</td><td class="meta-hi">${esc(reference)}</td></tr>` : ''}
        ${totalWeight != null ? `<tr><td class="meta-label">Total Weight</td><td class="meta-val">${totalWeight.toFixed(3)} kg</td></tr>` : ''}
      </table>
    </div>
  </div>

  <!-- VENDOR + TRANSPORT -->
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">To (Vendor)</div>
      <div class="info-bold">${esc(vendor?.name ?? '—')}</div>
      ${vendor?.contactPerson ? `<div class="info-muted">${esc(vendor.contactPerson)} · ${esc(vendor.mobile ?? '')}</div>` : ''}
      ${vendor?.gstNumber ? `<div class="info-muted">GST: ${esc(vendor.gstNumber)}</div>` : ''}
    </div>
    <div class="info-box">
      <div class="info-label">Transport / Dispatch</div>
      <div class="info-bold">${esc(transport || '—')}</div>
      ${vehicleNumber ? `<div class="info-muted">Vehicle: ${esc(vehicleNumber)}</div>` : ''}
      ${driver        ? `<div class="info-muted">Driver: ${esc(driver)}</div>` : ''}
      <div class="info-muted">Process: <strong style="color:#111">${esc(process)}</strong></div>
    </div>
  </div>

  <!-- ITEMS TABLE -->
  <table class="items">
    <thead>
      <tr>
        <th style="text-align:center;width:24px">#</th>
        <th style="text-align:left">Product</th>
        <th style="text-align:left">Category</th>
        ${hasVariants ? '<th style="text-align:left">Variant</th>' : ''}
        <th style="text-align:right;width:64px">Pieces</th>
        ${totalWeight != null ? '<th style="text-align:right;width:72px">Wt (kg)</th>' : ''}
        <th style="text-align:right;width:68px">Rate (₹)</th>
        <th style="text-align:right;width:78px">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="${hasVariants ? 4 : 3}" style="text-transform:uppercase;letter-spacing:.04em">Grand Total</td>
        <td style="text-align:right">${totalPieces.toLocaleString('en-IN')} Pic</td>
        ${totalWeight != null ? `<td style="text-align:right">${totalWeight.toFixed(3)} kg</td>` : ''}
        <td></td>
        <td style="text-align:right;color:#c41e3a;font-size:10pt">${fmtN(totalAmount)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- REMARKS -->
  ${remarks ? `<div class="remarks"><strong style="color:#374151">Remarks:</strong> ${esc(remarks)}</div>` : ''}

  <!-- SIGNATURES -->
  <div class="sigs">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-rule">
        <div class="sig-name">Authorised Signatory</div>
        <div class="sig-sub">${esc(settings.companyName)}</div>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-rule">
        <div class="sig-name">Receiver's Signature</div>
        <div class="sig-sub">${esc(vendor?.name ?? '')}</div>
      </div>
    </div>
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-rule">
        <div class="sig-name">Driver / Transporter</div>
        <div class="sig-sub">${esc(driver ?? transport)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) {
    // Popup blocked — fall back to same-window print
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.write(html);
  win.document.close();
  // Wait for resources to load then print
  win.onload = () => {
    win.focus();
    win.print();
    // Close after print dialog closes (works in Chrome/Edge; Firefox keeps it open)
    win.onafterprint = () => win.close();
  };
}

// Keep CHALLAN_PRINT_CSS exported so callers don't get import errors,
// but it is no longer injected — printChallan() handles everything.
export const CHALLAN_PRINT_CSS = '';
