// Конструкция: импосты, секции, габариты и площадь.
import { MATERIALS, availableProfiles } from "./catalog.js";
import { circularOutline, clipSlantedSections, constructionPolygon, customFrameMeasures, customProfileArcs, fittedGlass, fittedOutline, hasSlantedImposts, impostSegment, overallSize, polyBounds, polygonClip, polygonPoints, profileOutline, rectPoints, sectionContour, slantedBounds } from "./drawing.js";
import { $, $$, SASH_LAP, clamp, comparableCurrentState, defaultViewSide, escapeHtml, formatNumber, getProfile, getTechnology, nextImpostSequence, state } from "./product.js";
export function createImpostId(scope, orientation) {
  return `${scope}-${orientation[0]}-${nextImpostSequence()}`;
}

export function makeEvenImposts(count, size, orientation) {
  return Array.from({ length: count }, (_, index) => ({
    id: createImpostId("root", orientation),
    position: Math.round(((index + 1) * size) / (count + 1) / 10) * 10,
  }));
}

function minimumSegment(size, impostCount) {
  return Math.min(220, Math.max(70, (size / (impostCount + 1)) * 0.36));
}

export function removeRootImpost(orientation,id) {
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

export function sectionLayout(x = primaryBoundaries("vertical"), y = primaryBoundaries("horizontal")) {
  const entries = [];
  function visit(pane, rect, [l,r,t,b], rootCol, rootRow, owner = null, slantParents = []) {
    entries.push({ pane, rect, edges: [l,r,t,b], rootCol, rootRow, sashOwner: owner, slantParents });
    if (!pane.split) return;
    const nextOwner = pane.sashFill && pane.opening !== "fixed" ? {pane,rect,edges:[l,r,t,b]} : owner;
    const [a,c] = pane.children;
    const p = pane.split.position;
    const split = pane.split;
    if (pane.split.orientation === "vertical") {
      const d = rect.width*p;
      visit(a,{...rect,width:d},[l,false,t,b],rootCol,rootRow,nextOwner,
        [...slantParents,{item:split,orientation:"vertical",rect,sign:1}]);
      visit(c,{...rect,x:rect.x+d,width:rect.width-d},[false,r,t,b],rootCol,rootRow,nextOwner,
        [...slantParents,{item:split,orientation:"vertical",rect,sign:-1}]);
    } else {
      const d = rect.height*p;
      visit(a,{...rect,height:d},[l,r,t,false],rootCol,rootRow,nextOwner,
        [...slantParents,{item:split,orientation:"horizontal",rect,sign:-1}]);
      visit(c,{...rect,y:rect.y+d,height:rect.height-d},[l,r,false,b],rootCol,rootRow,nextOwner,
        [...slantParents,{item:split,orientation:"horizontal",rect,sign:1}]);
    }
  }
  state.panes.forEach((pane,i) => {
    const c=i%state.cols, r=Math.floor(i/state.cols);
    visit(pane,{x:x[c],y:y[r],width:x[c+1]-x[c],height:y[r+1]-y[r]},
      [c===0,c===state.cols-1,r===0,r===state.rows-1],c,r);
  });
  return entries;
}
export function sectionPanes() { return sectionLayout().map(e => e.pane); }
export function getPanePhysicalRect(i) { return sectionLayout()[i].rect; }
export function sectionNumber(i) { return sectionPanes().slice(0,i+1).filter(p => !p.split).length; }

function paneGlassUnits(pane) {
  const vertical = pane.innerImposts.filter((item) => item.orientation === "vertical").length;
  const horizontal = pane.innerImposts.filter((item) => item.orientation === "horizontal").length;
  return (vertical + 1) * (horizontal + 1);
}

export function circleSashesBlocked() {
  return state.shape === "circle" && getProfile().allowCircleSashes !== true;
}

export function ensurePanes() {
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
  const clampBar=(item,orientation,limits)=>item.position=Math.min(limits.max,Math.max(limits.min,item.position));
  state.vImposts.forEach((item)=>clampBar(item,"vertical",rootImpostLimits(item,"vertical")));
  state.hImposts.forEach((item)=>clampBar(item,"horizontal",rootImpostLimits(item,"horizontal")));
  sectionPanes().forEach((pane)=>(pane.innerImposts||[]).forEach((item)=>clampBar(item,item.orientation,nestedImpostLimits(item,pane))));
  if (!state.selectedImpost) while (sectionPanes()[state.selectedPane]?.split) state.selectedPane += 1;
}

export function getSelectedImpostRecord() {
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

const MIN_SASH_MM = 350;
function sashOuterSize(entry, tech = getTechnology()) {
  const owns = entry.pane.split ? entry.pane.sashFill && entry.pane.opening !== "fixed" : entry.pane.opening !== "fixed";
  if (!owns) return null;
  const shell = entry.pane.split ? { ...entry, pane: { ...entry.pane, innerImposts: [], split: null } } : entry;
  const box = glassGeometry(shell, tech).sashBox;
  if (!box || !(box[2] > box[0]) || !(box[3] > box[1])) return null;
  return { width: box[2] - box[0], height: box[3] - box[1] };
}
function clampImpostToSashes(position, limits, orientation, match) {
  const vertical = orientation === "vertical";
  let { min, max } = limits;
  sectionLayout().forEach((entry) => {
    if (match && !match(entry)) return;
    const size = sashOuterSize(entry);
    if (!size) return;
    const span = vertical ? size.width : size.height;
    const room = span - MIN_SASH_MM;
    const start = vertical ? entry.rect.x : entry.rect.y;
    const end = start + (vertical ? entry.rect.width : entry.rect.height);
    if (Math.abs(end - position) < 1.5) min = Math.max(min, position - room);
    if (Math.abs(start - position) < 1.5) max = Math.min(max, position + room);
  });
  if (!(min <= max)) return { min: position, max: position };
  return { min, max };
}
export function rootImpostLimits(item, orientation) {
  const collection = orientation === "vertical" ? state.vImposts : state.hImposts;
  const index = collection.findIndex((candidate) => candidate.id === item.id);
  const {min,max,gap}=profileImpostStops(orientation,collection.length);
  const stops = {
    min: index <= 0 ? min : collection[index - 1].position + gap,
    max: index >= collection.length - 1 ? max : collection[index + 1].position - gap,
  };
  return clampImpostToSashes(item.position, stops, orientation);
}

export function nestedImpostLimits(item, pane) {
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
    const half=barFace(item,tech)/2, gap=Math.max(barFace(item,tech), tech.impost)/size;
    const min=index<=0?(box[axis]-origin+half)/size:siblings[index-1].position+gap;
    const max=index>=siblings.length-1?(box[axis+2]-origin-half)/size:siblings[index+1].position-gap;
    if(min<=max){
      const vertical=item.orientation==="vertical";
      const pos=origin+item.position*size;
      const limited=clampImpostToSashes(pos,{min:origin+min*size,max:origin+max*size},item.orientation,
        (candidate)=>(candidate.slantParents||[]).some((parent)=>parent.item===item));
      return {min:(limited.min-origin)/size,max:(limited.max-origin)/size};
    }
  }
  const gap = Math.min(0.16, 0.42 / (siblings.length + 1));
  return {
    min: index <= 0 ? gap : siblings[index - 1].position + gap,
    max: index >= siblings.length - 1 ? 1 - gap : siblings[index + 1].position - gap,
  };
}

export function updateMaterialSelects(reset = false, preserveProfile = false) {
  const material = MATERIALS[state.material];
  if (reset || !availableProfiles().length) {
    state.productType = "window";
    state.viewSide = defaultViewSide(state.productType);
  }
  const compatible = availableProfiles();
  if (reset || (!preserveProfile && !compatible.some((item) => item.id === state.profile))) state.profile = compatible[0]?.id || material.profiles[0].id;
  state.exteriorFinish ??= state.finish;
  for (const field of ["finish", "exteriorFinish"]) {
    if (reset || !material.finishes.some(item => item.id === state[field])) state[field] = material.finishes[0].id;
    const select = $("#" + field);
    select.innerHTML = material.finishes.map(item =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    select.value = state[field];
  }

  $("#productType").value = state.productType || "window";
  $$("#productType option").forEach(option => {
    option.disabled = !availableProfiles(state.material, option.value).length;
  });
  $("#profileSystem").innerHTML = material.profiles
    .map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.profile ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
    .join("");
}

export function barBite(item, tech) {
  return item?.shtulp ? tech.shtulpBite : tech.bite["импост"];
}
export function barFace(item, tech = getTechnology()) {
  if (!item) return tech.impost;
  return item.shtulp ? tech.shtulp : tech.impost;
}
export function adjacentBar(entry, edgeIndex) {
  if (!entry || entry.edges?.[edgeIndex]) return null;
  const parents = entry.slantParents || [];
  const nested = parents.find((parent) => {
    if (edgeIndex === 1) return parent.orientation === "vertical" && parent.sign > 0;
    if (edgeIndex === 0) return parent.orientation === "vertical" && parent.sign < 0;
    if (edgeIndex === 3) return parent.orientation === "horizontal" && parent.sign < 0;
    return parent.orientation === "horizontal" && parent.sign > 0;
  });
  if (nested) return nested.item;
  if (edgeIndex === 0) return state.vImposts[entry.rootCol - 1] || null;
  if (edgeIndex === 1) return state.vImposts[entry.rootCol] || null;
  if (edgeIndex === 2) return state.hImposts[entry.rootRow - 1] || null;
  return state.hImposts[entry.rootRow] || null;
}
export function glassGeometry(entry, tech = getTechnology()) {
  const {pane, rect, edges, sashOwner} = entry;
  const [fl,fr,ft,fb] = [0,1,2,3].map((side) => edges[side] ? tech.frame : barFace(adjacentBar(entry, side), tech) / 2);
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
  const bites = edges.map((outer,i) => sash || ownerEdges?.[i] ? tech.bite["створка"] : outer ? tech.bite["рама"] : barBite(adjacentBar(entry, i), tech));
  const intervals = (axis, lo, hi, origin, size, first, last) => {
    const items = pane.innerImposts.filter(i => !pane.split && i.orientation === axis)
      .slice().sort((a,b) => a.position-b.position);
    const marks = items.map(i => origin + i.position*size);
    return Array.from({length:marks.length+1},(_,i)=>{
      const start=i ? marks[i-1]+barFace(items[i-1], tech)/2 : lo;
      const end=i<marks.length ? marks[i]-barFace(items[i], tech)/2 : hi;
      const a=i ? barBite(items[i-1], tech) : first, b=i<marks.length ? barBite(items[i], tech) : last;
      return {start:start-a, size:end-start+a+b, clear:end-start};
    });
  };
  const xs=intervals("vertical",opening[0],opening[2],rect.x,rect.width,bites[0],bites[1]);
  const ys=intervals("horizontal",opening[1],opening[3],rect.y,rect.height,bites[2],bites[3]);
  return {opening,sashBox,fields:ys.flatMap((y,row)=>xs.map((x,col)=>({x:x.start,y:y.start,w:x.size,h:y.size,clearW:x.clear,clearH:y.clear,row,col})))};
}
export function glassSizeLabel(f) { return f.clearW>0 && f.clearH>0 && f.w>0 && f.h>0 ? `${Math.round(f.w)} × ${Math.round(f.h)} мм` : "—"; }

/** Пролёты видимого импоста: от внутреннего края рамы/створки до грани соседнего импоста (как у стеклопакета). */
export function nestedImpostSpans(entry, item, tech = getTechnology()) {
  const {pane, rect} = entry;
  const vertical = item.orientation === "vertical";
  const geoEntry = pane.split
    ? {...entry, pane: {...pane, innerImposts: [], split: null}}
    : entry;
  const {opening} = glassGeometry(geoEntry, tech);
  const half = tech.impost / 2;
  const axis = vertical
    ? rect.x + item.position * rect.width
    : rect.y + item.position * rect.height;
  const lo = vertical ? opening[1] : opening[0];
  const hi = vertical ? opening[3] : opening[2];
  const crosses = pane.innerImposts
    .filter(other => other.orientation !== item.orientation && other.id !== item.id)
    .map(other => vertical
      ? rect.y + other.position * rect.height
      : rect.x + other.position * rect.width)
    .filter(value => value > lo + half && value < hi - half)
    .sort((a, b) => a - b);
  const cuts = [lo, ...crosses, hi];
  const spans = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const start = i === 0 ? cuts[0] : cuts[i] + half;
    const end = i === cuts.length - 2 ? cuts[cuts.length - 1] : cuts[i + 1] - half;
    if (end - start > 1e-6) {
      spans.push(vertical
        ? {x1: axis, y1: start, x2: axis, y2: end}
        : {x1: start, y1: axis, x2: end, y2: axis});
    }
  }
  return spans;
}
function paneGlazingArea(index, pane, shapeFactor = 1) {
  const entry=sectionLayout()[index], tech=getTechnology(), geo=glassGeometry(entry,tech);
  return geo.fields.reduce((sum,f)=>{
    if(f.clearW<=1e-6 || f.clearH<=1e-6 || f.w<=0 || f.h<=0) return sum;
    return sum+(state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs() ? (fittedGlass(entry,geo,f,tech).area ?? f.w*f.h) : f.w*f.h*shapeFactor);
  },0)/1e6;
}

function contourLength(points) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    sum += Math.hypot(next[0] - points[i][0], next[1] - points[i][1]);
  }
  return sum;
}
function arcDevelopedLength(chord, radius) {
  if (!(chord > 0) || !Number.isFinite(radius)) return Math.max(0, chord || 0);
  const curve = Math.max(chord / 2, radius);
  return curve * 2 * Math.asin(Math.min(1, chord / (2 * curve)));
}
function edgeKindFromDelta(dx, dy, arc) {
  if (arc) return "arc";
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return "transom";
  const angle = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI;
  if (angle < 12 || angle > 168) return "transom";
  if (angle > 78 && angle < 102) return "mullion";
  return "oblique";
}
function splitBoundaryLengths(outline) {
  const boundary = outline?.boundary || outline?.pts;
  const corners = outline?.pts;
  if (!boundary || !corners || corners.length < 2) return [];
  const indexOf = (point) => boundary.findIndex((candidate) => Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < 0.8);
  const indices = corners.map(indexOf);
  if (indices.some((index) => index < 0)) {
    return corners.map((point, index) => {
      const next = corners[(index + 1) % corners.length];
      return Math.hypot(next[0] - point[0], next[1] - point[1]);
    });
  }
  return indices.map((start, index) => {
    const end = indices[(index + 1) % indices.length];
    let length = 0;
    let cursor = start;
    let guard = 0;
    while (cursor !== end && guard <= boundary.length) {
      const next = (cursor + 1) % boundary.length;
      length += Math.hypot(boundary[next][0] - boundary[cursor][0], boundary[next][1] - boundary[cursor][1]);
      cursor = next;
      guard += 1;
    }
    return length;
  });
}
export function innerFrameBoundary(tech) {
  const inset = tech.frame;
  if (state.shape === "circle") {
    const radius = state.width / 2 - inset;
    if (radius <= 1) return [];
    const cx = state.width / 2;
    const cy = state.height / 2;
    return Array.from({ length: 180 }, (_, index) => {
      const angle = 2 * Math.PI * index / 180;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    });
  }
  const polygon = constructionPolygon();
  if (polygon) {
    const inner = polygonClip(polygon, polygon, inset);
    return inner.length >= 3 ? inner : [];
  }
  if (state.width <= 2 * inset || state.height <= 2 * inset) return [];
  const outline = fittedOutline([inset, inset, state.width - inset, state.height - inset], [inset, inset, inset, inset], null, (value) => value, (value) => value, 1, 1);
  const points = outline.boundary || outline.pts;
  return points?.length >= 3 ? points : [];
}
export function impostHostBoundary(entry, tech, root) {
  if (root) return innerFrameBoundary(tech);
  const hostPane = entry.pane.split ? { ...entry.pane, innerImposts: [], split: null } : entry.pane;
  const opening = glassGeometry({ ...entry, pane: hostPane }, tech).opening;
  let host = rectPoints(opening);
  const polygon = constructionPolygon();
  if (polygon) {
    const sash = hostPane.opening !== "fixed";
    const depth = tech.frame + (sash ? tech.sash - SASH_LAP : 0);
    const contour = sectionContour(entry, polygon, depth);
    if (contour?.length >= 3) host = contour;
  } else if (state.shape === "circle") {
    const inner = innerFrameBoundary(tech);
    if (inner.length >= 3) host = polygonClip(host, inner);
  } else if (customProfileArcs()) {
    const touch = [entry.edges[2], entry.edges[1], entry.edges[3], entry.edges[0]];
    const sash = hostPane.opening !== "fixed";
    const depth = tech.frame + (sash ? tech.sash - SASH_LAP : 0);
    const outline = fittedOutline(opening, touch.map((flag) => flag ? depth : null), sash ? hostPane.sashArcs : null, (value) => value, (value) => value, 1, 1);
    const boundary = outline.boundary || outline.pts;
    if (boundary?.length >= 3) host = boundary;
  }
  return host;
}
function impostAxisLength(item, orientation, root, entry, tech) {
  if (state.shape === "circle" && root && !item.endOffsets?.some(Boolean)) {
    const radius = state.width / 2 - tech.frame;
    const center = orientation === "vertical" ? state.width / 2 : state.height / 2;
    const delta = item.position - center;
    return Math.abs(delta) >= radius ? 0 : 2 * Math.sqrt(radius * radius - delta * delta);
  }
  const boundary = impostHostBoundary(entry, tech, root);
  if (!boundary || boundary.length < 3) return 0;
  const rect = root ? { x: 0, y: 0, width: state.width, height: state.height } : entry.rect;
  const [start, end] = impostSegment(item, orientation, rect, boundary, root);
  return Math.hypot(end[0] - start[0], end[1] - start[1]);
}
function memberRecord(fields) {
  return {
    kindLabel: { transom: "Поперечина", mullion: "Стойка", oblique: "Косой профиль", arc: "Арочный профиль", ring: "Кольцо" }[fields.kind] || "Профиль",
    roleLabel: { frame: "Рама", sash: "Створка", impost: "Импост", shtulp: "Штульп", extender: "Расширитель", connector: "Соединитель", corner: "Угловой профиль" }[fields.role] || "Профиль",
    ...fields,
  };
}
function frameMemberList(tech) {
  if (state.shape === "circle") {
    return [memberRecord({
      id: "frame-ring", role: "frame", kind: "ring", side: null, index: null, vertex: null,
      lengthMm: Math.PI * state.width, widthMm: tech.frame, arcRadius: state.width / 2,
      label: "Рама", shapeLabel: "Окружность", joints: "непрерывный гиб",
      select: { type: "circle-frame", side: null, index: null },
    })];
  }
  const polygon = state.shape === "skew" ? (polygonPoints() || rectPoints([0, 0, state.width, state.height])) : null;
  if (polygon) {
    return polygon.map((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const dx = next[0] - point[0];
      const dy = next[1] - point[1];
      const kind = edgeKindFromDelta(dx, dy, false);
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const following = polygon[(index + 2) % polygon.length];
      const turn = (a, b, c) => {
        const ux = a[0] - b[0];
        const uy = a[1] - b[1];
        const vx = c[0] - b[0];
        const vy = c[1] - b[1];
        const denom = Math.hypot(ux, uy) * Math.hypot(vx, vy);
        if (denom < 1e-8) return 45;
        return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / denom))) * 90 / Math.PI;
      };
      return memberRecord({
        id: `frame-${index}`, role: "frame", kind, side: index, index: null, vertex: null,
        lengthMm: Math.hypot(dx, dy), widthMm: tech.frame,
        label: `Рама, сторона ${index + 1}`,
        shapeLabel: kind === "oblique" ? "Косая" : "Прямая",
        joints: `${formatNumber(turn(previous, point, next), 1)}° / ${formatNumber(turn(point, next, following), 1)}°`,
        select: { type: "polygon", side: index, index: null },
      });
    });
  }
  const names = ["верхняя поперечина", "правая стойка", "нижняя поперечина", "левая стойка"];
  const chords = [state.width, state.height, state.width, state.height];
  const arcs = state.shape === "arch" ? state.frameArcs : null;
  const outline = profileOutline([0, 0, state.width, state.height], arcs, (value) => value, (value) => value, 1, 1);
  const joints = outline.edges.map((edge, index) => {
    const previous = outline.edges[(index + 3) % 4];
    const delta = edge.startAngle - (previous.endAngle + Math.PI);
    return Math.acos(Math.max(-1, Math.min(1, Math.cos(delta)))) * 90 / Math.PI;
  });
  return names.map((name, side) => {
    const arc = arcs?.[side];
    const kind = arc ? "arc" : (side % 2 ? "mullion" : "transom");
    return memberRecord({
      id: `frame-${side}`, role: "frame", kind, side, index: null, vertex: null,
      lengthMm: arc ? arcDevelopedLength(chords[side], arc.radius) : chords[side],
      widthMm: tech.frame,
      arcRadius: arc ? Math.max(chords[side] / 2, arc.radius) : null,
      label: `Рама, ${name}`,
      shapeLabel: arc ? (arc.direction === "in" ? "Дуга внутрь" : "Дуга наружу") : "Прямая",
      joints: `${formatNumber(joints[side], 1)}° / ${formatNumber(joints[(side + 1) % 4], 1)}°`,
      select: { type: "frame", side, index: null },
    });
  });
}
function sashMemberList(tech, layout) {
  const members = [];
  layout.forEach((entry, index) => {
    const pane = entry.pane;
    const ownsSash = pane.split ? pane.sashFill && pane.opening !== "fixed" : pane.opening !== "fixed";
    if (!ownsSash) return;
    const shell = pane.split ? { ...entry, pane: { ...pane, innerImposts: [], split: null } } : entry;
    const box = glassGeometry(shell, tech).sashBox;
    if (!box) return;
    const width = tech.sash;
    if (state.shape === "circle") {
      const depth = tech.frame - SASH_LAP;
      const radius = state.width / 2 - depth;
      const fitted = circularOutline(box, depth, (value) => value, (value) => value);
      const full = !state.vImposts.length && !state.hImposts.length && entry.edges.every(Boolean);
      members.push(memberRecord({
        id: `sash-${index}`, role: "sash", kind: full ? "ring" : "arc", side: null, index, vertex: null,
        lengthMm: full && radius > 0 ? 2 * Math.PI * radius : contourLength(fitted.boundary),
        widthMm: width, label: `Створка ${sectionNumber(index)}`, shapeLabel: full ? "Окружность" : "Сектор",
        joints: full ? "непрерывный гиб" : "стык с импостом",
        select: { type: "circle-sash", side: null, index },
      }));
      return;
    }
    const polygon = constructionPolygon();
    if (polygon) {
      const depth = tech.frame - SASH_LAP;
      const boundary = clipSlantedSections(polygonClip(rectPoints(slantedBounds(box, entry)), polygon, depth), entry, Math.max(0, tech.impost / 2 - SASH_LAP));
      if (!boundary || boundary.length < 3) return;
      boundary.forEach((point, side) => {
        const next = boundary[(side + 1) % boundary.length];
        const dx = next[0] - point[0];
        const dy = next[1] - point[1];
        const kind = edgeKindFromDelta(dx, dy, false);
        members.push(memberRecord({
          id: `sash-${index}-${side}`, role: "sash", kind, side, index, vertex: null,
          lengthMm: Math.hypot(dx, dy), widthMm: width,
          label: `Створка ${sectionNumber(index)}, сторона ${side + 1}`,
          shapeLabel: kind === "oblique" ? "Косая" : "Прямая", joints: "по контуру створки",
          select: { type: "skew-sash", side, index },
        }));
      });
      return;
    }
    const touch = [entry.edges[2], entry.edges[1], entry.edges[3], entry.edges[0]];
    const arcs = state.shape === "arch" ? (pane.sashArcs || null) : null;
    const followsFrame = touch.some((flag, side) => flag && state.shape === "arch" && state.frameArcs?.[side]);
    const ownArc = arcs && Object.values(arcs).some(Boolean);
    const names = ["верхняя поперечина", "правая стойка", "нижняя поперечина", "левая стойка"];
    let lengths;
    if (!followsFrame && !ownArc) {
      lengths = [box[2] - box[0], box[3] - box[1], box[2] - box[0], box[3] - box[1]];
    } else {
      const outline = fittedOutline(box, touch.map((flag) => flag ? tech.frame - SASH_LAP : null), arcs, (value) => value, (value) => value, 1, 1);
      lengths = splitBoundaryLengths(outline);
    }
    lengths.forEach((length, side) => {
      const arc = arcs?.[side] || (followsFrame && touch[side] && state.frameArcs?.[side]);
      const kind = arc ? "arc" : (side % 2 ? "mullion" : "transom");
      members.push(memberRecord({
        id: `sash-${index}-${side}`, role: "sash", kind, side, index, vertex: null,
        lengthMm: length, widthMm: width,
        label: `Створка ${sectionNumber(index)}, ${names[side]}`,
        shapeLabel: arc ? "Дуга" : "Прямая", joints: "45° / 45°",
        select: { type: "sash", side, index },
      }));
    });
  });
  return members;
}
function addonMemberList(tech, frames) {
  const members = [];
  const stacks = {};
  (state.addons || []).forEach((addon) => {
    const width = addon.role === "extender" ? tech.extender : addon.role === "connector" ? tech.connector : tech.corner;
    if (addon.role === "corner") {
      const count = Math.max(frames.length, 1);
      const next = frames.find((member) => member.side === addon.vertex);
      const previous = frames.find((member) => member.side === (addon.vertex + count - 1) % count);
      const vertical = [next, previous].find((member) => member && (member.kind === "mullion" || member.side % 2 === 1));
      const length = (vertical || [next, previous].sort((a, b) => (b?.lengthMm || 0) - (a?.lengthMm || 0))[0])?.lengthMm || 0;
      members.push(memberRecord({
        id: addon.id, role: "corner", kind: "mullion", side: null, index: null, vertex: addon.vertex,
        lengthMm: length, widthMm: width, label: `Угловой профиль, угол ${(addon.vertex ?? 0) + 1}`,
        shapeLabel: "Наружный угол", joints: "к стойкам рамы", select: { type: "vertex", side: addon.vertex, index: null },
      }));
      return;
    }
    if (addon.role !== "extender" && addon.role !== "connector") return;
    let length = 0;
    let arcRadius = null;
    if (addon.side === "ring") {
      const stacked = stacks.ring || 0;
      length = Math.PI * (state.width + 2 * stacked + width);
      stacks.ring = stacked + width;
    } else {
      const frame = frames.find((member) => member.side === addon.side);
      const stacked = stacks[addon.side] || 0;
      arcRadius = frame?.arcRadius || null;
      length = frame ? (arcRadius ? frame.lengthMm * (arcRadius + stacked + width / 2) / arcRadius : frame.lengthMm) : 0;
      stacks[addon.side] = stacked + width;
    }
    members.push(memberRecord({
      id: addon.id, role: addon.role, kind: addon.side === "ring" ? "ring" : "transom",
      side: addon.side, index: null, vertex: null, lengthMm: length, widthMm: width, arcRadius,
      label: addon.role === "extender" ? "Расширитель" : "Соединитель",
      shapeLabel: addon.side === "ring" ? "Кольцо" : "По стороне рамы",
      joints: "встык к раме",
      select: { type: addon.side === "ring" ? "circle-frame" : state.shape === "skew" ? "polygon" : "frame", side: addon.side === "ring" ? null : addon.side, index: null },
    }));
  });
  return members;
}
let constructionCache = null;
let constructionKey = "";
function buildConstruction() {
  const tech = getTechnology();
  const layout = sectionLayout();
  const members = frameMemberList(tech);
  const frames = members.slice();
  members.push(...sashMemberList(tech, layout));
  const pushBar = (item, orientation, root, entry) => {
    const length = impostAxisLength(item, orientation, root, entry, tech);
    const slanted = item.endOffsets?.some(Boolean);
    members.push(memberRecord({
      id: `bar-${item.id}`, role: item.shtulp ? "shtulp" : "impost",
      kind: slanted ? "oblique" : (orientation === "vertical" ? "mullion" : "transom"),
      side: null, index: root ? null : entry && layout.indexOf(entry), vertex: null,
      lengthMm: length, widthMm: barFace(item, tech),
      label: item.shtulp ? "Штульп" : (root ? "Импост рамы" : "Импост секции"),
      shapeLabel: slanted ? "Косой" : "Прямой",
      joints: slanted ? "концы со сдвигом" : "ось внутри профилей",
      impostId: item.id, scope: root ? "root" : "pane", orientation,
      select: null,
    }));
  };
  state.vImposts.forEach((item) => pushBar(item, "vertical", true, null));
  state.hImposts.forEach((item) => pushBar(item, "horizontal", true, null));
  layout.forEach((entry) => {
    (entry.pane.innerImposts || []).forEach((item) => pushBar(item, item.orientation, false, entry));
  });
  members.push(...addonMemberList(tech, frames));
  const paneGlazingAreas = [];
  const paneGlassCounts = [];
  const paneBeadLengths = [];
  let glassUnits = 0;
  let bead = 0;
  const curved = state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs();
  layout.forEach((entry, index) => {
    if (entry.pane.split) return;
    const geo = glassGeometry(entry, tech);
    let paneArea = 0;
    let paneBead = 0;
    let count = 0;
    geo.fields.forEach((field) => {
      if (field.clearW <= 1e-6 || field.clearH <= 1e-6 || field.w <= 0 || field.h <= 0) return;
      const fitted = fittedGlass(entry, geo, field, tech);
      const area = curved ? (fitted.area ?? field.w * field.h) : field.w * field.h;
      if (area <= 1e-7) return;
      count += 1;
      paneArea += area;
      paneBead += fitted.boundary?.length >= 3 ? contourLength(fitted.boundary) : 2 * (field.w + field.h);
    });
    paneGlassCounts[index] = count;
    paneGlazingAreas[index] = paneArea / 1e6;
    paneBeadLengths[index] = paneBead / 1000;
    bead += paneBead;
    glassUnits += count;
  });
  const sum = (role) => members.filter((member) => member.role === role).reduce((total, member) => total + member.lengthMm, 0);
  const measured = state.shape === "circle" ? null : customFrameMeasures();
  const area = state.shape === "circle"
    ? Math.PI * (state.width / 2000) ** 2
    : measured ? measured.area : state.width * state.height / 1e6;
  const primaryImpost = members.filter((member) => member.role === "impost" && member.scope === "root").reduce((total, member) => total + member.lengthMm, 0);
  const nested = members.filter((member) => member.role === "impost" && member.scope === "pane");
  return {
    area,
    members,
    paneGlazingAreas,
    paneGlassCounts,
    paneBeadLengths,
    glassUnits,
    glazingArea: paneGlazingAreas.reduce((total, value) => total + (value || 0), 0),
    nestedCount: nested.length,
    totals: {
      frame: sum("frame"), sash: sum("sash"), impost: sum("impost"),
      primaryImpost, nestedImpost: nested.reduce((total, member) => total + member.lengthMm, 0),
      shtulp: sum("shtulp"), extender: sum("extender"), connector: sum("connector"), corner: sum("corner"), bead,
    },
  };
}
export function constructionModel() {
  const tech = getTechnology();
  const key = `${comparableCurrentState()}|${tech.frame}|${tech.sash}|${tech.impost}|${tech.shtulp}|${tech.extender}|${tech.connector}|${tech.corner}`;
  if (key === constructionKey && constructionCache) return constructionCache;
  constructionCache = buildConstruction();
  constructionKey = key;
  return constructionCache;
}
export function geometry() {
  const model = constructionModel();
  const meters = (value) => value / 1000;
  return {
    area: model.area,
    perimeter: meters(model.totals.frame),
    sash: meters(model.totals.sash),
    bead: meters(model.totals.bead),
    impost: meters(model.totals.impost),
    shtulp: meters(model.totals.shtulp),
    extender: meters(model.totals.extender),
    connector: meters(model.totals.connector),
    corner: meters(model.totals.corner),
    primaryImpost: meters(model.totals.primaryImpost),
    nestedImpost: meters(model.totals.nestedImpost),
    nestedCount: model.nestedCount,
    glassUnits: model.glassUnits,
    glazingArea: model.glazingArea,
    paneGlazingAreas: model.paneGlazingAreas,
    paneGlassCounts: model.paneGlassCounts,
    paneBeadLengths: model.paneBeadLengths,
    members: model.members,
    overall: overallSize(),
  };
}
