export function formatDate(value) {
  if (!value) return '—';
  const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function isSameDay(left, right) {
  const a = new Date(left);
  const b = new Date(right);
  return a.toDateString() === b.toDateString();
}

export function daysUntil(dateInput) {
  const today = new Date();
  const date = new Date(dateInput);
  const diff = date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.round(diff / (1000 * 60 * 60 * 24));
}
