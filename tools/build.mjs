// tools/build.mjs
// CHOSEN 2026 Company Hub build
//
// Purpose:
// - Treat data/rehearsals.json as the published-only Hub / Exact Calls rehearsal feed.
// - Normalize every valid rehearsal record into one canonical published schedule array.
// - Build Home, This Week, Schedule / All Calls, and My Calls source data from that same array.
// - Preserve Exact Calls V1.1 fields for app.js personalization.
// - Fail loudly if source rehearsal data exists but generated Hub schedule data becomes empty.
//
// Do not add a second publication interpretation here. If a rehearsal reached
// data/rehearsals.json from the Hub feed, it is already intended for Hub publication.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TZ = 'America/New_York';
const NOW = new Date();

const INPUTS = {
  site: 'data/site.json',
  rehearsals: 'data/rehearsals.json',
  scripts: 'data/scripts.json',
  music: 'data/music.json',
};

const OUTPUTS = [
  'content.json',
  'data/content.json',
];

function abs(relPath) {
  return path.join(ROOT, relPath);
}

function read(relPath, fallback = null) {
  const file = abs(relPath);

  if (!fs.existsSync(file)) {
    console.warn(`⚠️ Missing optional input: ${relPath}`);
    return fallback;
  }

  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to read/parse ${relPath}: ${err.message}`);
  }
}

function write(relPath, data) {
  const file = abs(relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`✅ Wrote ${relPath}`);
}

function fail(message, details = null) {
  if (details) console.error(details);
  throw new Error(message);
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === 'object' && !(value instanceof Date)) {
      if (Object.keys(value).length) return value;
      continue;
    }
    const text = normalizeText(value);
    if (text) return value;
  }
  return '';
}

function boolish(value) {
  if (value === true) return true;
  if (value === false) return false;

  const text = normalizeText(value).toLowerCase();
  if (!text) return null;

  if (['true', 'yes', 'y', '1', 'publish', 'published', 'current', 'approved'].includes(text)) {
    return true;
  }

  if (['false', 'no', 'n', '0', 'draft', 'hidden', 'private', 'archive', 'archived'].includes(text)) {
    return false;
  }

  return null;
}

function normalizeList(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap(item => normalizeList(item))
      .map(item => normalizeText(item))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  if (typeof value === 'object') {
    if ('displayName' in value) return normalizeList(value.displayName);
    if ('name' in value) return normalizeList(value.name);
    if ('id' in value) return normalizeList(value.id);
    return [];
  }

  return String(value)
    .split(/\r?\n|;|\|/)
    .flatMap(part => part.includes(',') ? part.split(',') : part)
    .map(item => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function normalizePeopleList(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map(person => {
        if (person === null || person === undefined) return null;

        if (typeof person === 'object') {
          const id = normalizeText(firstNonEmpty(
            person.id,
            person.personId,
            person.personID,
            person['Person ID']
          ));

          const displayName = normalizeText(firstNonEmpty(
            person.displayName,
            person.name,
            person['Display Name'],
            person.label
          ));

          if (!id && !displayName) return null;

          return {
            ...person,
            ...(id ? { id } : {}),
            ...(displayName ? { displayName } : {}),
          };
        }

        const displayName = normalizeText(person);
        return displayName ? { displayName } : null;
      })
      .filter(Boolean);
  }

  return normalizeList(value).map(displayName => ({ displayName }));
}

function compactObject(obj) {
  const out = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    out[key] = value;
  }

  return out;
}

function getField(record, ...names) {
  if (!record || typeof record !== 'object') return '';

  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      const value = record[name];
      if (value !== null && value !== undefined && normalizeText(value) !== '') {
        return value;
      }
    }
  }

  return '';
}

function getZonedParts(date, timeZone = TZ) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedTimeToUtc({ year, month, day, hour = 0, minute = 0, second = 0 }, timeZone = TZ) {
  // Convert an America/New_York wall-clock time into the real UTC instant.
  //
  // Example:
  //   Authored rehearsal time: 2026-09-05 10:00 AM in Sunrise, FL
  //   Correct UTC instant:     2026-09-05T14:00:00.000Z
  //
  // Important: Google Sheets / Apps Script feeds can serialize local sheet times
  // as if the local wall-clock value were UTC, such as "2026-09-05T10:00:00.000Z".
  // For CHOSEN, those visible Y-M-D H:M values are the source of truth.
  //
  // This loop adjusts the instant until formatting that instant in New York
  // matches the desired local wall-clock fields.
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let instant = new Date(desiredAsUtc);

  for (let i = 0; i < 4; i += 1) {
    const rendered = getZonedParts(instant, timeZone);

    if (!rendered) return new Date(Number.NaN);

    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second
    );

    const diff = renderedAsUtc - desiredAsUtc;

    if (diff === 0) {
      return instant;
    }

    instant = new Date(instant.getTime() - diff);
  }

  return instant;
}

function parseDateValue(value, options = {}) {
  const { defaultToEndOfDay = false } = options;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return zonedTimeToUtc({
      year: Number(y),
      month: Number(m),
      day: Number(d),
      hour: defaultToEndOfDay ? 23 : 0,
      minute: defaultToEndOfDay ? 59 : 0,
      second: defaultToEndOfDay ? 59 : 0,
    });
  }

  const isoDateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i
  );
  if (isoDateTime) {
    const [, y, m, d, hh, mm, ss] = isoDateTime;

    // Google Sheets / Apps Script often serializes a local spreadsheet time like
    // "Saturday 10:00 AM in Sunrise, FL" as "2026-09-05T10:00:00.000Z".
    // For this Hub, rehearsal times are authored as America/New_York wall-clock
    // times. Treat the visible Y-M-D H:M fields as the rehearsal's local time,
    // then convert that wall-clock time to a real UTC instant for sorting and
    // display. This prevents the Hub from showing 10:00 AM as 6:00 AM.
    return zonedTimeToUtc({
      year: Number(y),
      month: Number(m),
      day: Number(d),
      hour: Number(hh),
      minute: Number(mm),
      second: Number(ss || 0),
    });
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (hasTimezone) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?)?$/);
  if (us) {
    const [, m, d, y, rawHour, rawMinute, ampm] = us;
    let hour = rawHour ? Number(rawHour) : defaultToEndOfDay ? 23 : 0;
    const minute = rawMinute ? Number(rawMinute) : defaultToEndOfDay ? 59 : 0;

    if (ampm) {
      const marker = ampm.toLowerCase();
      if (marker === 'pm' && hour < 12) hour += 12;
      if (marker === 'am' && hour === 12) hour = 0;
    }

    return zonedTimeToUtc({
      year: Number(y),
      month: Number(m),
      day: Number(d),
      hour,
      minute,
      second: defaultToEndOfDay ? 59 : 0,
    });
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}


function parseCanonicalDateValue(value, options = {}) {
  const { defaultToEndOfDay = false } = options;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = normalizeText(value);
  if (!text) return null;

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return zonedTimeToUtc({
      year: Number(y),
      month: Number(m),
      day: Number(d),
      hour: defaultToEndOfDay ? 23 : 0,
      minute: defaultToEndOfDay ? 59 : 0,
      second: defaultToEndOfDay ? 59 : 0,
    });
  }

  // Canonical Hub records already store real UTC instants after source
  // normalization. Do not treat these as spreadsheet wall-clock values again,
  // or they will be shifted a second time.
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isValidDateValue(value) {
  return parseDateValue(value) !== null;
}

function toIso(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

function localYmd(date, timeZone = TZ) {
  const parts = getZonedParts(date, timeZone);
  if (!parts) return '';

  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

function startOfLocalDay(date, timeZone = TZ) {
  const parts = getZonedParts(date, timeZone);
  if (!parts) return null;

  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 0,
    minute: 0,
    second: 0,
  }, timeZone);
}

function endOfLocalDay(date, timeZone = TZ) {
  const parts = getZonedParts(date, timeZone);
  if (!parts) return null;

  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: 23,
    minute: 59,
    second: 59,
  }, timeZone);
}

function addDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDayLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
  }).format(date);
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatTimeRange(start, end) {
  if (!start && !end) return '';
  if (start && !end) return formatTime(start);
  if (!start && end) return formatTime(end);

  return `${formatTime(start)}–${formatTime(end)}`;
}

function hasRenderableDateFallback(record) {
  const dateLike = firstNonEmpty(
    getField(record, 'date', 'Date', 'publicDate', 'dateLabel'),
    getField(record, 'day', 'Day', 'dayLabel')
  );

  return normalizeText(dateLike) !== '';
}


function extractDatePartsFromText(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
  }

  const compact = text.match(/(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?:[^0-9]|$)/);
  if (compact) {
    return {
      year: Number(compact[1]),
      month: Number(compact[2]),
      day: Number(compact[3]),
    };
  }

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return {
      year: Number(us[3]),
      month: Number(us[1]),
      day: Number(us[2]),
    };
  }

  return null;
}

function getAuthoredDateParts(record) {
  return (
    extractDatePartsFromText(getField(record, 'date', 'Date', 'publicDate', 'rehearsalDate')) ||
    extractDatePartsFromText(getField(record, 'eventKey', 'Event Key', 'id', 'ID')) ||
    extractDatePartsFromText(getField(record, 'start', 'Start', 'startDateTime', 'Start Date/Time', 'Start Date Time')) ||
    extractDatePartsFromText(getField(record, 'start_date_time', 'startDate', 'Start Date')) ||
    null
  );
}

function toTwentyFourHour(hour, meridiem) {
  let h = Number(hour);
  const marker = normalizeText(meridiem).toLowerCase();

  if (marker === 'pm' && h < 12) h += 12;
  if (marker === 'am' && h === 12) h = 0;

  return h;
}

function inferStartMeridiem(startHour, endHour, endMeridiem) {
  const end = normalizeText(endMeridiem).toLowerCase();

  if (!end) return '';

  if (end === 'pm') {
    if (Number(startHour) === 12) return 'pm';

    // 10:00–2:00 PM usually means 10 AM–2 PM.
    // 6:30–9:30 PM usually means 6:30 PM–9:30 PM.
    if (Number(startHour) > Number(endHour)) return 'am';

    return 'pm';
  }

  if (end === 'am') {
    return 'am';
  }

  return end;
}

function parseAuthoredTimeRanges(value) {
  const text = normalizeText(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[—–]/g, '-');

  if (!text) return [];

  const ranges = [];
  const rangePattern =
    /\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)\b/g;

  let match;
  while ((match = rangePattern.exec(text)) !== null) {
    const [
      ,
      startHourRaw,
      startMinuteRaw,
      startMeridiemRaw,
      endHourRaw,
      endMinuteRaw,
      endMeridiemRaw,
    ] = match;

    const startHour = Number(startHourRaw);
    const startMinute = startMinuteRaw === undefined ? 0 : Number(startMinuteRaw);
    const endHour = Number(endHourRaw);
    const endMinute = endMinuteRaw === undefined ? 0 : Number(endMinuteRaw);

    if (
      startHour < 1 ||
      startHour > 12 ||
      endHour < 1 ||
      endHour > 12 ||
      startMinute < 0 ||
      startMinute > 59 ||
      endMinute < 0 ||
      endMinute > 59
    ) {
      continue;
    }

    const startMeridiem =
      normalizeText(startMeridiemRaw) ||
      inferStartMeridiem(startHour, endHour, endMeridiemRaw);

    if (!startMeridiem) continue;

    const start24 = toTwentyFourHour(startHour, startMeridiem);
    const end24 = toTwentyFourHour(endHour, endMeridiemRaw);

    let startTotal = start24 * 60 + startMinute;
    let endTotal = end24 * 60 + endMinute;

    if (endTotal <= startTotal) {
      endTotal += 24 * 60;
    }

    ranges.push({
      startTotal,
      endTotal,
      source: match[0],
    });
  }

  return ranges;
}

function getAuthoredTimeRange(record) {
  const candidates = [
    getField(record, 'time', 'Time', 'publicTime', 'Public Time'),
    getField(record, 'called', 'Called', 'Who Is Called', 'whoIsCalled'),
    getField(record, 'publicTitle', 'Public Title', 'title', 'Title'),
  ]
    .flatMap(value => Array.isArray(value) ? value : [value])
    .map(normalizeText)
    .filter(Boolean);

  const ranges = candidates.flatMap(parseAuthoredTimeRanges);
  if (!ranges.length) return null;

  const startTotal = Math.min(...ranges.map(range => range.startTotal));
  const endTotal = Math.max(...ranges.map(range => range.endTotal));

  return { startTotal, endTotal };
}

function getAuthoredTimeRangeDates(record) {
  const dateParts = getAuthoredDateParts(record);
  const range = getAuthoredTimeRange(record);

  if (!dateParts || !range) return null;

  const startDayOffset = Math.floor(range.startTotal / (24 * 60));
  const endDayOffset = Math.floor(range.endTotal / (24 * 60));

  const startMinutes = range.startTotal % (24 * 60);
  const endMinutes = range.endTotal % (24 * 60);

  const startBase = zonedTimeToUtc({
    ...dateParts,
    hour: 0,
    minute: 0,
    second: 0,
  });

  if (!startBase || Number.isNaN(startBase.getTime())) return null;

  const startLocal = addDays(startBase, startDayOffset);
  const endLocal = addDays(startBase, endDayOffset);

  const startParts = getZonedParts(startLocal, TZ);
  const endParts = getZonedParts(endLocal, TZ);

  if (!startParts || !endParts) return null;

  const start = zonedTimeToUtc({
    year: startParts.year,
    month: startParts.month,
    day: startParts.day,
    hour: Math.floor(startMinutes / 60),
    minute: startMinutes % 60,
    second: 0,
  });

  const end = zonedTimeToUtc({
    year: endParts.year,
    month: endParts.month,
    day: endParts.day,
    hour: Math.floor(endMinutes / 60),
    minute: endMinutes % 60,
    second: 0,
  });

  return {
    start,
    end,
  };
}

function extractStart(record) {
  const authored = getAuthoredTimeRangeDates(record);
  if (authored && authored.start && !Number.isNaN(authored.start.getTime())) {
    return authored.start;
  }

  const direct = firstNonEmpty(
    getField(record, 'start', 'Start', 'startDateTime', 'Start Date/Time', 'Start Date Time'),
    getField(record, 'start_date_time', 'startDate', 'Start Date')
  );

  if (direct) return parseDateValue(direct);

  const date = firstNonEmpty(getField(record, 'date', 'Date'), getField(record, 'rehearsalDate'));
  const time = firstNonEmpty(getField(record, 'startTime', 'Start Time'));

  if (date && time) {
    return parseDateValue(`${normalizeText(date)} ${normalizeText(time)}`);
  }

  return null;
}

function extractEnd(record, start = null) {
  const authored = getAuthoredTimeRangeDates(record);
  if (authored && authored.end && !Number.isNaN(authored.end.getTime())) {
    return authored.end;
  }

  const direct = firstNonEmpty(
    getField(record, 'end', 'End', 'endDateTime', 'End Date/Time', 'End Date Time'),
    getField(record, 'end_date_time', 'endDate', 'End Date')
  );

  if (direct) return parseDateValue(direct, { defaultToEndOfDay: true });

  const date = firstNonEmpty(getField(record, 'date', 'Date'), getField(record, 'rehearsalDate'));
  const time = firstNonEmpty(getField(record, 'endTime', 'End Time'));

  if (date && time) {
    return parseDateValue(`${normalizeText(date)} ${normalizeText(time)}`, {
      defaultToEndOfDay: true,
    });
  }

  return start;
}

function getEventKey(record, index = 0) {
  const key = normalizeText(firstNonEmpty(
    getField(record, 'eventKey', 'Event Key', 'event_key'),
    getField(record, 'id', 'ID', 'eventId', 'Event ID')
  ));

  if (key) return key;

  const title = normalizeText(firstNonEmpty(
    getField(record, 'title', 'Public Title', 'publicTitle', 'name')
  ));

  const start = extractStart(record);
  const datePart = start ? localYmd(start).replaceAll('-', '') : String(index + 1).padStart(4, '0');
  const slug = title ? normalizeKey(title) : 'rehearsal';

  return `CHOSEN-${datePart}-${slug}`;
}

function statusText(record) {
  return normalizeText(firstNonEmpty(
    getField(record, 'status', 'Status', 'publicStatus', 'Public Status'),
    'Confirmed'
  ));
}

function isNoRehearsal(record) {
  const haystack = [
    getField(record, 'title', 'Public Title', 'publicTitle', 'name'),
    getField(record, 'phase', 'Phase/Focus', 'focus'),
    getField(record, 'status', 'Public Status', 'publicStatus', 'Status'),
    getField(record, 'eventType', 'Event Type', 'type'),
    getField(record, 'eventKey', 'Event Key'),
    getField(record, 'rehearsalPlan', 'Rehearsal Plan'),
  ]
    .map(normalizeUpper)
    .join(' | ');

  if (!haystack.trim()) return true;

  const noRehearsalMarkers = [
    'NO REHEARSAL',
    'NO_REHEARSAL',
    'NO COMPANY CALL',
    'DARK DAY',
  ];

  const adminMarkers = [
    'ADMIN ONLY',
    'ADMIN-ONLY',
    'INTERNAL ONLY',
    'DO NOT PUBLISH',
    'PLACEHOLDER',
    'TEST ROW',
  ];

  return [...noRehearsalMarkers, ...adminMarkers].some(marker => haystack.includes(marker));
}

function sourceRecordsFrom(input) {
  if (!input) return [];

  if (Array.isArray(input)) return input;

  if (Array.isArray(input.rehearsals)) return input.rehearsals;
  if (Array.isArray(input.events)) return input.events;
  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.data)) return input.data;

  return [];
}

function validateSourceDates(records) {
  const failures = [];

  records.forEach((record, index) => {
    if (!record || typeof record !== 'object') {
      failures.push(`#${index + 1}: record is not an object`);
      return;
    }

    if (isNoRehearsal(record)) return;

    const eventKey = getEventKey(record, index);
    const rawStart = firstNonEmpty(
      getField(record, 'start', 'Start', 'startDateTime', 'Start Date/Time', 'Start Date Time'),
      getField(record, 'start_date_time', 'startDate', 'Start Date'),
      getField(record, 'date', 'Date')
    );

    const start = extractStart(record);
    const end = extractEnd(record, start);

    if (!start && !hasRenderableDateFallback(record)) {
      failures.push(`${eventKey}: missing or invalid start/date`);
    }

    if (!end && !hasRenderableDateFallback(record)) {
      failures.push(`${eventKey}: missing or invalid end/date`);
    }

    if (start && end && end < start) {
      failures.push(`${eventKey}: end is before start`);
    }

    if (rawStart && !isValidDateValue(rawStart) && !extractStart(record)) {
      failures.push(`${eventKey}: invalid start value "${normalizeText(rawStart)}"`);
    }
  });

  if (failures.length) {
    fail(
      'Rehearsal source date validation failed. Fix the source feed before publishing.',
      failures.map(item => ` - ${item}`).join('\n')
    );
  }
}

