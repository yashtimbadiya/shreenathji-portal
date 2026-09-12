/**
 * shortcuts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all global keyboard shortcuts.
 *
 * Pattern — Gmail-style "G then <key>" leader sequence:
 *   1. Press  G  (while focus is NOT inside an input/textarea/select)
 *   2. A 1500 ms window opens — a small toast indicator shows "G · …"
 *   3. Press the second key to navigate
 *   4. If no second key arrives within 1500 ms the sequence is cancelled
 *
 * Non-leader shortcuts (Ctrl / direct):
 *   Ctrl+Shift+N  → Create Job Work   (kept from existing code)
 *   ?             → Toggle shortcut help overlay
 */

export interface Shortcut {
  /** Second key after G (lowercase) */
  key: string;
  /** Human-readable label shown in the help overlay */
  label: string;
  /** Navigation target */
  path: string;
  /** Optional group heading */
  group: string;
}

export const LEADER_KEY = 'g';
export const LEADER_TIMEOUT_MS = 1500;

export const SHORTCUTS: Shortcut[] = [
  // ── Navigation ──────────────────────────────────────────────────────────
  { key: 'd', label: 'Dashboard',       path: '/dashboard',        group: 'Navigate' },
  // ── Job Work ─────────────────────────────────────────────────────────────
  { key: 'j', label: 'All Job Works',   path: '/job-works',        group: 'Job Work'  },
  { key: 'n', label: 'Create Job Work', path: '/job-works/create', group: 'Job Work'  },
  // ── Operations ───────────────────────────────────────────────────────────
  { key: 'r', label: 'Receive Material',path: '/receive/new',      group: 'Operations'},
  { key: 'c', label: 'All Challans',    path: '/challans',         group: 'Operations'},
  // ── Products ─────────────────────────────────────────────────────────────
  { key: 'p', label: 'Products',        path: '/categories',       group: 'Products'  },
  { key: 'b', label: 'Subproducts',     path: '/products',         group: 'Products'  },
  { key: 'w', label: 'Shared Variants', path: '/shared-variants',  group: 'Products'  },
  { key: 'e', label: 'References',      path: '/references',       group: 'Products'  },
  // ── People & Money ───────────────────────────────────────────────────────
  { key: 'v', label: 'Vendors',         path: '/vendors',          group: 'People & Money' },
  { key: 'y', label: 'Payments',        path: '/payments',         group: 'People & Money' },
  // ── System ───────────────────────────────────────────────────────────────
  { key: 't', label: 'Reports',         path: '/reports',          group: 'System'    },
  { key: 's', label: 'Settings',        path: '/settings',         group: 'System'    },
];

/** Unique ordered groups for the help overlay */
export const SHORTCUT_GROUPS: string[] = [
  'Navigate',
  'Job Work',
  'Operations',
  'Products',
  'People & Money',
  'System',
];
