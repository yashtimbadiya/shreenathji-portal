/**
 * autoBackup.ts
 *
 * Automatic backup to a user-chosen folder using the
 * File System Access API (Chrome/Edge 86+).
 *
 * Safety model — multiple layers so no data is ever lost:
 *
 *  Layer 1 – DAILY       On first page-load each day, backup runs automatically.
 *  Layer 2 – ON CLOSE    visibilitychange + pagehide events write backup when the
 *                         tab is hidden/closed. These fire synchronously (unlike
 *                         beforeunload) with enough budget to complete an async
 *                         File System Access write in Chrome/Edge.
 *  Layer 3 – MUTATIONS   After any data-changing operation the app calls
 *                         scheduleBackup(), which debounces a write 10 s later.
 *                         This means a backup runs within 10 s of every change.
 *  Layer 4 – MANUAL      "Backup Now" button in Settings always writes immediately.
 *  Layer 5 – ATOMIC WRITE
 *                         We build the workbook first, then open the writable —
 *                         so a build error never truncates the existing backup.
 *
 * For browsers without File System Access API (Firefox, Safari) layers 1-3 are
 * skipped silently. Use the manual Export button instead.
 */

import * as XLSX from 'xlsx';
import { portalDb } from './supabaseClient';
import type { JobWorkItem } from '../types';

// ─── Feature detect ───────────────────────────────────────────────────────────
export const supportsFileSystemAccess =
  typeof window !== 'undefined' &&
  'showDirectoryPicker' in window;

// ─── Handle persistence ───────────────────────────────────────────────────────
// We use a raw IDB database (not Dexie) because FileSystemDirectoryHandle objects
// are structured-cloneable but Dexie's type system doesn't know that.
const HANDLE_DB_NAME = 'snj-backup-handle-db';
const HANDLE_STORE   = 'handles';
const HANDLE_KEY     = 'backupFolder';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(HANDLE_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(HANDLE_STORE, 'readwrite');
    const req = tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(HANDLE_STORE, 'readonly');
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(HANDLE_STORE, 'readwrite');
      const req = tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* ignore */ }
}

// ─── Permission helper ────────────────────────────────────────────────────────
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  try {
    const h = handle as unknown as {
      queryPermission(opts: { mode: string }): Promise<PermissionState>;
      requestPermission(opts: { mode: string }): Promise<PermissionState>;
    };
    const status = await h.queryPermission({ mode });
    if (status === 'granted') return true;
    const requested = await h.requestPermission({ mode });
    return requested === 'granted';
  } catch {
    return false;
  }
}

