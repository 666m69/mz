// ZIP STORE, limited to the four verified UTF-8 project files. No dependencies or execution.
import {artifactNames} from './catalog.mjs';
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
export function zipFiles(files){
  const enc=new TextEncoder(),local=[],central=[];let pos=0,centralSize=0;
  for(const k of artifactNames){
    const name=enc.encode(k),data=enc.encode(files[k]),crc=crc32(data);
    const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,33,true);
    h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
    const entry=new Uint8Array(46+name.length),v=new DataView(entry.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);entry.set(header.subarray(4,28),6);
    v.setUint32(42,pos,true);entry.set(name,46);
    local.push(header,data);central.push(entry);pos+=header.length+data.length;centralSize+=entry.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);
  v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,pos,true);
  const out=new Uint8Array(pos+centralSize+22);let offset=0;
  for(const part of [...local,...central,end]){out.set(part,offset);offset+=part.length;}return out;
}
