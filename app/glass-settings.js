import { MATERIALS, PRODUCT_TYPES, glassApplication, glassCatalog, glassCatalogKey, profileTypeSettings, programStorageSet, setGlassCatalog, standardGlassCatalog } from "./catalog.js";
import { renderAll, showToast } from "./editor-ui.js";
import { partTitle } from "./parts-settings.js";
import { $, createCatalogId, escapeHtml, state } from "./product.js";
import { allParts, compatibleParts } from "./profile-parts.js";

let draft;

function openCatalog(catalog) {
  const groups = new Map();
  for (const [material, entries] of Object.entries(catalog)) {
    for (const [id, item] of Object.entries(entries)) {
      const { name, detail = "", rate = null, color } = item;
      // Keep distinct legacy variants and retain their IDs in saved orders.
      const group = item.catalogId || JSON.stringify([id, name, detail, rate, color]);
      if (!groups.has(group)) {
        groups.set(group, {
          id: item.catalogId || createCatalogId("glass"), name, detail, rate, color,
          materials: {}, activeMaterial: material,
        });
      }
      const card = groups.get(group);
      card.materials[material] = { id, enabled: true, profileIds: item.profileIds, applications: item.applications };
      if (material === state.material) card.activeMaterial = material;
    }
  }
  return new Map([...groups.values()].map(card => [card.id, card]));
}

function buildCatalog() {
  const catalog = Object.fromEntries(Object.keys(MATERIALS).map(material => [material, {}]));
  for (const card of draft.values()) {
    const { id: catalogId, name, detail, rate, color } = card;
    for (const [material, scope] of Object.entries(card.materials)) {
      if (!scope.enabled) continue;
      catalog[material][scope.id || catalogId] = { catalogId, name, detail, rate, color,
        profileIds: scope.profileIds, applications: scope.applications };
    }
  }
  return catalog;
}

function applicationFields(profile, scope, parts, active) {
  const types = Object.entries(PRODUCT_TYPES).filter(([type]) => profileTypeSettings(profile, type).enabled);
  return `<div class="profile-type-list" data-glass-system="${escapeHtml(profile.id)}" ${active ? "" : "hidden"}>
    ${types.map(([type, title]) => {
      const link = glassApplication(scope, profile.id, type);
      const beads = compatibleParts(parts, "bead", profile.id, type);
      const beadLabel = link?.beadId && !beads.some(part => part.id === link.beadId)
        ? "Прежний штапик недоступен"
        : beads.length ? "По умолчанию для системы" : "Нет совместимых штапиков в «Материалах»";
      return `<section class="profile-type-card glass-application" data-glass-type="${type}">
        <label class="profile-type-toggle"><input type="checkbox" data-glass-applies ${link ? "checked" : ""}> ${title}</label>
        <label class="catalog-field" data-glass-bead-field ${link ? "" : "hidden"}>
          <span>Штапик</span>
          <select data-glass-bead aria-label="Штапик для ${escapeHtml(profile.name)}, ${title}">
            <option value="">${beadLabel}</option>
            ${beads.map(part => `<option value="${escapeHtml(part.id)}" ${part.id === link?.beadId ? "selected" : ""}>${escapeHtml(partTitle(part))}</option>`).join("")}
          </select>
        </label>
      </section>`;
    }).join("")}
  </div>`;
}

