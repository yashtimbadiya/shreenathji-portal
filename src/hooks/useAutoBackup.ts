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

  // ── ON CLOSE / UNLOAD: one final folder write (no download fallback) ───────
  useEffect(() => {
    const attemptBackupOnClose = () => {
      if (closingRef.current) return;
      closingRef.current = true;

      // We're writing now — cancel any pending debounced write.
      cancelScheduledBackup();

      // Only the File System Access path is safe on unload. A download here
      // would fire on every reload/navigation, so we deliberately skip it.
      if (!supportsFileSystemAccess) return;

      // Fire-and-forget: unload handlers cannot await. Chrome/Edge keep the
      // page alive briefly, which is enough for the folder write to flush.
      void backupIfPermitted();
    };

    // pagehide fires on close, navigation, and reload — but not on minimize
    // or ordinary tab switching, which is exactly what we want.
    const onPageHide = () => attemptBackupOnClose();
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);
}
