import { useEffect } from 'react';

/**
 * Fires `onEscape` when the Escape key is pressed, unless:
 *  - focus is inside an open <select> element
 *  - a [role="dialog"] or [data-radix-popper-content-wrapper] overlay is present
 *    (i.e. a modal or dropdown is already consuming the key)
 *
 * Use this in full-page forms to wire up the Back / Cancel action to Escape.
 *
 * @example
 *   useEscapeBack(() => navigate(returnTo));
 */

/**
 * Module-level registry of active page-level ESC handlers.
 * When any handler is registered, the global ESC navigation hook yields.
 */
export const pageEscHandlers = new Set<() => void>();

export function useEscapeBack(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    // Register this handler so the global hook knows a page owns ESC
    pageEscHandlers.add(onEscape);

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Let open dropdowns / modals handle it first
      const hasOpenOverlay =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-radix-popper-content-wrapper]') !== null ||
        document.querySelector('[data-floating-ui-portal]') !== null;

      if (hasOpenOverlay) return;

      // Don't intercept if focus is inside a native <select>
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'select') return;

      e.preventDefault();
      onEscape();
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      pageEscHandlers.delete(onEscape);
    };
  }, [onEscape, enabled]);
}
