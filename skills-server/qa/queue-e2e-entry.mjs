// Disposable Cloudflare Queue consumer for internal-only hosted D1 acceptance.
// Triggered by authenticated Cloudflare Queue API, never by a public HTTP route.
// No customer data, production hostname, browser, payment system or email.
import {names,runQaPhase} from './hosted-e2e-entry.mjs';
const errorCode=e=>String(e?.message||'failure').replace(/[0-9a-f]{24,}/gi,'[redacted]').slice(0,420);
const validKey=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
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
        // Reject misconfigured encryption *before* mutating the disposable D1.
        if(!validKey(env.DATA_KEY)||!validKey(env.CAPABILITY_KEY)||
          env.DATA_KEY===env.CAPABILITY_KEY)throw Error('QA_BAD_ENCRYPTION_KEY_FORMAT');
        if(!env.QA_QUEUE||typeof env.QA_QUEUE.send!=='function')
          throw Error('QA_QUEUE_PRODUCER_MISSING');
        const result=await runQaPhase(phase,env);
        await env.QA_RESULTS.put('phase-'+phase,JSON.stringify({ok:true,phase,result}),{expirationTtl:3600});
        const index=names.indexOf(phase);
        if(index===names.length-1){
          await env.QA_RESULTS.put('qa-complete',
            JSON.stringify({ok:true,executed:names.length,lastPhase:phase}),{expirationTtl:3600});
        }else{
          // Internal self-chaining: no exposed HTTP/Access bypass, no polling,
          // and the next task only starts if the current phase succeeded.
          await env.QA_QUEUE.send({phase:names[index+1],nonce:env.QA_MESSAGE_NONCE});
        }
      }catch(e){
        await env.QA_RESULTS.put('phase-'+phase,
          JSON.stringify({ok:false,phase,error:errorCode(e)}),{expirationTtl:3600});
      }
    }
  }
};
