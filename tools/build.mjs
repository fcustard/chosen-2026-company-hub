import fs from 'node:fs';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const site = read('data/site.json');
const rehearsals = read('data/rehearsals.json');
const scripts = read('data/scripts.json');
const music = read('data/music.json');

const now = new Date();

const publishedRehearsals = rehearsals
  .filter(r => r.publish)
  .sort((a, b) => new Date(a.start) - new Date(b.start));

const futureRehearsals = publishedRehearsals.filter(
  r => new Date(r.end) >= now
);

const next =
  futureRehearsals[0] ||
  publishedRehearsals[publishedRehearsals.length - 1];

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  }).format(date);
}

function timeRange(rehearsal) {
  return (
    formatTime(new Date(rehearsal.start)) +
    '–' +
    formatTime(new Date(rehearsal.end))
  );
}

// Determine the rehearsal week using the next upcoming rehearsal
// as the anchor.
const anchor = futureRehearsals[0]
  ? new Date(futureRehearsals[0].start)
  : now;

const dayOffset = (anchor.getUTCDay() + 6) % 7;

const weekStart = new Date(anchor);
weekStart.setUTCDate(anchor.getUTCDate() - dayOffset);
weekStart.setUTCHours(0, 0, 0, 0);

const weekEnd = new Date(weekStart);
weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

const thisWeek = publishedRehearsals.filter(r => {
  const date = new Date(r.start);
  return date >= weekStart && date < weekEnd;
});

// Only approved + published materials receive live company links.
const companyScripts = scripts.map(s => {
  if (s.companyPublish && s.approved) {
    return s;
  }

  return {
    ...s,
    readUrl: '#',
    pdfUrl: '#'
  };
});

const companyMusic = music.map(m => {
  if (m.companyPublish && m.approved) {
    return m;
  }

  return {
    ...m,
    playUrl: '#',
    lyricsUrl: '#'
  };
});

const content = {
  updated: new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York'
  }).format(now),

  announcement: site.announcement || '',

  links: site.links,

  nextRehearsal: next
    ? {
        day: next.dayLabel || next.dateLabel,
        date: next.title,
        time: timeRange(next),
        location: next.locationShort || next.location,
        focus: next.focus || next.work || '',
        url: 'this-week.html'
      }
    : {
        day: 'NEXT REHEARSAL',
        date: 'No published rehearsal',
        time: '',
        location: '',
        focus: 'Check the live schedule.',
        url: 'schedule.html'
      },

  thisWeek: {
    label: 'THIS WEEK',
    title: 'This Week',
    intro:
      'Check your call time first. Then review exactly what you are working on before rehearsal.',

    rehearsals: thisWeek.map(r => ({
      date: r.dateLabel,
      time: timeRange(r),
      title: r.title,
      status: r.status,
      location: r.location,
      called: r.called,
      work: r.work,
      prep: r.prep,
      notice: r.notice || '',
      scriptUrl: 'scripts.html',
      musicUrl: 'music.html'
    }))
  },

  scripts: companyScripts,
  music: companyMusic
};

fs.writeFileSync(
  'content.json',
  JSON.stringify(content, null, 2) + '\n'
);

console.log('Generated content.json successfully.');
