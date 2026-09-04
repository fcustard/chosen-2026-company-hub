import fs from 'node:fs';

const read = path =>
  JSON.parse(
    fs.readFileSync(path, 'utf8')
  );

const site = read('data/site.json');
const rehearsals = read('data/rehearsals.json');
const scripts = read('data/scripts.json');
const music = read('data/music.json');

const now = new Date();

const TZ = 'America/New_York';

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function text(value) {
  return String(
    value ?? ''
  ).trim();
}

function upper(value) {
  return text(value)
    .toUpperCase();
}

function validDate(value) {
  if (!value) {
    return false;
  }

  const date =
    new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map(text)
          .filter(Boolean)
      )
    ];
  }

  return [
    ...new Set(
      String(value || '')
        .split(/[;,]/)
        .map(text)
        .filter(Boolean)
    )
  ];
}

function isNoRehearsal(r) {
  return (
    upper(r?.status) ===
      'NO REHEARSAL' ||
    upper(r?.title)
      .includes(
        'NO REHEARSAL'
      )
  );
}

function formatTime(date) {
  if (
    !(date instanceof Date) ||
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TZ
    }
  ).format(date);
}

function timeRange(r) {
  const start =
    new Date(r.start);

  const end =
    new Date(r.end);

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return '';
  }

  return (
    `${formatTime(start)}–` +
    `${formatTime(end)}`
  );
}

/*
 * ============================================================
 * REHEARSAL SOURCE CONTRACT
 * ============================================================
 *
 * data/rehearsals.json is now generated from the hub-v2 feed.
 *
 * hub-v2 already contains ONLY Master Calendar rows where:
 *
 *   Publish? = YES
 *
 * Therefore this file itself is the published schedule.
 *
 * We intentionally DO NOT filter again using r.publish.
 *
 * That prevents a missing compatibility flag from silently
 * creating an empty Home / This Week / Schedule.
 */

if (!Array.isArray(rehearsals)) {
  throw new Error(
    'BUILD ERROR: data/rehearsals.json must be an array.'
  );
}

if (rehearsals.length === 0) {
  throw new Error(
    'BUILD ERROR: data/rehearsals.json contains zero rehearsals. ' +
    'Hub publication stopped to prevent an empty schedule.'
  );
}

/*
 * ============================================================
 * NORMALIZE + VALIDATE PUBLISHED REHEARSALS
 * ============================================================
 */

const publishedRehearsals = rehearsals
  .filter(r =>
    !isNoRehearsal(r)
  )
  .map(r => {
    const id =
      text(
        r.id ||
        r.eventKey
      );

    if (!id) {
      throw new Error(
        'BUILD ERROR: published rehearsal missing id/eventKey.'
      );
    }

    if (!text(r.title)) {
      throw new Error(
        `BUILD ERROR: ${id} is missing title.`
      );
    }

    if (!validDate(r.start)) {
      throw new Error(
        `BUILD ERROR: ${id} has invalid start "${r.start}".`
      );
    }

    if (!validDate(r.end)) {
      throw new Error(
        `BUILD ERROR: ${id} has invalid end "${r.end}".`
      );
    }

    const start =
      new Date(r.start);

    const end =
      new Date(r.end);

    if (end <= start) {
      throw new Error(
        `BUILD ERROR: ${id} end must be after start.`
      );
    }

    const exactCallStatus =
      upper(
        r.exactCallStatus ||
        'REVIEW'
      );

    if (
      ![
        'READY',
        'REVIEW',
        'HOLD'
      ].includes(
        exactCallStatus
      )
    ) {
      throw new Error(
        `BUILD ERROR: ${id} has invalid exactCallStatus ` +
        `"${r.exactCallStatus}".`
      );
    }

    const calledPeopleIds =
      Array.isArray(
        r.calledPeopleIds
      )
        ? r.calledPeopleIds
            .map(text)
            .filter(Boolean)
        : [];

    const calledPeople =
      Array.isArray(
        r.calledPeople
      )
        ? r.calledPeople
            .map(text)
            .filter(Boolean)
        : [];

    const calledGroups =
      normalizeList(
        r.calledGroups
      );

    const callGroupsSource =
      normalizeList(
        r.callGroups
      );

    /*
     * For general All Calls filtering:
     * use broad callGroups when available,
     * otherwise exact calledGroups.
     */
    const callGroups =
      callGroupsSource.length
        ? callGroupsSource
        : calledGroups;

    return {
      ...r,

      /*
       * Canonical publication marker.
       * Kept for compatibility with any remaining legacy code.
       */
      publish: true,

      id,

      eventKey:
        text(
          r.eventKey ||
          id
        ),

      title:
        text(r.title),

      start:
        text(r.start),

      end:
        text(r.end),

      status:
        text(
          r.status ||
          'CONFIRMED'
        ),

      location:
        text(r.location),

      locationShort:
        text(
          r.locationShort ||
          r.location
        ),

      called:
        text(r.called),

      calledPeople,
      calledPeopleIds,
      calledGroups,
      callGroups,

      exactCallStatus,

      callDataVersion:
        Number(
          r.callDataVersion
        ) || 3,

      work:
        text(
          r.work ||
          r.focus
        ),

      focus:
        text(
          r.focus ||
          r.work
        ),

      prep:
        text(r.prep),

      notice:
        text(r.notice),

      changeType:
        text(r.changeType)
    };
  })
  .sort(
    (a, b) =>
      new Date(a.start) -
      new Date(b.start)
  );

