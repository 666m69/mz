/* Private Skills Server artifact retention — no public route by itself.
 * Existing request capability authentication is enforced in routes.mjs.
 * A leaked request capability remains sensitive: never log or expose it.
 */
export const DOWNLOAD_WINDOW_SECONDS=14*24*60*60;
export const PURGE_WINDOW_SECONDS=30*24*60*60;

export function mayDownloadArtifact(row,nowSeconds=Math.floor(Date.now()/1000)){
 if(!row || !Number.isSafeInteger(nowSeconds))return false;
 const {download_expires_at,purge_after,revoked_at}=row;
 if(!Number.isSafeInteger(download_expires_at) ||
    !Number.isSafeInteger(purge_after) ||
    purge_after<=download_expires_at ||
    download_expires_at<1 ||
    revoked_at!==null && revoked_at!==undefined)return false;
 return nowSeconds<download_expires_at && nowSeconds<purge_after;
}

export async function purgeExpiredArtifacts(env){
 if(!env?.SKILLS_DB)throw Error('SKILLS_DB_REQUIRED');
 const result=await env.SKILLS_DB.prepare(
   'DELETE FROM ss_artifacts WHERE purge_after IS NOT NULL AND purge_after<=unixepoch()'
 ).run();
 return {purged:Math.max(0,Number(result?.meta?.changes||0))};
}
