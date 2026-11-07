import test from 'node:test';
import assert from 'node:assert/strict';
import {zipFiles} from '../worker/zip.mjs';
import {artifactNames} from '../worker/catalog.mjs';

const utf8=new TextEncoder(),decode=new TextDecoder();
const fixture={
 'app.js':'document.querySelector("h1").textContent="تم";',
 'blueprint.json':'{"app":"qa","locale":"ar"}',
 'index.html':'<!doctype html><html lang="ar" dir="rtl"><h1>مهمة اليوم</h1>',
 'styles.css':'body{direction:rtl;line-height:1.6}'
};
function independentCrc(input){
 let c=0xFFFFFFFF;
 for(const n of input){c^=n;for(let j=0;j<8;j++)c=(c&1)?(c>>>1)^0xEDB88320:c>>>1}
 return (c^0xFFFFFFFF)>>>0;
}
function parseStoredZip(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const read16=o=>view.getUint16(o,true),read32=o=>view.getUint32(o,true);
 const files=new Map(),central=[],local=[];
 let off=0;
 while(off+4<=bytes.length&&read32(off)===0x04034B50){
  const compression=read16(off+8), crc=read32(off+14),size=read32(off+18),len=read16(off+26),extra=read16(off+28);
  assert.equal(compression,0,'ZIP method must be STORE');
  assert.equal(read16(off+6),0,'no unsupported flags');
  assert.ok(len>0&&len<80&&extra===0);
  const name=decode.decode(bytes.subarray(off+30,off+30+len));
  assert.ok(artifactNames.includes(name),'unreviewed file name');
  assert.ok(!files.has(name),'duplicate name');
  const start=off+30+len+extra,end=start+size;
  assert.ok(end<=bytes.length,'truncated ZIP member');
  const data=bytes.subarray(start,end);
  assert.equal(read32(off+22),size,'uncompressed length mismatch');
  assert.equal(independentCrc(data),crc,'CRC-32 mismatch');
  files.set(name,decode.decode(data));local.push({name,crc,size,offset:off});
  off=end;
 }
 const centralStart=off;
 for(let i=0;i<local.length;i++){
  assert.equal(read32(off),0x02014B50,'central directory required');
  const nameLength=read16(off+28),extraLength=read16(off+30),commentLength=read16(off+32);
  const name=decode.decode(bytes.subarray(off+46,off+46+nameLength));
  assert.equal(name,local[i].name);
  assert.equal(read32(off+16),local[i].crc);
  assert.equal(read32(off+20),local[i].size);
  assert.equal(read32(off+42),local[i].offset);
  central.push(name);off+=46+nameLength+extraLength+commentLength;
 }
 assert.equal(read32(off),0x06054B50,'ZIP end-of-central-directory required');
 assert.equal(read16(off+8),local.length);
 assert.equal(read16(off+10),local.length);
 assert.equal(read32(off+12),off-centralStart);
 assert.equal(read32(off+16),centralStart);
 assert.equal(off+22,bytes.length,'no trailing malicious entries');
 return files;
}
test('Skills Server delivery produces a readable, complete, CRC-verified ZIP with only reviewed files',()=>{
 const bytes=zipFiles(fixture),members=parseStoredZip(bytes);
 assert.equal(members.size,4);
 assert.deepEqual([...members.keys()],artifactNames);
 for(const k of artifactNames)assert.equal(members.get(k),fixture[k]);
 assert.ok(members.get('index.html').includes('dir="rtl"'));
});
test('ZIP integrity checker detects tampered content and truncation',()=>{
 const good=zipFiles(fixture);
 const modified=new Uint8Array(good);
 const p=modified.indexOf(0x64); // first file contents or header: either way damage must be detected
 assert.ok(p>=0);
 // Modify the actual first member payload at a known ZIP local header offset.
 const nameLength=new DataView(modified.buffer).getUint16(26,true);
 modified[30+nameLength]^=0x01;
 assert.throws(()=>parseStoredZip(modified),/CRC-32 mismatch/);
 assert.throws(()=>parseStoredZip(good.subarray(0,good.length-2)));
});
