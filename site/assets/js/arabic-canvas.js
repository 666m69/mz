export const ARABIC_FONT='system-ui, "Noto Sans Arabic", "Noto Naskh Arabic", Tahoma, Arial, sans-serif';
export function setArabicCanvasText(ctx,size){
  ctx.font=size+'px '+ARABIC_FONT;
  ctx.direction='rtl';
  ctx.textAlign='right';
}
export async function readyForArabicExport(){
  if(document.fonts?.ready)await document.fonts.ready;
}
