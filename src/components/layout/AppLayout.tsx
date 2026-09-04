import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ToastContainer } from '../ui/Toast';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useAutoBackup } from '../../hooks/useAutoBackup';
import { useGlobalEscNavigation } from '../../hooks/useGlobalEscNavigation';

export function AppLayout() {
  const currentUser = useAppStore((s) => s.currentUser);
  const loadLocalData = useAppStore((s) => s.loadLocalData);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      loadLocalData();
    }
  }, [currentUser, loadLocalData]);

  // ── Auto-backup (daily + on close) ───────────────────────────────────────
  useAutoBackup();

  // ── Global ESC navigation (child → parent → dashboard) ───────────────────
  useGlobalEscNavigation();

  // ── Global shortcut: Ctrl+Shift+N → Create New Job Card ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/job-works/create');
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
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 bg-surface">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
