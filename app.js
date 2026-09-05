async function load() {
  try {
    const r = await fetch('content.json', { cache: 'no-store' });
    return await r.json();
  } catch (e) {
    return null;
  }
}

function link(el, u) {
  if (!el || !u || u === '#') return;

  el.href = u;

  if (u.startsWith('http')) {
    el.target = '_blank';
    el.rel = 'noopener';
  }
}

function esc(v = '') {
  return String(v).replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
  );
}

function lines(v = '') {
  return esc(v).replace(/\r?\n/g, '<br>');
}

function btn(t, u, c = '') {
  return !u || u === '#'
    ? `<span class="btn ${c}" aria-disabled="true">${esc(t)} soon</span>`
    : `<a class="btn ${c}" href="${esc(u)}" ${
        u.startsWith('http')
          ? 'target="_blank" rel="noopener"'
          : ''
      }>${esc(t)}</a>`;
}


/**
 * Resource payloads may arrive in either of these shapes:
 *
 *   scripts: [ ... ]
 *
 * or
 *
 *   scripts: {
 *     items: [ ... ],
 *     current: [ ... ],
 *     count: 12
 *   }
 *
 * The current build.mjs uses the object shape. Older app.js expected
 * the array shape, which made Scripts and Music render blank even when
 * content.json contained valid resources.
 */
function resourceList(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object') {
    if (Array.isArray(payload.current) && payload.current.length) {
      return payload.current;
    }

    if (Array.isArray(payload.items)) {
      return payload.items;
    }

    if (Array.isArray(payload.resources)) {
      return payload.resources;
    }

    if (Array.isArray(payload.files)) {
      return payload.files;
    }
  }

  return [];
}

function emptyResourceCard(title, message) {
  return `
    <article class="row">
      <div class="badge">—</div>

      <div>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
      </div>
    </article>
  `;
}

/**
 * CHOSEN 2026 — Next Published Rehearsal
 *
 * IMPORTANT:
 * Home's "Next Rehearsal" is determined from the published
 * company rehearsal schedule.
 *
 * It deliberately ignores:
 * - saved person
 * - My Calls
 * - calledPeopleIds
 * - calledGroups
 * - exactCallStatus
 *
 * Publication determines whether the rehearsal exists.
 * Exact Calls determines whether a specific person is called.
 */
