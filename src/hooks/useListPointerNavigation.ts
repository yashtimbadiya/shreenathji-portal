import { useEffect, useState } from 'react';

export interface ListPointerOptions {
  itemCount: number;
  rowSelector: string;
}

export function useListPointerNavigation({ itemCount, rowSelector }: ListPointerOptions): number {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(itemCount > 0 ? 0 : -1);
  }, [itemCount, rowSelector]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const row = document.querySelectorAll<HTMLElement>(rowSelector)[activeIndex];
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    row.focus({ preventScroll: true });
  }, [activeIndex, rowSelector]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        const activeRow = active?.closest<HTMLElement>(rowSelector);
        if (!activeRow || active !== activeRow) return;

        const primaryAction = activeRow.querySelector<HTMLElement>('a, button:not([disabled])');
        if (!primaryAction) return;
        event.preventDefault();
        primaryAction.click();
        return;
      }

      const isDown = event.key === 'PageDown' || event.code === 'PageDown' || event.key === 'ArrowDown' || event.code === 'ArrowDown';
      const isUp = event.key === 'PageUp' || event.code === 'PageUp' || event.key === 'ArrowUp' || event.code === 'ArrowUp';
      if (!isDown && !isUp) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (target?.closest('form, [data-form]')) return;
      if (document.querySelector('[role="dialog"]')) return;

      const rows = document.querySelectorAll<HTMLElement>(rowSelector);
      if (rows.length === 0) return;

      event.preventDefault();
      setActiveIndex((current) => {
        const start = current < 0 ? 0 : current;
        const next = isDown ? start + 1 : start - 1;
        return Math.max(0, Math.min(rows.length - 1, next));
      });
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [rowSelector]);

  return activeIndex;
}
