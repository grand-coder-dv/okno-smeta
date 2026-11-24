// Чертёж: контуры, дуги, скосы и точки профиля.
function shapePaths(x, y, width, height, frame) {
  if (state.shape === "circle") {
    return {
      outer: `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" />`,
      inner: `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${Math.max(width / 2 - frame, 2)}" ry="${Math.max(height / 2 - frame, 2)}" />`,
      innerBox: { x: x + frame, y: y + frame, width: width - frame * 2, height: height - frame * 2 },
    };
  }


  return {
    outer: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" />`,
    inner: `<rect x="${x + frame}" y="${y + frame}" width="${width - frame * 2}" height="${height - frame * 2}" rx="2" />`,
    innerBox: { x: x + frame, y: y + frame, width: width - frame * 2, height: height - frame * 2 },
  };
}

function openingSymbol(type, x, y, width, height, side) {
  const pad = Math.min(11, width * 0.08, height * 0.08);
  const left = x + pad;
  const right = x + width - pad;
  const top = y + pad;
  const bottom = y + height - pad;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const stroke = "#4d7085";
  let paths = "";

  const mirrored = side === "right" && ["turn", "tiltturn"].includes(type);
  const hinge = mirrored ? right : left, free = mirrored ? left : right;
  const handle = mirrored ? left + 4 : right - 4;
  if (type === "turn" || type === "tiltturn") {
    paths += `<path d="M ${hinge} ${top} L ${free} ${cy} L ${hinge} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type === "tilt" || type === "tiltturn") {
    paths += `<path d="M ${left} ${bottom} L ${cx} ${top} L ${right} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type !== "fixed") {
    paths += `<line x1="${handle}" y1="${cy - 10}" x2="${handle}" y2="${cy + 10}" stroke="#20384c" stroke-width="3" stroke-linecap="round" />`;
  }
  return paths;
}

function sharedImpostLimits(group, orientation) {
  const v = orientation === "vertical";
  const entries = sectionLayout();
  const members = group.flatMap(({id,index}) => {
    const entry = entries[index];
    const item = index == null ? (v ? state.vImposts : state.hImposts).find(i => i.id === id)
      : entry?.pane.innerImposts.find(i => i.id === id);
    if (!item) return [];
    const start = entry ? (v ? entry.rect.x : entry.rect.y) : 0;
    const size = entry ? (v ? entry.rect.width : entry.rect.height) : 1;
    const limits = entry ? nestedImpostLimits(item, entry.pane) : rootImpostLimits(item, orientation);
    return [{item,start,size,min:start+limits.min*size,max:start+limits.max*size}];
  });
  return {members, min:Math.max(...members.map(m=>m.min)), max:Math.min(...members.map(m=>m.max))};
}

function isSelectedImpost(scope, orientation, id, paneIndex = null) {
  const selected = state.selectedImpost;
  return Boolean(selected && selected.scope === scope && selected.orientation === orientation && selected.id === id && (scope === "root" || selected.paneIndex === paneIndex));
}

