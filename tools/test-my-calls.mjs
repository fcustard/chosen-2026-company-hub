
#!/usr/bin/env node
import fs from 'node:fs';

const rehearsals=JSON.parse(fs.readFileSync('data/rehearsals.json','utf8'));
const company=JSON.parse(fs.readFileSync('data/company.json','utf8'));
const name=process.argv.slice(2).join(' ').trim();
if(!name){console.log('Usage: node tools/test-my-calls.mjs "Fredrick Custard"');process.exit(0);}
const person=company.people.find(p=>String(p.name||'').toLowerCase()===name.toLowerCase());
if(!person) throw new Error(`Person not found: ${name}`);

function matches(p,r){
  if(String(r.exactCallStatus||'').trim().toUpperCase()!=='READY') return false;
  const ids=Array.isArray(r.calledPeopleIds)?r.calledPeopleIds:[];
  const groups=Array.isArray(r.calledGroups)?r.calledGroups:[];
  if(ids.includes(p.id)||groups.includes('Full Company')) return true;
  const pg=Array.isArray(p.groups)?p.groups:[];
  return pg.some(g=>groups.includes(g));
}
const calls=rehearsals.filter(r=>matches(person,r));
console.log(`\n${person.name} — ${calls.length} exact My Calls\n`);
for(const r of calls) console.log(`${r.start} | ${r.title} | ${r.id||r.eventKey}`);
