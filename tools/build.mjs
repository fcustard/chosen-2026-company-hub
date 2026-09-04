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
 * BASIC HELPERS
 * ============================================================
 */

function isValidDateValue(value) {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}

function hasRenderableDateFallback(r) {
  if (
    String(
      r.dateLabel || ''
    ).trim()
  ) {
    return true;
  }

  if (
    String(
      r.dayLabel || ''
    ).trim()
  ) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(r.id || '')
  );
}

function normalizeText(value) {
  return String(
    value ?? ''
  ).trim();
}

function normalizeUpper(value) {
  return normalizeText(value)
    .toUpperCase();
}

/*
 * Accept arrays OR legacy semicolon/comma strings.
 *
 * This is important because Exact Calls V1.1 stores
 * groups as arrays, while older Hub data used strings.
 */
function normalizeList(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map(v =>
            normalizeText(v)
          )
          .filter(Boolean)
      )
    ];
  }

  return [
    ...new Set(
      String(value || '')
        .split(/[;,]/)
        .map(v =>
          normalizeText(v)
        )
        .filter(Boolean)
    )
  ];
}

/*
 * ============================================================
 * PUBLICATION CONTRACT
 * ============================================================
 *
 * data/rehearsals.json is now a published-only Hub file.
 *
 * The preferred contract is:
 *   publish === true
 *
 * We retain a defensive Exact Calls V1.1 fallback so an older
 * cached/generated record cannot silently wipe out the Hub.
 *
 * Publication status controls Home / This Week / All Calls.
 * Exact Call status controls My Calls ONLY.
 */

function isHubPublished(r) {
  if (!r) return false;

  if (r.publish === true) {
    return true;
  }

  /*
   * Defensive compatibility for Exact Calls V1.1.
   *
   * The hub-v2 feed itself is already filtered by the
   * Master Calendar Publish? field.
   */
  if (
    Number(r.callDataVersion) === 3 &&
    r.eventKey
  ) {
    console.warn(
      `⚠️ Publication compatibility warning: ` +
      `${r.id || r.eventKey} is Exact Calls V1.1 data ` +
      `without publish=true. Treating it as published.`
    );

    return true;
  }

  return false;
}

function isNoRehearsal(r) {
  const status =
    normalizeUpper(r.status);

  const title =
    normalizeUpper(r.title);

  return (
    status === 'NO REHEARSAL' ||
    title.includes('NO REHEARSAL')
  );
}

/*
 * ============================================================
 * SOURCE VALIDATION
 * ============================================================
 */

if (!Array.isArray(rehearsals)) {
  throw new Error(
    'BUILD ERROR: data/rehearsals.json must be an array.'
  );
}

/*
 * Validate everything that is eligible for publication.
 */
for (
  const r of rehearsals.filter(
    isHubPublished
  )
) {
  const id =
    r.id ||
    r.eventKey ||
    r.title ||
    'unknown rehearsal';

  if (isNoRehearsal(r)) {
    throw new Error(
      `BUILD ERROR: ${id} is a NO REHEARSAL/admin row ` +
      `and must not be present in published Hub rehearsal data.`
    );
  }

  if (
    !isValidDateValue(r.start)
  ) {
    if (
      hasRenderableDateFallback(r)
    ) {
      console.warn(
        `⚠️ Schedule warning: ${id} has an invalid/missing ` +
        `start timestamp; date badge will use fallback data.`
      );
    } else {
      throw new Error(
        `SCHEDULE PUBLISHING ERROR: ${id} has no valid start ` +
        `timestamp, dateLabel, dayLabel, or YYYY-MM-DD id.`
      );
    }
  }

  if (
    !isValidDateValue(r.end)
  ) {
    throw new Error(
      `SCHEDULE PUBLISHING ERROR: ${id} has an invalid/missing ` +
      `end timestamp.`
    );
  }

  const start =
    new Date(r.start);

  const end =
    new Date(r.end);

  if (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    end <= start
  ) {
    throw new Error(
      `SCHEDULE PUBLISHING ERROR: ${id} end must be after start.`
    );
  }
}

/*
 * ============================================================
 * PUBLISHED SCHEDULE
 * ============================================================
 */

const publishedRehearsals =
  rehearsals
    .filter(isHubPublished)
    .filter(r =>
      !isNoRehearsal(r)
    )
    .sort((a, b) => {
      const aTime =
        isValidDateValue(a.start)
          ? new Date(a.start)
              .getTime()
          : Number.MAX_SAFE_INTEGER;

      const bTime =
        isValidDateValue(b.start)
          ? new Date(b.start)
              .getTime()
          : Number.MAX_SAFE_INTEGER;

      return aTime - bTime;
    });

