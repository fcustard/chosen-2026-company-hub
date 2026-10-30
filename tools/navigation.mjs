const primary = [
  ['schedule.html', 'My Calls'], ['scripts.html', 'Scripts'], ['music.html', 'Music'],
  ['practice.html', 'Practice'], ['this-week.html', 'This Week'], ['search.html', 'Search']
];
const more = [
  ['lines.html', 'Lines'], ['schedule.html?view=all', 'Full Schedule'],
  ['resources.html', 'Resources'], ['company.html', 'Company'],
  ['production.html', 'Production'], ['getting-started.html', 'Start Here']
];
export function primaryNavigation(current = '') {
  const links = items => items.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  const isMore = more.some(([href]) => href === current);
  return `<nav id="nav" aria-label="Primary">${links(primary)}<details class="navMore"><summary${isMore ? ' class="navMoreCurrent"' : ''}>More</summary><div class="navMoreMenu">${links(more)}</div></details></nav>`;
}
