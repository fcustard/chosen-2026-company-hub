/* Show Quest stores practice on this device. It sends no progress to a server. */
(() => {
  'use strict';
  if (document.body?.dataset.page !== 'practice') return;

  const KEY = 'chosen2026-show-quest-v2';
  const OLD_KEY = 'chosen2026-character-quest-v1';
  const NAMES = { cue: 'Cue Hunt', clear: 'Make It Clear', pass: 'Pass It On' };
  const NEXT = { notice: 'Notice the cue', clear: 'Make it clearer', together: 'Try with a partner' };
  const PATHS = {
    act: {
      cue: ['Pick a scene. Find the line or action just before your part. No lines? Find the moment your person must react.', 'Look away. Say or show when you would begin.', ['The pace is slower. Wait for the real cue.', 'Your partner takes a pause. Stay with them.'], 'Try it again. Let the real cue start you.'],
      clear: ['Pick one line or silent action from your scene.', 'Do it so someone at the back can hear or see the story.', ['Try it with less movement. Keep the meaning.', 'Try it with one clear look toward the other person.'], 'Try again. Make one small change. Use the real script words.'],
      pass: ['Think of the person who acts after you.', 'Do your part. Notice what they need from you.', ['Your partner needs a moment. Give them room.', 'You have no line here. Stay in the story and listen.'], 'Try again. Help the next person begin.']
    },
    sing: {
      cue: ['Pick a song you are learning. Find the sound, word, or count before your entry.', 'Listen or count. Sing your first short phrase at the right time.', ['The music starts softly. Keep listening.', 'There is a longer pause. Wait for the real entry.'], 'Try the entry again with the current track or your leader’s count.'],
      clear: ['Pick one short song phrase.', 'Sing it with clear words and an easy, steady sound. Do not push your voice.', ['Try it more gently. Keep the words clear.', 'Try it with a clear start and end.'], 'Sing it again. Let the words tell the story.'],
      pass: ['Think of the singers beside you or the actor after the song.', 'Sing your part and leave room to hear others.', ['The group is quiet. Listen and blend.', 'The next voice enters. Help them hear the beat.'], 'Try again. Listen as much as you sing.']
    },
    dance: {
      cue: ['Pick a safe move or entrance you already know.', 'Count or listen for the cue. Show when you begin.', ['The music is quiet. Watch the count.', 'The move before yours is slow. Hold your place.'], 'Try again with the approved counts and safe shoes.'],
      clear: ['Pick one move from your current dance.', 'Make its start, shape, and end easy to see.', ['Try it smaller but just as clear.', 'Try it while keeping your space from others.'], 'Do it again. Keep the move safe and clear.'],
      pass: ['Think of the dancer who moves near or after you.', 'Do your part without blocking their path.', ['Your partner needs more room. Adjust only within your set move.', 'Your group must end together. Watch and listen.'], 'Try again. Help the group finish as one.']
    },
    crew: {
      cue: ['Pick a job your lead has already given you. Think of the approved signal to begin.', 'Say what the signal is and what you do next. Do not operate gear at home.', ['The signal is not clear. Stop and ask your lead.', 'The order changes. Check the latest plan first.'], 'Walk through it in words. Follow your lead’s plan.'],
      clear: ['Pick one safe handoff or check in your job.', 'Say what is ready and who needs to know. Keep it short and clear.', ['The room is busy. Speak to the right person.', 'A detail is missing. Ask before you act.'], 'Try saying the message again. Do not guess on safety steps.'],
      pass: ['Think of the person who uses your work next.', 'Name what they need from you before they can begin.', ['They need one more detail. Check it with your lead.', 'The task is not ready. Tell the team early.'], 'Try the handoff again. Keep it safe and clear.']
    }
  };
  const $ = selector => document.querySelector(selector);
  let personId = 'guest';
  let path = 'act';
  let mission = null;
  let memory = {};
  let storageWorks = true;

  function read(key = KEY) {
    if (key === KEY && !storageWorks) return memory;
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) { return key === KEY ? memory : {}; }
  }
  function save(value) {
    memory = value;
    try { localStorage.setItem(KEY, JSON.stringify(value)); }
    catch (_) { storageWorks = false; $('#coachStatus').textContent = 'This browser cannot save progress. Your marks will last only until you close this page.'; }
  }
  function player() {
    const all = read();
    return all[personId] && typeof all[personId] === 'object' ? all[personId] : { paths: {}, checks: [] };
  }
  function update(changes) {
    const all = read();
    all[personId] = { ...player(), ...changes };
    save(all);
    render();
  }
  function playsFor(name) { return Number(player().paths?.[path]?.[name] || 0); }
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function pathChoice(next) {
    path = next;
    const data = player();
    update({ preferredPath: next, paths: data.paths || {} });
    mission = null;
    $('#gameBoard').hidden = true;
    $('#coachStatus').textContent = '';
    render();
  }
  function render() {
    for (const button of document.querySelectorAll('[data-path]')) button.setAttribute('aria-pressed', String(button.dataset.path === path));
    for (const button of document.querySelectorAll('[data-mission]')) button.setAttribute('aria-pressed', String(button.dataset.mission === mission));
    const count = Object.keys(NAMES).filter(name => playsFor(name) > 0).length;
    for (const name of Object.keys(NAMES)) $('[data-mark="' + name + '"]').textContent = playsFor(name) ? '◆' : '◇';
    $('#missionProgress').textContent = `${count} of 3 missions played on this path. ${count === 3 ? 'You tried them all! Replay one with a new twist.' : 'Each gem means you tried both rounds.'}`;
    renderHistory();
  }
  function start(name) {
    mission = name;
    const [setup, first, twists, second] = PATHS[path][name];
    $('#gameBoard').hidden = false;
    $('#gameTitle').textContent = NAMES[name];
    $('#gameSetup').textContent = setup;
    $('#roundOne').textContent = first;
    $('#twistText').textContent = twists[playsFor(name) % twists.length];
    $('#roundTwo').textContent = second;
    $('#twistPanel').hidden = true;
    $('#twistButton').hidden = false;
    $('#finishMission').disabled = true;
    $('#finishMission').hidden = false;
    $('#gameResult').textContent = '';
    $('#replayMission').hidden = true;
    document.querySelectorAll('input[name="reflection"]').forEach(input => { input.checked = false; });
    $('#coachSkill').value = name;
    render();
    $('#gameBoard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderHistory() {
    const box = $('#coachHistory');
    box.replaceChildren();
    const checks = Array.isArray(player().checks) ? player().checks : [];
    if (!checks.length) { box.textContent = 'No checks yet. Bring one mission to rehearsal.'; return; }
    const latest = [...checks].sort((a,b) => b.date.localeCompare(a.date));
    const next = document.createElement('p');
    next.className = 'nextMove';
    next.textContent = `Next move: ${NEXT[latest[0].next] || 'Ask your coach'}.`;
    box.append(next);
    const list = document.createElement('ol');
    list.className = 'growthList';
    for (const check of latest.slice(0, 12)) {
      const item = document.createElement('li');
      item.textContent = `${check.date} · ${NAMES[check.skill] || 'Mission'} · ${check.level === 'seen' ? 'Clear today' : 'Still working'} · Next: ${NEXT[check.next] || 'Ask your coach'}`;
      list.append(item);
    }
    box.append(list);
  }
  function showOldChecks() {
    const old = read(OLD_KEY);
    const rows = [];
    for (const [key, data] of Object.entries(old)) {
      if (!key.startsWith(`${personId}|`) || !Array.isArray(data?.checks)) continue;
      const scene = Number(key.split('|')[1]);
      for (const check of data.checks) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(check.date)) continue;
        rows.push(`Scene ${scene} · ${check.date} · Goal ${check.story === 2 ? 'seen' : 'working'} · Listen ${check.listen === 2 ? 'seen' : 'working'} · Stage ${check.stage === 2 ? 'seen' : 'working'}`);
      }
    }
    const details = $('#oldChecks');
    if (!rows.length) return;
    details.hidden = false;
    const list = document.createElement('ul');
    for (const row of rows.sort().reverse()) { const li = document.createElement('li'); li.textContent = row; list.append(li); }
    $('#oldHistory').append(list);
  }

  document.querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => pathChoice(button.dataset.path)));
  document.querySelectorAll('[data-mission]').forEach(button => button.addEventListener('click', () => start(button.dataset.mission)));
  $('#twistButton').addEventListener('click', () => { $('#twistPanel').hidden = false; $('#twistButton').hidden = true; });
  document.querySelectorAll('input[name="reflection"]').forEach(input => input.addEventListener('change', () => { $('#finishMission').disabled = false; }));
  $('#finishMission').addEventListener('click', () => {
    if (!mission || $('#twistPanel').hidden || !document.querySelector('input[name="reflection"]:checked')) return;
    const chosen = document.querySelector('input[name="reflection"]:checked').value;
    const data = player();
    const paths = { ...(data.paths || {}) };
    paths[path] = { ...(paths[path] || {}), [mission]: playsFor(mission) + 1 };
    update({ paths, nextMove: chosen });
    $('#gameResult').textContent = `Mission played! Your next move: ${NEXT[chosen]}. Show it at rehearsal.`;
    $('#finishMission').hidden = true;
    $('#replayMission').hidden = false;
  });
  $('#replayMission').addEventListener('click', () => {
    $('#finishMission').hidden = false;
    start(mission);
  });
  $('#coachForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const check = { date: $('#coachDate').value, path, skill: $('#coachSkill').value,
      level: form.querySelector('input[name="coachLevel"]:checked').value, next: $('#coachNext').value };
    const data = player();
    const checks = Array.isArray(data.checks) ? [...data.checks] : [];
    const index = checks.findIndex(item => item.date === check.date && item.path === path && item.skill === check.skill);
    if (index >= 0) checks[index] = check; else checks.push(check);
    update({ checks });
    $('#coachStatus').textContent = storageWorks ? 'Saved on this device. Try your next move at home.' : 'Marked for this session only.';
    form.querySelectorAll('input[name="coachLevel"]').forEach(input => { input.checked = false; });
    $('#coachNext').value = '';
  });
  $('#clearQuest').addEventListener('click', () => {
    if (!window.confirm('Clear all Show Quest missions and rehearsal checks for this person on this device? Earlier Character Quest checks will stay.')) return;
    const all = read(); delete all[personId]; save(all);
    path = 'act'; mission = null; $('#gameBoard').hidden = true;
    $('#coachStatus').textContent = 'Show Quest data cleared for this person.';
    render();
  });

  async function init() {
    $('#coachDate').value = today();
    let person = null;
    try {
      const saved = localStorage.getItem('chosen2026-person');
      if (saved) {
        const response = await fetch('company.json', { cache: 'no-store' });
        if (response.ok) {
          const roster = await response.json();
          person = roster.people?.find(item => item.id === saved || item.legacyIds?.includes(saved));
        }
      }
    } catch (_) { /* Guest mode is always available. */ }
    personId = person?.id || 'guest';
    $('#questPerson').textContent = person ? `${person.name}, pick any path you want.` : 'Playing as a guest. Pick any path.';
    const link = document.createElement('a');
    link.href = 'company.html#my-role'; link.textContent = person ? 'Change person' : 'Choose my name';
    $('#questPerson').append(' ', link);
    const savedPath = player().preferredPath;
    const suggested = person?.danceEnsemble ? 'dance' : /singer|choir|vocal/i.test(person?.roles || '') ? 'sing' :
      /production|tech|wardrobe|props|crew/i.test(`${person?.companyType || ''} ${person?.roles || ''}`) ? 'crew' : 'act';
    path = PATHS[savedPath] ? savedPath : suggested;
    render(); showOldChecks();
  }
  init();
})();
