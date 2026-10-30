// Shared by Home and My Calls. Exact call data always takes precedence over
// legacy descriptions; a REVIEW call must never become a personal invitation.
function norm(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function canonicalPersonId(value = '') {
  return String(value).trim().toLowerCase().replace(/^p[-_]/, '').replace(/[_\s]+/g, '-');
}

export function samePersonId(a = '', b = '') {
  const id = canonicalPersonId(a);
  return !!id && id === canonicalPersonId(b);
}

export function findPerson(people, id) {
  if (!id) return null;
  return people.find(person => samePersonId(person.id, id) ||
    (person.legacyIds || []).some(legacy => samePersonId(legacy, id))) || null;
}

function groupLabels(values) {
  return (Array.isArray(values) ? values : []).map(value =>
    typeof value === 'object' && value
      ? String(value.name || value.label || value.title || value.id || '').trim()
      : String(value || '').trim()).filter(Boolean);
}

export function personMatchesCall(person, call) {
  if (!person) return true;
  const hasExact = Number(call.callDataVersion) === 3 ||
    Object.prototype.hasOwnProperty.call(call, 'exactCallStatus') ||
    Array.isArray(call.calledPeopleIds) || Array.isArray(call.calledGroups);
  if (hasExact) {
    if (String(call.exactCallStatus || '').trim().toUpperCase() !== 'READY') return false;
    if ((Array.isArray(call.calledPeopleIds) ? call.calledPeopleIds : []).some(id => samePersonId(id, person.id))) return true;
    const nameKey = value => norm(value).replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
    const personName = nameKey(person.name || person.displayName || '');
    if (personName && (Array.isArray(call.calledPeople) ? call.calledPeople : []).some(value => {
      const name = value && typeof value === 'object'
        ? value.displayName || value.name || value.id || '' : value;
      return nameKey(name) === personName;
    })) return true;
    const groups = new Set(groupLabels(call.calledGroups).map(norm));
    return groups.has(norm('Full Company')) || (person.groups || []).some(group => groups.has(norm(group)));
  }
  const fullName = String(person.name || '').toLowerCase();
  if (fullName && String(call.called || '').toLowerCase().includes(fullName)) return true;
  const groups = groupLabels(call.callGroups);
  if (groups.includes('Full Company')) return true;
  const safe = new Set(['Dancers', 'Children/Youth', 'Choir/Vocalists', 'Crew/Tech']);
  return (person.groups || []).some(group => safe.has(group) && groups.includes(group));
}

export function upcomingPublishedCalls(calls, now = new Date()) {
  return (Array.isArray(calls) ? calls : []).filter(call => {
    const status = String(call.status || '').trim().toUpperCase();
    return call.start && call.end && call.title &&
      !['NO REHEARSAL', 'CANCELLED', 'CANCELED'].includes(status) &&
      !/NO REHEARSAL/i.test(call.title) &&
      Number.isFinite(Date.parse(call.start)) && Date.parse(call.end) >= now.getTime();
  }).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export function callAnchor(call) {
  return 'call-' + String(call.eventKey || call.id || '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function personalCallSummary(person, call) {
  const valueFor = values => Object.entries(values || {}).find(([id]) => samePersonId(id, person.id))?.[1] || '';
  if (call.showDay) {
    const crew = (person.groups || []).some(group => norm(group) === norm('Crew/Tech'));
    return { report: crew ? call.showDay.crewCall : call.showDay.companyCall,
      through: '', showtime: call.showDay.showtime, tentativeEnd: call.showDay.tentativeEnd };
  }
  return { report: valueFor(call.personalCallTimes), through: valueFor(call.personalCallEndTimes) };
}

export function callPublicationStatus(call) {
  const event = String(call.status || '').trim().toUpperCase();
  const assignments = String(call.exactCallStatus || '').trim().toUpperCase();
  const eventLabel = event === 'CONFIRMED' ? 'Event confirmed'
    : ['PENDING', 'TENTATIVE'].includes(event) ? 'Event awaiting confirmation'
    : ['CANCELLED', 'CANCELED'].includes(event) ? 'Event cancelled'
    : event === 'NO REHEARSAL' ? 'No rehearsal' : 'Check event instructions';
  const personalLabel = assignments === 'READY' ? 'Personal assignments published'
    : assignments === 'REVIEW' ? 'Personal assignments under review'
    : assignments === 'PENDING' ? 'Personal assignments pending'
    : assignments === 'HOLD' ? 'Personal assignments on hold'
    : 'Personal assignments: check instructions';
  return { eventLabel, personalLabel, pending: assignments !== 'READY' };
}