function canonicalizeRehearsal(record, index = 0) {
  if (!record || typeof record !== 'object') return null;
  if (isNoRehearsal(record)) return null;

  const startDate = extractStart(record);
  const endDate = extractEnd(record, startDate);

  if (!startDate && !hasRenderableDateFallback(record)) return null;
  if (startDate && endDate && endDate < startDate) return null;

  const eventKey = getEventKey(record, index);
  const startIso = toIso(startDate);
  const endIso = toIso(endDate);

  const title = normalizeText(firstNonEmpty(
    getField(record, 'title', 'Public Title', 'publicTitle', 'name'),
    getField(record, 'phase', 'Phase/Focus', 'focus'),
    'CHOSEN Rehearsal'
  ));

  const focus = normalizeText(firstNonEmpty(
    getField(record, 'focus', 'Phase/Focus', 'phase', 'Focus'),
    ''
  ));

  const work = normalizeText(firstNonEmpty(
    getField(record, 'work', 'Rehearsal Plan', 'rehearsalPlan', 'plan'),
    focus
  ));

  const prep = normalizeText(firstNonEmpty(
    getField(record, 'prep', 'Prepare', 'Preparation', 'publicPrep', 'Public Prep'),
    ''
  ));

  const notice = normalizeText(firstNonEmpty(
    getField(record, 'notice', 'Public Notes', 'publicNotes', 'notes', 'Notes'),
    ''
  ));

  const location = normalizeText(firstNonEmpty(
    getField(record, 'location', 'Location'),
    ''
  ));

  const locationShort = normalizeText(firstNonEmpty(
    getField(record, 'locationShort', 'Location Short', 'room'),
    location
  ));

  const calledPeople = normalizePeopleList(firstNonEmpty(
    getField(record, 'calledPeople', 'Called People', 'called_people'),
    getField(record, 'Who Is Called', 'whoIsCalled')
  ));

  const calledPeopleIds = normalizeList(firstNonEmpty(
    getField(record, 'calledPeopleIds', 'Called People IDs', 'called_people_ids'),
    getField(record, 'personIds', 'Person IDs')
  ));

  const calledGroups = normalizeList(firstNonEmpty(
    getField(record, 'calledGroups', 'Called Groups', 'callGroups', 'Call Groups'),
    getField(record, 'groups', 'Groups')
  ));

  const callGroups = normalizeList(firstNonEmpty(
    getField(record, 'callGroups', 'Call Groups'),
    calledGroups
  ));

  const calledText = normalizeText(firstNonEmpty(
    getField(record, 'called', 'Called', 'Who Is Called', 'whoIsCalled'),
    [
      ...calledGroups,
      ...calledPeople.map(person => person.displayName || person.name || person.id).filter(Boolean),
    ].join(', ')
  ));

  const exactCallStatus = normalizeText(firstNonEmpty(
    getField(record, 'exactCallStatus', 'Exact Call Status'),
    calledPeopleIds.length || calledGroups.length ? 'Exact Calls V1.1' : ''
  ));

  const callDataVersionRaw = firstNonEmpty(
    getField(record, 'callDataVersion', 'Call Data Version'),
    ''
  );

  const callDataVersion = callDataVersionRaw === ''
    ? ''
    : Number.isFinite(Number(callDataVersionRaw))
      ? Number(callDataVersionRaw)
      : callDataVersionRaw;

  const dateForLabels = startDate || parseDateValue(getField(record, 'date', 'Date'));

  return compactObject({
    ...record,

    publish: true,

    id: normalizeText(firstNonEmpty(getField(record, 'id', 'ID'), eventKey)),
    eventKey,

    start: startIso,
    end: endIso,

    date: dateForLabels ? localYmd(dateForLabels) : normalizeText(getField(record, 'date', 'Date')),
    day: dateForLabels ? formatDayLabel(dateForLabels) : normalizeText(getField(record, 'day', 'Day')),
    dateLabel: dateForLabels ? formatDateLabel(dateForLabels) : normalizeText(getField(record, 'dateLabel')),
    dayLabel: dateForLabels ? formatDayLabel(dateForLabels) : normalizeText(getField(record, 'dayLabel')),
    time: startDate || endDate
      ? formatTimeRange(startDate, endDate)
      : normalizeText(firstNonEmpty(getField(record, 'time', 'Time'), '')),

    title,
    status: statusText(record),
    location,
    locationShort,

    called: calledText,
    callGroups,

    calledPeople,
    calledPeopleIds,
    calledGroups,
    exactCallStatus,
    callDataVersion,

    work,
    focus,
    prep,
    notice,

    changeType: normalizeText(firstNonEmpty(
      getField(record, 'changeType', 'Change Type'),
      ''
    )),
  });
}

