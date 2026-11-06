// Isolated QA entry. The owner UI and production site use separate entry points.
import core from '../worker/index.mjs';
const denied=()=>new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});
export default {fetch(request,env){
  const url=new URL(request.url), expires=Date.parse(env.QA_CLOSE_AT||'');
  if(!Number.isFinite(expires)||Date.now()>=expires||url.protocol!=='https:'||
    url.hostname!==env.QA_HOST||!url.pathname.startsWith('/api/'))return denied();
  return core.fetch(request,env);
}};
