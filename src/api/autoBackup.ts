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
 *                         tab is hidden/closed.
 *  Layer 3 – MUTATIONS   After any data-changing operation the app calls
 *                         scheduleBackup(), which debounces a write 10 s later.
 *  Layer 4 – MANUAL      "Backup Now" button in Settings always writes immediately.
 *  Layer 5 – ATOMIC WRITE
 *                         Workbook is built first; only on success do we open the
 *                         writable — so a build error never truncates the existing backup.
 *
 * File naming — each backup writes a NEW dated file:
 *   snj-backup-YYYY-MM-DD_HH-MM.xlsx
 * so old backups are never overwritten and you get a full history.
 * We keep the last MAX_BACKUPS_TO_KEEP files and delete older ones automatically.
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

// ─── How many dated backups to keep in the chosen folder ─────────────────────
const MAX_BACKUPS_TO_KEEP = 30;

// ─── Handle persistence ───────────────────────────────────────────────────────
// We use a raw IDB database (not Dexie) because FileSystemDirectoryHandle objects
// are structured-cloneable but Dexie's type system doesn't know that.
const HANDLE_DB_NAME = 'snj-backup-handle-db';
const HANDLE_STORE   = 'handles';
const HANDLE_KEY     = 'backupFolder';
const HISTORY_STORE  = 'history';

export interface BackupHistoryEntry {
  filename: string;   // e.g. snj-backup-2026-09-04_14-30.xlsx
  timestamp: string;  // ISO string
  recordCount: number;
  sizeBytes: number;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'filename' });
      }
    };
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

// ─── Backup history ───────────────────────────────────────────────────────────
async function appendHistory(entry: BackupHistoryEntry): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(HISTORY_STORE, 'readwrite');
      const req = tx.objectStore(HISTORY_STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  } catch { /* non-critical */ }
}

export async function loadBackupHistory(): Promise<BackupHistoryEntry[]> {
  try {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(HISTORY_STORE, 'readonly');
      const req = tx.objectStore(HISTORY_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result as BackupHistoryEntry[]) ?? [];
        // Sort newest first
        all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function clearBackupHistory(): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(HISTORY_STORE, 'readwrite');
      const req = tx.objectStore(HISTORY_STORE).clear();
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
    // requestPermission requires a user gesture — only works in handleBackupNow,
    // not in background timers. We return false here so background tasks skip
    // gracefully and the user is prompted next time they click "Backup Now".
    const requested = await h.requestPermission({ mode });
    return requested === 'granted';
  } catch {
    return false;
  }
}

// ─── Filename helpers ─────────────────────────────────────────────────────────
export const BACKUP_FILE_PREFIX = 'snj-backup-';

export function buildBackupFilename(date?: Date): string {
  const now  = date ?? new Date();
  const d    = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5).replace(':', '-');
  return `${BACKUP_FILE_PREFIX}${d}_${hhmm}.xlsx`;
}

// ─── Workbook builder ─────────────────────────────────────────────────────────
interface WorkbookResult {
  data: ArrayBuffer;
  totalRecords: number;
}

