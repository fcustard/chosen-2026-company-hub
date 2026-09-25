/*
  CHOSEN Lines & Off-Book Practice
  Phase 1: client-side cue cards generated from data/scenes/scene-##.json

  This file does not change the existing schedule, scripts, music, resources,
  company, or build workflow. It only runs on <body data-page="lines">.
*/

(() => {
  'use strict';

  if (!document.body || document.body.dataset.page !== 'lines') return;

  const SCENE_NUMBERS = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, '0')
  );

  const STORAGE_KEY = 'chosen2026-line-progress-v2';
  const LEGACY_STORAGE_KEY = 'chosen2026-line-progress-v1';

  const els = {
    loading: document.getElementById('linesLoading'),
    error: document.getElementById('linesError'),
    controls: document.getElementById('linesControls'),
    roleSelect: document.getElementById('roleSelect'),
    sceneSelect: document.getElementById('sceneSelect'),
    reset: document.getElementById('resetLineProgress'),
    summary: document.getElementById('linesSummary'),
    cards: document.getElementById('lineCards'),
  };

  let allLines = [];
  let allScenes = [];
  let memoryProgress = {};

  function text(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalize(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’‘]/g, "'")
      .toUpperCase()
      .replace(/\b([A-Z]+)-(\d+)\b/g, '$1 $2');
  }

  function hashText(value) {
    let hash = 0;
    const s = String(value ?? '');
    for (let i = 0; i < s.length; i += 1) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function getProgress() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value)
        ? value : memoryProgress;
    } catch (error) {
      return memoryProgress;
    }
  }

  function setProgress(progress) {
    memoryProgress = progress;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      // Keep the current session usable if browser storage is disabled.
    }
  }

  function migrateProgress(lines) {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== null) return;
      const old = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}');
      const migrated = {};
      const frequencies = new Map();

      for (const line of lines) {
        const identity = `${line.sceneNumber}|${line.sourceSpeakerKey}|${hashText(line.text)}`;
        frequencies.set(identity, (frequencies.get(identity) || 0) + 1);
      }

      for (const line of lines) {
        const identity = `${line.sceneNumber}|${line.sourceSpeakerKey}|${hashText(line.text)}`;
        if (frequencies.get(identity) !== 1) continue;
        const prefix = `${line.sceneNumber}|${line.sourceSpeakerKey}|`;
        const suffix = `|${hashText(line.text)}`;
        const matches = Object.entries(old)
          .filter(([key, status]) => key.startsWith(prefix) && key.endsWith(suffix) &&
            (status === 'known' || status === 'work'));
        if (matches.length === 1) migrated[line.key] = matches[0][1];
      }

      setProgress(migrated);
    } catch (error) {
      // Practice still works when storage is unavailable.
    }
  }

  async function fetchJson(path) {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }
    return response.json();
  }

  function getSceneBlocks(scene) {
    if (!Array.isArray(scene?.blocks)) {
      throw new Error('A scene has no approved script blocks. Please refresh and try again.');
    }
    return scene.blocks;
  }

  function getBlockKind(block) {
    return normalize(block?.type || '');
  }

  function getBlockText(block) {
    if (typeof block === 'string') return text(block);
    if (!block || typeof block !== 'object') return '';

    const direct = [
      block.text,
      block.content,
      block.value,
      block.line,
      block.dialogue,
      block.body,
      block.plainText,
    ];

    for (const item of direct) {
      if (typeof item === 'string' && text(item)) return text(item);
    }

    return '';
  }

  function cleanSpeaker(value) {
    return text(value)
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sceneNumberFrom(scene, fallback) {
    const possible = scene?.number || scene?.sceneNumber || scene?.scene || scene?.id || fallback;
    const match = String(possible ?? fallback).match(/\d+/);
    return match ? match[0].padStart(2, '0') : String(fallback).padStart(2, '0');
  }

  function sceneTitleFrom(scene, sceneNo) {
    return text(scene?.title || scene?.name || scene?.label || `Scene ${sceneNo}`);
  }

  function addLine(result, sceneMeta, speaker, lineText, cue, cueSpeaker, blockIndex, occurrence) {
    const safeLine = text(lineText);
    const safeSpeaker = cleanSpeaker(speaker);

    if (!safeSpeaker || !safeLine) return;

    const sourceSpeakerKey = normalize(safeSpeaker);
    const key = [
      sceneMeta.number,
      sourceSpeakerKey,
      hashText(safeLine),
      occurrence,
    ].join('|');

    result.push({
      key,
      sceneNumber: sceneMeta.number,
      sceneTitle: sceneMeta.title,
      speaker: safeSpeaker,
      speakerKey: sourceSpeakerKey,
      sourceSpeakerKey,
      blockIndex,
      text: safeLine,
      cue: text(cue) || 'Opening line / no cue before this line.',
      cueSpeaker: text(cueSpeaker),
    });
  }

  function extractLinesFromScene(scene, fallbackSceneNo) {
    const sceneNo = sceneNumberFrom(scene, fallbackSceneNo);
    const sceneMeta = {
      number: sceneNo,
      title: sceneTitleFrom(scene, sceneNo),
    };

    const blocks = getSceneBlocks(scene);
    const result = [];

    let currentSpeaker = '';
    let lastSpokenText = '';
    let lastSpokenSpeaker = '';
    const occurrences = new Map();

    const ending = blocks.findLastIndex(block => {
      const kind = getBlockKind(block);
      const label = getBlockText(block);
      return (kind === 'TRANSITION' && /^(?:END SCENE\s*\d+|Scene\s*\d+\s+begins\.)/i.test(label)) ||
        (kind === 'HEADING' && /^END OF CHOSEN:/i.test(label));
    });
    const script = ending < 0 ? blocks : blocks.slice(0, ending + 1);

    for (const [index, block] of script.entries()) {
      const kind = getBlockKind(block);
      const blockText = getBlockText(block);

      if (kind === 'CHARACTER') {
        currentSpeaker = cleanSpeaker(blockText);
        continue;
      }
      if (kind !== 'DIALOGUE' || !blockText) continue;
      if (!currentSpeaker) throw new Error(`Scene ${sceneNo} has dialogue without a character cue.`);

      const identity = `${normalize(currentSpeaker)}|${hashText(blockText)}`;
      const occurrence = (occurrences.get(identity) || 0) + 1;
      occurrences.set(identity, occurrence);
      addLine(result, sceneMeta, currentSpeaker, blockText, lastSpokenText, lastSpokenSpeaker, index, occurrence);
      lastSpokenText = blockText;
      lastSpokenSpeaker = currentSpeaker;
    }

    return result;
  }

  async function loadScenes() {
    return Promise.all(SCENE_NUMBERS.map(async sceneNo => {
      const scene = await fetchJson(`data/scenes/scene-${sceneNo}.json`);
      return {
        sceneNumber: sceneNumberFrom(scene, sceneNo),
        sceneTitle: sceneTitleFrom(scene, sceneNo),
        scene,
      };
    }));
  }

  function includeSharedLines(lines) {
    const roles = new Set(lines.map(line => line.speakerKey));
    const shared = [];

    for (const line of lines) {
      if (!line.speaker.includes('&')) continue;
      const parts = line.speaker.split(/\s*&\s*/).map(text);
      if (parts.length !== 2) continue;
      const second = /^\d+$/.test(parts[1])
        ? `${parts[0].replace(/\s+\d+$/, '')} ${parts[1]}`
        : parts[1];

      for (const role of [parts[0], second]) {
        const key = normalize(role);
        if (roles.has(key)) shared.push({ ...line, speakerKey: key });
      }
    }

    return [...lines, ...shared].sort((a, b) =>
      a.sceneNumber.localeCompare(b.sceneNumber) || a.blockIndex - b.blockIndex
    );
  }

  function uniqueRoles(lines) {
    const map = new Map();

    for (const line of lines) {
      if (!map.has(line.speakerKey) || line.speakerKey === line.sourceSpeakerKey) {
        map.set(line.speakerKey, line.speaker);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }

  function fillRoleSelect(lines) {
    const roles = uniqueRoles(lines);

    els.roleSelect.innerHTML = '<option value="">Select a role…</option>' +
      roles.map(role => `<option value="${htmlEscape(normalize(role))}">${htmlEscape(role)}</option>`).join('');

    const params = new URLSearchParams(window.location.search);
    const requestedRole = normalize(params.get('role') || '');

    if (requestedRole && roles.some(role => normalize(role) === requestedRole)) {
      els.roleSelect.value = requestedRole;
    }
  }

  function fillSceneSelect(roleKey) {
    const linesForRole = allLines.filter(line => line.speakerKey === roleKey);
    const sceneMap = new Map();

    for (const line of linesForRole) {
      if (!sceneMap.has(line.sceneNumber)) {
        sceneMap.set(line.sceneNumber, line.sceneTitle);
      }
    }

    const scenes = Array.from(sceneMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    els.sceneSelect.disabled = !roleKey;
    els.reset.disabled = !roleKey;

    if (!roleKey) {
      els.sceneSelect.innerHTML = '<option value="">Choose a role first…</option>';
      return;
    }

    els.sceneSelect.innerHTML = '<option value="all">All scenes</option>' +
      scenes.map(([sceneNo, title]) =>
        `<option value="${htmlEscape(sceneNo)}">Scene ${htmlEscape(sceneNo)} · ${htmlEscape(title)}</option>`
      ).join('');
  }

  function progressClass(status) {
    if (status === 'known') return 'known';
    if (status === 'work') return 'work';
    return '';
  }

  function progressLabel(status) {
    if (status === 'known') return 'I know this';
    if (status === 'work') return 'Needs work';
    return 'Not marked';
  }

  function render() {
    const roleKey = els.roleSelect.value;
    const sceneChoice = els.sceneSelect.value || 'all';
    const progress = getProgress();

    els.cards.innerHTML = '';
    els.summary.hidden = true;

    if (!roleKey) {
      els.cards.innerHTML = '<div class="linesNotice"><b>Choose a role to begin.</b><p class="note">The page will show cue cards for that role only.</p></div>';
      return;
    }

    let lines = allLines.filter(line => line.speakerKey === roleKey);

    if (sceneChoice !== 'all') {
      lines = lines.filter(line => line.sceneNumber === sceneChoice);
    }

    if (!lines.length) {
      els.cards.innerHTML = '<div class="linesNotice"><b>No lines found for this choice.</b><p class="note">Try All scenes or choose another role.</p></div>';
      return;
    }

    const knownCount = lines.filter(line => progress[line.key] === 'known').length;
    const workCount = lines.filter(line => progress[line.key] === 'work').length;
    const remainingCount = lines.length - knownCount - workCount;

    els.summary.hidden = false;
    els.summary.innerHTML = `
      <div>
        <p class="ey">PRACTICE SET</p>
        <h2>${htmlEscape(els.roleSelect.selectedOptions[0]?.textContent || lines[0].speaker)}</h2>
        <p class="note">${lines.length} line card${lines.length === 1 ? '' : 's'} loaded.</p>
      </div>
      <div class="lineStats" aria-label="Line progress">
        <span><b>${knownCount}</b> known</span>
        <span><b>${workCount}</b> need work</span>
        <span><b>${remainingCount}</b> unmarked</span>
      </div>
    `;

    els.cards.innerHTML = lines.map((line, index) => {
      const status = progress[line.key] || '';
      const cueSpeaker = line.cueSpeaker ? `${htmlEscape(line.cueSpeaker)}:` : 'Cue:';

      return `
        <article class="lineCard ${progressClass(status)}" data-line-key="${htmlEscape(line.key)}">
          <div class="lineCardTop">
            <p class="ey">Scene ${htmlEscape(line.sceneNumber)} · Card ${index + 1} of ${lines.length}</p>
            <span class="lineStatus">${htmlEscape(progressLabel(status))}</span>
          </div>

          <h3>${htmlEscape(line.sceneTitle)}</h3>

          <div class="cueBox">
            <b>${cueSpeaker}</b>
            <p>${htmlEscape(line.cue)}</p>
          </div>

          <div class="lineReveal" hidden>
            <b>${htmlEscape(line.speaker)}</b>
            <p>${htmlEscape(line.text)}</p>
          </div>

          <div class="lineButtons">
            <button class="btn primary showLineBtn" type="button">Show my line</button>
            <button class="btn hideLineBtn" type="button" hidden>Hide line</button>
            <button class="btn markKnownBtn" type="button">I got it</button>
            <button class="btn markWorkBtn" type="button">Need work</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function updateLineStatus(card, status) {
    const key = card.dataset.lineKey;
    if (!key) return;

    const progress = getProgress();

    if (status) {
      progress[key] = status;
    } else {
      delete progress[key];
    }

    setProgress(progress);
    render();
  }

  function resetCurrentRole() {
    const roleKey = els.roleSelect.value;
    if (!roleKey) return;

    const progress = getProgress();
    const keysForRole = new Set(
      allLines
        .filter(line => line.speakerKey === roleKey)
        .map(line => line.key)
    );

    for (const key of keysForRole) {
      delete progress[key];
    }

    setProgress(progress);
    render();
  }

  function bindEvents() {
    els.roleSelect.addEventListener('change', () => {
      fillSceneSelect(els.roleSelect.value);
      render();
    });

    els.sceneSelect.addEventListener('change', render);

    els.reset.addEventListener('click', resetCurrentRole);

    els.cards.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const card = target.closest('.lineCard');
      if (!card) return;

      const reveal = card.querySelector('.lineReveal');
      const showButton = card.querySelector('.showLineBtn');
      const hideButton = card.querySelector('.hideLineBtn');

      if (target.classList.contains('showLineBtn')) {
        reveal.hidden = false;
        showButton.hidden = true;
        hideButton.hidden = false;
        return;
      }

      if (target.classList.contains('hideLineBtn')) {
        reveal.hidden = true;
        showButton.hidden = false;
        hideButton.hidden = true;
        return;
      }

      if (target.classList.contains('markKnownBtn')) {
        updateLineStatus(card, 'known');
        return;
      }

      if (target.classList.contains('markWorkBtn')) {
        updateLineStatus(card, 'work');
      }
    });
  }

  async function init() {
    try {
      bindEvents();

      allScenes = await loadScenes();
      allLines = includeSharedLines(allScenes.flatMap(item =>
        extractLinesFromScene(item.scene, item.sceneNumber)
      ));

      if (!allLines.length) {
        throw new Error('No dialogue lines were found in data/scenes/scene-##.json.');
      }

      migrateProgress(allLines);
      fillRoleSelect(allLines);
      fillSceneSelect(els.roleSelect.value);

      els.loading.hidden = true;
      els.controls.hidden = false;
      render();
    } catch (error) {
      console.error(error);
      els.loading.hidden = true;
      els.error.hidden = false;
      els.error.innerHTML = `
        <b>Line practice could not load.</b>
        <p class="note">${htmlEscape(error.message || error)}</p>
      `;
    }
  }

  init();
})();