function polygonPoints() {
  if(state.shape!=="skew")return;
  if(state.framePolygon?.length>=3) return state.framePolygon.map(([x,y])=>[x*state.width,y*state.height]);
  return rectPoints([0,0,state.width,state.height]);
}
function hasSlantedImposts() {
  if(state.shape!=="skew")return false;
  const nested=panes=>(panes||[]).some(p=>p.innerImposts?.some(i=>i.endOffsets?.some(Boolean)) || nested(p.children));
  return state.vImposts.some(i=>i.endOffsets?.some(Boolean)) || state.hImposts.some(i=>i.endOffsets?.some(Boolean)) || nested(state.panes);
}
function constructionPolygon() {
  return polygonPoints();
}
function clipByImpostLine(points,a,b,sign,inset=0) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<1e-7 || !points.length)return points;
  const result=[];
  points.forEach((p,i)=>{
    const q=points[(i+1)%points.length],v=cross2(a,b,p)*sign-inset*length,w=cross2(a,b,q)*sign-inset*length;
    if(v>=-1e-7)result.push(p);
    if((v>1e-7 && w< -1e-7)||(v< -1e-7 && w>1e-7))result.push(p.map((n,k)=>n+(q[k]-n)*v/(v-w)));
  });
  return result;
}
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function polygonClip(subject, boundary, inset=0) {
  let out=subject;
  boundary.forEach((a,i)=>{
    const b=boundary[(i+1)%boundary.length], gap=inset*Math.hypot(b[0]-a[0],b[1]-a[1]);
    const distance=p=>cross2(a,b,p)-gap;
    const input=out; out=[];
    input.forEach((p,j)=>{
      const q=input[(j+1)%input.length], d=distance(p), e=distance(q);
      if(d>=-1e-7) out.push(p);
      if((d>1e-7&&e< -1e-7)||(d< -1e-7&&e>1e-7)) out.push(p.map((v,k)=>v+(q[k]-v)*d/(d-e)));
    });
  });
  return out;
}
function rectPoints([l,t,r,b]) { return [[l,t],[r,t],[r,b],[l,b]]; }
function polyPath(points,X,Y) { return points.length>=3 ? `M ${points.map(([x,y])=>`${X(x)} ${Y(y)}`).join(' L ')} Z` : ""; }
function polyBounds(p) { return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]; }
function clipSlantedSections(points,entry,inset=0,withParents=true) {
  if(!points.length || !entry || !constructionPolygon())return points;
  const full={x:0,y:0,width:state.width,height:state.height},outer=constructionPolygon();
  const borders=[
    [state.vImposts[entry.rootCol-1],"vertical",-1,full,true],
    [state.vImposts[entry.rootCol],"vertical",1,full,true],
    [state.hImposts[entry.rootRow-1],"horizontal",1,full,true],
    [state.hImposts[entry.rootRow],"horizontal",-1,full,true],
    ...(withParents?entry.slantParents||[]:[]).map(parent=>[parent.item,parent.orientation,parent.sign,parent.rect,false])
  ];
  let result=points;
  for(const [item,orientation,sign,rect,root] of borders){
    if(!item?.endOffsets?.some(Boolean))continue;
    const [a,b]=impostSegment(item,orientation,rect,outer,root);
    result=clipByImpostLine(result,a,b,sign,inset);
  }
  return result;
}
function slantedBounds(bounds,entry,field=null) {
  if(!entry || !constructionPolygon())return bounds;
  let [l,t,r,b]=bounds;
  const tech=getTechnology(),margin=tech.frame+tech.sash+tech.impost;
  const extent=item=>item?.endOffsets?.some(Boolean) ? margin+Math.max(...item.endOffsets.map(Math.abs)) : 0;
  const vertical=entry.pane.innerImposts.filter(i=>i.orientation==="vertical").length;
  const horizontal=entry.pane.innerImposts.filter(i=>i.orientation==="horizontal").length;
  l-=field && field.col!==0?0:extent(state.vImposts[entry.rootCol-1]);
  t-=field && field.row!==0?0:extent(state.hImposts[entry.rootRow-1]);
  r+=field && field.col!==vertical?0:extent(state.vImposts[entry.rootCol]);
  b+=field && field.row!==horizontal?0:extent(state.hImposts[entry.rootRow]);
  for(const parent of entry.slantParents||[]){
    const e=extent(parent.item);
    if(!e)continue;
    if(parent.orientation==="vertical"){ if(parent.sign>0) r+=e; else l-=e; }
    else { if(parent.sign<0) b+=e; else t-=e; }
  }
  return [l,t,r,b];
}
function sectionContour(entry,poly=constructionPolygon(),frameInset=0) {
  if(!poly)return null;
  const {rect,edges}=entry, limits=polyBounds(poly);
  const bounds=[edges[0]?Math.min(rect.x,limits[0]):rect.x,
    edges[2]?Math.min(rect.y,limits[1]):rect.y,
    edges[1]?Math.max(rect.x+rect.width,limits[2]):rect.x+rect.width,
    edges[3]?Math.max(rect.y+rect.height,limits[3]):rect.y+rect.height];
  const insetPoly=frameInset ? polygonClip(poly,poly,frameInset) : poly;
  return clipSlantedSections(polygonClip(insetPoly,rectPoints(slantedBounds(bounds,entry))),entry);
}
function polygonGlass(poly, geometry, f, tech, entry) {
  const bite=tech.bite[geometry.sashBox?"створка":"рама"];
  const depth=tech.frame+(geometry.sashBox?tech.sash-SASH_LAP:0)-bite;
  const vertical=entry.pane.innerImposts.filter(v=>v.orientation==="vertical").sort((a,b)=>a.position-b.position);
  const horizontal=entry.pane.innerImposts.filter(v=>v.orientation==="horizontal").sort((a,b)=>a.position-b.position);
  const adjacent=[vertical[f.col-1],vertical[f.col],horizontal[f.row-1],horizontal[f.row]];
  const stretch=item=>Math.max(0,...(item?.endOffsets||[]).map(Math.abs));
  let [l,t,r,b]=slantedBounds([f.x,f.y,f.x+f.w,f.y+f.h],entry,f);
  l-=stretch(adjacent[0]);r+=stretch(adjacent[1]);t-=stretch(adjacent[2]);b+=stretch(adjacent[3]);
  const rootGlassInset=geometry.sashBox
    ? tech.impost/2+tech.sash-SASH_LAP-tech.bite["створка"]
    : tech.impost/2-tech.bite["импост"];
  let result=clipSlantedSections(polygonClip(rectPoints([l,t,r,b]),poly,depth),entry,rootGlassInset,false);
  const frame=sectionContour(entry,poly,tech.frame);
  const faceInset=tech.impost/2-tech.bite["импост"];
  const cuts=[
    [adjacent[0],"vertical",-1,entry.rect,false],
    [adjacent[1],"vertical",1,entry.rect,false],
    [adjacent[2],"horizontal",1,entry.rect,false],
    [adjacent[3],"horizontal",-1,entry.rect,false],
    ...(entry.slantParents||[]).map(parent=>[parent.item,parent.orientation,parent.sign,parent.rect,false])
  ];
  for(const [item,orientation,sign,rect] of cuts){
    if(!item?.endOffsets?.some(Boolean))continue;
    const [a,b]=impostSegment(item,orientation,rect,frame||poly);
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<1e-7)continue;
    result=clipByImpostLine(result,a,b,sign,faceInset);
  }
  return result;
}
function outlineRange(points, axis, at) {
  const values=[];
  points.forEach((p,i)=>{
    const q=points[(i+1)%points.length], a=p[axis], b=q[axis];
    if(Math.abs(a-b)<1e-8){if(Math.abs(at-a)<1e-6) values.push(p[1-axis],q[1-axis]);return;}
    if(at>=Math.min(a,b)-1e-7 && at<=Math.max(a,b)+1e-7) values.push(p[1-axis]+(q[1-axis]-p[1-axis])*(at-a)/(b-a));
  });
  return values.length?[Math.min(...values),Math.max(...values)]:null;
}
function impostSegment(item, orientation, rect, outer = constructionPolygon(), root = false) {
  const vertical=orientation === "vertical";
  const base=root ? item.position : (vertical ? rect.x+rect.width*item.position : rect.y+rect.height*item.position);
  const offsets=item.endOffsets || [0,0];
  const from=base+(offsets[0]||0), to=base+(offsets[1]||0);
  const lower=vertical ? rect.x : rect.y, upper=lower+(vertical ? rect.width : rect.height);
  const a=clamp(from,lower,upper), b=clamp(to,lower,upper);
  if (!outer) return vertical ? [[a,rect.y],[b,rect.y+rect.height]] : [[rect.x,a],[rect.x+rect.width,b]];
  const first=outlineRange(outer,vertical ? 0 : 1,a);
  const last=outlineRange(outer,vertical ? 0 : 1,b);
  const segment=vertical
    ? [[a,first ? first[0] : rect.y],[b,last ? last[1] : rect.y+rect.height]]
    : [[first ? first[0] : rect.x,a],[last ? last[1] : rect.x+rect.width,b]];
  if(item.endAnchors) for(let end=0;end<2;end++) {
    const choices=root ? (vertical ? state.hImposts : state.vImposts)
      : sectionPanes().find(p=>p.innerImposts?.includes(item))?.innerImposts || [];
    const other=choices.find(candidate=>candidate.id===item.endAnchors[end] && candidate.orientation!==orientation);
    if(!other || other.endAnchors?.some(Boolean))continue;
    const line=impostSegment(other,vertical ? "horizontal" : "vertical",rect,outer,root);
    const p=segment[0],q=segment[1],u=line[0],v=line[1];
    const dx=q[0]-p[0],dy=q[1]-p[1],ex=v[0]-u[0],ey=v[1]-u[1];
    const determinant=dx*ey-dy*ex;
    if(Math.abs(determinant)<1e-8)continue;
    const t=((u[0]-p[0])*ey-(u[1]-p[1])*ex)/determinant;
    const length=Math.hypot(dx,dy);
    if(length<1e-7)continue;
    const half=getTechnology().impost/2;
    const tFace=t+(half/length)*(end===0?1:-1);
    if(tFace>=0 && tFace<=1)segment[end]=[p[0]+tFace*dx,p[1]+tFace*dy];
  }
  return segment;
}
function impostRibbon(item, orientation, rect, boundary, face, root = false, outer = constructionPolygon()) {
  const [a,b]=impostSegment(item,orientation,rect,outer,root);
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<1e-7 || !boundary?.length)return [];
  const ux=dx/length,uy=dy/length,nx=-uy*face/2,ny=ux*face/2;
  const extra=Math.max(face,getTechnology().frame)*2;
  const p=[a[0]-ux*extra,a[1]-uy*extra],q=[b[0]+ux*extra,b[1]+uy*extra];
  let ribbon=[[p[0]+nx,p[1]+ny],[p[0]-nx,p[1]-ny],
    [q[0]-nx,q[1]-ny],[q[0]+nx,q[1]+ny]];
  ribbon=polygonClip(ribbon,boundary);
  if(item.endAnchors?.some(Boolean)){
    const choices=root ? (orientation==="vertical"?state.hImposts:state.vImposts)
      : sectionPanes().find(pane=>pane.innerImposts?.includes(item))?.innerImposts||[];
    const half=face/2;
    for(let end=0;end<2;end++){
      const target=choices.find(candidate=>candidate.id===item.endAnchors[end] && candidate.orientation!==orientation);
      if(!target)continue;
      const [u,v]=impostSegment(target,target.orientation,rect,outer,root);
      const targetLength=Math.hypot(v[0]-u[0],v[1]-u[1]);
      if(targetLength<1e-7)continue;
      const midpoint=end===0?b:a;
      const sign=cross2(u,v,midpoint)>=0?1:-1;
      const threshold=half*targetLength;
      const input=ribbon;ribbon=[];
      input.forEach((point,i)=>{
        const next=input[(i+1)%input.length],d=cross2(u,v,point)*sign,e=cross2(u,v,next)*sign;
        if(d>=threshold-1e-7)ribbon.push(point);
        if((d>threshold+1e-7&&e<threshold-1e-7)||(d<threshold-1e-7&&e>threshold+1e-7))
          ribbon.push(point.map((n,k)=>n+(next[k]-n)*(d-threshold)/(d-e)));
      });
    }
  }
  return ribbon;
}
function handleGlyph(x, y, inward, handle) {
  const fill = /^#[0-9a-fA-F]{6}$/.test(handle?.color || "") ? handle.color : "#20384c";
  const style = HANDLE_STYLES[handle?.style] ? handle.style : "bar";
  const edge = "#1d3344";
  const stroke = (d, width) => `<path d="${d}" fill="none" stroke="${edge}" stroke-width="${width + 1.3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (style === "knob") return `<circle cx="${x}" cy="${y}" r="5.6" fill="${edge}"/><circle cx="${x}" cy="${y}" r="4.2" fill="${fill}"/>`;
  if (style === "lever") return stroke(`M ${x} ${y - 9} L ${x} ${y + 1} L ${x + inward * 13} ${y + 7}`, 2.5);
  if (style === "offset") return stroke(`M ${x} ${y - 10} L ${x} ${y + 10} M ${x} ${y - 2} L ${x + inward * 12} ${y - 2}`, 2.6);
  if (style === "lock") {
    return `${stroke(`M ${x} ${y - 12} L ${x} ${y + 12}`, 2.6)}<rect x="${x - 4}" y="${y - 2.4}" width="8" height="6.2" rx="1.1" fill="${edge}"/><rect x="${x - 2.9}" y="${y - 1.4}" width="5.8" height="4.2" rx="0.7" fill="${fill}"/>`;
  }
  if (style === "long") return stroke(`M ${x} ${y - 16} L ${x} ${y + 16}`, 3);
  return stroke(`M ${x} ${y - 10} L ${x} ${y + 10}`, 3);
}

function handlePreviewMarkup(style, color) {
  return `<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true">${handleGlyph(22, 18, -1, { style, color })}</svg>`;
}

