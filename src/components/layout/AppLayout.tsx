import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ToastContainer } from '../ui/Toast';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAutoBackup } from '../../hooks/useAutoBackup';
import { useGlobalEscNavigation } from '../../hooks/useGlobalEscNavigation';
import { useFormPageNavigation } from '../../hooks/useFormPageNavigation';
import { SHORTCUTS } from '../../lib/shortcuts';

export function AppLayout() {
  const currentUser = useAppStore((s) => s.currentUser);
  const loadLocalData = useAppStore((s) => s.loadLocalData);
  const navigate = useNavigate();

  // Whether the shortcuts help overlay is open — passed down to Navbar
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadLocalData();
    }
  }, [currentUser, loadLocalData]);

  // ── Auto-backup (on open + on close) ─────────────────────────────────────
  useAutoBackup();

  // ── Global ESC navigation (child → parent → dashboard) ───────────────────
  useGlobalEscNavigation();
  useFormPageNavigation();

  // ── Direct single-key shortcut system ─────────────────────────────────────
  // Press a single letter to jump to a section — no leader key, no Ctrl combos.
  useEffect(() => {
    const isInputFocused = () => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const editable = (document.activeElement as HTMLElement)?.isContentEditable;
      return tag === 'input' || tag === 'textarea' || tag === 'select' || editable;
    };

    // Don't hijack keys while a modal, dialog, or dropdown is open.
    const hasOverlay = () =>
      document.querySelector('[role="dialog"]') !== null ||
      document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
      document.querySelector('[data-form-navigation-popup]') !== null;

    const handler = (e: KeyboardEvent) => {
      // Ignore any modifier combo so we never clash with browser/OS shortcuts.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Never intercept while typing in a field or when an overlay is open.
      if (isInputFocused() || hasOverlay()) return;

      // ── ? → toggle the shortcut help overlay ────────────────────────────
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }

      const key = e.key.toLowerCase();

      // 'n' is reserved for the contextual "New" action on each page
      // (handled by useNewItemShortcut), so the global navigator ignores it.
      if (key === 'n') return;

      const match = SHORTCUTS.find((s) => s.key === key);
      if (match) {
        e.preventDefault();
        navigate(match.path);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  if (!currentUser) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar shortcutsOpen={shortcutsOpen} onToggleShortcuts={() => setShortcutsOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto p-6 bg-surface">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
