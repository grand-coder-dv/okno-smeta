(() => {
  "use strict";
  const svg = document.querySelector("#windowCanvas");
  if (!svg || typeof sectionPanes !== "function") return;
  let selected = new Map();
  let owner = state;
  const style = document.createElement("style");
  style.textContent = "#windowCanvas .impost-grip:not(.selected){display:none} #windowCanvas .impost-grip{pointer-events:none}";
  document.head.append(style);

  function reset() { selected.clear(); owner = state; }
  function reference(node) {
    const {scope, orientation, id, pane} = node.dataset;
    return {scope, orientation, id, ...(scope === "pane" ? {paneIndex:Number(pane)} : {})};
  }
  function key(ref) { return `${ref.scope}:${ref.orientation}:${ref.id}`; }
  const originalSelected = isSelectedImpost;
  isSelectedImpost = function(scope, orientation, id, paneIndex) {
    return originalSelected(scope, orientation, id, paneIndex) ||
      (owner === state && !!state.selectedImpost && selected.has(key({scope, orientation, id})));
  };
  const originalSelect = selectImpostFromNode;
  selectImpostFromNode = function(node) {
    reset();
    originalSelect(node);
  };
  function toggle(node) {
    if (owner !== state || !state.selectedImpost) reset();
    const previous = state.selectedImpost;
    const ref = reference(node);
    if (!selected.size && previous) selected.set(key(previous), previous);
    if (selected.has(key(ref))) selected.delete(key(ref));
    else selected.set(key(ref), ref);
    const last = selected.get(key(ref)) ?? [...selected.values()].at(-1);
    const keep = new Map(selected);
    if (last) {
      originalSelect({dataset:{scope:last.scope,orientation:last.orientation,id:last.id,pane:last.paneIndex}});
    } else {
      state.selectedImpost = null;
      state.selectedPane = null;
    }
    selected = keep;
    renderAll();
  }
  function multiPick(event) {
    const hit = event.target.closest?.(".impost-hit");
    if (!hit || !(event.ctrlKey || event.metaKey)) return;
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    if (event.type === "pointerdown" && event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggle(hit);
  }
  svg.addEventListener("pointerdown", multiPick, true);
  svg.addEventListener("keydown", multiPick, true);
  svg.addEventListener("click", event => {
    if (event.target === svg || event.target.closest?.(".pane-hit")) reset();
  }, true);
  svg.addEventListener("contextmenu", event => {
    if ((event.ctrlKey || event.metaKey) && event.target.closest?.(".impost-hit")) event.preventDefault();
  });

  function removeSelected() {
    const current = state.selectedImpost;
    const group = owner === state && selected.has(key(current)) ? [...selected.values()] : [current];
    const panes = sectionPanes();
    const targets = group.flatMap(ref => {
      const pane = ref.scope === "pane" ? panes[ref.paneIndex] : null;
      const items = pane ? pane.innerImposts : ref.scope === "root" ?
        (ref.orientation === "vertical" ? state.vImposts : state.hImposts) : [];
      const item = items.find(item => item.id === ref.id);
      return item ? [{pane, items, item, ref}] : [];
    });
    if (!targets.length) return;
    if (targets.some(({pane,item}) => pane?.split?.id === item.id && pane.children.some(child => child.split)) &&
        !window.confirm("Удалить выбранные импосты? При объединении будут удалены и вложенные проёмы.")) return;
    targets.sort((a,b) => (b.ref.paneIndex ?? -1) - (a.ref.paneIndex ?? -1));
    for (const {pane,items,item,ref} of targets) {
      if (pane?.split?.id === item.id) {
        const first = pane.children[0];
        pane.opening = first.opening;
        pane.hingeSide = first.hingeSide;
        pane.glass = first.glass;
        delete pane.split;
        delete pane.children;
        pane.innerImposts = [];
      } else if (ref.scope === "root") {
        removeRootImpost(ref.orientation,item.id);
      } else {
        const i = items.indexOf(item);
        if (i >= 0) items.splice(i,1);
      }
    }
    reset();
    if (typeof multiSections !== "undefined") multiSections.clear();
    if (typeof sharedAxis !== "undefined") sharedAxis = null;
    state.selectedImpost = null;
    state.selectedPane = null;
    ensurePanes();
    syncFormFromState();
    renderAll();
    showToast(`Импостов удалено: ${targets.length}`);
  }
  document.addEventListener("keydown", event => {
    if (event.key !== "Delete" || event.defaultPrevented || event.repeat) return;
    if (event.target.closest?.("input, textarea, select, button, dialog, [contenteditable]")) return;
    if (document.querySelector("dialog[open]")) return;
    if (state.selectedImpost) {
      event.preventDefault();
      removeSelected();
      return;
    }
    const panes = typeof selectedSections === "function"
      ? selectedSections().map(entry => entry.pane)
      : [sectionPanes()[state.selectedPane]];
    const sashes = panes.filter(pane => pane && !pane.split && pane.opening !== "fixed");
    if (!sashes.length) return;
    event.preventDefault();
    sashes.forEach(pane => { pane.opening = "fixed"; });
    renderAll();
    showToast(sashes.length === 1 ? "Проём стал глухим" : `Створок убрано: ${sashes.length}`);
  });
  renderAll();
})();