function sortByStartThenTitle(a, b) {
  const aStart = parseCanonicalDateValue(a.start) || parseCanonicalDateValue(a.date) || new Date(8640000000000000);
  const bStart = parseCanonicalDateValue(b.start) || parseCanonicalDateValue(b.date) || new Date(8640000000000000);

  const diff = aStart.getTime() - bStart.getTime();
  if (diff !== 0) return diff;

  return normalizeText(a.title).localeCompare(normalizeText(b.title));
}

function dedupeRehearsals(records) {
  const seen = new Set();
  const out = [];

  records.forEach(record => {
    const key = normalizeText(firstNonEmpty(record.eventKey, record.id));
    const start = normalizeText(record.start);
    const dedupeKey = key || `${start}|${normalizeText(record.title)}`;

    if (!dedupeKey) {
      out.push(record);
      return;
    }

    if (seen.has(dedupeKey)) {
      console.warn(`⚠️ Duplicate rehearsal skipped: ${dedupeKey}`);
      return;
    }

    seen.add(dedupeKey);
    out.push(record);
  });

  return out;
}

function buildCanonicalPublishedRehearsals(sourceRecords) {
  validateSourceDates(sourceRecords);

  const canonical = sourceRecords
    .map((record, index) => canonicalizeRehearsal(record, index))
    .filter(Boolean)
    .sort(sortByStartThenTitle);

  return dedupeRehearsals(canonical);
}

