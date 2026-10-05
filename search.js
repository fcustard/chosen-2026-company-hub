const asList = value => Array.isArray(value) ? value : value?.current || value?.items || [];
const clean = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');
const stopWords = new Set('a am an are at can do find for how i in is me my of on please should show the to what when where which with'.split(' '));
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const aliases = { songs: 'music', song: 'music', tracks: 'music', track: 'music', audio: 'music', listen: 'music', lyrics: 'music', costumes: 'wardrobe', costume: 'wardrobe', clothing: 'wardrobe', outfit: 'wardrobe', fittings: 'wardrobe', fitting: 'wardrobe', rehearsals: 'rehearsal', scenes: 'scene', scripts: 'script' };

function localToday(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = key => parts.find(part => part.type === key).value;
  return new Date(Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day'))));
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

export function requestedDate(query, now = new Date()) {
  const q = clean(query);
  const today = localToday(now);
  const addDays = count => iso(new Date(today.getTime() + count * 86400000));
  if (/\btomorrow\b/.test(q)) return addDays(1);
  if (/\btoday\b/.test(q)) return addDays(0);
  const weekday = weekdays.find(day => new RegExp(`\\b${day}\\b`).test(q));
  if (weekday) {
    let delta = (weekdays.indexOf(weekday) - today.getUTCDay() + 7) % 7;
    if (/\bnext\b/.test(q)) delta += 7;
    return addDays(delta);
  }
  const named = q.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s+(20\d{2}))?\b/);
  const numeric = String(query).match(/\b(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(20\d{2}))?\b/);
  if (!named && !numeric) return null;
  const month = named ? months.findIndex(name => name.startsWith(named[1].slice(0, 3))) + 1 : Number(numeric[1]);
  const day = Number(named ? named[2] : numeric[2]);
  const explicitYear = named ? named[3] : numeric[3];
  let year = explicitYear ? Number(explicitYear) : today.getUTCFullYear();
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  if (!explicitYear && date < today) date = new Date(Date.UTC(++year, month - 1, day));
  return iso(date);
}

function normalizedTerms(query) {
  return clean(query).replace(/\bscene\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
    (_, word) => `scene ${numberWords.indexOf(word)}`)
    .split(' ').filter(word => word && !stopWords.has(word)).map(word => aliases[word] || word);
}

function intentUrls(query) {
  const q = clean(query);
  const urls = [];
  if (/\b(what time|when|am i|my call|call time|report time|release time|scheduled through)\b/.test(q) &&
      /\b(call|called|arrive|arrival|report|leave|there|needed|rehearsal|time|through)\b/.test(q)) {
    urls.push('company.html#my-role');
  }
  if (/\b(absent|absence|late|sick|miss|missing|cannot attend|cant attend|cannot come|cant come|can t come|wont make)\b/.test(q)) urls.push('absence');
  if (/\b(what.*wear|wardrobe|costume|clothing|outfit|fitting|dress code)\b/.test(q)) urls.push('production.html#wardrobe');
  if (/\b(my|which).*\b(scene|script)\b/.test(q)) urls.push('scripts.html');
  if (/\b(my|practice).*\blines?\b/.test(q)) urls.push('lines.html');
  if (/\b(where.*rehearsal|rehearsal location|what time.*rehearsal)\b/.test(q)) urls.push('schedule.html');
  return urls;
}

export function buildSearchIndex({ content = {}, scripts = [], music = [], resources = [] } = {}) {
  const entries = [
    { category: 'Help', title: 'Find my role & calls', description: 'Choose your name for your personal report and scheduled-through times.', url: 'company.html#my-role', terms: 'call time my calls cast role personal schedule when do i arrive' },
    { category: 'Help', title: 'This week', description: 'The next rehearsal and this week’s plan.', url: 'this-week.html', terms: 'week today next rehearsal' },
    { category: 'Help', title: 'My scene scripts', description: 'Choose your name to find your current scenes in order.', url: 'scripts.html', terms: 'my scenes scripts which scene am i in' },
    { category: 'Help', title: 'Practice my lines', description: 'Choose a role to practice cues and dialogue.', url: 'lines.html', terms: 'my lines dialogue cue practice speaking' },
    { category: 'Help', title: 'Full rehearsal schedule', description: 'Browse published dates, times, and locations.', url: 'schedule.html', terms: 'rehearsal when where location date time' },
    { category: 'Help', title: 'Report absence or lateness', description: 'Tell the company when you will be absent or late.', url: content.links?.absence || 'index.html#help', terms: 'absence absent late missing rehearsal sick cannot attend report' },
    { category: 'Help', title: 'Ask for help', description: 'Contact the company with a question.', url: content.links?.help || 'getting-started.html', terms: 'help question contact support' },
    { category: 'Help', title: 'Getting started', description: 'Quick answers and practice steps for the company.', url: 'getting-started.html', terms: 'faq new beginner how to start practice' },
    { category: 'Production', title: 'Wardrobe & fittings', description: 'Costumes, fittings, and wardrobe calendar.', url: 'production.html#wardrobe', terms: 'costume clothing wardrobe fitting rotation' },
    { category: 'Production', title: 'Wardrobe calendar', description: 'See the current wardrobe schedule.', url: 'production.html#wardrobe-calendar', terms: 'fitting date costume schedule' },
    { category: 'Production', title: 'Production departments', description: 'Behind-the-scenes assignments and teams.', url: 'production.html#departments', terms: 'crew tech production team department' },
    { category: 'Help', title: 'Company guide', description: 'Expectations and show procedures.', url: 'company-guide.html', terms: 'policies expectations safety procedures handbook' }
  ];
  for (const scene of asList(scripts)) {
    if (scene.approved !== true || scene.companyPublish !== true || !scene.readUrl) continue;
    entries.push({ category: 'Scripts', title: `Scene ${Number(scene.scene) || scene.scene}: ${scene.title}`, description: 'Read the current company script.', url: scene.readUrl, sceneNumber: Number(scene.scene), terms: `scene ${scene.scene} ${scene.name || ''} ${scene.title}` });
  }
  for (const track of asList(music)) {
    if (track.approved !== true || track.companyPublish !== true || !track.playUrl || track.playUrl === '#') continue;
    entries.push({ category: 'Music', title: track.title, description: `${track.type || 'Rehearsal track'} · Play in Music`, url: `music.html#track-${slug(track.title)}`, terms: `song track audio rehearsal music ${(track.scenes || []).map(n => `scene ${n}`).join(' ')}` });
  }
  const now = Date.now();
  for (const event of asList(content.schedule?.rehearsals)) {
    if (!event.title || !event.eventKey || !event.end || Date.parse(event.end) < now) continue;
    entries.push({ category: 'Schedule', title: event.title, description: [event.date || event.dateLabel, event.time].filter(Boolean).join(' · '), url: `schedule.html#call-${slug(event.eventKey)}`, dateIso: event.dateIso, terms: `${event.date || ''} ${event.dateIso || ''} ${event.day || ''} ${event.time || ''} ${event.title}` });
  }
  for (const resource of asList(resources)) {
    if (resource.approved !== true || resource.companyPublish !== true || !resource.fileUrl || resource.fileUrl === '#') continue;
    if (entries.some(entry => entry.url === resource.fileUrl)) continue;
    entries.push({ category: 'Resources', title: resource.title, description: resource.description || resource.category || '', url: resource.fileUrl, terms: resource.category || '' });
  }
  return entries;
}

