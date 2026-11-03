import assert from 'node:assert/strict';
const site='https://mzcodehub.com';
let passed=0;
async function get(path,expectedStatus=200){
 const response=await fetch(site+path,{redirect:'manual',signal:AbortSignal.timeout(18000),cache:'no-store'});
 assert.equal(response.status,expectedStatus,path+' returned '+response.status);
 const text=await response.text();
 passed++;console.log('PASS',path,'HTTP',response.status);
 return text;
}
const script=await get('/_mz/share.js');
for(const value of ['linkBrandMentions','mz-inline-home-link','a,button,script,style,title,textarea','ارحبوا ملايين','كذا ولا كذا جالس عالجوال'])assert.ok(script.includes(value),'share script missing '+value);
const stylesheet=await get('/_mz/share.css');
assert.ok(stylesheet.includes('a.mz-inline-home-link'),'home link style missing');
const homepage=await get('/');
assert.ok(homepage.includes('data-mz-share-script'),'missing share script in homepage');
assert.ok(homepage.includes('href="/"'),'homepage logo link missing');
for(const path of ['/community/','/idea','/tools/','/projects/']){
 const html=await get(path);
 assert.ok(html.includes('data-mz-share-script'),path+' missing shared brand script');
}
for(const path of ['/games/baad-marib/','/games/code/','/games/caravan/','/tools/clients/','/tools/recipe/']){
 const html=await get(path);
 assert.ok(html.includes('<a href="/">MZcode</a>'),path+' has brand pointing elsewhere');
}
await get('/api/ideas',405);
const admin=await fetch(site+'/admin/ideas',{redirect:'manual',signal:AbortSignal.timeout(18000)});
assert.ok([302,401,403].includes(admin.status),'admin is public');
passed++;console.log('PASS admin protected',admin.status);
console.log('PASS live brand-home smoke',passed,'checks, no mutations or sends');
