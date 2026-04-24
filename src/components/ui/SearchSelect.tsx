import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface SearchSelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  className = '',
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selected = options.find(o => o.value === value);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const updatePos = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Show above if not enough space below (threshold: 220px)
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(filtered.length * 40 + 8, 224);
    const top = spaceBelow < dropdownHeight && rect.top > dropdownHeight
      ? rect.top - dropdownHeight - 4
      : rect.bottom + 4;
    setDropdownStyle({
      position: 'fixed',
      top,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  };

  const handleFocus = () => {
    if (disabled) return;
    updatePos();
    setOpen(true);
    setQuery('');
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  // Close on click outside (both input and dropdown)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Reposition on scroll/resize and close on Escape
  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const displayValue = open ? query : (selected?.label ?? '');

  const baseInput = [
    'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    'dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    error ? 'border-red-300' : 'border-gray-300',
  ].join(' ');

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
    >
      {filtered.length === 0 ? (
        <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Sin resultados</p>
      ) : (
        filtered.map(opt => (
          <button
            key={opt.value}
            type="button"
            onPointerDown={e => e.preventDefault()}
            onClick={() => handleSelect(opt.value)}
            className={[
              'w-full text-left px-3 py-2.5 text-sm cursor-pointer',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              opt.value === value
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                : 'text-gray-700 dark:text-gray-300',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))
      )}
    </div>
  ) : null;

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        placeholder={placeholder}
        onChange={e => setQuery(e.target.value)}
        onFocus={handleFocus}
        className={baseInput}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
