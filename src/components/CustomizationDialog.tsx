import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, X } from 'lucide-react';
import { Button } from './ui';
import { BrandCalendarIcon, BrandClockIcon, BrandDishIcon } from './BrandIcons';
import { bookingDeadlineLabel, dateLabel, money, optionRules, pickupWindow, type CustomizationGroup, type Offering, type SelectedChoices } from '../data/catalog';

export type PreviewPlate = Pick<Offering, 'name' | 'kitchenName' | 'imageUrl' | 'imageAlt' | 'priceSoles' | 'customization'>;
type Props = { offer: Offering | PreviewPlate; onClose: () => void; preview?: boolean; onAdd?: (offer: Offering, choices: SelectedChoices, comment: string) => void };

const capitalizeFirst = (value: string) => value.charAt(0).toLocaleUpperCase('es') + value.slice(1);
function optionHint(group: CustomizationGroup) {
  const { selectionType, maxSelections } = optionRules(group);
  if (selectionType === 'single') return group.required ? 'Elige una opción' : 'Opcional · una opción';
  if (maxSelections !== null) return group.required ? `Elige de 1 a ${maxSelections}` : `Opcional · hasta ${maxSelections}`;
  return group.required ? 'Elige al menos una' : 'Opcional · elige las que quieras';
}

export function CustomizationDialog({ offer, onClose, onAdd, preview = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [choices, setChoices] = useState<SelectedChoices>({});
  const [comment, setComment] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, []);
  const valid = offer.customization.every(group => {
    const count = choices[group.id]?.length || 0;
    const { maxSelections } = optionRules(group);
    return (!group.required || count > 0) && (maxSelections === null || count <= maxSelections);
  });
  const price = offer.priceSoles + offer.customization.reduce((extra, group) => extra + group.choices.reduce((sum, choice) => sum + (choices[group.id]?.includes(choice.id) ? choice.priceSoles : 0), 0), 0);
  const actualOffer = 'bookable' in offer ? offer : null;
  const remaining = actualOffer?.remaining ?? 0;
  const pickup = actualOffer ? `${capitalizeFirst(dateLabel(actualOffer.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${pickupWindow(actualOffer.deliveryTime, actualOffer.pickupUntil)}` : '';
  return createPortal(<dialog ref={ref} className="custom-dialog" aria-labelledby="dish-dialog-title" onClose={onClose}><div className="dialog-scroll">
    <div className="dialog-header"><div><span className="eyebrow">{preview ? 'VISTA PARA ESTUDIANTES' : 'TU PEDIDO'}</span><h2 id="dish-dialog-title">{offer.customization.length ? 'Personaliza tu plato' : 'Confirma tu plato'}</h2></div><button ref={closeRef} type="button" className="icon-button" onClick={() => ref.current?.close()} aria-label="Cerrar"><X size={21} /></button></div>
    <div className="dialog-dish">{offer.imageUrl ? <img src={offer.imageUrl} alt={offer.imageAlt} /> : <div className="dialog-dish-placeholder"><BrandDishIcon size={34} /><span>Foto del plato</span></div>}<div><h3>{offer.name || 'Nombre del plato'}</h3><p>{offer.kitchenName}</p>{actualOffer && !preview ? <div className="dialog-pickup"><div><BrandClockIcon size={17} /><span>Reserva hasta: {capitalizeFirst(bookingDeadlineLabel(actualOffer.bookingDeadline))}</span></div><div><BrandCalendarIcon size={17} /><span>Recojo: {pickup}</span></div></div> : <small className="dialog-preview-note">Los horarios aparecerán al publicarlo en Menús.</small>}</div></div>
    <form id="dish-customization-form" onSubmit={event => { event.preventDefault(); if (!preview && valid && actualOffer?.bookable) onAdd?.(actualOffer, choices, comment); }}>
      {offer.customization.map(group => {
        const selected = choices[group.id] || [];
        const { selectionType, maxSelections } = optionRules(group);
        const atLimit = selectionType === 'multiple' && maxSelections !== null && selected.length >= maxSelections;
        return <div className="option-group" role="group" aria-labelledby={`option-title-${group.id}`} key={group.id}>
          <div className="option-group-head"><h3 id={`option-title-${group.id}`}>{group.title || 'Grupo de opciones'}</h3><span>{optionHint(group)}</span></div>
          <div className="option-list">{group.choices.map(choice => {
            const checked = selected.includes(choice.id);
            return <label className="option" key={choice.id}><input type={selectionType === 'single' ? 'radio' : 'checkbox'} name={group.id} value={choice.id} checked={checked} disabled={atLimit && !checked} onChange={() => setChoices(current => { const active = current[group.id] || []; return { ...current, [group.id]: selectionType === 'single' ? [choice.id] : active.includes(choice.id) ? active.filter(id => id !== choice.id) : [...active, choice.id] }; })} /><span>{choice.label || 'Opción sin nombre'}</span>{choice.priceSoles > 0 && <small>+{money(choice.priceSoles)}</small>}</label>;
          })}</div>
          {selectionType === 'single' && !group.required && selected.length > 0 && <button type="button" className="option-clear" onClick={() => setChoices(current => ({ ...current, [group.id]: [] }))}>Quitar selección</button>}
          {selectionType === 'multiple' && maxSelections !== null && <p className="option-count">{selected.length} de {maxSelections} seleccionadas</p>}
        </div>;
      })}
      <label className="dish-comment"><span>Comentario adicional <small>Opcional</small></span><textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={200} rows={2} placeholder="Por ejemplo: sin cebolla" /><small>{comment.length}/200 caracteres</small></label>
      {!preview && !actualOffer?.bookable && <p className="form-error" role="status">El plazo de reserva terminó o se agotaron las porciones.</p>}
    </form>
  </div><div className="dialog-actions"><div className="dialog-total"><span>Total del plato</span><strong>{money(price)}</strong></div>{preview ? <div className="dialog-confirm"><span className="dialog-preview-status">Vista previa · no se añadirá al carrito</span><Button type="button" onClick={() => ref.current?.close()}>Cerrar vista previa</Button></div> : <div className="dialog-confirm"><span className={`dialog-remaining${remaining <= 3 ? ' dialog-remaining-low' : ''}`} role="status">{remaining === 0 ? 'Sin reservas disponibles' : `${remaining} ${remaining === 1 ? 'reserva disponible' : 'reservas disponibles'}`}</span><Button type="submit" form="dish-customization-form" disabled={!valid || !actualOffer?.bookable || remaining <= 0}>Confirmar <ArrowRight size={18} /></Button></div>}</div></dialog>, document.body);
}