function getNextPublishedRehearsal(rehearsals, now = new Date()) {
  if (!Array.isArray(rehearsals)) return null;

  return rehearsals
    .filter(r => {
      if (!r || !r.start || !r.end || !r.title) return false;

      const status = String(r.status || '')
        .trim()
        .toUpperCase();

      const title = String(r.title || '')
        .trim()
        .toUpperCase();

      if (status === 'NO REHEARSAL') return false;
      if (title.includes('NO REHEARSAL')) return false;

      const start = new Date(r.start);
      const end = new Date(r.end);

      if (Number.isNaN(start.getTime())) return false;
      if (Number.isNaN(end.getTime())) return false;

      return end >= now;
    })
    .sort(
      (a, b) =>
        new Date(a.start).getTime() -
        new Date(b.start).getTime()
    )[0] || null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const m = document.querySelector('#menuBtn');
  const n = document.querySelector('#nav');

  if (m && n) {
    m.onclick = () => {
      const o = n.classList.toggle('open');
      m.setAttribute('aria-expanded', o);
    };

    n.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        n.classList.remove('open');
        m.setAttribute('aria-expanded', 'false');
      })
    );
  }

  const d = await load();

  if (!d) return;

  document.querySelectorAll('[data-link]').forEach(a =>
    link(a, d.links?.[a.dataset.link])
  );

  const u = document.querySelector('#updated');

  if (u) {
    u.textContent = d.updated
      ? `Updated ${d.updated}`
      : '';
  }

  /*
   * ============================================================
   * HOME
   * ============================================================
   */

  if (document.body.dataset.page === 'home') {
    const rehearsals = d.schedule?.rehearsals || [];
    const x = getNextPublishedRehearsal(rehearsals);

    const nrDay = document.querySelector('#nrDay');
    const nrDate = document.querySelector('#nrDate');
    const nrTime = document.querySelector('#nrTime');
    const nrLocation = document.querySelector('#nrLocation');
    const nrFocus = document.querySelector('#nrFocus');
    const nrLink = document.querySelector('#nrLink');

    if (x) {
      const start = new Date(x.start);
      const end = new Date(x.end);

      const dayLabel =
        x.day ||
        new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          timeZone: 'America/New_York'
        }).format(start);

      const dateLabel =
        x.date ||
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/New_York'
        }).format(start);

      const startTime =
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York'
        }).format(start);

      const endTime =
        new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York'
        }).format(end);

      const timeLabel =
        x.time ||
        `${startTime} – ${endTime}`;

      if (nrDay) {
        nrDay.textContent = dayLabel;
      }

      if (nrDate) {
        nrDate.textContent = dateLabel;
      }

      if (nrTime) {
        nrTime.textContent = timeLabel;
      }

      if (nrLocation) {
        nrLocation.textContent =
          x.locationShort ||
          x.location ||
          'Location TBD';
      }

      if (nrFocus) {
        nrFocus.textContent =
          x.focus ||
          x.work ||
          x.title ||
          'Upcoming rehearsal';
      }

      if (nrLink) {
        nrLink.textContent = 'Open rehearsal plan';
        nrLink.href = 'schedule.html';
        nrLink.removeAttribute('target');
        nrLink.removeAttribute('rel');
      }
    } else {
      if (nrDay) {
        nrDay.textContent = 'NEXT REHEARSAL';
      }

      if (nrDate) {
        nrDate.textContent = 'No published rehearsal';
      }

      if (nrTime) {
        nrTime.textContent = '';
      }

      if (nrLocation) {
        nrLocation.textContent = '';
      }

      if (nrFocus) {
        nrFocus.textContent = 'Check the schedule.';
      }

      if (nrLink) {
        nrLink.textContent = 'Open rehearsal plan';
        nrLink.href = 'schedule.html';
        nrLink.removeAttribute('target');
        nrLink.removeAttribute('rel');
      }
    }
  }

  /*
   * ============================================================
   * THIS WEEK
   * ============================================================
   */

  if (document.body.dataset.page === 'week') {
    const w = d.thisWeek || {};

    weekLabel.textContent =
      w.label || 'THIS WEEK';

    weekTitle.textContent =
      w.title || 'This Week';

    weekIntro.textContent =
      'Your call time, assignment and prep—everything you need before rehearsal.';

    weekList.innerHTML = (w.rehearsals || [])
      .map(
        x => `
          <article class="rehearsal">
            <div class="rehTop">
              <div>
                <p class="ey">${esc(x.date)}</p>
                <h2>${esc(x.title)}</h2>
              </div>
              <span class="status">${esc(x.status)}</span>
            </div>

            <div class="rehFacts">
              <div>
                <b>WHEN</b>
                <span>${esc(x.time)}</span>
              </div>

              <div>
                <b>WHERE</b>
                <span>${esc(x.location)}</span>
              </div>
            </div>

            <div class="rehBody">
              <div>
                <b>WHO IS CALLED</b>
                <p>${lines(x.called)}</p>
              </div>

              <div>
                <b>WHAT WE'RE WORKING ON</b>
                <p>${lines(x.work)}</p>
              </div>

              <div>
                <b>PREP</b>
                <p>${lines(x.prep)}</p>
              </div>

              ${
                x.notice
                  ? `
                    <div class="callout">
                      <b>IMPORTANT</b>
                      <p>${lines(x.notice)}</p>
                    </div>
                  `
                  : ''
              }
            </div>

            <div class="actions">
              ${btn(
                'Scripts',
                x.scriptUrl || (resourceList(d.scripts).length ? 'scripts.html' : '#'),
                'primary'
              )}
              ${btn(
                'Music',
                x.musicUrl || (resourceList(d.music).length ? 'music.html' : '#')
              )}
              <a class="btn" href="schedule.html">
                Full schedule
              </a>
            </div>
          </article>
        `
      )
      .join('');

    const help = document.querySelector('.help');

    if (help) {
      const h = help.querySelector('h2');

      if (h) {
        h.textContent = 'Before you leave home';
      }

      const p = help.querySelector('p');

      if (p) {
        p.textContent =
          'Check the Hub before you leave. Call times, locations and assignments here are the current company information.';
      }

      const a = help.querySelector('a');

      if (a) {
        a.textContent = 'Open full schedule';
        a.href = 'schedule.html';
        a.removeAttribute('target');
        a.removeAttribute('rel');
      }
    }
  }

  /*
   * ============================================================
   * SCRIPTS
   * ============================================================
   */

  if (document.body.dataset.page === 'scripts') {
    const list = document.querySelector('#scriptsList');
    const scripts = resourceList(d.scripts);

    if (list) {
      list.innerHTML = scripts.length
        ? scripts
            .map(
              s => `
                <article class="row">
                  <div class="badge">
                    ${esc(s.scene || s.id || '')}
                  </div>

                  <div>
                    <h3>${esc(s.title || s.name || 'Untitled script')}</h3>
                    <p>${esc(s.status || 'Current company material')}</p>
                  </div>

                  <div class="actions">
                    ${btn('Read', s.readUrl || s.url, 'primary')}
                    ${btn('PDF', s.pdfUrl)}
                  </div>
                </article>
              `
            )
            .join('')
        : emptyResourceCard(
            'Scripts coming soon',
            'No current script materials are published to the company Hub yet.'
          );
    }
  }

  /*
   * ============================================================
   * MUSIC
   * ============================================================
   */

  if (document.body.dataset.page === 'music') {
    const list = document.querySelector('#musicList');
    const music = resourceList(d.music);

    if (list) {
      list.innerHTML = music.length
        ? music
            .map(
              x => `
                <article class="row">
                  <div class="badge">♪</div>

                  <div>
                    <h3>${esc(x.title || x.name || 'Untitled track')}</h3>
                    <p>
                      ${esc(x.type || 'Music')} · ${esc(x.status || 'Current')}
                    </p>
                  </div>

                  <div class="actions">
                    ${btn('Play', x.playUrl || x.url, 'primary')}
                    ${btn('Lyrics', x.lyricsUrl)}
                  </div>
                </article>
              `
            )
            .join('')
        : emptyResourceCard(
            'Music coming soon',
            'No current rehearsal tracks are published to the company Hub yet.'
          );
    }
  }

  /*
   * ============================================================
   * SCHEDULE
   * ============================================================
   */

  if (document.body.dataset.page === 'schedule') {
    const all = d.schedule?.rehearsals || [];
    const now = new Date();

    const allGroups =
      d.schedule?.availableGroups || [];

    const storageKey =
      'chosen2026-call-groups';

    const personKey =
      'chosen2026-person';

    let personalView = false;
    let person = null;

    try {
      const personId =
        localStorage.getItem(personKey);

      if (personId) {
        const rr = await fetch(
          'company.json',
          { cache: 'no-store' }
        );

        if (rr.ok) {
          const roster = await rr.json();

          person =
            (roster.people || []).find(
              p => p.id === personId
            ) || null;

          personalView = !!person;
        }
      }
    } catch (e) {}

    function norm(v = '') {
      return String(v)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    }

    function parseDateParts(x) {
      const dt = new Date(x.start);

      return {
        dow: new Intl.DateTimeFormat(
          'en-US',
          {
            weekday: 'short',
            timeZone: 'America/New_York'
          }
        )
          .format(dt)
          .toUpperCase(),

        mon: new Intl.DateTimeFormat(
          'en-US',
          {
            month: 'short',
            timeZone: 'America/New_York'
          }
        )
          .format(dt)
          .toUpperCase(),

        day: new Intl.DateTimeFormat(
          'en-US',
          {
            day: '2-digit',
            timeZone: 'America/New_York'
          }
        ).format(dt)
      };
    }

    function locationInfo(x) {
      const raw =
        String(x.location || '').trim();

      const short =
        String(
          x.locationShort ||
          raw ||
          'TBD'
        ).trim();

      const isUrl =
        /^https?:\/\//i.test(raw);

      const isVirtual =
        isUrl ||
        /zoom|virtual|off[- ]?site/i.test(
          raw + ' ' + short
        );

      let address =
        raw.includes('|')
          ? raw
              .split('|')
              .slice(1)
              .join('|')
              .trim()
          : raw;

      if (!address || address === 'TBD') {
        address = short;
      }

      return {
        raw,
        short,
        isUrl,
        isVirtual,
        address
      };
    }

    function mapChoices(x) {
      const loc = locationInfo(x);

      if (loc.isUrl) {
        return `
          <a
            class="locationLink"
            href="${esc(loc.raw)}"
            target="_blank"
            rel="noopener"
          >
            Join virtual rehearsal ↗
          </a>
        `;
      }

      if (loc.isVirtual) {
        return `
          <span class="locationPlain">
            ${esc(loc.short)}
          </span>
        `;
      }

      if (
        !loc.address ||
        loc.address === 'TBD'
      ) {
        return `
          <span class="locationPlain">
            ${esc(loc.short)}
          </span>
        `;
      }

      const q =
        encodeURIComponent(loc.address);

      const apple =
        `https://maps.apple.com/?q=${q}`;

      const google =
        `https://www.google.com/maps/search/?api=1&query=${q}`;

      const waze =
        `https://www.waze.com/ul?q=${q}&navigate=yes`;

      return `
        <details class="directionsMenu">
          <summary class="locationLink">
            ${esc(loc.short)}
            <span aria-hidden="true">↗</span>
          </summary>

          <div class="directionsChoices">
            <a
              href="${google}"
              target="_blank"
              rel="noopener"
            >
              Google Maps
            </a>

            <a
              href="${apple}"
              target="_blank"
              rel="noopener"
            >
              Apple Maps
            </a>

            <a
              href="${waze}"
              target="_blank"
              rel="noopener"
            >
              Waze
            </a>
          </div>
        </details>
      `;
    }

    let selected = [];

    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey) ||
        '[]'
      );

      if (Array.isArray(saved)) {
        selected = saved.filter(
          g => allGroups.includes(g)
        );
      }
    } catch (e) {}

    const filterWrap =
      document.querySelector(
        '#callGroupFilters'
      );

    const filterCount =
      document.querySelector(
        '#filterCount'
      );

    const upcomingList =
      document.querySelector(
        '#upcomingSchedule'
      );

    const pastList =
      document.querySelector(
        '#pastSchedule'
      );

    const upcomingEmpty =
      document.querySelector(
        '#upcomingEmpty'
      );

    const clearBtn =
      document.querySelector(
        '#clearCallFilters'
      );

    const personalPanel =
      document.querySelector(
        '#personalSchedulePanel'
      );

    const personalTitle =
      document.querySelector(
        '#personalScheduleTitle'
      );

    const personalLead =
      document.querySelector(
        '#personalScheduleLead'
      );

    const showMine =
      document.querySelector(
        '#showMyCalls'
      );

    const showAll =
      document.querySelector(
        '#showAllCalls'
      );

    const groupPanel =
      document.querySelector(
        '#groupFilterPanel'
      );

    /*
     * EXACT PERSONALIZATION
     *
     * Do not infer broad role groups when
     * Exact Calls data exists.
     */
    function personMatches(x) {
      if (!person) return true;

      const status =
        String(
          x.exactCallStatus || ''
        )
          .trim()
          .toUpperCase();

      const hasExactCallData =
        Number(x.callDataVersion) === 3 ||
        Object.prototype.hasOwnProperty.call(
          x,
          'exactCallStatus'
        ) ||
        Array.isArray(x.calledPeopleIds) ||
        Array.isArray(x.calledGroups);

      if (hasExactCallData) {
        if (status !== 'READY') {
          return false;
        }

        const personId =
          String(person.id || '').trim();

        const calledPeopleIds =
          Array.isArray(x.calledPeopleIds)
            ? x.calledPeopleIds
                .map(v =>
                  String(v || '').trim()
                )
                .filter(Boolean)
            : [];

        const calledGroups =
          Array.isArray(x.calledGroups)
            ? x.calledGroups
                .map(v =>
                  String(v || '').trim()
                )
                .filter(Boolean)
            : [];

        if (
          personId &&
          calledPeopleIds.includes(personId)
        ) {
          return true;
        }

        if (
          calledGroups.includes(
            'Full Company'
          )
        ) {
          return true;
        }

        const personGroups =
          Array.isArray(person.groups)
            ? person.groups
                .map(v =>
                  String(v || '').trim()
                )
                .filter(Boolean)
            : [];

        return personGroups.some(
          group =>
            calledGroups.includes(group)
        );
      }

      /*
       * Legacy fallback only.
       */
      const calledText =
        String(x.called || '')
          .toLowerCase();

      const fullName =
        String(person.name || '')
          .toLowerCase();

      if (
        fullName &&
        calledText.includes(fullName)
      ) {
        return true;
      }

      const legacyGroups =
        Array.isArray(x.callGroups)
          ? x.callGroups
          : [];

      if (
        legacyGroups.includes(
          'Full Company'
        )
      ) {
        return true;
      }

      const safeLegacyGroups =
        new Set([
          'Dancers',
          'Children/Youth',
          'Choir/Vocalists',
          'Crew/Tech'
        ]);

      const personGroups =
        Array.isArray(person.groups)
          ? person.groups
          : [];

      return personGroups.some(
        group =>
          safeLegacyGroups.has(group) &&
          legacyGroups.includes(group)
      );
    }

    function groupMatches(x) {
      if (
        personalView &&
        person
      ) {
        return personMatches(x);
      }

      if (!selected.length) {
        return true;
      }

      const groups =
        Array.isArray(x.callGroups)
          ? x.callGroups
          : [];

      if (
        groups.includes('Full Company')
      ) {
        return true;
      }

      return selected.some(
        g => groups.includes(g)
      );
    }

    function renderFilters() {
      if (!filterWrap) return;

      filterWrap.innerHTML =
        `
          <button
            type="button"
            class="filterChip${
              selected.length
                ? ''
                : ' active'
            }"
            data-all-calls="true"
            aria-pressed="${
              selected.length
                ? 'false'
                : 'true'
            }"
          >
            All Calls
          </button>
        ` +
        allGroups
          .map(g => {
            const on =
              selected.includes(g);

            return `
              <button
                type="button"
                class="filterChip${
                  on ? ' active' : ''
                }"
                data-group="${esc(g)}"
                aria-pressed="${
                  on ? 'true' : 'false'
                }"
              >
                ${esc(g)}
              </button>
            `;
          })
          .join('');

      const allCallsBtn =
        filterWrap.querySelector(
          '[data-all-calls]'
        );

      if (allCallsBtn) {
        allCallsBtn.addEventListener(
          'click',
          () => {
            selected = [];

            localStorage.removeItem(
              storageKey
            );

            renderFilters();
            renderSchedule();
          }
        );
      }

      filterWrap
        .querySelectorAll(
          '[data-group]'
        )
        .forEach(b =>
          b.addEventListener(
            'click',
            () => {
              const g =
                b.dataset.group;

              selected =
                selected.includes(g)
                  ? selected.filter(
                      x => x !== g
                    )
                  : [...selected, g];

              localStorage.setItem(
                storageKey,
                JSON.stringify(selected)
              );

              renderFilters();
              renderSchedule();
            }
          )
        );

      if (clearBtn) {
        clearBtn.hidden =
          !selected.length;

        clearBtn.onclick = () => {
          selected = [];

          localStorage.removeItem(
            storageKey
          );

          renderFilters();
          renderSchedule();
        };
      }
    }

    const card = x => {
      const dp =
        parseDateParts(x);

      return `
        <article class="scheduleCard">
          <div class="scheduleCardGrid">

            <div
              class="dateBlock"
              aria-label="${esc(
                x.day || x.date
              )}"
            >
              <span class="dateDow">
                ${dp.dow}
              </span>

              <span class="dateMonth">
                ${dp.mon}
              </span>

              <span class="dateDay">
                ${dp.day}
              </span>
            </div>

            <div class="scheduleMain">

              <div class="scheduleTop">
                <div>
                  <h2>
                    ${esc(x.title)}
                  </h2>
                </div>

                <span class="status">
                  ${esc(x.status)}
                </span>
              </div>

              <div class="scheduleFacts">

                <div>
                  <b>WHEN</b>
                  <span>
                    ${esc(x.time)}
                  </span>
                </div>

                <div>
                  <b>WHERE</b>
                  ${mapChoices(x)}
                </div>

              </div>

              <div class="groupTags">
                ${(x.callGroups || [])
                  .map(
                    g =>
                      `<span>${esc(g)}</span>`
                  )
                  .join('')}
              </div>

              <details>
                <summary>
                  View rehearsal details
                </summary>

                <div class="scheduleDetails">

                  ${
                    x.called
                      ? `
                        <div>
                          <b>WHO IS CALLED</b>
                          <p>
                            ${lines(x.called)}
                          </p>
                        </div>
                      `
                      : ''
                  }

                  ${
                    x.work
                      ? `
                        <div>
                          <b>
                            WHAT WE'RE WORKING ON
                          </b>
                          <p>
                            ${lines(x.work)}
                          </p>
                        </div>
                      `
                      : ''
                  }

                  ${
                    x.prep
                      ? `
                        <div>
                          <b>PREP</b>
                          <p>
                            ${lines(x.prep)}
                          </p>
                        </div>
                      `
                      : ''
                  }

                  ${
                    x.notice
                      ? `
                        <div class="callout">
                          <b>IMPORTANT</b>
                          <p>
                            ${lines(x.notice)}
                          </p>
                        </div>
                      `
                      : ''
                  }

                </div>
              </details>

            </div>
          </div>
        </article>
      `;
    };

    function renderSchedule() {
      const upcoming =
        all.filter(
          x =>
            new Date(x.end) >= now &&
            groupMatches(x)
        );

      const past =
        all
          .filter(
            x =>
              new Date(x.end) < now &&
              groupMatches(x)
          )
          .reverse();

      if (upcomingList) {
        upcomingList.innerHTML =
          upcoming
            .map(card)
            .join('');
      }

      if (pastList) {
        pastList.innerHTML =
          past
            .map(card)
            .join('');
      }

      if (upcomingEmpty) {
        upcomingEmpty.hidden =
          upcoming.length > 0;

        upcomingEmpty.textContent =
          personalView && person
            ? "You don't have any upcoming confirmed calls right now. Check All Calls to see the full company schedule."
            : selected.length
              ? 'No upcoming rehearsals match your selected call group(s).'
              : 'No upcoming published rehearsals.';
      }

      if (filterCount) {
        filterCount.textContent =
          personalView && person
            ? `Personalized for ${person.name}`
            : selected.length
              ? `${selected.length} call group${
                  selected.length === 1
                    ? ''
                    : 's'
                } selected`
              : 'Showing all calls';
      }
    }

    function renderPersonalControls() {
      if (!person) {
        if (personalPanel) {
          personalPanel.hidden = true;
        }

        if (groupPanel) {
          groupPanel.hidden = false;
        }

        return;
      }

      if (personalPanel) {
        personalPanel.hidden = false;

        const first =
          String(person.name || '')
            .split(/\s+/)[0] || '';

        if (personalTitle) {
          personalTitle.textContent =
            `${first}, here are your calls`;
        }

        if (personalLead) {
          personalLead.textContent =
            personalView
              ? 'Showing only rehearsals you are specifically called for.'
              : 'Showing the full company schedule.';
        }
      }

      if (groupPanel) {
        groupPanel.hidden =
          personalView;
      }

      if (showMine) {
        showMine.classList.toggle(
          'primary',
          personalView
        );

        showMine.onclick = () => {
          personalView = true;

          renderPersonalControls();
          renderSchedule();
        };
      }

      if (showAll) {
        showAll.classList.toggle(
          'primary',
          !personalView
        );

        showAll.onclick = () => {
          personalView = false;

          renderPersonalControls();
          renderSchedule();
        };
      }
    }

    renderPersonalControls();
    renderFilters();
    renderSchedule();

    const pastToggle =
      document.querySelector(
        '#pastToggle'
      );

    const pastWrap =
      document.querySelector(
        '#pastWrap'
      );

    if (
      pastToggle &&
      pastWrap
    ) {
      pastToggle.addEventListener(
        'click',
        () => {
          const open =
            pastWrap.hidden;

          pastWrap.hidden =
            !open;

          pastToggle.textContent =
            open
              ? 'Hide past rehearsals'
              : 'Show past rehearsals';

          pastToggle.setAttribute(
            'aria-expanded',
            String(open)
          );
        }
      );
    }
  }
});