// ─── Workbook builder ─────────────────────────────────────────────────────────
// Returns a plain ArrayBuffer (compatible with FileSystemWritableFileStream
// and new Blob([...])).  Build FIRST — write second (atomic-safe).
async function buildWorkbook(): Promise<ArrayBuffer> {
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

  // JobWorks
  const jobWorkRows = jobWorks.map((j) => ({
    id: j.id, jobNumber: j.jobNumber, vendorId: j.vendorId,
    process: j.process, issueDate: j.issueDate,
    expectedReturnDate: j.expectedReturnDate,
    priority: j.priority, reference: j.reference ?? '',
    remarks: j.remarks ?? '', status: j.status,
    createdBy: j.createdBy, createdAt: j.createdAt,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jobWorkRows.length ? jobWorkRows : [{}]), 'JobWorks');

  // JobItems (line-level)
  const jobItemRows: object[] = [];
  jobWorks.forEach((j) => j.items.forEach((item: JobWorkItem) => {
    jobItemRows.push({
      jobWorkId: j.id, jobNumber: j.jobNumber, itemId: item.id,
      productId: item.productId, variantId: item.variantId,
      sentQuantity: item.sentQuantity, receivedQuantity: item.receivedQuantity,
      rejectedQuantity: item.rejectedQuantity, lossQuantity: item.lossQuantity,
      rate: item.rate ?? '',
    });
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jobItemRows.length ? jobItemRows : [{}]), 'JobItems');

  // Vendors
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendors.length ? vendors : [{}]), 'Vendors');

  // Categories
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories.length ? categories : [{}]), 'Categories');

  // Products (variants as JSON string)
  const productRows = products.map((p) => ({
    id: p.id, categoryId: p.categoryId, name: p.name, code: p.code,
    unit: p.unit, rate: p.rate ?? '', status: p.status,
    variants: JSON.stringify(p.variants),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows.length ? productRows : [{}]), 'Products');

  // References
  const refRows = references.map((r) => ({
    id: r.id, referenceNumber: r.referenceNumber,
    categoryId: r.categoryId, productId: r.productId,
    variantId: r.variantId ?? '', pieces: r.pieces,
    weight: r.weight ?? '', remarks: r.remarks ?? '',
    createdDate: r.createdDate, items: JSON.stringify(r.items ?? []),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(refRows.length ? refRows : [{}]), 'References');

  // Dispatches
  const dispatchRows = dispatches.map((d) => ({
    id: d.id, jobWorkId: d.jobWorkId, challanNumber: d.challanNumber,
    date: d.date, vehicleNumber: d.vehicleNumber, driver: d.driver,
    transport: d.transport, remarks: d.remarks ?? '',
    createdBy: d.createdBy, items: JSON.stringify(d.items),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dispatchRows.length ? dispatchRows : [{}]), 'Dispatches');

  // Receipts
  const receiptRows = receipts.map((r) => ({
    id: r.id, jobWorkId: r.jobWorkId, date: r.date, receivedBy: r.receivedBy,
    vendorChallanNumber: r.vendorChallanNumber ?? '',
    remarks: r.remarks ?? '', createdBy: r.createdBy,
    items: JSON.stringify(r.items),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows.length ? receiptRows : [{}]), 'Receipts');

  // Payments
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments.length ? payments : [{}]), 'Payments');

  // SharedVariants
  const svRows = sharedVariants.map((sv) => ({
    id: sv.id, name: sv.name, sku: sv.sku,
    attributes: JSON.stringify(sv.attributes),
    status: sv.status, remarks: sv.remarks ?? '', createdDate: sv.createdDate,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(svRows.length ? svRows : [{}]), 'SharedVariants');

  // Info / meta sheet (put first)
  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Shreenathji Enterprise — Auto Backup'],
    ['Exported At', new Date().toLocaleString('en-IN')],
    [''],
    ['Sheet',          'Records'],
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
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Info');
  wb.SheetNames = ['Info', ...wb.SheetNames.filter((n) => n !== 'Info')];

  return (XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array).buffer as ArrayBuffer;
}

// ─── Fixed filename (always overwrite the same file) ─────────────────────────
// Folder backups always write to `snj-backup.xlsx` so the folder never fills up.
// Manual downloads use a dated name for history tracking.
export const BACKUP_FILENAME = 'snj-backup.xlsx';

function buildDownloadFilename(): string {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5).replace(':', '-');
  return `snj-backup-${date}_${hhmm}.xlsx`;
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────
const LAST_BACKUP_KEY     = 'snj:last-auto-backup';
const LAST_BACKUP_DAY_KEY = 'snj:last-auto-backup-day';

export function getLastBackupTime(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function setLastBackupTime(): void {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_BACKUP_KEY, now);
  localStorage.setItem(LAST_BACKUP_DAY_KEY, now.slice(0, 10));
}

/** True only if a backup has already run today. Intra-day mutations trigger
 *  their own debounced backup regardless of this flag. */
export function hasBackedUpToday(): boolean {
  const day = localStorage.getItem(LAST_BACKUP_DAY_KEY);
  return day === new Date().toISOString().slice(0, 10);
}

// ─── Core write — ATOMIC ─────────────────────────────────────────────────────
/**
 * Builds the full workbook BEFORE touching the file.  Only if the build
 * succeeds do we open the writable and commit — so a crash during serialisation
 * never corrupts or truncates the existing backup.
 *
 * Returns true on success.
 */
export async function writeBackupToFolder(): Promise<boolean> {
  if (!supportsFileSystemAccess) return false;

  const handle = await loadDirectoryHandle();
  if (!handle) return false;

  const hasPermission = await verifyPermission(handle);
  if (!hasPermission) return false;

  let data: ArrayBuffer;
  try {
    // Build FIRST — any error here leaves the existing file untouched
    data = await buildWorkbook();
  } catch (err) {
    console.warn('[autoBackup] Workbook build failed — existing backup preserved:', err);
    return false;
  }

  try {
    // Now write atomically
    const fileHandle = await handle.getFileHandle(BACKUP_FILENAME, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    setLastBackupTime();
    return true;
  } catch (err) {
    console.warn('[autoBackup] File write failed:', err);
    return false;
  }
}

// ─── Fallback: browser download ───────────────────────────────────────────────
export async function triggerDownloadBackup(): Promise<void> {
  const data     = await buildWorkbook();
  const filename = buildDownloadFilename();
  const blob     = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setLastBackupTime();
}

// ─── Debounced mutation backup ────────────────────────────────────────────────
// Called after every data mutation (create/update/delete).  Waits 10 s for
// activity to settle, then writes to the folder if one is configured.
// This is layer 3 — ensures a backup exists within 10 s of any change.

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackup(): void {
  if (!supportsFileSystemAccess) return;
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null;
    const handle = await loadDirectoryHandle();
    if (!handle) return;
    await writeBackupToFolder();
  }, 10_000); // 10 seconds after last change
}

/** Cancel any pending debounced backup (e.g. on logout). */
export function cancelScheduledBackup(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

// ─── Main entry point (daily / on-load) ──────────────────────────────────────
/**
 * Called by useAutoBackup on mount.
 * - If folder is configured → write to folder
 * - No folder → skip (user must configure or use manual export)
 */
export async function runAutoBackup(): Promise<'folder' | 'skipped'> {
  if (!supportsFileSystemAccess) return 'skipped';

  const handle = await loadDirectoryHandle();
  if (!handle) return 'skipped';

  const ok = await writeBackupToFolder();
  return ok ? 'folder' : 'skipped';
}
