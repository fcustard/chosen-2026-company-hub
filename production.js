document.addEventListener('DOMContentLoaded', () => {
  const search = document.querySelector('#fittingSearch');
  const cards = [...document.querySelectorAll('.fittingCard')];
  const count = document.querySelector('#fittingCount');
  function filterFittings() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      card.hidden = !card.dataset.performer.toLocaleLowerCase().includes(query);
      if (!card.hidden) visible++;
    }
    count.textContent = `${visible} of ${cards.length} performers shown`;
  }
  search.addEventListener('input', filterFittings);
  document.querySelector('#clearFittingSearch').addEventListener('click', () => { search.value = ''; filterFittings(); search.focus(); });
  const month = document.querySelector('#wardrobeMonth');
  const sessions = [...document.querySelectorAll('.wardrobeSession')];
  month.addEventListener('change', () => {
    let visible = 0;
    for (const session of sessions) {
      session.hidden = !!month.value && session.dataset.month !== month.value;
      if (!session.hidden) visible++;
    }
    document.querySelector('#wardrobeCount').textContent = `${visible} planning windows shown`;
  });
});
