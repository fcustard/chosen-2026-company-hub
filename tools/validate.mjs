import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const scripts = read('data/scripts.json');
const music = read('data/music.json');
const rehearsals = read('data/rehearsals.json');
const site = read('data/site.json');

const errors = [];

// The optional Google subscription must point to the same public calendar as
// the iCal feed, and the Schedule card needs a working fallback without JS.
try {
  const ical = new URL(site.links.appleCalendar);
  const google = new URL(site.links.googleCalendar);
  const icalId = decodeURIComponent(ical.pathname.match(/^\/calendar\/ical\/([^/]+)\/public\/basic\.ics$/)?.[1] || '');
  const calendarCard = fs.readFileSync('schedule.html', 'utf8').match(/<a\s+id="googleCalendarLink"[^>]*>/)?.[0] || '';
  if (!icalId || ical.hostname !== 'calendar.google.com' ||
      google.hostname !== 'calendar.google.com' ||
      google.pathname !== '/calendar/r' ||
      google.searchParams.get('cid') !== icalId ||
      !calendarCard.includes('data-link="googleCalendar"') ||
      !calendarCard.includes(`href="${site.links.googleCalendar}"`)) {
    errors.push('Google Calendar card must subscribe to the public iCal calendar');
  }
} catch (_) {
  errors.push('Google Calendar subscription URL is missing or invalid');
}

// SCRIPT SAFETY CHECKS
for (const s of scripts) {
  if (s.companyPublish && !s.approved) {
    errors.push(
      `SCRIPT ${s.scene}: companyPublish=true but approved=false`
    );
  }

  if (
    s.companyPublish &&
    (!s.readUrl ||
      s.readUrl === '#' ||
      !s.pdfUrl ||
      s.pdfUrl === '#')
  ) {
    errors.push(
      `SCRIPT ${s.scene}: published script is missing Read/PDF URLs`
    );
  }
}

// MUSIC SAFETY CHECKS
for (const m of music) {
  if (m.companyPublish && !m.approved) {
    errors.push(
      `MUSIC ${m.title}: companyPublish=true but approved=false`
    );
  }

  if (
    m.companyPublish &&
    (!m.playUrl || m.playUrl === '#')
  ) {
    errors.push(
      `MUSIC ${m.title}: published track has no playUrl`
    );
  }
}

// REHEARSAL DATA CHECKS
for (const r of rehearsals) {
  if (!r.id || !r.start || !r.end || !r.title) {
    errors.push(
      `REHEARSAL: missing required field in ${r.id || 'unknown rehearsal'}`
    );
  }

  if (new Date(r.end) <= new Date(r.start)) {
    errors.push(
      `REHEARSAL ${r.id}: end must be after start`
    );
  }

  if (r.showDay) {
    const clock = value => new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/New_York',
    }).format(new Date(value));
    const { crewCall, companyCall, showtime, tentativeEnd } = r.showDay;
    const minute = value => {
      const match = String(value || '').match(/^(\d{1,2}):(\d{2}) (AM|PM)$/);
      return match ? (Number(match[1]) % 12) * 60 + Number(match[2]) +
        (match[3] === 'PM' ? 720 : 0) : NaN;
    };
    if (clock(r.start) !== crewCall || clock(r.end) !== tentativeEnd ||
      ![crewCall, companyCall, showtime, tentativeEnd].every(value =>
        Number.isFinite(minute(value))) ||
      !(minute(crewCall) < minute(companyCall) &&
        minute(companyCall) < minute(showtime) &&
        minute(showtime) < minute(tentativeEnd))) {
      errors.push(`REHEARSAL ${r.id}: Show Day start/end and calls disagree`);
    }
  }

  if (r.personalCallTimes) {
    const calledIds = r.calledPeopleIds || [];
    const timedIds = Object.keys(r.personalCallTimes);
    const expected = new Set(calledIds);

    if (
      r.exactCallStatus !== 'READY' ||
      timedIds.length !== expected.size ||
      timedIds.some(id => !expected.has(id)) ||
      calledIds.some(id => !r.personalCallTimes[id])
    ) {
      errors.push(`REHEARSAL ${r.id}: personal call times must cover the exact called roster`);
    }

    if (timedIds.some(id => !/^\d{1,2}:\d{2} (?:AM|PM)$/.test(r.personalCallTimes[id]))) {
      errors.push(`REHEARSAL ${r.id}: invalid personal call time`);
    }
  }

  if (r.personalCallEndTimes) {
    const calledIds = r.calledPeopleIds || [];
    const endIds = Object.keys(r.personalCallEndTimes);
    const expected = new Set(calledIds);
    if (
      !r.personalCallTimes ||
      r.exactCallStatus !== 'READY' ||
      endIds.length !== expected.size ||
      endIds.some(id => !expected.has(id)) ||
      calledIds.some(id => !r.personalCallEndTimes[id])
    ) {
      errors.push(`REHEARSAL ${r.id}: personal end times must cover the exact called roster`);
    }

    for (const id of endIds) {
      const arrival = r.personalCallTimes?.[id];
      const departure = r.personalCallEndTimes[id];
      if (!/^\d{1,2}:\d{2} (?:AM|PM)$/.test(departure)) {
        errors.push(`REHEARSAL ${r.id}: invalid personal end time for ${id}`);
        continue;
      }
      const day = r.start?.split(' ').slice(0, 3).join(' ');
      const start = new Date(`${day} ${arrival}`);
      const end = new Date(`${day} ${departure}`);
      if (
        !arrival || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        start < new Date(r.start) || end > new Date(r.end) || end <= start
      ) {
        errors.push(`REHEARSAL ${r.id}: personal window outside the event for ${id}`);
      }
    }
  }
}

// STOP AUTOMATION IF SOMETHING IS WRONG
if (errors.length) {
  console.error('\nCHOSEN HUB VALIDATION FAILED\n');

  errors.forEach(error => {
    console.error('• ' + error);
  });

  process.exit(1);
}

console.log(
  `Validation passed: ${scripts.length} script records, ` +
  `${music.length} music records, ` +
  `${rehearsals.length} rehearsal records.`
);
