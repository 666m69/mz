import fs from 'node:fs';
import path from 'node:path';
const dir = new URL('./',import.meta.url);
const source = fs.readFileSync(new URL('worker.js',dir),'utf8');
let output=source;
for(const [token,filename] of [['__MZ_HTML__','index.html'],['__MZ_CSS__','style.css'],['__MZ_JS__','app.js']]) {
  if(!output.includes(token))throw Error('Missing placeholder '+token);
  output=output.replace(token,JSON.stringify(fs.readFileSync(new URL(filename,dir),'utf8')));
}
const destination=new URL('../../build/mz-community.mjs',dir);
fs.mkdirSync(path.dirname(destination.pathname),{recursive:true});
fs.writeFileSync(destination,output);
console.log('Community Worker built: '+Buffer.byteLength(output)+' bytes');
