import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const site = read('data/site.json');
const rehearsals = read('data/rehearsals.json');
const scripts = read('data/scripts.json');
const music = read('data/music.json');

const now = new Date();
const TZ = 'America/New_York';

function isValidDateValue(value) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function hasRenderableDateFallback(r) {
  if (String(r.dateLabel || '').trim()) return true;
  if (String(r.dayLabel || '').trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(r.id || ''));
}

// Production reliability check.
// A published rehearsal may use a label/id fallback if start is ever malformed,
// but publication is blocked when no usable date source exists at all.
for (const r of rehearsals.filter(r => r.publish)) {
  if (!isValidDateValue(r.start)) {
    if (hasRenderableDateFallback(r)) {
      console.warn(
        `⚠️ Schedule warning: ${r.id || r.title || 'unknown rehearsal'} has an invalid/missing start timestamp; date badge will use fallback data.`
      );
    } else {
      throw new Error(
        `SCHEDULE PUBLISHING ERROR: ${r.id || r.title || 'unknown rehearsal'} has no valid start timestamp, dateLabel, dayLabel, or YYYY-MM-DD id.`
      );
    }
  }

  if (!isValidDateValue(r.end)) {
    throw new Error(
      `SCHEDULE PUBLISHING ERROR: ${r.id || r.title || 'unknown rehearsal'} has an invalid/missing end timestamp.`
    );
  }
}

const publishedRehearsals = rehearsals
  .filter(r => r.publish)
  .sort((a, b) => {
    const aTime = isValidDateValue(a.start) ? new Date(a.start).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = isValidDateValue(b.start) ? new Date(b.start).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

const futureRehearsals = publishedRehearsals.filter(
  r => isValidDateValue(r.end) && new Date(r.end) >= now
);

const next =
  futureRehearsals[0] ||
  publishedRehearsals[publishedRehearsals.length - 1];

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ
  }).format(date);
}

function timeRange(rehearsal) {
  const start = new Date(rehearsal.start);
  const end = new Date(rehearsal.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
  return `${formatTime(start)}–${formatTime(end)}`;
}

const anchor = futureRehearsals[0] && isValidDateValue(futureRehearsals[0].start)
  ? new Date(futureRehearsals[0].start)
  : now;

const dayOffset = (anchor.getUTCDay() + 6) % 7;
const weekStart = new Date(anchor);
weekStart.setUTCDate(anchor.getUTCDate() - dayOffset);
weekStart.setUTCHours(0, 0, 0, 0);

const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

const thisWeek = publishedRehearsals.filter(r => {
  if (!isValidDateValue(r.start)) return false;
  const date = new Date(r.start);
  return date >= weekStart && date < weekEnd;
});

const companyScripts = scripts.map(s => {
  if (s.companyPublish && s.approved) return s;
  return {...s, readUrl: '#', pdfUrl: '#'};
});

const companyMusic = music.map(m => {
  if (m.companyPublish && m.approved) return m;
  return {...m, playUrl: '#', lyricsUrl: '#'};
});

const scheduleGroups = [...new Set(
  publishedRehearsals.flatMap(r =>
    String(r.callGroups || '')
      .split(';')
      .map(g => g.trim())
      .filter(Boolean)
  )
)].sort((a, b) => a.localeCompare(b));

const scheduleRehearsals = publishedRehearsals.map(r => ({
  id: r.id || '',
  start: r.start || '',
  end: r.end || '',
  date: r.dateLabel || r.dayLabel || r.id || '',
  day: r.dayLabel || r.dateLabel || r.id || '',
  dateLabel: r.dateLabel || '',
  dayLabel: r.dayLabel || '',
  time: timeRange(r),
  title: r.title || '',
  status: r.status || 'CONFIRMED',
  location: r.location || '',
  locationShort: r.locationShort || r.location || '',
  called: r.called || '',
  callGroups: String(r.callGroups || '')
    .split(';')
    .map(g => g.trim())
    .filter(Boolean),
  work: r.work || r.focus || '',
  prep: r.prep || '',
  notice: r.notice || '',
  changeType: r.changeType || '',
  eventKey: r.eventKey || ''
}));

const content = {
  updated: new Intl.DateTimeFormat('en-CA', {timeZone: TZ}).format(now),
  announcement: site.announcement || '',
  links: site.links,

  nextRehearsal: next
    ? {
        day: next.dayLabel || next.dateLabel || next.id || 'NEXT REHEARSAL',
        date: next.title || 'See schedule',
        time: timeRange(next),
        location: next.locationShort || next.location || '',
        focus: next.focus || next.work || '',
        url: 'this-week.html'
      }
    : {
        day: 'NEXT REHEARSAL',
        date: 'No published rehearsal',
        time: '',
        location: '',
        focus: 'Check the schedule.',
        url: 'schedule.html'
      },

  thisWeek: {
    label: 'THIS WEEK',
    title: 'This Week',
    intro: 'Check your call time first. Then review exactly what you are working on before rehearsal.',
    rehearsals: thisWeek.map(r => ({
      date: r.dateLabel || r.dayLabel || r.id || '',
      time: timeRange(r),
      title: r.title || '',
      status: r.status || '',
      location: r.location || '',
      called: r.called || '',
      work: r.work || '',
      prep: r.prep || '',
      notice: r.notice || '',
      scriptUrl: 'scripts.html',
      musicUrl: 'music.html'
    }))
  },

  schedule: {
    title: 'Production Schedule',
    intro: 'Current published rehearsal dates, call times, locations, assignments and preparation.',
    availableGroups: scheduleGroups,
    rehearsals: scheduleRehearsals
  },

  scripts: companyScripts,
  music: companyMusic
};

fs.writeFileSync('content.json', JSON.stringify(content, null, 2) + '\n');

console.log(
  `Generated content.json successfully: ${scheduleRehearsals.length} published rehearsals, ${scheduleGroups.length} call groups.`
);
