import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const host='https://feat-saudi-home-intake-20261.mz702.pages.dev';
const requestId=randomUUID();
const idea='[QA 2026-11-04] أريد أداة سعودية بسيطة للمعلمين، لتنظيم مهام الصف ومتابعة الواجبات بشكل واضح.';
const body={idea,email:'',name:'',consent:'yes',website:''};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let ready=false;
for(let i=0;i<5;i++){
  const result=await fetch(host+'/',{signal:AbortSignal.timeout(12000)}).catch(error=>{
    console.log('QA preview connection error:',String(error?.cause?.code||error?.name||'network').slice(0,60));return null;
  });
  if(result){
    const html=await result.text();
    ready=result.ok&&html.includes('mz-quick-idea')&&html.includes('mz-intake-track');
    console.log('QA preview probe:',JSON.stringify({status:result.status,finalHost:new URL(result.url).hostname,
      contentType:result.headers.get('content-type'),hasForm:html.includes('mz-quick-idea'),hasTracking:html.includes('mz-intake-track')}));
    if(ready)break;
  }
  await pause(3500);
}
assert.ok(ready,'the preview homepage is not accessible or its latest deployment is not active');
const headers={'Content-Type':'application/json','Origin':host,'Idempotency-Key':requestId};
const send=()=>fetch(host+'/api/ideas',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
const first=await send();
const ticket=await first.json();
assert.equal(first.status,201,JSON.stringify({status:first.status,error:ticket.error}));
assert.match(ticket.reference,/^MZ-[A-F0-9]{12}$/);
assert.equal(ticket.receipt_email_status,'not_requested');
console.log('QA ticket created:',ticket.reference);
const replay=await send();const replayData=await replay.json();
assert.equal(replay.status,200,JSON.stringify(replayData));
assert.equal(replayData.reference,ticket.reference);
const track=await fetch(host+'/api/ideas/'+encodeURIComponent(ticket.reference),{signal:AbortSignal.timeout(15000)});
const status=await track.json();
assert.equal(track.status,200);
assert.equal(status.status,'new');
console.log('QA trace: homepage → D1 receipt → idempotent replay → tracking PASS');
