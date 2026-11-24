// Конструкция: импосты, секции, габариты и площадь.
function createImpostId(scope, orientation) {
  impostSequence += 1;
  return `${scope}-${orientation[0]}-${impostSequence}`;
}

function makeEvenImposts(count, size, orientation) {
  return Array.from({ length: count }, (_, index) => ({
    id: createImpostId("root", orientation),
    position: Math.round(((index + 1) * size) / (count + 1) / 10) * 10,
  }));
}

function minimumSegment(size, impostCount) {
  return Math.min(220, Math.max(70, (size / (impostCount + 1)) * 0.36));
}

function removeRootImpost(orientation,id) {
  const vertical=orientation === "vertical";
  const items=vertical ? state.vImposts : state.hImposts;
  const index=items.findIndex(item=>item.id===id);
  if(index<0) return false;
  const oldCols=state.vImposts.length+1;
  state.panes=state.panes.filter((_,i)=>vertical ? i%oldCols!==index+1 : Math.floor(i/oldCols)!==index+1);
  items.splice(index,1);
  normalizeRootImposts();
  return true;
}

function profileImpostStops(orientation,count) {
  const axis=orientation==="vertical"?0:1, size=axis===0?state.width:state.height;
  const tech=getTechnology(), f=tech.frame, poly=polygonPoints();
  let bounds=[f,f,state.width-f,state.height-f];
  const inner=poly ? polygonClip(poly,poly,f) : null;
  if(inner?.length>=3) bounds=polyBounds(inner);
  else if(state.shape==="arch" && state.width>2*f && state.height>2*f) {
    const outline=fittedOutline(bounds,[f,f,f,f],null,x=>x,y=>y,1,1);
    const points=outline.extrema || outline.boundary || outline.pts;
    if(points?.length) bounds=polyBounds(points);
  }
  const min=bounds[axis]+tech.impost/2, max=bounds[axis+2]-tech.impost/2;
  if(max-min>=(count-1)*tech.impost) return {min,max,gap:tech.impost};
  const gap=minimumSegment(size,count);
  return {min:gap,max:size-gap,gap};
}

function normalizeRootImposts() {
  const normalize = (items, orientation) => {
    items.sort((a, b) => a.position - b.position);
    const {min,max,gap}=profileImpostStops(orientation,items.length);
    items.forEach((item, index) => {
      const lower = index === 0 ? min : items[index - 1].position + gap;
      item.position = Math.max(lower, Math.min(Number(item.position) || lower, max));
    });
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const upper = index === items.length - 1 ? max : items[index + 1].position - gap;
      items[index].position = Math.min(items[index].position, upper);
    }
  };
  normalize(state.vImposts, "vertical");
  normalize(state.hImposts, "horizontal");
  state.cols = state.vImposts.length + 1;
  state.rows = state.hImposts.length + 1;
}

function primaryBoundaries(orientation) {
  const size = orientation === "vertical" ? state.width : state.height;
  const items = orientation === "vertical" ? state.vImposts : state.hImposts;
  return [0, ...items.map((item) => item.position), size];
}

function sectionLayout(x = primaryBoundaries("vertical"), y = primaryBoundaries("horizontal")) {
  const entries = [];
  function visit(pane, rect, [l,r,t,b], rootCol, rootRow, owner = null) {
    entries.push({ pane, rect, edges: [l,r,t,b], rootCol, rootRow, sashOwner: owner });
    if (!pane.split) return;
    const nextOwner = pane.sashFill && pane.opening !== "fixed" ? {pane,rect,edges:[l,r,t,b]} : owner;
    const [a,c] = pane.children;
    const p = pane.split.position;
    if (pane.split.orientation === "vertical") {
      const d = rect.width*p;
      visit(a,{...rect,width:d},[l,false,t,b],rootCol,rootRow,nextOwner);
      visit(c,{...rect,x:rect.x+d,width:rect.width-d},[false,r,t,b],rootCol,rootRow,nextOwner);
    } else {
      const d = rect.height*p;
      visit(a,{...rect,height:d},[l,r,t,false],rootCol,rootRow,nextOwner);
      visit(c,{...rect,y:rect.y+d,height:rect.height-d},[l,r,false,b],rootCol,rootRow,nextOwner);
    }
  }
  state.panes.forEach((pane,i) => {
    const c=i%state.cols, r=Math.floor(i/state.cols);
    visit(pane,{x:x[c],y:y[r],width:x[c+1]-x[c],height:y[r+1]-y[r]},
      [c===0,c===state.cols-1,r===0,r===state.rows-1],c,r);
  });
  return entries;
}
function sectionPanes() { return sectionLayout().map(e => e.pane); }
function getPanePhysicalRect(i) { return sectionLayout()[i].rect; }
function sectionNumber(i) { return sectionPanes().slice(0,i+1).filter(p => !p.split).length; }

