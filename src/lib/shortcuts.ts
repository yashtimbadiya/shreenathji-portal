/**
 * shortcuts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all global keyboard shortcuts.
 *
 * Pattern — DIRECT single-key navigation (no leader, no Ctrl combos):
 *   Press a single letter (while focus is NOT inside an input/textarea/select
 *   and no modal/dropdown is open) to jump straight to that section.
 *
 * Reserved single keys handled elsewhere:
 *   n  → contextual "New" on the current page (useNewItemShortcut)
 *   ?  → toggle the shortcut help overlay
 *   Escape → back / close (useGlobalEscNavigation)
 *
 * Because these are single keys, every letter below must be UNIQUE and must
 * not collide with the reserved keys above.
 */

export interface Shortcut {
  /** The single key that triggers navigation (lowercase) */
  key: string;
  /** Human-readable label shown in the help overlay */
  label: string;
  /** Navigation target */
  path: string;
  /** Optional group heading */
  group: string;
}

// Kept for backward-compatibility with any importers; the leader sequence is
// no longer used now that shortcuts are direct single keys.
export const LEADER_KEY = 'g';
export const LEADER_TIMEOUT_MS = 1500;

export const SHORTCUTS: Shortcut[] = [
  // ── Navigation ──────────────────────────────────────────────────────────
  { key: 'd', label: 'Dashboard',       path: '/dashboard',        group: 'Navigate' },
  // ── Job Work ─────────────────────────────────────────────────────────────
  { key: 'j', label: 'All Job Works',   path: '/job-works',        group: 'Job Work'  },
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
