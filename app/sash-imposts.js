(() => {
  if (typeof addInnerImpost !== "function" || typeof glassGeometry !== "function") return;
  const original = addInnerImpost;
  addInnerImpost = function (orientation) {
    const entries = selectedSections();
    if (!entries.some(({pane}) => pane.opening !== "fixed")) return original(orientation);
    const v = orientation === "vertical";
    const tech = getTechnology();
    const targets = [];
    for (const entry of entries) {
      const {pane, rect} = entry;
      const start = v ? rect.x : rect.y;
      const length = v ? rect.width : rect.height;
      const isSash = pane.opening !== "fixed";
      const [l,t,r,b] = glassGeometry(entry, tech).opening;
      const lo = v ? l : t, hi = v ? r : b;
      const axes = pane.innerImposts.filter(item => item.orientation === orientation)
        .map(item => start + length * item.position).sort((a,b) => a-b);
      const gaps = [lo, ...axes, hi].slice(0,-1).map((a,i) => {
        const b = i < axes.length ? axes[i] : hi;
        const half = tech.impost/2;
        return [a + 120 + half + (i ? half : 0), b - 120 - half - (i < axes.length ? half : 0)];
      }).filter(([a,b]) => a<=b);
      const slots = isSash ? gaps : [[start,start+length]];
      if (!slots.length) return showToast("В створке недостаточно места для ещё одного импоста этого направления");
      targets.push({pane,start,length,isSash,slots});
    }
    let shared = targets[0].slots;
    for (const target of targets.slice(1)) {
      shared = shared.flatMap(([a,b]) => target.slots.map(([c,d]) => [Math.max(a,c),Math.min(b,d)]).filter(([l,r])=>l<=r));
    }
    const center = slots => {
      const best = slots.reduce((a,b)=>a[1]-a[0]>=b[1]-b[0]?a:b);
      return (best[0]+best[1])/2;
    };
    const axis = shared.length ? center(shared) : null;
    const changed = targets.map(target => {
      const {pane,isSash,start,length,slots} = target;
      const old = pane.innerImposts;
      const item = {id:createImpostId("pane", orientation),orientation,position:((axis ?? center(slots))-start)/length};
      if (isSash) pane.innerImposts = [...old,item];
      else {
        pane.split = item;
        pane.innerImposts = [item];
        pane.children = [0,1].map(()=>({opening:"fixed",glass:pane.glass,innerImposts:[]}));
      }
      return {pane,old,isSash};
    });
    const issue = validateCurrentProduct();
    if (issue) {
      changed.forEach(({pane,old,isSash})=>{pane.innerImposts=old;if(!isSash){delete pane.split;delete pane.children;}});
      return showToast(issue);
    }
    const panes=sectionPanes();
    multiSections.clear();
    changed.forEach(({pane,isSash})=>multiSections.add(panes.indexOf(isSash?pane:pane.children[0])));
    state.selectedPane=[...multiSections][0];
    state.selectedImpost=null;
    sharedAxis=null;
    renderAll();
    showToast(changed.length===1 ? "Импост добавлен внутрь створки" : `Импостов добавлено: ${changed.length}`);
  };
})();