function paneGlassUnits(pane) {
  const vertical = pane.innerImposts.filter((item) => item.orientation === "vertical").length;
  const horizontal = pane.innerImposts.filter((item) => item.orientation === "horizontal").length;
  return (vertical + 1) * (horizontal + 1);
}

function circleSashesBlocked() {
  return state.shape === "circle" && getProfile().allowCircleSashes !== true;
}

function ensurePanes() {
  normalizeRootImposts();
  const count = state.cols * state.rows;
  const panes = Array.from({ length: count }, (_, index) => {
    if (state.panes[index]) {
      return {
        ...state.panes[index],
        innerImposts: Array.isArray(state.panes[index].innerImposts) ? state.panes[index].innerImposts.map((item) => ({ ...item })) : [],
      };
    }
    return { opening: "fixed", glass: state.defaultGlass, innerImposts: [] };
  });
  state.panes = panes;
  sectionPanes().forEach(p => {
    if (p.split) p.innerImposts = [p.split];

  });
  if (state.selectedPane !== null) state.selectedPane = clamp(state.selectedPane, 0, Math.max(sectionPanes().length - 1, 0));
  if (state.selectedImpost?.scope === "pane" && !sectionPanes()[state.selectedImpost.paneIndex]?.innerImposts.some(item => item.id === state.selectedImpost.id)) state.selectedImpost = null;
  if (!state.selectedImpost) while (sectionPanes()[state.selectedPane]?.split) state.selectedPane += 1;
}

function getSelectedImpostRecord() {
  const selected = state.selectedImpost;
  if (!selected) return null;
  if (selected.scope === "root") {
    const collection = selected.orientation === "vertical" ? state.vImposts : state.hImposts;
    const item = collection.find((candidate) => candidate.id === selected.id);
    return item ? { selected, item, collection } : null;
  }
  const pane = sectionPanes()[selected.paneIndex];
  const item = pane?.innerImposts.find((candidate) => candidate.id === selected.id);
  return item ? { selected, item, collection: pane.innerImposts, pane } : null;
}

function rootImpostLimits(item, orientation) {
  const collection = orientation === "vertical" ? state.vImposts : state.hImposts;
  const index = collection.findIndex((candidate) => candidate.id === item.id);
  const {min,max,gap}=profileImpostStops(orientation,collection.length);
  return {
    min: index <= 0 ? min : collection[index - 1].position + gap,
    max: index >= collection.length - 1 ? max : collection[index + 1].position - gap,
  };
}

function nestedImpostLimits(item, pane) {
  const siblings = pane.innerImposts.filter((candidate) => candidate.orientation === item.orientation).sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((candidate) => candidate.id === item.id);
  const entry=sectionLayout().find(e=>e.pane===pane);
  if(entry){
    const axis=item.orientation==="vertical"?0:1, tech=getTechnology(), {rect}=entry;
    const size=axis===0?rect.width:rect.height, origin=axis===0?rect.x:rect.y;
    const {opening,sashBox}=glassGeometry(entry,tech), poly=polygonPoints();
    const depth=tech.frame+(sashBox?tech.sash-SASH_LAP:0);
    const edge=poly?polygonClip(rectPoints(opening),poly,depth):null;
    const box=edge?.length>=3?polyBounds(edge):opening;
    const half=tech.impost/2, gap=tech.impost/size;
    const min=index<=0?(box[axis]-origin+half)/size:siblings[index-1].position+gap;
    const max=index>=siblings.length-1?(box[axis+2]-origin-half)/size:siblings[index+1].position-gap;
    if(min<=max)return {min,max};
  }
  const gap = Math.min(0.16, 0.42 / (siblings.length + 1));
  return {
    min: index <= 0 ? gap : siblings[index - 1].position + gap,
    max: index >= siblings.length - 1 ? 1 - gap : siblings[index + 1].position - gap,
  };
}

function updateMaterialSelects(reset = false, preserveProfile = false) {
  const material = MATERIALS[state.material];
  if (reset || !availableProfiles().length) state.productType = "window";
  const compatible = availableProfiles();
  if (reset || (!preserveProfile && !compatible.some((item) => item.id === state.profile))) state.profile = compatible[0]?.id || material.profiles[0].id;
  if (reset || !material.finishes.some((item) => item.id === state.finish)) state.finish = material.finishes[0].id;

  $("#productType").value = state.productType || "window";
  $$("#productType option").forEach(option => {
    option.disabled = !availableProfiles(state.material, option.value).length;
  });
  $("#profileSystem").innerHTML = material.profiles
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.profile ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
  $("#finish").innerHTML = material.finishes
    .map((item) => `<option value="${item.id}" ${item.id === state.finish ? "selected" : ""}>${item.name}</option>`)
    .join("");
}

