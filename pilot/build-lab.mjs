import {readFile,writeFile,mkdir} from "node:fs/promises";
const file = name => new URL(name,import.meta.url);
const assets = {};
for(const [url,name,type] of [
  ["/idea","index.html","text/html"],["/idea/lab.js","lab.js","text/javascript"],
  ["/idea/prototype.js","prototype.js","text/javascript"],["/idea/lab.css","lab.css","text/css"],["/idea/engine.js","engine.js","text/javascript"]]){
  assets[url]=[await readFile(file("./lab/"+name),"utf8"),type];
}
const original=await readFile(file("./mz-ideas-worker.js"),"utf8");
await mkdir(file("../build"),{recursive:true});
await writeFile(file("../build/mz-ideas.mjs"),original.replace("/* LAB_ASSETS */ {}",()=>JSON.stringify(assets)));
