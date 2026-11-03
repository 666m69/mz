import {authenticate,requireThat,ApiError} from './security.mjs';
import {rate,dbError} from './store.mjs';
import {route} from './routes.mjs';
const guardHeaders={
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()'
};
function protect(r){const h=new Headers(r.headers);for(const [k,v] of Object.entries(guardHeaders))h.set(k,v);return new Response(r.body,{status:r.status,headers:h});}
export default {async fetch(req,env){
  try {
    const url=new URL(req.url);
    if(['/', '/admin.js','/admin.css'].includes(url.pathname)&&req.method==='GET'&&env.ASSETS)
      return protect(await env.ASSETS.fetch(req));
    requireThat(url.pathname.startsWith('/api/') && !url.search,404,'not_found');
    requireThat(url.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(url.hostname),400,'tls_required');
    const actor=await authenticate(req,env);
    requireThat(!req.headers.has('Origin') || req.headers.get('Origin')===url.origin,403,'foreign_origin');
    requireThat(env.SKILLS_DB,503,'database_unavailable');
    await rate(env.SKILLS_DB,actor);
    const out=await route(req,env,actor,url.pathname.slice(5).split('/'));
    return protect(out instanceof Response?out:Response.json(out));
  }catch(e){
    const err=dbError(e);if(!(err instanceof ApiError))console.error('skills_internal_failure');
    const status=err instanceof ApiError?err.status:500,code=err instanceof ApiError?err.code:'internal_error';
    const retry=code==='rate_limit'?60:code==='queue_full'?30:code==='daily_limit'?86400-(Math.floor(Date.now()/1000)%86400):0;
    return protect(Response.json({error:code},{status,headers:retry?{'Retry-After':String(retry)}:{}}));
  }
}};
