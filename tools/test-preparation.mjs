import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { preparationChecklist, createPreparationStore, preparationKey } from '../preparation-checklist.js';

const person={id:'actor',name:'Actor'};
const call={id:'oct31',title:'Scenes 3 & 8',status:'CONFIRMED',exactCallStatus:'READY',
  calledPeopleIds:['P-actor','P-other'],start:'2026-10-31T14:00:00Z',end:'2026-10-31T18:00:00Z',
  prep:'Bring your script.',location:'Stage'};
const prep={scripts:[{scene:'03',title:'Chosen',readUrl:'scene-03.html',contentHash:'revision-a',updated:'sync-a'}],
  music:[{id:'chosen',title:'Chosen',playUrl:'chosen-v1.mp3'}]};
const model=()=>preparationChecklist(person,call,prep);
function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};}

test('preparation persists across reloads without sharing between people or calls',()=>{
  const storage=memoryStorage(),store=createPreparationStore(storage),m=model();
  store.mark(m,'call',true);
  assert.deepEqual(createPreparationStore(storage).completed(m),['call']);
  assert.deepEqual(store.completed(preparationChecklist({...person,id:'other'},call,prep)),[]);
  assert.deepEqual(store.completed(preparationChecklist(person,{...call,id:'nov4',start:'2026-11-04T23:00:00Z'},prep)),[]);
  store.mark(m,'call',false);assert.deepEqual(store.completed(m),[]);
});

test('changed instructions invalidate call and packing checks while material checks remain',()=>{
  const store=createPreparationStore(memoryStorage()),m=model();
  for(const task of m.tasks)store.mark(m,task.id,true);
  const updated=preparationChecklist(person,{...call,prep:'Bring a different item.'},prep);
  assert.deepEqual(store.completed(updated),['scripts','music']);
  assert.deepEqual(store.completed(preparationChecklist(person,{...call,personalCallTimes:{'P-actor':'11:00 AM'}},prep)),['scripts','music']);
});

test('stable script hashes survive sync timestamps and reset only the affected material check',()=>{
  const store=createPreparationStore(memoryStorage()),m=model();
  for(const task of m.tasks)store.mark(m,task.id,true);
  const synced={...prep,scripts:prep.scripts.map(s=>({...s,updated:'sync-b'}))};
  assert.equal(store.completed(preparationChecklist(person,call,synced)).length,4);
  const changed={...prep,scripts:prep.scripts.map(s=>({...s,contentHash:'revision-b'}))};
  assert.deepEqual(store.completed(preparationChecklist(person,call,changed)),['call','music','pack']);
  const newTrack={...prep,music:prep.music.map(t=>({...t,playUrl:'chosen-v2.mp3'}))};
  assert.deepEqual(store.completed(preparationChecklist(person,call,newTrack)),['call','scripts','pack']);
});

test('crew get instruction reminders and unpublished or cancelled calls cannot get a checklist',()=>{
  assert.deepEqual(preparationChecklist(person,call,{scripts:[],music:[]}).tasks.map(t=>t.id),['call','pack']);
  for(const change of [{exactCallStatus:'REVIEW'},{exactCallStatus:'PENDING'},{status:'CANCELLED'},{calledPeopleIds:[]}])
    assert.equal(preparationChecklist(person,{...call,...change},prep),null);
});

test('blocked writes preserve in-memory checks instead of reloading old stored values',()=>{
  const store=createPreparationStore({getItem:()=>null,setItem:()=>{throw Error('blocked');}}),m=model();
  store.mark(m,'call',true);store.mark(m,'pack',true);
  assert.deepEqual(store.completed(m),['call','pack']);assert.equal(store.persistent,false);
});

test('malformed or inaccessible storage keeps checklist use available for the visit',()=>{
  for(const storage of [{getItem:()=>'{bad',setItem:()=>{}},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}}]){
    const store=createPreparationStore(storage),m=model();
    assert.deepEqual(store.completed(m),[]);store.mark(m,'call',true);
    assert.deepEqual(store.completed(m),['call']);assert.equal(store.persistent,false);
  }
  const storage=memoryStorage();storage.values.set(preparationKey,'[]');
  assert.deepEqual(createPreparationStore(storage).completed(model()),[]);
});

