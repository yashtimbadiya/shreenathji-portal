import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageEscHandlers } from './useEscapeBack';

/**
 * Global ESC navigation — mounted once in AppLayout.
 *
 * Rules:
 *  - If any page-level useEscapeBack handler is currently active, this global
 *    hook yields entirely (the page owns ESC for this route).
 *  - If a capture-phase handler (e.g. PrintChallanDialog) already called
 *    e.preventDefault(), we also yield.
 *  - Otherwise, ESC navigates based on the current route:
 *
 *   Child pages (detail / form)  →  their parent list page
 *   Parent list pages            →  /dashboard
 *   /dashboard                   →  (no-op, already home)
 */

/** Maps a pathname to the ESC destination. Returns null to no-op. */
function resolveEscTarget(pathname: string): string | null {
  // ── Top-level "parent" pages → go to dashboard ───────────────────────────
  const parentPages = [
    '/job-works',
    '/categories',
    '/products',
    '/shared-variants',
    '/references',
    '/vendors',
    '/payments',
    '/challans',
    '/receive/new',
    '/receive/history',
    '/reports',
    '/settings',
    '/users',
  ];
  if (parentPages.includes(pathname)) return '/dashboard';

  // ── Child / detail / form pages → parent ────────────────────────────────

  // Job Works
  if (pathname === '/job-works/create') return '/job-works';
  if (/^\/job-works\/[^/]+\/edit$/.test(pathname)) return pathname.replace(/\/edit$/, ''); // edit → detail
  if (/^\/job-works\/[^/]+$/.test(pathname)) return '/job-works'; // detail → list

  // Products section
  if (pathname === '/categories/new') return '/categories';
  if (pathname === '/products/new') return '/products';
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) return pathname.replace(/\/edit$/, ''); // edit → detail
  if (/^\/products\/[^/]+$/.test(pathname)) return '/products'; // detail → list

  // Vendors
  if (/^\/vendors\/[^/]+$/.test(pathname)) return '/vendors';

  // Challans
  if (/^\/challans\/[^/]+$/.test(pathname)) return '/challans';

  // References
  if (pathname === '/references/new') return '/references';
  if (/^\/references\/[^/]+\/edit$/.test(pathname)) return '/references';

  // Dashboard — already home, no-op
  if (pathname === '/dashboard') return null;

  // Fallback: unknown pages → dashboard
  return '/dashboard';
}

export function useGlobalEscNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // If a page-level useEscapeBack (or capture-phase handler) already
      // handled this event, respect that and do nothing.
      if (e.defaultPrevented) return;

      // If any page has a useEscapeBack handler registered, yield to it.
      // (The page handler fires first because it was registered later and
      //  both run in the bubble phase — but we guard with the registry too.)
      if (pageEscHandlers.size > 0) return;

      // Yield to open dialogs / dropdowns / popovers
      const hasOpenOverlay =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
        document.querySelector('[data-floating-ui-portal]') !== null;
      if (hasOpenOverlay) return;

      // Don't intercept if focus is inside a native <select>
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'select') return;

      const target = resolveEscTarget(location.pathname);
      if (!target) return;

      e.preventDefault();
      navigate(target);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, location.pathname]);
}