function glassGeometry({pane, rect, edges, sashOwner}, tech = getTechnology()) {
  const [fl,fr,ft,fb] = edges.map(outer => outer ? tech.frame : tech.impost/2);
  const ownerEdges=sashOwner && [
    Math.abs(rect.x-sashOwner.rect.x)<0.01,
    Math.abs(rect.x+rect.width-sashOwner.rect.x-sashOwner.rect.width)<0.01,
    Math.abs(rect.y-sashOwner.rect.y)<0.01,
    Math.abs(rect.y+rect.height-sashOwner.rect.y-sashOwner.rect.height)<0.01
  ];
  const sashDepth=tech.sash-SASH_LAP;
  const poly=constructionPolygon();
  const outer=poly ? polygonClip(poly,rectPoints([
    rect.x, edges[2] ? Math.min(rect.y,...poly.map(p=>p[1])) : rect.y,
    rect.x+rect.width, edges[3] ? Math.max(rect.y+rect.height,...poly.map(p=>p[1])) : rect.y+rect.height
  ])) : null;
  const shapeBounds=outer?.length>=3 ? polyBounds(outer) : null;
  const [l,t,r,b] = [
    (edges[0] && shapeBounds ? Math.min(rect.x,shapeBounds[0]) : rect.x)+fl+(ownerEdges?.[0]?sashDepth:0),
    (edges[2] && shapeBounds ? Math.min(rect.y,shapeBounds[1]) : rect.y)+ft+(ownerEdges?.[2]?sashDepth:0),
    (edges[1] && shapeBounds ? Math.max(rect.x+rect.width,shapeBounds[2]) : rect.x+rect.width)-fr-(ownerEdges?.[1]?sashDepth:0),
    (edges[3] && shapeBounds ? Math.max(rect.y+rect.height,shapeBounds[3]) : rect.y+rect.height)-fb-(ownerEdges?.[3]?sashDepth:0)
  ];
  const sash = pane.opening !== "fixed";
  const sashBox = sash ? [l-SASH_LAP,t-SASH_LAP,r+SASH_LAP,b+SASH_LAP] : null;
  const d = sash ? tech.sash-SASH_LAP : 0;
  const opening = [l+d,t+d,r-d,b-d];
  const bites = edges.map((outer,i) => tech.bite[sash || ownerEdges?.[i] ? "створка" : outer ? "рама" : "импост"]);
  const intervals = (axis, lo, hi, origin, size, first, last) => {
    const marks = pane.innerImposts.filter(i => !pane.split && i.orientation === axis)
      .map(i => origin + i.position*size).sort((a,b) => a-b);
    return Array.from({length:marks.length+1},(_,i)=>{
      const start=i ? marks[i-1]+tech.impost/2 : lo;
      const end=i<marks.length ? marks[i]-tech.impost/2 : hi;
      const a=i ? tech.bite["импост"] : first, b=i<marks.length ? tech.bite["импост"] : last;
      return {start:start-a, size:end-start+a+b, clear:end-start};
    });
  };
  const xs=intervals("vertical",opening[0],opening[2],rect.x,rect.width,bites[0],bites[1]);
  const ys=intervals("horizontal",opening[1],opening[3],rect.y,rect.height,bites[2],bites[3]);
  return {opening,sashBox,fields:ys.flatMap((y,row)=>xs.map((x,col)=>({x:x.start,y:y.start,w:x.size,h:y.size,clearW:x.clear,clearH:y.clear,row,col})))};
}
function glassSizeLabel(f) { return f.clearW>0 && f.clearH>0 && f.w>0 && f.h>0 ? `${Math.round(f.w)} × ${Math.round(f.h)} мм` : "—"; }
function paneGlazingArea(index, pane, shapeFactor = 1) {
  const entry=sectionLayout()[index], tech=getTechnology(), geo=glassGeometry(entry,tech);
  return geo.fields.reduce((sum,f)=>{
    if(f.clearW<=1e-6 || f.clearH<=1e-6 || f.w<=0 || f.h<=0) return sum;
    return sum+(state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs() ? (fittedGlass(entry,geo,f,tech).area ?? f.w*f.h) : f.w*f.h*shapeFactor);
  },0)/1e6;
}

