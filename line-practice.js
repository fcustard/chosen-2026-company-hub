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

  const STORAGE_KEY = 'chosen2026-line-progress-v1';

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
      .toUpperCase();
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
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function setProgress(progress) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }

  async function fetchJson(path) {
    const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }
    return response.json();
  }

  function getSceneBlocks(scene) {
    if (!scene || typeof scene !== 'object') return [];

    const candidates = [
      scene.blocks,
      scene.scriptBlocks,
      scene.contentBlocks,
      scene.lines,
      scene.content,
      scene.paragraphs,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }

    return [];
  }

  function getBlockKind(block) {
    if (!block || typeof block !== 'object') return '';
    return normalize(
      block.kind ||
      block.type ||
      block.style ||
      block.blockType ||
      block.format ||
      block.paragraphType ||
      ''
    );
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

  function getExplicitSpeaker(block) {
    if (!block || typeof block !== 'object') return '';

    const direct = [
      block.speaker,
      block.character,
      block.characterName,
      block.role,
      block.name,
    ];

    for (const item of direct) {
      if (typeof item === 'string' && text(item)) return text(item);
    }

    return '';
  }

  function isHeadingLike(value, kind) {
    const t = normalize(value);
    if (!t) return false;

    if (
      kind.includes('HEADING') ||
      kind.includes('TITLE') ||
      kind.includes('STAGE') ||
      kind.includes('DIRECTION') ||
      kind.includes('LYRIC') ||
      kind.includes('NOTE')
    ) {
      return true;
    }

    return /^(SCENE|END SCENE|VERSE|PRESET|LIGHT CUE|BLACKOUT|TRANSITION|MUSICAL NUMBER|MUSIC|SONG|DIALOGUE|ACT|OPTIONAL|NOTE|CHOREOGRAPHY|SECTION)\b/.test(t);
  }

  function isSpeakerKind(kind) {
    return (
      kind.includes('CHARACTER') ||
      kind.includes('SPEAKER') ||
      kind.includes('ROLE')
    );
  }

  function isLikelySpeaker(value, kind) {
    const original = text(value);
    const t = normalize(original);

    if (!t) return false;
    if (isHeadingLike(t, kind)) return false;

    if (isSpeakerKind(kind)) return true;

    if (original.length > 45) return false;
    if (/[.!?]$/.test(original)) return false;
    if (!/[A-Z]/.test(t)) return false;

    const words = t.split(/\s+/).filter(Boolean);
    if (words.length > 6) return false;

    const allowed = /^[A-Z0-9 '&/+.-]+$/.test(t);
    const hasLowercase = /[a-z]/.test(original);

    return allowed && !hasLowercase;
  }

  function isSpeakerNumber(value) {
    return /^\d{1,2}$/.test(text(value));
  }

  function cleanSpeaker(value) {
    return text(value)
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s*\+\s*/g, ' + ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shouldCombineSpeakerNumber(speaker, nextValue) {
    if (!speaker || !isSpeakerNumber(nextValue)) return false;
    if (/\d$/.test(text(speaker))) return false;
    return true;
  }

  function sceneNumberFrom(scene, fallback) {
    const possible = scene?.number || scene?.sceneNumber || scene?.scene || scene?.id || fallback;
    const match = String(possible ?? fallback).match(/\d+/);
    return match ? match[0].padStart(2, '0') : String(fallback).padStart(2, '0');
  }

  function sceneTitleFrom(scene, sceneNo) {
    return text(scene?.title || scene?.name || scene?.label || `Scene ${sceneNo}`);
  }

  function addLine(result, sceneMeta, speaker, lineText, cue, cueSpeaker) {
    const safeLine = text(lineText);
    const safeSpeaker = cleanSpeaker(speaker);

    if (!safeSpeaker || !safeLine) return;

    const index = result.length + 1;
    const key = [
      sceneMeta.number,
      normalize(safeSpeaker),
      index,
      hashText(safeLine),
    ].join('|');

    result.push({
      key,
      sceneNumber: sceneMeta.number,
      sceneTitle: sceneMeta.title,
      speaker: safeSpeaker,
      speakerKey: normalize(safeSpeaker),
      text: safeLine,
      cue: text(cue) || 'Opening line / no cue before this line.',
      cueSpeaker: text(cueSpeaker),
      index,
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

    for (const block of blocks) {
      const kind = getBlockKind(block);
      const blockText = getBlockText(block);
      const explicitSpeaker = getExplicitSpeaker(block);

      if (explicitSpeaker && block && typeof block === 'object') {
        const directLine = text(block.line || block.dialogue || block.text || block.content || '');
        const speakerOnly = normalize(directLine) === normalize(explicitSpeaker);

        if (directLine && !speakerOnly && !isHeadingLike(directLine, kind)) {
          const speaker = cleanSpeaker(explicitSpeaker);
          addLine(result, sceneMeta, speaker, directLine, lastSpokenText, lastSpokenSpeaker);
          lastSpokenText = directLine;
          lastSpokenSpeaker = speaker;
          currentSpeaker = speaker;
          continue;
        }
      }

      if (!blockText) continue;

      if (shouldCombineSpeakerNumber(currentSpeaker, blockText)) {
        currentSpeaker = cleanSpeaker(`${currentSpeaker} ${blockText}`);
        continue;
      }

      if (isLikelySpeaker(blockText, kind)) {
        currentSpeaker = cleanSpeaker(blockText);
        continue;
      }

      if (isHeadingLike(blockText, kind)) {
        continue;
      }

      if (currentSpeaker) {
        addLine(result, sceneMeta, currentSpeaker, blockText, lastSpokenText, lastSpokenSpeaker);
        lastSpokenText = blockText;
        lastSpokenSpeaker = currentSpeaker;
      }
    }

    return result;
  }

  async function loadScenes() {
    const loaded = [];

    for (const sceneNo of SCENE_NUMBERS) {
      try {
        const scene = await fetchJson(`data/scenes/scene-${sceneNo}.json`);
        loaded.push({
          sceneNumber: sceneNumberFrom(scene, sceneNo),
          sceneTitle: sceneTitleFrom(scene, sceneNo),
          scene,
        });
      } catch (error) {
        console.warn(`Line practice skipped Scene ${sceneNo}:`, error);
      }
    }

    return loaded;
  }

  function uniqueRoles(lines) {
    const map = new Map();

    for (const line of lines) {
      if (!map.has(line.speakerKey)) {
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
        <h2>${htmlEscape(lines[0].speaker)}</h2>
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
      allLines = allScenes.flatMap(item =>
        extractLinesFromScene(item.scene, item.sceneNumber)
      );

      if (!allLines.length) {
        throw new Error('No dialogue lines were found in data/scenes/scene-##.json.');
      }

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
