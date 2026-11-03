import assert from 'node:assert/strict';
const base='https://mzcodehub.com';
const seeds=['/','/projects/','/tools/','/idea','/tools/quote/','/tools/menu/','/tools/clients/','/tools/property/','/tools/images/','/tools/recipe/','/games/code/','/games/caravan/','/games/baad-marib/','/coreresto/','/privacy','/terms'];
const internals=new Set(seeds), externals=new Set(), fails=[], stats=[];
const fetchSafe=async u=>fetch(u,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'MZcode-acceptance-readonly/20261103'}});
for(const path of seeds){
 try {
  const r=await fetchSafe(base+path);
  stats.push({path,status:r.status});
  if(!r.ok){fails.push(path+' HTTP '+r.status);continue}
  const text=await r.text();
  if(!r.headers.get('content-type')?.includes('text/html'))continue;
  const attrs=[...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(x=>x[1]);
  for(const raw of attrs){
   if(/^(?:mailto:|tel:|data:|#)/i.test(raw))continue;
   if(/^javascript:/i.test(raw)){fails.push(path+' unsafe javascript: link');continue}
   let url;try{url=new URL(raw,base+path)}catch{fails.push(path+' invalid URL '+raw.slice(0,80));continue}
   if(!['http:','https:'].includes(url.protocol))continue;
   if(url.hostname==='mzcodehub.com'||url.hostname==='www.mzcodehub.com')internals.add(url.pathname);
   else if(/(onrender\.com|vercel\.app)/i.test(url.hostname))externals.add(url.origin+url.pathname);
  }
 }catch(e){fails.push(path+' '+e.message)}
}
const paths=[...internals].filter(p=>p!=='/' && !seeds.includes(p)).slice(0,100);
for(const path of paths){
 try{const r=await fetchSafe(base+path);stats.push({path,status:r.status});if(!r.ok)fails.push(path+' HTTP '+r.status);}
 catch(e){fails.push(path+' '+e.message)}
}
for(const url of [...externals].slice(0,12)){
 try{const r=await fetchSafe(url);console.log('EXTERNAL_LINK',r.status,url)}
 catch(e){console.log('EXTERNAL_LINK_UNVERIFIED',url,e.message)}
}
console.log('LINK_AUDIT_RESULTS',JSON.stringify({seedCount:seeds.length,totalChecked:stats.length,good:stats.filter(x=>x.status>=200&&x.status<300).length,failures:fails,paths:stats}));
if(fails.length)process.exitCode=1;
