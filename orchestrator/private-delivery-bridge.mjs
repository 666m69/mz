/* Trusted local bridge: reviewed idea -> tested ZIP -> private delivery.
 * Staging only. Not an HTTP handler; no public request may choose clientId.
 * resolveClientIdentity MUST be provided by the future authenticated API.
 */
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {executeIdea,planIdea} from './engine.mjs';
import {PrivateDeliveryVault} from './private-vault.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function stageIdeaDelivery({idea,title,orderId}={},
  {vault,resolveClientIdentity}={}){
  if(!(vault instanceof PrivateDeliveryVault))throw Error('TRUSTED_VAULT_REQUIRED');
  if(typeof resolveClientIdentity!=='function')throw Error('AUTHENTICATED_RESOLVER_REQUIRED');
  // The caller never sends clientId; it comes from a trusted session resolver.
  const clientId=await resolveClientIdentity();
  vault.identity(clientId,orderId); // Validate both before allocating any output.
  const plan=planIdea({idea,title});
  if(plan.state!=='ready_for_staging'){
    return {ok:false,state:plan.state,reason:plan.reason,automatic_delivery:false};
  }
  const temp=await mkdtemp(join(tmpdir(),'mzcode-staged-delivery-'));
  try{
    const result=await executeIdea({idea,title},{outputRoot:temp});
    if(!result.ok||result.state!=='staging_verified'||result.receipt?.source_verified!==true
      ||result.receipt?.tests?.html_security!==true
      ||result.receipt?.tests?.zip_contents<1)throw Error('BUILD_NOT_VERIFIED');
    const zip=await readFile(result.artifact_path);
    if(sha(zip)!==result.receipt.artifact_sha256)throw Error('ARTIFACT_HASH_MISMATCH');
    const delivery=await vault.store({orderId,clientId,zip});
    return {ok:true,state:'staged_for_private_delivery',orderId,
      skill_id:result.receipt.skill_id,
      artifact_sha256:delivery.sha256,artifact_bytes:delivery.bytes,
      expiresAt:delivery.expiresAt,
      // Transport must be authenticated. Never include this bearer token in a public log.
      downloadToken:delivery.token,
      automatic_customer_delivery:false,customer_deployed:false};
  }finally{
    await rm(temp,{recursive:true,force:true});
  }
}
