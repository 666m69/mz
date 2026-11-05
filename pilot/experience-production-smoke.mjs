// Read-only production smoke gate, runs after approved release merge.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const root='https://mzcodehub.com';
async function load(path){
  const result=await fetch(root+path,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'MZcodeReleaseAudit/2.0'}});
  const text=await result.text();
  return {status:result.status,type:result.headers.get('content-type'),location:result.headers.get('location'),text};
}
let homepage;
for(let i=0;i<10;i++){
  try{
    homepage=await load('/');
    if(homepage.status===200&&homepage.text.includes('id="mz-assistant"')&&homepage.text.includes('mz-bot-form'))break;
    console.log('RELEASE_POLL',JSON.stringify({attempt:i+1,status:homepage.status,hasBot:homepage.text?.includes('id="mz-assistant"'),redirect:homepage.location?.slice(0,120)}));
  }catch(e){console.log('RELEASE_POLL_ERR',i+1,String(e?.cause?.code||e?.name).slice(0,80));}
  await delay(7000);
}
assert.equal(homepage?.status,200,'Production root must return HTTP 200');
assert.match(homepage.text,/id="mz-assistant"/,'2.0 hero must be live');
assert.match(homepage.text,/mz-bot-form/);
assert.match(homepage.text,/mz-intake-email[^>]*required/,'email-required input must be visible in production intake');
assert.match(homepage.text,/\/assets\/images\/mz-mark\.svg/,'original logo must remain');
assert.match(homepage.text,/data-panel="game"/,'existing interactive experiences must remain');
for(const path of ['/assets/js/mz-assistant-ui.mjs','/assets/js/mz-assistant-router.mjs','/assets/css/studio-site.css','/tools/teacher/','/tools/hydroponics/','/tools/opportunities/']){
  const page=await load(path);
  assert.equal(page.status,200,path+' HTTP '+page.status);
  if(path.endsWith('.mjs'))assert.match(page.type||'',/javascript/i,path+' MIME');
  if(path.endsWith('studio-site.css'))assert.match(page.text,/\.mz-ai-panel/,path+' needs CSS');
  console.log('RELEASE_CHECK',path,page.status);
}
console.log('MZCODE_EXPERIENCE_V2_PRODUCTION_PASS: HTTP routes, original logo, bot, email gate, demos, tools');