function isUpcoming(record) {
  const end = parseCanonicalDateValue(record.end, { defaultToEndOfDay: true });
  if (!end) return false;
  return end >= NOW;
}

function isPast(record) {
  const end = parseCanonicalDateValue(record.end, { defaultToEndOfDay: true });
  if (!end) return false;
  return end < NOW;
}

function getThisWeekWindow(now = NOW) {
  const start = startOfLocalDay(now, TZ);
  const end = endOfLocalDay(addDays(start, 6), TZ);

  return { start, end };
}

function isInThisWeek(record, window = getThisWeekWindow()) {
  const start = parseCanonicalDateValue(record.start) || parseCanonicalDateValue(record.date);
  if (!start) return false;

  return start >= window.start && start <= window.end;
}

function toPublicRehearsal(record) {
  return compactObject({
    id: record.id,
    eventKey: record.eventKey,

    start: record.start,
    end: record.end,
    date: record.date,
    day: record.day,
    dateLabel: record.dateLabel,
    dayLabel: record.dayLabel,
    time: record.time,

    title: record.title,
    status: record.status,
    location: record.location,
    locationShort: record.locationShort,

    called: record.called,
    callGroups: record.callGroups || [],

    calledPeople: record.calledPeople || [],
    calledPeopleIds: record.calledPeopleIds || [],
    calledGroups: record.calledGroups || [],
    exactCallStatus: record.exactCallStatus || '',
    callDataVersion: record.callDataVersion || '',

    work: record.work || '',
    focus: record.focus || '',
    prep: record.prep || '',
    notice: record.notice || '',
    changeType: record.changeType || '',
  });
}