/*
 * Duplicate protection
 */

const seenIds =
  new Set();

for (
  const r of publishedRehearsals
) {
  if (
    seenIds.has(r.id)
  ) {
    throw new Error(
      `BUILD ERROR: duplicate rehearsal id ${r.id}.`
    );
  }

  seenIds.add(r.id);
}

/*
 * ============================================================
 * UPCOMING
 * ============================================================
 */

const futureRehearsals =
  publishedRehearsals.filter(
    r =>
      new Date(r.end) >= now
  );

const next =
  futureRehearsals[0] ||
  null;

/*
 * ============================================================
 * CURRENT WEEK
 * ============================================================
 *
 * This Week means the actual current Monday-Sunday week
 * in the production timezone.
 */

function localDateParts(date) {
  const parts =
    new Intl.DateTimeFormat(
      'en-US',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        timeZone: TZ
      }
    ).formatToParts(date);

  const get =
    type =>
      parts.find(
        p =>
          p.type === type
      )?.value;

  return {
    year:
      Number(
        get('year')
      ),

    month:
      Number(
        get('month')
      ),

    day:
      Number(
        get('day')
      ),

    weekday:
      get('weekday')
  };
}

const weekdayIndex = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
};

function dateKeyFromParts(
  year,
  month,
  day
) {
  return (
    `${String(year).padStart(4, '0')}-` +
    `${String(month).padStart(2, '0')}-` +
    `${String(day).padStart(2, '0')}`
  );
}

function shiftedDateKey(
  date,
  days
) {
  const p =
    localDateParts(date);

  /*
   * Use UTC noon for safe calendar-day arithmetic.
   */
  const shifted =
    new Date(
      Date.UTC(
        p.year,
        p.month - 1,
        p.day + days,
        12,
        0,
        0
      )
    );

  const sp =
    localDateParts(
      shifted
    );

  return dateKeyFromParts(
    sp.year,
    sp.month,
    sp.day
  );
}

function localDateKey(date) {
  const p =
    localDateParts(date);

  return dateKeyFromParts(
    p.year,
    p.month,
    p.day
  );
}

const todayParts =
  localDateParts(now);

const todayDow =
  weekdayIndex[
    todayParts.weekday
  ] ?? 0;

const currentWeekStart =
  shiftedDateKey(
    now,
    -todayDow
  );

const currentWeekEnd =
  shiftedDateKey(
    now,
    7 - todayDow
  );

const thisWeek =
  publishedRehearsals.filter(
    r => {
      const key =
        localDateKey(
          new Date(r.start)
        );

      return (
        key >=
          currentWeekStart &&
        key <
          currentWeekEnd
      );
    }
  );

/*
 * ============================================================
 * COMPANY SCRIPTS
 * ============================================================
 */

const companyScripts =
  scripts.map(
    s => {
      if (
        s.companyPublish &&
        s.approved
      ) {
        return s;
      }

      return {
        ...s,
        readUrl: '#',
        pdfUrl: '#'
      };
    }
  );

/*
 * ============================================================
 * COMPANY MUSIC
 * ============================================================
 */

const companyMusic =
  music.map(
    m => {
      if (
        m.companyPublish &&
        m.approved
      ) {
        return m;
      }

      return {
        ...m,
        playUrl: '#',
        lyricsUrl: '#'
      };
    }
  );

/*
 * ============================================================
 * AVAILABLE CALL GROUPS
 * ============================================================
 */

