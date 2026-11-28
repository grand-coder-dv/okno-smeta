// Холст: выбор, перетаскивание импостов и выравнивание стеклопакетов.
import { cancelCanvasPaneHold } from "./canvas.js";
import { activeImpostEndpoint, activeProfileEdge, commitOverallDimension, editPolygon, overallSize, refreshProfileEdit, setActiveImpostEndpoint, setActiveProfileEdge } from "./drawing.js";
import { renderAll, showToast } from "./editor-ui.js";
import { createImpostId, getPanePhysicalRect, getSelectedImpostRecord, glassGeometry, nestedImpostLimits, rootImpostLimits, sectionLayout, sectionPanes } from "./geometry.js";
import { $, canvasLayout, canvasZoom, clamp, dragState, getTechnology, impostPositionOrigin, multiSections, selectedSections, setCanvasZoom, setDragState, setMultiSections, setSharedAxis, sharedAxis, state, validateCurrentProduct } from "./product.js";
const CANVAS_ZOOM_MIN = 0.5;
const CANVAS_ZOOM_MAX = 4;
const CANVAS_ZOOM_STEP = 1.25;
const CANVAS_PAN_THRESHOLD = 4;
const canvasViewOffset = { x: 0, y: 0 };

function clampCanvasZoom(value) {
  return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, value));
}

function updateCanvasZoomButtons() {
  const zoomIn = $("#canvasZoomIn");
  const zoomOut = $("#canvasZoomOut");
  if (!zoomIn || !zoomOut) return;
  zoomIn.disabled = canvasZoom >= CANVAS_ZOOM_MAX - 1e-6;
  zoomOut.disabled = canvasZoom <= CANVAS_ZOOM_MIN + 1e-6;
}

export function setCanvasViewBox(svg, x, y, width, height) {
  if (svg.id !== "windowCanvas") {
    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    return;
  }
  const viewWidth = width / canvasZoom;
  const viewHeight = height / canvasZoom;
  const viewX = x + (width - viewWidth) / 2 + canvasViewOffset.x;
  const viewY = y + (height - viewHeight) / 2 + canvasViewOffset.y;
  svg.setAttribute("viewBox", `${viewX} ${viewY} ${viewWidth} ${viewHeight}`);
}

function moveCanvasView(svg, zoom, from, to = from) {
  const view = svg.viewBox.baseVal;
  const { x, y, width, height } = view;
  const nextZoom = clampCanvasZoom(zoom);
  const ratio = canvasZoom / nextZoom;
  const nextWidth = width * ratio;
  const nextHeight = height * ratio;
  let nextX = x + (width - nextWidth) / 2;
  let nextY = y + (height - nextHeight) / 2;
  if (from) {
    // Keep the drawing point at the gesture origin under the cursor or the moving pinch midpoint.
    const matrix = svg.getScreenCTM()?.inverse();
    if (!matrix) return;
    const anchor = new DOMPoint(from.clientX, from.clientY).matrixTransform(matrix);
    const destination = new DOMPoint(to.clientX, to.clientY).matrixTransform(matrix);
    nextX = anchor.x - (destination.x - x) * ratio;
    nextY = anchor.y - (destination.y - y) * ratio;
  }
  if (nextZoom === canvasZoom && nextX === x && nextY === y) return;
  canvasViewOffset.x += nextX - x + (nextWidth - width) / 2;
  canvasViewOffset.y += nextY - y + (nextHeight - height) / 2;
  setCanvasZoom(nextZoom);
  svg.setAttribute("viewBox", `${nextX} ${nextY} ${nextWidth} ${nextHeight}`);
  updateCanvasZoomButtons();
}

function pinchPosition(touches) {
  const [first, second] = touches.values();
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
    distance: Math.max(1, Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)),
  };
}

