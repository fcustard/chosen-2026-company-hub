import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { easternDay, productionView, planningStatus } from './production-view.mjs';
import { renderProduction } from './render-production.mjs';
import { primaryNavigation } from './navigation.mjs';
import { callPublicationStatus, personMatchesCall, personalCallSummary } from '../personal-calls.js';
import { relevantUpdates } from '../home-dashboard.js';
import { tracksForScene } from '../scene-actions.js';

const now = new Date('2026-10-30T16:00:00Z');
const plan = {
  summary:'STATUS — OCTOBER 2, 2026: Previous source note.', syncedAt:'2026-10-02T21:10:00Z',
  sourceUrl:'https://example.org/source', fittingPolicy:'October 8 historical rotation policy',
  schedule:[
    {date:'2026-10-29',day:'Thu',phase:'Past work'},
    {date:'2026-10-31',day:'Sat',phase:'Current planning',time:'10:00 AM–2:00 PM',task:'Stage ready racks.',alignment:'Use released rotations.'},
    {date:'2026-11-04',day:'Wed',phase:'Refit',time:'Call list pending',task:'Check ready corrections.'},
    {date:'2026-11-18',day:'Wed',phase:'HOLD',time:'Location unconfirmed'},
    {date:'2026-11-25',day:'Wed',phase:'THANKSGIVING BREAK',time:'NO CALL'}
  ],
  fittings:[{date:'2026-10-08',time:'6:30 PM',performer:'Historical performer',status:'APPROVED',station:'1'},
    {date:'2026-10-08',time:'8:20 PM',performer:'Buffer',buffer:true}],
  milestones:[{date:'2026-10-03',title:'Past target'},{date:'2026-10-31',title:'Next target'}]
};

test('production uses Eastern dates at the UTC day boundary', () => {
  assert.equal(easternDay(new Date('2026-11-01T03:59:00Z')), '2026-10-31');
  assert.equal(easternDay(new Date('2026-11-01T04:01:00Z')), '2026-11-01');
});

test('past fittings and milestones stay out of upcoming work without becoming completed', () => {
  const view = productionView(plan,now);
  assert.equal(view.upcomingFittings.length,0);
  assert.equal(view.pastFittings.length,1);
  assert.deepEqual(view.thisWeek.map(row=>row.date),['2026-10-31','2026-11-04']);
  assert.deepEqual(view.upcomingMilestones.map(row=>row.title),['Next target']);
  assert.equal(view.noteDate,'2026-10-02');
  assert.equal(view.noteNeedsReview,true);
  assert.equal(plan.fittings[0].status,'APPROVED');
});

test('a recent rebuild cannot make an old source note current', () => {
  const changedSnapshot = {...plan,syncedAt:now.toISOString()};
  assert.equal(productionView(changedSnapshot,now).noteNeedsReview,true);
  assert.equal(productionView({...plan,summary:'STATUS — OCTOBER 29, 2026: Dated source update.'},now).noteNeedsReview,false);
  assert.equal(productionView({...plan,summary:'Undated note'},now).noteNeedsReview,true);
});

test('planning holds and breaks are not fitting invitations', () => {
  assert.equal(planningStatus(plan.schedule[2]),'Review required');
  assert.equal(planningStatus(plan.schedule[3]),'On hold');
  assert.equal(planningStatus(plan.schedule[4]),'No call');
  assert.equal(planningStatus(plan.schedule[1]),'Planning window');
});

test('production archive preserves dated records separately from named appointments', () => {
  const html=renderProduction(plan,{people:[]},now);
  const current=html.slice(html.indexOf('id="currentFittings"'),html.indexOf('UPCOMING TARGETS'));
  assert.match(current,/No upcoming named fitting appointments/);
  assert.doesNotMatch(current,/Historical performer|October 8 historical/);
  const archive=html.slice(html.indexOf('id="production-archive"'));
  assert.match(archive,/Historical performer/);
  assert.match(archive,/do not confirm completion/);
  assert.match(html,/Source snapshot last changed/);
  assert.doesNotMatch(html,/calendar checked/);
});

test('a newly published future fitting appears as an appointment', () => {
  const future={...plan,fittings:[...plan.fittings,{date:'2026-11-01',time:'11:00 AM',performer:'Future performer',station:'1',status:'PENDING'}]};
  const html=renderProduction(future,{people:[]},now);
  assert.match(html.slice(html.indexOf('id="currentFittings"'),html.indexOf('UPCOMING TARGETS')),/Future performer/);
});

test('event confirmation does not confirm unpublished personal assignments or invent times', () => {
  const call={status:'CONFIRMED',exactCallStatus:'REVIEW',calledPeopleIds:['P-a']};
  assert.deepEqual(callPublicationStatus(call),{eventLabel:'Event confirmed',personalLabel:'Personal assignments under review',pending:true});
  assert.equal(personMatchesCall({id:'a'},call),false);
  assert.equal(callPublicationStatus({...call,status:'PENDING'}).eventLabel,'Event awaiting confirmation');
  const ready={...call,exactCallStatus:'READY'};
  assert.equal(callPublicationStatus(ready).personalLabel,'Personal assignments published');
  assert.equal(personalCallSummary({id:'a'},ready).report,'');
});

test('updates are published, unexpired, scene-relevant and date ordered', () => {
  const base={published:true,publishedAt:'2026-10-29T20:50:00Z',expiresAt:'2026-11-13T05:00:00Z',scenes:[8]};
  const items=[{...base,id:'scene8'},{...base,id:'draft',published:false},{...base,id:'expired',expiresAt:'2026-10-29T00:00:00Z'},{...base,id:'future',publishedAt:'2026-11-01T00:00:00Z'},{...base,id:'scene3',scenes:[3]}];
  assert.deepEqual(relevantUpdates(items,{scenes:[8]},now).map(item=>item.id),['scene8']);
  assert.deepEqual(relevantUpdates(items,null,now),[]);
});

test('scene actions only link approved published tracks for that scene', () => {
  const tracks=[{title:'Current',approved:true,companyPublish:true,playUrl:'audio.mp3',scenes:[8]},
    {title:'Draft',approved:false,companyPublish:false,playUrl:'draft.mp3',scenes:[8]},
    {title:'Other scene',approved:true,companyPublish:true,playUrl:'other.mp3',scenes:[3]}];
  assert.deepEqual(tracksForScene(tracks,'08').map(item=>item.title),['Current']);
});

test('every full-navigation page uses the same My Calls-first menu', () => {
  assert.match(primaryNavigation('production.html'),/^<nav[^>]+><a href="schedule.html">My Calls/);
  assert.match(primaryNavigation('production.html'),/href="production.html" aria-current="page"/);
  const root=new URL('../',import.meta.url);
  for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html')&&!/^scene-\d+\.html$/.test(name))){
    const html=fs.readFileSync(new URL(name,root),'utf8');
    const nav=html.match(/<nav id="nav" aria-label="Primary">[\s\S]*?<\/nav>/)?.[0];
    if(nav)assert.equal(nav,primaryNavigation(name),name);
  }
});

test('all scene readers include the onward preparation actions', () => {
  const root=new URL('../',import.meta.url);
  for(let scene=1;scene<=12;scene++){
    const html=fs.readFileSync(new URL(`scene-${String(scene).padStart(2,'0')}.html`,root),'utf8');
    assert.match(html,/scene-actions\.js/);
  }
  assert.match(fs.readFileSync(new URL('tools/build-scenes.mjs',root),'utf8'),/scene-actions\.js/);
});
