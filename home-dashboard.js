import { findPerson, personMatchesCall, upcomingPublishedCalls, personalCallSummary, callAnchor } from './personal-calls.js?v=20261030-home1';

const personKey = 'chosen2026-person';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const paragraphs = value => esc(value).replace(/\r?\n/g, '<br>');
const list = value => Array.isArray(value) ? value : value?.current?.length ? value.current : value?.items || [];

// Use explicitly numbered scenes in the call title. Do not turn generic prep
// prose, dates, or rehearsal times into scene assignments.
export function callScenes(call) {
  const numbers = new Set();
  const title = String(call?.title || '');
  const patterns = /\b(?:scenes?|sequence run)\s+(\d{1,2}(?:\s*(?:[–—-]|,|&|and)\s*\d{1,2})*)/gi;
  for (const match of title.matchAll(patterns)) {
    const text = match[1];
    for (const range of text.matchAll(/(\d{1,2})\s*[–—-]\s*(\d{1,2})/g)) {
      const start = Number(range[1]), end = Number(range[2]);
      if (start >= 1 && end <= 12 && start <= end) {
        for (let scene = start; scene <= end; scene++) numbers.add(scene);
      }
    }
    for (const value of text.match(/\d{1,2}/g) || []) {
      if (Number(value) >= 1 && Number(value) <= 12) numbers.add(Number(value));
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

export function preparationForCall(person, call, content) {
  const assigned = [...new Set([...(person.scenes || []), ...(person.danceScenes || [])].map(Number))];
  const numbered = callScenes(call);
  const scenes = assigned.filter(scene => !numbered.length || numbered.includes(scene)).sort((a, b) => a - b);
  const published = item => item.approved === true && item.companyPublish === true;
  const scripts = list(content.scripts).filter(item => published(item) && scenes.includes(Number(item.scene)) &&
    /^scene-\d{2}\.html$/.test(item.readUrl || ''));
  const music = list(content.music).filter(item => published(item) && item.playUrl && item.playUrl !== '#' &&
    (item.scenes || []).some(scene => scenes.includes(Number(scene))));
  return { scenes, scripts, music, callSpecific: numbered.length > 0 };
}

export function homeCallState(person, calls, now = new Date()) {
  const upcoming = upcomingPublishedCalls(calls, now);
  const call = person ? upcoming.find(item => personMatchesCall(person, item)) || null : null;
  const beforeNextCall = call ? Date.parse(call.start) : Infinity;
  const pending = upcoming.some(item =>
    Date.parse(item.start) <= beforeNextCall &&
    ['REVIEW', 'PENDING'].includes(String(item.exactCallStatus || '').trim().toUpperCase()));
  return { call, pending, companyCall: upcoming[0] || null };
}

function dateLabel(call) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric',
    timeZone: 'America/New_York' }).format(new Date(call.start));
}

function locationHtml(call) {
  const raw = String(call.location || '').trim();
  const label = call.locationShort || raw || 'Location pending';
  return /^https?:\/\//i.test(raw)
    ? `<a href="${esc(raw)}" target="_blank" rel="noopener">Join virtual rehearsal ↗</a>`
    : esc(label);
}

