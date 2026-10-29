const invalid = message => Object.assign(new Error(message), { status: 400 });

export function selectCustomization(groups, rawChoices = {}) {
  if (!rawChoices || typeof rawChoices !== 'object' || Array.isArray(rawChoices)) throw invalid('Personalización inválida.');
  if (Object.keys(rawChoices).some(key => !groups.some(group => group.id === key))) throw invalid('Personalización inválida.');

  return groups.flatMap(group => {
    if (!['single', 'multiple'].includes(group.selectionType)) throw new Error(`Tipo de selección no configurado: ${group.id}`);
    if (group.selectionType === 'multiple' && group.maxSelections !== null && (!Number.isInteger(group.maxSelections) || group.maxSelections < 1)) throw new Error(`Límite de selección no configurado: ${group.id}`);
    const value = rawChoices[group.id];
    const selected = value === undefined ? [] : typeof value === 'string' ? [value] : value;
    if (!Array.isArray(selected) || selected.some(id => typeof id !== 'string') || new Set(selected).size !== selected.length) throw invalid(`Revisa las opciones de ${group.title.toLowerCase()}.`);
    if (group.required && selected.length === 0) throw invalid(`Selecciona ${group.title.toLowerCase()}.`);
    if (group.selectionType === 'single' && selected.length > 1) throw invalid(`Elige solo una opción de ${group.title.toLowerCase()}.`);
    if (group.selectionType === 'multiple' && group.maxSelections !== null && selected.length > group.maxSelections) throw invalid(`Elige hasta ${group.maxSelections} opciones de ${group.title.toLowerCase()}.`);
    if (selected.some(id => !group.choices.some(choice => choice.id === id))) throw invalid(`Revisa las opciones de ${group.title.toLowerCase()}.`);
    return group.choices.filter(choice => selected.includes(choice.id)).map(choice => ({ groupId: group.id, title: group.title, choiceId: choice.id, label: choice.label, priceSoles: choice.priceSoles }));
  });
}

export function normalizeComment(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw invalid('El comentario no es válido.');
  const comment = value.trim().replace(/\s+/g, ' ');
  if (comment.length > 200 || /[\u0000-\u001f\u007f]/.test(comment)) throw invalid('El comentario debe tener hasta 200 caracteres.');
  return comment;
}
