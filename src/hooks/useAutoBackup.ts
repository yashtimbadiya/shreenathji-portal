/**
 * useAutoBackup
 *
 * Mount once at the app root (AppLayout).
 *
 * Mirrors Miracle accounting-software backup behaviour:
 *
 *  ON EVERY LOAD  — runAutoBackup() writes a fresh dated file to the configured
 *                   folder as soon as the app opens (no "already backed up today"
 *                   gate — every session produces its own file).
 *
 *  ON EVERY CLOSE — When the user closes the tab, navigates away, or switches
 *                   tabs, a backup is written immediately.
 *                   • Chrome / Edge (FSA supported + folder set)  → folder write
 *                   • Firefox / Safari, OR no folder configured   → browser
 *                     download (.xlsx lands in Downloads folder automatically)
 *
 *  AFTER MUTATIONS — scheduleBackup() is debounced 10 s after every
 *                    create/update/delete in the Zustand store.
 *
 *  MANUAL          — "Backup Now" in Settings always calls writeBackupToFolder()
 *                    or triggerDownloadBackup() directly.
 *
 * Nothing is ever deleted from the backup folder.
 */

import { useEffect, useRef } from 'react';
import {
  supportsFileSystemAccess,
  runAutoBackup,
  writeBackupToFolder,
  triggerDownloadBackup,
  loadDirectoryHandle,
  cancelScheduledBackup,
} from '../api/autoBackup';

export function useAutoBackup() {
  /** Prevents double-firing if both pagehide and visibilitychange fire together */
  const closingRef = useRef(false);

  // ── ON LOAD: write a backup immediately ─────────────────────────────────────
  useEffect(() => {
    runAutoBackup().then((result) => {
      if (result === 'folder') {
        console.info('[autoBackup] ✓ On-load backup written to folder.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ON CLOSE / HIDE: always write a backup ──────────────────────────────────
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

    const resetClosing = () => { closingRef.current = false; };

    // pagehide — most reliable "tab closing / navigating away" event.
    // Fires even when the browser puts the page into bfcache (back/forward).
    const onPageHide = () => {
      attemptBackupOnClose();
      resetClosing(); // reset so the next pagehide also fires
    };

    // visibilitychange — catches tab switches and window minimise.
    // We write on hide so data is safe even if the OS kills the process
    // before the tab fully closes.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        attemptBackupOnClose();
        resetClosing();
      }
    };

    // beforeunload — final safety net (synchronous budget, ~50 ms).
    // Mainly useful as a nudge for the browser to keep the page alive longer.
    const onBeforeUnload = () => {
      attemptBackupOnClose();
    };

    window.addEventListener('pagehide',           onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload',       onBeforeUnload);

    return () => {
      window.removeEventListener('pagehide',           onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload',       onBeforeUnload);
    };
  }, []);
}