function sashOpeningMark(glass, outer, inner, type, side, X, Y) {
  if(glass.length<3 || type==="fixed")return {dashes:"",handle:""};
  const [l,t,r,b]=polyBounds(glass);
  const ym=(t+b)/2, xmid=(l+r)/2;
  const yRow=(edge,fallback)=>{
    const range=outlineRange(glass,1,edge);
    const y=range && range[1]-range[0]>(r-l)*.12?edge:fallback;
    return [y,outlineRange(glass,1,y)];
  };
  const [top,upper]=yRow(t,t+(b-t)*.12), [bottom,lower]=yRow(b,b-(b-t)*.12);
  const mid=outlineRange(glass,1,ym), summit=outlineRange(glass,0,xmid);
  const hingesRight=side==="right" && (type==="turn"||type==="tiltturn");
  const hinge=hingesRight?1:0, free=1-hinge;
  const pt=(x,y)=>`${X(x)} ${Y(y)}`;
  const line=points=>`<path d="M ${points.join(' L ')}" fill="none" stroke="#4d7085" stroke-width="1.7" stroke-dasharray="5 4"/>`;
  let dashes="";
  if((type==="turn"||type==="tiltturn")&&upper&&lower&&mid) dashes+=line([pt(upper[hinge],top),pt(mid[free],ym),pt(lower[hinge],bottom)]);
  if((type==="tilt"||type==="tiltturn")&&summit) {
    const topHinges = type === "tilt" && side === "top";
    const hingeRange = topHinges ? upper : lower;
    if (hingeRange) dashes+=line([pt(hingeRange[0],topHinges?top:bottom),pt(xmid,summit[topHinges?1:0]),pt(hingeRange[1],topHinges?top:bottom)]);
  }
  const outerAt = outlineRange(outer, 1, ym);
  const innerAt = outlineRange(inner, 1, ym);
  const handle = outerAt && innerAt
    ? handleGlyph(X((outerAt[free] + innerAt[free]) / 2), Y(ym), free === 1 ? -1 : 1, selectedHandle())
    : "";
  return {dashes, handle};
}
function editImpostEndpoint() {
  if(state.shape!=="skew")return;
  const selection=activeImpostEndpoint;
  if(!selection || selection.owner!==state)return;
  const vertical=selection.orientation==="vertical";
  const nested=selection.scope==="pane";
  const pane=nested ? sectionPanes()[selection.paneIndex] : null;
  const rect=nested ? getPanePhysicalRect(selection.paneIndex) : null;
  const item=(nested ? pane?.innerImposts : vertical ? state.vImposts : state.hImposts)?.find(v=>v.id===selection.id);
  if(!item)return;
  const base=nested ? item.position*(vertical ? rect.width : rect.height) : item.position;
  const others=(nested ? pane.innerImposts.filter(v=>v.orientation!==selection.orientation)
    : vertical ? state.hImposts : state.vImposts).filter(v=>!v.endAnchors?.some(Boolean));
  const dialog=document.createElement("dialog");
  dialog.innerHTML=`<form method="dialog" class="control-group" style="display:grid;gap:12px;padding:18px;min-width:min(340px,85vw)">
    <strong>Размеры обоих концов импоста</strong>
    ${[0,1].map(end=>`<fieldset style="border:1px solid #d8e0e9;border-radius:10px;padding:10px;display:grid;gap:8px">
      <legend>${vertical ? end ? "Нижний" : "Верхний" : end ? "Правый" : "Левый"} конец</legend>
      <label class="field">${vertical?"X от левого края":"Y от верхнего края"}, мм
        <input name="coordinate${end}" type="number" step="1" min="0" max="${nested ? vertical ? rect.width : rect.height : vertical?state.width:state.height}" value="${Math.round(base+(item.endOffsets?.[end]||0))}" required></label>
      <label class="field">Примыкание<select name="anchor${end}"><option value="">К внутреннему краю рамы</option>
        ${others.map((v,i)=>`<option value="${escapeHtml(v.id)}" ${item.endAnchors?.[end]===v.id?"selected":""}>К ${vertical?"горизонтальному":"вертикальному"} импосту ${i+1}</option>`).join("")}
      </select></label></fieldset>`).join("")}
    <div style="display:flex;gap:8px"><button class="button ghost" value="cancel">Отмена</button><button class="button primary" value="save">Применить</button></div></form>`;
  document.body.append(dialog);
  dialog.addEventListener("close",()=>{
    if(dialog.returnValue==="save"){
      const form=dialog.querySelector("form"),values=[0,1].map(end=>Number(form.elements[`coordinate${end}`].value));
      const raw=nested ? nestedImpostLimits(item,pane) : rootImpostLimits(item,selection.orientation);
      const size=nested ? vertical ? rect.width : rect.height : 1;
      const limits=nested ? {min:raw.min*size,max:raw.max*size} : raw;
      if(values.every(value=>Number.isFinite(value) && value>=limits.min && value<=limits.max)){
        item.endOffsets=values.map(value=>value-base);
        item.endAnchors=values.map((_,end)=>form.elements[`anchor${end}`].value||null);
        renderAll();
      } else showToast(`Координата должна быть от ${Math.ceil(limits.min)} до ${Math.floor(limits.max)} мм.`);
    }
    dialog.remove();
  });
  dialog.showModal();
}
function refreshProfileEdit() {
  let button=$("#editProfileGeometry");
  const host=$("#editorHistory");
  if(!button){
    button=document.createElement("button"); button.id="editProfileGeometry"; button.type="button";button.className="button ghost";
    button.innerHTML='<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l4-1 12-12-3-3L5 16zM14 7l3 3"/></svg> Изменить';
    button.addEventListener("click",()=>{
      if(activeImpostEndpoint?.owner===state){editImpostEndpoint();return;}
      const a=activeProfileEdge;if(!a||a.owner!==state)return;
      if(a.type==="vertex"||a.type==="polygon") editPolygon(a);
      else editProfileSide({dataset:{profileEdge:a.type,edgeIndex:a.index,edgeSide:a.side}});
    });
    if(host) host.append(button);
    else {const row=document.createElement("div");row.style.cssText="display:flex;margin:0 0 8px";row.append(button);$("#canvasWrap").before(row);}
  }
  if(host && button.parentElement!==host) host.append(button);
  button.hidden=state.shape!=="arch" && state.shape!=="skew";
  button.style.display=button.hidden?"none":"";
  button.disabled=button.hidden || !(activeImpostEndpoint?.owner===state || activeProfileEdge?.owner===state && activeProfileEdge.type!=="skew-sash");
  button.style.color=button.disabled?"#68778a":"white";button.style.background=button.disabled?"#edf1f5":"#24384f";
}
function editPolygon(selection) {
  if(state.shape!=="skew")return;
  const points=polygonPoints()||rectPoints([0,0,state.width,state.height]);
  const i=selection.side, vertex=selection.type==="vertex", lengthMode=selection.type==="length";
  if(!points[i])return;
  const next=(i+1)%points.length;
  const originalLength=Math.hypot(points[next][0]-points[i][0],points[next][1]-points[i][1]);
  let dialog=$("#polygonEditDialog");
  if(!dialog){dialog=document.createElement("dialog");dialog.id="polygonEditDialog";document.body.append(dialog);}
  dialog.innerHTML=`<form method="dialog" class="control-group" style="display:grid;gap:12px;padding:16px;min-width:min(290px,80vw)">
    <strong>${lengthMode?"Изменить длину стороны":vertex?"Изменить угол рамы":"Изменить сторону рамы"}</strong>
    ${lengthMode?`<label class="field">Длина между углами, мм<input type="number" name="edgeLength" min="5" step="any" required value="${Math.round(originalLength)}"></label>`:vertex?`<label class="field">X от левого края, мм<input type="number" name="x" step="any" required value="${Number(points[i][0].toFixed(3))}"></label>
    <label class="field">Y от нижнего края, мм<input type="number" name="y" step="any" required value="${Number((state.height-points[i][1]).toFixed(3))}"></label>`:"<p>Разбивка добавит новую вершину посередине стороны. Затем её можно переместить.</p>"}
    <span data-poly-error role="alert"></span><div style="display:flex;flex-wrap:wrap;gap:8px">
    <button class="button ghost" type="submit" value="cancel" formnovalidate>Отмена</button>
    ${lengthMode?`<button class="button primary" type="submit" value="length">Применить</button>`:vertex?`<button class="button ghost" type="submit" value="remove" ${points.length<=3?"disabled":""}>Удалить вершину</button><button class="button primary" type="submit" value="move">Применить</button>`:
      '<button class="button primary" type="submit" value="split">Разбить сторону</button>'}
    </div></form>`;
  dialog.querySelector("form").onsubmit=event=>{
    const op=event.submitter?.value;if(op==="cancel")return;
    let picked=i;
    if(op==="remove"){if(points.length<=3)return;points.splice(i,1);picked=Math.min(i,points.length-1);}
    if(op==="split"){const p=points[i],q=points[(i+1)%points.length];points.splice(i+1,0,[(p[0]+q[0])/2,(p[1]+q[1])/2]);picked=i+1;}
    if(op==="move"){
      const f=event.currentTarget.elements; points[i]=[f.x.valueAsNumber,state.height-f.y.valueAsNumber];
    }
    if(op==="length"){
      const value=event.currentTarget.elements.namedItem("edgeLength").valueAsNumber;
      if(!Number.isFinite(value)||value<5||originalLength<=0){event.preventDefault();return;}
      const p=points[i],q=points[next];
      points[next]=p.map((v,k)=>v+(q[k]-v)*value/originalLength);picked=next;
    }
    const good=points.every((p,k)=>p.every(Number.isFinite)&&Math.hypot(p[0]-points[(k+1)%points.length][0],p[1]-points[(k+1)%points.length][1])>=5&&points.every(q=>cross2(p,points[(k+1)%points.length],q)>=-1e-5));
    if(!good || polygonClip(points,points,getTechnology().frame).length<3){event.preventDefault();dialog.querySelector('[data-poly-error]').textContent="Оставьте замкнутый выпуклый контур без пересечений и с местом для профиля.";return;}
    state.framePolygon=points.map(([x,y])=>[x/state.width,y/state.height]);
    activeProfileEdge={owner:state,type:"vertex",index:null,side:picked};renderAll();
  };
  dialog.showModal();
}

