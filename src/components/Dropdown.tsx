import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

export interface DropdownOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  variant: 'header' | 'field';
  ariaLabel: string;
  className?: string;
}

const ESTIMATED_PANEL_HEIGHT = 280;

const ChevronIcon = ({ className }: { className: string }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export const Dropdown = ({ value, options, onChange, variant, ariaLabel, className }: Props) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((option) => option.value === value);

  const requestClose = () => {
    if (!open) return;
    setClosing(true);
  };

  const selectOption = (option: DropdownOption) => {
    onChange(option.value);
    requestClose();
  };

  const handleToggle = () => {
    if (open) {
      requestClose();
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < ESTIMATED_PANEL_HEIGHT && rect.top > spaceBelow);
    }
    setHighlightedIndex(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        requestClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.min(index + 1, options.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const option = options[highlightedIndex];
        if (option) selectOption(option);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlightedIndex, options]);

  if (isMobile) {
    if (variant === 'header') {
      return (
        <label className="relative block leading-tight">
          <span className="pointer-events-none flex items-center gap-1 pr-5 text-sm font-medium leading-tight text-ink">
            {selected?.label}
            <ChevronIcon className="h-3 w-3 text-ink/70" />
          </span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={ariaLabel}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {variant === 'header' ? (
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="flex cursor-pointer items-center gap-1 text-sm font-medium leading-tight text-ink"
        >
          {selected?.label}
          <ChevronIcon className={`h-3 w-3 text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          ref={triggerRef}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left`}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronIcon className={`h-3 w-3 flex-shrink-0 text-ink/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}

      {open && (
        <ul
          role="listbox"
          onAnimationEnd={() => {
            if (closing) {
              setOpen(false);
              setClosing(false);
            }
          }}
          className={`absolute z-40 left-0 max-h-64 min-w-full max-w-xs origin-top overflow-y-auto rounded-2xl border border-ink/10 bg-paper shadow-soft ${
            openUpward ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1'
          } ${closing ? 'animate-dropdown-out' : 'animate-dropdown-in'}`}
        >
          {options.map((option, index) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  option.value === value ? 'font-medium text-ink' : 'text-muted'
                } ${index === highlightedIndex ? 'bg-canvas' : 'hover:bg-canvas'}`}
              >
                {option.value === value && <span aria-hidden="true">✓</span>}
                <span className="truncate">{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
