import { useMemo, useState } from 'react';
import { suggest } from '../lib/text';

// Champ de saisie qui propose, pendant la frappe, les valeurs déjà connues
// (« pri » → « Prise 2P+T »). Un clic ou Entrée reprend la proposition.
export default function SuggestInput({ value, onChange, options, className = 'input', max = 8, ...props }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useMemo(() => (open ? suggest(options, value, max) : []), [open, options, value, max]);

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape') {
      // Échap ferme seulement la liste, pas la fenêtre
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        {...props}
        className={className}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={items.length > 0}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {items.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
          {items.map((it, i) => (
            <li
              key={it}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); pick(it); }}
              className={`cursor-pointer px-3.5 py-2.5 text-sm font-medium ${
                i === active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
