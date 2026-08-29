import { Bell, Calendar, LogOut, Plus, Search, User, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import type { SearchResult } from '../../types';

function useGlobalSearch(query: string): SearchResult[] {
  const jobWorks = useAppStore((s) => s.jobWorks);
  const products = useAppStore((s) => s.products);
  const vendors = useAppStore((s) => s.vendors);
  const dispatches = useAppStore((s) => s.dispatches);

  if (!query.trim()) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  jobWorks.forEach((j) => {
    if (j.jobNumber.toLowerCase().includes(q)) {
      results.push({ type: 'Job Work', id: j.id, label: j.jobNumber, sublabel: j.process, path: `/job-works/${j.id}` });
    }
  });

  dispatches.forEach((d) => {
    if (d.challanNumber.toLowerCase().includes(q)) {
      results.push({ type: 'Challan', id: d.id, label: d.challanNumber, path: `/challans/${d.id}` });
    }
  });

  products.forEach((p) => {
    if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)) {
      results.push({ type: 'Product', id: p.id, label: p.name, sublabel: p.code, path: `/products/${p.id}` });
    }
    p.variants.forEach((v) => {
      if (v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)) {
        results.push({ type: 'Variant', id: v.id, label: v.sku, sublabel: p.name, path: `/products/${p.id}` });
      }
    });
  });

  vendors.forEach((v) => {
    if (v.name.toLowerCase().includes(q)) {
      results.push({ type: 'Vendor', id: v.id, label: v.name, sublabel: v.specialization, path: `/vendors/${v.id}` });
    }
  });

  return results.slice(0, 8);
}

export function Navbar() {
  const currentUser = useAppStore((s) => s.currentUser);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const loadLocalData = useAppStore((s) => s.loadLocalData);
  const logout = useAppStore((s) => s.logout);
  const addToast = useAppStore((s) => s.addToast);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const results = useGlobalSearch(query);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const connectionColor = {
    'Local Server Connected': 'bg-green-500',
    'Cloud Synced': 'bg-blue-500',
    'Sync Pending': 'bg-orange-500',
    Offline: 'bg-red-500',
  }[connectionStatus];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0 no-print">
      <div ref={searchRef} className="relative flex-1 max-w-xl">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search job works, challans, products, vendors..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => { navigate(r.path); setQuery(''); setShowResults(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface text-left"
              >
                <span className="text-xs font-medium text-brand bg-brand-light px-2 py-0.5 rounded">{r.type}</span>
                <div>
                  <p className="text-sm font-medium text-charcoal">{r.label}</p>
                  {r.sublabel && <p className="text-xs text-muted">{r.sublabel}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <span className={`w-2 h-2 rounded-full ${connectionColor}`} />
        <span className="hidden sm:inline">{connectionStatus}</span>
        <button
          onClick={async () => {
            if (isSyncing) return;
            try {
              setIsSyncing(true);
              await loadLocalData();
              addToast('Sync complete', 'success');
            } catch (e) {
              addToast('Sync failed', 'error');
            } finally {
              setIsSyncing(false);
            }
          }}
          title="Refresh data"
          className="p-1 ml-2 rounded hover:bg-surface"
        >
          <RefreshCw size={16} className={`text-muted ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* New Job shortcut hint */}
      <button
        onClick={() => navigate('/job-works/create')}
        title="Create New Job Card (Ctrl+Shift+N)"
        className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-muted hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors"
      >
        <Plus size={13} />
        New Job
        <kbd className="ml-1 font-mono text-[10px] bg-white border border-border px-1 py-0.5 rounded">Ctrl+⇧+N</kbd>
      </button>

      <button className="relative p-2 rounded-lg hover:bg-surface text-muted">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full" />
      </button>

      <div className="flex items-center gap-2 text-sm text-muted">
        <Calendar size={16} />
        <span className="hidden lg:block">{today}</span>
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-border">
        <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center">
          <User size={16} className="text-brand" />
        </div>
        <div className="hidden md:block">
          <p className="text-sm font-medium text-charcoal">{currentUser?.name}</p>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg hover:bg-surface text-muted" title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