function geometry() {
  const widthM = state.width / 1000;
  const heightM = state.height / 1000;
  let area;
  let perimeter;
  let verticalFactor = 1;
  let horizontalFactor = 1;

  if (state.shape === "circle") {
    area = Math.PI * (widthM / 2) ** 2;
    perimeter = Math.PI * widthM;
    verticalFactor = 0.78;
    horizontalFactor = 0.78;
  } else {
    area = widthM * heightM;
    perimeter = 2 * (widthM + heightM);
  }

  const customFrame=customFrameMeasures();
  if(customFrame){area=customFrame.area;perimeter=customFrame.perimeter;}
  const shapeFactor = customFrame ? 1 : Math.min(1, area / Math.max(widthM * heightM, 0.001));
  const curvedLength = (orientation, position, rect) => {
    const poly=constructionPolygon();
    if (poly) {
      const range=outlineRange(poly,orientation === "vertical" ? 0 : 1,position);
      if (!range) return 0;
      const low=orientation === "vertical" ? rect.y : rect.x;
      const high=low+(orientation === "vertical" ? rect.height : rect.width);
      const bounds=polyBounds(poly);
      const axis=orientation === "vertical" ? 1 : 0;
      const clippedLow=low===0 ? Math.min(low,bounds[axis]) : low;
      const clippedHigh=high===(orientation === "vertical" ? state.height : state.width) ? Math.max(high,bounds[axis+2]) : high;
      return Math.max(0,Math.min(clippedHigh,range[1])-Math.max(clippedLow,range[0]))/1000;
    }
    if (!customProfileArcs()) return (orientation === "vertical" ? rect.height : rect.width) / 1000;
    if (orientation === "vertical") {
      const top = rect.y === 0 ? (frameCurve(0,0)?.(position) ?? rect.y) : rect.y;
      const bottom = rect.y + rect.height === state.height ? (frameCurve(2,0)?.(position) ?? state.height) : rect.y + rect.height;
      return Math.max(0, Math.min(rect.y+rect.height,bottom)-Math.max(rect.y,top))/1000;
    }
    const left = rect.x === 0 ? (frameCurve(3,0)?.(position) ?? rect.x) : rect.x;
    const right = rect.x + rect.width === state.width ? (frameCurve(1,0)?.(position) ?? state.width) : rect.x+rect.width;
    return Math.max(0,Math.min(rect.x+rect.width,right)-Math.max(rect.x,left))/1000;
  };
  const fullRect={x:0,y:0,width:state.width,height:state.height};
  const rootLength=(item,orientation)=>{
    if(constructionPolygon()){
      const poly=constructionPolygon(),inner=polygonClip(poly,poly,getTechnology().frame);
      const [a,b]=impostSegment(item,orientation,fullRect,inner,true);
      return Math.hypot(b[0]-a[0],b[1]-a[1])/1000;
    }
    return curvedLength(orientation,item.position,fullRect);
  };
  const primaryImpost = customProfileArcs() || constructionPolygon()
    ? state.vImposts.reduce((sum,item)=>sum+rootLength(item,"vertical"),0)
      +state.hImposts.reduce((sum,item)=>sum+rootLength(item,"horizontal"),0)
    : state.vImposts.length * heightM * verticalFactor + state.hImposts.length * widthM * horizontalFactor;
  let nestedImpost = 0;
  let nestedCount = 0;
  let glassUnits = 0;
  const paneGlazingAreas = [], paneGlassCounts = [];
  sectionPanes().forEach((pane, index) => {
    const paneRect = getPanePhysicalRect(index);
    pane.innerImposts.forEach((item) => {
      nestedCount += 1;
      nestedImpost += constructionPolygon()
        ? (()=>{const [a,b]=impostSegment(item,item.orientation,paneRect,sectionContour(sectionLayout()[index],constructionPolygon(),getTechnology().frame));return Math.hypot(b[0]-a[0],b[1]-a[1])/1000;})()
        : customProfileArcs()
        ? curvedLength(item.orientation, item.orientation === "vertical" ? paneRect.x + paneRect.width*item.position : paneRect.y + paneRect.height*item.position, paneRect)
        : item.orientation === "vertical" ? (paneRect.height / 1000) * verticalFactor : (paneRect.width / 1000) * horizontalFactor;
    });
    if (pane.split) return;
    const entry=sectionLayout()[index], tech=getTechnology(), geo=glassGeometry(entry,tech);
    paneGlassCounts[index] = geo.fields.filter(f=>f.clearW>1e-6 && f.clearH>1e-6 &&
      ((state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs()) ? (fittedGlass(entry,geo,f,tech).area ?? f.w*f.h)>1e-7 : true)).length;
    glassUnits += paneGlassCounts[index];
    paneGlazingAreas[index] = paneGlazingArea(index, pane, shapeFactor);
  });
  const glazingArea = paneGlazingAreas.reduce((sum, value) => sum + value, 0);
  const impost = primaryImpost + nestedImpost;
  return { area, perimeter, glazingArea, paneGlazingAreas, paneGlassCounts, impost, primaryImpost, nestedImpost, nestedCount, glassUnits, overall:overallSize() };
}
