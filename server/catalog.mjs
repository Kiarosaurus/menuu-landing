function limaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekStart(now = new Date()) {
  const today = limaDate(now);
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -(day === 0 ? 6 : day - 1));
}

export function deliveryMoment(date, time) {
  return new Date(`${date}T${time}:00-05:00`);
}