function practiceHarness(){
  const source=fs.readFileSync(new URL('../line-practice.js',import.meta.url),'utf8');
  class Element{innerHTML='';textContent='';hidden=false;disabled=false;value='';focused=false;selectedOptions=[{textContent:'JOSEPH'}];handlers={};
    addEventListener(name,fn){this.handlers[name]=fn;}querySelectorAll(){return [];}querySelector(){return null;}focus(){this.focused=true;}}
  const elements=Object.fromEntries(['linesLoading','linesError','linesControls','roleSelect','sceneSelect','resetLineProgress','linesSummary','lineCards','lineReviewControls','lineProgressFilter','lineFilterStatus','lineProgressNote'].map(id=>[id,new Element()]));
  const storage=memoryStorage();
  const scope={document:{body:{dataset:{page:'lines'}},getElementById:id=>elements[id]},URLSearchParams,
    localStorage:storage,HTMLElement:Element,window:{location:{search:''}}};
  vm.runInNewContext(source.replace('  init();',`  globalThis.practice={selectPracticeLines,render,updateLineStatus,resetCurrentRole,getProgress,
    setLines:lines=>{allLines=lines;}};`),scope);
  elements.roleSelect.value='JOSEPH';elements.sceneSelect.value='08';elements.lineProgressFilter.value='all';
  return {practice:scope.practice,elements,storage};
}
const lines=[{key:'a',speakerKey:'JOSEPH',speaker:'JOSEPH',sceneNumber:'08',sceneTitle:'Reunion',cue:'First cue',text:'First line'},
  {key:'b',speakerKey:'JOSEPH',speaker:'JOSEPH',sceneNumber:'08',sceneTitle:'Reunion',cue:'Second cue',text:'Second line'},
  {key:'c',speakerKey:'JOSEPH',speaker:'JOSEPH',sceneNumber:'09',sceneTitle:'Town',cue:'Other scene',text:'Other scene line'},
  {key:'d',speakerKey:'MARY',speaker:'MARY',sceneNumber:'08',sceneTitle:'Reunion',cue:'Other role',text:'Other role line'}];
const plain=value=>JSON.parse(JSON.stringify(value));

test('Need work respects both role and scene and does not change saved marks',()=>{
  const h=practiceHarness(),marks={a:'work',b:'known',c:'work',d:'work'};
  const selected=plain(h.practice.selectPracticeLines(lines,'JOSEPH','08','work',marks));
  assert.deepEqual(selected.visible.map(l=>l.key),['a']);assert.equal(selected.scoped.length,2);
  assert.deepEqual(marks,{a:'work',b:'known',c:'work',d:'work'});
  assert.deepEqual(plain(h.practice.selectPracticeLines(lines,'JOSEPH','all','work',marks)).visible.map(l=>l.key),['a','c']);
  assert.deepEqual(plain(h.practice.selectPracticeLines(lines,'JOSEPH','08','unmarked',{a:'known'})).visible.map(l=>l.key),['b']);
});

test('rendered filtered view keeps full scoped totals and excludes other roles and scenes',()=>{
  const h=practiceHarness();h.practice.setLines(lines);
  h.storage.setItem('chosen2026-line-progress-v2',JSON.stringify({a:'work',b:'known',c:'work',d:'work'}));
  h.elements.lineProgressFilter.value='work';h.practice.render();
  assert.match(h.elements.lineCards.innerHTML,/First cue/);
  assert.doesNotMatch(h.elements.lineCards.innerHTML,/Second cue|Other scene|Other role/);
  assert.equal(h.elements.lineFilterStatus.textContent,'Showing 1 of 2 cards in this role and scene · Need work.');
  assert.match(h.elements.linesSummary.innerHTML,/<b>1<\/b> known/);
});

test('marking the last Need work cue known removes it and preserves role, scene and other marks',()=>{
  const h=practiceHarness();h.practice.setLines(lines);
  h.storage.setItem('chosen2026-line-progress-v2',JSON.stringify({a:'work',b:'known',c:'work'}));
  h.elements.lineProgressFilter.value='work';h.practice.render();
  h.practice.updateLineStatus({dataset:{lineKey:'a'}},'known');
  assert.match(h.elements.lineCards.innerHTML,/No lines marked Need work/);
  assert.match(h.elements.lineCards.innerHTML,/Show all cards/);
  assert.equal(h.elements.roleSelect.value,'JOSEPH');assert.equal(h.elements.sceneSelect.value,'08');
  assert.deepEqual(plain(h.practice.getProgress()),{a:'known',b:'known',c:'work'});
  assert.equal(h.elements.lineProgressFilter.focused,true);
  h.elements.lineProgressFilter.value='all';h.practice.render();
  assert.match(h.elements.lineCards.innerHTML,/First cue/);assert.match(h.elements.lineCards.innerHTML,/Second cue/);
});

test('cue marks survive blocked writes during this visit and explain the storage limit',()=>{
  const h=practiceHarness();h.practice.setLines(lines);
  h.storage.setItem=()=>{throw Error('blocked');};
  h.practice.updateLineStatus({dataset:{lineKey:'a'}},'work');
  h.elements.lineProgressFilter.value='work';h.practice.render();
  assert.match(h.elements.lineCards.innerHTML,/First cue/);
  assert.match(h.elements.lineProgressNote.textContent,/page visit only/);
});
