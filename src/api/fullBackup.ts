/**
 * fullBackup.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Complete, portable, versioned snapshot of the ENTIRE application state.
 *
 * Why this exists:
 *   The Excel export is human-readable but lossy — it flattens data into sheets
 *   and silently drops anything a column mapping forgot (activity logs, settings,
 *   document counters, users, new payment fields, etc.). Moving to another PC with
 *   it loses data.
 *
 *   This module instead serialises every IndexedDB table PLUS the persisted store
 *   blob (settings, users, counters) into ONE JSON file. Restoring it on another
 *   machine reproduces the source machine exactly — nothing is dropped.
 *
 * File: snj-full-backup-YYYY-MM-DD_HH-MM.snjbackup  (JSON payload)
 */

import { portalDb } from './supabaseClient';
import type {
  ActivityLog, Category, DispatchRecord, JobWork, Payment,
  Product, ReceiptRecord, ReferenceRecord, SharedVariant, Vendor,
} from '../types';

// Bump when the snapshot shape changes in a breaking way.
export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_APP = 'shreenathji-portal';
export const SNAPSHOT_EXT = 'snjbackup';

/** The Zustand-persist localStorage key (settings, users, counters, currentUser). */
const PERSIST_KEY = 'shreenathji-portal';

export interface FullSnapshot {
  app: string;
  version: number;
  exportedAt: string;
  tables: {
    vendors: Vendor[];
    categories: Category[];
    products: Product[];
    jobWorks: JobWork[];
    dispatches: DispatchRecord[];
    receipts: ReceiptRecord[];
    payments: Payment[];
    activityLogs: ActivityLog[];
    references: ReferenceRecord[];
    sharedVariants: SharedVariant[];
  };
  /** Raw persisted store blob (settings, users, counters, availableJobNumbers…). */
  persisted: unknown;
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<FullSnapshot> {
  const [
    vendors, categories, products, jobWorks,
    dispatches, receipts, payments, activityLogs, references, sharedVariants,
  ] = await Promise.all([
    portalDb.vendors.toArray(),
    portalDb.categories.toArray(),
    portalDb.products.toArray(),
    portalDb.jobWorks.toArray(),
    portalDb.dispatches.toArray(),
    portalDb.receipts.toArray(),
    portalDb.payments.toArray(),
    portalDb.activityLogs.toArray(),
    portalDb.references.toArray(),
    portalDb.sharedVariants.toArray(),
  ]);

  let persisted: unknown = null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    persisted = raw ? JSON.parse(raw) : null;
  } catch { persisted = null; }

  return {
    app: SNAPSHOT_APP,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    tables: {
      vendors, categories, products, jobWorks,
      dispatches, receipts, payments, activityLogs, references, sharedVariants,
    },
    persisted,
  };
}

export function snapshotFilename(date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  const hhmm = date.toTimeString().slice(0, 5).replace(':', '-');
  return `snj-full-backup-${d}_${hhmm}.${SNAPSHOT_EXT}`;
}

/** Total records across all tables — for the UI confirmation. */
export function snapshotRecordCount(s: FullSnapshot): number {
  return Object.values(s.tables).reduce((sum, arr) => sum + arr.length, 0);
}

export async function downloadSnapshot(): Promise<{ filename: string; records: number }> {
  const snapshot = await buildSnapshot();
  const filename = snapshotFilename();
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { filename, records: snapshotRecordCount(snapshot) };
}

// ── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreResult {
  ok: boolean;
  message: string;
  counts?: Record<string, number>;
}

function isSnapshot(x: unknown): x is FullSnapshot {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.app === SNAPSHOT_APP && typeof o.version === 'number' && !!o.tables;
}

/**
 * Restore a full snapshot. This is a REPLACE operation: every table is cleared
 * and rewritten so the target machine matches the source exactly (no stale
 * leftovers). Settings/users/counters are restored via the persisted blob.
 * The caller should reload the page afterwards.
 */
export async function restoreSnapshot(file: File): Promise<RestoreResult> {
  let snapshot: FullSnapshot;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!isSnapshot(parsed)) {
      return { ok: false, message: 'Not a valid Shreenathji full-backup file.' };
    }
    if (parsed.version > SNAPSHOT_VERSION) {
      return { ok: false, message: `This backup was made by a newer version (v${parsed.version}). Update the app first.` };
    }
    snapshot = parsed;
  } catch (err) {
    return { ok: false, message: `Could not read backup file: ${String(err)}` };
  }

  const t = snapshot.tables;
  try {
    // Atomic-ish: clear + write each table inside one transaction per store.
    await portalDb.transaction('rw',
      [
        portalDb.vendors, portalDb.categories, portalDb.products, portalDb.jobWorks,
        portalDb.dispatches, portalDb.receipts, portalDb.payments,
        portalDb.activityLogs, portalDb.references, portalDb.sharedVariants,
      ],
      async () => {
        await Promise.all([
          portalDb.vendors.clear(),
          portalDb.categories.clear(),
          portalDb.products.clear(),
          portalDb.jobWorks.clear(),
          portalDb.dispatches.clear(),
          portalDb.receipts.clear(),
          portalDb.payments.clear(),
          portalDb.activityLogs.clear(),
          portalDb.references.clear(),
          portalDb.sharedVariants.clear(),
        ]);
        await Promise.all([
          t.vendors?.length        ? portalDb.vendors.bulkPut(t.vendors)             : undefined,
          t.categories?.length     ? portalDb.categories.bulkPut(t.categories)       : undefined,
          t.products?.length        ? portalDb.products.bulkPut(t.products)           : undefined,
          t.jobWorks?.length        ? portalDb.jobWorks.bulkPut(t.jobWorks)           : undefined,
          t.dispatches?.length      ? portalDb.dispatches.bulkPut(t.dispatches)       : undefined,
          t.receipts?.length        ? portalDb.receipts.bulkPut(t.receipts)           : undefined,
          t.payments?.length        ? portalDb.payments.bulkPut(t.payments)           : undefined,
          t.activityLogs?.length    ? portalDb.activityLogs.bulkPut(t.activityLogs)   : undefined,
          t.references?.length      ? portalDb.references.bulkPut(t.references)       : undefined,
          t.sharedVariants?.length  ? portalDb.sharedVariants.bulkPut(t.sharedVariants) : undefined,
        ]);
      },
    );

    // Restore settings / users / counters (the persisted Zustand blob).
    if (snapshot.persisted) {
      try {
        localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot.persisted));
      } catch { /* non-fatal */ }
    }

    const counts: Record<string, number> = {
      'Vendors':         t.vendors?.length ?? 0,
      'Products':        t.categories?.length ?? 0,
      'Subproducts':     t.products?.length ?? 0,
      'Job Works':       t.jobWorks?.length ?? 0,
      'Challans':        t.dispatches?.length ?? 0,
      'Receipts':        t.receipts?.length ?? 0,
      'Payments':        t.payments?.length ?? 0,
      'References':      t.references?.length ?? 0,
      'Shared Variants': t.sharedVariants?.length ?? 0,
      'Activity Logs':   t.activityLogs?.length ?? 0,
    };

    return { ok: true, message: 'Full backup restored. Reloading…', counts };
  } catch (err) {
    return { ok: false, message: `Restore failed: ${String(err)}` };
  }
}
