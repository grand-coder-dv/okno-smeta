(() => {
  const toolbar = document.querySelector("#editorHistory");
  if (!toolbar || toolbar.querySelector("[data-editor-tool]")) return;
  const tools = [
    ["sash", "Добавить поворотно-откидную створку", '<path d="M5 5l13 7-13 7M5 19l7-14 7 14"/><path d="M18 10v4"/>'],
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
    buttons.forEach(button => { button.disabled = !hasSection; });
  };
  group.addEventListener("click", event => {
    const button = event.target.closest("[data-editor-tool]");
    if (!button || button.disabled || state.selectedImpost || !selectedSections().length) return;
    const tool = button.dataset.editorTool;
    if (tool === "sash") {
      const select = document.querySelector("#openingType");
      select.value = "tiltturn";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      addInnerImpost(tool);
    }
  });
  const draw = renderAll;
  renderAll = function (...args) {
    const result = draw.apply(this, args);
    refresh();
    return result;
  };
  refresh();
})();
