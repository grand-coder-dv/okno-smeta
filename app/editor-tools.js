import { addInnerImpost } from "./canvas-input.js";
import { onAfterRender, renderAll } from "./editor-ui.js";
import { openingAllowed, selectedSections, state } from "./product.js";
export function installEditorTools() {
  const toolbar = document.querySelector("#editorHistory");
  if (!toolbar || toolbar.querySelector("[data-editor-tool]")) return;
  const tools = [
    ["tiltturn", "Добавить поворотно-откидную створку (двойной щелчок — сменить направление)", '<path d="M5 5l13 7-13 7M5 19l7-14 7 14"/><path d="M18 10v4"/>'],
    ["turn", "Добавить поворотную створку (двойной щелчок — сменить направление)", '<path d="M5 5l13 7-13 7"/>'],
    ["tilt", "Добавить откидную створку (двойной щелчок — сменить направление)", '<path d="M5 19l7-14 7 14"/>'],
    ["horizontal", "Добавить горизонтальный импост", '<path d="M4 12h16" stroke-width="2.5"/>'],
    ["vertical", "Добавить вертикальный импост", '<path d="M12 4v16" stroke-width="2.5"/>'],
  ];
  const group = document.createElement("div");
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Добавить элементы окна");
  group.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
  group.innerHTML = tools.map(([id,label,icon]) => `<button type="button" class="button ghost" data-editor-tool="${id}"
    title="${label}" aria-label="${label}" style="min-width:42px;padding:6px 9px;justify-content:center">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/>${icon}</svg></button>`).join("");
  toolbar.append(group);
  const buttons = [...group.querySelectorAll("button")];
  const refresh = () => {
    const hasSection = !state.selectedImpost && selectedSections().length > 0;
    buttons.forEach(button => {
      const blocked = ["tiltturn", "turn", "tilt"].includes(button.dataset.editorTool) && !openingAllowed(button.dataset.editorTool);
      button.hidden = blocked;
      button.disabled = blocked || !hasSection;
      if (blocked) button.style.setProperty("display", "none", "important");
      else button.style.removeProperty("display");
    });
  };
  group.addEventListener("click", event => {
    const button = event.target.closest("[data-editor-tool]");
    if (!button || button.disabled || state.selectedImpost || !selectedSections().length) return;
    const tool = button.dataset.editorTool;
    if (["tiltturn", "turn", "tilt"].includes(tool)) {
      if (!openingAllowed(tool)) return;
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
    if (!tool || !["tiltturn", "turn", "tilt"].includes(tool) || !openingAllowed(tool)) return;
    const targets = selectedSections();
    if (!targets.length) return;
    targets.forEach(({pane}) => {
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
