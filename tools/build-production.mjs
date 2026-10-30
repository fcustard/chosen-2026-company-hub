import fs from 'node:fs/promises';
import { renderProduction } from './render-production.mjs';
const root = new URL('../', import.meta.url);
const plan = JSON.parse(await fs.readFile(new URL('data/wardrobe.json', root), 'utf8'));
const company = JSON.parse(await fs.readFile(new URL('data/company.json', root), 'utf8'));
await fs.writeFile(new URL('production.html', root), renderProduction(plan, company));
console.log('Production page rebuilt with upcoming work, appointment status and historical records.');
