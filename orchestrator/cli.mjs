import {executeIdea} from './engine.mjs';
const flag=process.argv[2];
if(flag==='--help'){console.log('node orchestrator/cli.mjs --synthetic   (local-only, no customer data)');}
else if(flag==='--synthetic'){
  const result=await executeIdea({idea:'أريد تطبيق ويب بسيط لقائمة مهام يومية يحتفظ بما أضيفه على جهازي',title:'MZcode تجربة اصطناعية'});
  if(!result.ok)process.exitCode=1;
  console.log(JSON.stringify({ok:result.ok,state:result.state,artifact_path:result.artifact_path,receipt_path:result.receipt_path,sha256:result.receipt?.artifact_sha256,tests:result.receipt?.tests},null,2));
}else{console.error('Only --synthetic is currently supported; no real customer requests.');process.exitCode=2;}
