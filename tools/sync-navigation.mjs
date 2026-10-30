import fs from 'node:fs/promises';
import { primaryNavigation } from './navigation.mjs';
const root = new URL('../', import.meta.url);
const files = (await fs.readdir(root)).filter(name => name.endsWith('.html') && !/^scene-\d+\.html$/.test(name));
for (const name of files) {
  const file = new URL(name, root);
  const old = await fs.readFile(file, 'utf8');
  if (!/<nav id="nav" aria-label="Primary">/.test(old)) continue;
  let html = old.replace(/<nav id="nav" aria-label="Primary">[\s\S]*?<\/nav>/, primaryNavigation(name));
  if (!html.includes('site-flow.css')) html = html.replace('</head>', '  <link rel="stylesheet" href="site-flow.css?v=20261030-flow1">\n</head>');
  // Asset versions belong to their entry pages; navigation builds must preserve them.
  if (html !== old) await fs.writeFile(file, html);
}
console.log('Primary navigation and shared layout are consistent across Hub pages.');