export function bindCanvasNavigation() {
  const svg = $("#windowCanvas");
  const wrap = $("#canvasWrap");
  const touches = new Map();
  let pan = null;
  let pinching = false;
  let suppressClick = false;
  const isBackground = target => target === svg || target === wrap;
  const isDrawing = target => target === wrap || svg.contains(target);
  const stopPan = () => {
    pan = null;
    wrap.classList.remove("is-panning");
  };

  $("#canvasZoomIn")?.addEventListener("click", () => moveCanvasView(svg, canvasZoom * CANVAS_ZOOM_STEP));
  $("#canvasZoomOut")?.addEventListener("click", () => moveCanvasView(svg, canvasZoom / CANVAS_ZOOM_STEP));
  updateCanvasZoomButtons();
  wrap.addEventListener("wheel", event => {
    if (!isDrawing(event.target) || !event.deltaY) return;
    event.preventDefault();
    if (dragState || pan || pinching) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? wrap.clientHeight : 1;
    const steps = clamp(-event.deltaY * unit / 100, -4, 4);
    moveCanvasView(svg, canvasZoom * CANVAS_ZOOM_STEP ** steps, event);
  }, { passive: false });

  wrap.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !isDrawing(event.target)) return;
    if (!pan && !pinching) suppressClick = false;
    if (event.pointerType === "touch") {
      touches.set(event.pointerId, event);
      if (touches.size >= 2) {
        pinching = true;
        suppressClick = true;
        stopPan();
        cancelCanvasPaneHold();
        if (dragState && touches.has(dragState.pointerId)) stopImpostDrag();
        for (const id of touches.keys()) wrap.setPointerCapture(id);
        event.stopPropagation();
        return;
      }
    }
    if (pinching || pan || dragState || !isBackground(event.target)) return;
    pan = { id: event.pointerId, position: event };
    event.target.setPointerCapture(event.pointerId);
  }, true);

  wrap.addEventListener("pointermove", event => {
    if (touches.has(event.pointerId)) {
      const previous = touches.size >= 2 ? pinchPosition(touches) : null;
      touches.set(event.pointerId, event);
      if (pinching) {
        if (previous) {
          const current = pinchPosition(touches);
          moveCanvasView(svg, canvasZoom * current.distance / previous.distance, previous, current);
        }
        return;
      }
    }
    if (pan?.id !== event.pointerId) return;
    const previous = pan.position;
    if (!suppressClick && Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY) < CANVAS_PAN_THRESHOLD) return;
    suppressClick = true;
    wrap.classList.add("is-panning");
    moveCanvasView(svg, canvasZoom, previous, event);
    pan.position = event;
  });

  const finishNavigation = event => {
    if (pan?.id === event.pointerId) stopPan();
    touches.delete(event.pointerId);
    if (!touches.size) pinching = false;
  };
  window.addEventListener("pointerup", finishNavigation, true);
  window.addEventListener("pointercancel", finishNavigation, true);
  wrap.addEventListener("lostpointercapture", event => {
    if (pan?.id === event.pointerId || event.target === wrap) finishNavigation(event);
  });
  wrap.addEventListener("click", event => {
    if (!suppressClick || !event.detail || !isDrawing(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
const impostSelectGuards = [];
export function beforeSelectImpost(guard) { impostSelectGuards.push(guard); }
export function applyImpostSelection(node) {
  if(activeImpostEndpoint && (activeImpostEndpoint.id!==node.dataset.id || activeImpostEndpoint.scope!==node.dataset.scope)) setActiveImpostEndpoint(null);
  setActiveProfileEdge(null);
  multiSections.clear();
  setSharedAxis(null);
  const scope = node.dataset.scope;
  const paneIndex = scope === "pane" ? Number(node.dataset.pane) : null;
  state.selectedImpost = {
    scope,
    orientation: node.dataset.orientation,
    id: node.dataset.id,
    ...(scope === "pane" ? { paneIndex } : {}),
  };
  if (scope === "pane") state.selectedPane = paneIndex;
}
export function selectImpostFromNode(node) {
  for (const guard of impostSelectGuards) guard(node);
  applyImpostSelection(node);
}

export function moveSelectedImpostBy(deltaMm) {
  const record = getSelectedImpostRecord();
  if (!record) return;
  if (record.selected.scope === "root") {
    const limits = rootImpostLimits(record.item, record.selected.orientation);
    record.item.position = clamp(Math.round((record.item.position + deltaMm) / 10) * 10, limits.min, limits.max);
    return;
  }
  const physical = getPanePhysicalRect(record.selected.paneIndex);
  const size = record.selected.orientation === "vertical" ? physical.width : physical.height;
  const limits = nestedImpostLimits(record.item, record.pane);
  const nextMm = record.item.position * size + deltaMm;
  record.item.position = Math.min(Math.max(nextMm / size, limits.min), limits.max);
}

function moveSelectedImpostToPoint(point) {
  const record = getSelectedImpostRecord();
  if (!record || !canvasLayout) return;
  const vertical = record.selected.orientation === "vertical";
  if (record.selected.scope === "root") {
    const visualStart = vertical ? canvasLayout.x : canvasLayout.y;
    const visualSize = vertical ? canvasLayout.width : canvasLayout.height;
    const physicalSize = vertical ? state.width : state.height;
    const coordinate = vertical ? point.x : point.y;
    const raw = ((coordinate - visualStart) / visualSize) * physicalSize;
    const limits = rootImpostLimits(record.item, record.selected.orientation);
    record.item.position = Math.min(Math.max(Math.round(raw / 10) * 10, limits.min), limits.max);
    return;
  }
  const paneRect = canvasLayout.paneRects[record.selected.paneIndex];
  if (!paneRect) return;
  const visualStart = vertical ? paneRect.x : paneRect.y;
  const visualSize = vertical ? paneRect.width : paneRect.height;
  const physicalSize = vertical ? paneRect.physicalWidth : paneRect.physicalHeight;
  const coordinate = vertical ? point.x : point.y;
  const rawMm = ((coordinate - visualStart) / visualSize) * physicalSize;
  const limits = nestedImpostLimits(record.item, record.pane);
  record.item.position = Math.min(Math.max(Math.round(rawMm / 10) * 10 / physicalSize, limits.min), limits.max);
}

function getCanvasPoint(event) {
  const svg = $("#windowCanvas");
  const matrix = svg.getScreenCTM();
  return matrix ? new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()) : {x:0,y:0};
}

function stopImpostDrag() {
  setDragState(null);
  document.body.style.cursor = "";
}

export function bindCanvasDragging() {
  const svg = $("#windowCanvas");
  let lastEditableClick=null;
  svg.addEventListener("click", event=>{
    const node=event.target.closest?.(".impost-endpoint, [data-profile-edge]");
    if(!node)return;
    const key=node.matches(".impost-endpoint")
      ? `impost:${node.dataset.scope}:${node.dataset.id}:${node.dataset.endpoint}`
      : `profile:${node.dataset.profileEdge}:${node.dataset.edgeIndex||""}:${node.dataset.edgeSide}`;
    const now=Date.now();
    const doubleClick=event.detail>=2 || lastEditableClick?.key===key && now-lastEditableClick.time<550
      && Math.hypot(event.clientX-lastEditableClick.x,event.clientY-lastEditableClick.y)<24;
    lastEditableClick={key,time:now,x:event.clientX,y:event.clientY};
    if(!doubleClick)return;
    lastEditableClick=null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(node.matches(".impost-endpoint")){
      if(state.shape!=="skew")return;
      setActiveImpostEndpoint({owner:state,id:node.dataset.id,orientation:node.dataset.orientation,
        scope:node.dataset.scope,paneIndex:Number(node.dataset.pane),end:Number(node.dataset.endpoint)});
      setActiveProfileEdge(null);
    } else {
      const type=node.dataset.profileEdge;
      setActiveImpostEndpoint(null);
      setActiveProfileEdge({owner:state,type,index:(type==="sash"||type==="skew-sash")?Number(node.dataset.edgeIndex):null,side:Number(node.dataset.edgeSide)});
    }
    refreshProfileEdit();
    const button=$("#editProfileGeometry");
    if(!button.hidden && !button.disabled)button.click();
  },true);
  svg.addEventListener("click", event=>{
    const point=event.target.closest?.(".impost-endpoint");
    if(!point)return;
    event.preventDefault();
    setActiveImpostEndpoint({owner:state,id:point.dataset.id,orientation:point.dataset.orientation,
      scope:point.dataset.scope,paneIndex:Number(point.dataset.pane),end:Number(point.dataset.endpoint)});
    setActiveProfileEdge(null);
    refreshProfileEdit();
  });
  svg.addEventListener("keydown",event=>{
    if(event.key!=="Enter" && event.key!==" ")return;
    const point=event.target.closest?.(".impost-endpoint");
    if(point){event.preventDefault();point.click();}
  });
  const openProfile = event => {
    const hit=event.target.closest?.("[data-profile-edge]");
    if(hit){
      event.preventDefault();
      setActiveImpostEndpoint(null);
      const type=hit.dataset.profileEdge;
      setActiveProfileEdge({owner:state,type,index:(type==="sash"||type==="skew-sash")?Number(hit.dataset.edgeIndex):null,side:Number(hit.dataset.edgeSide)});
      state.selectedPane=null;state.selectedImpost=null;multiSections.clear();setSharedAxis(null);
      renderAll();
    }
    else if(activeProfileEdge && !event.target.closest?.("[data-profile-length]")){setActiveProfileEdge(null); if(event.target===svg)renderAll();}
  };
  svg.addEventListener("click",openProfile);
  svg.addEventListener("keydown",event=>{if(event.key==="Enter" || event.key===" ")openProfile(event);});
  const editDimension = event => {
    const target = event.target.closest?.("[data-axis-group], [data-window-dimension], [data-profile-length]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if(target.hasAttribute("data-profile-length")){editPolygon({type:"length",side:Number(target.dataset.profileLength)});return;}
    const field = target.dataset.windowDimension;
    const box = target.getBoundingClientRect();
    if (!field) {
      const group = canvasLayout.axisGroups[Number(target.dataset.axisGroup)];
      if (!group?.length) return;
      const first = group[0];
      const verticalLine = first.vertical;
      const shown = Math.round(verticalLine ? state.height - first.absolute : first.absolute);
      selectImpostFromNode({dataset:{scope:first.index == null ? "root" : "pane", pane:first.index,
        orientation:first.item.orientation, id:first.id}});
      setSharedAxis(group);
      openInlineDimension(box, shown, verticalLine, value => {
        const orientation = first.item.orientation;
        const verticalImpost = orientation === "vertical";
        const dimension = verticalImpost ? state.width : state.height;
        const absolute = verticalImpost ? value : dimension - value;
        const reverse = impostPositionOrigin[orientation] === "end";
        const form = $("#impostPosition");
        form.value = String(Math.round(reverse ? dimension - absolute : absolute));
        form.dispatchEvent(new Event("change"));
      });
      return;
    }
    const verticalLine = field === "height";
    const shown = Math.round(overallSize()[field]);
    openInlineDimension(box, shown, verticalLine, value => {
      const form = $(`#${field}`);
      form.value = String(Math.round(value));
      commitOverallDimension(field, form);
    });
  };
  svg.addEventListener("click", editDimension);
  svg.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") editDimension(event); });
  svg.addEventListener("click", event => {
    if (event.target !== svg || (state.selectedPane === null && !state.selectedImpost)) return;
    multiSections.clear();
    setSharedAxis(null);
    state.selectedPane = null;
    state.selectedImpost = null;
    renderAll();
  });
  svg.addEventListener("pointerdown", (event) => {
    const node = event.target.closest?.(".impost-hit");
    if (!node || dragState) return;
    event.preventDefault();
    selectImpostFromNode(node);
    setDragState({ pointerId: event.pointerId });
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {}
    document.body.style.cursor = node.dataset.orientation === "vertical" ? "col-resize" : "row-resize";
    renderAll();
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const record=getSelectedImpostRecord();
    const prior=record?.item.position;
    moveSelectedImpostToPoint(getCanvasPoint(event));
    if (record && state.shape === "circle" && validateCurrentProduct()) record.item.position=prior;
    renderAll();
  });
  const finishDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    stopImpostDrag();
    try {
      svg.releasePointerCapture(event.pointerId);
    } catch {}
  };
  svg.addEventListener("pointerup", finishDrag);
  svg.addEventListener("pointercancel", finishDrag);
}

function openInlineDimension(box, value, vertical, commit) {
  const wrap = $("#canvasWrap");
  let input = $("#inlineDimension");
  if (!input) {
    input = document.createElement("input");
    input.id = "inlineDimension";
    input.type = "number";
    input.step = "1";
    input.inputMode = "numeric";
    wrap.append(input);
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); input.blur(); }
      if (event.key === "Escape") { event.preventDefault(); input.dataset.skip = "1"; input.blur(); }
    });
    input.addEventListener("blur", () => {
      const apply = input._commit;
      const skip = input.dataset.skip === "1";
      const next = input.valueAsNumber;
      input.hidden = true;
      input._commit = null;
      if (!skip && apply && Number.isFinite(next)) apply(next);
    });
  }
  input.dataset.skip = "";
  input._commit = commit;
  input.value = String(Math.round(value));
  const host = wrap.getBoundingClientRect();
  const long = Math.max(76, (vertical ? box.height : box.width) + 16);
  input.style.width = `${long}px`;
  input.style.height = "28px";
  const cx = box.left - host.left + box.width / 2;
  const cy = box.top - host.top + box.height / 2;
  input.style.left = `${cx - long / 2}px`;
  input.style.top = `${cy - 14}px`;
  input.style.transform = vertical ? "rotate(-90deg)" : "";
  input.hidden = false;
  input.focus({ preventScroll: true });
  input.select();
}

