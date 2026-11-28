import { addInnerImpost, canAddInnerImpost } from "./canvas-input.js";
import { onAfterRender, renderAll } from "./editor-ui.js";
import { applyPaneChanges, openingAllowed, sectionOpeningPanes, selectedSections, state } from "./product.js";

const sashTools = new Set(["tiltturn", "turn", "tilt"]);

export function installEditorTools() {
  const group = document.querySelector("#canvasEditTools");
  if (!group || group.childElementCount) return;
  const tools = [
    ["tiltturn", "Добавить поворотно-откидную створку (двойной щелчок — сменить направление)", '<path d="M5 5l13 7-13 7M5 19l7-14 7 14"/><path d="M18 10v4"/>'],
    ["turn", "Добавить поворотную створку (двойной щелчок — сменить направление)", '<path d="M5 5l13 7-13 7"/>'],
    ["tilt", "Добавить откидную створку (двойной щелчок — сменить направление)", '<path d="M5 19l7-14 7 14"/>'],
    ["horizontal", "Добавить горизонтальный импост", '<path d="M4 12h16" stroke-width="2.5"/>'],
    ["vertical", "Добавить вертикальный импост", '<path d="M12 4v16" stroke-width="2.5"/>'],
  ];
  group.innerHTML = tools.map(([id,label,icon]) => `<button type="button" class="canvas-edit-btn" data-editor-tool="${id}"
    title="${label}" aria-label="${label}" hidden>
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/>${icon}</svg></button>`).join("");
  const buttons = [...group.querySelectorAll("button")];
  const refresh = () => {
    const sections = state.selectedImpost ? [] : selectedSections();
    const panes = sectionOpeningPanes(sections);
    buttons.forEach(button => {
      const tool = button.dataset.editorTool;
      const available = sashTools.has(tool)
        ? panes.length > 0 && openingAllowed(tool) &&
          !applyPaneChanges(panes.map(pane => ({pane, values:{opening:tool}})), {preview:true})
        : canAddInnerImpost(tool, sections);
      button.hidden = !available;
    });
    group.hidden = buttons.every(button => button.hidden);
  };
  group.addEventListener("click", event => {
    const button = event.target.closest("[data-editor-tool]");
    if (!button || button.hidden || state.selectedImpost) return;
    const tool = button.dataset.editorTool;
    if (sashTools.has(tool)) {
      const select = document.querySelector("#openingType");
      select.value = tool;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      addInnerImpost(tool);
    }
  });
  group.addEventListener("dblclick", event => {
    const button = event.target.closest("[data-editor-tool]");
    const tool = button?.dataset.editorTool;
    if (!button || button.hidden || state.selectedImpost || !sashTools.has(tool)) return;
    const targets = sectionOpeningPanes();
    if (!targets.length) return;
    targets.forEach(pane => {
      if (pane.opening !== tool) return;
      pane.hingeSide = tool === "tilt"
        ? (pane.hingeSide === "top" ? "bottom" : "top")
        : (pane.hingeSide === "right" ? "left" : "right");
    });
    renderAll();
  });
  onAfterRender(refresh);
  refresh();
}
