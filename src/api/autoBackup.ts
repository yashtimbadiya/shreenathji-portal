/**
 * autoBackup.ts
 *
 * Miracle-style automatic backup.
 *
 * ─── How it works (mirrors Miracle accounting software behaviour) ───────────
 *
 *  ON EVERY LOAD   — A dated backup is written to the chosen folder as soon as
 *                    the app opens (if a folder is configured and permission is
 *                    already granted).  No "once-per-day" gate.
 *
 *  ON EVERY CLOSE  — When the tab is hidden, navigated away from, or closed,
 *                    a fresh backup is written immediately.  This is the most
 *                    important layer: your data is safe the moment you leave.
 *
 *  AFTER MUTATIONS — scheduleBackup() is called after every create/update/delete.
 *                    It debounces 10 s so bursts of changes produce one write.
 *
 *  MANUAL          — "Backup Now" in Settings always writes immediately.
 *
 *  FALLBACK        — For Firefox / Safari (no File System Access API) the hook
 *                    triggers a browser download on every close so users still
 *                    get a local copy automatically.
 *
 * ─── File naming ─────────────────────────────────────────────────────────────
 *  snj-backup-YYYY-MM-DD_HH-MM.xlsx
 *
 *  Each backup is a NEW file — nothing is ever overwritten or deleted.
 *  You get a complete history of every session in the folder.
 *
 * ─── Atomic write ────────────────────────────────────────────────────────────
 *  The workbook is fully built before the file is opened for writing.
 *  A build error never truncates an existing backup.
 */

import * as XLSX from 'xlsx';
import { portalDb } from './supabaseClient';
import type { JobWorkItem } from '../types';

// ─── Feature detect ───────────────────────────────────────────────────────────
export const supportsFileSystemAccess =
  typeof window !== 'undefined' &&
  'showDirectoryPicker' in window;

// ─── Handle + history persistence (raw IDB — not Dexie) ──────────────────────
const HANDLE_DB_NAME = 'snj-backup-handle-db';
const HANDLE_STORE   = 'handles';
const HANDLE_KEY     = 'backupFolder';
const HISTORY_STORE  = 'history';

export interface BackupHistoryEntry {
  filename:    string;   // e.g. snj-backup-2026-09-04_14-30.xlsx
  timestamp:   string;   // ISO string
  recordCount: number;
  sizeBytes:   number;
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(HANDLE_STORE))
        db.createObjectStore(HANDLE_STORE);
      if (!db.objectStoreNames.contains(HISTORY_STORE))
        db.createObjectStore(HISTORY_STORE, { keyPath: 'filename' });
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
    await new Promise<void>((resolve, reject) => {
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
  data:         ArrayBuffer;
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

  // JobItems
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

  // Products
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
    references.length + dispatches.length + receipts.length + payments.length +
    sharedVariants.length;

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
const LAST_BACKUP_KEY = 'snj:last-auto-backup';

export function getLastBackupTime(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

export function setLastBackupTime(): void {
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
}

// ─── Core write — ATOMIC, new dated file every time, NOTHING deleted ─────────
/**
 * Builds the full workbook BEFORE opening the file.
 * Only on success do we write — a build error never truncates existing backups.
 * Old files are NEVER deleted; the folder grows indefinitely (Miracle behaviour).
 *
 * Returns the filename written, or null on failure.
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
    console.warn('[autoBackup] Workbook build failed — existing backups preserved:', err);
    return null;
  }

  const filename = buildBackupFilename();

  try {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable   = await fileHandle.createWritable();
    await writable.write(result.data);
    await writable.close();

    setLastBackupTime();
    await appendHistory({
      filename,
      timestamp:   new Date().toISOString(),
      recordCount: result.totalRecords,
      sizeBytes:   result.data.byteLength,
    });

    console.info(`[autoBackup] ✓ Saved → ${filename} (${result.totalRecords} records)`);
    return filename;
  } catch (err) {
    console.warn('[autoBackup] File write failed:', err);
    return null;
  }
}

// ─── Fallback: silent browser download ───────────────────────────────────────
/**
 * Used when the File System Access API is unavailable (Firefox, Safari) or
 * when no folder has been configured.
 *
 * Triggers a normal browser file download so the user gets a dated .xlsx in
 * their Downloads folder automatically — no prompts, no clicks needed.
 */
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
    timestamp:   new Date().toISOString(),
    recordCount: totalRecords,
    sizeBytes:   data.byteLength,
  });
  console.info(`[autoBackup] ✓ Downloaded → ${filename}`);
}

// ─── Debounced mutation backup ────────────────────────────────────────────────
// Called after every data mutation.  Waits 10 s for activity to settle,
// then writes to the folder if one is configured with active permission.
// Background writes cannot request permission — they skip silently if the
// browser has revoked it.  The next "Backup Now" click will re-prompt.

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleBackup(): void {
  if (!supportsFileSystemAccess) return;
  if (_debounceTimer !== null) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    _debounceTimer = null;
    const handle = await loadDirectoryHandle();
    if (!handle) return;
    const h = handle as unknown as {
      queryPermission(opts: { mode: string }): Promise<PermissionState>;
    };
    try {
      const status = await h.queryPermission({ mode: 'readwrite' });
      if (status !== 'granted') return;
    } catch { return; }
    await writeBackupToFolder();
  }, 10_000);
}

export function cancelScheduledBackup(): void {
  if (_debounceTimer !== null) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

// ─── On-load backup (runs every time the app opens) ──────────────────────────
/**
 * Called by useAutoBackup on every mount.
 * Writes immediately if a folder is configured with active permission.
 * Unlike the old version there is NO "already backed up today" gate —
 * every session gets its own backup file.
 */
export async function runAutoBackup(): Promise<'folder' | 'download' | 'skipped'> {
  // FSA path — folder backup
  if (supportsFileSystemAccess) {
    const handle = await loadDirectoryHandle();
    if (handle) {
      const h = handle as unknown as {
        queryPermission(opts: { mode: string }): Promise<PermissionState>;
      };
      try {
        const status = await h.queryPermission({ mode: 'readwrite' });
        if (status === 'granted') {
          const filename = await writeBackupToFolder();
          return filename ? 'folder' : 'skipped';
        }
      } catch { /* fall through */ }
    }
    return 'skipped';
  }

  // No FSA — don't auto-download on load (that would be annoying).
  // On-close download is handled by useAutoBackup instead.
  return 'skipped';
}
