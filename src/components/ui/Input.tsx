import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// ── Shared focus-next utility ─────────────────────────────────────────────────
// Walks the nearest <form> or [data-form] container and moves focus to the
// next or previous focusable element.
// Called by Input, Select, Textarea, and SearchableSelect on Enter / Shift+Enter.

export function focusNextInForm(current: HTMLElement, reverse = false) {
  const root =
    current.closest<HTMLElement>('form') ??
    current.closest<HTMLElement>('[data-form]');
  if (!root) return;

  const selector = [
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button[data-trigger]:not([disabled])',   // SearchableSelect triggers
    'button[type="submit"]:not([disabled])',
  ].join(', ');

  const focusable = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const idx = focusable.indexOf(current);
  const target = reverse ? focusable[idx - 1] : focusable[idx + 1];
  if (target) target.focus();
}

function handleEnterKey(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter') return;
  // Don't interfere with submit buttons
  if ((e.target as HTMLElement).tagName === 'BUTTON') return;
  e.preventDefault();
  focusNextInForm(e.currentTarget, e.shiftKey);
}

// ── Input ─────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: string;
}

export function Input({
  label,
  error,
  suffix,
  className = '',
  id,
  onKeyDown,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal
            placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20
            ${suffix ? 'pr-16' : ''} ${className}`}
          onKeyDown={(e) => {
            handleEnterKey(e);
            onKeyDown?.(e);
          }}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  options,
  className = '',
  id,
  onKeyDown,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal
          focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 ${className}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            focusNextInForm(e.currentTarget, e.shiftKey);
          }
          onKeyDown?.(e);
        }}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({
  label,
  className = '',
  id,
  onKeyDown,
  ...props
}: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-charcoal">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-charcoal
          placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20
          resize-none ${className}`}
        rows={3}
        onKeyDown={(e) => {
          // Ctrl+Enter = new line, Enter = next field, Shift+Enter = previous field
          if (e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            focusNextInForm(e.currentTarget, e.shiftKey);
          }
          onKeyDown?.(e);
        }}
        {...props}
      />
    </div>
  );
}

// ── SearchableSelect ──────────────────────────────────────────────────────────
// Full keyboard-first combobox.
//
// Focus flow:
//   Tab / Enter (on trigger, closed)  → opens dropdown, focuses search input
//   Type                              → filters list
//   ↑ / ↓                             → move highlight
//   Enter (on search input)           → select highlighted option
//                                       close dropdown
//                                       move focus to next form field
//   Escape                            → close dropdown, return focus to trigger
//   Tab (on search input)             → close dropdown, move focus naturally
//
// The trigger button carries data-trigger so focusNextInForm can locate it
// within the focusable sequence.

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  tabIndex?: number;
  /** Optional external ref forwarded to the trigger button (for programmatic focus) */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** When provided, renders an "＋ Add new…" row at the bottom of the dropdown */
  onAddNew?: () => void;
  /** Label for the add-new row — defaults to "Add new…" */
  addNewLabel?: string;
}

