import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SHORTCUTS } from '../../lib/shortcuts';

// ── Shortcut badge ────────────────────────────────────────────────────────────
// Build a path → shortcut-key lookup once at module level (no re-computation).
const PATH_TO_KEY: Record<string, string> = {};
SHORTCUTS.forEach((s) => { PATH_TO_KEY[s.path] = s.key.toUpperCase(); });

/**
 * Small badge shown beside a nav item that has a keyboard shortcut.
 * Shortcuts are now single-key (press the letter to jump), so this shows a
 * single muted key pill — visible but unobtrusive.
 */
function ShortcutBadge({ path }: { path: string }) {
  const key = PATH_TO_KEY[path];
  if (!key) return null;
  return (
    <span className="ml-auto shrink-0 inline-flex items-center">
      <kbd className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded
                      bg-surface border border-border text-[9px] font-mono font-bold
                      text-muted leading-none shadow-sm">
        {key}
      </kbd>
    </span>
  );
}

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  section: string;
  children?: { label: string; path: string }[];
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard size={18} />,
    section: 'dashboard',
  },
  {
    label: 'Job Work',
    icon: <ClipboardList size={18} />,
    section: 'job-works',
    children: [
      { label: 'All Job Works',   path: '/job-works'        },
      { label: 'Create Job Work', path: '/job-works/create' },
      { label: 'Pending',         path: '/job-works?status=Sent'      },
      { label: 'Partial Received',path: '/job-works?status=Partial'   },
      { label: 'Completed',       path: '/job-works?status=Completed' },
      { label: 'Overdue',         path: '/job-works?status=Overdue'   },
    ],
  },
  {
    label: 'Receive Material',
    icon: <Package size={18} />,
    section: 'receive',
    children: [
      { label: 'New Receipt',     path: '/receive/new'     },
      { label: 'Receipt History', path: '/receive/history' },
    ],
  },
  {
    label: 'Challans',
    icon: <FileText size={18} />,
    section: 'challans',
    children: [
      { label: 'All Challans', path: '/challans' },
    ],
  },
  {
    label: 'Products',
    icon: <Boxes size={18} />,
    section: 'products',
    children: [
      { label: 'Products',        path: '/categories'      },
      { label: 'Subproducts',     path: '/products'        },
      { label: 'Shared Variants', path: '/shared-variants' },
      { label: 'References',      path: '/references'      },
    ],
  },
  {
    label: 'Vendors',
    path: '/vendors',
    icon: <Users size={18} />,
    section: 'vendors',
  },
  {
    label: 'Payments',
    path: '/payments',
    icon: <CreditCard size={18} />,
    section: 'payments',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: <BarChart3 size={18} />,
    section: 'reports',
  },
  {
    label: 'Users',
    path: '/users',
    icon: <Users size={18} />,
    section: 'users',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: <Settings size={18} />,
    section: 'settings',
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const location = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'Job Work': true });

  return (
    <aside className="w-64 bg-white border-r border-border flex flex-col h-full shrink-0 no-print">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
            <span className="text-white font-bold text-sm">SE</span>
          </div>
          <div>
            <p className="text-sm font-bold text-charcoal leading-tight">Shreenathji</p>
            <p className="text-xs text-muted">Enterprise</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {navItems.map((item) => {

          // ── Section with children ──────────────────────────────────────
          if (item.children) {
            const isOpen =
              (expanded[item.label] ?? false) ||
              item.children.some(
                (c) =>
                  location.pathname + location.search === c.path ||
                  location.pathname.startsWith(c.path.split('?')[0]),
              );

            return (
              <div key={item.label} className="mb-0.5">
                {/* Section toggle button */}
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [item.label]: !isOpen }))}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                             text-muted hover:bg-surface hover:text-charcoal transition-colors"
                >
                  {item.icon}
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Children */}
                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {item.children.map((child) => {
                      const isActive =
                        location.pathname + location.search === child.path ||
                        (location.pathname === child.path.split('?')[0] &&
                          !child.path.includes('?'));

                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={`group flex items-center gap-0 px-3 py-1.5 rounded-lg
                                      text-xs transition-colors ${
                                        isActive
                                          ? 'bg-brand-light text-brand font-medium'
                                          : 'text-muted hover:bg-surface hover:text-charcoal'
                                      }`}
                        >
                          <span className="flex-1">{child.label}</span>
                          <ShortcutBadge path={child.path} />
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // ── Top-level link ─────────────────────────────────────────────
          return (
            <NavLink
              key={item.label}
              to={item.path!}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5
                 transition-colors ${
                   isActive
                     ? 'bg-brand-light text-brand font-medium'
                     : 'text-muted hover:bg-surface hover:text-charcoal'
                 }`
              }
            >
              {item.icon}
              <span className="font-medium flex-1">{item.label}</span>
              <ShortcutBadge path={item.path!} />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
