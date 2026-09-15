export const FORM_FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button[data-trigger]:not([disabled])',
  'button[type="submit"]:not([disabled])',
].join(', ');

export function focusNextInForm(current: HTMLElement, reverse = false) {
  const root =
    current.closest<HTMLElement>('form') ??
    current.closest<HTMLElement>('[data-form]');
  if (!root) return false;

  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FORM_FOCUSABLE_SELECTOR));
  const index = focusable.indexOf(current);
  if (index < 0) return false;

  const target = focusable[index + (reverse ? -1 : 1)];
  if (!target) return false;
  target.focus();
  return true;
}
