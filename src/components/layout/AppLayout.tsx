import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ToastContainer } from '../ui/Toast';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAutoBackup } from '../../hooks/useAutoBackup';
import { useGlobalEscNavigation } from '../../hooks/useGlobalEscNavigation';
import { useFormPageNavigation } from '../../hooks/useFormPageNavigation';
import { LEADER_KEY, LEADER_TIMEOUT_MS, SHORTCUTS } from '../../lib/shortcuts';

export function AppLayout() {
  const currentUser = useAppStore((s) => s.currentUser);
  const loadLocalData = useAppStore((s) => s.loadLocalData);
  const addToast = useAppStore((s) => s.addToast);
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

  // ── Leader-key shortcut system ────────────────────────────────────────────
  // State tracked outside React renders to avoid stale closure issues.
  const armedRef  = useRef(false);  // is the leader sequence active?
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cancel an armed sequence silently */
  const disarm = useCallback(() => {
    armedRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    const isInputFocused = () => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const editable = (document.activeElement as HTMLElement)?.isContentEditable;
      return tag === 'input' || tag === 'textarea' || tag === 'select' || editable;
    };

    const handler = (e: KeyboardEvent) => {
      // Never intercept when typing in a form field
      if (isInputFocused()) return;

      // ── ? key → toggle shortcut overlay ─────────────────────────────────
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        disarm();
        setShortcutsOpen((o) => !o);
        return;
      }

      // ── Escape → disarm any active leader sequence ───────────────────────
      if (e.key === 'Escape') {
        if (armedRef.current) { e.preventDefault(); disarm(); }
        return;
      }

      // ── Ctrl+Shift+N → Create Job Work (legacy shortcut, kept) ──────────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        disarm();
        navigate('/job-works/create');
        return;
      }

      // Ignore any remaining Ctrl/Meta/Alt combos
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // ── Step 1: arm leader key ───────────────────────────────────────────
      if (!armedRef.current) {
        if (key === LEADER_KEY) {
          e.preventDefault();
          armedRef.current = true;
          // Show a subtle "Go to…" indicator via toast (1.5 s)
          addToast('Go to…  (D · J · N · R · C · P · V · S · ?)', 'info');
          timerRef.current = setTimeout(() => {
            armedRef.current = false;
            timerRef.current = null;
          }, LEADER_TIMEOUT_MS);
        }
        return;
      }

      // ── Step 2: leader is armed — resolve second key ─────────────────────
      e.preventDefault();
      disarm();

      const match = SHORTCUTS.find((s) => s.key === key);
      if (match) {
        navigate(match.path);
      }
      // Unknown second key → silently cancel (toast already dismissed by disarm)
    };

    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); disarm(); };
  }, [navigate, addToast, disarm]);

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
