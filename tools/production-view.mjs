export function easternDay(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function productionView(plan, now = new Date()) {
  const today = easternDay(now);
  const weekEnd = new Date(Date.parse(today + 'T12:00:00Z') + 6 * 86400000).toISOString().slice(0, 10);
  const sessions = (plan.schedule || []).filter(row => row.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const fittings = (plan.fittings || []).filter(row => !row.buffer);
  const datedNote = String(plan.summary || '').match(/STATUS\s*[—–-]\s*([A-Z]+\s+\d{1,2},\s+\d{4})/i)?.[1];
  const parsedNote = datedNote ? Date.parse(datedNote + ' 12:00:00 UTC') : NaN;
  const noteDate = Number.isFinite(parsedNote) ? new Date(parsedNote).toISOString().slice(0, 10) : null;
  return {
    today, weekEnd, sessions,
    thisWeek: sessions.filter(row => row.date <= weekEnd),
    upcomingFittings: fittings.filter(row => row.date >= today),
    pastFittings: fittings.filter(row => row.date < today),
    upcomingMilestones: (plan.milestones || []).filter(row => row.date >= today),
    pastMilestones: (plan.milestones || []).filter(row => row.date < today),
    noteDate,
    noteNeedsReview: !noteDate || Date.parse(today) - Date.parse(noteDate) > 7 * 86400000,
  };
}

export function planningStatus(row) {
  const text = `${row.time || ''} ${row.phase || ''}`;
  if (/NO CALL|THANKSGIVING/i.test(text)) return 'No call';
  if (/HOLD|NOT SCHEDULED/i.test(text)) return 'On hold';
  if (/REVIEW|pending|TBD|verify/i.test(text)) return 'Review required';
  return 'Planning window';
}
