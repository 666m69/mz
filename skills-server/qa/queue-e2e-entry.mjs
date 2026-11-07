// Disposable Cloudflare Queue consumer for internal-only hosted D1 acceptance.
// Triggered by authenticated Cloudflare Queue API, never by a public HTTP route.
// No customer data, production hostname, browser, payment system or email.
import {names,runQaPhase} from './hosted-e2e-entry.mjs';
const errorCode=e=>String(e?.message||'failure').replace(/[0-9a-f]{24,}/gi,'[redacted]').slice(0,120);
export default {
  async fetch(){return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}})},
  async queue(batch,env){
    if(!env.SKILLS_DB||!env.QA_RESULTS||!env.QA_MESSAGE_NONCE||
       !Number.isFinite(Date.parse(env.QA_CLOSE_AT||''))||
       Date.now()>=Date.parse(env.QA_CLOSE_AT))return;
    for(const message of batch.messages){
      const request=message.body;
      if(!request||typeof request!=='object'||
         request.nonce!==env.QA_MESSAGE_NONCE||
         typeof request.phase!=='string'||!names.includes(request.phase))continue;
      const phase=request.phase;
      try{
        const result=await runQaPhase(phase,env);
        await env.QA_RESULTS.put('phase-'+phase,JSON.stringify({ok:true,phase,result}),{expirationTtl:3600});
      }catch(e){
        await env.QA_RESULTS.put('phase-'+phase,
          JSON.stringify({ok:false,phase,error:errorCode(e)}),{expirationTtl:3600});
      }
    }
  }
};
