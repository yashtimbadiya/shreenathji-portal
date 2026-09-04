import { useEffect } from 'react';

/**
 * Registers a keyboard shortcut that fires `onNew` when the user presses
 * the specified key (default: "N") while NOT typing in an input, textarea,
 * or select element, and no modal/dropdown overlay is open.
 *
 * Usage:
 *   useNewItemShortcut(() => navigate('/products/new'));
 *   useNewItemShortcut(() => setShowForm(true));
 *   useNewItemShortcut(() => setShowForm(true), { key: 'A' });
 */
export function useNewItemShortcut(
  onNew: () => void,
  options: { key?: string; enabled?: boolean } = {},
) {
  const { key = 'n', enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Ignore if any modifier is held (Ctrl, Alt, Meta) so we don't
      // clash with Ctrl+N browser shortcuts or Ctrl+Enter form shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.toLowerCase() !== key.toLowerCase()) return;

      // Don't fire if the user is typing in a field
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      // Don't fire if a modal or dropdown overlay is open
      const hasOverlay =
        document.querySelector('[role="dialog"]') !== null ||
        document.querySelector('[data-radix-popper-content-wrapper]') !== null;
      if (hasOverlay) return;

      e.preventDefault();
      onNew();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNew, key, enabled]);
}