export function searchIndex(entries, query, { now = new Date() } = {}) {
  const terms = normalizedTerms(query);
  if (!terms.length) return [];
  const date = requestedDate(query, now);
  const featured = intentUrls(query).flatMap(url => entries.filter(entry =>
    url === 'absence' ? entry.title === 'Report absence or lateness' : entry.url === url));
  const sceneMatch = normalizedTerms(query).join(' ').match(/\bscene\s+(\d{1,2})\b/);
  const sceneNumber = sceneMatch ? Number(sceneMatch[1]) : null;
  const exactScenes = sceneNumber === null || terms.includes('music') ? [] : entries.filter(entry => entry.category === 'Scripts' && entry.sceneNumber === sceneNumber);
  const exactDates = date ? entries.filter(entry => entry.category === 'Schedule' && entry.dateIso === date) : [];
  if (date) return [...new Map([...featured, ...exactDates].map(entry => [entry.url, entry])).values()];
  if (featured.length && /\?|\b(what|when|where|which|how|am i)\b/i.test(query) && sceneNumber === null) {
    return [...new Map(featured.map(entry => [entry.url, entry])).values()];
  }
  const matched = entries.map((entry, order) => {
    const title = clean(entry.title);
    const haystack = clean([entry.title, entry.description, entry.terms, entry.category].join(' '));
    if (/\d{1,2}:\d{2}/.test(query) && !clean([entry.title, entry.description].join(' ')).includes(terms.join(' '))) return null;
    if (!terms.every(term => haystack.includes(term))) return null;
    const phrase = terms.join(' ');
    const score = (title === phrase ? 10 : 0)
      + (entry.category === 'Schedule' && clean(entry.description).includes(phrase) ? 20 : 0)
      + terms.reduce((sum, term) => sum + (title.includes(term) ? 3 : 0), 0);
    return { entry, score, order };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order).map(hit => hit.entry);
  return [...new Map([...featured, ...exactScenes, ...matched].map(entry => [entry.url, entry])).values()];
}

async function init() {
  const input = document.querySelector('#hubSearch');
  const output = document.querySelector('#searchResults');
  const status = document.querySelector('#searchStatus');
  if (!input || !output || !status) return;
  const query = new URLSearchParams(location.search).get('q') || '';
  input.value = query;
  if (!query.trim()) { status.textContent = 'Search scenes, music, rehearsals, resources, and help.'; return; }
  status.textContent = 'Searching…';
  try {
    const paths = ['content.json', 'data/scripts.json', 'data/music.json', 'data/resources.json'];
    const data = await Promise.all(paths.map(async path => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    }));
    const hits = searchIndex(buildSearchIndex({ content: data[0], scripts: data[1], music: data[2], resources: data[3] }), query);
    status.textContent = hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${query}”` : `No direct results for “${query}”. Try fewer words or one of these places:`;
    const suggestions = hits.length ? hits : [
      { category: 'Try this', title: 'Find my role & calls', description: 'Personal report and release times.', url: 'company.html#my-role' },
      { category: 'Try this', title: 'Browse scripts', description: 'Current scenes in order.', url: 'scripts.html' },
      { category: 'Try this', title: 'Browse the schedule', description: 'Published rehearsal dates and times.', url: 'schedule.html' },
      { category: 'Help', title: 'Ask for help', description: 'Tell the company what you could not find.', url: data[0].links?.help || 'getting-started.html' }
    ];
    for (const hit of suggestions) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = hit.url;
      link.textContent = hit.title;
      const category = document.createElement('span');
      category.className = 'searchCategory';
      category.textContent = hit.category;
      const description = document.createElement('p');
      description.textContent = hit.description;
      item.append(category, link, description);
      output.append(item);
    }
  } catch (error) {
    console.error('Hub search could not load.', error);
    status.textContent = 'Search is temporarily unavailable. Use the menu to open the page you need.';
  }
}

if (typeof document !== 'undefined') init();