const PROFILE_SIDES = ["верхняя поперечина", "правая стойка", "нижняя поперечина", "левая стойка"];
let activeProfileEdge = null;
let activeImpostEndpoint = null;
function customProfileArcs() {
  return Boolean((state.shape === "arch" && (Object.values(state.frameArcs || {}).some(Boolean) ||
    sectionPanes().some(p => !p.split && p.opening !== "fixed" && Object.values(p.sashArcs || {}).some(Boolean)))));
}
function arcBoundaryPoints(p,q,radius,sweep) {
  const dx=q[0]-p[0],dy=q[1]-p[1],chord=Math.hypot(dx,dy);
  if(!chord)return [p];
  const R=Math.max(chord/2,radius), half=chord/2;
  const span=Math.asin(half/R), inset=Math.sqrt(Math.max(0,R*R-half*half));
  const side=sweep?1:-1;
  return Array.from({length:64},(_,i)=>{
    const a=span*(2*i/64-1), tangent=half+R*Math.sin(a), sag=side*(R*Math.cos(a)-inset);
    return [p[0]+(dx*tangent+dy*sag)/chord,p[1]+(dy*tangent-dx*sag)/chord];
  });
}
function profileOutline(bounds, arcs, X, Y, sx, sy) {
  const [l,t,r,b] = bounds;
  const pts = [[l,t],[r,t],[r,b],[l,b]];
  const point = ([x,y]) => `${X(x)} ${Y(y)}`;
  const boundary=[];
  const edges = pts.map((p,i) => {
    const q=pts[(i+1)%4], chord=Math.hypot(q[0]-p[0],q[1]-p[1]);
    const a=arcs?.[i];
    const angle=Math.atan2(q[1]-p[1],q[0]-p[0]);
    if (!a || !Number.isFinite(a.radius) || !chord) {
      boundary.push(p);
      return {cmd:`L ${point(q)}`, reverse:`L ${point(p)}`, startAngle:angle,endAngle:angle};
    }
    const radius=Math.max(chord/2,a.radius), sweep=a.direction === 'in' ? 0 : 1;
    boundary.push(...arcBoundaryPoints(p,q,radius,sweep));
    const shift=Math.asin(chord/(2*radius))*(sweep?1:-1);
    return {cmd:`A ${radius*sx} ${radius*sy} 0 0 ${sweep} ${point(q)}`,
      reverse:`A ${radius*sx} ${radius*sy} 0 0 ${1-sweep} ${point(p)}`,
      startAngle:angle-shift,endAngle:angle+shift};
  });
  return {path:`M ${point(pts[0])} ${edges.map(e=>e.cmd).join(' ')} Z`, edges, pts,boundary,
    screen:pts.map(([x,y])=>[X(x),Y(y)])};
}
function arcRise(chord,radius) {
  const half=chord/2;
  const R=Math.max(half,radius);
  return half*half/(R+Math.sqrt(Math.max(0,R*R-half*half)));
}
function windowOuterBounds(config = state) {
  const mode=inferredShapeMode(config);
  if(mode === "skew" && config.framePolygon?.length) {
    return polyBounds(config.framePolygon.map(([x,y])=>[x*config.width,y*config.height]));
  }
  const rise=(side,span)=> {
    const arc=mode === "arch" && config.frameArcs?.[side];
    return arc && arc.direction !== "in" ? arcRise(span,arc.radius) : 0;
  };
  return [-rise(3,config.height),-rise(0,config.width),
    config.width+rise(1,config.height),config.height+rise(2,config.width)];
}
function overallSize(config = state) {
  const [l,t,r,b]=windowOuterBounds(config);
  return {width:r-l,height:b-t};
}
function overallSizeLabel(config = state) {
  const {width,height}=overallSize(config);
  const mm=value=>numberFormatter.format(Math.round(value));
  return config.shape==="circle" ? `Ø ${mm(width)} мм` : `${mm(width)} × ${mm(height)} мм`;
}
function syncOverallInputs(force=false) {
  const size=overallSize();
  for(const key of ["width","height"]){
    const input=$("#"+key);
    const baseMin=400, baseMax=key==="width"?5000:4000;
    input.min=String(Math.round(overallSize({...state,[key]:baseMin})[key]));
    input.max=String(Math.round(overallSize({...state,[key]:baseMax})[key]));
    if(force || document.activeElement!==input) input.value=String(Math.round(size[key]));
  }
}
function commitOverallDimension(key,input) {
  const desired=input.valueAsNumber;
  if(!Number.isFinite(desired)){syncOverallInputs(true);return;}
  const lo=400,hi=key==="width"?5000:4000;
  const min=overallSize({...state,[key]:lo})[key],max=overallSize({...state,[key]:hi})[key];
  if(max>min && Math.round(overallSize()[key])!==desired){
    const base=lo+(clamp(desired,min,max)-min)*(hi-lo)/(max-min);
    state[key]=Math.round(base*1000)/1000;
    if(state.shape==="circle")state.height=state.width;
  }
  syncOverallInputs(true);
  renderAll();
}
function closedArea(points) {
  return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
}
function customFrameMeasures() {
  const poly=polygonPoints();
  if(poly) return {area:closedArea(poly)/1e6,
    perimeter:poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+Math.hypot(q[0]-p[0],q[1]-p[1]);},0)/1000};
  if(state.shape!=="arch" || !Object.values(state.frameArcs||{}).some(Boolean))return null;
  let area=state.width*state.height, perimeter=2*(state.width+state.height);
  for(const [i,arc] of Object.entries(state.frameArcs||{})){
    if(!arc || !Number.isFinite(arc.radius))continue;
    const chord=Number(i)%2?state.height:state.width, radius=Math.max(chord/2,arc.radius);
    const angle=2*Math.asin(chord/(2*radius));
    area+=(arc.direction==="in"?-1:1)*radius*radius*(angle-Math.sin(angle))/2;
    perimeter+=radius*angle-chord;
  }
  return {area:Math.max(0,area)/1e6,perimeter:perimeter/1000};
}
function frameCurve(side, offset) {
  const arc = state.shape === "arch" && state.frameArcs?.[side];
  if (!arc || !Number.isFinite(arc.radius)) return null;
  const vertical = side % 2 === 1;
  const span = vertical ? state.height : state.width;
  const base = [0,state.width,state.height,0][side];
  const outward = side === 0 || side === 3 ? -1 : 1;
  const sign = outward * (arc.direction === "in" ? -1 : 1);
  const radius = Math.max(span/2, arc.radius);
  const center = base - sign*Math.sqrt(Math.max(0,radius*radius-span*span/4));
  const signedRadius = radius - sign*outward*offset;
  if (signedRadius <= 0) return null;
  return t => center + sign*Math.sqrt(Math.max(0,signedRadius*signedRadius-(t-span/2)**2));
}
function fittedOutline(bounds, offsets, arcs, X, Y, sx, sy) {
  const curves=offsets.map((offset,i)=>offset==null || arcs?.[i] ? null : frameCurve(i,offset));
  if(!curves.some(Boolean)) return profileOutline(bounds,arcs,X,Y,sx,sy);
  const [l,t,r,b]=bounds;
  const fn=curves.map((f,i)=>f || (()=>[t,r,b,l][i]));
  const pts=[[l,t],[r,t],[r,b],[l,b]].map(([x,y],i)=>{
    const h=i<2?0:2, v=i===0||i===3?3:1;
    for(let j=0;j<32;j++){ const xx=fn[v](y), yy=fn[h](xx); if(Math.abs(x-xx)+Math.abs(y-yy)<1e-6){x=xx;y=yy;break;} x=(x+xx)/2;y=(y+yy)/2; }
    return [x,y];
  });
  const screen=pts.map(([x,y])=>[X(x),Y(y)]);
  const toScreen=([x,y])=>`${X(x)} ${Y(y)}`;
  const extrema=[...pts], boundary=[];
  const edges=pts.map((p,i)=>{
    const q=pts[(i+1)%4], vertical=i%2===1, k=Number(vertical), curve=curves[i];
    if (!curve && arcs?.[i]) {
      const dx=q[0]-p[0],dy=q[1]-p[1],chord=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
      const R=Math.max(chord/2,arcs[i].radius), sweep=arcs[i].direction==='in'?0:1;
      const d=Math.asin(chord/(2*R))*(sweep?1:-1);
      const sample=arcBoundaryPoints(p,q,R,sweep); boundary.push(...sample);extrema.push(...sample);
      return {cmd:`A ${R*sx} ${R*sy} 0 0 ${sweep} ${toScreen(q)}`,reverse:`A ${R*sx} ${R*sy} 0 0 ${1-sweep} ${toScreen(p)}`,startAngle:angle-d,endAngle:angle+d};
    }
    const pieces=[p];
    if(curve){
      const positions=Array.from({length:63},(_,j)=>p[k]+(q[k]-p[k])*(j+1)/64);
      const middle=(vertical?state.height:state.width)/2;
      if(middle>Math.min(p[k],q[k]) && middle<Math.max(p[k],q[k])) positions.push(middle);
      positions.sort((a,b)=>(p[k]<q[k]?1:-1)*(a-b));
      for(const u of positions) pieces.push(vertical?[curve(u),u]:[u,curve(u)]);
    }
    extrema.push(...pieces); boundary.push(...pieces);
    pieces.push(q);
    const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0]);
    return {cmd:pieces.slice(1).map(pt=>`L ${toScreen(pt)}`).join(' '),reverse:pieces.slice(0,-1).reverse().map(pt=>`L ${toScreen(pt)}`).join(' '),
      startAngle:angle(p,pieces[1]),endAngle:angle(pieces.at(-2),q)};
  });
  return {pts,screen,edges,extrema,boundary,path:`M ${screen[0].join(' ')} ${edges.map(e=>e.cmd).join(' ')} Z`};
}

