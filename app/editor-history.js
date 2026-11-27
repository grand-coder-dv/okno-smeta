import { setActiveProfileEdge } from "./drawing.js";
import { onAfterRender, renderAll, syncFormFromState } from "./editor-ui.js";
import { ensurePanes } from "./geometry.js";
import { comparableCurrentState, dragState, multiSections, replaceState, setConfigurationError, setSharedAxis, state } from "./product.js";
export function installEditorHistory() {
  const canvas = document.querySelector("#windowCanvas");
  const wrap = document.querySelector("#canvasWrap");
  if (!canvas || !wrap || document.querySelector("#editorHistory")) return;

  const toolbar = document.createElement("div");
  toolbar.id = "editorHistory";
  toolbar.setAttribute("role", "group");
  toolbar.setAttribute("aria-label", "История действий редактора");
  toolbar.style.cssText = "display:flex;justify-content:flex-start;flex-wrap:wrap;gap:8px;margin:0 0 10px";
  toolbar.innerHTML = `<button type="button" class="button ghost" data-history="undo" title="Отменить (Ctrl+Z)">↶ Назад</button>
    <button type="button" class="button ghost" data-history="redo" title="Повторить (Ctrl+Shift+Z)">↷ Вперёд</button>`;
  wrap.before(toolbar);
  const undo = toolbar.querySelector('[data-history="undo"]');
  const redo = toolbar.querySelector('[data-history="redo"]');
  const limit = 80;
  const previous = [], next = [];
  const snapshot = () => comparableCurrentState(state);
  let owner = state, current = snapshot(), restoring = false;
  const refresh = () => { undo.disabled = !previous.length; redo.disabled = !next.length; };

  function record() {
    if (restoring) return;
    const value = snapshot();
    if (owner !== state) {
      owner = state;
      previous.length = next.length = 0;
      current = value;
    } else if (!dragState && value !== current) {
      previous.push(current);
      if (previous.length > limit) previous.shift();
      next.length = 0;
      current = value;
    }
    refresh();
  }

  onAfterRender(record);
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    canvas.addEventListener(type, () => { setTimeout(record, 0); });
  }

  function go(backward) {
    if (dragState || restoring) return false;
    record();
    const from = backward ? previous : next, to = backward ? next : previous;
    if (!from.length) return false;
    const target = from.pop();
    to.push(current);
    restoring = true;
    try {
      replaceState({ ...JSON.parse(target), selectedPane: null, selectedImpost: null });
      owner = state;
      multiSections.clear();
      setSharedAxis(null);
      setActiveProfileEdge(null);
      ensurePanes();
      syncFormFromState();
      setConfigurationError();
      renderAll();
      current = snapshot();
    } finally {
      restoring = false;
      refresh();
    }
    return true;
  }

  undo.addEventListener("click", () => go(true));
  redo.addEventListener("click", () => go(false));
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
    const key = event.code;
    if (key !== "KeyZ" && key !== "KeyY") return;
    if (go(key === "KeyZ" && !event.shiftKey)) event.preventDefault();
  });
  refresh();
}