function resourceItemsFrom(input) {
  if (!input) return [];

  if (Array.isArray(input)) return input;
  if (Array.isArray(input.items)) return input.items;
  if (Array.isArray(input.scripts)) return input.scripts;
  if (Array.isArray(input.music)) return input.music;
  if (Array.isArray(input.tracks)) return input.tracks;
  if (Array.isArray(input.resources)) return input.resources;
  if (Array.isArray(input.files)) return input.files;

  return [];
}

function hasExplicitResourcePublicationFields(item) {
  if (!item || typeof item !== 'object') return false;

  return [
    'publish',
    'published',
    'companyPublish',
    'companyPublished',
    'hubPublish',
    'hubPublished',
    'current',
    'isCurrent',
    'CURRENT',
    'Current',
  ].some(field => Object.prototype.hasOwnProperty.call(item, field));
}

function isDraftishResource(item) {
  const status = normalizeUpper(firstNonEmpty(
    getField(item, 'status', 'Status', 'publicStatus', 'Public Status'),
    getField(item, 'approvalStatus', 'Approval Status'),
    getField(item, 'reviewStatus', 'Review Status')
  ));

  if (!status) return false;

  return [
    'DRAFT',
    'PRIVATE',
    'HIDDEN',
    'ARCHIVE',
    'ARCHIVED',
    'DEPRECATED',
    'NOT APPROVED',
    'UNAPPROVED',
    'DO NOT PUBLISH',
  ].some(marker => status.includes(marker));
}

