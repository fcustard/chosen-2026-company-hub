
const CHOSEN_PERSON_KEY='chosen2026-person';

async function loadCompanyRoster(){
  const r=await fetch('company.json',{cache:'no-store'});
  if(!r.ok) throw new Error('Company roster unavailable');
  return await r.json();
}
function cEsc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

document.addEventListener('DOMContentLoaded',async()=>{
  let roster;
  try{roster=await loadCompanyRoster()}catch(e){return}
  const people=Array.isArray(roster.people)?roster.people:[];
  const select=document.querySelector('#castSelect');
  const result=document.querySelector('#roleResult');
  if(!select||!result)return;

  people.forEach(p=>{
    const o=document.createElement('option');
    o.value=p.id;
    o.textContent=p.name;
    select.appendChild(o);
  });

  function renderPerson(){
    const p=people.find(x=>x.id===select.value);
    if(!p){result.hidden=true;return}
    localStorage.setItem(CHOSEN_PERSON_KEY,p.id);

    const cards=[
      `<div><small>MY SCENES</small><strong>${cEsc((p.scenes||[]).join(', '))}</strong></div>`
    ];
    if(p.understudy) cards.push(`<div><small>UNDERSTUDY</small><strong>${cEsc(p.understudy)}</strong></div>`);
    if(p.danceEnsemble) cards.push(`<div><small>DANCE</small><strong>Dance Ensemble · Scenes 1, 9 & 12</strong></div>`);

    result.innerHTML=`
      <div class="savedPersonTop"><span class="savedBadge">REMEMBERED ON THIS DEVICE</span><button id="forgetPerson" class="textBtn" type="button">Change person</button></div>
      <h3>Hi, ${cEsc(p.name.split(/\s+/)[0])}.</h3>
      <div class="roleTitle">${cEsc(p.roles)}</div>
      <div class="roleMeta${cards.length===1?' single':''}">${cards.join('')}</div>
      <div class="roleActions">
        <a class="btn primary" href="schedule.html">My Schedule</a>
        <a class="btn" href="scripts.html">Scripts</a>
        <a class="btn" href="this-week.html">This Week</a>
      </div>`;
    result.hidden=false;

    const forget=document.querySelector('#forgetPerson');
    if(forget)forget.onclick=()=>{
      localStorage.removeItem(CHOSEN_PERSON_KEY);
      select.value='';
      result.hidden=true;
      select.focus();
    };
  }

  select.addEventListener('change',renderPerson);
  const saved=localStorage.getItem(CHOSEN_PERSON_KEY);
  if(saved && people.some(p=>p.id===saved)){
    select.value=saved;
    renderPerson();
  }

  const toggle=document.querySelector('#danceToggle');
  const rosterEl=document.querySelector('#danceRoster');
  if(toggle&&rosterEl){
    rosterEl.hidden=true; // FIX 1: always collapsed on page load
    toggle.setAttribute('aria-expanded','false');
    toggle.textContent='View Dance Ensemble';
    const dancers=people.filter(p=>p.danceEnsemble);
    rosterEl.innerHTML=dancers.map(p=>`<p><strong>${cEsc(p.name)}</strong> <span>— Scenes 1, 9, 12</span></p>`).join('');
    toggle.onclick=()=>{
      const open=rosterEl.hidden;
      rosterEl.hidden=!open;
      toggle.setAttribute('aria-expanded',String(open));
      toggle.textContent=open?'Hide Dance Ensemble':'View Dance Ensemble';
    };
  }
});
