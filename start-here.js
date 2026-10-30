// Native disclosures remain usable without JavaScript. Hash links also reveal
// their section so saved actor/singer/dancer links continue to work.
(() => {
  function revealLinkedSection() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const target = id && document.getElementById(id);
    if (!target) return;
    const details = target.tagName === 'DETAILS' ? target : target.closest('details');
    if (details) details.open = true;
  }
  window.addEventListener('hashchange', revealLinkedSection);
  // Reopening the same fragment after a disclosure was closed does not fire
  // hashchange; honor that ordinary in-page link too.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link && link.hash === location.hash) revealLinkedSection();
  });
  revealLinkedSection();
})();
