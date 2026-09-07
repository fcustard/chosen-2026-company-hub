import fs from "node:fs";
import path from "node:path";
const ROOT=process.cwd(), FILE=path.join(ROOT,"data","resources.json");
function fail(m){console.error(`❌ RESOURCE PUBLISHING ERROR: ${m}`);process.exit(1);}
function readJson(f){if(!fs.existsSync(f))fail(`Required file not found: ${path.relative(ROOT,f)}`);try{return JSON.parse(fs.readFileSync(f,"utf8"));}catch(e){fail(`Invalid JSON in ${path.relative(ROOT,f)}: ${e.message}`);}}
const items=readJson(FILE); if(!Array.isArray(items)) fail("data/resources.json must contain a JSON array.");
const ids=new Set();
for(const item of items){
 if(!item||typeof item!=="object") fail("Every resource entry must be an object.");
 if(!item.id||!String(item.id).trim()) fail('A resource is missing "id".');
 if(ids.has(item.id)) fail(`Duplicate resource id: ${item.id}`); ids.add(item.id);
 if(!item.title||!String(item.title).trim()) fail(`${item.id} is missing "title".`);
 if(!item.category||!String(item.category).trim()) fail(`${item.id} is missing "category".`);
 const wants=item.approved===true||item.companyPublish===true;
 if(!wants){console.log(`🔒 Resource ${item.id}: staged but unpublished.`);continue;}
 if(item.approved!==true) fail(`${item.id} requests publication but approved is not true.`);
 if(item.companyPublish!==true) fail(`${item.id} is approved but companyPublish is not true.`);
 if(!item.fileUrl||!String(item.fileUrl).trim()) fail(`${item.id} is publishable but has no fileUrl.`);
 if(!/^(https?:)?\/\//i.test(item.fileUrl)&&!item.fileUrl.startsWith("#")){
  const fp=path.join(ROOT,item.fileUrl); if(!fs.existsSync(fp)) fail(`${item.id} references ${item.fileUrl}, but that file does not exist.`);
 }
 console.log(`✅ Resource ${item.id}: publication record passed safety validation.`);
}
console.log("✅ Resource publication safety validation complete.");