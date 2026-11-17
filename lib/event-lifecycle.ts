/** Event schedules use India time, independent of the server or browser timezone. */
export function eventHasEnded(event: { date: string; time?: string | null }, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return false;
  const match = (event.time || '23:59:59').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return false;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (match[4]) {
    if (hours < 1 || hours > 12) return false;
    hours = hours % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return false;
  const stamp = Date.parse(event.date + 'T' + String(hours).padStart(2, '0') + ':' + match[2] + ':' + String(seconds).padStart(2, '0') + '+05:30');
  return Number.isFinite(stamp) && stamp <= now;
}

export function isCompletedEvent(event: { status: string; date: string; time?: string | null }, now = Date.now()): boolean {
  return event.status === 'completed' || eventHasEnded(event, now);
}