export async function buildWorkbook(): Promise<WorkbookResult> {
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

  // Info / meta sheet
  const totalRecords =
    jobWorks.length + vendors.length + categories.length + products.length +
    references.length + dispatches.length + receipts.length + payments.length + sharedVariants.length;

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
    [''],
    ['Total Records',  totalRecords],
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Info');
  wb.SheetNames = ['Info', ...wb.SheetNames.filter((n) => n !== 'Info')];

  const data = (XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array).buffer as ArrayBuffer;
  return { data, totalRecords };
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

/** True only if a backup has already run today. */
export function hasBackedUpToday(): boolean {
  const day = localStorage.getItem(LAST_BACKUP_DAY_KEY);
  return day === new Date().toISOString().slice(0, 10);
}

// ─── Prune old backup files ───────────────────────────────────────────────────
/**
 * Lists all snj-backup-*.xlsx files in the folder, sorts by name (which is
 * date-ordered), and deletes the oldest ones beyond MAX_BACKUPS_TO_KEEP.
 */
async function pruneOldBackups(dirHandle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const backupFiles: string[] = [];
    for await (const [name] of (dirHandle as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if (name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith('.xlsx')) {
        backupFiles.push(name);
      }
    }
    backupFiles.sort(); // lexicographic = chronological (YYYY-MM-DD_HH-MM)
    const toDelete = backupFiles.slice(0, Math.max(0, backupFiles.length - MAX_BACKUPS_TO_KEEP));
    for (const name of toDelete) {
      try {
        await dirHandle.removeEntry(name);
      } catch { /* ignore individual failures */ }
    }
  } catch { /* non-critical */ }
}

// ─── Core write — ATOMIC, dated filename ─────────────────────────────────────
/**
 * Builds the full workbook BEFORE touching the file.  Only if the build
 * succeeds do we open the writable and commit.
 *
 * Returns the filename on success, null on failure.
 */
export async function writeBackupToFolder(): Promise<string | null> {
  if (!supportsFileSystemAccess) return null;

  const handle = await loadDirectoryHandle();
  if (!handle) return null;

  const hasPermission = await verifyPermission(handle);
  if (!hasPermission) return null;

  let result: WorkbookResult;
  try {
    result = await buildWorkbook();
  } catch (err) {
    console.warn('[autoBackup] Workbook build failed — existing backup preserved:', err);
    return null;
  }

  const filename = buildBackupFilename();

  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(result.data);
    await writable.close();

    setLastBackupTime();

    // Record in history
    await appendHistory({
      filename,
      timestamp: new Date().toISOString(),
      recordCount: result.totalRecords,
      sizeBytes: result.data.byteLength,
    });

    // Prune excess files (fire-and-forget)
    void pruneOldBackups(handle);

    return filename;
  } catch (err) {
    console.warn('[autoBackup] File write failed:', err);
    return null;
  }
}

// ─── Fallback: browser download ───────────────────────────────────────────────
export async function triggerDownloadBackup(): Promise<void> {
  const { data, totalRecords } = await buildWorkbook();
  const filename = buildBackupFilename();
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
  await appendHistory({
    filename,
    timestamp: new Date().toISOString(),
    recordCount: totalRecords,
    sizeBytes: data.byteLength,
  });
}

// ─── Debounced mutation backup ────────────────────────────────────────────────
// Called after every data mutation. Waits 10 s for activity to settle,
// then writes to the folder if one is configured.
// Background writes cannot re-request permission — they skip silently if
// permission has lapsed. The user is prompted next time they click "Backup Now".

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackup(): void {
  if (!supportsFileSystemAccess) return;
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null;
    const handle = await loadDirectoryHandle();
    if (!handle) return;
    // Only run if we already have permission (no user gesture available here)
    const h = handle as unknown as {
      queryPermission(opts: { mode: string }): Promise<PermissionState>;
    };
    try {
      const status = await h.queryPermission({ mode: 'readwrite' });
      if (status !== 'granted') return; // permission lapsed — skip silently
    } catch { return; }
    await writeBackupToFolder();
  }, 10_000);
}

/** Cancel any pending debounced backup (e.g. on logout). */
export function cancelScheduledBackup(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

// ─── Main entry point (daily / on-load) ──────────────────────────────────────
export async function runAutoBackup(): Promise<'folder' | 'skipped'> {
  if (!supportsFileSystemAccess) return 'skipped';
  const handle = await loadDirectoryHandle();
  if (!handle) return 'skipped';
  // Same as scheduleBackup — only run if permission is already granted
  const h = handle as unknown as {
    queryPermission(opts: { mode: string }): Promise<PermissionState>;
  };
  try {
    const status = await h.queryPermission({ mode: 'readwrite' });
    if (status !== 'granted') return 'skipped';
  } catch { return 'skipped'; }
  const filename = await writeBackupToFolder();
  return filename ? 'folder' : 'skipped';
}
