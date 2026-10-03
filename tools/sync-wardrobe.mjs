import fs from 'node:fs/promises';
import { EXPORT_URL, parseCsv, parseWardrobe, validateFittings } from './wardrobe-feed.mjs';

const response = await fetch(EXPORT_URL, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Wardrobe export returned ${response.status}.`);
const csv = await response.text();
if (!response.headers.get('content-type')?.includes('csv')) throw new Error('Wardrobe export is not CSV.');
const plan = parseWardrobe(parseCsv(csv));
const company = JSON.parse(await fs.readFile('data/company.json', 'utf8'));
const rehearsals = JSON.parse(await fs.readFile('data/rehearsals.json', 'utf8'));
validateFittings(plan, company, rehearsals);
const destination = 'data/wardrobe.json';
let existing = null;
try { existing = JSON.parse(await fs.readFile(destination, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const { syncedAt: _oldTime, ...oldContent } = existing || {};
if (JSON.stringify(plan) !== JSON.stringify(oldContent)) {
  await fs.writeFile(destination, `${JSON.stringify({ ...plan, syncedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`Wardrobe refreshed: ${plan.schedule.length} planning windows, ${plan.fittings.filter(f => !f.buffer).length} fitting rotations.`);
} else console.log('Wardrobe source unchanged.');
