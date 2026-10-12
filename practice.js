/* Character Quest: all progress stays in this browser. No cast results are sent to a server. */
(() => {
  'use strict';
  if (document.body?.dataset.page !== 'practice') return;

  const KEY = 'chosen2026-character-quest-v1';
  const TASKS = ['story', 'listen', 'stage'];
  const sceneSelect = document.querySelector('#questScene');
  const personLabel = document.querySelector('#questPerson');
  const scriptLink = document.querySelector('#questScript');
  const stars = document.querySelector('#questStars');
  const form = document.querySelector('#coachForm');
  const history = document.querySelector('#coachHistory');
  const status = document.querySelector('#coachStatus');
  const dateInput = document.querySelector('#coachDate');
  let scenes = [];
  let personId = 'guest';
  let memory = {};

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : memory;
    } catch (_) { return memory; }
  }

  function write(value) {
    memory = value;
    try { localStorage.setItem(KEY, JSON.stringify(value)); }
    catch (_) { status.textContent = 'This browser could not save the check. Keep this page open or try another device.'; }
  }

  function sceneKey() { return `${personId}|${sceneSelect.value}`; }

  function sceneData() {
    const all = read();
    const data = all[sceneKey()];
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  }

  function update(changes) {
    const all = read();
    all[sceneKey()] = { ...sceneData(), ...changes };
    write(all);
    render();
  }

  function render() {
    const scene = scenes.find(item => item.scene === sceneSelect.value);
    if (!scene) return;
    scriptLink.href = scene.readUrl;
    const data = sceneData();
    const done = data.tasks || {};
    const count = TASKS.filter(task => done[task]).length;
    for (const task of TASKS) {
      const button = document.querySelector(`[data-quest="${task}"]`);
      button.textContent = done[task] ? 'Tried this · ★' : 'I tried this · ☆';
      button.setAttribute('aria-pressed', done[task] ? 'true' : 'false');
    }
    stars.textContent = `${count} of 3 stars for Scene ${Number(scene.scene)}. ${count === 3 ? 'You tried all three tasks. Try them again before rehearsal!' : 'Each star means you tried one task.'}`;

    history.replaceChildren();
    const checks = Array.isArray(data.checks) ? data.checks : [];
    if (!checks.length) {
      history.textContent = 'No rehearsal checks yet for this scene.';
      return;
    }
    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.textContent = `Scene ${Number(scene.scene)} · ${checks.length} rehearsal check${checks.length === 1 ? '' : 's'}`;
    table.append(caption);
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    for (const label of ['Date', 'Goal', 'Listen', 'Stage']) {
      const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th);
    }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    for (const check of [...checks].sort((a, b) => b.date.localeCompare(a.date))) {
      const row = document.createElement('tr');
      for (const value of [check.date, ...TASKS.map(task => check[task] === 2 ? 'Seen' : 'Working')]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      body.append(row);
    }
    table.append(body); history.append(table);
  }

  document.querySelectorAll('[data-quest]').forEach(button => button.addEventListener('click', () => {
    if (!sceneSelect.value) return;
    const data = sceneData();
    update({ tasks: { ...(data.tasks || {}), [button.dataset.quest]: true } });
  }));

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!sceneSelect.value || !form.reportValidity()) return;
    const answers = new FormData(form);
    const check = { date: dateInput.value };
    for (const task of TASKS) check[task] = Number(answers.get(task));
    const checks = [...(Array.isArray(sceneData().checks) ? sceneData().checks : [])];
    const existing = checks.findIndex(item => item.date === check.date);
    if (existing >= 0) checks[existing] = check;
    else checks.push(check);
    update({ checks });
    status.textContent = `Saved Scene ${Number(sceneSelect.value)} for ${check.date} on this device.`;
    form.reset();
    dateInput.value = check.date;
  });

  document.querySelector('#clearQuest').addEventListener('click', () => {
    if (!sceneSelect.value) return;
    if (!window.confirm(`Clear your stars and rehearsal checks for Scene ${Number(sceneSelect.value)} on this device?`)) return;
    const all = read();
    delete all[sceneKey()];
    write(all);
    status.textContent = 'Saved practice and checks for this scene were cleared.';
    render();
  });

  sceneSelect.addEventListener('change', () => {
    status.textContent = '';
    form.reset();
    render();
  });

  async function init() {
    try {
      const [scriptResponse, rosterResponse] = await Promise.all([
        fetch('data/scripts.json', { cache: 'no-store' }),
        fetch('company.json', { cache: 'no-store' }).catch(() => null),
      ]);
      if (!scriptResponse.ok) throw new Error('Scenes could not load. Please refresh this page.');
      scenes = (await scriptResponse.json()).filter(item =>
        item.approved === true && item.companyPublish === true &&
        /^\d{2}$/.test(item.scene) && /^scene-\d{2}\.html$/.test(item.readUrl)
      ).sort((a, b) => a.scene.localeCompare(b.scene));
      if (!scenes.length) throw new Error('No current scenes are ready. Please try again later.');

      let person = null;
      if (rosterResponse?.ok) {
        const roster = await rosterResponse.json();
        let selectedId = null;
        try { selectedId = localStorage.getItem('chosen2026-person'); } catch (_) { /* Guest practice works. */ }
        person = roster.people?.find(item => item.id === selectedId || item.legacyIds?.includes(selectedId));
      }
      personId = person?.id || 'guest';
      personLabel.textContent = person
        ? `${person.name}: your scenes are shown first. You can choose any scene.`
        : 'Choose your name in Company to see your scenes first. You can still try any scene here.';
      const chooseName = document.createElement('a');
      chooseName.href = 'company.html#my-role';
      chooseName.textContent = person ? 'Change person' : 'Choose my name';
      personLabel.append(' ', chooseName);

      const assigned = new Set((person?.scenes || []).map(Number));
      const ordered = [...scenes].sort((a, b) =>
        Number(assigned.has(Number(b.scene))) - Number(assigned.has(Number(a.scene))) ||
        a.scene.localeCompare(b.scene));
      sceneSelect.replaceChildren();
      for (const scene of ordered) {
        const option = document.createElement('option');
        option.value = scene.scene;
        option.textContent = `Scene ${Number(scene.scene)}: ${scene.title}${assigned.has(Number(scene.scene)) ? ' · Your scene' : ''}`;
        sceneSelect.append(option);
      }
      sceneSelect.disabled = false;
      const params = new URLSearchParams(location.search);
      const requested = params.get('scene')?.padStart(2, '0');
      if (scenes.some(scene => scene.scene === requested)) sceneSelect.value = requested;
      render();
    } catch (error) {
      personLabel.textContent = 'Scenes could not load.';
      const alert = document.querySelector('#questSceneError');
      alert.textContent = error.message || 'Please refresh and try again.';
      alert.hidden = false;
    }
  }

  const today = new Date();
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  init();
})();