function largestGapPosition(items) {
  const positions = [0, ...items.map((item) => item.position).sort((a, b) => a - b), 1];
  let best = { gap: 0, position: 0.5 };
  for (let index = 0; index < positions.length - 1; index += 1) {
    const gap = positions[index + 1] - positions[index];
    if (gap > best.gap) best = { gap, position: positions[index] + gap / 2 };
  }
  return best.position;
}

export function addInnerImpost(orientation) {
  const targets = selectedSections();
  if (!targets.length) return;
  if (targets.some(({pane}) => pane.innerImposts.length)) {
    showToast("В проёме уже есть импост старого типа. Удалите его перед новой разбивкой, чтобы сохранить размеры стеклопакетов.");
    return;
  }
  const vertical = orientation === "vertical";
  const start = rect => vertical ? rect.x : rect.y;
  const size = rect => vertical ? rect.width : rect.height;
  const commonStart = Math.max(...targets.map(({rect}) => start(rect)));
  const commonEnd = Math.min(...targets.map(({rect}) => start(rect) + size(rect)));
  const axis = (commonStart + commonEnd) / 2;
  const changed = targets.map(({pane, rect}) => {
    const old = pane.innerImposts;
    const item = {id:createImpostId("pane", orientation), orientation,
      position:commonEnd > commonStart ? (axis - start(rect)) / size(rect) : 0.5};
    pane.split = item;
    if (pane.opening !== "fixed") pane.sashFill = true;
    pane.innerImposts = [item];
    pane.children = [
      {opening:"fixed", glass:pane.glass, innerImposts:[]},
      {opening:"fixed", glass:pane.glass, innerImposts:[]},
    ];
    return {pane, old};
  });
  const issue = validateCurrentProduct();
  if (issue) {
    changed.forEach(({pane,old}) => { delete pane.split; delete pane.children; delete pane.sashFill; pane.innerImposts = old; });
    showToast(issue);
    return;
  }
  const panes = sectionPanes();
  setMultiSections(new Set(changed.map(({pane}) => panes.indexOf(pane.children[0]))));
  state.selectedPane = [...multiSections][0];
  state.selectedImpost = null;
  setSharedAxis(null);
  renderAll();
  showToast(`Импостов добавлено: ${changed.length}`);
}
export function equalizeSelectedGlass(axis) {
  const entries=selectedSections();
  const horizontal=axis==="horizontal";
  const coordinate=e=>horizontal?e.rect.y:e.rect.x;
  const length=e=>horizontal?e.rect.height:e.rect.width;
  const limit=horizontal?state.height:state.width;
  const selected=new Set(entries.map(e=>e.pane));
  const initialLayout=sectionLayout();
  const descendants=pane=>pane.split?pane.children.flatMap(descendants):[pane];
  const independent=initialLayout.filter(e=>e.pane.split?.orientation===axis &&
    descendants(e.pane).every(p=>selected.has(p)));
  if(independent.length && entries.length===independent.reduce((sum,e)=>sum+descendants(e.pane).length,0)){
    const changes=[], targets=[];
    for(const parent of independent){
      const sides=parent.pane.children.map(child=>descendants(child).map(pane=>initialLayout.find(e=>e.pane===pane)));
      const offsets=sides.map(side=>side.map(e=>{
        const field=glassGeometry(e).fields[0];return (horizontal?field.h:field.w)-length(e);
      }));
      if(offsets.some(values=>values.some(value=>Math.abs(value-values[0])>0.5))){
        showToast("В одном ряду различаются профили или створки стеклопакетов.");return;
      }
      targets.push((length(parent)+offsets[0][0]+offsets[1][0])/2);
      changes.push({item:parent.pane.split,size:length(parent),bias:offsets[0][0],old:parent.pane.split.position});
    }
    if(targets.some(value=>Math.abs(value-targets[0])>0.5)){
      showToast("Для этих рядов размеры стеклопакетов несовместимы.");return;
    }
    const target=targets.reduce((sum,value)=>sum+value,0)/targets.length;
    changes.forEach(({item,size,bias})=>{item.position=(target-bias)/size;});
    const issue=validateCurrentProduct();
    const actual=sectionLayout().filter(e=>selected.has(e.pane)).map(e=>{
      const field=glassGeometry(e).fields[0];return horizontal?field.h:field.w;
    });
    if(issue || changes.some(({item,size})=>item.position*size<getTechnology().impost ||
        (1-item.position)*size<getTechnology().impost) || Math.max(...actual)-Math.min(...actual)>1){
      changes.forEach(({item,old})=>{item.position=old;});
      showToast(issue||"Не удалось выровнять все выбранные стеклопакеты.");return;
    }
    renderAll();showToast(`Стеклопакеты выровнены по ${horizontal?"высоте":"ширине"}`);return;
  }
  const groups=[];
  for(const entry of entries){
    if(entry.pane.split || entry.pane.innerImposts.length){
      showToast("Выберите проёмы без дополнительных импостов внутри стеклопакета.");return;
    }
    let group=groups.find(g=>Math.abs(g.start-coordinate(entry))<0.01 && Math.abs(g.end-coordinate(entry)-length(entry))<0.01);
    if(!group){group={start:coordinate(entry),end:coordinate(entry)+length(entry),entries:[]};groups.push(group);}
    group.entries.push(entry);
  }
  groups.sort((a,b)=>a.start-b.start);
  if(groups.length<2 || groups.some((g,i)=>i && Math.abs(g.start-groups[i-1].end)>0.01)){
    showToast("Выберите соседние проёмы для равной разбивки.");return;
  }
  const glass=e=>{const field=glassGeometry(e).fields[0];return horizontal?field.h:field.w;};
  const biases=groups.map(group=>{
    const values=group.entries.map(e=>glass(e)-length(e));
    return values.every(v=>Math.abs(v-values[0])<0.5)?values[0]:null;
  });
  if(biases.includes(null)){
    showToast("В одном столбце различаются профили или створки стеклопакетов.");return;
  }
  const layout=sectionLayout(), items=horizontal?state.hImposts:state.vImposts;
  const boundaries=groups.slice(0,-1).map(group=>group.end);
  const changes=[];
  for(const boundary of boundaries){
    const matches=[];
    items.forEach(item=>{if(Math.abs(item.position-boundary)<0.01)matches.push({item,root:true});});
    layout.forEach(entry=>{
      if(entry.pane.split?.orientation!==axis)return;
      const splitAt=coordinate(entry)+length(entry)*entry.pane.split.position;
      if(Math.abs(splitAt-boundary)<0.01)matches.push({item:entry.pane.split,pane:entry.pane,root:false});
    });
    if(!matches.length){showToast("Не найден импост между выбранными проёмами.");return;}
    changes.push(matches);
  }
  const target=(groups.at(-1).end-groups[0].start+biases.reduce((sum,v)=>sum+v,0))/groups.length;
  let next=groups[0].start;
  const positions=groups.slice(0,-1).map((_,i)=>(next+=target-biases[i]));
  const originals=new Map(changes.flat().map(({item})=>[item,item.position]));
  const rollback=()=>originals.forEach((position,item)=>{item.position=position;});
  // Root boundaries move first. Nested positions are then measured in their updated parent rectangles.
  changes.forEach((matches,i)=>matches.filter(m=>m.root).forEach(({item})=>{item.position=positions[i];}));
  const nested=changes.flatMap((matches,i)=>matches.filter(m=>!m.root).map(m=>({...m,at:positions[i]})));
  nested.sort((a,b)=>layout.findIndex(e=>e.pane===a.pane)-layout.findIndex(e=>e.pane===b.pane));
  for(const {item,pane,at} of nested){
    const parent=sectionLayout().find(e=>e.pane===pane);
    item.position=(at-coordinate(parent))/length(parent);
  }
  const issue=validateCurrentProduct();
  const current=sectionLayout().filter(e=>selected.has(e.pane)).map(glass);
  const gap=getTechnology().impost;
  const invalid=items.some((item,i)=>item.position<=(i?items[i-1].position:0)+gap ||
    item.position>=(i<items.length-1?items[i+1].position:limit)-gap) ||
    nested.some(({item,pane})=>{
      const size=length(sectionLayout().find(e=>e.pane===pane));
      return item.position*size<gap || (1-item.position)*size<gap;
    });
  if(issue || invalid || Math.max(...current)-Math.min(...current)>1){
    rollback();showToast(issue||"Не удалось выровнять все выбранные стеклопакеты.");return;
  }
  renderAll();showToast(`Стеклопакеты выровнены по ${horizontal?"высоте":"ширине"}`);
}
