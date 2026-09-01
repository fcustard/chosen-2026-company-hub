
document.addEventListener("DOMContentLoaded", () => {
  const data = Array.isArray(window.CHOSEN_COMPANY_DATA) ? window.CHOSEN_COMPANY_DATA : [];
  const select = document.getElementById("castSelect");
  const result = document.getElementById("roleResult");
  if(select && result){
    data.forEach((p,i)=>{
      const o=document.createElement("option"); o.value=String(i); o.textContent=p.name; select.appendChild(o);
    });
    const render=()=>{
      if(select.value===""){ result.hidden=true; return; }
      const p=data[Number(select.value)];
      result.innerHTML=`<h3>${esc(p.name)}</h3>
        <div class="roleTitle">${esc(p.roles)}</div>
        <div class="roleMeta">
          <div><small>MY SCENES</small><strong>${esc(p.scenes)}</strong></div>
          <div><small>ASSIGNMENT</small><strong>${p.understudy?esc(p.understudy):p.danceEnsemble?"Dance Ensemble":"Cast Company"}</strong></div>
        </div>
        ${p.danceEnsemble?'<p><strong>Dance Ensemble:</strong> Dance assignments are Scenes 1, 9 and 12.</p>':''}
        <div class="roleActions"><a class="btn primary" href="schedule.html">View My Calls</a><a class="btn" href="scripts.html">Scripts</a><a class="btn" href="this-week.html">This Week</a></div>`;
      result.hidden=false;
      try{localStorage.setItem("chosenCastMember",p.name)}catch(e){}
    };
    select.addEventListener("change",render);
    try{
      const saved=localStorage.getItem("chosenCastMember");
      const idx=data.findIndex(p=>p.name===saved);
      if(idx>=0){select.value=String(idx);render();}
    }catch(e){}
  }
  const toggle=document.getElementById("danceToggle"), roster=document.getElementById("danceRoster");
  if(toggle && roster){
    const dancers=data.filter(p=>p.danceEnsemble);
    roster.innerHTML=dancers.map(p=>`<p><strong>${esc(p.name)}</strong> <span class="note">— Scenes 1, 9, 12</span></p>`).join("");
    toggle.addEventListener("click",()=>{
      const open=roster.hidden; roster.hidden=!open; toggle.setAttribute("aria-expanded",String(open));
      toggle.textContent=open?"Hide Dance Ensemble":"View Dance Ensemble";
    });
  }
  function esc(s){const d=document.createElement("div");d.textContent=s||"";return d.innerHTML;}
});