function materialFields(material, card, parts) {
  const { label, profiles } = MATERIALS[material];
  const scope = card.materials[material] ?? {};
  const usable = profiles.filter(profile => Object.keys(PRODUCT_TYPES).some(type => profileTypeSettings(profile, type).enabled));
  const preferred = scope.selectedProfile || state.profile;
  const selected = usable.find(profile => profile.id === preferred)?.id || usable[0]?.id;
  return `<div class="glass-material-panel" data-glass-material="${material}" ${card.activeMaterial === material ? "" : "hidden"}>
    <label class="profile-type-toggle glass-material-toggle">
      <input type="checkbox" data-glass-material-enabled ${scope.enabled ? "checked" : ""}> Использовать для материала «${escapeHtml(label)}»
    </label>
    <div class="catalog-system-settings" data-glass-material-fields ${scope.enabled ? "" : "hidden"}>
      <label class="catalog-field system-choice">
        <span>Профильная система</span>
        <select data-glass-system-choice ${usable.length ? "" : "disabled"}>
          ${usable.map(profile => `<option value="${escapeHtml(profile.id)}" ${profile.id === selected ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("") || "<option>Нет доступных систем</option>"}
        </select>
      </label>
      ${usable.map(profile => applicationFields(profile, scope, parts, profile.id === selected)).join("")}
    </div>
  </div>`;
}

function renderCatalog(openId) {
  const editor = $("#glassCatalogEditor");
  const opened = new Set([...editor.querySelectorAll("details[open]")].map(details => details.closest("[data-glass-id]").dataset.glassId));
  const materials = Object.entries(MATERIALS);
  const parts = allParts(MATERIALS);
  editor.innerHTML = [...draft.values()].map(card => `
    <article class="catalog-profile-card glass-catalog-card" data-glass-id="${escapeHtml(card.id)}">
      <label class="catalog-field"><span>Название</span><input data-glass-name value="${escapeHtml(card.name)}"></label>
      <label class="catalog-field"><span>Толщина и описание</span><input data-glass-detail value="${escapeHtml(card.detail)}"></label>
      <label class="catalog-field"><span>Цена за м²</span><input data-glass-rate type="number" min="0" step="any" value="${Number.isFinite(card.rate) ? card.rate : ""}"></label>
      <button type="button" class="catalog-remove-button" data-remove-glass>Удалить</button>
      <details class="glass-profile-options" ${card.id === openId || opened.has(card.id) ? "open" : ""}>
        <summary>Профильные системы, типы изделий и штапики</summary>
        <div class="glass-compatibility">
          <div class="glass-material-label">Материал профиля</div>
          <div class="catalog-material-tabs" role="group" aria-label="Материал профиля">
            ${materials.map(([material, { label }]) => `<button type="button" data-glass-material-tab="${material}" class="${card.activeMaterial === material ? "active" : ""}" aria-pressed="${card.activeMaterial === material}">${escapeHtml(label)}</button>`).join("")}
          </div>
          ${materials.map(([material]) => materialFields(material, card, parts)).join("")}
        </div>
      </details>
    </article>`).join("");
  if (openId) editor.lastElementChild.querySelector("[data-glass-name]").focus();
}

function captureFields() {
  $("#glassCatalogEditor").querySelectorAll("[data-glass-id]").forEach(row => {
    const card = draft.get(row.dataset.glassId);
    card.name = row.querySelector("[data-glass-name]").value.trim();
    card.detail = row.querySelector("[data-glass-detail]").value.trim();
    const rate = row.querySelector("[data-glass-rate]");
    card.rate = rate.validity.badInput ? NaN : rate.value === "" ? null : Number(rate.value);
  });
}

function captureApplications(event) {
  const control = event.target;
  const panel = control.closest("[data-glass-material]");
  if (!panel) return;
  const card = draft.get(panel.closest("[data-glass-id]").dataset.glassId);
  const material = panel.dataset.glassMaterial;
  const scope = card.materials[material] ||= {};
  if (control.matches("[data-glass-material-enabled]")) {
    scope.enabled = control.checked;
    panel.querySelector("[data-glass-material-fields]").hidden = !control.checked;
    return;
  }
  if (control.matches("[data-glass-system-choice]")) {
    scope.selectedProfile = control.value;
    panel.querySelectorAll("[data-glass-system]").forEach(fields => { fields.hidden = fields.dataset.glassSystem !== control.value; });
    return;
  }
  if (!control.matches("[data-glass-applies], [data-glass-bead]")) return;
  const fields = control.closest("[data-glass-type]");
  const productType = fields.dataset.glassType;
  const profileId = fields.closest("[data-glass-system]").dataset.glassSystem;
  const applies = fields.querySelector("[data-glass-applies]").checked;
  fields.querySelector("[data-glass-bead-field]").hidden = !applies;
  const previous = Array.isArray(scope.applications) ? scope.applications : MATERIALS[material].profiles.flatMap(profile =>
    Object.keys(PRODUCT_TYPES).filter(type => profileTypeSettings(profile, type).enabled && glassApplication(scope, profile.id, type))
      .map(type => ({ profileId: profile.id, productType: type, beadId: "" })));
  scope.applications = previous.filter(link => link?.profileId && (link.profileId !== profileId || link.productType !== productType));
  if (applies) scope.applications.push({ profileId, productType, beadId: fields.querySelector("[data-glass-bead]").value });
  delete scope.profileIds;
}

export function populateGlassSettings() {
  draft = openCatalog(glassCatalog);
  $("#glassCatalogEditor").replaceChildren();
  renderCatalog();
}

export function bindGlassSettings() {
  const editor = $("#glassCatalogEditor");
  editor.addEventListener("change", captureApplications);
  $("#addGlassCatalog").addEventListener("click", () => {
    captureFields();
    const id = createCatalogId("glass");
    const materials = Object.fromEntries(Object.keys(MATERIALS).map(material => [material, { enabled: true }]));
    draft.set(id, { id, name: "", detail: "", rate: null, color: "#bfe3ef", materials, activeMaterial: state.material });
    renderCatalog(id);
  });
  editor.addEventListener("click", event => {
    const tab = event.target.closest("[data-glass-material-tab]");
    if (tab) {
      const row = tab.closest("[data-glass-id]");
      const material = tab.dataset.glassMaterialTab;
      draft.get(row.dataset.glassId).activeMaterial = material;
      row.querySelectorAll("[data-glass-material-tab]").forEach(button => {
        button.classList.toggle("active", button === tab);
        button.setAttribute("aria-pressed", String(button === tab));
      });
      row.querySelectorAll("[data-glass-material]").forEach(panel => { panel.hidden = panel.dataset.glassMaterial !== material; });
      return;
    }
    const button = event.target.closest("[data-remove-glass]");
    if (!button) return;
    if (draft.size === 1) return showToast("Оставьте хотя бы один стеклопакет в каталоге");
    captureFields();
    draft.delete(button.closest("[data-glass-id]").dataset.glassId);
    renderCatalog();
  });
  $("#resetGlassCatalog").addEventListener("click", () => {
    draft = openCatalog(standardGlassCatalog());
    renderCatalog();
    showToast("Стандартный каталог подготовлен. Нажмите «Сохранить стеклопакеты».");
  });
  $("#saveGlassCatalog").addEventListener("click", () => {
    captureFields();
    for (const card of draft.values()) {
      if (!card.name || !Number.isFinite(card.rate) || card.rate < 0) {
        return showToast("Укажите название и неотрицательную цену стеклопакета");
      }
      const selected = Object.entries(card.materials).filter(([, scope]) => scope.enabled);
      if (!selected.length) return showToast(`«${card.name}»: выберите хотя бы один материал профиля`);
      for (const [material, scope] of selected) {
        if (scope.applications?.length === 0) {
          return showToast(`«${card.name}», ${MATERIALS[material].label}: отметьте тип изделия хотя бы для одной системы`);
        }
      }
    }
    const catalog = buildCatalog();
    try {
      programStorageSet(glassCatalogKey, JSON.stringify(catalog));
    } catch {
      return showToast("Не удалось сохранить каталог стеклопакетов");
    }
    setGlassCatalog(catalog);
    $("#pricesDialog").close();
    renderAll();
    showToast("Каталог стеклопакетов сохранён");
  });
}

