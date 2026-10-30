const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function tracksForScene(tracks, scene) {
  return (Array.isArray(tracks) ? tracks : []).filter(track => track.approved === true &&
    track.companyPublish === true && track.playUrl && track.playUrl !== '#' &&
    (track.scenes || []).some(number => Number(number) === Number(scene)));
}
async function init() {
  const scene = location.pathname.match(/scene-(\d{2})\.html$/)?.[1];
  const script = document.querySelector('#script');
  if (!scene || !script) return;
  const section = document.createElement('section');
  section.className = 'sceneNext';
  section.setAttribute('aria-label', 'Prepare this scene');
  let tracks = [];
  try {
    const response = await fetch('data/music.json', {cache:'no-store'});
    if (response.ok) tracks = tracksForScene(await response.json(), scene);
  } catch (_) { /* Scripts and line practice remain available without music data. */ }
  section.innerHTML = `<h2>Prepare this scene</h2><p>Take the next step with the material assigned by your rehearsal leader.</p><div class="actions"><a class="btn primary" href="lines.html?scene=${scene}">Practice spoken cues</a><a class="btn" href="index.html#homePreparation">Return to my rehearsal plan</a></div>${tracks.length ? `<p><strong>Published tracks for Scene ${Number(scene)}</strong></p><div class="actions">${tracks.map(track => `<a class="btn" href="music.html#track-${esc(String(track.title || track.name || '').replace(/[^a-zA-Z0-9_-]/g, '-'))}">${esc(track.title || track.name)}</a>`).join('')}</div>` : ''}`;
  script.after(section);
}
if (typeof document !== 'undefined') void init();