function isPublishedResource(item) {
  if (!item || typeof item !== 'object') return false;

  if (isDraftishResource(item)) return false;

  const explicitFlags = [
    getField(item, 'publish'),
    getField(item, 'published'),
    getField(item, 'companyPublish'),
    getField(item, 'companyPublished'),
    getField(item, 'hubPublish'),
    getField(item, 'hubPublished'),
    getField(item, 'current'),
    getField(item, 'isCurrent'),
    getField(item, 'CURRENT'),
    getField(item, 'Current'),
  ]
    .map(boolish)
    .filter(value => value !== null);

  if (explicitFlags.includes(false)) return false;
  if (explicitFlags.includes(true)) return true;

  const status = normalizeUpper(firstNonEmpty(
    getField(item, 'status', 'Status', 'publicStatus', 'Public Status'),
    getField(item, 'approvalStatus', 'Approval Status')
  ));

  if (['CURRENT', 'PUBLISHED', 'APPROVED', 'COMPANY VERSION', 'PUBLIC'].some(marker => status.includes(marker))) {
    return true;
  }

  if (!hasExplicitResourcePublicationFields(item)) {
    const label = normalizeText(firstNonEmpty(item.title, item.name, item.id, 'Unnamed resource'));
    console.warn(`⚠️ Resource "${label}" has no explicit publish/current flag. Preserving it unless marked draft/private/hidden.`);
    return true;
  }

  return false;
}

