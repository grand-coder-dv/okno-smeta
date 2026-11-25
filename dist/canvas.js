// Холст: сборка SVG текущего изделия.
function renderCanvas({ svg = $("#windowCanvas"), thumbnail = false } = {}) {
  const maxWidth = 455;
  const maxHeight = 350;
  const ratio = state.width / state.height;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  width = Math.max(width, 150);
  height = Math.max(height, 150);
  const x = 326 - width / 2;
  const y = 229 - height / 2;
  const tech = getTechnology();
  const sx=width/state.width, sy=height/state.height;
  const canvasScale=Math.min(sx,sy);
  const frame=tech.frame*canvasScale, impostFace=tech.impost*canvasScale;
  const X=mm=>x+mm*sx, Y=mm=>y+mm*sy;
  const material = MATERIALS[state.material];
  const profileColor = getFinish().color || material.frame;
  const impostBandPath = (x1, y1, x2, y2, face, active, extraClass = "") => {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1e-6) return "";
    const nx = -dy / len * face / 2, ny = dx / len * face / 2;
    const d = `M ${x1 + nx} ${y1 + ny} L ${x1 - nx} ${y1 - ny} L ${x2 - nx} ${y2 - ny} L ${x2 + nx} ${y2 + ny} Z`;
    return `<path class="impost-visible${extraClass}${active ? " selected" : ""}" d="${d}" fill="${active ? "#ef8b25" : profileColor}" stroke="${material.edge}" stroke-width=".8" />`;
  };
  const paths = shapePaths(x, y, width, height, frame);
  let profileTargets = state.shape === "circle" ? circleFrameTargets(x+width/2,y+height/2,width/2,height/2,frame) : "";
  const appendSashTargets = (outerSash, innerSash, index) => {
    if (!outerSash || !innerSash) return;
    if (state.shape === "circle" && outerSash.path && innerSash.path) {
      profileTargets += `<path d="${outerSash.path} ${innerSash.path}" fill="transparent" fill-rule="evenodd" pointer-events="fill" data-profile-edge="circle-sash" data-edge-side="0" data-edge-index="${index}" tabindex="0" role="button" aria-label="Створка" style="cursor:pointer"/>`;
      return;
    }
    if (!poly && (state.shape === "arch" || state.shape === "rect") && outerSash.edges && innerSash.edges) {
      profileTargets += profileEdgeTargets(outerSash, innerSash, "sash", index);
      return;
    }
    if (state.shape === "skew" && outerSash.boundary && innerSash.boundary) {
      profileTargets += poly
        ? polygonProfileTargets(outerSash.boundary, innerSash.boundary, "skew-sash", index, X, Y)
        : profileEdgeTargets(outerSash, innerSash, "skew-sash", index);
    }
  };
  const poly=constructionPolygon();
  const polygonOpening=poly ? polygonClip(poly,poly,tech.frame) : null;
  if(poly){
    paths.outer=`<path d="${polyPath(poly,X,Y)}"/>`;
    paths.inner=`<path d="${polyPath(polygonOpening,X,Y)}"/>`;
    if(state.shape==="skew") profileTargets=polygonProfileTargets(poly,polygonOpening,"polygon",null,X,Y);
  } else if (state.shape === "arch" || state.shape === "rect") {
    const arcs=state.shape === "arch" ? state.frameArcs : null;
    const outer=profileOutline([0,0,state.width,state.height],arcs,X,Y,sx,sy);
    const inset=getTechnology().frame;
    const inner=fittedOutline([inset,inset,state.width-inset,state.height-inset],[inset,inset,inset,inset],null,X,Y,sx,sy);
    if (state.width>2*inset && state.height>2*inset) profileTargets=profileEdgeTargets(outer,inner,"frame");
    if(Object.values(arcs||{}).some(Boolean)) {
      paths.outer=`<path d="${outer.path}" />`;
      paths.inner=`<path d="${inner.path}" />`;
    }
  } else if (state.shape === "skew") {
    const outer=profileOutline([0,0,state.width,state.height],null,X,Y,sx,sy);
    const inner=profileOutline([tech.frame,tech.frame,state.width-tech.frame,state.height-tech.frame],null,X,Y,sx,sy);
    if(state.width>2*tech.frame && state.height>2*tech.frame)profileTargets=profileEdgeTargets(outer,inner,"polygon");
  }
  const box = paths.innerBox;
  const vertices=state.shape==="skew" ? (poly||rectPoints([0,0,state.width,state.height])).map(([vx,vy],i)=>`<circle cx="${X(vx)}" cy="${Y(vy)}" r="6" fill="${activeProfileEdge?.owner===state&&activeProfileEdge.type==='vertex'&&activeProfileEdge.side===i?'#ef8b25':'#fff'}" stroke="#506176" data-profile-edge="vertex" data-edge-side="${i}" tabindex="0" role="button" aria-label="Угол ${i+1}" style="cursor:pointer"/>`).join("") : "";
  const rootVerticalX = state.vImposts.map((item) => x + (item.position / state.width) * width);
  const rootHorizontalY = state.hImposts.map((item) => y + (item.position / state.height) * height);
  const xBounds = [box.x, ...rootVerticalX, box.x + box.width];
  const yBounds = [box.y, ...rootHorizontalY, box.y + box.height];
  const paneRects = [];
  const dimensionGroups = new Map();
  const addDimension = (vertical, start, end, physicalOrigin, local, item, index = null) => {
    const absolute = physicalOrigin + local;
    const key = `${item.orientation}:${Math.round(absolute * 1000)}`;
    if (!dimensionGroups.has(key)) dimensionGroups.set(key, []);
    dimensionGroups.get(key).push({vertical,start,end,absolute,local,item,index,id:item.id});
  };

  let panesMarkup = "", localImpostsMarkup = "", nestedEndpointMarkup = "", sashMarkup = "", openingMarkup = "", glassMarkup = "", selectionMarkup = "";
  sectionLayout().forEach((entry,index) => {
    const {pane,rect:physical} = entry;
    const px=X(physical.x), py=Y(physical.y), paneWidth=physical.width*sx, paneHeight=physical.height*sy;
    paneRects[index] = { x: px, y: py, width: paneWidth, height: paneHeight, physicalWidth: physical.width, physicalHeight: physical.height };
    const glass = materialGlass()[pane.glass];
    const selected = index === state.selectedPane || multiSections.has(index);
    const paneKind = pane.opening === "fixed" ? "глухом проёме" : "створке";
    const paneImpostFace = impostFace;
    const sides=[entry.edges[2],entry.edges[1],entry.edges[3],entry.edges[0]];
    const hasFrameArc=sides.some((touch,i)=>touch&&frameCurve(i,tech.frame));
    const offsets=d=>sides.map(touch=>touch?d:null);
    const fit=(bounds,depth,arcs=null)=>fittedOutline(bounds,offsets(depth),arcs,X,Y,sx,sy);
    const border=(side,at,fallback)=>sides[side] ? (frameCurve(side,0)?.(at) ?? fallback) : fallback;
    const bounds=[physical.x,physical.y,physical.x+physical.width,physical.y+physical.height];
    const sectionPolygon=poly ? sectionContour(entry,poly,tech.frame) : null;
    const clippedCenter=(axis,at,fallback)=>{
      const range=sectionPolygon && outlineRange(sectionPolygon,axis,at);
      return range ? (range[0]+range[1])/2 : fallback;
    };
    let innerImpostsMarkup = "";

    pane.innerImposts.forEach((item) => {
      const active = isSelectedImpost("pane", item.orientation, item.id, index);
      const isVertical = item.orientation === "vertical";
      const lineX = px + item.position * paneWidth;
      const lineY = py + item.position * paneHeight;
      const physicalPosition = item.position * (isVertical ? physical.width : physical.height);
      const segment=poly ? impostSegment(item,item.orientation,physical,sectionPolygon) : null;
      const endA=segment ? [X(segment[0][0]),Y(segment[0][1])] : null;
      const endB=segment ? [X(segment[1][0]),Y(segment[1][1])] : null;
      const ribbon=segment && poly ? polyPath(impostRibbon(item,item.orientation,physical,sectionPolygon,barFace(item),false,sectionPolygon),X,Y) : "";
      if(active && segment)nestedEndpointMarkup += segment.map((point,end)=>`<circle class="impost-endpoint" style="cursor:pointer" data-endpoint="${end}" data-scope="pane" data-pane="${index}" data-orientation="${item.orientation}" data-id="${item.id}" cx="${X(point[0])}" cy="${Y(point[1])}" r="5" fill="#fff" stroke="#ef8b25" stroke-width="2.5" role="button" tabindex="0" aria-label="Изменить ${end?'второй':'первый'} край импоста"/>`).join("");
      const spans = poly ? null : nestedImpostSpans(entry, item, tech);
      const visible = ribbon ? "" : (spans || []).map(span => {
        const x1=X(span.x1), y1=Y(span.y1), x2=X(span.x2), y2=Y(span.y2);
        return impostBandPath(x1, y1, x2, y2, barFace(item) * canvasScale, active, " inner-impost-visible");
      }).join("");
      const hit = spans?.length
        ? {x1:X(spans[0].x1), y1:Y(spans[0].y1), x2:X(spans.at(-1).x2), y2:Y(spans.at(-1).y2)}
        : null;
      const endOffsets=item.endOffsets||[0,0];
      const slanted=endOffsets.some(Boolean);
      if (isVertical) {
        if(slanted){
          [0,1].forEach(end=>{
            const abs=physical.x+physicalPosition+(endOffsets[end]||0);
            addDimension(false, px, X(abs), physical.x, abs-physical.x, item, index);
          });
        } else addDimension(false, px, lineX, physical.x, physicalPosition, item, index);
        innerImpostsMarkup += `
          ${ribbon ? `<path class="impost-visible inner-impost-visible${active ? " selected" : ""}" d="${ribbon}" fill="${active ? "#ef8b25" : profileColor}" stroke="${material.edge}" stroke-width=".8" />` : visible}
          <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 7}" y="${Y(clippedCenter(0,physical.x+physicalPosition,physical.y+physical.height/2)) - 14}" width="14" height="28" rx="7" />
          <line class="impost-hit" data-scope="pane" data-pane="${index}" data-orientation="vertical" data-id="${item.id}" x1="${endA?.[0]??hit?.x1??lineX}" y1="${endA?.[1]??hit?.y1??py}" x2="${endB?.[0]??hit?.x2??lineX}" y2="${endB?.[1]??hit?.y2??py+paneHeight}" tabindex="0" role="slider" aria-label="Вертикальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          `;
      } else {
        if(slanted){
          [0,1].forEach(end=>{
            const abs=physical.y+physicalPosition+(endOffsets[end]||0);
            addDimension(true, py, Y(abs), physical.y, abs-physical.y, item, index);
          });
        } else addDimension(true, py, lineY, physical.y, physicalPosition, item, index);
        innerImpostsMarkup += `
          ${ribbon ? `<path class="impost-visible inner-impost-visible${active ? " selected" : ""}" d="${ribbon}" fill="${active ? "#ef8b25" : profileColor}" stroke="${material.edge}" stroke-width=".8" />` : visible}
          <rect class="impost-grip${active ? " selected" : ""}" x="${X(clippedCenter(1,physical.y+physicalPosition,physical.x+physical.width/2)) - 14}" y="${lineY - 7}" width="28" height="14" rx="7" />
          <line class="impost-hit horizontal" data-scope="pane" data-pane="${index}" data-orientation="horizontal" data-id="${item.id}" x1="${endA?.[0]??hit?.x1??px}" y1="${endA?.[1]??hit?.y1??lineY}" x2="${endB?.[0]??hit?.x2??px+paneWidth}" y2="${endB?.[1]??hit?.y2??lineY}" tabindex="0" role="slider" aria-label="Горизонтальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          `;
      }
    });

    if (pane.split) {
      if (pane.sashFill && pane.opening !== "fixed") {
        const shell=glassGeometry({...entry,pane:{...pane,innerImposts:[],split:null}},tech);
        const sashBox=shell.sashBox, opening=shell.opening;
        const depth=tech.frame-SASH_LAP;
        const outerBoundary=poly?clipSlantedSections(polygonClip(rectPoints(slantedBounds(sashBox,entry)),poly,depth),entry,Math.max(0,tech.impost/2-SASH_LAP)):null;
        const innerBoundary=poly?clipSlantedSections(polygonClip(rectPoints(slantedBounds(opening,entry)),poly,depth+tech.sash),entry,Math.max(0,tech.impost/2+tech.sash-SASH_LAP)):null;
        const outerSash=state.shape==="circle"?circularOutline(sashBox,depth,X,Y)
          : !poly ? fit(sashBox,depth,pane.sashArcs)
          : {path:polyPath(outerBoundary,X,Y),boundary:outerBoundary};
        const innerSash=state.shape==="circle"?circularOutline(opening,depth+tech.sash,X,Y)
          : !poly ? fit(opening,depth+tech.sash,pane.sashArcs)
          : {path:polyPath(innerBoundary,X,Y),boundary:innerBoundary};
        if(outerSash?.path && innerSash?.path){
          sashMarkup+=`<path d="${outerSash.path} ${innerSash.path}" fill="${profileColor}" fill-rule="evenodd" stroke="${material.edge}" stroke-width=".8" />`;
          appendSashTargets(outerSash, innerSash, index);
          const envelope=fittedGlass({...entry,pane:{...pane,innerImposts:[],split:null}},shell,shell.fields[0],tech,X,Y,sx,sy);
          if(envelope.boundary?.length && innerSash.boundary?.length && outerSash.boundary?.length){
            const mark=sashOpeningMark(envelope.boundary,outerSash.boundary,innerSash.boundary,pane.opening,pane.hingeSide,X,Y);
            openingMarkup+=`<g clip-path="url(#glassCutClip)">${mark.dashes}</g>${mark.handle}`;
          }
        }
        if (innerSash?.path) {
          const id=`sashImpostClip-${index}`;
          localImpostsMarkup += `<clipPath id="${id}"><path d="${innerSash.path}"/></clipPath><g clip-path="url(#${id})">${innerImpostsMarkup}</g>`;
        } else localImpostsMarkup += innerImpostsMarkup;
      } else localImpostsMarkup += innerImpostsMarkup;
      return;
    }
    const {opening,sashBox,fields} = glassGeometry(entry,tech);
    const sashArcs=state.shape==="arch" ? pane.sashArcs : null;
    const outerDepth=tech.frame-SASH_LAP, innerDepth=outerDepth+tech.sash;
    const sashOutline=(bounds,depth)=>{
      if(state.shape === "circle") return circularOutline(bounds,depth,X,Y);
      if(!poly)return fit(bounds,depth,sashArcs);
      const boundary=clipSlantedSections(polygonClip(rectPoints(slantedBounds(bounds,entry)),poly,depth),entry,
        Math.max(0,tech.impost/2-(depth===outerDepth?SASH_LAP:-tech.sash+SASH_LAP)));
      return {path:polyPath(boundary,X,Y),boundary};
    };
    const outerSash=sashBox && sashOutline(sashBox,outerDepth);
    const innerSash=sashBox && sashOutline(opening,innerDepth);
    if (innerSash) {
      const id=`sashImpostClip-${index}`;
      localImpostsMarkup += `<clipPath id="${id}"><path d="${innerSash.path}"/></clipPath><g clip-path="url(#${id})">${innerImpostsMarkup}</g>`;
    } else localImpostsMarkup += innerImpostsMarkup;
    appendSashTargets(outerSash, innerSash, index);
    if (outerSash?.path && innerSash?.path && opening[2]>opening[0] && opening[3]>opening[1]) {
      sashMarkup += `<path d="${outerSash.path} ${innerSash.path}" fill="${profileColor}" fill-rule="evenodd" stroke="${material.edge}" stroke-width=".8" />`;
      const envelopeEntry={...entry,pane:{...pane,innerImposts:[]}};
      const envelopeGeometry=glassGeometry(envelopeEntry,tech);
      const envelope=fittedGlass(envelopeEntry,envelopeGeometry,envelopeGeometry.fields[0],tech,X,Y,sx,sy);
      if(envelope.boundary?.length && innerSash.boundary?.length && outerSash.boundary?.length){
        const mark=sashOpeningMark(envelope.boundary,outerSash.boundary,innerSash.boundary,pane.opening,pane.hingeSide,X,Y);
        const clip=`opening-symbol-${index}`;
        openingMarkup+=`<clipPath id="${clip}"><path d="${envelope.path}"/></clipPath>
          <g clip-path="url(#${clip})">${mark.dashes}</g>${mark.handle}`;
      }
    }
    const center=sectionPolygon ? sectionPolygon.reduce(([a,b],[u,v])=>[a+u/sectionPolygon.length,b+v/sectionPolygon.length],[0,0]) : null;
    const paneCx=center ? X(center[0]) : px+paneWidth/2, paneCy=center ? Y(center[1]) : py+paneHeight/2;
    for (const f of fields) {
      if (f.clearW<=1e-6 || f.clearH<=1e-6) continue;
      const w=f.w*sx,h=f.h*sy;
      const fitted=fittedGlass(entry,{sashBox,opening},f,tech,X,Y,sx,sy);
      const glassPath=fitted.path;
      if(!glassPath) continue;
      if(selected) selectionMarkup += `<path class="pane-selected" d="${glassPath}" />`;
      const vertices=poly ? fitted.boundary : null;
      const center=vertices?.length ? vertices.reduce(([a,b],[u,v])=>[a+u/vertices.length,b+v/vertices.length],[0,0]) : null;
      const labelX=poly && fields.length===1 ? paneCx : center ? X(center[0]) : X(f.x)+w/2;
      const fieldY=center ? Y(center[1])+4 : Y(f.y)+h/2+Math.min(26,h/3);
      const labelY=poly && (fields.length===1 || (Math.abs(labelX-paneCx)<48 && Math.abs(fieldY-paneCy)<24)) ? paneCy+27 : fieldY;
      const font=Math.min(10,(poly?fitted.w*sx:w)/8,(poly?fitted.h*sy:h)/4);
      if (font>=4) {
        const sizeText=`${state.shape !== "circle" && !customProfileArcs() && !hasSlantedImposts() ? "" : "≈ "}${glassSizeLabel({...f,w:fitted.w,h:fitted.h})}`;
        const detail=(glass?.detail || "").trim();
        const detailFont=Math.min(font*0.9,9,(poly?fitted.h*sy:h)/5);
        glassMarkup += `<text x="${labelX}" y="${labelY}"
          text-anchor="middle" font-size="${font}" fill="#20384c" paint-order="stroke" stroke="#edf6fa" stroke-width="2">${sizeText}</text>`;
        if (detail && detailFont>=3.5) glassMarkup += `<text x="${labelX}" y="${labelY + font + 2}"
          text-anchor="middle" font-size="${detailFont}" fill="#355069" paint-order="stroke" stroke="#edf6fa" stroke-width="2">${escapeHtml(detail)}</text>`;
      }
    }
    if (poly && sectionPolygon.length<3) return;
    const paneOutline=poly ? polyPath(sectionPolygon,X,Y) : hasFrameArc ? fit([physical.x,physical.y,physical.x+physical.width,physical.y+physical.height],0).path : null;
    const areaAttrs=paneOutline?`d="${paneOutline}"`:`x="${px}" y="${py}" width="${paneWidth}" height="${paneHeight}"`;
    const tag=paneOutline?"path":"rect";
    panesMarkup += `
      <g class="pane" data-index="${index}" clip-path="url(#innerClip)">
        <${tag} ${areaAttrs} fill="${glass.color}" />
        <${tag} ${areaAttrs} fill="url(#glassSheen)" opacity="0.55" />
        <circle cx="${paneCx}" cy="${paneCy}" r="14" fill="rgba(255,255,255,.82)" stroke="rgba(53,80,105,.22)" />
        <text class="pane-number" x="${paneCx}" y="${paneCy+4}">${sectionNumber(index)}</text>
        <${tag} class="pane-hit" data-pane="${index}" ${areaAttrs} fill="transparent" tabindex="0" role="button" aria-label="Настроить проём ${index + 1}" />
      </g>`;
  });

  const rootGripCenter=(axis,at,fallback)=>{
    const range=polygonOpening && outlineRange(polygonOpening,axis,at);
    return range ? (axis===0?Y:X)((range[0]+range[1])/2) : fallback;
  };
  let rootImpostsMarkup = "", rootEndpointMarkup = "";
  state.vImposts.forEach((item, index) => {
    const lineX = rootVerticalX[index];
    const active = isSelectedImpost("root", "vertical", item.id);
    const segment=impostSegment(item,"vertical",{x:0,y:0,width:state.width,height:state.height},poly||rectPoints([0,0,state.width,state.height]),true);
    const ribbon=poly ? polyPath(impostRibbon(item,"vertical",{x:0,y:0,width:state.width,height:state.height},polygonOpening,barFace(item),true,poly),X,Y) : "";
    let ax=X(segment[0][0]), ay=Y(segment[0][1]), bx=X(segment[1][0]), by=Y(segment[1][1]);
    // Extend through the outer polygon; innerClip trims the visible face exactly at the frame's inner edge.
    const skewRange=poly && outlineRange(poly,0,item.position);
    const verticalFace=barFace(item)*canvasScale;
    const lineTop=skewRange ? Y(skewRange[0])-verticalFace : state.shape==="arch" && state.frameArcs?.[0] ? Y(frameCurve(0,0)?.(item.position) ?? 0) : box.y-2;
    const lineBottom=skewRange ? Y(skewRange[1])+verticalFace : state.shape==="arch" && state.frameArcs?.[2] ? Y(frameCurve(2,0)?.(item.position) ?? state.height) : box.y+box.height+2;
    if(!poly){ax=bx=lineX;ay=lineTop;by=lineBottom;}
    const vEnds=item.endOffsets||[0,0];
    if(vEnds.some(Boolean))[0,1].forEach(end=>{
      const abs=item.position+(vEnds[end]||0);
      addDimension(false, x, X(abs), 0, abs, item);
    });
    else addDimension(false, x, lineX, 0, item.position, item);
    if(active && poly) rootEndpointMarkup += segment.map((point,end)=>`<circle class="impost-endpoint" style="cursor:pointer" data-endpoint="${end}" data-scope="root" data-orientation="vertical" data-id="${item.id}" cx="${X(point[0])}" cy="${Y(point[1])}" r="5" fill="#fff" stroke="#ef8b25" stroke-width="2.5" role="button" tabindex="0" aria-label="Изменить ${end?'второй':'первый'} край импоста"/>`).join("");
    rootImpostsMarkup += `
      ${ribbon ? `<path class="impost-visible${active ? " selected" : ""}" d="${ribbon}" fill="${active ? "#ef8b25" : profileColor}" stroke="${material.edge}" stroke-width=".8" />` : impostBandPath(ax, ay, bx, by, verticalFace, active)}
      <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 8}" y="${rootGripCenter(0,item.position,box.y+box.height/2) - 18}" width="16" height="36" rx="8" />
      <line class="impost-hit" data-scope="root" data-orientation="vertical" data-id="${item.id}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" tabindex="0" role="slider" aria-label="Вертикальный импост рамы" aria-valuemin="0" aria-valuemax="${state.width}" aria-valuenow="${Math.round(item.position)}" />
      `;
  });
  state.hImposts.forEach((item, index) => {
    const lineY = rootHorizontalY[index];
    const active = isSelectedImpost("root", "horizontal", item.id);
    const segment=impostSegment(item,"horizontal",{x:0,y:0,width:state.width,height:state.height},poly||rectPoints([0,0,state.width,state.height]),true);
    const ribbon=poly ? polyPath(impostRibbon(item,"horizontal",{x:0,y:0,width:state.width,height:state.height},polygonOpening,barFace(item),true,poly),X,Y) : "";
    let ax=X(segment[0][0]), ay=Y(segment[0][1]), bx=X(segment[1][0]), by=Y(segment[1][1]);
    const skewRange=poly && outlineRange(poly,1,item.position);
    const horizontalFace=barFace(item)*canvasScale;
    const lineLeft=skewRange ? X(skewRange[0])-horizontalFace : state.shape==="arch" && state.frameArcs?.[3] ? X(frameCurve(3,0)?.(item.position) ?? 0) : box.x-2;
    const lineRight=skewRange ? X(skewRange[1])+horizontalFace : state.shape==="arch" && state.frameArcs?.[1] ? X(frameCurve(1,0)?.(item.position) ?? state.width) : box.x+box.width+2;
    if(!poly){ay=by=lineY;ax=lineLeft;bx=lineRight;}
    const hEnds=item.endOffsets||[0,0];
    if(hEnds.some(Boolean))[0,1].forEach(end=>{
      const abs=item.position+(hEnds[end]||0);
      addDimension(true, y, Y(abs), 0, abs, item);
    });
    else addDimension(true, y, lineY, 0, item.position, item);
    if(active && poly) rootEndpointMarkup += segment.map((point,end)=>`<circle class="impost-endpoint" style="cursor:pointer" data-endpoint="${end}" data-scope="root" data-orientation="horizontal" data-id="${item.id}" cx="${X(point[0])}" cy="${Y(point[1])}" r="5" fill="#fff" stroke="#ef8b25" stroke-width="2.5" role="button" tabindex="0" aria-label="Изменить ${end?'второй':'первый'} край импоста"/>`).join("");
    rootImpostsMarkup += `
      ${ribbon ? `<path class="impost-visible${active ? " selected" : ""}" d="${ribbon}" fill="${active ? "#ef8b25" : profileColor}" stroke="${material.edge}" stroke-width=".8" />` : impostBandPath(ax, ay, bx, by, horizontalFace, active)}
      <rect class="impost-grip${active ? " selected" : ""}" x="${rootGripCenter(1,item.position,box.x+box.width/2) - 18}" y="${lineY - 8}" width="36" height="16" rx="8" />
      <line class="impost-hit horizontal" data-scope="root" data-orientation="horizontal" data-id="${item.id}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" tabindex="0" role="slider" aria-label="Горизонтальный импост рамы" aria-valuemin="0" aria-valuemax="${state.height}" aria-valuenow="${Math.round(item.position)}" />
      `;
  });

  canvasLayout = { x, y, width, height, box, xBounds, yBounds, paneRects };
  const [gL,gT,gR,gB]=windowOuterBounds();
  const bx0=X(gL),by0=Y(gT),bx1=X(gR),by1=Y(gB);
  const actualWidth=gR-gL,actualHeight=gB-gT;
  const archedFrame=state.shape==="arch" && Object.values(state.frameArcs||{}).some(Boolean);
  const showShoulderWidth=archedFrame && Math.round(actualWidth)!==Math.round(state.width);
  const showShoulderHeight=archedFrame && Math.round(actualHeight)!==Math.round(state.height);
  const leftDimensionX=bx0-(showShoulderHeight?70:39);
  const bottomDimensionY=by1+(showShoulderWidth?70:39);
  const extraView=[];
  const dimNum=v=>numberFormatter.format(Math.round(v));
  const DIM_EXT=4, DIM_ROW=40, DIM_LABEL_MIN=24, DIM_LABEL_GAP=11, DIM_LABEL_ASCENT=16;
  const dimLabelHalf=text=>Math.max(DIM_LABEL_MIN,String(text).length*4.2);
  const dimPerp=(dx,dy)=>{const l=Math.hypot(dx,dy)||1;return[-dy/l,dx/l];};
  const dimLine=(x1,y1,x2,y2)=>`<line class="dimension-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)" />`;
  const dimTextAt=(cx,cy,text,angle=0)=>`<text class="dimension-text" x="${cx}" y="${cy}" transform="${angle?`rotate(${angle} ${cx} ${cy})`:""}" paint-order="stroke" stroke="#f5f8fb" stroke-width="4" pointer-events="none">${text}</text>`;
  const gostDimension=(horizontal,from,to,contourCoord,dimCoord,text,attrs="")=>{
    const lo=Math.min(from,to), hi=Math.max(from,to), mid=(lo+hi)/2;
    const away=dimCoord>=contourCoord?1:-1;
    const extFar=dimCoord+away*DIM_EXT;
    let body="", tx, ty, tAngle=0;
    if(horizontal){
      body+=`<line class="dimension-line dimension-extension" x1="${lo}" y1="${contourCoord}" x2="${lo}" y2="${extFar}" />
        <line class="dimension-line dimension-extension" x1="${hi}" y1="${contourCoord}" x2="${hi}" y2="${extFar}" />`;
      body+=dimLine(lo,dimCoord,hi,dimCoord);
      tx=mid; ty=dimCoord-DIM_LABEL_GAP;
      extraView.push([lo,extFar],[hi,extFar],[tx,ty-DIM_LABEL_ASCENT-4]);
    } else {
      body+=`<line class="dimension-line dimension-extension" x1="${contourCoord}" y1="${lo}" x2="${extFar}" y2="${lo}" />
        <line class="dimension-line dimension-extension" x1="${contourCoord}" y1="${hi}" x2="${extFar}" y2="${hi}" />`;
      body+=dimLine(dimCoord,lo,dimCoord,hi);
      tAngle=-90;
      tx=away<0?dimCoord-DIM_LABEL_GAP:dimCoord+DIM_LABEL_GAP+DIM_LABEL_ASCENT;
      ty=mid;
      extraView.push([extFar,lo],[extFar,hi],[dimCoord+away*(DIM_LABEL_GAP+DIM_LABEL_ASCENT+4),ty]);
    }
    const half=dimLabelHalf(text);
    const hit=`${attrs?`<g ${attrs} style="cursor:pointer">`:""}<rect x="${horizontal?mid-half:tx-DIM_LABEL_ASCENT-4}" y="${horizontal?ty-DIM_LABEL_ASCENT-2:mid-half}" width="${horizontal?half*2:DIM_LABEL_ASCENT+8}" height="${horizontal?DIM_LABEL_ASCENT+6:half*2}" fill="transparent" pointer-events="all" />${attrs?"</g>":""}`;
    return `${body}${dimTextAt(tx,ty,text,tAngle)}${hit}`;
  };
  const shoulderDimension=(a,b,c,d,value,title,side=null,angle=0)=>{
    const mx=(c[0]+d[0])/2,my=(c[1]+d[1])/2;
    extraView.push(c,d,[mx-61,my-61],[mx+61,my+61]);
    const ext=(p,q)=>`<line class="dimension-line dimension-extension" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" />`;
    const dx=d[0]-c[0], dy=d[1]-c[1];
    const [nx,ny]=dimPerp(dx,dy);
    const label=dimNum(value);
    const textAbove = -11;
    const tx = mx - nx * textAbove, ty = my - ny * textAbove;
    return `${ext(a,c)}${ext(b,d)}${dimLine(c[0],c[1],d[0],d[1])}${dimTextAt(tx,ty,label,angle)}
      <g transform="translate(${mx} ${my}) rotate(${angle})"
        ${side===null?'pointer-events="none"':`data-profile-length="${side}" tabindex="0" role="button" aria-label="${title}" style="cursor:pointer"`}>
        <title>${title}</title><rect x="-56" y="-14" width="112" height="28" fill="transparent" /></g>`;
  };
  let shoulderMarkup="";
  if(showShoulderWidth) shoulderMarkup+=shoulderDimension([x,y+height],[x+width,y+height],[x,by1+37],[x+width,by1+37],state.width,"Ширина по плечам");
  if(showShoulderHeight) shoulderMarkup+=shoulderDimension([x,y],[x,y+height],[bx0-37,y],[bx0-37,y+height],state.height,"Высота до плеча",null,-90);
  if(poly) for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    const selected=activeProfileEdge?.owner===state && activeProfileEdge.type==="polygon" && activeProfileEdge.side===i;
    const dxModel=Math.abs(b[0]-a[0]),dyModel=Math.abs(b[1]-a[1]);
    const eps=1e-6;
    const fullWidth=dyModel<eps && Math.abs(dxModel-actualWidth)<eps;
    const fullHeight=dxModel<eps && Math.abs(dyModel-actualHeight)<eps;
    if(!selected && (fullWidth || fullHeight)) continue;
    if(a&&b){
      const p=[X(a[0]),Y(a[1])],q=[X(b[0]),Y(b[1])];
      const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
      if(length>0){
        const n=[dy/length,-dx/length];
        const distance=76+Math.max(0,...poly.map(([u,v])=>(X(u)-p[0])*n[0]+(Y(v)-p[1])*n[1]));
        const shift=pt=>pt.map((v,k)=>v+distance*n[k]);
        let angle=Math.atan2(dy,dx)*180/Math.PI;
        if(angle>90)angle-=180;else if(angle< -90)angle+=180;
        shoulderMarkup+=shoulderDimension(p,q,shift(p),shift(q),Math.hypot(b[0]-a[0],b[1]-a[1]),"Изменить длину стороны",i,angle);
      }
    }
  }
  if (state.shape !== "skew") {
    constructionModel().members.filter((member) => member.role === "frame" && (member.kind === "arc" || member.kind === "ring")).forEach((member) => {
      let px = state.width / 2;
      let py = -18;
      if (member.kind !== "ring") {
        const chain = frameSideChain(member.side);
        if (!chain?.length) return;
        const mid = chain[Math.floor((chain.length - 1) / 2)];
        const dx = mid[0] - state.width / 2;
        const dy = mid[1] - state.height / 2;
        const span = Math.hypot(dx, dy) || 1;
        px = mid[0] + dx / span * 22;
        py = mid[1] + dy / span * 22;
      }
      shoulderMarkup += `<text class="dimension-text" x="${X(px)}" y="${Y(py)}" text-anchor="middle" font-size="11" fill="#20384c" paint-order="stroke" stroke="#f5f8fb" stroke-width="4">${dimNum(member.lengthMm)}</text>`;
      extraView.push([X(px), Y(py)]);
    });
  }
  const axisGroups = [...dimensionGroups.values()];
  const axisEntries = axisGroups.map((group, i) => {
    const first = group[0], {vertical, end} = first;
    const start = vertical ? y + height : x;
    const lo = Math.min(start, end), hi = Math.max(start, end);
    const value = Math.round(vertical ? state.height - first.absolute : first.absolute);
    return {group, i, vertical, start, end, lo, hi, span: hi - lo, value, common: group.length > 1};
  });
  const axisMarkup = [false, true].flatMap(vertical =>
    axisEntries.filter(e => e.vertical === vertical).sort((a, b) => a.span - b.span || a.value - b.value)
      .map((entry, level) => {
        const text = `${entry.value}`;
        const edge = vertical ? bx1 + 5 : by0 - 5;
        const track = edge + (vertical ? 1 : -1) * (18 + level * DIM_ROW);
        const attrs = `data-axis-group="${entry.i}" tabindex="0" role="button" aria-label="Изменить ${entry.common ? "общий " : ""}осевой размер ${text} мм"`;
        return `<g>${gostDimension(!vertical, entry.start, entry.end, edge, track, text, attrs)}</g>`;
      })
  ).join("");
  const trackDepth = [0, 0];
  [false, true].forEach(vertical => {
    const n = axisEntries.filter(e => e.vertical === vertical).length;
    if (n) trackDepth[Number(vertical)] = n - 1;
  });
  canvasLayout.axisGroups = axisGroups;
  const viewTop=Math.min(0,by0-40-trackDepth[0]*DIM_ROW,...extraView.map(p=>p[1]));
  const viewRight=Math.max(640,bx1+40+trackDepth[1]*DIM_ROW,...extraView.map(p=>p[0]));
  const viewLeft=Math.min(0,leftDimensionX-21,...extraView.map(p=>p[0]));
  const viewBottom=Math.max(500,bottomDimensionY+21,...extraView.map(p=>p[1]));
  const fitWidth = viewRight - viewLeft;
  const fitHeight = viewBottom - viewTop;
  const fitCenterX = (viewLeft + viewRight) / 2;
  const fitCenterY = (viewTop + viewBottom) / 2;
  const zoom = thumbnail ? 1 : canvasZoom;
  const viewW = fitWidth / zoom;
  const viewH = fitHeight / zoom;
  const offsetChain = (points, width) => {
    if (!points || points.length < 2 || !(width > 0)) return [];
    const center = [state.width / 2, state.height / 2];
    return points.map((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next[0] - previous[0];
      const dy = next[1] - previous[1];
      const length = Math.hypot(dx, dy) || 1;
      let nx = -dy / length;
      let ny = dx / length;
      if ((point[0] - center[0]) * nx + (point[1] - center[1]) * ny < 0) { nx = -nx; ny = -ny; }
      return [point[0] + nx * width, point[1] + ny * width];
    });
  };
  let addonMarkup = "";
  const stacks = {};
  (state.addons || []).forEach((addon) => {
    if (addon.role !== "extender" && addon.role !== "connector" && addon.role !== "corner") return;
    const dash = addon.role === "connector" ? 'stroke-dasharray="4 3"' : "";
    if (addon.role === "corner") {
      const corners = state.shape === "skew" ? (polygonPoints() || rectPoints([0, 0, state.width, state.height])) : [[0, 0], [state.width, 0], [state.width, state.height], [0, state.height]];
      const point = corners[addon.vertex];
      if (!point) return;
      const size = pieceWidth("corner");
      let nx = point[0] - state.width / 2;
      let ny = point[1] - state.height / 2;
      const span = Math.hypot(nx, ny) || 1;
      nx /= span; ny /= span;
      addonMarkup += `<path d="${polyPath([point, [point[0] - ny * size, point[1] + nx * size], [point[0] + nx * size - ny * size, point[1] + ny * size + nx * size], [point[0] + nx * size, point[1] + ny * size]], X, Y)}" fill="${profileColor}" stroke="${material.edge}" stroke-width=".8"/>`;
      return;
    }
    if (state.shape === "circle" && addon.side === "ring") {
      const width = pieceWidth(addon.role);
      const base = stacks.ring || 0;
      const inner = state.width / 2 + base;
      const outer = inner + width;
      stacks.ring = outer - state.width / 2;
      const cx = X(state.width / 2);
      const cy = Y(state.height / 2);
      addonMarkup += `<path d="M ${cx - outer * sx} ${cy} A ${outer * sx} ${outer * sy} 0 1 1 ${cx + outer * sx} ${cy} A ${outer * sx} ${outer * sy} 0 1 1 ${cx - outer * sx} ${cy} M ${cx - inner * sx} ${cy} A ${inner * sx} ${inner * sy} 0 1 0 ${cx + inner * sx} ${cy} A ${inner * sx} ${inner * sy} 0 1 0 ${cx - inner * sx} ${cy} Z" fill="${profileColor}" fill-rule="evenodd" stroke="${material.edge}" stroke-width=".8" ${dash}/>`;
      return;
    }
    const chain = frameSideChain(addon.side);
    if (!chain) return;
    const width = pieceWidth(addon.role);
    const base = stacks[addon.side] || 0;
    const inner = base ? offsetChain(chain, base) : chain;
    const outer = offsetChain(chain, base + width);
    stacks[addon.side] = base + width;
    if (outer.length < 2 || inner.length < 2) return;
    addonMarkup += `<path d="${polyPath([...inner, ...outer.slice().reverse()], X, Y)}" fill="${profileColor}" stroke="${material.edge}" stroke-width=".8" ${dash}/>`;
  });
  svg.setAttribute("viewBox", `${fitCenterX - viewW / 2} ${fitCenterY - viewH / 2} ${viewW} ${viewH}`);
  svg.innerHTML = `
    <defs>
      <filter id="windowShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#122238" flood-opacity="0.2" />
      </filter>
      <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.75" />
        <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.1" />
        <stop offset="1" stop-color="#5da3bf" stop-opacity="0.24" />
      </linearGradient>
      <clipPath id="innerClip">${paths.inner}</clipPath>
      <clipPath id="glassCutClip">${paths.outer}</clipPath>
      <marker id="dimArrow" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="10" refY="5" orient="auto-start-reverse">
        <path d="M10 5 L0 1.5 L0 8.5 Z" fill="#8996a8" stroke="none" />
      </marker>
    </defs>
    ${addonMarkup}
    <g filter="url(#windowShadow)" fill="${profileColor}" stroke="${material.edge}" stroke-width="2.2">${paths.outer}</g>
    <g fill="#bfe3ef" stroke="${material.edge}" stroke-width="1.6">${paths.inner}</g>
    <g clip-path="url(#innerClip)">${panesMarkup}</g>
    <g clip-path="url(#innerClip)">${localImpostsMarkup}</g>
    <g clip-path="url(#innerClip)">${rootImpostsMarkup}</g>
    <g clip-path="url(#glassCutClip)" pointer-events="none">${sashMarkup}${glassMarkup}</g>
    <g clip-path="url(#glassCutClip)" pointer-events="none">${openingMarkup}</g>
    <g clip-path="url(#glassCutClip)" pointer-events="none">${selectionMarkup}</g>
    <g>${rootEndpointMarkup}${nestedEndpointMarkup}</g>
    <g>${profileTargets}${vertices}</g>
    <g class="dimensions">${shoulderMarkup}</g>
    <g class="dimensions">${axisMarkup}
      ${gostDimension(true,bx0,bx1,by1,bottomDimensionY,`${state.shape === "circle" ? "Ø " : ""}${dimNum(actualWidth)}`,'data-window-dimension="width" tabindex="0" role="button" aria-label="Изменить габаритную ширину. Верхняя и нижняя поперечины"')}
      ${gostDimension(false,by0,by1,bx0,leftDimensionX,dimNum(actualHeight),`data-window-dimension="${state.shape === "circle" ? "width" : "height"}" tabindex="0" role="button" aria-label="${state.shape === "circle" ? "Диаметр равен ширине" : "Изменить габаритную высоту. Левая и правая стойки"}"`)}
    </g>`;

  if (thumbnail) {
    // Keep the actual rendered frame, glass, sashes and imposts; omit editor controls.
    svg.querySelectorAll(".dimensions, .pane-hit, .pane-selected, .impost-hit, .impost-grip, [data-profile-edge], [data-profile-length], circle, text").forEach(node => node.remove());
    svg.querySelectorAll("[data-pane], [data-axis-group]").forEach(node => {
      node.removeAttribute("tabindex");
      node.removeAttribute("role");
    });
    const contour=poly || (state.shape === "arch" ? profileOutline([0,0,state.width,state.height],state.frameArcs,X,Y,sx,sy).boundary : rectPoints([0,0,state.width,state.height]));
    const [minX,minY,maxX,maxY]=polyBounds(contour);
    const padding=Math.max(12,tech.frame*canvasScale*0.3);
    svg.setAttribute("viewBox", `${X(minX)-padding} ${Y(minY)-padding} ${(maxX-minX)*sx+padding*2} ${(maxY-minY)*sy+padding*2}`);
    return;
  }

  updateCanvasZoomButtons();

  $$("#windowCanvas .pane-hit").forEach((node) => {
    const choose = event => {
      const index = Number(node.dataset.pane);
      if ((event.ctrlKey || event.metaKey) && !state.selectedImpost) {
        if (!multiSections.size && state.selectedPane !== null) multiSections.add(state.selectedPane);
        if (multiSections.has(index)) multiSections.delete(index);
        else multiSections.add(index);
        state.selectedPane = multiSections.has(index) ? index : ([...multiSections].at(-1) ?? null);
      } else {
        multiSections.clear();
        state.selectedPane = index;
      }
      activeProfileEdge = null;
      sharedAxis = null;
      state.selectedImpost = null;
      renderAll();
    };
    node.addEventListener("click", choose);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(event);
      }
    });
  });

  $$("#windowCanvas .impost-hit").forEach((node) => {
    node.addEventListener("keydown", (event) => {
      const vertical = node.dataset.orientation === "vertical";
      const backward = vertical ? event.key === "ArrowLeft" : event.key === "ArrowUp";
      const forward = vertical ? event.key === "ArrowRight" : event.key === "ArrowDown";
      if (!backward && !forward && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectImpostFromNode(node);
      if (backward || forward) moveSelectedImpostBy((forward ? 1 : -1) * (event.shiftKey ? 50 : 10));
      renderAll();
    });
  });
}
