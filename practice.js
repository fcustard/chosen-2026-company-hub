/* Show Quest stores practice on this device. It sends no progress to a server. */
(() => {
  'use strict';
  if (document.body?.dataset.page !== 'practice') return;

  const KEY = 'chosen2026-show-quest-v2';
  const OLD_KEY = 'chosen2026-character-quest-v1';
  const NAMES = { cue: 'Cue Hunt', clear: 'Make It Clear', pass: 'Pass It On' };
  const JOB_NAMES = { act: 'Act', sing: 'Sing', dance: 'Dance', crew: 'Make the show' };
  const NEXT = { notice: 'Watch for the cue', clear: 'Make it easier to see or hear', together: 'Try with a partner' };
  // Small craft steps use current scripts, tracks, and leaders' plans.
  const CRAFT_STEPS = {
    "act": {
      "cue": {
        "title": "What do you want?",
        "steps": [
          "Find your part. What do you want from the other person?",
          "Look up from your script. Listen for your cue. Show what you want in a new way.",
          "Try from memory. Listen first. Let your words or look show what you want."
        ]
      },
      "clear": {
        "title": "Show the feeling",
        "steps": [
          "Find one line or quiet move. What should the crowd feel?",
          "Try it once. Make one word stand out, or change one small move.",
          "Try from memory. Let the back row hear your words without shouting, or see one clear move."
        ]
      },
      "pass": {
        "title": "Listen, then act",
        "steps": [
          "Find who comes after you. What might they feel?",
          "Ask someone to say your cue, or read it aloud. Listen. Let your next line or move change a little.",
          "Try from memory. Watch and listen. Leave room for the next person."
        ]
      }
    },
    "sing": {
      "cue": {
        "title": "Find your sound",
        "steps": [
          "Find your song. What word, sound, or count tells you to start?",
          "Listen to the track or use your leader’s count. Sing your first words at the right time.",
          "Sing from memory. Let the words show the feeling. Keep your voice easy."
        ]
      },
      "clear": {
        "title": "Words and breath",
        "steps": [
          "Pick one short song part. Say the words so each one is clear.",
          "Sing it gently. Take an easy breath and make the last sounds clear.",
          "Sing from memory. Keep the words clear without pushing your voice."
        ]
      },
      "pass": {
        "title": "Sing with the group",
        "steps": [
          "Find where your song part ends. Who sings next?",
          "Sing the end softly. Listen for the other voices and leave them room.",
          "Sing from memory. End with your group and listen for the next sound."
        ]
      }
    },
    "dance": {
      "cue": {
        "title": "Show the feeling",
        "steps": [
          "Find one move your leader taught. What part of your body starts it?",
          "Try the move slowly. Feel where your weight goes.",
          "Try from memory. Let your body and eyes show the feeling. Use safe space."
        ]
      },
      "clear": {
        "title": "Use your space",
        "steps": [
          "Name where your leader placed you at the start and end.",
          "Walk your path slowly. Look for the space other dancers need.",
          "Try from memory. Make each move clear and keep room around you."
        ]
      },
      "pass": {
        "title": "Move as a team",
        "steps": [
          "Find your last move. Where does the next dancer need to go?",
          "Try your last pose and your next path at a safe speed.",
          "Try from memory. Hold your pose until your leader’s cue, then make room."
        ]
      }
    },
    "crew": {
      "cue": {
        "title": "Know your cue",
        "steps": [
          "Find the cue your leader gave you in the current plan.",
          "Say what tells you to start and what you do next. Do not use show gear at home.",
          "Say your cue and next step from memory. Check the plan before you do it at rehearsal."
        ]
      },
      "clear": {
        "title": "Keep the team ready",
        "steps": [
          "Name one thing your leader asked you to check.",
          "Say what is ready and what still needs help. Ask if you are not sure.",
          "Say your check from memory. Compare it with the current plan before the show."
        ]
      },
      "pass": {
        "title": "Help the next person",
        "steps": [
          "Find who needs your work next in the current plan.",
          "Say what you need to pass on. Keep walkways clear.",
          "Name the next person and step from memory. Check the plan together at rehearsal."
        ]
      }
    }
  };
  const CRAFT_LEVELS = { 1: 'With my script or plan', 2: 'With a hint', 3: 'From memory' };
  const CRAFT_FEELINGS = { steps: 'I found my next step', choice: 'I made a clear choice', connected: 'I felt connected' };

  const SCENE_MOMENTS = {
    '01': ['Welcome to Nazareth', 'Nia and Simon show us the village of Nazareth.'],
    '02': ['Mary & Joseph / My Beloved', 'Mary and Joseph talk about the home they hope to share.'],
    '03': ['Gabriel / Chosen', 'Gabriel brings Mary news that changes her life.'],
    '04': ['The Secret', 'Mary tells her friends a secret.'],
    '05': ['Brotherhood', 'Joseph builds a table with his friends.'],
    '06': ['Mary Tells Joseph / It’s Not Mine', 'Mary tells Joseph the truth. He finds it hard to believe.'],
    '07': ['Two Roads of Faith', 'Mary stays with Elizabeth. Joseph faces his own choice.'],
    '08': ['Reunion / Still Yours', 'Joseph comes to Mary. They speak again.'],
    '09': ['What Will He Be? / The Town Turns', 'The children dance. The town talks about Mary and Joseph.'],
    '10': ['The Census and the Journey', 'Mary and Joseph leave Nazareth for Bethlehem.'],
    '11': ['No Room', 'Joseph asks for a room. The town is full.'],
    '12': ['Good News / Shepherds / Finale', 'Shepherds hear the good news and come to the manger.']
  };
  function sceneMoment(scene) {
    const item = scene && SCENE_MOMENTS[scene.scene];
    return item && item[0] === scene.title ? item[1] : '';
  }
  function openingWords(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 9).join(' ') + (words.length > 9 ? '…' : '');
  }
  // Exercises paraphrased from the three user-supplied video transcripts.
  // Keep stage voice and approved blocking; the videos also discuss camera acting.
  const ACT_LESSONS = {
    cue: [
      { title: 'What do you want?', step: 'Ask what your person wants here. Find your cue. Try your line or move after it.', video: 'https://www.youtube.com/watch?v=2RxOoOIXZ_c&t=114s' },
      { title: 'What happened first?', step: 'Think about what happened just before this scene. Find your cue. Try your line or move.', video: 'https://www.youtube.com/watch?v=2RxOoOIXZ_c&t=308s' }
    ],
    clear: [
      { title: 'Make it clear', step: 'Say a short line slowly. Make each last sound clear. Say it again so the back row can hear. No line? Show one clear move.', video: 'https://www.youtube.com/watch?v=dwMgvviP-Nw&t=74s' },
      { title: 'Make a small change', step: 'Try one line or move two ways. Change one look or pause. Keep the words and moves your team set.', video: 'https://www.youtube.com/watch?v=lKlpdl-vwQQ&t=438s' }
    ],
    pass: [
      { title: 'Listen, then answer', step: 'Read the cue, or ask someone to say it. Listen. Then say your line or show your move.', video: 'https://www.youtube.com/watch?v=2RxOoOIXZ_c&t=233s' },
      { title: 'Try a new reply', step: 'Read or hear the cue in a new way. Keep your lines and places. Change your look or pause a little.', video: 'https://www.youtube.com/watch?v=2RxOoOIXZ_c&t=233s' }
    ]
  };
  const PATHS = {
    act: {
      cue: ['Pick a scene. What line or move comes just before your part?', 'Look away. Say when you would start.', ['Wait for the line or move.', 'If your friend pauses, keep watching.'], 'Try your start once. Wait for the right line or move.'],
      clear: ['Pick one line or quiet move.', 'Can someone at the back see or hear it?', ['Try a smaller move.', 'Look at the other person.'], 'Try it once. Make one small change. Use the words in your script.'],
      pass: ['Who acts after you?', 'What do they need from you?', ['Give them time.', 'Listen, even if you have no line.'], 'Try your part once. Give the next actor room.']
    },
    sing: {
      cue: ['Pick a song. What sound or count comes before you sing?', 'Listen. Sing the first words at the right time.', ['The music is soft. Listen.', 'There is a long pause. Wait.'], 'Sing your first words once with the current track or your leader’s count.'],
      clear: ['Pick one short part of a song.', 'Sing so we can hear the words. Do not push your voice.', ['Try a softer sound.', 'Say the last word all the way.'], 'Sing it once more. Let us hear each word.'],
      pass: ['Who sings with you or after you?', 'Can you hear their part too?', ['Listen to the group.', 'Make room for the next voice.'], 'Sing it once more. Listen to the other voices.']
    },
    dance: {
      cue: ['Pick a move you already know.', 'What count or move tells you to start?', ['The music is quiet. Keep counting.', 'The dancer before you is slow. Wait in your place.'], 'Do your move once with the count your leader taught you. Use a safe space.'],
      clear: ['Pick one move from your dance.', 'Show its start and end.', ['Try a smaller move.', 'Keep room around you.'], 'Do your move once. Show a clear start and end. Keep it safe.'],
      pass: ['Who moves near you or after you?', 'How can you leave room for them?', ['Keep the path your team learned.', 'Watch when your group stops.'], 'Do your move once. Leave room for the next dancer.']
    },
    crew: {
      cue: ['Pick a job your leader gave you. What tells you to start?', 'Say what you will do. Do not use show gear at home.', ['If you are not sure, ask your leader.', 'If the plan changed, check it first.'], 'Say your next step out loud. Do not use show gear at home.'],
      clear: ['Think of one thing you need to tell the team.', 'Say what is ready. Tell the right person.', ['The room is busy. Find the right person.', 'If you do not know, ask.'], 'Tell your team what is ready. If it is not safe, tell your leader.'],
      pass: ['Who needs your work next?', 'What do they need to know?', ['If something is missing, tell your leader.', 'If it is not ready, tell the team early.'], 'Say what is ready and what is not. Tell your leader if you need help.']
    }
  };
  const CHOICES = {
    "act": {
      "cue": [
        "Your friend pauses before your part. When do you start?",
        [
          "Start your part right away.",
          "Wait for the line or move before yours.",
          "Watch the crowd for a sign."
        ],
        1,
        "Yes. Wait for your friend's line or move. Then start."
      ],
      "clear": [
        "You have no line here. How can we see what you feel?",
        [
          "Add lots of new moves.",
          "Make one clear look or move from your scene.",
          "Stand with your back to the story."
        ],
        1,
        "Yes. One clear look or move can tell the story."
      ],
      "pass": [
        "The next actor is coming in. What helps them?",
        [
          "Keep watching and give them room.",
          "Add an extra line.",
          "Leave before your part ends."
        ],
        0,
        "Yes. Listen and give them room."
      ]
    },
    "sing": {
      "cue": [
        "The music starts softly. When do you sing?",
        [
          "Guess and enter early.",
          "Listen for the word or count your team picked.",
          "Wait until everyone else is done."
        ],
        1,
        "Yes. Wait for the word or count that tells you to sing."
      ],
      "clear": [
        "The words are hard to hear. What do you try?",
        [
          "Push your voice harder.",
          "Sing faster.",
          "Sing one short phrase gently with clear words."
        ],
        2,
        "Yes. Clear words help tell the story. Do not strain your voice."
      ],
      "pass": [
        "A new singer joins your group. What helps them?",
        [
          "Sing over them.",
          "Listen and sing with the group.",
          "Stop listening to the music."
        ],
        1,
        "Yes. Listen as you sing. Stay with the group."
      ]
    },
    "dance": {
      "cue": [
        "The music is quiet before your move. When do you start?",
        [
          "Use the count or move your team picked.",
          "Rush in so you are not late.",
          "Add a new move to fill the gap."
        ],
        0,
        "Yes. Start on the count your team learned."
      ],
      "clear": [
        "People cannot see your move well. What helps?",
        [
          "Show a clear start and end.",
          "Make up a much bigger move.",
          "Speed through it."
        ],
        0,
        "Yes. A clear start and end help people see your part."
      ],
      "pass": [
        "Another dancer needs the space beside you. What do you do?",
        [
          "Take more of their space.",
          "Stay on the path your team learned.",
          "Invent a new place to stand."
        ],
        1,
        "Yes. Stay in your space so all can move safely."
      ]
    },
    "crew": {
      "cue": [
        "You are not sure when to start. What do you do?",
        [
          "Guess and start the task.",
          "Ask your leader to check the plan.",
          "Let someone else guess."
        ],
        1,
        "Yes. Stop and ask your leader before you start."
      ],
      "clear": [
        "The next team needs to know if a show item is ready. What do you say?",
        [
          "Say it is ready without checking.",
          "Tell the right person what is ready.",
          "Change the plan without telling anyone."
        ],
        1,
        "Yes. Tell the next team what is ready."
      ],
      "pass": [
        "A show item is not ready. What do you do?",
        [
          "Hide the problem.",
          "Change the plan on your own.",
          "Tell your leader now and ask what to do."
        ],
        2,
        "Yes. Tell your leader early so the team can stay safe."
      ]
    }
  };
  // A twist describes the problem only. Its answer stays in the choices.
  // Each replay alternates between two situations for a given job and skill.
  const TWISTS = {
    act: {
      cue: [
        ['Your friend pauses longer than usual. What tells you to start?',
          ['The look or move your team picked.', 'A laugh from the crowd.', 'A number you count in your head.'], 0,
          'Yes. You waited for the right look or move.', 'A guess may make you start too soon.'],
        ['Your friend says the last line in a new way. You are next. What helps?',
          ['Say your line on the old count.', 'Listen for the line or move that starts your part.', 'Add a new line.'], 1,
          'Yes. You listened and stayed in the story.', 'A count or new line may make you start at the wrong time.']
      ],
      clear: [
        ['Someone is speaking. You have no line. You hear big news. What can you do?',
          ['Give them one clear look.', 'Make a big new move while they speak.', 'Turn away from the scene.'], 0,
          'Yes. A small look shows how you feel.', 'A big move may take our eyes off the person speaking.'],
        ['People hear your line, but cannot tell how you feel. What can you try?',
          ['Say all the words faster.', 'Mean one word and look at your friend.', 'Make up a new speech.'], 1,
          'Yes. One small choice helps us see how you feel.', 'More speed or new words may hide how you feel.']
      ],
      pass: [
        ['Your friend needs a moment before your next line. What helps?',
          ['Look at them and give them time.', 'Look away and leave.', 'Add a line right away.'], 0,
          'Yes. You gave your friend time and stayed in the story.', 'A new line or a quick exit takes away their moment.'],
        ['An actor comes through the door as you walk by. What do you do?',
          ['Stay on the path your team learned and watch for them.', 'Change where you walk on your own.', 'Stand in the door so people see you.'], 0,
          'Yes. You gave the next actor room.', 'A new move may block the door.']
      ]
    },
    sing: {
      cue: [
        ['The music is soft before your first word. What tells you to sing?',
          ['The sound or count your team picked.', 'A guess that enough time has passed.', 'Someone in the crowd moving.'], 0,
          'Yes. You heard the right sound or count.', 'A guess may make you sing too soon.'],
        ['The song starts after a spoken line. The actor waits a long time. When do you sing?',
          ['At the same time as yesterday.', 'After the line and the music cue your team picked.', 'When you feel ready.'], 1,
          'Yes. You listened to the actor and the music.', 'Wait for the line and music. The time may change.']
      ],
      clear: [
        ['In “What Will He Be?” one part is hard to hear. What can you try?',
          ['Push your voice louder.', 'Sing that part softly and say each word clearly.', 'Skip the hard words.'], 1,
          'Yes. We can hear the words, and your voice stays easy.', 'Loud singing or lost words can hide the story.'],
        ['We cannot hear the last word you sing. What can help?',
          ['Finish the word when your team planned.', 'Add a long note on your own.', 'Sing all the words faster.'], 0,
          'Yes. We heard the whole word.', 'A new note or more speed may hide the word.']
      ],
      pass: [
        ['Another singer sings next. What helps them?',
          ['End your part with the group, then make room.', 'Sing over their first word.', 'Stop before your part ends.'], 0,
          'Yes. Your end helps the next singer start.', 'Singing over them or stopping early can make it hard for them.'],
        ['Your group is louder than the one singer in front. What helps?',
          ['Keep singing as loud as you can.', 'Listen and sing at the level your leader taught.', 'Stop without a cue.'], 1,
          'Yes. You made room to hear the one singer.', 'Your group needs to follow the plan for this song.']
      ]
    },
    dance: {
      cue: [
        ['In the Scene 9 dance, the music gets soft. What tells you to move?',
          ['The count or move your team picked.', 'The first quiet sound.', 'Another dancer guessing.'], 0,
          'Yes. You used the count your team learned.', 'The soft music may not be your time to start.'],
        ['A dancer before you moves slowly. What do you do?',
          ['Rush through their space.', 'Stay in your place and wait for your cue.', 'Make up a new step.'], 1,
          'Yes. You waited in a safe place.', 'A rush or new step may put someone in your way.']
      ],
      clear: [
        ['People in the back cannot see your arm move. What helps?',
          ['Show its start and end as your team learned.', 'Make a new big move near a dancer.', 'Move before the count.'], 0,
          'Yes. A clear start and end help all see it.', 'A new or early move may get in someone’s way.'],
        ['Your group stops together, but your end is hard to see. What do you try?',
          ['Hold the end pose your team learned.', 'Keep moving after all stop.', 'Move into another dancer’s place.'], 0,
          'Yes. Hold still so we can see the whole group.', 'More moves can pull our eyes from the group.']
      ],
      pass: [
        ['A dancer walks behind you next. What do you do?',
          ['Stay on the path your team learned.', 'Step in their way to help.', 'Stop in a new spot.'], 0,
          'Yes. You made room for the next dancer.', 'A new path may block them or make them trip.'],
        ['Your group moves to new places. One dancer is late. What helps?',
          ['Run to a new spot.', 'Keep your count and go to your place.', 'Pull them into place.'], 1,
          'Yes. You did your part and stayed safe.', 'A new move may make it less safe for the group.']
      ]
    },
    crew: {
      cue: [
        ['It is almost time to move the set. You are not sure when. What do you do?',
          ['Move it now.', 'Ask your leader when to start.', 'Ask an actor to guess.'], 1,
          'Yes. You asked before moving the set.', 'A guess may put people or the set in danger.'],
        ['The plan changed, but your paper shows the old plan. What do you do?',
          ['Use the old plan.', 'Pick the plan you like.', 'Ask your leader for the new plan.'], 2,
          'Yes. You checked the new plan.', 'Old notes or guesses may start the wrong task.']
      ],
      clear: [
        ['A show item for the Bethlehem door is missing. What do you say?',
          ['“It is all ready.”', '“The item is missing. I will tell our leader.”', 'Say nothing until the scene starts.'], 1,
          'Yes. A true update gives the team time to help.', 'A wrong or late update may leave the next person stuck.'],
        ['Your leader asks if the set is ready. One piece is still being checked. What do you say?',
          ['“It is ready.”', 'Tell the crowd you are not sure.', '“One piece is still being checked.”'], 2,
          'Yes. You told your leader what is still being checked.', 'Your leader needs to know before the next step.']
      ],
      pass: [
        ['The next crew member needs your work. One thing is missing. What helps?',
          ['Tell your leader and the next person what is missing.', 'Let them find out later.', 'Make up a new safety step.'], 0,
          'Yes. You told the team what they need to know.', 'Tell the team what is wrong. Do not make up a new safety step.'],
        ['A lantern is not ready for the next scene. What should you do?',
          ['Put it on stage anyway.', 'Tell your leader now and follow the safe backup plan.', 'Ask an actor to fix it.'], 1,
          'Yes. Your leader can use the backup plan.', 'Do not put an item on stage if it is not ready.']
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
  let craftLevel = 1;
  let lastSessionAt = '';
  let currentPerson = null;
  let publishedScenes = [];
  let publishedTracks = [];
  let chosenScene = '';
  let sceneLoading = true;
  const roleCache = new Map();
  const RING_LENGTH = 2 * Math.PI * 43;

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
    catch (_) { storageWorks = false; $('#coachStatus').textContent = 'This browser cannot save your play. It will go away when you close this page.'; }
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
  function dayKey(when) {
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function priorDay(key) {
    return new Date(Date.parse(key + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  }
  function practiceDays(data) {
    const days = new Set(Array.isArray(data.practiceDays)
      ? data.practiceDays.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))
      : []);
    for (const item of Array.isArray(data.plays) ? data.plays : []) {
      if (item && item.at) {
        const day = dayKey(item.at);
        if (day) days.add(day);
      }
    }
    return [...days].sort().slice(-500);
  }
  function recordedPractice(data, entry) {
    const days = new Set(practiceDays(data));
    days.add(dayKey(entry.at));
    const plays = Array.isArray(data.plays) ? data.plays : [];
    return { plays: [...plays.slice(-199), entry], practiceDays: [...days].sort().slice(-500) };
  }
  function streakLength(days) {
    const seen = new Set(days);
    let cursor = dayKey(new Date());
    if (!seen.has(cursor)) cursor = priorDay(cursor);
    let count = 0;
    while (seen.has(cursor) && count < 500) {
      count += 1;
      cursor = priorDay(cursor);
    }
    return count;
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
    const count = new Set(plays.filter(item => item && item.path === path && weekKey(item.at) === thisWeek).map(item => dayKey(item.at))).size;
    const shown = Math.min(count, 3);
    const ring = $('#progressRing');
    $('#progressFill').style.strokeDashoffset = String(RING_LENGTH * (1 - shown / 3));
    ring.setAttribute('aria-label', `${shown} of 3 practice days this week for this job. This is not a score.`);
    $('#progressNumber').textContent = `${shown}/3`;
    $('#weeklyProgress').textContent = shown === 3
      ? 'Three days this week! Your ring is full. You can still play.'
      : !plays.length && Object.values(data.paths?.[path] || {}).some(value => Number(value) > 0)
        ? 'Your old game marks are here. The ring counts days you play from now on.'
      : `${shown} of 3 days this week for this job. New week on Monday. No score here!`;
    const days = practiceDays(data);
    const streak = streakLength(days);
    const didToday = days.includes(dayKey(new Date()));
    $('#streakCount').textContent = `${streak} ${streak === 1 ? 'day' : 'days'} in a row`;
    $('#streakStatus').textContent = didToday ? 'You practiced today. Come back tomorrow.' :
      streak ? 'Practice today to keep it going.' : 'Practice today to start a streak.';
    $('#streakWidget').classList.toggle('active', streak > 0);
    const shelf = $('#badgeShelf');
    shelf.replaceChildren();
    for (const [skill, label, icon] of [
      ['cue', 'Cue Keeper', '✦'], ['clear', 'Clear Star', '★'], ['pass', 'Team Helper', '◆']
    ]) {
      const earned = playsFor(skill) > 0;
      const badge = document.createElement('span');
      badge.className = 'questBadge' + (earned ? ' earned' : '');
      badge.setAttribute('aria-label', `${label}: ${earned ? 'game finished' : 'game not played yet'}`);
      const mark = document.createElement('span');
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = earned ? icon : '◇';
      const words = document.createElement('span');
      words.textContent = label;
      badge.append(mark, words);
      shelf.append(badge);
    }
  }
  function scenesForPerson() {
    if (!currentPerson || !Array.isArray(currentPerson.scenes) || !currentPerson.scenes.length) return publishedScenes;
    const castScenes = new Set(currentPerson.scenes.map(Number));
    const matches = publishedScenes.filter(scene => castScenes.has(Number(scene.scene)));
    return matches.length ? matches : publishedScenes;
  }
  function cleanRole(value) {
    return String(value || '').split(/[—–]/)[0].replace(/\([^)]*\)/g, '')
      .replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }
  async function findScriptRole(scene) {
    if (!currentPerson || path !== 'act' || roleCache.has(scene.scene)) return;
    roleCache.set(scene.scene, '');
    try {
      const response = await fetch(scene.readUrl.replace('.html', '.json').replace(/^scene-/, 'data/scenes/scene-'), { cache: 'no-store' });
      if (!response.ok) return;
      const script = await response.json();
      if (!script.approved || !script.companyPublish || !Array.isArray(script.blocks)) return;
      const castRoles = String(currentPerson.roles || '');
      const names = new Set(castRoles.split('/').map(cleanRole)
        .filter(name => name && !['ENSEMBLE', 'DANCER', 'CHOIR', 'SINGER', 'CREW'].includes(name)));
      if (/\bELI\b/i.test(castRoles) && /\bINNKEEPER\b/i.test(castRoles)) names.add('INNKEEPER ELI');
      for (let i = 0; i < script.blocks.length; i += 1) {
        const block = script.blocks[i];
        const role = cleanRole(block.text);
        if (block.type !== 'character' || !names.has(role)) continue;
        for (let next = i + 1; next < script.blocks.length && script.blocks[next].type !== 'character'; next += 1) {
          const line = script.blocks[next];
          // Eli's approved italic lines are typed as stage blocks in the feed.
          const eliLine = role === 'INNKEEPER ELI' && next === i + 1 && line.type === 'stage' &&
            ['Yes?', 'I have people everywhere.', 'I don’t even have floor left.', 'I’m sorry.'].includes(line.text);
          if (line.type === 'dialogue' || eliLine) {
            roleCache.set(scene.scene, { role, line: openingWords(line.text) });
            if (chosenScene === scene.scene) renderDailyTask();
            return;
          }
        }
      }
    } catch (_) { /* Scene task still works without a character match. */ }
  }
  function playMotion(element, name) {
    element.classList.remove(name);
    void element.offsetWidth;
    element.classList.add(name);
  }
  function updatePreviewText(element, value) {
    if (element.textContent === value) return;
    element.textContent = value;
    playMotion(element, 'textSwapIn');
  }
  function renderDailyTask() {
    const select = $('#sceneChoice');
    const choices = scenesForPerson();
    const signature = choices.map(scene => scene.scene).join(',');
    if (select.dataset.sceneList !== signature) {
      select.replaceChildren();
      for (const scene of choices) {
        const option = document.createElement('option');
        option.value = scene.scene;
        option.textContent = `Scene ${Number(scene.scene)}: ${scene.title}`;
        select.append(option);
      }
      select.dataset.sceneList = signature;
    }
    if (choices.length) {
      if (!choices.some(scene => scene.scene === chosenScene)) chosenScene = choices[0].scene;
    } else if (!sceneLoading) chosenScene = '';
    select.disabled = !choices.length;
    select.hidden = !choices.length;
    document.querySelector('label[for="sceneChoice"]').hidden = !choices.length;
    if (chosenScene) select.value = chosenScene;
    const scene = choices.find(item => item.scene === chosenScene);
    const roleInfo = scene ? roleCache.get(scene.scene) : null;
    const role = roleInfo?.role || '';
    const lineStart = roleInfo?.line || '';
    const track = scene && path === 'sing' ? publishedTracks.find(item =>
      item.scenes.some(number => Number(number) === Number(scene.scene)) &&
      !/instrumental/i.test(item.title)) : null;
    const task = {
      act: lineStart
        ? `You play ${role}. Find your line that starts “${lineStart}”. Read the line before it. Then pick how to try it.`
        : 'Find your part. Pick one line or a silent move. Then pick how to try it.',
      sing: track
        ? `Use “${track.title}” in Music. Find where your song part starts.`
        : 'Pick a song part you know. Find where it starts.',
      dance: 'Use the steps your leader taught. Pick one short part. Keep space clear.',
      crew: 'Find your cue in the current plan. Do not use show gear at home.'
    }[path];
    $('#sceneTask').textContent = scene ? `Scene ${Number(scene.scene)}: ${scene.title}. ${sceneMoment(scene) ? 'Story: ' + sceneMoment(scene) + ' ' : ''}${task}` :
      sceneLoading ? 'Finding your scene…' : `Pick a current scene in Scripts. ${task}`;
    const link = $('#sceneLink');
    link.href = scene && /^scene-\d{2}\.html$/.test(scene.readUrl) ? scene.readUrl : 'scripts.html';
    link.textContent = scene ? `Open Scene ${Number(scene.scene)}` : 'Open scripts';
    $('#practiceTrack').hidden = !track;
    if (track) $('#practiceTrack').textContent = `Open “${track.title}” in Music`;
    updatePreviewText($('#previewTitle'), `${JOB_NAMES[path] || JOB_NAMES.act} ✦ ${NAMES[mission] || NAMES.cue}`);
    const sceneName = scene ? `Scene ${Number(scene.scene)}: ${scene.title}. ` :
      sceneLoading ? 'Loading scenes. ' : 'Pick a current scene in Scripts. ';
    const firstLine = path === 'act' && lineStart ? `Your ${role} line starts “${lineStart}”. ` : '';
    updatePreviewText($('#previewPrompt'), sceneName + firstLine + PATHS[path][mission || 'cue'][3]);
    if (scene && path === 'act') void findScriptRole(scene);
  }
  async function loadScenes() {
    try {
      const response = await fetch('content.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('No scene list');
      const content = await response.json();
      publishedScenes = (content.scripts?.items || []).filter(item =>
        item.approved && item.companyPublish && /^scene-\d{2}\.html$/.test(item.readUrl) &&
        /^\d{2}$/.test(item.scene)).map(item =>
          ({ scene: item.scene, title: item.title, readUrl: item.readUrl }));
      publishedTracks = (content.music?.items || []).filter(item =>
        item.approved && item.companyPublish && Array.isArray(item.scenes) && typeof item.title === 'string')
        .map(item => ({ title: item.title, scenes: item.scenes }));
    } catch (_) { /* A generic task remains available when the feed is offline. */ }
    sceneLoading = false;
    renderDailyTask();
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
    mission = 'cue';
    $('#gameBoard').hidden = true;
    $('#coachStatus').textContent = '';
    const data = player();
    update({ preferredPath: next, preferredMission: mission, paths: data.paths || {} });
  }
  function renderCraftHistory() {
    const entries = (Array.isArray(player().plays) ? player().plays : [])
      .filter(entry => entry && entry.path === path && !Number.isNaN(Date.parse(entry.at)))
      .slice(-5).reverse();
    const details = $('#craftHistory');
    details.hidden = !entries.length;
    const list = $('#craftHistoryList');
    list.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement('li');
      const scene = /^\d{2}$/.test(String(entry.scene || '')) ? `Scene ${Number(entry.scene)} · ` : '';
      const mode = CRAFT_LEVELS[entry.level] || 'Practice try';
      const feeling = CRAFT_FEELINGS[entry.feeling];
      const note = typeof entry.note === 'string' ? entry.note.replace(/\s+/g, ' ').trim().slice(0, 280) : '';
      item.textContent = `${dayKey(entry.at)} · ${scene}${NAMES[entry.mission] || 'Game'} · ${mode}${feeling ? ' · ' + feeling : ''}${note ? ' · Note: ' + note : ''}`;
      list.append(item);
    }
  }
  function renderCraftStep() {
    const step = CRAFT_STEPS[path]?.[mission];
    $('#craftTitle').textContent = step?.title || 'Try your part';
    $('#craftStep').textContent = step?.steps[craftLevel - 1] || PATHS[path][mission][3];
  }
  function render() {
    $('#startQuest').firstChild.textContent = `Play ${NAMES[mission] || NAMES.cue} `;
    for (const button of document.querySelectorAll('[data-path]')) button.setAttribute('aria-pressed', String(button.dataset.path === path));
    for (const button of document.querySelectorAll('[data-mission]')) button.setAttribute('aria-pressed', String(button.dataset.mission === mission));
    const count = Object.keys(NAMES).filter(name => playsFor(name) > 0).length;
    for (const name of Object.keys(NAMES)) $('[data-mark="' + name + '"]').textContent = playsFor(name) ? '◆' : '◇';
    $('#missionProgress').textContent = `${count} of 3 games played for this job. ${count === 3 ? 'You played all three! Try a new twist.' : 'Gold marks show your plays. No score here!'}`;
    renderProgress();
    renderDailyTask();
    renderHistory();
    renderCraftHistory();
  }
  function start(name) {
    mission = name;
    update({ preferredMission: name });
    round = 0;
    variation = playsFor(name) % 2;
    craftLevel = 1;
    lastSessionAt = '';
    document.querySelectorAll('input[name="craftLevel"]').forEach(input => { input.checked = input.value === '1'; });
    $('#postQuestReflection').hidden = true;
    $('#postQuestNote').value = '';
    $('#progressRing').classList.remove('successPulse');
    $('#streakWidget').classList.remove('successPulse');
    $('#gameResult').classList.remove('successPulse');
    $('#gameBoard').hidden = false;
    $('#gameTitle').textContent = NAMES[name];
    const scene = scenesForPerson().find(item => item.scene === chosenScene);
    $('#gameSetup').textContent = (sceneMoment(scene) ? `Story: ${sceneMoment(scene)} ` : '') +
      'Two quick picks. Miss one? Try again.';
    $('#gameResult').textContent = '';
    $('#replayMission').hidden = true;
    $('#nextMission').hidden = true;
    $('#realMove').hidden = true;
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
    $('#realMove').classList.remove('moveReveal');
    $('#lessonCard').hidden = true;
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
            'That may make it harder for the next person.') + ' Try again.';
          $('#answerFeedback').className = 'answerFeedback isWrong';
          playMotion($('#answerFeedback'), 'feedbackPop');
          button.disabled = true;
          button.classList.add('answerWrong');
          return;
        }
        $('#answerFeedback').textContent = (round === 0 ? 'Good pick! ' : 'You got it! ') +
          challenge[3].replace(/^Yes\.\s*/, '');
        $('#answerFeedback').className = 'answerFeedback isRight';
        playMotion($('#answerFeedback'), 'feedbackPop');
        for (const answer of answers.querySelectorAll('button')) answer.disabled = true;
        button.classList.add('answerRight');
        if (round === 0) {
          $('#nextRound').hidden = false;
          $('#nextRound').focus();
        }
        else {
          $('#realMove').hidden = false;
          playMotion($('#realMove'), 'moveReveal');
          $('#roundTwo').textContent = $('#sceneTask').textContent;
          renderCraftStep();
          const lesson = path === 'act' ? ACT_LESSONS[mission][variation] : null;
          $('#lessonCard').hidden = !lesson;
          if (lesson) {
            $('#lessonTitle').textContent = lesson.title;
            $('#lessonPrompt').textContent = lesson.step;
            $('#lessonVideo').href = lesson.video;
          }
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
    if (!checks.length) { box.textContent = 'No tips yet. That is okay. You can still play.'; return; }
    const latest = [...checks].sort((a,b) => b.date.localeCompare(a.date));
    const next = document.createElement('p');
    next.className = 'nextMove';
    next.textContent = `Try next: ${NEXT[latest[0].next] || 'Ask your coach'}.`;
    box.append(next);
    const list = document.createElement('ol');
    list.className = 'growthList';
    for (const check of latest.slice(0, 12)) {
      const item = document.createElement('li');
      item.textContent = `${check.date} · ${NAMES[check.skill] || 'Game'} · ${check.level === 'seen' ? 'I saw it today' : 'Still working'} · Next: ${NEXT[check.next] || 'Ask your coach'}`;
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

  $('#sceneChoice').addEventListener('change', event => {
    chosenScene = event.target.value;
    $('#gameBoard').hidden = true;
    update({ preferredScene: chosenScene });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  document.querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => pathChoice(button.dataset.path)));
  document.querySelectorAll('[data-mission]').forEach(button => button.addEventListener('click', () => {
    mission = button.dataset.mission;
    $('#gameBoard').hidden = true;
    update({ preferredMission: mission });
  }));
  $('#startQuest').addEventListener('click', async () => { await ready; start(mission || 'cue'); });
  $('#nextRound').addEventListener('click', () => { round = 1; showRound(); });
  document.querySelectorAll('input[name="craftLevel"]').forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    craftLevel = Number(input.value);
    renderCraftStep();
  }));
  $('#finishMission').addEventListener('click', () => {
    if (!mission || round !== 1 || $('#realMove').hidden) return;
    const chosen = { cue: 'notice', clear: 'clear', pass: 'together' }[mission];
    const data = player();
    const paths = { ...(data.paths || {}) };
    paths[path] = { ...(paths[path] || {}), [mission]: playsFor(mission) + 1 };
    const at = new Date().toISOString();
    const isNewDay = !practiceDays(data).includes(dayKey(at));
    update({ paths, ...recordedPractice(data, { at, path, mission,
      scene: chosenScene || null, level: craftLevel }), nextMove: chosen });
    lastSessionAt = at;
    $('#gameResult').textContent = 'You did it! ' +
      (isNewDay ? 'Today counts as one practice day. ' : 'You played again today. Your new game is saved too. ') +
      'Next time: ' + NEXT[chosen] + '.';
    playMotion($('#gameResult'), 'successPulse');
    if (isNewDay) {
      playMotion($('#progressRing'), 'successPulse');
      playMotion($('#streakWidget'), 'successPulse');
    }
    $('#postQuestNote').value = '';
    $('#postQuestReflection').hidden = false;
    $('#postQuestReflection').classList.remove('reveal');
    void $('#postQuestReflection').offsetWidth;
    $('#postQuestReflection').classList.add('reveal');
    $('#realMove').hidden = true;
    $('#answerChoices').replaceChildren();
    $('#gameTitle').textContent = NAMES[mission] + ' complete!';
    $('#gameBoard').classList.add('completed');
    $('#replayMission').hidden = false;
    $('#replayMission').textContent = 'Play again with a new twist';
    $('#nextMission').hidden = false;
    celebrate();
  });
  function closePostQuestReflection() {
    $('#postQuestReflection').hidden = true;
    $('#postQuestNote').value = '';
    lastSessionAt = '';
    $('#replayMission').focus();
  }
  $('#skipPostQuest').addEventListener('click', closePostQuestReflection);
  $('#savePostQuest').addEventListener('click', () => {
    const note = $('#postQuestNote').value.trim().slice(0, 280);
    if (note && lastSessionAt) {
      const data = player();
      const plays = Array.isArray(data.plays) ? [...data.plays] : [];
      const index = plays.findIndex(entry => entry?.at === lastSessionAt && entry.path === path && entry.mission === mission);
      if (index >= 0) {
        plays[index] = { ...plays[index], note };
        update({ plays });
        $('#gameResult').textContent += storageWorks
          ? ' Note saved on this device.' : ' Note saved for now. It may go away when you close this page.';
      }
    }
    closePostQuestReflection();
  });
  $('#replayMission').addEventListener('click', () => start(mission));
  $('#nextMission').addEventListener('click', () => {
    const order = Object.keys(NAMES);
    start(order[(order.indexOf(mission) + 1) % order.length]);
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
    $('#coachStatus').textContent = storageWorks
      ? 'Tip saved here. You can play again any time.'
      : 'Tip saved for now. It may go away when you close this page.';
    form.querySelectorAll('input[name="coachLevel"]').forEach(input => { input.checked = false; });
    $('#coachNext').value = '';
  });
  $('#clearQuest').addEventListener('click', () => {
    if (!window.confirm('Erase this person’s Show Quest play and tips on this device? Old acting notes will stay.')) return;
    const all = read(); delete all[personId]; save(all);
    path = 'act'; mission = null; chosenScene = ''; $('#gameBoard').hidden = true;
    $('#coachStatus').textContent = 'Show Quest play and tips were erased for this person.';
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
    currentPerson = person;
    $('#questPerson').textContent = person ? `${person.name}, pick any job you want.` : 'Playing as a guest. Pick any job.';
    const link = document.createElement('a');
    link.href = 'company.html#my-role'; link.textContent = person ? 'Change person' : 'Choose my name';
    $('#questPerson').append(' ', link);
    const savedPath = player().preferredPath;
    const suggested = person?.danceEnsemble ? 'dance' : /singer|choir|vocal/i.test(person?.roles || '') ? 'sing' :
      /production|tech|wardrobe|props|crew/i.test(`${person?.companyType || ''} ${person?.roles || ''}`) ? 'crew' : 'act';
    path = PATHS[savedPath] ? savedPath : suggested;
    chosenScene = player().preferredScene || '';
    mission = NAMES[player().preferredMission] ? player().preferredMission : 'cue';
    render(); showOldChecks();
    void loadScenes();
  }
  const ready = init();
})();
