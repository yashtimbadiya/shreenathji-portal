import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ToastContainer } from '../ui/Toast';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const currentUser = useAppStore((s) => s.currentUser);
  const loadLocalData = useAppStore((s) => s.loadLocalData);

  useEffect(() => {
    if (currentUser) {
      loadLocalData();
    }
  }, [currentUser, loadLocalData]);

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
