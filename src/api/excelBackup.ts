/**
 * excelBackup.ts
 *
 * Export: pulls all data from IndexedDB → writes a multi-sheet .xlsx workbook.
 * Import: reads a .xlsx workbook → validates sheet names → bulk-upserts into IndexedDB.
 *
 * Sheet layout:
 *   JobWorks    — one row per job work (flattened, items are serialised as JSON in one cell)
 *   JobItems    — every job-work line item (jobWorkId + item fields) for easy reading/editing
 *   Vendors     — vendor master
 *   Categories  — category master
 *   Products    — product master (variants serialised as JSON)
 *   References  — reference records
 *   Dispatches  — dispatch (challan) records
 *   Receipts    — receipt records
 *   Payments    — payment records
 *   SharedVariants — shared variant library
 */

import * as XLSX from 'xlsx';
import { portalDb } from './supabaseClient';
import type {
  JobWork, JobWorkItem, Vendor, Category, Product,
  DispatchRecord, ReceiptRecord, Payment, ReferenceRecord, SharedVariant,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convert an array of objects to an XLSX worksheet */
function toSheet<T extends object>(rows: T[]): XLSX.WorkSheet {
  if (rows.length === 0) return XLSX.utils.aoa_to_sheet([]);
  return XLSX.utils.json_to_sheet(rows);
}

/** Read a worksheet back to an array of plain objects */
function fromSheet<T>(ws: XLSX.WorkSheet | undefined): T[] {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<T>(ws, { defval: '' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

export async function exportToExcel(): Promise<void> {
  const [
    jobWorks, vendors, categories, products,
    dispatches, receipts, payments, references, sharedVariants,
  ] = await Promise.all([
    portalDb.jobWorks.toArray(),
    portalDb.vendors.toArray(),
    portalDb.categories.toArray(),
    portalDb.products.toArray(),
    portalDb.dispatches.toArray(),
    portalDb.receipts.toArray(),
    portalDb.payments.toArray(),
    portalDb.references.toArray(),
    portalDb.sharedVariants.toArray(),
  ]);

  const wb = XLSX.utils.book_new();

  // ── JobWorks sheet ──────────────────────────────────────────────────────
  const jobWorkRows = jobWorks.map((j) => ({
    id:                 j.id,
    jobNumber:          j.jobNumber,
    vendorId:           j.vendorId,
    process:            j.process,
    issueDate:          j.issueDate,
    expectedReturnDate: j.expectedReturnDate,
    priority:           j.priority,
    reference:          j.reference ?? '',
    remarks:            j.remarks ?? '',
    status:             j.status,
    createdBy:          j.createdBy,
    createdAt:          j.createdAt,
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(jobWorkRows), 'JobWorks');

  // ── JobItems sheet (one row per line item, easier to read) ─────────────
  const jobItemRows: object[] = [];
  jobWorks.forEach((j) => {
    j.items.forEach((item: JobWorkItem) => {
      jobItemRows.push({
        jobWorkId:          j.id,
        jobNumber:          j.jobNumber,
        itemId:             item.id,
        productId:          item.productId,
        variantId:          item.variantId,
        sentQuantity:       item.sentQuantity,
        receivedQuantity:   item.receivedQuantity,
        rejectedQuantity:   item.rejectedQuantity,
        lossQuantity:       item.lossQuantity,
        rate:               item.rate ?? '',
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, toSheet(jobItemRows), 'JobItems');

  // ── Vendors ─────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, toSheet(vendors), 'Vendors');

  // ── Categories ──────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, toSheet(categories), 'Categories');

  // ── Products (variants as JSON so the structure is preserved) ───────────
  const productRows = products.map((p) => ({
    id:         p.id,
    categoryId: p.categoryId,
    name:       p.name,
    code:       p.code,
    unit:       p.unit,
    rate:       p.rate ?? '',
    status:     p.status,
    variants:   JSON.stringify(p.variants),
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(productRows), 'Products');

  // ── References ──────────────────────────────────────────────────────────
  const refRows = references.map((r) => ({
    id:              r.id,
    referenceNumber: r.referenceNumber,
    categoryId:      r.categoryId,
    productId:       r.productId,
    variantId:       r.variantId ?? '',
    pieces:          r.pieces,
    remarks:         r.remarks ?? '',
    createdDate:     r.createdDate,
    items:           JSON.stringify(r.items ?? []),
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(refRows), 'References');

  // ── Dispatches ──────────────────────────────────────────────────────────
  const dispatchRows = dispatches.map((d) => ({
    id:            d.id,
    jobWorkId:     d.jobWorkId,
    challanNumber: d.challanNumber,
    date:          d.date,
    vehicleNumber: d.vehicleNumber,
    driver:        d.driver,
    transport:     d.transport,
    remarks:       d.remarks ?? '',
    createdBy:     d.createdBy,
    items:         JSON.stringify(d.items),
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(dispatchRows), 'Dispatches');

  // ── Receipts ─────────────────────────────────────────────────────────────
  const receiptRows = receipts.map((r) => ({
    id:                   r.id,
    jobWorkId:            r.jobWorkId,
    date:                 r.date,
    receivedBy:           r.receivedBy,
    vendorChallanNumber:  r.vendorChallanNumber ?? '',
    remarks:              r.remarks ?? '',
    createdBy:            r.createdBy,
    items:                JSON.stringify(r.items),
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(receiptRows), 'Receipts');

  // ── Payments ─────────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, toSheet(payments), 'Payments');

  // ── SharedVariants ────────────────────────────────────────────────────────
  const svRows = sharedVariants.map((sv) => ({
    id:          sv.id,
    name:        sv.name,
    sku:         sv.sku,
    attributes:  JSON.stringify(sv.attributes),
    status:      sv.status,
    remarks:     sv.remarks ?? '',
    createdDate: sv.createdDate,
  }));
  XLSX.utils.book_append_sheet(wb, toSheet(svRows), 'SharedVariants');

  // ── Meta sheet (first sheet for context) ─────────────────────────────────
  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Shreenathji Enterprise — Full Backup'],
    ['Exported At', new Date().toLocaleString('en-IN')],
    [''],
    ['Sheet', 'Records'],
    ['JobWorks',       jobWorks.length],
    ['JobItems',       jobItemRows.length],
    ['Vendors',        vendors.length],
    ['Categories',     categories.length],
    ['Products',       products.length],
    ['References',     references.length],
    ['Dispatches',     dispatches.length],
    ['Receipts',       receipts.length],
    ['Payments',       payments.length],
    ['SharedVariants', sharedVariants.length],
    [''],
    ['Note: Sheets with JSON columns (Products, References, Dispatches, Receipts, SharedVariants)'],
    ['contain serialised arrays. Import using this app to restore correctly.'],
  ]);
  // Style the title row (bold via cell metadata)
  if (!metaSheet['A1'].s) metaSheet['A1'].s = {};
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Info');
  // Move Info to first position
  const sheetOrder = ['Info', ...wb.SheetNames.filter((n) => n !== 'Info')];
  wb.SheetNames = sheetOrder;

  // Write and download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob  = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const date  = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `snj-backup-${date}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Import
// ─────────────────────────────────────────────────────────────────────────────

interface ImportResult {
  ok: boolean;
  message: string;
  counts?: Record<string, number>;
}

export async function importFromExcel(file: File): Promise<ImportResult> {
  try {
    const buffer = await file.arrayBuffer();
    const wb     = XLSX.read(buffer, { type: 'array', cellDates: true });

    const sheetNames = wb.SheetNames;

    // Validate — must have at least JobWorks sheet
    if (!sheetNames.includes('JobWorks')) {
      return { ok: false, message: 'Invalid backup file — "JobWorks" sheet not found.' };
    }

    // ── Parse each sheet ──────────────────────────────────────────────────

    // JobWorks — rebuild items array from JobItems sheet
    type RawJobWork = Omit<JobWork, 'items'>;
    const rawJobWorks = fromSheet<RawJobWork>(wb.Sheets['JobWorks']);

    type RawJobItem = JobWorkItem & { jobWorkId: string };
    const rawJobItems = fromSheet<RawJobItem>(wb.Sheets['JobItems']);

    // Group items back by jobWorkId
    const itemsByJobId = new Map<string, JobWorkItem[]>();
    rawJobItems.forEach((row) => {
      const list = itemsByJobId.get(row.jobWorkId) ?? [];
      list.push({
        id:               row.id,
        productId:        row.productId,
        variantId:        row.variantId,
        sentQuantity:     Number(row.sentQuantity) || 0,
        receivedQuantity: Number(row.receivedQuantity) || 0,
        rejectedQuantity: Number(row.rejectedQuantity) || 0,
        lossQuantity:     Number(row.lossQuantity) || 0,
        rate:             (row.rate as unknown) !== '' ? Number(row.rate) : undefined,
      });
      itemsByJobId.set(row.jobWorkId, list);
    });

    const jobWorks: JobWork[] = rawJobWorks.map((j) => ({
      ...j,
      items: itemsByJobId.get(j.id) ?? [],
    }));

    const vendors    = fromSheet<Vendor>(wb.Sheets['Vendors']);
    const categories = fromSheet<Category>(wb.Sheets['Categories']);

    // Products — parse variants JSON
    type RawProduct = Omit<Product, 'variants'> & { variants: string };
    const rawProducts = fromSheet<RawProduct>(wb.Sheets['Products']);
    const products: Product[] = rawProducts.map((p) => ({
      ...p,
      rate: (p.rate as unknown) !== '' ? Number(p.rate) : undefined,
      variants: (() => {
        try { return JSON.parse(p.variants as string); }
        catch { return []; }
      })(),
    }));

    // References — parse items JSON
    type RawRef = Omit<ReferenceRecord, 'items'> & { items: string };
    const rawRefs = fromSheet<RawRef>(wb.Sheets['References']);
    const references: ReferenceRecord[] = rawRefs.map((r) => ({
      ...r,
      variantId: r.variantId || undefined,
      remarks:   r.remarks || undefined,
      items: (() => {
        try { return JSON.parse(r.items as string); }
        catch { return []; }
      })(),
    }));

    // Dispatches — parse items JSON
    type RawDispatch = Omit<DispatchRecord, 'items'> & { items: string };
    const rawDispatches = fromSheet<RawDispatch>(wb.Sheets['Dispatches']);
    const dispatches: DispatchRecord[] = rawDispatches.map((d) => ({
      ...d,
      remarks: d.remarks || undefined,
      items: (() => {
        try { return JSON.parse(d.items as string); }
        catch { return []; }
      })(),
    }));

    // Receipts — parse items JSON
    type RawReceipt = Omit<ReceiptRecord, 'items'> & { items: string };
    const rawReceipts = fromSheet<RawReceipt>(wb.Sheets['Receipts']);
    const receipts: ReceiptRecord[] = rawReceipts.map((r) => ({
      ...r,
      vendorChallanNumber: r.vendorChallanNumber || undefined,
      remarks: r.remarks || undefined,
      items: (() => {
        try { return JSON.parse(r.items as string); }
        catch { return []; }
      })(),
    }));

    const payments = fromSheet<Payment>(wb.Sheets['Payments']);

    // ── SharedVariants ────────────────────────────────────────────────────
    type RawSV = Omit<SharedVariant, 'attributes'> & { attributes: string };
    const rawSVs = fromSheet<RawSV>(wb.Sheets['SharedVariants']);
    const sharedVariants: SharedVariant[] = rawSVs.map((sv) => ({
      ...sv,
      remarks: sv.remarks || undefined,
      attributes: (() => {
        try { return JSON.parse(sv.attributes as string); }
        catch { return []; }
      })(),
    }));

    // ── Bulk-upsert into IndexedDB ────────────────────────────────────────
    await Promise.all([
      jobWorks.length       ? portalDb.jobWorks.bulkPut(jobWorks)           : Promise.resolve(),
      vendors.length        ? portalDb.vendors.bulkPut(vendors)             : Promise.resolve(),
      categories.length     ? portalDb.categories.bulkPut(categories)       : Promise.resolve(),
      products.length       ? portalDb.products.bulkPut(products)           : Promise.resolve(),
      references.length     ? portalDb.references.bulkPut(references)       : Promise.resolve(),
      dispatches.length     ? portalDb.dispatches.bulkPut(dispatches)       : Promise.resolve(),
      receipts.length       ? portalDb.receipts.bulkPut(receipts)           : Promise.resolve(),
      payments.length       ? portalDb.payments.bulkPut(payments)           : Promise.resolve(),
      sharedVariants.length ? portalDb.sharedVariants.bulkPut(sharedVariants) : Promise.resolve(),
    ]);

    const counts = {
      'Job Works':       jobWorks.length,
      'Vendors':         vendors.length,
      'Categories':      categories.length,
      'Products':        products.length,
      'References':      references.length,
      'Dispatches':      dispatches.length,
      'Receipts':        receipts.length,
      'Payments':        payments.length,
      'Shared Variants': sharedVariants.length,
    };

    return {
      ok: true,
      message: `Restored successfully. Reloading…`,
      counts,
    };
  } catch (err) {
    return { ok: false, message: `Import failed: ${String(err)}` };
  }
}
