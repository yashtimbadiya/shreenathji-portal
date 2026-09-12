import { Bell, Calendar, HelpCircle, LogOut, Search, User, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { LEADER_KEY, SHORTCUTS, SHORTCUT_GROUPS, type Shortcut } from '../../lib/shortcuts';
import type { SearchResult } from '../../types';

// ── Global search ─────────────────────────────────────────────────────────────
function useGlobalSearch(query: string): SearchResult[] {
  const jobWorks  = useAppStore((s) => s.jobWorks);
  const products  = useAppStore((s) => s.products);
  const vendors   = useAppStore((s) => s.vendors);
  const dispatches = useAppStore((s) => s.dispatches);

  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  jobWorks.forEach((j) => {
    if (j.jobNumber.toLowerCase().includes(q))
      results.push({ type: 'Job Work', id: j.id, label: j.jobNumber, sublabel: j.process, path: `/job-works/${j.id}` });
  });

  dispatches.forEach((d) => {
    if (d.challanNumber.toLowerCase().includes(q))
      results.push({ type: 'Challan', id: d.id, label: d.challanNumber, path: `/challans/${d.id}` });
  });

  products.forEach((p) => {
    if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      results.push({ type: 'Product', id: p.id, label: p.name, sublabel: p.code, path: `/products/${p.id}` });
    p.variants.forEach((v) => {
      if (v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
        results.push({ type: 'Variant', id: v.id, label: v.sku, sublabel: p.name, path: `/products/${p.id}` });
    });
  });

  vendors.forEach((v) => {
    if (v.name.toLowerCase().includes(q))
      results.push({ type: 'Vendor', id: v.id, label: v.name, sublabel: v.specialization, path: `/vendors/${v.id}` });
  });

  return results.slice(0, 8);
}

// ── Shortcuts overlay ─────────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md
                    bg-surface border border-border text-[11px] font-mono font-semibold
                    text-charcoal shadow-sm leading-none">
      {children}
    </kbd>
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  // Close on Escape or click-outside
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const grouped = SHORTCUT_GROUPS.map((group) => ({
    group,
    items: SHORTCUTS.filter((s: Shortcut) => s.group === group),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-charcoal">Keyboard Shortcuts</h2>
            <p className="text-xs text-muted mt-0.5">
              Press&nbsp;
              <Kbd>{LEADER_KEY.toUpperCase()}</Kbd>
              &nbsp;to arm the sequence, then the second key to navigate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-charcoal hover:bg-surface transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">

          {/* Leader-key shortcuts grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">{group}</p>
                <div className="space-y-1">
                  {items.map((s) => (
                    <div key={s.key} className="flex items-center justify-between gap-4 rounded-lg px-3 py-1.5 hover:bg-surface transition-colors">
                      <span className="text-sm text-charcoal">{s.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Kbd>{LEADER_KEY.toUpperCase()}</Kbd>
                        <span className="text-muted text-xs">then</span>
                        <Kbd>{s.key.toUpperCase()}</Kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border my-5" />

          {/* Other shortcuts */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Other Shortcuts</p>
            <div className="space-y-1">
              {[
                { keys: ['Ctrl', '⇧', 'N'], label: 'Create Job Work (anywhere)' },
                { keys: ['?'],               label: 'Open this shortcut help' },
                { keys: ['Esc'],             label: 'Go back / close / cancel' },
                { keys: ['Ctrl', '↵'],       label: 'Save / Confirm & Dispatch' },
                { keys: ['↵'],               label: 'Next field in forms' },
                { keys: ['⇧', '↵'],          label: 'Previous field in forms' },
              ].map(({ keys, label }) => (
                <div key={label} className="flex items-center justify-between gap-4 rounded-lg px-3 py-1.5 hover:bg-surface transition-colors">
                  <span className="text-sm text-charcoal">{label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {keys.map((k, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-muted text-[10px]">+</span>}
                        <Kbd>{k}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface flex items-center justify-between text-xs text-muted">
          <span>Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close</span>
          <span className="font-medium text-brand">Shreenathji Enterprise</span>
        </div>
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

interface NavbarProps {
  shortcutsOpen:    boolean;
  onToggleShortcuts: () => void;
}

export function Navbar({ shortcutsOpen, onToggleShortcuts }: NavbarProps) {
  const currentUser      = useAppStore((s) => s.currentUser);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const loadLocalData    = useAppStore((s) => s.loadLocalData);
  const logout           = useAppStore((s) => s.logout);
  const addToast         = useAppStore((s) => s.addToast);
  const navigate         = useNavigate();

  const [query,      setQuery]      = useState('');
  const [showResults,setShowResults]= useState(false);
  const [isSyncing,  setIsSyncing]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const results   = useGlobalSearch(query);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const connectionColor = {
    'Local Server Connected': 'bg-green-500',
    'Cloud Synced':           'bg-blue-500',
    'Sync Pending':           'bg-orange-500',
    'Offline':                'bg-red-500',
  }[connectionStatus] ?? 'bg-gray-400';

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowResults(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <>
      <header className="h-16 bg-white border-b border-border flex items-center px-6 gap-4 shrink-0 no-print">

        {/* Global search */}
        <div ref={searchRef} className="relative flex-1 max-w-xl">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search job works, challans, products, vendors..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onFocus={() => setShowResults(true)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-sm
                       focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
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

        {/* Connection status + sync */}
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
              } catch {
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

        {/* Shortcut hint badge + help button */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Leader-key hint */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-muted">
            <Kbd>{LEADER_KEY.toUpperCase()}</Kbd>
            <span className="text-muted/60">+</span>
            <span>key to navigate</span>
          </div>

          {/* ? button → shortcuts overlay */}
          <button
            onClick={onToggleShortcuts}
            title="Keyboard shortcuts (?)"
            className={`p-2 rounded-lg border text-xs font-medium transition-colors
              ${shortcutsOpen
                ? 'border-brand bg-brand/5 text-brand'
                : 'border-border bg-surface text-muted hover:border-brand hover:text-brand hover:bg-brand/5'
              }`}
          >
            <HelpCircle size={15} />
          </button>
        </div>

        <button className="relative p-2 rounded-lg hover:bg-surface text-muted">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full" />
        </button>

        <div className="flex items-center gap-2 text-xs text-muted">
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
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="p-2 rounded-lg hover:bg-surface text-muted"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Shortcuts overlay — rendered outside the header so it covers the full viewport */}
      {shortcutsOpen && <ShortcutsOverlay onClose={onToggleShortcuts} />}
    </>
  );
}