function circularOutline(bounds,depth,X,Y) {
  const [l,t,r,b]=bounds, cx=state.width/2, cy=state.height/2, radius=cx-depth;
  const empty={path:"",boundary:[],w:0,h:0,area:0};
  if(radius<=0 || r<=l || b<=t) return empty;
  const ring=Array.from({length:720},(_,i)=>{
    const a=2*Math.PI*i/720;
    return [cx+radius*Math.cos(a),cy+radius*Math.sin(a)];
  });
  const boundary=polygonClip(ring,rectPoints(bounds));
  if(boundary.length<3) return empty;
  const [left,top,right,bottom]=polyBounds(boundary);
  const area=Math.abs(boundary.reduce((sum,p,i)=>{
    const q=boundary[(i+1)%boundary.length];
    return sum+(p[0]-cx)*(q[1]-cy)-(q[0]-cx)*(p[1]-cy);
  },0))/2;
  return area>1e-7 ? {path:polyPath(boundary,X,Y),boundary,w:right-left,h:bottom-top,area} : empty;
}

function fittedGlass(entry,geometry,f,tech,X=mm=>mm,Y=mm=>mm,sx=1,sy=1) {
  const {sashBox,opening}=geometry;
  const bite=tech.bite[sashBox || entry.sashOwner ? "створка" : "рама"];
  const fbox=[f.x,f.y,f.x+f.w,f.y+f.h];
  const contact=[Math.abs(fbox[1]-opening[1]+bite),Math.abs(fbox[2]-opening[2]-bite),
    Math.abs(fbox[3]-opening[3]-bite),Math.abs(fbox[0]-opening[0]+bite)];
  const sides=[entry.edges[2],entry.edges[1],entry.edges[3],entry.edges[0]];
  const depth=tech.frame+(sashBox || entry.sashOwner ? tech.sash-SASH_LAP:0)-bite;
  if(state.shape === "circle") return circularOutline(fbox,depth,X,Y);
  const poly=constructionPolygon();
  if(poly){
    const points=polygonGlass(poly,geometry,f,tech,entry);
    if(points.length<3)return {path:"",w:0,h:0,area:0};
    const [l,t,r,b]=polyBounds(points);
    return {path:polyPath(points,X,Y),boundary:points,w:r-l,h:b-t,area:Math.abs(closedArea(points))};
  }
  const depths=sides.map((touch,i)=>touch&&contact[i]<1e-5?depth:null);
  const sashArcs=(sashBox || entry.sashOwner) && state.shape==="arch" ? (entry.sashOwner?.pane || entry.pane).sashArcs : null;
  const glassArcs=sashArcs && Object.fromEntries(Object.entries(sashArcs).filter(([i])=>contact[i]<1e-5));
  const outline=fittedOutline(fbox,depths,glassArcs,X,Y,sx,sy);
  const points=outline.extrema || outline.boundary || outline.pts;
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const boundary=outline.boundary||outline.pts;
  return {path:outline.path,boundary,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),area:closedArea(boundary)};
}
function polygonProfileTargets(outer,inner,type,index,X,Y) {
  if(outer.length<3 || inner.length<3) return "";
  const label=type==="polygon" ? "Рама" : "Створка";
  const next=i=>(i+1)%outer.length;
  const distances=outer.map(([x,y],i)=>{
    const [u,v]=outer[next(i)], dx=u-x,dy=v-y, length=Math.hypot(dx,dy);
    return ([a,b])=>(dx*(b-y)-dy*(a-x))/length;
  });
  const clip=(points,distance)=>points.flatMap((p,i)=>{
    const q=points[(i+1)%points.length], a=distance(p), b=distance(q);
    const vertices=a>=0?[p]:[];
    if((a<0&&b>0)||(a>0&&b<0))vertices.push(p.map((v,k)=>v+(q[k]-v)*a/(a-b)));
    return vertices;
  });
  const joints=outer.map((p,i)=>{
    const a=outer[(i+outer.length-1)%outer.length].map((v,k)=>v-p[k]);
    const b=outer[next(i)].map((v,k)=>v-p[k]);
    return Math.atan2(Math.abs(a[0]*b[1]-a[1]*b[0]),a[0]*b[0]+a[1]*b[1])*90/Math.PI;
  });
  const active=activeProfileEdge?.owner===state ? activeProfileEdge : null;
  const note=i=>{
    const [a,b]=outer[i], center=outer.reduce(([x,y],[u,v])=>[x+u/outer.length,y+v/outer.length],[0,0]);
    const x=X(a),y=Y(b), dx=X(center[0])-x,dy=Y(center[1])-y,m=Math.hypot(dx,dy)||1;
    const point=j=>{
      const [u,v]=outer[j], ex=X(u)-x,ey=Y(v)-y,len=Math.hypot(ex,ey)||1,d=Math.min(13,len/3);
      return [x+ex/len*d,y+ey/len*d];
    };
    const p=point((i+outer.length-1)%outer.length), q=point(next(i));
    return `<path d="M ${p.join(' ')} Q ${x} ${y} ${q.join(' ')}" fill="none" stroke="#546678" stroke-width="1" pointer-events="none"/><text x="${x+dx/m*21}" y="${y+dy/m*21}" dy=".32em" text-anchor="middle" font-size="10" fill="#20384c" stroke="white" stroke-width="2" paint-order="stroke" pointer-events="none">${formatNumber(joints[i],1)}°</text>`;
  };
  const notes=active?.type===type && active.index===index && outer[active.side]
    ? note(active.side)+note(next(active.side))
    : type==="polygon" && active?.type==="vertex" && outer[active.side] ? note(active.side) : "";
  const bands=outer.map((_,i)=>{
    const distance=distances[i];
    const region=points=>distances.reduce((p,d,j)=>i===j?p:clip(p,v=>d(v)-distance(v)),points);
    const selected=active?.type===type && active.index===index && active.side===i;
    const title=`${label}: сторона ${i+1}. Углы стыка пополам: ${formatNumber(joints[i],1)}° и ${formatNumber(joints[next(i)],1)}°`;
    return `<path d="${polyPath(region(outer),X,Y)} ${polyPath(region(inner),X,Y)}" fill-rule="evenodd" fill="${selected?'#ff9a36':'transparent'}" fill-opacity="${selected?0.42:0}" pointer-events="fill" style="cursor:pointer" data-profile-edge="${type}" data-edge-side="${i}" data-edge-index="${index??''}" tabindex="0" role="button" aria-label="${title}"><title>${title}</title></path>`;
  }).join("");
  const seams=outer.map((p,i)=>{
    const unit=q=>{const x=q[0]-p[0],y=q[1]-p[1],m=Math.hypot(x,y)||1;return [x/m,y/m];};
    const a=unit(outer[(i+outer.length-1)%outer.length]), b=unit(outer[next(i)]);
    if(Math.abs(a[0]*b[1]-a[1]*b[0])<1e-8)return "";
    const dx=a[0]+b[0],dy=a[1]+b[1];
    let t=0,end=Infinity;
    inner.forEach((u,j)=>{
      const v=inner[(j+1)%inner.length], z=cross2(u,v,p), k=(v[0]-u[0])*dy-(v[1]-u[1])*dx;
      if(k>1e-8)t=Math.max(t,-z/k);else if(k< -1e-8)end=Math.min(end,-z/k);else if(z< -1e-8)end=-Infinity;
    });
    return t>1e-8 && t<=end+1e-8 ? `<line x1="${X(p[0])}" y1="${Y(p[1])}" x2="${X(p[0]+t*dx)}" y2="${Y(p[1]+t*dy)}" stroke="#506176" stroke-opacity=".75" stroke-width="1" pointer-events="none"/>` : "";
  }).join("");
  return bands+seams+notes;
}