function normalizeResourceItem(item) {
  if (!item || typeof item !== 'object') return null;

  const title = normalizeText(firstNonEmpty(
    getField(item, 'title', 'Title', 'name', 'Name'),
    'Untitled'
  ));

  const id = normalizeText(firstNonEmpty(
    getField(item, 'id', 'ID'),
    normalizeKey(title)
  ));

  return compactObject({
    ...item,
    id,
    title,
    name: normalizeText(firstNonEmpty(getField(item, 'name', 'Name'), title)),
    status: normalizeText(firstNonEmpty(getField(item, 'status', 'Status'), 'Current')),
    current: boolish(firstNonEmpty(
      getField(item, 'current', 'isCurrent', 'CURRENT', 'Current'),
      false
    )) === true,
  });
}

function buildResourcePayload(input, kind) {
  const original = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const items = resourceItemsFrom(input)
    .filter(isPublishedResource)
    .map(normalizeResourceItem)
    .filter(Boolean);

  const current = items.filter(item => item.current);
  const visibleCurrent = current.length ? current : items;

  return compactObject({
    ...original,
    items,
    current: visibleCurrent,
    count: items.length,
    updated: new Date().toISOString(),
    kind,
  });
}

function buildScheduleGroups(rehearsals) {
  const groups = new Map();

  rehearsals.forEach(rehearsal => {
    const values = [
      ...(rehearsal.callGroups || []),
      ...(rehearsal.calledGroups || []),
    ];

    values.forEach(groupName => {
      const name = normalizeText(groupName);
      if (!name) return;

      const key = normalizeKey(name);
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name,
          count: 0,
        });
      }

      groups.get(key).count += 1;
    });
  });

  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function validateGeneratedContent({
  rawSourceCount,
  validSourceCount,
  sourceUpcomingCount,
  canonicalCount,
  futureCount,
  content,
}) {
  if (rawSourceCount > 0 && validSourceCount > 0 && canonicalCount === 0) {
    fail(
      'Build refused to publish: rehearsal source data exists, but canonical published schedule is empty.'
    );
  }

  if (sourceUpcomingCount > 0 && futureCount === 0) {
    fail(
      'Build refused to publish: upcoming rehearsal source data exists, but generated upcoming schedule is empty.'
    );
  }

  if (futureCount > 0 && !content.nextRehearsal) {
    fail(
      'Build refused to publish: upcoming rehearsals exist, but nextRehearsal was not generated.'
    );
  }

  if (
    futureCount > 0 &&
    (!content.schedule || !Array.isArray(content.schedule.rehearsals) || !content.schedule.rehearsals.length)
  ) {
    fail(
      'Build refused to publish: upcoming rehearsals exist, but schedule.rehearsals is empty.'
    );
  }

  if (!content.thisWeek || !Array.isArray(content.thisWeek.rehearsals)) {
    fail(
      'Build refused to publish: thisWeek.rehearsals is missing or invalid.'
    );
  }

  if (!content.schedule || !Array.isArray(content.schedule.rehearsals)) {
    fail(
      'Build refused to publish: schedule.rehearsals is missing or invalid.'
    );
  }
}

