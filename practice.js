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
  const CHOICES = {
    "act": {
      "cue": [
        "Your partner pauses before your line. What starts your line?",
        [
          "Say your line right away.",
          "Wait for the line or action before yours.",
          "Watch the crowd for a sign."
        ],
        1,
        "Yes. Your partner’s cue starts your part, even if the pace changes."
      ],
      "clear": [
        "Your character has no words in this moment. How can we see what they feel?",
        [
          "Add lots of new moves.",
          "Make one clear look or action from your scene.",
          "Stand with your back to the story."
        ],
        1,
        "Yes. One clear action can tell the story without a line."
      ],
      "pass": [
        "The next actor is about to enter. What helps them?",
        [
          "Keep watching and give them room.",
          "Add an extra line.",
          "Leave before your part ends."
        ],
        0,
        "Yes. Listening and giving space help the next person begin."
      ]
    },
    "sing": {
      "cue": [
        "The track starts very softly. When do you sing?",
        [
          "Guess and enter early.",
          "Listen for your agreed word or count.",
          "Wait until everyone else is done."
        ],
        1,
        "Yes. Listen for your real entry cue."
      ],
      "clear": [
        "The words are hard to hear. What do you try?",
        [
          "Push your voice harder.",
          "Sing faster.",
          "Sing one short phrase gently with clear words."
        ],
        2,
        "Yes. Clear words carry the story. Keep your voice easy."
      ],
      "pass": [
        "A new voice joins your group. What helps them?",
        [
          "Sing over them.",
          "Listen and blend with the group.",
          "Stop listening to the music."
        ],
        1,
        "Yes. Listen as you sing so the group can stay together."
      ]
    },
    "dance": {
      "cue": [
        "The music is quiet before your entrance. When do you move?",
        [
          "Use your approved count or cue.",
          "Rush in so you are not late.",
          "Add a new move to fill the gap."
        ],
        0,
        "Yes. Follow the count and move your team learned."
      ],
      "clear": [
        "Your move is hard to read. What helps?",
        [
          "Make the safe start and end clear.",
          "Make the move bigger than the plan.",
          "Speed through it."
        ],
        0,
        "Yes. A clear shape helps the audience see your part."
      ],
      "pass": [
        "Another dancer needs the space beside you. What do you do?",
        [
          "Take more of their space.",
          "Keep your set path and spacing.",
          "Invent a new place to stand."
        ],
        1,
        "Yes. Keep your agreed space so everyone can move safely."
      ]
    },
    "crew": {
      "cue": [
        "Your signal to start is not clear. What do you do?",
        [
          "Guess and run the cue.",
          "Ask your lead to confirm the plan.",
          "Let someone else guess."
        ],
        1,
        "Yes. Pause and check with your lead before any cue."
      ],
      "clear": [
        "The next team needs to know if a prop is ready. What do you say?",
        [
          "Say it is ready without checking.",
          "Give a short, true update to the right person.",
          "Change the handoff without telling anyone."
        ],
        1,
        "Yes. A clear, true update helps the next team act."
      ],
      "pass": [
        "A piece is not ready for the next person. What do you do?",
        [
          "Hide the problem.",
          "Make an unapproved change.",
          "Tell your lead early and check the next step."
        ],
        2,
        "Yes. Tell your lead early so the handoff stays safe."
      ]
    }
  };
  // A twist describes the problem only. Its answer stays in the choices.
  // Each replay alternates between two situations for a given job and skill.
  const TWISTS = {
    act: {
      cue: [
        ['Your partner takes a longer pause than usual. The room is quiet. What do you watch for?',
          ['A look or action that is part of your agreed scene.', 'A laugh from the crowd.', 'The number of seconds you usually wait.'], 0,
          'You stayed in the moment and used the scene cue.', 'A guessed time or crowd reaction may send you in too soon.'],
        ['Your partner says the last line in a new rhythm. Your entrance is next. What helps?',
          ['Say your line on the old count.', 'Listen for the meaning and the agreed cue.', 'Add a line to bring the rhythm back.'], 1,
          'You listened and kept the story moving.', 'A set count or new line can pull you out of the scene.']
      ],
      clear: [
        ['Mary is speaking. Your silent character hears news they did not expect. What could tell that story?',
          ['A small, clear look toward Mary.', 'A big new gesture through her line.', 'Turning away from the scene.'], 0,
          'One clear reaction helps us see what changed.', 'A large new move may pull focus from the speaker.'],
        ['Your line is heard, but your feeling is hard to read. What is one useful change?',
          ['Speak every word much faster.', 'Choose one word to mean and look at your partner.', 'Add a new speech.'], 1,
          'A small choice made the meaning clearer.', 'More speed or new words will not help the listener.']
      ],
      pass: [
        ['Your partner needs one beat to react before your next line. What helps?',
          ['Keep eye contact and give that beat.', 'Look away and leave the scene.', 'Add another line right away.'], 0,
          'You gave your partner room while staying in the story.', 'Leaving or filling the beat can take away their moment.'],
        ['An actor enters from the doorway as you cross. What is your best move?',
          ['Keep the set path and stay aware of their entrance.', 'Change the blocking alone.', 'Stand in the doorway to be seen.'], 0,
          'You protected the entrance and your agreed blocking.', 'An unplanned move may block the next actor.']
      ]
    },
    sing: {
      cue: [
        ['The track has a soft intro before your first word. What tells you to begin?',
          ['The agreed sound or count in the track.', 'The moment you think it has been long enough.', 'A person in the audience moving.'], 0,
          'You followed the music cue.', 'Guessing from time or the audience could start you early.'],
        ['A song begins after a spoken line. The line has a long pause. When do you enter?',
          ['At the time you practiced yesterday.', 'After the agreed line and music cue.', 'Whenever you feel ready.'], 1,
          'You listened to the scene and the music.', 'The pace may change, so wait for the agreed cue.']
      ],
      clear: [
        ['In “What Will He Be?” the words carry the story. One phrase sounds muddy. What do you try?',
          ['Push your voice louder.', 'Sing the phrase gently with clear consonants.', 'Skip the hard words.'], 1,
          'Clear words tell the story without strain.', 'Louder or missing words can make the story harder to follow.'],
        ['The last word of your phrase disappears. What could help?',
          ['Finish the word at the agreed ending.', 'Add a long note not in the music.', 'Sing the whole phrase faster.'], 0,
          'You gave the word a clear ending.', 'Extra notes or speed can blur the phrase.']
      ],
      pass: [
        ['Another singer has the next phrase. What should they hear from you?',
          ['A steady, blended end to your phrase.', 'You singing over their first word.', 'Silence before your own ending.'], 0,
          'Your ending helped the next voice enter.', 'Covering their entry or cutting your part short makes the handoff harder.'],
        ['Your group sounds louder than the solo voice. What helps the story?',
          ['Keep the same volume no matter what.', 'Listen and follow the group’s agreed level.', 'Stop singing without a cue.'], 1,
          'You made space for the story and the solo.', 'The group needs to follow the agreed balance.']
      ]
    },
    dance: {
      cue: [
        ['In the Scene 9 dance, the music dips just before your entrance. What starts your move?',
          ['The approved count or visual cue.', 'The first moment of quiet.', 'The dancer beside you guessing.'], 0,
          'You used the count your team learned.', 'The dip or another guess may not be your cue.'],
        ['A dancer before you finishes a move slowly. What should you do?',
          ['Rush through their space.', 'Keep your set place and wait for your cue.', 'Invent a new step.'], 1,
          'You kept the group safe and on its cue.', 'Rushing or changing steps can upset spacing.']
      ],
      clear: [
        ['Your arm shape gets lost from the back row. What helps?',
          ['Mark its start and finish within the approved move.', 'Make a large new shape near another dancer.', 'Move before the count.'], 0,
          'A clean start and finish make the move read.', 'An unplanned shape or early move may crowd others.'],
        ['Your group ends together, but your finish is hard to see. What do you try?',
          ['Hold the approved finish clearly.', 'Keep moving after everyone stops.', 'Move into another dancer’s place.'], 0,
          'Your still finish helps the whole picture.', 'Extra movement pulls attention from the group.']
      ],
      pass: [
        ['A dancer crosses behind you on the next count. What protects the handoff?',
          ['Keep the agreed path and spacing.', 'Step into their route to help them.', 'Stop in a new spot.'], 0,
          'You made room for the next dancer.', 'Changing the route alone can block or trip someone.'],
        ['Your group changes lines. One dancer is late. What helps?',
          ['Run to a new spot.', 'Keep your own safe count and set place.', 'Pull them into position.'], 1,
          'You kept your part steady and safe.', 'An unplanned move can make the group less safe.']
      ]
    },
    crew: {
      cue: [
        ['The scene change is near, but the signal is unclear. What comes first?',
          ['Move the set now.', 'Check the approved cue with your lead.', 'Ask an actor to guess.'], 1,
          'You protected the team by confirming the cue.', 'A guessed signal can put people and scenery at risk.'],
        ['A plan was changed at rehearsal, but your sheet has the old order. What do you do?',
          ['Use the old order.', 'Pick whichever seems right.', 'Ask your lead for the current approved order.'], 2,
          'You checked the current plan before acting.', 'Old notes or guesses may send the wrong cue.']
      ],
      clear: [
        ['A prop for the Bethlehem doorway is missing. What should your update say?',
          ['“Everything is ready.”', '“The prop is missing; I am checking with our lead.”', 'Nothing until the cue begins.'], 1,
          'A short, true update gives the team time to act.', 'A false or late update can surprise the next person.'],
        ['Your lead asks if the set is ready, but one piece is still being checked. What do you say?',
          ['“Ready,” so the show can go on.', '“I am not sure,” to the audience.', '“One piece is still being checked,” to your lead.'], 2,
          'You gave the right person the real status.', 'The lead needs the true status before the next step.']
      ],
      pass: [
        ['The next crew member is waiting for your handoff. A detail is missing. What helps?',
          ['Tell your lead and the next person what is missing.', 'Leave it for them to discover.', 'Make a new safety step yourself.'], 0,
          'You made the handoff clear and safe.', 'Hidden gaps or unapproved fixes can hurt the next task.'],
        ['A lantern is not ready for the next scene. What should happen?',
          ['Put it on stage anyway.', 'Tell your lead early and follow the backup plan.', 'Ask an actor to repair it.'], 1,
          'You gave the team time to use its plan.', 'An unready item should not be passed on as ready.']
      ]
    }
  };
  const $ = selector => document.querySelector(selector);
  let personId = 'guest';
  let path = 'act';
  let mission = null;
  let memory = {};
  let storageWorks = true;
  let round = 0;
  let variation = 0;

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
  function weekKey(when) {
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit',
      day: '2-digit', weekday: 'short'
    }).formatToParts(date).map(part => [part.type, part.value]));
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
    return new Date(local - ((day + 6) % 7) * 86400000).toISOString().slice(0, 10);
  }
  function renderProgress() {
    const data = player();
    const thisWeek = weekKey(new Date());
    const plays = Array.isArray(data.plays) ? data.plays : [];
    const count = plays.filter(item => item.path === path && weekKey(item.at) === thisWeek).length;
    const shown = Math.min(count, 3);
    const ring = $('#progressRing');
    ring.style.setProperty('--progress', `${shown / 3 * 100}%`);
    ring.setAttribute('aria-label', `${shown} of 3 optional challenges played this week on this path`);
    $('#progressNumber').textContent = `${shown}/3`;
    $('#weeklyProgress').textContent = shown === 3
      ? 'You filled this week’s ring! Play again for practice, or bring a move to rehearsal.'
      : !plays.length && Object.values(data.paths?.[path] || {}).some(value => Number(value) > 0)
        ? 'Your earlier gems are saved below. The weekly ring starts counting with this update.'
      : `${shown} of 3 short plays this week on this job. This is optional. A new week starts Monday.`;
    const shelf = $('#badgeShelf');
    shelf.replaceChildren();
    const checks = Array.isArray(data.checks) ? data.checks : [];
    for (const [skill, label, icon] of [
      ['cue', 'Cue Keeper', '✦'], ['clear', 'Clarity Star', '★'], ['pass', 'Team Helper', '◆']
    ]) {
      const earned = checks.some(check => check.path === path && check.skill === skill && check.level === 'seen');
      const badge = document.createElement('span');
      badge.className = 'questBadge' + (earned ? ' earned' : '');
      badge.setAttribute('aria-label', `${label}: ${earned ? 'coach saw this skill' : 'not yet seen by a coach'}`);
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = earned ? icon : '◇';
      const words = document.createElement('span');
      words.textContent = label;
      badge.append(mark, words);
      shelf.append(badge);
    }
  }
  function celebrate() {
    const box = $('#rewardBurst');
    box.replaceChildren();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 12; i += 1) {
      const spark = document.createElement('span');
      spark.textContent = i % 3 === 0 ? '✦' : '◆';
      spark.style.setProperty('--angle', `${i * 30}deg`);
      spark.style.setProperty('--distance', `${65 + i % 3 * 18}px`);
      box.append(spark);
    }
    box.classList.remove('burst');
    void box.offsetWidth;
    box.classList.add('burst');
    window.setTimeout(() => { box.classList.remove('burst'); box.replaceChildren(); }, 1100);
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
    $('#missionProgress').textContent = `${count} of 3 missions played on this path. ${count === 3 ? 'You tried them all! Replay one with a new twist.' : 'Each gem means you finished a challenge.'}`;
    renderProgress();
    renderHistory();
  }
  function start(name) {
    mission = name;
    round = 0;
    variation = playsFor(name) % 2;
    $('#gameBoard').hidden = false;
    $('#gameTitle').textContent = NAMES[name];
    $('#gameSetup').textContent = 'Make two choices. If one does not work, try another answer.';
    $('#gameResult').textContent = '';
    $('#replayMission').hidden = true;
    $('#nextMission').hidden = true;
    $('#realMove').hidden = true;
    $('#nextStepCard').hidden = true;
    $('#gameBoard').classList.remove('completed');
    $('#coachSkill').value = name;
    $('#gameBoard').classList.remove('questEnter');
    void $('#gameBoard').offsetWidth;
    $('#gameBoard').classList.add('questEnter');
    showRound();
    render();
    $('#gameBoard').scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }
  function showRound() {
    const challenge = round === 0 ? CHOICES[path][mission] : TWISTS[path][mission][variation];
    const options = challenge[1];
    const correct = challenge[2];
    $('#challengeStep').textContent = 'CHOICE ' + (round + 1) + ' OF 2';
    $('#roundOne').textContent = challenge[0];
    $('#roundLabel').textContent = round === 0 ? 'WHAT WOULD YOU DO?' : 'NEW TWIST';
    $('#stepFill').style.width = round === 0 ? '50%' : '100%';
    $('#answerFeedback').textContent = '';
    $('#answerFeedback').className = 'answerFeedback';
    $('#nextRound').hidden = true;
    $('#realMove').hidden = true;
    const answers = $('#answerChoices');
    answers.replaceChildren();
    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answerButton';
      button.textContent = option;
      button.addEventListener('click', () => {
        if (index !== correct) {
          $('#answerFeedback').textContent = (challenge[4] ||
            'That choice might make the scene harder for the next person.') + ' Try another answer.';
          $('#answerFeedback').className = 'answerFeedback isWrong';
          button.disabled = true;
          button.classList.add('answerWrong');
          return;
        }
        $('#answerFeedback').textContent = challenge[3];
        $('#answerFeedback').className = 'answerFeedback isRight';
        for (const answer of answers.querySelectorAll('button')) answer.disabled = true;
        button.classList.add('answerRight');
        if (round === 0) {
          $('#nextRound').hidden = false;
          $('#nextRound').focus();
        }
        else {
          $('#realMove').hidden = false;
          $('#roundTwo').textContent = 'Your turn: ' + PATHS[path][mission][3] +
            ' Try it once now. Then tap “I tried it!”';
          $('#finishMission').focus();
        }
      });
      answers.append(button);
    });
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
  $('#startQuest').addEventListener('click', async () => { await ready; start('cue'); });
  $('#nextRound').addEventListener('click', () => { round = 1; showRound(); });
  $('#finishMission').addEventListener('click', () => {
    if (!mission || round !== 1 || $('#realMove').hidden) return;
    const chosen = { cue: 'notice', clear: 'clear', pass: 'together' }[mission];
    const data = player();
    const paths = { ...(data.paths || {}) };
    paths[path] = { ...(paths[path] || {}), [mission]: playsFor(mission) + 1 };
    const plays = Array.isArray(data.plays) ? data.plays : [];
    update({ paths, plays: [...plays.slice(-199), { at: new Date().toISOString(), path, mission }], nextMove: chosen });
    $('#gameResult').textContent = 'Nice work! Your next move: ' + NEXT[chosen] +
      '. Show it at your next rehearsal.';
    $('#realMove').hidden = true;
    $('#answerChoices').replaceChildren();
    $('#gameTitle').textContent = NAMES[mission] + ' complete!';
    $('#gameBoard').classList.add('completed');
    $('#replayMission').hidden = false;
    $('#replayMission').textContent = 'Try another twist';
    $('#nextMission').hidden = false;
    $('#nextStepCard').hidden = false;
    celebrate();
  });
  $('#replayMission').addEventListener('click', () => start(mission));
  $('#nextMission').addEventListener('click', () => {
    const order = Object.keys(NAMES);
    start(order[(order.indexOf(mission) + 1) % order.length]);
  });
  $('#openCoach').addEventListener('click', () => {
    $('#coachSection').open = true;
    $('#coachSection').scrollIntoView({ block: 'start' });
  });
  $('#coachForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const check = { date: $('#coachDate').value, path, skill: $('#coachSkill').value,
      level: form.querySelector('input[name="coachLevel"]:checked').value, next: $('#coachNext').value };
    const data = player();
    const checks = Array.isArray(data.checks) ? [...data.checks] : [];
    const hadBadge = checks.some(item => item.path === path && item.skill === check.skill && item.level === 'seen');
    const index = checks.findIndex(item => item.date === check.date && item.path === path && item.skill === check.skill);
    if (index >= 0) checks[index] = check; else checks.push(check);
    update({ checks });
    const earnedName = { cue: 'Cue Keeper', clear: 'Clarity Star', pass: 'Team Helper' }[check.skill];
    $('#coachStatus').textContent = !hadBadge && check.level === 'seen'
      ? `Badge unlocked: ${earnedName}! Your coach saw this skill today. ` +
        (storageWorks ? 'Saved on this device.' : 'Marked for this session only.')
      : storageWorks ? 'Saved on this device. Try your next move at home.' : 'Marked for this session only.';
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
  const ready = init();
})();
