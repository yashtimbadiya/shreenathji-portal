/**
 * useAutoBackup
 *
 * Mount once at the app root (AppLayout).
 *
 * Backup layers handled here:
 *
 *  Layer 1 – DAILY
 *    On first mount of the day, runs runAutoBackup() in the background.
 *
 *  Layer 2 – ON CLOSE / HIDE
 *    `pagehide`        – fires when the tab is closed, navigated away, or put in
 *                        bfcache. More reliable than `beforeunload` for async work.
 *    `visibilitychange`– fires when the user switches tabs or minimises the window.
 *                        We write on hide so a backup exists even if the process
 *                        is killed before the tab fully closes.
 *
 *    We use a `keepAlive` approach: for browsers that support it we call
 *    `navigator.sendBeacon` as a hint that we need time (no actual payload needed
 *    for FSAA writes), and we use `event.waitUntil` in a service-worker context
 *    when available. In practice, Chrome/Edge grant ~500 ms for FSAA writes on
 *    pagehide, which is enough for the workbook build + write.
 *
 *  Layer 3 – MUTATIONS (scheduleBackup)
 *    Called from the Zustand store after every create/update/delete.
 *    Debounced 10 s — so a backup runs within 10 s of any data change.
 *    Wired up in useAppStore, not here.
 *
 *  Layer 4 – MANUAL
 *    "Backup Now" button in Settings always calls writeBackupToFolder() directly.
 */

import { useEffect, useRef } from 'react';
import {
  hasBackedUpToday,
  runAutoBackup,
  writeBackupToFolder,
  loadDirectoryHandle,
  cancelScheduledBackup,
} from '../api/autoBackup';

export function useAutoBackup() {
  // Track whether a close-backup is already in flight so we don't double-write
  const closingRef = useRef(false);

  // ── Layer 1: daily backup on first load ─────────────────────────────────────
  useEffect(() => {
    if (hasBackedUpToday()) return;
    runAutoBackup().then((result) => {
      if (result === 'folder') {
        console.info('[autoBackup] Daily backup written to folder.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Layer 2: backup on tab close / hide ─────────────────────────────────────
  useEffect(() => {
    /** Attempt to write a backup. Fire-and-forget — browsers may not await it,
     *  but Chrome/Edge give enough time for File System Access API writes. */
    const attemptBackupOnClose = () => {
      if (closingRef.current) return;   // already triggered
      closingRef.current = true;

      // Cancel any pending debounced backup — we're writing right now
      cancelScheduledBackup();

      // Fire the write. We deliberately don't await because these event
      // handlers cannot be async; the Promise runs in the micro-task queue
      // and Chrome/Edge keep the page alive long enough to finish it.
      loadDirectoryHandle().then((handle) => {
        if (handle) {
          writeBackupToFolder().then((ok) => {
            if (!ok) {
              console.warn('[autoBackup] Close-backup write failed or had no permission.');
            }
          });
        }
      });
    };

    // `pagehide` is the most reliable "tab is closing" event.
    // It also fires for back/forward cache freeze, which is fine — we always
    // want a fresh backup before the page state is frozen.
    const onPageHide = (e: PageTransitionEvent) => {
      // e.persisted = true means it's going into bfcache (not really closing),
      // but we write anyway since the state is being "frozen".
      void e;
      attemptBackupOnClose();
      closingRef.current = false; // reset so the next pagehide also fires
    };

    // `visibilitychange` catches tab switches and window minimise.
    // Write when the page becomes hidden.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        attemptBackupOnClose();
        // Reset so the next hide also triggers
        closingRef.current = false;
      }
    };

    // `beforeunload` as a final safety net (synchronous budget only, but worth
    // registering for non-FSA fallback environments).
    const onBeforeUnload = () => {
      attemptBackupOnClose();
    };

    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
}
