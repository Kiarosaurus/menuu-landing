import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const weekdays = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const iso = (year: number, month: number, day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const parse = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) } : null;
};
export const birthDateDisplay = (value: string) => {
  const selected = parse(value);
  return selected ? `${String(selected.day).padStart(2, '0')} ${months[selected.month].slice(0, 3)} ${selected.year}` : '';
};

export function BirthDatePicker({ value, onChange, maxDate }: { value: string; onChange: (value: string) => void; maxDate: string }) {
  const id = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = parse(value);
  const max = parse(maxDate)!;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months' | 'years'>('years');
  const [year, setYear] = useState(selected?.year ?? max.year - 20);
  const [month, setMonth] = useState(selected?.month ?? 0);
  const [openUp, setOpenUp] = useState(false);
  const yearPage = Math.floor(year / 12) * 12;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!fieldRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    setYear(selected?.year ?? max.year - 20);
    setMonth(selected?.month ?? 0);
    setView(selected ? 'days' : 'years');
    const bounds = fieldRef.current?.getBoundingClientRect();
    setOpenUp(!!bounds && window.innerHeight - bounds.bottom < 350 && bounds.top > 350);
    setOpen(true);
  };
  const changePage = (direction: -1 | 1) => {
    if (view === 'years') setYear(current => Math.min(max.year, Math.max(1900, current + direction * 12)));
    else if (view === 'months') setYear(current => Math.min(max.year, Math.max(1900, current + direction)));
    else {
      const date = new Date(year, month + direction, 1);
      if (date.getFullYear() >= 1900 && iso(date.getFullYear(), date.getMonth(), 1) <= maxDate) { setYear(date.getFullYear()); setMonth(date.getMonth()); }
    }
  };
  const previousDisabled = view === 'years' ? yearPage <= 1900 : view === 'months' ? year <= 1900 : year === 1900 && month === 0;
  const nextDisabled = view === 'years' ? yearPage + 12 > max.year : view === 'months' ? year >= max.year : year === max.year && month >= max.month;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  return <div className="birth-date-field" ref={fieldRef} onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } }}>
    <span className="account-field-label" id={`${id}-label`}>Fecha de nacimiento <span className="account-optional">Opcional</span></span>
    <div className="birth-date-control"><button ref={triggerRef} type="button" className={`birth-date-trigger${value ? ' has-value' : ''}`} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined} onClick={toggle}><span id={`${id}-value`}>{birthDateDisplay(value) || 'Selecciona tu fecha'}</span><CalendarDays size={19} aria-hidden="true" /></button>{value && <button type="button" className="birth-date-clear" aria-label="Quitar fecha de nacimiento" onClick={() => { onChange(''); setOpen(false); triggerRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}</div>
    {open && <div className={`birth-date-popover${openUp ? ' open-up' : ''}`} id={`${id}-calendar`} role="dialog" aria-label="Elegir fecha de nacimiento">
      <div className="birth-date-head"><button type="button" className="birth-date-nav" aria-label={view === 'years' ? 'Doce años anteriores' : view === 'months' ? 'Año anterior' : 'Mes anterior'} onClick={() => changePage(-1)} disabled={previousDisabled}><ChevronLeft size={19} /></button><div className="birth-date-title">{view === 'years' ? <span>{yearPage}–{Math.min(yearPage + 11, max.year)}</span> : view === 'months' ? <button type="button" onClick={() => setView('years')}>{year}</button> : <><button type="button" onClick={() => setView('months')}>{months[month]}</button><button type="button" onClick={() => setView('years')}>{year}</button></>}</div><button type="button" className="birth-date-nav" aria-label={view === 'years' ? 'Doce años siguientes' : view === 'months' ? 'Año siguiente' : 'Mes siguiente'} onClick={() => changePage(1)} disabled={nextDisabled}><ChevronRight size={19} /></button></div>
      {view === 'years' && <div className="birth-date-years">{Array.from({ length: 12 }, (_, index) => yearPage + index).map(item => <button key={item} type="button" className={item === selected?.year ? 'selected' : ''} disabled={item < 1900 || item > max.year} onClick={() => { setYear(item); setView('months'); }}>{item}</button>)}</div>}
      {view === 'months' && <div className="birth-date-months">{months.map((item, index) => <button key={item} type="button" className={year === selected?.year && index === selected.month ? 'selected' : ''} disabled={year === max.year && index > max.month} onClick={() => { setMonth(index); setView('days'); }}>{item}</button>)}</div>}
      {view === 'days' && <><div className="birth-date-weekdays" aria-hidden="true">{weekdays.map(item => <span key={item}>{item}</span>)}</div><div className="birth-date-days">{Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}{Array.from({ length: dayCount }, (_, index) => { const day = index + 1; const date = iso(year, month, day); return <button key={day} type="button" className={date === value ? 'selected' : ''} disabled={date > maxDate} aria-label={`${day} de ${months[month]} de ${year}`} aria-pressed={date === value} onClick={() => { onChange(date); setOpen(false); triggerRef.current?.focus(); }}>{day}</button>; })}</div></>}
    </div>}
  </div>;
}
