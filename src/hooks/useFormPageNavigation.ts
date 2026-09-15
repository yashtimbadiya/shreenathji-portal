import { useEffect } from 'react';
import { focusNextInForm } from '../lib/formNavigation';

/** Move through the active form with PageDown/PageUp without affecting lists or popups. */
export function useFormPageNavigation() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'PageDown' && event.key !== 'PageUp') return;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (active.closest('[data-form-navigation-popup]')) return;
      if (!active.closest('form, [data-form]')) return;

      if (focusNextInForm(active, event.key === 'PageUp')) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
}