function profileEdgeTargets(outer, inner, type, index = null) {
  const label=type === 'frame' ? 'Рама' : 'Створка';
  const joints=outer.edges.map((edge,i)=>{
    const previous=outer.edges[(i+3)%4];
    const delta=edge.startAngle-(previous.endAngle+Math.PI);
    return Math.acos(Math.max(-1,Math.min(1,Math.cos(delta))))*90/Math.PI;
  });
  let notes="";
  const bands=outer.edges.map((edge,side) => {
    const next=(side+1)%4;
    const selected=activeProfileEdge?.owner===state && activeProfileEdge.type===type && activeProfileEdge.index===index && activeProfileEdge.side===side;
    const d=`M ${outer.screen[side].join(' ')} ${edge.cmd} L ${inner.screen[next].join(' ')} ${inner.edges[side].reverse} Z`;
    const ends=`Углы стыка пополам: ${formatNumber(joints[side],1)}° и ${formatNumber(joints[next],1)}°`;
    if (selected) for(const i of [side,next]){
      const [x,y]=outer.screen[i], [u,v]=inner.screen[i];
      notes+=`<text x="${(x+u)/2}" y="${(y+v)/2}" dy=".32em" text-anchor="middle" font-size="9"
        fill="#20384c" stroke="white" stroke-width="2" paint-order="stroke" pointer-events="none">${formatNumber(joints[i],1)}°</text>`;
    }
    return `<path d="${d}" fill="${selected?'#ff9a36':'transparent'}" fill-opacity="${selected ? 0.42 : 0}"
      stroke="${selected?'#e97d14':'none'}" stroke-width="${selected?1.4:0}" pointer-events="fill" style="cursor:pointer"
      data-profile-edge="${type}" data-edge-side="${side}" data-edge-index="${index ?? ''}" role="button" tabindex="0"
      aria-label="${label}: ${PROFILE_SIDES[side]}. ${ends}"><title>${label}: ${PROFILE_SIDES[side]}. ${ends}</title></path>`;
  }).join('');
  const seams=outer.screen.map(([x,y],i)=>`<line x1="${x}" y1="${y}" x2="${inner.screen[i][0]}" y2="${inner.screen[i][1]}"
    stroke="#506176" stroke-opacity=".75" stroke-width="1" pointer-events="none"/>`).join('');
  return bands+seams+notes;
}
function editProfileSide(node) {
  if(state.shape!=="arch")return;
  const {profileEdge:type,edgeIndex,edgeSide} = node.dataset;
  const index=type==="frame"?null:Number(edgeIndex), side=Number(edgeSide);
  const entry=index===null?null:sectionLayout()[index];
  const pane=entry?.pane;
  if(type==="sash" && (!pane || pane.split || pane.opening==="fixed")) return;
  const box=index===null?[0,0,state.width,state.height]:glassGeometry(entry).sashBox;
  const chord=side%2?box[3]-box[1]:box[2]-box[0];
  const depth=side%2?box[2]-box[0]:box[3]-box[1];
  if(chord<=0 || depth<=0) return;
  activeProfileEdge={owner:state,type,index,side};
  state.selectedPane=null; state.selectedImpost=null; multiSections.clear(); sharedAxis=null;
  renderAll();
  const current=(pane ? pane.sashArcs : state.frameArcs)?.[side];
  let dialog=$("#profileArcDialog");
  if(!dialog){
    dialog=document.createElement("dialog"); dialog.id="profileArcDialog";
    dialog.innerHTML=`<form method="dialog" style="display:grid;gap:12px;padding:16px">
      <strong data-arc-title></strong>
      <label>Форма <select name="shape"><option value="line">Прямая</option><option value="arc">Дуга</option></select></label>
      <label>Радиус, мм <input name="radius" type="number" step="any"></label>
      <label>Высота дуги, мм <input name="rise" type="number" step="any"></label>
      <label>Направление <select name="direction"><option value="out">Наружу</option><option value="in">Внутрь</option></select></label>
      <small data-arc-hint></small><div><button type="submit" value="cancel" formnovalidate>Отмена</button>  <button type="submit" value="apply">Применить</button></div></form>`;
    document.body.append(dialog);
  }
  const form=dialog.querySelector("form"), {shape,radius,rise,direction}=Object.fromEntries([...form.elements].filter(e=>e.name).map(e=>[e.name,e]));
  dialog.querySelector('[data-arc-title]').textContent=`${pane?'Створка':'Рама'}: ${PROFILE_SIDES[side]}`;
  const half=chord/2;
  radius.min=String(half); radius.value=Math.max(half,current?.radius ?? Math.ceil(chord));
  rise.min="0.000001"; rise.max=String(half);
  const rounded=value=>String(Number(value.toFixed(6)));
  rise.value=rounded(Math.min(half,arcRise(chord,radius.valueAsNumber)));
  shape.value=current?'arc':'line'; direction.value=current?.direction ?? 'out';
  dialog.querySelector('[data-arc-hint]').textContent=`Высота измеряется от линии между концами до вершины. Радиус и высота пересчитываются друг из друга.`;
  shape.onchange=()=>{radius.disabled=rise.disabled=direction.disabled=shape.value!=="arc";radius.required=rise.required=!radius.disabled;}; shape.onchange();
  radius.oninput=()=>{
    radius.setCustomValidity("");
    if(radius.valueAsNumber>=half) rise.value=rounded(Math.min(half,arcRise(chord,radius.valueAsNumber)));
  };
  rise.oninput=()=>{
    radius.setCustomValidity("");
    const h=rise.valueAsNumber;
    if(h>0 && h<=half) radius.value=String(Math.max(half,(half*half+h*h)/(2*h)));
  };
  direction.onchange=()=>radius.setCustomValidity("");
  radius.setCustomValidity("");
  form.onsubmit=event=>{
    if(event.submitter?.value!=="apply") return;
    const R=radius.valueAsNumber;
    if(shape.value==='arc'){
      const half=chord/2;
      const sag=half*half/(R+Math.sqrt(Math.max(0,R*R-half*half)));
      if(direction.value==='in' && sag>depth*0.4){event.preventDefault();radius.setCustomValidity("Для дуги внутрь увеличьте радиус.");radius.reportValidity();return;}
    }
    const host=pane||state, field=pane?'sashArcs':'frameArcs';
    host[field] ||= {};
    if(shape.value==='arc') host[field][side]={radius:R,direction:direction.value};
    else delete host[field][side];
    renderAll();
  };
  dialog.showModal();
}

function circleFrameTargets(cx,cy,rx,ry,frame) {
  const ix=Math.max(rx-frame,2), iy=Math.max(ry-frame,2);
  const halves=[1,0].map((sweep,side)=>{
    const selected=activeProfileEdge?.owner===state && activeProfileEdge.type==="circle-frame" && activeProfileEdge.side===side;
    const d=`M ${cx-rx} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${cx+rx} ${cy} L ${cx+ix} ${cy} A ${ix} ${iy} 0 0 ${1-sweep} ${cx-ix} ${cy} Z`;
    return `<path d="${d}" fill="${selected?'#ef8b25':'transparent'}" fill-opacity="${selected?0.45:1}" pointer-events="fill" tabindex="0" role="button" data-profile-edge="circle-frame" data-edge-side="${side}" aria-label="${side?'Нижний':'Верхний'} сегмент рамы" style="cursor:pointer"/>`;
  }).join("");
  return halves+`<path d="M ${cx-rx} ${cy} H ${cx-ix} M ${cx+ix} ${cy} H ${cx+rx}" fill="none" stroke="#506176" stroke-width="1" pointer-events="none"/>`;
}
