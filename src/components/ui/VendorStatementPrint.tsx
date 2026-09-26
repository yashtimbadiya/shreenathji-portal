/**
 * VendorStatementPrint
 * ────────────────────────────────────────────────────────────────────────────
 * Prints a vendor account statement in a popup window (same approach as
 * printChallan / printPaymentReceipt). Shows the job-level breakdown that makes
 * up the owed amount, all payments in scope, and the closing balance.
 */

import type { Settings, Vendor } from '../../types';
import type { VendorStatement } from '../../lib/vendorAccounting';
import { monthLabel } from '../../lib/vendorAccounting';

export interface VendorStatementPrintData {
  statement: VendorStatement;
  vendor: Pick<Vendor, 'name' | 'contactPerson' | 'mobile' | 'gstNumber'> | null;
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

export function printVendorStatement(data: VendorStatementPrintData): void {
  const { statement, vendor, settings } = data;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const jobRows = statement.jobs.map((j, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="text-align:center;color:#9ca3af">${i + 1}</td>
      <td>${fmtDate(j.issueDate)}</td>
      <td style="font-weight:600">${esc(j.jobNumber)}</td>
      <td>${esc(j.process)}</td>
      <td style="text-align:right">${j.receivedQty.toLocaleString('en-IN')}</td>
      <td style="text-align:right;color:#6b7280">${fmtMoney(j.rate)}</td>
      <td style="text-align:right;font-weight:700">${fmtMoney(j.amount)}</td>
    </tr>`).join('');

  const paymentRows = statement.paymentsInScope.length
    ? statement.paymentsInScope.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
        <td style="text-align:center;color:#9ca3af">${i + 1}</td>
        <td>${fmtDate(p.date)}</td>
        <td>${esc(p.receiptNumber ?? '—')}</td>
        <td>${esc(p.method ?? '—')}</td>
        <td>${esc(p.reference ?? '—')}</td>
        <td style="text-align:right;font-weight:700">${fmtMoney(p.paid)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:8px">No payments in this period</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Vendor Statement — ${esc(vendor?.name ?? '')}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #111827; background: #fff;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table.grid { max-width: 100%; table-layout: fixed; }
    table.grid td, table.grid th { overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2.5px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
    .company-name { font-size: 15pt; font-weight: 800; color: #2563eb; }
    .company-sub  { font-size: 8pt; color: #6b7280; line-height: 1.5; margin-top: 2px; }
    .doc-title { font-size: 13pt; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; text-align: right; }
    .doc-meta { font-size: 9pt; color: #6b7280; text-align: right; margin-top: 3px; }
    .party { border: 1px solid #e5e7eb; border-radius: 5px; padding: 8px 10px; margin-bottom: 12px; }
    .party-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #9ca3af; margin-bottom: 3px; }
    .party-name { font-weight: 700; font-size: 11pt; }
    .party-sub { color: #6b7280; font-size: 9pt; }
    .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
                     color: #374151; margin: 12px 0 5px; }
    table.grid { width: 100%; border-collapse: collapse; font-size: 9pt; }
    table.grid th { border: 1px solid #d1d5db; padding: 4px 6px; font-weight: 700; font-size: 8pt;
                    text-transform: uppercase; background: #f9fafb; letter-spacing: .02em; text-align: left; }
    table.grid td { border: 1px solid #d1d5db; padding: 3px 6px; }
    table.grid tfoot td { background: #f3f4f6; font-weight: 800; }
    .summary { margin-top: 14px; margin-left: auto; width: 280px; border-collapse: collapse; font-size: 10pt; }
    .summary td { padding: 5px 8px; border-bottom: 1px solid #eef1f4; }
    .summary .lbl { color: #6b7280; }
    .summary .val { text-align: right; font-weight: 600; }
    .summary .bal-lbl { font-weight: 800; }
    .summary .bal-due { text-align: right; font-weight: 800; color: #dc2626; font-size: 12pt; }
    .summary .bal-nil { text-align: right; font-weight: 800; color: #16a34a; font-size: 12pt; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${esc(settings.companyName)}</div>
      <div class="company-sub">${esc(settings.address)}</div>
      <div class="company-sub">Ph: ${esc(settings.phone)} &nbsp;|&nbsp; GST: ${esc(settings.gstin)}</div>
    </div>
    <div>
      <div class="doc-title">Vendor Statement</div>
      <div class="doc-meta">Period: ${esc(monthLabel(statement.period))}</div>
      <div class="doc-meta">Generated: ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
    </div>
  </div>

  <div class="party">
    <div class="party-label">Statement For</div>
    <div class="party-name">${esc(vendor?.name ?? '—')}</div>
    ${vendor?.contactPerson ? `<div class="party-sub">${esc(vendor.contactPerson)} · ${esc(vendor.mobile ?? '')}</div>` : ''}
    ${vendor?.gstNumber ? `<div class="party-sub">GST: ${esc(vendor.gstNumber)}</div>` : ''}
  </div>

  <div class="section-title">Work Done (payable on received quantity)</div>
  <table class="grid">
    <thead>
      <tr>
        <th style="width:24px;text-align:center">#</th>
        <th>Date</th>
        <th>Job No.</th>
        <th>Process</th>
        <th style="text-align:right">Received</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${jobRows || `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:8px">No payable work in this period</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="6" style="text-transform:uppercase;letter-spacing:.04em">Total Owed</td>
        <td style="text-align:right;color:#2563eb">${fmtMoney(statement.owed)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="section-title">Payments</div>
  <table class="grid">
    <thead>
      <tr>
        <th style="width:24px;text-align:center">#</th>
        <th>Date</th>
        <th>Receipt No.</th>
        <th>Method</th>
        <th>Reference</th>
        <th style="text-align:right">Paid</th>
      </tr>
    </thead>
    <tbody>${paymentRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-transform:uppercase;letter-spacing:.04em">Total Paid</td>
        <td style="text-align:right;color:#16a34a">${fmtMoney(statement.paidInScope)}</td>
      </tr>
    </tfoot>
  </table>

  <table class="summary">
    <tr><td class="lbl">Total Owed</td><td class="val">${fmtMoney(statement.owed)}</td></tr>
    <tr><td class="lbl">Total Paid</td><td class="val">${fmtMoney(statement.paidInScope)}</td></tr>
    <tr><td class="bal-lbl">Closing Balance</td><td class="${statement.balance > 0 ? 'bal-due' : 'bal-nil'}">${statement.balance > 0 ? fmtMoney(statement.balance) : 'Nil — Settled'}</td></tr>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=800');
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
