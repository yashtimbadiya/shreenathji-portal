/**
 * useAutoBackup
 *
 * Mount once at the app root (AppLayout).
 *
 * Mirrors Miracle accounting-software backup behaviour:
 *
 *  ON CLOSE / UNLOAD — When the user closes the tab or app, a backup is attempted.
 *                   • Chrome / Edge (FSA supported + folder set)  → folder write
 *                   • Firefox / Safari, OR no folder configured   → browser
 *                     download (.xlsx lands in Downloads folder automatically)
 *
 *  No backups are triggered by load, minimize, tab switching, reload, or data
 *  mutations.
 *
 *  MANUAL          — "Backup Now" in Settings always calls writeBackupToFolder()
 *                    or triggerDownloadBackup() directly.
 *
 * Nothing is ever deleted from the backup folder.
 */

import { useEffect, useRef } from 'react';
import {
  supportsFileSystemAccess,
  writeBackupToFolder,
  triggerDownloadBackup,
  loadDirectoryHandle,
  cancelScheduledBackup,
} from '../api/autoBackup';

export function useAutoBackup() {
  /** Prevents duplicate close/unload attempts during one lifecycle event. */
  const closingRef = useRef(false);

  // ── ON CLOSE / UNLOAD: write one backup ─────────────────────────────────────
  useEffect(() => {
    /**
     * Attempt to write a backup when the app is about to close or be hidden.
     *
     * Strategy:
     *  1. If FSA is supported AND a folder is already configured with active
     *     permission → write to folder (silent, no user interaction needed).
     *  2. Otherwise → trigger a browser download so the user still gets a
     *     local .xlsx in their Downloads folder automatically.
     *
     * We use fire-and-forget Promises because close/hide event handlers cannot
     * be made async. Chrome/Edge keep the page alive ~500 ms for FSA writes,
     * which is enough. The download fallback uses a Blob URL + <a>.click()
     * which completes synchronously enough to survive the page unload budget.
     */
    const attemptBackupOnClose = () => {
      if (closingRef.current) return;
      closingRef.current = true;

      // Cancel any pending debounced backup — we are writing right now
      cancelScheduledBackup();

      if (supportsFileSystemAccess) {
        // Try folder write first
        loadDirectoryHandle().then((handle) => {
          if (!handle) {
            // No folder configured — fall back to download
            triggerDownloadBackup().catch(() => { /* ignore on unload */ });
            return;
          }
          // Only proceed if permission is already granted (can't prompt on close)
          const h = handle as unknown as {
            queryPermission(opts: { mode: string }): Promise<PermissionState>;
          };
          h.queryPermission({ mode: 'readwrite' })
            .then((status) => {
              if (status === 'granted') {
                writeBackupToFolder().then((ok) => {
                  if (!ok) {
                    // Permission lapsed — fall back to download
                    triggerDownloadBackup().catch(() => { /* ignore */ });
                  }
                });
              } else {
                // Permission not active — fall back to download
                triggerDownloadBackup().catch(() => { /* ignore */ });
              }
            })
            .catch(() => {
              triggerDownloadBackup().catch(() => { /* ignore */ });
            });
        });
      } else {
        // FSA not available (Firefox, Safari) — always download
        triggerDownloadBackup().catch(() => { /* ignore on unload */ });
      }
    };

    // pagehide does not fire for minimize or ordinary tab switching.
    const onPageHide = () => {
      attemptBackupOnClose();
    };

    window.addEventListener('pagehide',           onPageHide);

    return () => {
      window.removeEventListener('pagehide',           onPageHide);
    };
  }, []);
}
