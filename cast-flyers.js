(() => {
  const input = document.getElementById('flyer-search');
  const cards = [...document.querySelectorAll('.flyer-card')];
  const count = document.getElementById('flyer-count');
  const empty = document.getElementById('flyer-empty');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  input.addEventListener('input', () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let found = 0;
    for (const card of cards) {
      const name = normalize(card.dataset.name);
      card.hidden = !terms.every(term => name.includes(term));
      if (!card.hidden) found++;
    }
    count.textContent = `${found} ${found === 1 ? 'performer' : 'performers'}`;
    empty.hidden = found !== 0;
  });
})();