function main() {
  console.log('🎭 Building CHOSEN 2026 Company Hub content');
  console.log(`🕰️ Time zone: ${TZ}`);
  console.log(`🕰️ Build time: ${NOW.toISOString()}`);

  const site = read(INPUTS.site, {});
  const rehearsalInput = read(INPUTS.rehearsals, []);
  const scriptsInput = read(INPUTS.scripts, []);
  const musicInput = read(INPUTS.music, []);

  const rawSourceRehearsals = sourceRecordsFrom(rehearsalInput);
  const validSourceRehearsals = rawSourceRehearsals.filter(record => record && typeof record === 'object' && !isNoRehearsal(record));

  const sourceUpcomingRehearsals = validSourceRehearsals.filter(record => {
    const start = extractStart(record);
    const end = extractEnd(record, start);
    return end && end >= NOW;
  });

  const canonicalPublishedRehearsals = buildCanonicalPublishedRehearsals(rawSourceRehearsals);
  const futureRehearsals = canonicalPublishedRehearsals.filter(isUpcoming).sort(sortByStartThenTitle);
  const pastRehearsals = canonicalPublishedRehearsals.filter(isPast).sort(sortByStartThenTitle).reverse();

  const thisWeekWindow = getThisWeekWindow(NOW);
  const thisWeekRehearsals = futureRehearsals.filter(record => isInThisWeek(record, thisWeekWindow));
  const nextRehearsal = futureRehearsals[0] || null;

  const publicFuture = futureRehearsals.map(toPublicRehearsal);
  const publicPast = pastRehearsals.map(toPublicRehearsal);
  const publicThisWeek = thisWeekRehearsals.map(toPublicRehearsal);
  const publicNext = nextRehearsal ? toPublicRehearsal(nextRehearsal) : null;

  const scheduleGroups = buildScheduleGroups(futureRehearsals);

  const content = compactObject({
    updated: new Date().toISOString(),

    announcement: firstNonEmpty(site.announcement, site.notice, ''),
    links: site.links || {},

    nextRehearsal: publicNext,

    thisWeek: {
      title: 'This Week',
      start: toIso(thisWeekWindow.start),
      end: toIso(thisWeekWindow.end),
      rehearsals: publicThisWeek,
      count: publicThisWeek.length,
    },

    schedule: {
      title: 'Schedule',
      timezone: TZ,
      rehearsals: publicFuture,
      pastRehearsals: publicPast,
      allRehearsals: [...publicFuture, ...publicPast],
      groups: scheduleGroups,
      count: publicFuture.length,
      pastCount: publicPast.length,
    },

    scripts: buildResourcePayload(scriptsInput, 'scripts'),
    music: buildResourcePayload(musicInput, 'music'),
  });

  validateGeneratedContent({
    rawSourceCount: rawSourceRehearsals.length,
    validSourceCount: validSourceRehearsals.length,
    sourceUpcomingCount: sourceUpcomingRehearsals.length,
    canonicalCount: canonicalPublishedRehearsals.length,
    futureCount: futureRehearsals.length,
    content,
  });

  console.log('📊 Rehearsal diagnostics');
  console.log(`   Source rehearsal records: ${rawSourceRehearsals.length}`);
  console.log(`   Valid non-admin source records: ${validSourceRehearsals.length}`);
  console.log(`   Canonical published rehearsals: ${canonicalPublishedRehearsals.length}`);
  console.log(`   Upcoming source rehearsals: ${sourceUpcomingRehearsals.length}`);
  console.log(`   Generated upcoming rehearsals: ${futureRehearsals.length}`);
  console.log(`   This Week rehearsals: ${thisWeekRehearsals.length}`);
  console.log(`   Past rehearsals: ${pastRehearsals.length}`);
  console.log(
    `   Next rehearsal: ${
      nextRehearsal
        ? `${nextRehearsal.eventKey || nextRehearsal.id} — ${nextRehearsal.title} — ${nextRehearsal.start || nextRehearsal.date}`
        : 'none'
    }`
  );

  OUTPUTS.forEach(output => write(output, content));

  console.log('✅ CHOSEN Hub content build complete');
}

try {
  main();
} catch (err) {
  console.error('❌ CHOSEN Hub content build failed');
  console.error(err?.stack || err?.message || err);
  process.exit(1);
}