export async function initHomeDashboard(content, { root = document, fetcher = fetch, storage,
  clock = () => new Date() } = {}) {
  const select = root.querySelector('#homePerson');
  const panel = root.querySelector('#my-next-call');
  const preparation = root.querySelector('#homePreparation');
  const helper = root.querySelector('#homePersonHelp');
  const button = root.querySelector('#homeCallButton');
  const change = root.querySelector('#homeChangePerson');
  if (!select || !panel || !preparation || !helper || !button || !change) return;

  let people = [], selected = null, canRemember = true;
  if (!storage) {
    try { storage = globalThis.localStorage; } catch (_) { canRemember = false; }
  }
  const readSaved = () => { try { return storage.getItem(personKey); } catch (_) { canRemember = false; return ''; } };
  const remember = id => {
    try { if (id) storage.setItem(personKey, id); else storage.removeItem(personKey); }
    catch (_) { canRemember = false; }
  };
  const notify = () => root.dispatchEvent(new CustomEvent('chosen-person-change'));

  function renderPreparation(call) {
    if (!selected || !call) {
      preparation.innerHTML = `<p class="ey">YOUR NEXT STEPS</p><h2 id="homePreparationTitle">A clear plan for rehearsal.</h2>
        <p>${selected ? 'No upcoming personal call is confirmed here yet. Check the full schedule or ask production before planning your arrival.' : 'Choose your name above to see your call and the published materials for your scenes.'}</p>
        <div class="homePrepLinks"><a href="scripts.html">Browse current scenes</a><a href="music.html">Browse rehearsal tracks</a><a href="production.html">Production team plan</a></div>`;
      return;
    }
    const prep = preparationForCall(selected, call, content);
    const detailUrl = 'schedule.html#' + callAnchor(call);
    const scriptLinks = prep.scripts.map(item => `<li><a href="${esc(item.readUrl)}">Scene ${Number(item.scene)}: ${esc(item.title || item.name)}</a></li>`).join('');
    const musicLinks = prep.music.map(item => `<li><a href="music.html#track-${esc(String(item.title || item.name || '').replace(/[^a-zA-Z0-9_-]/g, '-'))}">${esc(item.title || item.name)}</a></li>`).join('');
    preparation.innerHTML = `<p class="ey">PREPARE FOR YOUR NEXT CALL</p><h2 id="homePreparationTitle">Your rehearsal plan.</h2>
      <p>${prep.callSpecific ? 'Your assigned scenes within this call' : 'Your assigned scenes'}${prep.scenes.length ? ': ' + prep.scenes.join(', ') + '.' : ': follow the instructions below.'}
      ${!prep.callSpecific && prep.scenes.length ? 'This call does not name specific scenes; use its preparation notes to guide your practice.' : ''}</p>
      <ol class="homePrepSteps">
        <li><div><h3>Check your call</h3><p>Review the full instructions and check again before you leave.</p><a href="${esc(detailUrl)}">Open call details →</a></div></li>
        <li><div><h3>Review your material</h3>${scriptLinks ? `<ul class="homeMaterialList">${scriptLinks}</ul>` : '<p>No scene script is matched to this call. Follow your department instructions.</p>'}
          ${musicLinks ? `<p class="homeMaterialLabel">Tracks for these scenes</p><ul class="homeMaterialList">${musicLinks}</ul>` : '<p>No published track is matched to these scenes.</p>'}
          <p class="homePrepHint">Use the material your rehearsal leader has assigned.</p></div></li>
        <li><div><h3>Practice and pack</h3>${call.prep ? `<p>${paragraphs(call.prep)}</p>` : '<p>Check the call details for what to prepare and bring.</p>'}
          <div class="homePrepLinks">${prep.scripts.length ? '<a href="lines.html">Practice spoken lines</a>' : ''}<a href="resources.html">Rehearsal videos & resources</a><a href="production.html">Wardrobe & production plan</a></div></div></li>
      </ol>`;
  }

  function render() {
    const { call, pending, companyCall } = homeCallState(selected, content.schedule?.rehearsals, clock());
    select.value = selected?.id || '';
    change.hidden = !selected;
    helper.textContent = canRemember
      ? 'This device remembers your choice. Checking for a child or another family member? Change person anytime.'
      : 'Your browser could not remember this choice. It applies on this page; select your name again on other pages.';
    if (!selected) {
      panel.innerHTML = `<p class="ey">START WITH YOUR NAME</p><h2 id="homeCallTitle">When are you needed?</h2>
        <p>Choose your name to see your next confirmed call, personal times, and preparation notes.</p>
        ${companyCall ? `<div class="homeCompanyPreview"><strong>Next company rehearsal</strong><p>${esc(dateLabel(companyCall))} · ${esc(companyCall.time || '')}</p><p>This overall window may differ from your personal call.</p></div>` : '<p>No upcoming company rehearsal is published.</p>'}
        <a class="homeDetailLink" href="schedule.html">View the full company schedule →</a>`;
    } else if (!call) {
      panel.innerHTML = `<p class="ey">${esc(selected.name)}</p><h2 id="homeCallTitle">No upcoming confirmed call</h2>
        <p>This does not confirm that you are excused from future rehearsals.</p>
        <p>${pending ? 'Upcoming calls are still being reviewed. Check the full schedule and ask production if you are unsure.' : 'Check the full schedule for updates and confirm any unclear instructions with production.'}</p>
        <a class="homeDetailLink" href="schedule.html">Review the full schedule →</a><a class="homeDetailLink" href="company.html#help">Ask production for help →</a>`;
    } else {
      const times = personalCallSummary(selected, call);
      const url = 'schedule.html#' + callAnchor(call);
      const timeHtml = times.report
        ? `<div><dt>Your report time</dt><dd>${esc(times.report)}</dd></div>
           ${times.through ? `<div><dt>Scheduled through</dt><dd>${esc(times.through)}</dd></div>` : ''}`
        : `<div><dt>Overall rehearsal window</dt><dd>${esc(call.time || 'See call details')}</dd></div>`;
      panel.innerHTML = `<p class="ey">${esc(selected.name)} · YOUR NEXT CONFIRMED CALL</p><h2 id="homeCallTitle">${esc(dateLabel(call))}</h2>
        <p class="homeCallName">${esc(call.title)}</p>
        ${pending ? '<p class="homeCallNotice">An earlier or overlapping company call is still under review. Check the full schedule for updates.</p>' : ''}
        <dl class="homeCallFacts">${timeHtml}<div class="homeWhere"><dt>Where</dt><dd>${locationHtml(call)}</dd></div></dl>
        ${!times.report ? '<p class="homeCallNotice">Your personal report and scheduled-through times are not published here. Review your call block or confirm with production before you travel.</p>' : !times.through && !call.showDay ? '<p class="homeCallNotice">Your personal scheduled-through time is not published. Check the call details before planning pickup.</p>' : ''}
        ${times.showtime ? `<p>Show begins: <strong>${esc(times.showtime)}</strong>. Tentative show end: ${esc(times.tentativeEnd || 'To be confirmed')}; this is not a personal release time.</p>` : ''}
        ${call.work || call.focus ? `<p><strong>Focus:</strong> ${paragraphs(call.work || call.focus)}</p>` : ''}
        ${call.prep ? `<p><strong>Prepare:</strong> ${paragraphs(call.prep)}</p>` : ''}
        ${call.notice ? `<p class="homeCallNotice"><strong>Important:</strong> ${paragraphs(call.notice)}</p>` : ''}
        <a class="homeDetailLink" href="${esc(url)}">View full call details →</a>
        <p class="homeCallReminder">Check again before you leave home.</p>`;
    }
    renderPreparation(call);
    notify();
  }

  select.addEventListener('change', () => {
    selected = findPerson(people, select.value);
    remember(selected?.id || '');
    render();
  });
  change.addEventListener('click', () => {
    selected = null;
    remember('');
    render();
    select.focus();
  });
  button.addEventListener('click', event => {
    event.preventDefault();
    if (!selected) { select.focus(); return; }
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
  try {
    const response = await fetcher('company.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Roster unavailable');
    const roster = await response.json();
    if (!Array.isArray(roster.people) || !roster.people.length) throw new Error('Roster is empty');
    people = roster.people;
    select.innerHTML = '<option value="">Select your name…</option>' + people.map(person =>
      `<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');
    select.disabled = false;
    const saved = readSaved();
    selected = findPerson(people, saved);
    if (selected) remember(selected.id);
    else if (saved) remember('');
    render();
  } catch (_) {
    select.innerHTML = '<option value="">Names are temporarily unavailable</option>';
    helper.textContent = 'We could not load the company list. Try refreshing, or open My Calls.';
    button.href = 'company.html#my-role';
    button.textContent = 'Open My Calls';
    button.replaceWith(button.cloneNode(true)); // Keep the fallback link usable without the selector handler.
    panel.innerHTML = '<p class="ey">CALL INFORMATION</p><h2 id="homeCallTitle">Your call could not be loaded</h2><p>Refresh this page or <a href="schedule.html">open the schedule</a>. Confirm unclear instructions with production before you travel.</p>';
  }

  if (typeof window !== 'undefined' && root === window.document) {
    window.addEventListener('storage', event => {
      if (event.key === personKey || event.key === null) {
        selected = findPerson(people, readSaved());
        render();
      }
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted && people.length) {
        if (canRemember) selected = findPerson(people, readSaved());
        render();
      }
    });
  }
}
