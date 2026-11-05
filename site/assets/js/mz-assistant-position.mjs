/** Pure viewport math: independently testable, no DOM, network or stored messages. */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function iconPosition(left,top,viewport){
  const width=Number(viewport.width),height=Number(viewport.height);
  const iconWidth=Number(viewport.iconWidth||74),iconHeight=Number(viewport.iconHeight||74);
  const margin=Number(viewport.margin??10);
  const dock=Number(viewport.dock??0);
  if(![width,height,iconWidth,iconHeight,margin,dock,left,top].every(Number.isFinite)
    ||width<iconWidth+2*margin||height<iconHeight+2*margin)return null;
  const maxX=Math.max(margin,width-iconWidth-margin);
  const maxY=Math.max(margin,height-iconHeight-margin-dock);
  return {x:clamp(left,margin,maxX),y:clamp(top,margin,maxY)};
}
export function storedIconPoint(settings,viewport){
  if(!settings||typeof settings!=='object'||!Number.isFinite(settings.x)||!Number.isFinite(settings.y)
    ||settings.x<0||settings.x>1||settings.y<0||settings.y>1)return null;
  return iconPosition(settings.x*(viewport.width-viewport.iconWidth),
    settings.y*(viewport.height-viewport.iconHeight),viewport);
}
export function floatingWindowPoint(icon,panel,viewport){
  const margin=10,spacing=10;
  const width=Math.max(0,viewport.width-panel.width-2*margin);
  const left=clamp(icon.right-panel.width,margin,margin+width);
  const above=icon.top-panel.height-spacing;
  const below=icon.bottom+spacing;
  const candidate=above>=margin?above:
    below+panel.height<=viewport.height-margin?below:
      margin;
  return {x:left,y:clamp(candidate,margin,Math.max(margin,viewport.height-panel.height-margin))};
}
