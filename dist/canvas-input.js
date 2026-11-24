// Холст: выбор, перетаскивание импостов и выравнивание стеклопакетов.
function selectImpostFromNode(node) {
  if(activeImpostEndpoint && (activeImpostEndpoint.id!==node.dataset.id || activeImpostEndpoint.scope!==node.dataset.scope)) activeImpostEndpoint=null;
  multiSections.clear();
  sharedAxis = null;
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

function moveSelectedImpostBy(deltaMm) {
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

function bindCanvasDragging() {
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
      activeImpostEndpoint={owner:state,id:node.dataset.id,orientation:node.dataset.orientation,
        scope:node.dataset.scope,paneIndex:Number(node.dataset.pane),end:Number(node.dataset.endpoint)};
      activeProfileEdge=null;
    } else {
      const type=node.dataset.profileEdge;
      activeImpostEndpoint=null;
      activeProfileEdge={owner:state,type,index:(type==="sash"||type==="skew-sash")?Number(node.dataset.edgeIndex):null,side:Number(node.dataset.edgeSide)};
    }
    refreshProfileEdit();
    const button=$("#editProfileGeometry");
    if(!button.hidden && !button.disabled)button.click();
  },true);
  svg.addEventListener("click", event=>{
    const point=event.target.closest?.(".impost-endpoint");
    if(!point)return;
    event.preventDefault();
    activeImpostEndpoint={owner:state,id:point.dataset.id,orientation:point.dataset.orientation,
      scope:point.dataset.scope,paneIndex:Number(point.dataset.pane),end:Number(point.dataset.endpoint)};
    activeProfileEdge=null;
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
      activeImpostEndpoint=null;
      const type=hit.dataset.profileEdge;
      activeProfileEdge={owner:state,type,index:(type==="sash"||type==="skew-sash")?Number(hit.dataset.edgeIndex):null,side:Number(hit.dataset.edgeSide)};
      state.selectedPane=null;state.selectedImpost=null;multiSections.clear();sharedAxis=null;
      renderAll();
    }
    else if(activeProfileEdge && !event.target.closest?.("[data-profile-length]")){activeProfileEdge=null; if(event.target===svg)renderAll();}
  };
  svg.addEventListener("click",openProfile);
  svg.addEventListener("keydown",event=>{if(event.key==="Enter" || event.key===" ")openProfile(event);});
  const editDimension = event => {
    const target = event.target.closest?.("[data-axis-group], [data-window-dimension], [data-profile-length]");
    if (!target) return;
    event.preventDefault();
    if(target.hasAttribute("data-profile-length")){editPolygon({type:"length",side:Number(target.dataset.profileLength)});return;}
    let field = target.dataset.windowDimension;
    if (!field) {
      const group = canvasLayout.axisGroups[Number(target.dataset.axisGroup)];
      if (!group?.length) return;
      const first = group[0];
      selectImpostFromNode({dataset:{scope:first.index == null ? "root" : "pane", pane:first.index,
        orientation:first.item.orientation, id:first.id}});
      sharedAxis = group;
      renderAll();
      field = "impostPosition";
    }
    const input = $(`#${field}`);
    input.focus();
    try { input.select(); } catch {}
  };
  svg.addEventListener("click", editDimension);
  svg.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") editDimension(event); });
  svg.addEventListener("click", event => {
    if (event.target !== svg || (state.selectedPane === null && !state.selectedImpost)) return;
    multiSections.clear();
    sharedAxis = null;
    state.selectedPane = null;
    state.selectedImpost = null;
    renderAll();
  });
  svg.addEventListener("pointerdown", (event) => {
    const node = event.target.closest?.(".impost-hit");
    if (!node) return;
    event.preventDefault();
    selectImpostFromNode(node);
    dragState = { pointerId: event.pointerId };
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
    dragState = null;
    document.body.style.cursor = "";
    try {
      svg.releasePointerCapture(event.pointerId);
    } catch {}
  };
  svg.addEventListener("pointerup", finishDrag);
  svg.addEventListener("pointercancel", finishDrag);
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

function addInnerImpost(orientation) {
  const targets = selectedSections();
  if (!targets.length) return;
  if (targets.some(({pane}) => pane.innerImposts.length)) {
    showToast("В секции уже есть импост старого типа. Удалите его перед новой разбивкой, чтобы сохранить размеры стеклопакетов.");
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
  multiSections = new Set(changed.map(({pane}) => panes.indexOf(pane.children[0])));
  state.selectedPane = [...multiSections][0];
  state.selectedImpost = null;
  sharedAxis = null;
  renderAll();
  showToast(`Импостов добавлено: ${changed.length}`);
}
function equalizeSelectedGlass(axis) {
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
      showToast("Выберите секции без дополнительных импостов внутри стеклопакета.");return;
    }
    let group=groups.find(g=>Math.abs(g.start-coordinate(entry))<0.01 && Math.abs(g.end-coordinate(entry)-length(entry))<0.01);
    if(!group){group={start:coordinate(entry),end:coordinate(entry)+length(entry),entries:[]};groups.push(group);}
    group.entries.push(entry);
  }
  groups.sort((a,b)=>a.start-b.start);
  if(groups.length<2 || groups.some((g,i)=>i && Math.abs(g.start-groups[i-1].end)>0.01)){
    showToast("Выберите соседние секции для равной разбивки.");return;
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
    if(!matches.length){showToast("Не найден импост между выбранными секциями.");return;}
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
