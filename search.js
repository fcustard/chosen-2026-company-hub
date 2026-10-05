const asList = value => Array.isArray(value) ? value : value?.current || value?.items || [];
const clean = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');

export function buildSearchIndex({ content = {}, scripts = [], music = [], resources = [] } = {}) {
  const entries = [
    { category: 'Help', title: 'Find my role & calls', description: 'Choose your name for your personal report and scheduled-through times.', url: 'company.html#my-role', terms: 'call time my calls cast role personal schedule when do i arrive' },
    { category: 'Help', title: 'This week', description: 'The next rehearsal and this week’s plan.', url: 'this-week.html', terms: 'week today next rehearsal' },
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
    entries.push({ category: 'Scripts', title: `Scene ${Number(scene.scene) || scene.scene}: ${scene.title}`, description: 'Read the current company script.', url: scene.readUrl, terms: `scene ${scene.scene} ${scene.name || ''} ${scene.title}` });
  }
  for (const track of asList(music)) {
    if (track.approved !== true || track.companyPublish !== true || !track.playUrl || track.playUrl === '#') continue;
    entries.push({ category: 'Music', title: track.title, description: `${track.type || 'Rehearsal track'} · Play in Music`, url: `music.html#track-${slug(track.title)}`, terms: `song track audio rehearsal music ${(track.scenes || []).map(n => `scene ${n}`).join(' ')}` });
  }
  const now = Date.now();
  for (const event of asList(content.schedule?.rehearsals)) {
    if (!event.title || !event.eventKey || !event.end || Date.parse(event.end) < now) continue;
    entries.push({ category: 'Schedule', title: event.title, description: [event.date || event.dateLabel, event.time].filter(Boolean).join(' · '), url: `schedule.html#call-${slug(event.eventKey)}`, terms: `${event.date || ''} ${event.dateIso || ''} ${event.day || ''} ${event.time || ''} ${event.title}` });
  }
  for (const resource of asList(resources)) {
    if (resource.approved !== true || resource.companyPublish !== true || !resource.fileUrl || resource.fileUrl === '#') continue;
    if (entries.some(entry => entry.url === resource.fileUrl)) continue;
    entries.push({ category: 'Resources', title: resource.title, description: resource.description || resource.category || '', url: resource.fileUrl, terms: resource.category || '' });
  }
  return entries;
}

export function searchIndex(entries, query) {
  const terms = clean(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  return entries.map((entry, order) => {
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
    status.textContent = hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${query}”` : `No results for “${query}”. Try a scene number, song title, date, or “wardrobe”.`;
    for (const hit of hits) {
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
