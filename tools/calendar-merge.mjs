import { createHash } from 'node:crypto';

const SOURCE_EXCLUDED_FIELDS = new Set([
  'id', 'eventKey', 'callDataVersion', 'personalCallTimes',
  'personalCallEndTimes', 'showDay'
]);
const CALL_FIELDS = new Set(['called', 'calledPeople', 'calledPeopleIds', 'calledGroups', 'exactCallStatus']);
const WINDOW_DEPENDENCIES = new Set([...CALL_FIELDS, 'start', 'end']);

function canonical(value, field) {
  if (field === 'start' || field === 'end') {
    if (value == null) return null;
    const sheetTime = typeof value === 'string' && value.match(
      /^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/
    );
    if (sheetTime) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months.indexOf(sheetTime[1]) + 1;
      let hour = Number(sheetTime[4]) % 12;
      if (sheetTime[6] === 'PM') hour += 12;
      return `${sheetTime[3]}-${String(month).padStart(2, '0')}-${sheetTime[2].padStart(2, '0')} ${String(hour).padStart(2, '0')}:${sheetTime[5]}`;
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      // Both the Sheet feed and a reviewed ISO offset describe local wall
      // time. Date.parse of the feed runs in UTC in Actions; keep those visible
      // clock fields instead of comparing absolute instants.
      if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) {
        return value.slice(0, 16).replace('T', ' ');
      }
      return date.toISOString().slice(0, 16).replace('T', ' ');
    }
  }
  if (Array.isArray(value) && ['calledPeople', 'calledPeopleIds', 'calledGroups'].includes(field)) {
    return [...new Set(value.map(item => String(item).trim()))].sort();
  }
  if (Array.isArray(value)) return value.map(item => canonical(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
  }
  return value ?? null;
}

function digest(value, field) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value, field)))
    .digest('hex');
}

function sourceFields(record) {
  return Object.keys(record).filter(key => !SOURCE_EXCLUDED_FIELDS.has(key));
}

export function createCalendarBaseline(rehearsals) {
  return {
    schemaVersion: 1,
    events: Object.fromEntries(rehearsals.map(record => [
      record.id,
      Object.fromEntries(sourceFields(record).map(field => [
        field, digest(record[field], field)
      ]))
    ]))
  };
}

export function mergeCalendarRehearsals(incoming, published, baseline) {
  if (baseline?.schemaVersion !== 1 || !baseline.events) {
    throw new Error('Calendar source baseline is missing or invalid. Seed it from the reviewed feed first.');
  }

  const publishedById = new Map(published.map(record => [record.id, record]));
  const incomingById = new Map(incoming.map(record => [record.id, record]));
  const errors = [];
  const changes = [];

  for (const id of Object.keys(baseline.events)) {
    if (!incomingById.has(id)) errors.push(`${id}: disappeared from the Master Calendar feed; review before removal.`);
  }
  for (const id of publishedById.keys()) {
    if (!incomingById.has(id)) errors.push(`${id}: published event missing from feed; preserving it.`);
  }

  const merged = incoming.map(source => {
    const prior = publishedById.get(source.id);
    const before = baseline.events[source.id];
    if (!prior || !before) {
      if (prior || before) {
        errors.push(`${source.id}: baseline/published event mismatch; review this event.`);
        return prior || source;
      }
      if (source.exactCallStatus === 'READY' &&
          !source.calledPeopleIds?.length && !source.calledGroups?.length) {
        errors.push(`${source.id}: new READY event has no exact call targets.`);
      }
      changes.push({ id: source.id, fields: ['NEW'] });
      return source;
    }

    const next = { ...prior };
    const changedFields = [];
    const fields = new Set([...Object.keys(before), ...sourceFields(source)]);
    const callChanged = [...CALL_FIELDS].some(field =>
      before[field] && before[field] !== digest(source[field], field)
    );
    for (const field of fields) {
      const originalHash = before[field] ?? digest(undefined, field);
      const newHash = digest(source[field], field);
      if (originalHash === newHash) continue;

      const publishedHash = digest(prior[field], field);
      if (publishedHash !== originalHash && publishedHash !== newHash) {
        errors.push(`${source.id}: Master Calendar changed ${field}, which has a reviewed Hub override.`);
        continue;
      }
      if (WINDOW_DEPENDENCIES.has(field) && (prior.personalCallTimes || prior.personalCallEndTimes)) {
        if (publishedHash !== newHash) {
          errors.push(`${source.id}: ${field} changed; personal report/release times need review.`);
          continue;
        }
      }
      if (newHash !== publishedHash) {
        if (source[field] === undefined) delete next[field];
        else next[field] = source[field];
        changedFields.push(field);
      }
    }

    // A reviewed personal window is valid only for the same exact targets
    // and human-readable call. The source has no personal time fields.
    if (callChanged && (prior.personalCallTimes || prior.personalCallEndTimes)) {
      for (const field of ['called', 'calledPeopleIds', 'calledGroups']) {
        if (digest(next[field], field) !== digest(prior[field], field)) {
          errors.push(`${source.id}: ${field} changed while personal windows are present.`);
        }
      }
    }
    if (changedFields.length) changes.push({ id: source.id, fields: changedFields });
    return next;
  });

  if (errors.length) {
    throw new Error('Calendar merge blocked:\n' + [...new Set(errors)].join('\n'));
  }
  return { rehearsals: merged, baseline: createCalendarBaseline(incoming), changes };
}