const scheduleGroups =
  [
    ...new Set(
      publishedRehearsals
        .flatMap(
          r =>
            r.callGroups
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      a.localeCompare(b)
  );

/*
 * ============================================================
 * SCHEDULE PAYLOAD
 * ============================================================
 *
 * IMPORTANT:
 * Exact Calls fields MUST reach content.json.
 */

const scheduleRehearsals =
  publishedRehearsals.map(
    r => ({
      id:
        r.id,

      eventKey:
        r.eventKey,

      start:
        r.start,

      end:
        r.end,

      date:
        r.dateLabel ||
        r.dayLabel ||
        r.id,

      day:
        r.dayLabel ||
        r.dateLabel ||
        r.id,

      dateLabel:
        text(
          r.dateLabel
        ),

      dayLabel:
        text(
          r.dayLabel
        ),

      time:
        timeRange(r),

      title:
        r.title,

      status:
        r.status,

      location:
        r.location,

      locationShort:
        r.locationShort,

      called:
        r.called,

      /*
       * General All Calls filter
       */
      callGroups:
        r.callGroups,

      /*
       * Exact My Calls
       */
      calledPeople:
        r.calledPeople,

      calledPeopleIds:
        r.calledPeopleIds,

      calledGroups:
        r.calledGroups,

      exactCallStatus:
        r.exactCallStatus,

      callDataVersion:
        r.callDataVersion,

      work:
        r.work,

      focus:
        r.focus,

      prep:
        r.prep,

      notice:
        r.notice,

      changeType:
        r.changeType
    })
  );

/*
 * ============================================================
 * CONTENT
 * ============================================================
 */

const content = {
  updated:
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: TZ
      }
    ).format(now),

  announcement:
    site.announcement ||
    '',

  links:
    site.links,

  /*
   * HOME
   *
   * Kept for backwards compatibility.
   * Current app.js may also calculate next rehearsal
   * from schedule.rehearsals.
   */
  nextRehearsal:
    next
      ? {
          day:
            next.dayLabel ||
            next.dateLabel ||
            'NEXT REHEARSAL',

          date:
            next.title,

          time:
            timeRange(next),

          location:
            next.locationShort ||
            next.location,

          focus:
            next.focus ||
            next.work,

          url:
            'schedule.html'
        }
      : {
          day:
            'NEXT REHEARSAL',

          date:
            'No published rehearsal',

          time:
            '',

          location:
            '',

          focus:
            'Check the schedule.',

          url:
            'schedule.html'
        },

  /*
   * THIS WEEK
   */

  thisWeek: {
    label:
      'THIS WEEK',

    title:
      'This Week',

    intro:
      'Check your call time first. Then review exactly what you are working on before rehearsal.',

    rehearsals:
      thisWeek.map(
        r => ({
          id:
            r.id,

          eventKey:
            r.eventKey,

          date:
            r.dateLabel ||
            r.dayLabel ||
            r.id,

          time:
            timeRange(r),

          title:
            r.title,

          status:
            r.status,

          location:
            r.location,

          called:
            r.called,

          work:
            r.work,

          prep:
            r.prep,

          notice:
            r.notice,

          scriptUrl:
            'scripts.html',

          musicUrl:
            'music.html'
        })
      )
  },

  /*
   * SCHEDULE
   */

  schedule: {
    title:
      'Production Schedule',

    intro:
      'Current published rehearsal dates, call times, locations, assignments and preparation.',

    availableGroups:
      scheduleGroups,

    rehearsals:
      scheduleRehearsals
  },

  scripts:
    companyScripts,

  music:
    companyMusic
};

/*
 * ============================================================
 * FINAL SAFETY CHECKS
 * ============================================================
 */

if (
  publishedRehearsals.length ===
  0
) {
  throw new Error(
    'FINAL BUILD ERROR: zero published rehearsals. ' +
    'Refusing to generate an empty Hub.'
  );
}

if (
  scheduleRehearsals.length !==
  publishedRehearsals.length
) {
  throw new Error(
    'FINAL BUILD ERROR: schedule payload lost rehearsal records.'
  );
}

if (
  futureRehearsals.length >
    0 &&
  !next
) {
  throw new Error(
    'FINAL BUILD ERROR: upcoming rehearsals exist but no next rehearsal was selected.'
  );
}

if (
  futureRehearsals.length >
    0 &&
  content.schedule
    .rehearsals
    .filter(
      r =>
        new Date(r.end) >=
        now
    )
    .length === 0
) {
  throw new Error(
    'FINAL BUILD ERROR: upcoming rehearsals exist but Schedule would display none.'
  );
}

/*
 * ============================================================
 * WRITE CONTENT.JSON
 * ============================================================
 */

fs.writeFileSync(
  'content.json',

  JSON.stringify(
    content,
    null,
    2
  ) + '\n'
);

/*
 * ============================================================
 * BUILD REPORT
 * ============================================================
 */

console.log(
  ''
);

console.log(
  'CHOSEN HUB BUILD SUMMARY'
);

console.log(
  '------------------------'
);

console.log(
  `Source rehearsal records: ${rehearsals.length}`
);

console.log(
  `Published Hub rehearsals: ${publishedRehearsals.length}`
);

console.log(
  `Upcoming rehearsals: ${futureRehearsals.length}`
);

console.log(
  `This Week rehearsals: ${thisWeek.length}`
);

console.log(
  `Schedule payload rehearsals: ${scheduleRehearsals.length}`
);

console.log(
  `Call groups: ${scheduleGroups.length}`
);

if (next) {
  console.log(
    `Next rehearsal: ${next.id} | ${next.title} | ${next.start}`
  );
} else {
  console.log(
    'Next rehearsal: NONE'
  );
}

console.log(
  '------------------------'
);

console.log(
  'Generated content.json successfully.'
);
