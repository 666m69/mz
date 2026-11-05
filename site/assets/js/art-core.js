import {setArabicCanvasText} from './arabic-canvas.js';
import qrcode from '../vendor/qrcode.js';
qrcode.stringToBytes=s=>Array.from(new TextEncoder().encode(s));
export function safeURL(value){if(!value.trim())return '';const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||value.length>700)throw Error('أدخل رابط http أو https صالحاً، حتى 700 حرف ودون بيانات دخول.');return u.href}
export function qrMatrix(value){const qr=qrcode(0,'M');qr.addData(value);qr.make();return qr}
export function drawQR(ctx,value,x,y,size){const qr=qrMatrix(value),count=qr.getModuleCount(),cell=Math.floor(size/(count+8)),extent=cell*(count+8);ctx.fillStyle='#fff';ctx.fillRect(x,y,extent,extent);ctx.fillStyle='#000';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect(x+(c+4)*cell,y+(r+4)*cell,cell,cell);return extent}
export function cover(ctx,image,x,y,w,h){const scale=Math.max(w/image.width,h/image.height),sw=w/scale,sh=h/scale;ctx.drawImage(image,(image.width-sw)/2,(image.height-sh)/2,sw,sh,x,y,w,h)}
export function canvasText(ctx,value,x,y,width,size=40,color='#fff',maxLines=4){setArabicCanvasText(ctx,size);ctx.fillStyle=color;const lines=[];let line='';for(const word of String(value).split(/\s+/)){if(ctx.measureText(line+(line?' ':'')+word).width>width&&line){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);lines.slice(0,maxLines).forEach((s,i)=>{if(i===maxLines-1&&lines.length>maxLines)s+='…';ctx.fillText(s,x,y+i*size*1.5,width)});return Math.min(lines.length,maxLines)*size*1.5}
