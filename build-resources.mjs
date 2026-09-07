import fs from "node:fs";
import path from "node:path";
const ROOT=process.cwd(),DATA=path.join(ROOT,"data","resources.json"),TEMPLATE=path.join(ROOT,"templates","resources-page.html"),OUTPUT=path.join(ROOT,"resources.html");
function fail(m){console.error(`❌ RESOURCE BUILD ERROR: ${m}`);process.exit(1);}
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function card(i,f=false){const c=f?"resourceFeatured":"resourceCard",h=f?"h2":"h3";return `<article class="${c}"><div class="resourceMeta">${esc(i.status||"CURRENT")} · ${esc(i.category)}</div><${h}>${esc(i.title)}</${h}><p class="resourceDesc">${esc(i.description||"")}</p><a class="resourceAction${f?"":" secondary"}" href="${esc(i.fileUrl)}" target="_blank" rel="noopener">${esc(i.linkLabel||"Open resource")}</a></article>`;}
if(!fs.existsSync(DATA)) fail("data/resources.json does not exist."); if(!fs.existsSync(TEMPLATE)) fail("templates/resources-page.html does not exist.");
const items=JSON.parse(fs.readFileSync(DATA,"utf8")),pub=items.filter(i=>i.approved===true&&i.companyPublish===true);
const feat=pub.filter(i=>i.featured===true),featured=feat.length?`<section aria-label="Featured resources">${feat.map(i=>card(i,true)).join("\n")}</section>`:"";
const groups=new Map(); for(const i of pub.filter(i=>i.featured!==true)){if(!groups.has(i.category))groups.set(i.category,[]);groups.get(i.category).push(i);}
let categories=""; for(const [cat,g] of groups){categories+=`<section><h2 class="resourceCategory">${esc(cat)}</h2><div class="resourceGrid">${g.map(i=>card(i,false)).join("\n")}</div></section>\n`;}
if(!pub.length) categories=`<div class="emptyState"><b>No resources have been released yet.</b><br>Approved company resources will appear here as they are published.</div>`;
let html=fs.readFileSync(TEMPLATE,"utf8").replaceAll("{{FEATURED}}",featured).replaceAll("{{CATEGORIES}}",categories); fs.writeFileSync(OUTPUT,html,"utf8");
console.log(`✅ resources.html generated with ${pub.length} published resource(s).`);