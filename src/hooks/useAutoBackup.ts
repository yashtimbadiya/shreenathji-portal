/**
 * useAutoBackup
 *
 * Mount once at the app root (AppLayout). Handles automatic folder backups the
 * way Miracle-style accounting software does — quietly, without surprising the
 * user with downloads.
 *
 *  ON LOAD        — Once per session, if a backup folder is configured and its
 *                   permission is still granted, write a dated backup.
 *
 *  AFTER CHANGES  — The store calls scheduleBackup() after every mutation, which
 *                   debounces ~10 s and then writes to the folder (permission
 *                   permitting). That logic lives in autoBackup.ts.
 *
 *  ON CLOSE       — When the tab/app is closing (pagehide) we attempt one final
 *                   folder write if permission is already granted. We do NOT
 *                   auto-download on close: browsers fire pagehide on ordinary
 *                   reloads and navigations too, which would spam the Downloads
 *                   folder. Firefox/Safari (no folder API) rely on the on-change
 *                   debounce plus the manual "Backup Now" / Export buttons.
 *
 * Nothing is ever deleted from the backup folder.
 */

import { useEffect, useRef } from 'react';
import {
  supportsFileSystemAccess,
  runAutoBackup,
  backupIfPermitted,
  cancelScheduledBackup,
} from '../api/autoBackup';

export function useAutoBackup() {
  /** Ensures the on-load backup runs at most once per mount. */
  const loadedRef = useRef(false);
  /** Prevents duplicate close attempts during a single unload event. */
  const closingRef = useRef(false);

  // ── ON LOAD: one folder backup this session (if permission already granted) ─
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // Fire-and-forget; skips silently when no folder/permission.
    void runAutoBackup();
  }, []);

  // ── ON CLOSE: one final folder write (never on minimize / tab switch) ──────
  //
  // Browser reality check: a web app cannot *block* on close like a native app
  // (Miracle) can, and async File System Access writes may be cut short during
  // unload. So we do two things:
  //   1. Fire the folder write on the true "leaving" signals (pagehide /
  //      beforeunload) — Chrome/Edge usually keep the page alive long enough.
  //   2. Rely on the debounced after-every-change backup (see scheduleBackup)
  //      as the guarantee: the folder already holds a backup from seconds ago,
  //      so nothing is lost even if the close write is interrupted.
  //
  // We deliberately do NOT back up on `visibilitychange`/blur, because those
  // fire on minimize and tab switching — which the user does not want.
  useEffect(() => {
    const writeNow = () => {
      if (closingRef.current) return;
      closingRef.current = true;
      cancelScheduledBackup();
      // Only folder writes are safe on unload; a download would spam on reload.
      if (supportsFileSystemAccess) void backupIfPermitted();
      // Re-arm shortly after: if the page actually survived (e.g. the user
      // cancelled a reload), allow a future close to back up again.
      setTimeout(() => { closingRef.current = false; }, 2000);
    };

    // pagehide: fires on close, reload, and navigation away — NOT on minimize
    // or tab switch. This is the correct "window is closing" signal.
    const onPageHide = (e: PageTransitionEvent) => {
      // e.persisted === true means the page is going into the bfcache (may come
      // back); still safe to write a backup.
      void e;
      writeNow();
    };
    // beforeunload: extra coverage for hard closes where pagehide is skipped.
    const onBeforeUnload = () => writeNow();

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
}