/*
 * Permanent guard against the "green build, empty Hub" problem.
 */
if (
  rehearsals.length > 0 &&
  publishedRehearsals.length === 0
) {
  throw new Error(
    'BUILD CONTRACT ERROR: rehearsal source data exists, but ' +
    'zero rehearsals qualified for Hub publication. ' +
    'Build stopped to prevent an empty Home / This Week / Schedule.'
  );
}

const futureRehearsals =
  publishedRehearsals.filter(
    r =>
      isValidDateValue(r.end) &&
      new Date(r.end) >= now
  );

/*
 * If published future rehearsal data exists, the build must not
 * silently lose it.
 */
const sourceFutureCount =
  rehearsals.filter(
    r =>
      isHubPublished(r) &&
      !isNoRehearsal(r) &&
      isValidDateValue(r.end) &&
      new Date(r.end) >= now
  ).length;

if (
  sourceFutureCount > 0 &&
  futureRehearsals.length === 0
) {
  throw new Error(
    'BUILD CONTRACT ERROR: upcoming published rehearsals exist ' +
    'in source data, but none survived schedule generation.'
  );
}

/*
 * ============================================================
 * TIME HELPERS
 * ============================================================
 */

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

function timeRange(rehearsal) {
  const start =
    new Date(
      rehearsal.start
    );

  const end =
    new Date(
      rehearsal.end
    );

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
 * NEXT REHEARSAL
 * ============================================================
 *
 * Home uses this company publication data.
 * It does NOT use personalization.
 */

const next =
  futureRehearsals[0] ||
  null;

/*
 * ============================================================
 * THIS WEEK
 * ============================================================
 *
 * Anchor the week to the next future rehearsal.
 *
 * If no future rehearsal exists, anchor to today.
 */

const anchor =
  futureRehearsals[0] &&
  isValidDateValue(
    futureRehearsals[0].start
  )
    ? new Date(
        futureRehearsals[0].start
      )
    : now;

/*
 * Use a date-only representation in the production timezone
 * to avoid UTC weekday drift.
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
        p => p.type === type
      )?.value;

  return {
    year: Number(
      get('year')
    ),
    month: Number(
      get('month')
    ),
    day: Number(
      get('day')
    ),
    weekday: get(
      'weekday'
    )
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

function localDateKey(date) {
  const p =
    localDateParts(date);

  return (
    `${String(p.year).padStart(4, '0')}-` +
    `${String(p.month).padStart(2, '0')}-` +
    `${String(p.day).padStart(2, '0')}`
  );
}

function shiftLocalDateKey(
  date,
  days
) {
  const p =
    localDateParts(date);

  /*
   * Noon UTC avoids DST/date-edge problems while doing
   * calendar-day arithmetic.
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
    localDateParts(shifted);

  return (
    `${String(sp.year).padStart(4, '0')}-` +
    `${String(sp.month).padStart(2, '0')}-` +
    `${String(sp.day).padStart(2, '0')}`
  );
}

const anchorParts =
  localDateParts(anchor);

const anchorDow =
  weekdayIndex[
    anchorParts.weekday
  ] ?? 0;

const weekStartKey =
  shiftLocalDateKey(
    anchor,
    -anchorDow
  );

const weekEndKey =
  shiftLocalDateKey(
    anchor,
    7 - anchorDow
  );

const thisWeek =
  publishedRehearsals.filter(
    r => {
      if (
        !isValidDateValue(
          r.start
        )
      ) {
        return false;
      }

      const key =
        localDateKey(
          new Date(r.start)
        );

      return (
        key >= weekStartKey &&
        key < weekEndKey
      );
    }
  );

/*
 * ============================================================
 * SCRIPT / MUSIC PUBLICATION
 * ============================================================
 */

const companyScripts =
  scripts.map(s => {
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
  });

const companyMusic =
  music.map(m => {
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
  });

/*
 * ============================================================
 * CALL GROUPS
 * ============================================================
 */

const scheduleGroups =
  [
    ...new Set(
      publishedRehearsals
        .flatMap(r => {
          /*
           * General schedule filtering can use the
           * published call-group field.
           *
           * Exact calledGroups remains available separately
           * for My Calls.
           */
          const broad =
            normalizeList(
              r.callGroups
            );

          const exact =
            normalizeList(
              r.calledGroups
            );

          return [
            ...broad,
            ...exact
          ];
        })
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
 * CRITICAL:
 * Do NOT strip Exact Calls V1.1 fields here.
 *
 * app.js needs:
 * - exactCallStatus
 * - calledPeopleIds
 * - calledGroups
 * - callDataVersion
 */

const scheduleRehearsals =
  publishedRehearsals.map(
    r => {
      const broadCallGroups =
        normalizeList(
          r.callGroups
        );

      const exactCalledGroups =
        normalizeList(
          r.calledGroups
        );

      const calledPeopleIds =
        Array.isArray(
          r.calledPeopleIds
        )
          ? r.calledPeopleIds
              .map(v =>
                normalizeText(v)
              )
              .filter(Boolean)
          : [];

      const calledPeople =
        Array.isArray(
          r.calledPeople
        )
          ? r.calledPeople
              .map(v =>
                normalizeText(v)
              )
              .filter(Boolean)
          : [];

      return {
        /*
         * Core schedule fields
         */
        id:
          r.id ||
          r.eventKey ||
          '',

        eventKey:
          r.eventKey ||
          r.id ||
          '',

        start:
          r.start ||
          '',

        end:
          r.end ||
          '',

        date:
          r.dateLabel ||
          r.dayLabel ||
          r.id ||
          '',

        day:
          r.dayLabel ||
          r.dateLabel ||
          r.id ||
          '',

        dateLabel:
          r.dateLabel ||
          '',

        dayLabel:
          r.dayLabel ||
          '',

        time:
          timeRange(r),

        title:
          r.title ||
          '',

        status:
          r.status ||
          'CONFIRMED',

        location:
          r.location ||
          '',

        locationShort:
          r.locationShort ||
          r.location ||
          '',

        called:
          r.called ||
          '',

        /*
         * General schedule filtering
         */
        callGroups:
          broadCallGroups.length
            ? broadCallGroups
            : exactCalledGroups,

        /*
         * Exact Calls V1.1
         */
        calledPeople:
          calledPeople,

        calledPeopleIds:
          calledPeopleIds,

        calledGroups:
          exactCalledGroups,

        exactCallStatus:
          normalizeUpper(
            r.exactCallStatus
          ) ||
          'REVIEW',

        callDataVersion:
          Number(
            r.callDataVersion
          ) || 3,

        /*
         * Rehearsal detail
         */
        work:
          r.work ||
          r.focus ||
          '',

        focus:
          r.focus ||
          r.work ||
          '',

        prep:
          r.prep ||
          '',

        notice:
          r.notice ||
          '',

        changeType:
          r.changeType ||
          ''
      };
    }
  );

/*
 * ============================================================
 * CONTENT.JSON
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
   * Legacy nextRehearsal remains available for compatibility,
   * even though current Home app.js can derive next rehearsal
   * directly from schedule.rehearsals.
   */
  nextRehearsal:
    next
      ? {
          day:
            next.dayLabel ||
            next.dateLabel ||
            next.id ||
            'NEXT REHEARSAL',

          date:
            next.title ||
            'See schedule',

          time:
            timeRange(next),

          location:
            next.locationShort ||
            next.location ||
            '',

          focus:
            next.focus ||
            next.work ||
            '',

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
            r.id ||
            r.eventKey ||
            '',

          eventKey:
            r.eventKey ||
            r.id ||
            '',

          date:
            r.dateLabel ||
            r.dayLabel ||
            r.id ||
            '',

          time:
            timeRange(r),

          title:
            r.title ||
            '',

          status:
            r.status ||
            '',

          location:
            r.location ||
            '',

          called:
            r.called ||
            '',

          work:
            r.work ||
            r.focus ||
            '',

          prep:
            r.prep ||
            '',

          notice:
            r.notice ||
            '',

          scriptUrl:
            'scripts.html',

          musicUrl:
            'music.html'
        })
      )
  },

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
 * FINAL OUTPUT GUARDS
 * ============================================================
 */

if (
  futureRehearsals.length > 0 &&
  content.schedule.rehearsals.length === 0
) {
  throw new Error(
    'FINAL BUILD ERROR: future rehearsals exist, but content.json ' +
    'schedule would be empty.'
  );
}

if (
  futureRehearsals.length > 0 &&
  !content.nextRehearsal
) {
  throw new Error(
    'FINAL BUILD ERROR: future rehearsals exist, but nextRehearsal ' +
    'was not generated.'
  );
}

fs.writeFileSync(
  'content.json',
  JSON.stringify(
    content,
    null,
    2
  ) + '\n'
);

console.log(
  `Generated content.json successfully: ` +
  `${publishedRehearsals.length} published rehearsals, ` +
  `${futureRehearsals.length} upcoming, ` +
  `${thisWeek.length} this week, ` +
  `${scheduleGroups.length} call groups.`
);

if (
  next
) {
  console.log(
    `Next published rehearsal: ` +
    `${next.id || next.eventKey || next.title}`
  );
} else {
  console.warn(
    'No future published rehearsal is currently available.'
  );
}
