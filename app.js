async function load(){try{const r=await fetch('content.json',{cache:'no-store'});return await r.json()}catch(e){return null}}
function link(el,u){if(!el||!u||u==='#')return;el.href=u;if(u.startsWith('http')){el.target='_blank';el.rel='noopener'}}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function lines(v=''){return esc(v).replace(/\r?\n/g,'<br>')}
function btn(t,u,c=''){return(!u||u==='#')?`<span class="btn ${c}" aria-disabled="true">${esc(t)} soon</span>`:`<a class="btn ${c}" href="${esc(u)}" ${u.startsWith('http')?'target="_blank" rel="noopener"':''}>${esc(t)}</a>`}
document.addEventListener('DOMContentLoaded',async()=>{
 const m=document.querySelector('#menuBtn'),n=document.querySelector('#nav');
 if(m&&n){m.onclick=()=>{const o=n.classList.toggle('open');m.setAttribute('aria-expanded',o)};n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');m.setAttribute('aria-expanded','false')}))}
 const d=await load();if(!d)return;
 document.querySelectorAll('[data-link]').forEach(a=>link(a,d.links?.[a.dataset.link]));
 const u=document.querySelector('#updated');if(u)u.textContent=d.updated?`Updated ${d.updated}`:'';
 if(document.body.dataset.page==='home'){const x=d.nextRehearsal||{};nrDay.textContent=x.day||'NEXT REHEARSAL';nrDate.textContent=x.date||'See schedule';nrTime.textContent=x.time||'';nrLocation.textContent=x.location||'';nrFocus.textContent=x.focus||'';link(nrLink,x.url||'schedule.html')}
 if(document.body.dataset.page==='week'){const w=d.thisWeek||{};weekLabel.textContent=w.label||'THIS WEEK';weekTitle.textContent=w.title||'This Week';weekIntro.textContent=w.intro||'';weekList.innerHTML=(w.rehearsals||[]).map(x=>`<article class="rehearsal"><div class="rehTop"><div><p class="ey">${esc(x.date)}</p><h2>${esc(x.title)}</h2></div><span class="status">${esc(x.status)}</span></div><div class="rehFacts"><div><b>WHEN</b><span>${esc(x.time)}</span></div><div><b>WHERE</b><span>${esc(x.location)}</span></div></div><div class="rehBody"><div><b>WHO IS CALLED</b><p>${lines(x.called)}</p></div><div><b>WHAT WE'RE WORKING ON</b><p>${lines(x.work)}</p></div><div><b>PREP</b><p>${lines(x.prep)}</p></div>${x.notice?`<div class="callout"><b>IMPORTANT</b><p>${lines(x.notice)}</p></div>`:''}</div><div class="actions">${btn('Scripts',x.scriptUrl,'primary')}${btn('Music',x.musicUrl)}<a class="btn" href="schedule.html">Full schedule</a></div></article>`).join('')}
 if(document.body.dataset.page==='scripts'){scriptsList.innerHTML=(d.scripts||[]).map(s=>`<article class="row"><div class="badge">${esc(s.scene)}</div><div><h3>${esc(s.title)}</h3><p>${esc(s.status)}</p></div><div class="actions">${btn('Read',s.readUrl,'primary')}${btn('PDF',s.pdfUrl)}</div></article>`).join('')}
 if(document.body.dataset.page==='music'){musicList.innerHTML=(d.music||[]).map(x=>`<article class="row"><div class="badge">♪</div><div><h3>${esc(x.title)}</h3><p>${esc(x.type)} · ${esc(x.status)}</p></div><div class="actions">${btn('Play',x.playUrl,'primary')}${btn('Lyrics',x.lyricsUrl)}</div></article>`).join('')}
 if(document.body.dataset.page==='schedule'){
  const all=d.schedule?.rehearsals||[], now=new Date();
  const allGroups=d.schedule?.availableGroups||[];
  const storageKey='chosen2026-call-groups';

  function parseDateParts(x){
    const dt=new Date(x.start);
    return {
      dow:new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'America/New_York'}).format(dt).toUpperCase(),
      mon:new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'America/New_York'}).format(dt).toUpperCase(),
      day:new Intl.DateTimeFormat('en-US',{day:'2-digit',timeZone:'America/New_York'}).format(dt)
    };
  }

  function locationInfo(x){
    const raw=String(x.location||'').trim();
    const short=String(x.locationShort||raw||'TBD').trim();
    const isUrl=/^https?:\/\//i.test(raw);
    const isVirtual=isUrl || /zoom|virtual|off[- ]?site/i.test(raw+' '+short);
    let address=raw.includes('|')?raw.split('|').slice(1).join('|').trim():raw;
    if(!address || address==='TBD') address=short;
    return {raw,short,isUrl,isVirtual,address};
  }

  function mapChoices(x){
    const loc=locationInfo(x);
    if(loc.isUrl){
      return `<a class="locationLink" href="${esc(loc.raw)}" target="_blank" rel="noopener">Join virtual rehearsal ↗</a>`;
    }
    if(!loc.address || loc.address==='TBD'){
      return `<span class="locationPlain">${esc(loc.short)}</span>`;
    }
    const q=encodeURIComponent(loc.address);
    const apple=`https://maps.apple.com/?q=${q}`;
    const google=`https://www.google.com/maps/search/?api=1&query=${q}`;
    const waze=`https://www.waze.com/ul?q=${q}&navigate=yes`;
    return `<details class="directionsMenu"><summary class="locationLink">${esc(loc.short)} <span aria-hidden="true">↗</span></summary><div class="directionsChoices"><a href="${google}" target="_blank" rel="noopener">Google Maps</a><a href="${apple}" target="_blank" rel="noopener">Apple Maps</a><a href="${waze}" target="_blank" rel="noopener">Waze</a></div></details>`;
  }

  let selected=[];
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');
    if(Array.isArray(saved)) selected=saved.filter(g=>allGroups.includes(g));
  }catch(e){}

  const filterWrap=document.querySelector('#callGroupFilters');
  const filterCount=document.querySelector('#filterCount');
  const upcomingList=document.querySelector('#upcomingSchedule');
  const pastList=document.querySelector('#pastSchedule');
  const upcomingEmpty=document.querySelector('#upcomingEmpty');
  const clearBtn=document.querySelector('#clearCallFilters');

  function groupMatches(x){
    if(!selected.length) return true;
    const groups=Array.isArray(x.callGroups)?x.callGroups:[];
    if(groups.includes('Full Company')) return true;
    return selected.some(g=>groups.includes(g));
  }

  function renderFilters(){
    if(!filterWrap)return;
    filterWrap.innerHTML=allGroups.map(g=>{
      const on=selected.includes(g);
      return `<button type="button" class="filterChip${on?' active':''}" data-group="${esc(g)}" aria-pressed="${on?'true':'false'}">${esc(g)}</button>`;
    }).join('');
    filterWrap.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{
      const g=b.dataset.group;
      selected=selected.includes(g)?selected.filter(x=>x!==g):[...selected,g];
      localStorage.setItem(storageKey,JSON.stringify(selected));
      renderFilters();
      renderSchedule();
    }));
    if(clearBtn){
      clearBtn.hidden=!selected.length;
      clearBtn.onclick=()=>{
        selected=[];
        localStorage.removeItem(storageKey);
        renderFilters();
        renderSchedule();
      };
    }
  }

  const card=x=>{
    const dp=parseDateParts(x);
    return `<article class="scheduleCard">
      <div class="scheduleCardGrid">
        <div class="dateBlock" aria-label="${esc(x.day||x.date)}">
          <span class="dateDow">${dp.dow}</span>
          <span class="dateMonth">${dp.mon}</span>
          <span class="dateDay">${dp.day}</span>
        </div>
        <div class="scheduleMain">
          <div class="scheduleTop">
            <div><h2>${esc(x.title)}</h2></div>
            <span class="status">${esc(x.status)}</span>
          </div>
          <div class="scheduleFacts">
            <div><b>WHEN</b><span>${esc(x.time)}</span></div>
            <div><b>WHERE</b>${mapChoices(x)}</div>
          </div>
          <div class="groupTags">${(x.callGroups||[]).map(g=>`<span>${esc(g)}</span>`).join('')}</div>
          <details>
            <summary>View rehearsal details</summary>
            <div class="scheduleDetails">
              ${x.called?`<div><b>WHO IS CALLED</b><p>${lines(x.called)}</p></div>`:''}
              ${x.work?`<div><b>WHAT WE'RE WORKING ON</b><p>${lines(x.work)}</p></div>`:''}
              ${x.prep?`<div><b>PREP</b><p>${lines(x.prep)}</p></div>`:''}
              ${x.notice?`<div class="callout"><b>IMPORTANT</b><p>${lines(x.notice)}</p></div>`:''}
            </div>
          </details>
        </div>
      </div>
    </article>`;
  };

  function renderSchedule(){
    const upcoming=all.filter(x=>new Date(x.end)>=now && groupMatches(x));
    const past=all.filter(x=>new Date(x.end)<now && groupMatches(x)).reverse();

    if(upcomingList)upcomingList.innerHTML=upcoming.map(card).join('');
    if(pastList)pastList.innerHTML=past.map(card).join('');
    if(upcomingEmpty){
      upcomingEmpty.hidden=upcoming.length>0;
      upcomingEmpty.textContent=selected.length
        ? 'No upcoming rehearsals match your selected call group(s).'
        : 'No upcoming published rehearsals.';
    }
    if(filterCount){
      filterCount.textContent=selected.length
        ? `${selected.length} call group${selected.length===1?'':'s'} selected`
        : 'Showing all calls';
    }
  }

  renderFilters();
  renderSchedule();

  const pastToggle=document.querySelector('#pastToggle');
  const pastWrap=document.querySelector('#pastWrap');
  if(pastToggle&&pastWrap){
    pastToggle.addEventListener('click',()=>{
      const open=pastWrap.hidden;
      pastWrap.hidden=!open;
      pastToggle.textContent=open?'Hide past rehearsals':'Show past rehearsals';
      pastToggle.setAttribute('aria-expanded',String(open));
    });
  }
 }
});