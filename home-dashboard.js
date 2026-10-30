import { findPerson, personMatchesCall, upcomingPublishedCalls, personalCallSummary, callAnchor, callPublicationStatus } from './personal-calls.js?v=20261030-flow1';
import { preparationChecklist, createPreparationStore } from './preparation-checklist.js?v=20261030-prep1';

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

export function relevantUpdates(updates, person, now = new Date()) {
  const scenes = new Set([...(person?.scenes || []), ...(person?.danceScenes || [])].map(Number));
  return (Array.isArray(updates) ? updates : []).filter(update =>
    update.published === true && Date.parse(update.publishedAt) <= now.getTime() &&
    Date.parse(update.expiresAt) > now.getTime() &&
    (!update.scenes?.length || person && update.scenes.some(scene => scenes.has(Number(scene)))))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 3);
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

  let people = [], selected = null, canRemember = true, updates = [];
  if (!storage) {
    try { storage = globalThis.localStorage; } catch (_) { canRemember = false; }
  }
  const checklistStore = createPreparationStore(storage);
  let checklist = null;
  const readSaved = () => { try { return storage.getItem(personKey); } catch (_) { canRemember = false; return ''; } };
  const remember = id => {
    try { if (id) storage.setItem(personKey, id); else storage.removeItem(personKey); }
    catch (_) { canRemember = false; }
  };
  const notify = () => root.dispatchEvent(new CustomEvent('chosen-person-change'));

  function renderPreparation(call) {
    checklist = null;
    if (!selected || !call) {
      preparation.innerHTML = `<p class="ey">YOUR NEXT STEPS</p><h2 id="homePreparationTitle">A clear plan for rehearsal.</h2>
        <p>${selected ? 'No upcoming personal call is confirmed here yet. Check the full schedule or ask production before planning your arrival.' : 'Choose your name above to see your call and the published materials for your scenes.'}</p>
        <div class="homePrepLinks"><a href="scripts.html">Browse current scenes</a><a href="music.html">Browse rehearsal tracks</a><a href="production.html">Production team plan</a></div>`;
      return;
    }
    const prep = preparationForCall(selected, call, content);
    checklist = preparationChecklist(selected, call, prep);
    const checked = new Set(checklistStore.completed(checklist));
    const check = id => {
      const task = checklist?.tasks.find(item => item.id === id);
      return task ? `<label class="homePrepCheck"><input type="checkbox" data-prep-task="${id}"${checked.has(id) ? ' checked' : ''}><span>${esc(task.label)}</span></label>` : '';
    };
    const detailUrl = 'schedule.html#' + callAnchor(call);
    const scriptLinks = prep.scripts.map(item => `<li><a href="${esc(item.readUrl)}">Scene ${Number(item.scene)}: ${esc(item.title || item.name)}</a></li>`).join('');
    const musicLinks = prep.music.map(item => `<li><a href="music.html#track-${esc(String(item.title || item.name || '').replace(/[^a-zA-Z0-9_-]/g, '-'))}">${esc(item.title || item.name)}</a></li>`).join('');
    preparation.innerHTML = `<p class="ey">PREPARE FOR YOUR NEXT CALL</p><h2 id="homePreparationTitle">Your rehearsal plan.</h2>
      <p>${prep.callSpecific ? 'Your assigned scenes within this call' : 'Your assigned scenes'}${prep.scenes.length ? ': ' + prep.scenes.join(', ') + '.' : ': follow the instructions below.'}
      ${!prep.callSpecific && prep.scenes.length ? 'This call does not name specific scenes; use its preparation notes to guide your practice.' : ''}</p>
      ${checklist ? `<div class="homePrepProgress"><p role="status" aria-live="polite" id="homePrepStatus">${checked.size} of ${checklist.tasks.length} preparation steps checked</p><progress id="homePrepMeter" value="${checked.size}" max="${checklist.tasks.length}" aria-label="Preparation checklist"></progress><p id="homePrepSaveNote" class="homePrepHint">${checklistStore.persistent ? 'Saved on this device for this person and rehearsal.' : 'Progress is available for this page visit; browser storage is unavailable.'} These are your reminders; checking a box does not notify production or confirm attendance. Review again if instructions or materials change.</p></div>` : ''}
      <ol class="homePrepSteps">
        <li><div><h3>Check your call</h3><p>Review the full instructions and check again before you leave.</p><a href="${esc(detailUrl)}">Open call details →</a>${check('call')}</div></li>
        <li><div><h3>Review your material</h3>${scriptLinks ? `<ul class="homeMaterialList">${scriptLinks}</ul>` : '<p>No scene script is matched to this call. Follow your department instructions.</p>'}
          ${musicLinks ? `<p class="homeMaterialLabel">Tracks for these scenes</p><ul class="homeMaterialList">${musicLinks}</ul>` : '<p>No published track is matched to these scenes.</p>'}
          <p class="homePrepHint">Use the material your rehearsal leader has assigned.</p>${check('scripts')}${check('music')}</div></li>
        <li><div><h3>Practice and pack</h3>${call.prep ? `<p>${paragraphs(call.prep)}</p>` : '<p>Check the call details for what to prepare and bring.</p>'}
          <div class="homePrepLinks">${prep.scripts.length ? '<a href="lines.html">Practice spoken lines</a>' : ''}<a href="resources.html">Rehearsal videos & resources</a><a href="production.html">Wardrobe & production plan</a></div>${check('pack')}</div></li>
      </ol>`;
  }

  preparation.addEventListener('change', event => {
    const input = event.target;
    const id = input?.dataset?.prepTask;
    if (!id || !checklist) return;
    checklistStore.mark(checklist, id, input.checked);
    const count = checklistStore.completed(checklist).length;
    const status = preparation.querySelector('#homePrepStatus');
    const meter = preparation.querySelector('#homePrepMeter');
    if (status) status.textContent = `${count} of ${checklist.tasks.length} preparation steps checked`;
    if (meter) meter.value = count;
    if (!checklistStore.persistent) {
      const note = preparation.querySelector('#homePrepSaveNote');
      if (note) note.textContent = 'Progress is available for this page visit; browser storage is unavailable. These are your reminders; checking a box does not notify production or confirm attendance.';
    }
  });

  function render() {
    const { call, pending, companyCall } = homeCallState(selected, content.schedule?.rehearsals, clock());
    select.value = selected?.id || '';
    root.body?.classList.toggle('hasPerson', !!selected);
    const welcome = root.querySelector('#homeWelcome');
    if (welcome) {
      welcome.hidden = !selected;
      welcome.textContent = selected ? `Welcome back, ${selected.name.split(/\s+/)[0]}.` : '';
    }
    const heading = root.querySelector('#homeTitle');
    if (heading) heading.innerHTML = selected ? 'Your rehearsal plan.' : 'Know your call.<br>Come prepared.';
    const updatePanel = root.querySelector('#homeUpdates');
    if (updatePanel) {
      const visible = relevantUpdates(updates, selected, clock());
      updatePanel.hidden = !visible.length;
      updatePanel.innerHTML = `<p class="ey">${selected ? 'UPDATES FOR YOUR PREPARATION' : 'LATEST HUB UPDATES'}</p><h2>What changed?</h2><div class="hubUpdates">${visible.map(update => `<article><p class="updateDate">${esc(new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',timeZone:'America/New_York'}).format(new Date(update.publishedAt)))}</p><h3>${esc(update.title)}</h3><p>${esc(update.description)}</p>${/^(?:[a-z0-9-]+\.html)(?:[?#][^"<>]*)?$/i.test(update.url || '') ? `<a href="${esc(update.url)}">${esc(update.linkLabel || 'View update')} →</a>` : ''}</article>`).join('')}</div>`;
    }
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
      const publication = callPublicationStatus(call);
      const url = 'schedule.html#' + callAnchor(call);
      const timeHtml = times.report
        ? `<div><dt>Your report time</dt><dd>${esc(times.report)}</dd></div>
           ${times.through ? `<div><dt>Scheduled through</dt><dd>${esc(times.through)}</dd></div>` : ''}`
        : `<div><dt>Overall rehearsal window</dt><dd>${esc(call.time || 'See call details')}</dd></div>`;
      panel.innerHTML = `<p class="ey">${esc(selected.name)} · YOUR NEXT CONFIRMED CALL</p><h2 id="homeCallTitle">${esc(dateLabel(call))}</h2>
        <p class="homeCallName">${esc(call.title)}</p>
        <div class="callPublicationBadges"><span class="status">${esc(publication.eventLabel)}</span><span class="status assignmentsPublished">${esc(publication.personalLabel)}</span></div>
        <a class="homePersonSwitch" href="#homePerson">Change person</a>
        ${pending ? '<p class="homeCallNotice">An earlier or overlapping company call is still under review. Check the full schedule for updates.</p>' : ''}
        <dl class="homeCallFacts">${timeHtml}<div class="homeWhere"><dt>Where</dt><dd>${locationHtml(call)}</dd></div></dl>
        ${!times.report ? '<p class="homeCallNotice">Your personal report and scheduled-through times are not published here. Review your call block or confirm with production before you travel.</p>' : !times.through && !call.showDay ? '<p class="homeCallNotice">Your personal scheduled-through time is not published. Check the call details before planning pickup.</p>' : ''}
        ${times.showtime ? `<p>Show begins: <strong>${esc(times.showtime)}</strong>. Tentative show end: ${esc(times.tentativeEnd || 'To be confirmed')}; this is not a personal release time.</p>` : ''}
        <details class="homeCallMore"><summary>Preparation and rehearsal focus</summary>
        ${call.work || call.focus ? `<p><strong>Focus:</strong> ${paragraphs(call.work || call.focus)}</p>` : ''}
        ${call.prep ? `<p><strong>Prepare:</strong> ${paragraphs(call.prep)}</p>` : ''}</details>
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
    try {
      const updateResponse = await fetcher('data/updates.json', { cache:'no-store' });
      if (updateResponse.ok) {
        const published = await updateResponse.json();
        updates = Array.isArray(published) ? published : [];
      }
    } catch (_) { /* Personal calls remain usable without the optional updates feed. */ }
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
