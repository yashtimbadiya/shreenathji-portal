/**
 * PaymentReceipt
 * ────────────────────────────────────────────────────────────────────────────
 * Prints a vendor payment receipt in a dedicated popup window (same approach as
 * printChallan) so it renders identically across browsers and is unaffected by
 * the app's CSS. The on-screen preview component shares the same layout.
 */

import type { Settings, Vendor, PaymentMethod } from '../../types';

export interface PaymentReceiptData {
  receiptNumber: string;
  date: string;                 // ISO yyyy-mm-dd
  period?: string;              // "YYYY-MM"
  vendor: Pick<Vendor, 'name' | 'contactPerson' | 'mobile' | 'gstNumber'> | null;
  /** Total value of work owed to the vendor (Σ received × rate) for the period/overall */
  owed: number;
  /** Amount paid before this receipt */
  previouslyPaid: number;
  /** Amount paid in THIS receipt */
  amountPaid: number;
  /** Balance remaining after this receipt */
  balance: number;
  method?: PaymentMethod;
  reference?: string;
  remarks?: string;
  settings: Pick<Settings, 'companyName' | 'address' | 'phone' | 'gstin'>;
}

function fmtMoney(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtPeriod(period?: string) {
  if (!period) return '';
  const [y, m] = period.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${months[idx]} ${y}` : period;
}

/** Amount → words (Indian numbering, whole rupees) for the receipt footer. */
export function amountInWords(num: number): string {
  const n = Math.round(num);
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const two = (x: number): string => {
    if (x < 20) return ones[x];
    return `${tens[Math.floor(x / 10)]}${x % 10 ? ' ' + ones[x % 10] : ''}`;
  };
  const three = (x: number): string => {
    const h = Math.floor(x / 100);
    const rest = x % 100;
    return `${h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : ''}${rest ? two(rest) : ''}`;
  };

  let words = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) words += `${two(crore)} Crore `;
  if (lakh) words += `${two(lakh)} Lakh `;
  if (thousand) words += `${two(thousand)} Thousand `;
  if (rest) words += three(rest);
  return `${words.trim()} Rupees Only`;
}

// ── On-screen preview (pure presentational) ─────────────────────────────────

export function PaymentReceiptPreview({ data }: { data: PaymentReceiptData }) {
  const { receiptNumber, date, period, vendor, owed, previouslyPaid,
          amountPaid, balance, method, reference, remarks, settings } = data;

  const PAGE: React.CSSProperties = {
    width: '620px',
    padding: '28px 32px',
    background: '#ffffff',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    fontSize: '12px',
    color: '#111827',
    boxSizing: 'border-box',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  };
  const TD: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #eef1f4' };
  const LABEL: React.CSSProperties = { color: '#6b7280' };

  return (
    <div style={PAGE}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    borderBottom: '2.5px solid #2563eb', paddingBottom: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563eb' }}>{settings.companyName}</div>
          <div style={{ color: '#6b7280', fontSize: '10px', lineHeight: 1.5, marginTop: '2px', maxWidth: '300px' }}>
            {settings.address}
          </div>
          <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '1px' }}>
            Ph: {settings.phone} &nbsp;|&nbsp; GST: {settings.gstin}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Payment Receipt
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{receiptNumber}</div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Date: {fmtDate(date)}</div>
          {period && <div style={{ fontSize: '11px', color: '#6b7280' }}>Period: {fmtPeriod(period)}</div>}
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px 12px', marginBottom: '14px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: '#9ca3af', marginBottom: '4px' }}>Paid To</div>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>{vendor?.name ?? '—'}</div>
        {vendor?.contactPerson && <div style={{ color: '#6b7280', fontSize: '11px' }}>{vendor.contactPerson} · {vendor.mobile}</div>}
        {vendor?.gstNumber && <div style={{ color: '#6b7280', fontSize: '11px' }}>GST: {vendor.gstNumber}</div>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
        <tbody>
          <tr><td style={{ ...TD, ...LABEL }}>Total Work Value (owed)</td><td style={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{fmtMoney(owed)}</td></tr>
          <tr><td style={{ ...TD, ...LABEL }}>Previously Paid</td><td style={{ ...TD, textAlign: 'right' }}>{fmtMoney(previouslyPaid)}</td></tr>
          <tr><td style={{ ...TD, ...LABEL, fontWeight: 700, color: '#111827' }}>Amount Paid Now</td><td style={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#2563eb', fontSize: '14px' }}>{fmtMoney(amountPaid)}</td></tr>
          <tr><td style={{ ...TD, ...LABEL, borderBottom: 'none' }}>Balance Remaining</td><td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a', borderBottom: 'none' }}>{balance > 0 ? fmtMoney(balance) : 'Nil — Settled'}</td></tr>
        </tbody>
      </table>

      <div style={{ fontSize: '11px', color: '#374151', marginBottom: '10px' }}>
        <strong>In words:</strong> {amountInWords(amountPaid)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', marginBottom: '14px' }}>
        <div><span style={LABEL}>Method: </span><strong>{method ?? '—'}</strong></div>
        <div><span style={LABEL}>Reference: </span><strong>{reference || '—'}</strong></div>
      </div>

      {remarks && <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '10px' }}><strong style={{ color: '#374151' }}>Remarks:</strong> {remarks}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
        <div style={{ textAlign: 'center', minWidth: '180px' }}>
          <div style={{ height: '30px' }} />
          <div style={{ borderTop: '1px solid #374151', paddingTop: '5px', fontSize: '10px', fontWeight: 600 }}>
            Receiver's Signature<div style={{ color: '#6b7280', fontWeight: 400 }}>{vendor?.name ?? ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '180px' }}>
          <div style={{ height: '30px' }} />
          <div style={{ borderTop: '1px solid #374151', paddingTop: '5px', fontSize: '10px', fontWeight: 600 }}>
            Authorised Signatory<div style={{ color: '#6b7280', fontWeight: 400 }}>{settings.companyName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Print in popup window ────────────────────────────────────────────────────

export function printPaymentReceipt(data: PaymentReceiptData): void {
  const { receiptNumber, date, period, vendor, owed, previouslyPaid,
          amountPaid, balance, method, reference, remarks, settings } = data;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Payment Receipt ${esc(receiptNumber)}</title>
  <style>
    /* A5 portrait. @page = zero margin so the driver adds nothing on top; the
       .page fills the whole sheet and supplies the margin via internal padding.
       This avoids the double-margin that clips the right edge / leaves a gap. */
    @page { size: 148mm 210mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #111827; background: #fff;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page {
      width: 148mm; min-height: 210mm; padding: 9mm; margin: 0 auto;
      display: flex; flex-direction: column; background: #fff; overflow: hidden;
    }
    .spacer { flex: 1 1 auto; }
    table.amt, .party, .header, .sigs { page-break-inside: avoid; }
    table { width: 100%; max-width: 100%; table-layout: fixed; }
    td, th { overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
    @media screen {
      body { background: #f3f4f6; padding: 16px; }
      .page { box-shadow: 0 1px 8px rgba(0,0,0,.15); }
    }
    @media print { html, body { width: auto; } .page { box-shadow: none; margin: 0; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2.5px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 14pt; font-weight: 800; color: #2563eb; }
    .company-sub  { font-size: 8pt; color: #6b7280; line-height: 1.5; margin-top: 2px; }
    .doc-title { font-size: 12pt; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; text-align: right; }
    .doc-no { font-size: 12pt; font-weight: 700; color: #2563eb; text-align: right; margin-top: 3px; }
    .doc-meta { font-size: 9pt; color: #6b7280; text-align: right; margin-top: 2px; }
    .party { border: 1px solid #e5e7eb; border-radius: 5px; padding: 8px 10px; margin-bottom: 12px; }
    .party-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin-bottom: 3px; }
    .party-name { font-weight: 700; font-size: 11pt; }
    .party-sub { color: #6b7280; font-size: 9pt; }
    table.amt { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
    table.amt td { padding: 5px 8px; border-bottom: 1px solid #eef1f4; }
    .lbl { color: #6b7280; }
    .val { text-align: right; font-weight: 600; }
    .now-lbl { font-weight: 700; color: #111827; }
    .now-val { text-align: right; font-weight: 800; color: #2563eb; font-size: 12pt; }
    .bal-due { text-align: right; font-weight: 700; color: #dc2626; }
    .bal-nil { text-align: right; font-weight: 700; color: #16a34a; }
    .words { font-size: 9.5pt; color: #374151; margin-bottom: 10px; }
    .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 9.5pt; margin-bottom: 12px; }
    .remarks { font-size: 9pt; color: #6b7280; margin-bottom: 10px; }
    .sigs { display: flex; justify-content: space-between; margin-top: 32px; }
    .sig-box { text-align: center; min-width: 170px; }
    .sig-line { height: 28px; }
    .sig-rule { border-top: 1px solid #374151; padding-top: 4px; font-size: 9pt; font-weight: 600; }
    .sig-sub { color: #6b7280; font-weight: 400; }
  </style>
</head>
<body>
 <div class="page">
  <div class="header">
    <div>
      <div class="company-name">${esc(settings.companyName)}</div>
      <div class="company-sub">${esc(settings.address)}</div>
      <div class="company-sub">Ph: ${esc(settings.phone)} &nbsp;|&nbsp; GST: ${esc(settings.gstin)}</div>
    </div>
    <div>
      <div class="doc-title">Payment Receipt</div>
      <div class="doc-no">${esc(receiptNumber)}</div>
      <div class="doc-meta">Date: ${fmtDate(date)}</div>
      ${period ? `<div class="doc-meta">Period: ${esc(fmtPeriod(period))}</div>` : ''}
    </div>
  </div>

  <div class="party">
    <div class="party-label">Paid To</div>
    <div class="party-name">${esc(vendor?.name ?? '—')}</div>
    ${vendor?.contactPerson ? `<div class="party-sub">${esc(vendor.contactPerson)} · ${esc(vendor.mobile ?? '')}</div>` : ''}
    ${vendor?.gstNumber ? `<div class="party-sub">GST: ${esc(vendor.gstNumber)}</div>` : ''}
  </div>

  <table class="amt">
    <tr><td class="lbl">Total Work Value (owed)</td><td class="val">${fmtMoney(owed)}</td></tr>
    <tr><td class="lbl">Previously Paid</td><td class="val">${fmtMoney(previouslyPaid)}</td></tr>
    <tr><td class="now-lbl">Amount Paid Now</td><td class="now-val">${fmtMoney(amountPaid)}</td></tr>
    <tr><td class="lbl">Balance Remaining</td><td class="${balance > 0 ? 'bal-due' : 'bal-nil'}">${balance > 0 ? fmtMoney(balance) : 'Nil — Settled'}</td></tr>
  </table>

  <div class="words"><strong>In words:</strong> ${esc(amountInWords(amountPaid))}</div>

  <div class="kv">
    <div><span class="lbl">Method: </span><strong>${esc(method ?? '—')}</strong></div>
    <div><span class="lbl">Reference: </span><strong>${esc(reference || '—')}</strong></div>
  </div>

  ${remarks ? `<div class="remarks"><strong style="color:#374151">Remarks:</strong> ${esc(remarks)}</div>` : ''}

  <div class="spacer"></div>

  <div class="sigs">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-rule">Receiver's Signature<div class="sig-sub">${esc(vendor?.name ?? '')}</div></div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-rule">Authorised Signatory<div class="sig-sub">${esc(settings.companyName)}</div></div></div>
  </div>
 </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=760,height=760');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  win.document.write(html);
  win.document.close();
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  };
  win.onload = doPrint;
  setTimeout(doPrint, 400);
}
