import fs from 'node:fs/promises';

const plan = JSON.parse(await fs.readFile('data/wardrobe.json', 'utf8'));
const company = JSON.parse(await fs.readFile('data/company.json', 'utf8'));
const esc = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = value => esc(String(value || '').replace(/at A67:H89/g, 'below'));
const dateLabel = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' }).format(new Date());
const sessions = plan.schedule.filter(s => s.date >= today);
const fittings = plan.fittings.filter(f => !f.buffer);
const dates = [...new Set(fittings.map(f => f.date))];
const allApproved = fittings.every(f => /^APPROVED\b/.test(f.status));
const departments = [
  { title: 'Wardrobe', match: /wardrobe|costume/i, description: 'Costume assembly, fittings, alterations and show preparation.' },
  { title: 'Props', match: /props/i, description: 'Assigned props and backstage prop support.' },
  { title: 'Media', match: /media|picture|video|film/i, description: 'Photography, filming and editing.' },
  { title: 'Set Design / Scenic', match: /\bsets?\b|scenic/i, description: 'Set building and scenic work.' },
  { title: 'Stagehands / Tech', match: /stage\s*hand|stagehands|stage crew|sound|lighting/i, description: 'Backstage support, sound, lighting, setup and cleanup.' },
  { title: 'Administration', match: /administration|floater/i, description: 'Production administration and flexible support.' },
];
const crew = company.people.filter(p => p.companyType === 'Production' && p.reviewStatus === 'READY');
const monthOptions = [...new Set(sessions.map(s => s.date.slice(0, 7)))].map(month => `<option value="${month}">${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))}</option>`).join('');
const nav = [['this-week.html','This Week'],['scripts.html','Scripts'],['lines.html','Lines'],['music.html','Music'],['schedule.html','Schedule'],['resources.html','Resources'],['company.html','Company'],['production.html','Production']].map(([href,label]) => `<a href="${href}"${href === 'production.html' ? ' aria-current="page"' : ''}>${label}</a>`).join('');
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d1726">
<title>Production Team | CHOSEN 2026</title>
<link rel="stylesheet" href="styles.css?v=20261002-production"><link rel="stylesheet" href="production.css?v=20261002">
<script defer src="app.js?v=20260928-connected-tasks"></script><script defer src="production.js?v=20261002"></script>
</head><body data-page="production">
<header class="sitebar"><div class="inner"><a class="brand" href="index.html"><small>THE FAITH CENTER PRESENTS</small><b>CHOSEN 2026</b><span>Company Hub</span></a>
<button id="menuBtn" class="menu" type="button" aria-controls="nav" aria-expanded="false">Menu</button><nav id="nav" aria-label="Primary">${nav}</nav></div></header>
<main>
<section class="sub productionIntro"><p class="ey">BEHIND THE SCENES</p><h1>Production Team</h1><p>Wardrobe, props, media, scenic, backstage and administration: find your team and the current production plan.</p>
<nav class="productionJump" aria-label="On this page"><a href="#wardrobe">Wardrobe</a><a href="#fittings">Fitting rotations</a><a href="#wardrobe-calendar">Calendar</a><a href="#departments">Departments</a></nav></section>
<section id="wardrobe" class="productionSection"><p class="ey">WARDROBE CATCH-UP</p><h2>Finish the looks. Start the fittings.</h2>
<div class="productionPanel"><h3>Current wardrobe update</h3><p>${text(plan.summary)}</p></div>
<div class="productionFacts"><div class="productionFact"><b>Classrooms</b><span>Fitting location confirmed</span></div><div class="productionFact"><b>Up to two stations</b><span>Station staffing remains pending</span></div><div class="productionFact"><b>5–10 minutes</b><span>10-minute slots; up to 12 performers/hour</span></div></div>
<div class="productionPanel"><h3>Prepare each complete look</h3><p>Finish costume assembly, label each performer’s look, and stage shoes, accessories and fitting forms. Record front/back photos, costume number, footwear, accessories and exact alteration notes after each fitting.</p><p>Use confirmed rehearsal hours. Wardrobe work remains Wednesday, Thursday or Saturday. Children and dancers receive comfort and movement checks.</p></div>
<div class="productionNotice"><strong>Before fittings begin</strong>Assign a fitter to each classroom station and check the final cast list. Return each performer promptly to rehearsal. If one station is staffed, capacity is six performers/hour; carry unfinished fittings to the next date the performer is called.</div>
<p class="productionSource">Wardrobe calendar checked ${esc(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(new Date(plan.syncedAt)))} Eastern. <a href="${esc(plan.sourceUrl)}" target="_blank" rel="noopener">Open the wardrobe calendar ↗</a></p></section>
<section id="fittings" class="productionSection"><p class="ey">${allApproved ? 'ROTATIONS APPROVED' : 'CHECK EACH ROTATION’S STATUS'}</p><h2>Fitting rotations</h2><p>${dates.map(dateLabel).map(esc).join(' · ')} · ${fittings.length} performers · Classrooms</p>
<div class="productionNotice"><strong>${allApproved ? 'Rotations approved; staffing pending' : 'Follow each performer’s published fitting status'}</strong>${text(plan.fittingPolicy)}</div>
<div class="productionFilter"><label for="fittingSearch">Find your fitting</label><input id="fittingSearch" type="search" placeholder="Type a performer’s name" autocomplete="off"><button class="btn" id="clearFittingSearch" type="button">Clear</button></div>
<p id="fittingCount" role="status" aria-live="polite">${fittings.length} of ${fittings.length} performers shown</p>
<div class="fittingGrid">${fittings.map(f => `<article class="fittingCard" data-performer="${esc(f.performer)}"><div class="fittingMeta"><span>${esc(f.time)}</span><span>Station ${esc(f.station)}</span></div><h3>${esc(f.performer)}</h3><p>${esc(dateLabel(f.date))} · ${esc(f.focus)}</p><span class="productionTag">${esc(f.status)}</span><details><summary>Call and fitting notes</summary><p>${esc(f.alignment)}</p><p>${esc(f.notes)}</p></details></article>`).join('\n')}</div>
${plan.fittings.filter(f => f.buffer).map(f => `<p class="productionSource"><strong>${esc(f.time)} — ${esc(f.performer)}</strong> · ${esc(f.notes)}</p>`).join('')}
<p><a href="schedule.html">Check My Calls</a> for your rehearsal report and scheduled-through times.</p></section>
<section class="productionSection"><p class="ey">WARDROBE TARGETS</p><h2>Milestones</h2><div class="milestoneGrid">${plan.milestones.map(m => `<article class="milestoneCard"><span class="wardrobeDate">${esc(dateLabel(m.date))}</span><h3>${esc(m.title)}</h3><p>${esc(m.purpose)}</p></article>`).join('')}</div></section>
<section id="wardrobe-calendar" class="productionSection"><p class="ey">DEPARTMENT PLANNING</p><h2>Wardrobe calendar</h2><p>These are department planning windows. Individual fitting appointments are listed above; other performer fittings require a released rehearsal rotation. Holds and access reviews remain visible.</p>
<div class="productionFilter"><label for="wardrobeMonth">Month</label><select id="wardrobeMonth"><option value="">All upcoming months</option>${monthOptions}</select></div><p id="wardrobeCount" role="status" aria-live="polite">${sessions.length} planning windows shown</p>
<div class="wardrobeList">${sessions.map(s => { const status = /NO CALL|THANKSGIVING/.test(s.time+' '+s.phase) ? 'No call' : /HOLD|NOT SCHEDULED/.test(s.phase+' '+s.time) ? 'On hold' : /REVIEW|pending|TBD|verify/i.test(s.phase+' '+s.time) ? 'Review required' : /APPROVED ROTATIONS/.test(s.phase) ? 'Rotations approved' : 'Planning window'; return `<details class="wardrobeSession" data-month="${s.date.slice(0,7)}"><summary><div><span class="wardrobeDate">${esc(dateLabel(s.date))} · ${esc(s.day)}</span><h3>${esc(s.phase)}</h3></div><span class="productionTag">${status}</span></summary><p class="sessionTime">${esc(s.time)}</p><p class="sessionGroup">${esc(s.group)}</p><p>${text(s.task)}</p><p><strong>Rehearsal alignment:</strong> ${text(s.alignment)}</p><p><strong>Goal:</strong> ${text(s.goal)}</p></details>`; }).join('\n')}</div></section>
<section id="departments" class="productionSection"><p class="ey">YOUR PRODUCTION TEAM</p><h2>Departments and assignments</h2><p>Current roster assignments. Classroom station staffing is assigned separately.</p><div class="departmentGrid">${departments.map(dept => { const people = crew.filter(p => dept.match.test([...(p.departments || []),p.primaryAssignment].join(' '))); return `<article class="departmentCard"><h3>${dept.title}</h3><p>${dept.description}</p><ul>${people.map(p=>`<li><strong>${esc(p.name)}</strong><span>${esc(p.primaryAssignment)}</span></li>`).join('') || '<li>Assignments to be added.</li>'}</ul></article>`; }).join('')}</div><p class="productionSource">Assignments follow the company roster. For department questions, <a href="company.html#help">contact production</a>.</p></section>
</main><footer><b>CHOSEN 2026</b><span>Broadway Church Production &amp; Dance System™</span></footer></body></html>
`;
await fs.writeFile('production.html', html);
console.log(`Production Team page built: ${crew.length} crew members, ${fittings.length} fitting rotations, ${sessions.length} upcoming planning windows.`);