export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search or select...',
  disabled = false,
  error,
  tabIndex,
  triggerRef: externalTriggerRef,
  onAddNew,
  addNewLabel = 'Add new…',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? '';

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  // ── Helpers ──

  const openDropdown = useCallback(() => {
    setOpen(true);
    setHighlighted(0);
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  const closeDropdown = useCallback((returnFocus = true) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const confirmSelection = useCallback(
    (opt: SearchableSelectOption, reverse = false) => {
      onChange(opt.value);
      setOpen(false);
      setQuery('');
      // Move to next or previous field after selection
      if (triggerRef.current) {
        setTimeout(() => {
          if (triggerRef.current) focusNextInForm(triggerRef.current, reverse);
        }, 0);
      }
    },
    [onChange],
  );

  // ── Outside click ──
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // ── Scroll highlight into view ──
  useEffect(() => {
    const item = listRef.current?.children[highlighted] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  // ── Keyboard on TRIGGER button (dropdown closed) ──
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
    }
    // Tab / other keys: let browser handle naturally
  };

  // ── Keyboard on SEARCH input (dropdown open) ──
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Total navigable rows = filtered options + optional add-new row
    const totalRows = filtered.length + (onAddNew ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, totalRows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If the add-new row is highlighted (last row)
      if (onAddNew && highlighted === filtered.length) {
        closeDropdown(false);
        onAddNew();
      } else if (filtered[highlighted]) {
        confirmSelection(filtered[highlighted], e.shiftKey);
      }
    } else if (e.key === 'Escape') {
      closeDropdown(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-charcoal">{label}</label>
      )}

      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        data-trigger          // ← used by focusNextInForm
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => (open ? closeDropdown(false) : openDropdown())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors',
          disabled
            ? 'bg-surface text-muted cursor-not-allowed border-border'
            : 'bg-white border-border hover:border-brand focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20',
          open ? 'border-brand ring-2 ring-brand/20' : '',
          error ? 'border-red-400' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className={`truncate ${value ? 'text-charcoal' : 'text-muted'}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="text-muted hover:text-red-500 p-0.5 rounded"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* ── Hint shown below trigger when focused but not open ── */}
      {!open && !disabled && (
        <span className="text-[10px] text-muted leading-none hidden group-focus-within:block">
          Press Enter or Space to open
        </span>
      )}

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-white shadow-2xl">
          {/* Search row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={13} className="text-muted shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Type to search…"
              autoComplete="off"
              className="flex-1 text-sm outline-none bg-transparent text-charcoal placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={() => {
                  setQuery('');
                  setHighlighted(0);
                  searchRef.current?.focus();
                }}
              >
                <X size={13} className="text-muted hover:text-red-500" />
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="px-3 py-1 text-[10px] text-muted border-b border-border/50 flex gap-3">
            <span>↑↓ navigate</span>
            <span>Enter select</span>
            <span>Esc close</span>
          </div>

          {/* Options list */}
          <ul ref={listRef} role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !onAddNew ? (
              <li className="px-3 py-3 text-sm text-muted text-center">
                No results for "{query}"
              </li>
            ) : (
              <>
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted text-center">
                    No results for "{query}"
                  </li>
                )}
                {filtered.map((opt, i) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    onMouseDown={() => confirmSelection(opt)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={[
                      'px-3 py-2 text-sm cursor-pointer select-none transition-colors flex items-center gap-2',
                      i === highlighted
                        ? 'bg-brand text-white'
                        : 'text-charcoal hover:bg-surface',
                      opt.value === value ? 'font-semibold' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {opt.value === value && (
                      <span className="text-[10px]">✓</span>
                    )}
                    {opt.label}
                  </li>
                ))}
                {/* ── Add-new row ── */}
                {onAddNew && (
                  <li
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => { closeDropdown(false); onAddNew(); }}
                    onMouseEnter={() => setHighlighted(filtered.length)}
                    className={[
                      'px-3 py-2 text-sm cursor-pointer select-none transition-colors flex items-center gap-2 border-t border-border mt-1',
                      highlighted === filtered.length
                        ? 'bg-brand text-white'
                        : 'text-brand hover:bg-brand/5 font-medium',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className="text-base leading-none">＋</span>
                    {addNewLabel}
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchableMultiSelect  — like SearchableSelect but for multiple values
// ─────────────────────────────────────────────────────────────────────────────

interface SearchableMultiSelectProps {
  label?: string;
  values: string[];
  options: SearchableSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  tabIndex?: number;
  /** When provided, renders an "＋ Add new…" row at the bottom of the dropdown */
  onAddNew?: () => void;
  addNewLabel?: string;
  /** Custom render for a selected tag — receives option label */
  renderTag?: (label: string, value: string, onRemove: () => void) => unknown;
}

export function SearchableMultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = 'Search and select…',
  disabled = false,
  error,
  tabIndex,
  onAddNew,
  addNewLabel = 'Add new…',
}: SearchableMultiSelectProps) {
  const [open,        setOpen]        = useState(false);
  const [query,       setQuery]       = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLButtonElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);

  const selectedLabels = values
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as SearchableSelectOption[];

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const openDropdown = useCallback(() => {
    setOpen(true);
    setHighlighted(0);
    setTimeout(() => searchRef.current?.focus(), 10);
  }, []);

  const closeDropdown = useCallback((returnFocus = true) => {
    setOpen(false);
    setQuery('');
    if (returnFocus) setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const toggleOption = useCallback(
    (optValue: string) => {
      if (values.includes(optValue)) {
        onChange(values.filter((v) => v !== optValue));
      } else {
        onChange([...values, optValue]);
      }
    },
    [values, onChange],
  );

  // Outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Scroll highlight into view
  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalRows = filtered.length + (onAddNew ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, totalRows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (onAddNew && highlighted === filtered.length) {
        closeDropdown(false);
        onAddNew();
      } else if (filtered[highlighted]) {
        toggleOption(filtered[highlighted].value);
      }
    } else if (e.key === 'Escape') {
      closeDropdown(true);
    } else if (e.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-charcoal">{label}</label>}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        data-trigger
        disabled={disabled}
        tabIndex={tabIndex}
        onClick={() => (open ? closeDropdown(false) : openDropdown())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'w-full min-h-[38px] flex items-center flex-wrap gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-left transition-colors',
          disabled
            ? 'bg-surface text-muted cursor-not-allowed border-border'
            : 'bg-white border-border hover:border-brand focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20',
          open  ? 'border-brand ring-2 ring-brand/20' : '',
          error ? 'border-red-400' : '',
        ].filter(Boolean).join(' ')}
      >
        {selectedLabels.length === 0 ? (
          <span className="text-muted py-0.5">{placeholder}</span>
        ) : (
          selectedLabels.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 bg-brand/10 text-brand border border-brand/25 rounded-md px-2 py-0.5 text-xs font-medium"
            >
              {opt.label}
              <span
                role="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onChange(values.filter((v) => v !== opt.value));
                }}
                className="text-brand/60 hover:text-red-500 ml-0.5"
                aria-label={`Remove ${opt.label}`}
              >
                <X size={11} />
              </span>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0 pl-1">
          <ChevronDown
            size={14}
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-white shadow-2xl">
          {/* Search row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={13} className="text-muted shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
              onKeyDown={onSearchKeyDown}
              placeholder="Type to search…"
              autoComplete="off"
              className="flex-1 text-sm outline-none bg-transparent text-charcoal placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={() => { setQuery(''); setHighlighted(0); searchRef.current?.focus(); }}
              >
                <X size={13} className="text-muted hover:text-red-500" />
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="px-3 py-1 text-[10px] text-muted border-b border-border/50 flex gap-3">
            <span>↑↓ navigate</span>
            <span>Enter toggle</span>
            <span>Esc close</span>
          </div>

          {/* Options */}
          <ul ref={listRef} role="listbox" aria-multiselectable="true" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !onAddNew ? (
              <li className="px-3 py-3 text-sm text-muted text-center">No results for "{query}"</li>
            ) : (
              <>
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted text-center">No results for "{query}"</li>
                )}
                {filtered.map((opt, i) => {
                  const isSelected = values.includes(opt.value);
                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={() => toggleOption(opt.value)}
                      onMouseEnter={() => setHighlighted(i)}
                      className={[
                        'px-3 py-2 text-sm cursor-pointer select-none transition-colors flex items-center gap-2',
                        i === highlighted
                          ? 'bg-brand text-white'
                          : 'text-charcoal hover:bg-surface',
                      ].filter(Boolean).join(' ')}
                    >
                      {/* Checkbox indicator */}
                      <span className={[
                        'w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold transition-colors',
                        isSelected
                          ? (i === highlighted ? 'bg-white border-white text-brand' : 'bg-brand border-brand text-white')
                          : (i === highlighted ? 'border-white/60' : 'border-border'),
                      ].join(' ')}>
                        {isSelected && '✓'}
                      </span>
                      {opt.label}
                    </li>
                  );
                })}
                {onAddNew && (
                  <li
                    role="option"
                    aria-selected={false}
                    onMouseDown={() => { closeDropdown(false); onAddNew(); }}
                    onMouseEnter={() => setHighlighted(filtered.length)}
                    className={[
                      'px-3 py-2 text-sm cursor-pointer select-none transition-colors flex items-center gap-2 border-t border-border mt-1',
                      highlighted === filtered.length
                        ? 'bg-brand text-white'
                        : 'text-brand hover:bg-brand/5 font-medium',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="text-base leading-none">＋</span>
                    {addNewLabel}
                  </li>
                )}
              </>
            )}
          </ul>

          {/* Selection summary footer */}
          {values.length > 0 && (
            <div className="px-3 py-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-brand font-medium">
                {values.length} selected
              </span>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={() => { onChange([]); searchRef.current?.focus(); }}
                className="text-xs text-muted hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
