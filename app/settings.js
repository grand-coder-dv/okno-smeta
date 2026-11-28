import { defaultPartFields, renderPartsCatalog } from "./parts-settings.js";
// Диалог настроек: коэффициенты и каталог профилей.
import { DEFAULT_MATERIALS, HANDLE_LENGTHS, HANDLE_STYLES, MATERIALS, MATERIAL_TITLES, PRODUCT_TYPES, PROFILE_STORAGE_KEY, PROJECTS_STORAGE_KEY, applyTechnicalSnapshot, cloneData, cloneMaterials, cloneRates, hardwareCatalog, hardwareDraft, normalizeHandleStyle, persistHardwareCatalog, profileTypeSettings, programStorageSet, rates, readStoredProjects, reloadProgramStateFromDatabase, sanitizeHardwareCatalog, setHardwareCatalog, setHardwareDraft, setMATERIALS, technicalSnapshot } from "./catalog.js";
import { populateGlassSettings } from "./glass-settings.js";
import { handlePreviewMarkup } from "./drawing.js";
import { renderAll, showToast } from "./editor-ui.js";
import { updateMaterialSelects } from "./geometry.js";
import { renderProjectsList } from "./order.js";
import { $, $$, catalogDraft, catalogMaterial, clamp, createCatalogId, escapeHtml, getProfile, normalizeUnsupportedOpenings, projects, setCatalogDraft, setCatalogMaterial, setProjects, setWindowShapeMode, state } from "./product.js";
const coefficientNames = ["archSurcharge", "circleSurcharge", "skewSurcharge", "markup"];

export function populateCoefficientForm() {
  const form = $("#pricesForm");
  for (const name of coefficientNames) form.elements[name].value = rates[name];
}

export function readCoefficientForm() {
  const form = $("#pricesForm");
  for (const name of coefficientNames) {
    const input = form.elements[name];
    rates[name] = clamp(input.value, Number(input.min), Number(input.max));
  }
}

export function resetCoefficientForm() {
  const defaults = cloneRates();
  for (const name of coefficientNames) $("#pricesForm").elements[name].value = defaults[name];
}

export function setSettingsTab(tab) {
  if (catalogDraft && $("#pricesDialog").open) {
    readCatalogDraftFromEditor();
    if (tab !== "general") renderTechnologyCatalog();
  }
  if ($("#pricesDialog").open) captureHardwareDraft();
  if (tab === "materials") renderPartsCatalog();
  $("#settingsMaterialsPane").hidden = tab !== "materials";
  const technologyTab = tab === "technology";
  $("#settingsPricesPane").hidden = tab !== "general";
  $("#settingsTechnologyPane").hidden = !technologyTab;
  $("#settingsGlassPane").hidden = tab !== "glass";
  $("#settingsHardwarePane").hidden = tab !== "hardware";
  $("#settingsReportsPane").hidden = tab !== "reports";
  $("#settingsDatabasePane").hidden = tab !== "database";
  $$("[data-settings-tab]").forEach((button) => {
    const active = button.dataset.settingsTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (tab === "hardware" && hardwareDraft) renderHardwareCatalog();
}

function updateCatalogMaterialTabs() {
  $$('[data-catalog-material]').forEach((button) => {
    const active = button.dataset.catalogMaterial === catalogMaterial;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

export function renderTechnologyCatalog(preferredId) {
  if (!catalogDraft) setCatalogDraft(cloneMaterials(MATERIALS));
  const material = catalogDraft[catalogMaterial];
  const previousId = preferredId || $("#settingsSystemChoice")?.value || state.profile;
  const selectedId = material.profiles.find(profile => profile.id === previousId)?.id || material.profiles[0].id;
  const settingsRows = material.profiles.map(profile => `
    <article class="catalog-system-settings" ${profile.id === selectedId ? "" : "hidden"} data-profile-id="${escapeHtml(profile.id)}">
      <div class="system-name-row">
      <label class="catalog-field catalog-name-field"><span>Название системы</span>
        <input data-profile-field="name" value="${escapeHtml(profile.name)}" maxlength="80" required />
      </label>
      <button class="catalog-remove-button" type="button" data-catalog-action="remove-profile" aria-label="Удалить профильную систему">Удалить</button>
      </div>
      <div class="profile-type-list">${Object.entries(PRODUCT_TYPES).map(([type, label]) => {
        const settings = profileTypeSettings(profile, type);
        return `<section class="profile-type-card" data-product-type="${type}">
          <label class="profile-type-toggle"><input type="checkbox" data-type-enabled ${settings.enabled ? "checked" : ""} /> ${label}</label>
          <div class="profile-type-fields" ${settings.enabled ? "" : "hidden"}>
            ${defaultPartFields(catalogDraft, profile, type)}
            ${[["factor","Коэффициент цены",0.1,5],["seals","Контуры уплотнения",1,5]]
              .map(([field,title,min,max]) => `<label class="catalog-field"><span>${title}</span><input type="number" data-type-field="${field}"
                value="${field === "factor" ? Number(settings[field]) || 1 : clamp(settings[field], min, max)}" min="${min}" max="${max}" step="${field === "factor" ? "0.01" : "1"}" /></label>`).join("")}
            <div class="profile-options"><label class="profile-type-option"><input type="checkbox" data-type-field="allowCircleShape" ${settings.allowCircleShape ? "checked" : ""} /> Круглая форма</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowCircleSashes" ${settings.allowCircleSashes ? "checked" : ""} /> Створки в круглой форме</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTiltturn" ${settings.allowTiltturn !== false ? "checked" : ""} /> Поворотно-откидная</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTurn" ${settings.allowTurn !== false ? "checked" : ""} /> Поворотная</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTilt" ${settings.allowTilt !== false ? "checked" : ""} /> Откидная</label></div>
          </div>
        </section>`;
      }).join("")}</div>
    </article>`).join("");

  const finishRows = material.finishes
    .map(
      (finish) => `
        <article class="catalog-color-row" data-finish-id="${escapeHtml(finish.id)}">
          <label class="catalog-color-picker" title="Выбрать цвет">
            <input type="color" data-finish-field="color" value="${escapeHtml(finish.color || material.frame)}" />
          </label>
          <label class="catalog-field catalog-color-name">
            <span>Название цвета</span>
            <input data-finish-field="name" value="${escapeHtml(finish.name)}" maxlength="60" required />
          </label>
          <label class="catalog-field catalog-color-factor">
            <span>Коэффициент цены</span>
            <input type="number" data-finish-field="factor" value="${Number(finish.factor) || 1}" min="0.1" max="5" step="0.01" />
          </label>
          <button class="catalog-remove-button" type="button" data-catalog-action="remove-finish" aria-label="Удалить цвет">Удалить</button>
        </article>`,
    )
    .join("");

  $("#technologyCatalogEditor").innerHTML = `
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Профильные системы</h3><span>${material.profiles.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-catalog-action="add-profile">+ Добавить систему</button>
      </div>
    <label class="catalog-field system-choice"><span>Профильная система</span>
      <select id="settingsSystemChoice">${material.profiles.map(profile =>
        `<option value="${escapeHtml(profile.id)}" ${profile.id === selectedId ? "selected" : ""}>${escapeHtml(profile.name)}</option>`).join("")}</select></label>
      <div class="catalog-profile-list">${settingsRows}</div>
    </section>
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Цвета профиля</h3><span>${material.finishes.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-catalog-action="add-finish">+ Добавить цвет</button>
      </div>
      <div class="catalog-color-list">${finishRows}</div>
    </section>`;
  $("#settingsSystemChoice").onchange = event => {
    for (const row of document.querySelectorAll("#technologyCatalogEditor .catalog-system-settings")) row.hidden = row.dataset.profileId !== event.target.value;
  };
  updateCatalogMaterialTabs();
}

export function readCatalogDraftFromEditor() {
  if (!catalogDraft) return;
  const material = catalogDraft[catalogMaterial];
  $$("#technologyCatalogEditor [data-profile-id]").forEach((row) => {
    const profile = material.profiles.find((item) => item.id === row.dataset.profileId);
    if (!profile) return;
    profile.name = row.querySelector('[data-profile-field="name"]').value.trim() || "Новая профильная система";
    profile.types ||= {};
    row.querySelectorAll("[data-product-type]").forEach(typeRow => {
      const type = typeRow.dataset.productType;
      const previous = profileTypeSettings(profile, type);
      const settings = { ...previous, enabled: typeRow.querySelector("[data-type-enabled]").checked };
      typeRow.querySelectorAll("[data-type-field]").forEach(input => {
        const field = input.dataset.typeField;
        if (input.type === "checkbox") settings[field] = input.checked;
        else settings[field] = clamp(input.value, Number(input.min), Number(input.max));
      });
      settings.defaultParts = Object.fromEntries([...typeRow.querySelectorAll("[data-default-part]")].map(select => [select.dataset.defaultPart, select.value]));
      profile.types[type] = settings;
    });
  });
  $$("#technologyCatalogEditor [data-finish-id]").forEach((row) => {
    const finish = material.finishes.find((item) => item.id === row.dataset.finishId);
    if (!finish) return;
    finish.name = row.querySelector('[data-finish-field="name"]').value.trim() || "Новый цвет";
    finish.color = row.querySelector('[data-finish-field="color"]').value;
    finish.factor = clamp(row.querySelector('[data-finish-field="factor"]').value, 0.1, 5);
  });
}

export function handleCatalogAction(event) {
  const button = event.target.closest("[data-catalog-action]");
  if (!button) return;
  readCatalogDraftFromEditor();
  const material = catalogDraft[catalogMaterial];
  let addedId;
  if (button.dataset.catalogAction === "add-profile") {
    addedId = createCatalogId(`${catalogMaterial}-profile`);
    const defaults = DEFAULT_MATERIALS[catalogMaterial].profiles[0];
    material.profiles.push({
      id: addedId,
      name: "Новая профильная система",
      factor: 1,
      seals: defaults.seals,
      frameWidth: defaults.frameWidth,
      sashWidth: defaults.sashWidth,
      impostWidth: defaults.impostWidth,
    });
  } else if (button.dataset.catalogAction === "remove-profile") {
    if (material.profiles.length === 1) {
      showToast("Нельзя удалить последнюю профильную систему");
      return;
    }
    const row = button.closest("[data-profile-id]");
    material.profiles = material.profiles.filter((item) => item.id !== row.dataset.profileId);
  } else if (button.dataset.catalogAction === "add-finish") {
    material.finishes.push({ id: createCatalogId(`${catalogMaterial}-color`), name: "Новый цвет", factor: 1, color: material.frame });
  } else if (button.dataset.catalogAction === "remove-finish") {
    if (material.finishes.length === 1) {
      showToast("Нельзя удалить последний цвет");
      return;
    }
    const row = button.closest("[data-finish-id]");
    material.finishes = material.finishes.filter((item) => item.id !== row.dataset.finishId);
  }
  renderTechnologyCatalog(addedId);
}

export function populateTechnologyForm() {
  setCatalogDraft(cloneMaterials(MATERIALS));
  setCatalogMaterial(state.material);
  renderTechnologyCatalog();
}

export function readTechnologyForm() {
  readCatalogDraftFromEditor();
  setMATERIALS(cloneMaterials(catalogDraft));
  programStorageSet(PROFILE_STORAGE_KEY, JSON.stringify(MATERIALS));
  updateMaterialSelects();
  if (state.shape === "circle" && !getProfile().allowCircleShape) setWindowShapeMode("rect");
  normalizeUnsupportedOpenings();
}

function readHardwareNumber(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) ? Math.min(10000000, Math.max(0, value)) : fallback;
}

function captureHardwareDraft() {
  const editor = $("#hardwareCatalogEditor");
  if (!hardwareDraft || editor?.dataset.ready !== "1") return;
  editor.querySelectorAll("[data-hardware-id]").forEach((card) => {
    const set = hardwareDraft.sets.find((item) => item.id === card.dataset.hardwareId);
    if (!set) return;
    set.name = card.querySelector("[data-hardware-name]").value.trim() || "Новая фурнитура";
    set.minWidth = readHardwareNumber(card.querySelector("[data-hardware-min-width]"), set.minWidth);
    set.maxWidth = readHardwareNumber(card.querySelector("[data-hardware-max-width]"), set.maxWidth);
    set.minHeight = readHardwareNumber(card.querySelector("[data-hardware-min-height]"), set.minHeight);
    set.maxHeight = readHardwareNumber(card.querySelector("[data-hardware-max-height]"), set.maxHeight);
    set.price = readHardwareNumber(card.querySelector("[data-hardware-price]"), set.price);
    const links = [];
    card.querySelectorAll("[data-hardware-link]:checked").forEach((box) => {
      const [material, profileId, type] = box.dataset.hardwareLink.split("|");
      if (!PRODUCT_TYPES[type] || !MATERIALS[material]) return;
      let link = links.find((item) => item.material === material && item.profileId === profileId);
      if (!link) {
        link = { material, profileId, productTypes: [] };
        links.push(link);
      }
      link.productTypes.push(type);
    });
    set.links = links;
  });
  const ids = new Set(hardwareDraft.sets.map((set) => set.id));
  editor.querySelectorAll("[data-handle-id]").forEach((card) => {
    const handle = hardwareDraft.handles.find((item) => item.id === card.dataset.handleId);
    if (!handle) return;
    handle.name = card.querySelector("[data-handle-name]").value.trim() || "Новая ручка";
    const color = card.querySelector("[data-handle-color]").value;
    handle.color = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#d5dde6";
    const style = card.querySelector("[data-handle-style]").value;
    handle.style = normalizeHandleStyle(style);
    handle.price = readHardwareNumber(card.querySelector("[data-handle-price]"), handle.price);
    handle.hardwareIds = [...card.querySelectorAll("[data-handle-hardware]:checked")].map((box) => box.value).filter((id) => ids.has(id));
  });
}

function hardwareDraftIssue() {
  for (const set of hardwareDraft.sets) {
    if (!set.name.trim()) return "Укажите название фурнитуры";
    if (set.minWidth > set.maxWidth || set.minHeight > set.maxHeight) return `«${set.name}»: минимальный размер не может быть больше максимального`;
  }
  for (const handle of hardwareDraft.handles) {
    if (!handle.name.trim()) return "Укажите название ручки";
    if (!handle.hardwareIds.length) return `«${handle.name}»: отметьте, в какой фурнитуре применяется ручка`;
  }
  return "";
}

function hardwareAssignmentMarkup(set) {
  return Object.entries(MATERIALS).map(([material, data]) => `
    <div class="hardware-assign-group">
      <p class="hardware-assign-material">${escapeHtml(MATERIAL_TITLES[material] || data.label)}</p>
      ${data.profiles.map((profile) => `
        <div class="hardware-assign-row">
          <b>${escapeHtml(profile.name)}</b>
          ${Object.entries(PRODUCT_TYPES).map(([type, label]) => {
            const checked = (set.links || []).some((link) => link.material === material && link.profileId === profile.id && (link.productTypes || []).includes(type));
            return `<label><input type="checkbox" data-hardware-link="${escapeHtml(`${material}|${profile.id}|${type}`)}" ${checked ? "checked" : ""} /> ${escapeHtml(label)}</label>`;
          }).join("")}
        </div>`).join("")}
    </div>`).join("");
}

export function renderHardwareCatalog() {
  if (!hardwareDraft) setHardwareDraft(cloneData(hardwareCatalog));
  const editor = $("#hardwareCatalogEditor");
  const sets = hardwareDraft.sets.map((set) => `
    <article class="hardware-set-card" data-hardware-id="${escapeHtml(set.id)}">
      <div class="catalog-section-header">
        <h3>Комплект</h3>
        <button class="catalog-remove-button" type="button" data-hardware-action="remove-set">Удалить</button>
      </div>
      <div class="hardware-set-grid">
        <label class="catalog-field catalog-name-field"><span>Название</span><input data-hardware-name value="${escapeHtml(set.name)}" maxlength="80" required /></label>
        <label class="catalog-field"><span>Ширина от, мм</span><input data-hardware-min-width type="number" min="0" max="5000" step="1" value="${set.minWidth}" /></label>
        <label class="catalog-field"><span>Ширина до, мм</span><input data-hardware-max-width type="number" min="0" max="5000" step="1" value="${set.maxWidth}" /></label>
        <label class="catalog-field"><span>Высота от, мм</span><input data-hardware-min-height type="number" min="0" max="5000" step="1" value="${set.minHeight}" /></label>
        <label class="catalog-field"><span>Высота до, мм</span><input data-hardware-max-height type="number" min="0" max="5000" step="1" value="${set.maxHeight}" /></label>
        <label class="catalog-field"><span>Цена, ₽/компл.</span><input data-hardware-price type="number" min="0" step="10" value="${set.price}" /></label>
      </div>
      <div class="hardware-assign">
        <span>Устанавливается в профильные системы</span>
        ${hardwareAssignmentMarkup(set)}
      </div>
    </article>`).join("");
  const handles = hardwareDraft.handles.map((handle) => `
    <article class="handle-set-card" data-handle-id="${escapeHtml(handle.id)}">
      <div class="handle-set-grid">
        <div class="handle-style-preview" data-handle-preview>${handlePreviewMarkup(handle.style, handle.color)}</div>
        <label class="catalog-field"><span>Название</span><input data-handle-name value="${escapeHtml(handle.name)}" maxlength="80" required /></label>
        <label class="catalog-field"><span>Цвет</span><input data-handle-color type="color" value="${escapeHtml(handle.color)}" /></label>
        <label class="catalog-field"><span>Вид на эскизе</span>
          <select data-handle-style>${Object.entries(HANDLE_STYLES).map(([id, label]) => `<option value="${id}" ${handle.style === id ? "selected" : ""}>${label}, ${HANDLE_LENGTHS[id]} мм</option>`).join("")}</select>
        </label>
        <label class="catalog-field"><span>Цена, ₽</span><input data-handle-price type="number" min="0" step="10" value="${handle.price}" /></label>
        <button class="catalog-remove-button" type="button" data-hardware-action="remove-handle">Удалить</button>
      </div>
      <div class="hardware-handle-uses">
        <span>Применяется в фурнитуре</span>
        ${hardwareDraft.sets.length
          ? hardwareDraft.sets.map((set) => `<label><input type="checkbox" data-handle-hardware value="${escapeHtml(set.id)}" ${(handle.hardwareIds || []).includes(set.id) ? "checked" : ""} /> ${escapeHtml(set.name)}</label>`).join("")
          : "<small>Сначала добавьте комплект фурнитуры</small>"}
      </div>
    </article>`).join("");
  editor.innerHTML = `
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Комплекты фурнитуры</h3><span>${hardwareDraft.sets.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-hardware-action="add-set">+ Добавить фурнитуру</button>
      </div>
      <div class="hardware-card-list">${sets || "<p class=\"technology-note\">Комплектов пока нет.</p>"}</div>
    </section>
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Ручки</h3><span>${hardwareDraft.handles.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-hardware-action="add-handle">+ Добавить ручку</button>
      </div>
      <div class="hardware-card-list">${handles || "<p class=\"technology-note\">Ручек пока нет.</p>"}</div>
    </section>`;
  editor.dataset.ready = "1";
}

export function handleHardwareAction(event) {
  const button = event.target.closest("[data-hardware-action]");
  if (!button || !hardwareDraft) return;
  captureHardwareDraft();
  const action = button.dataset.hardwareAction;
  if (action === "add-set") {
    hardwareDraft.sets.push({
      id: createCatalogId("hardware"),
      name: "Новая фурнитура",
      minWidth: 300,
      maxWidth: 1500,
      minHeight: 400,
      maxHeight: 2200,
      price: 0,
      links: [],
    });
  } else if (action === "remove-set") {
    const id = button.closest("[data-hardware-id]").dataset.hardwareId;
    hardwareDraft.sets = hardwareDraft.sets.filter((set) => set.id !== id);
    hardwareDraft.handles.forEach((handle) => {
      handle.hardwareIds = handle.hardwareIds.filter((item) => item !== id);
    });
  } else if (action === "add-handle") {
    if (!hardwareDraft.sets.length) {
      showToast("Сначала добавьте комплект фурнитуры");
      return;
    }
    hardwareDraft.handles.push({
      id: createCatalogId("handle"),
      name: "Новая ручка",
      color: "#d5dde6",
      style: "window",
      price: 0,
      hardwareIds: hardwareDraft.sets.map((set) => set.id),
    });
  } else if (action === "remove-handle") {
    const id = button.closest("[data-handle-id]").dataset.handleId;
    hardwareDraft.handles = hardwareDraft.handles.filter((item) => item.id !== id);
  }
  renderHardwareCatalog();
}

export function saveHardwareCatalog() {
  captureHardwareDraft();
  const issue = hardwareDraftIssue();
  if (issue) {
    showToast(issue);
    return;
  }
  setHardwareCatalog(sanitizeHardwareCatalog(hardwareDraft));
  if (!persistHardwareCatalog()) {
    showToast("Не удалось сохранить фурнитуру в браузере");
    return;
  }
  setHardwareDraft(cloneData(hardwareCatalog));
  $("#pricesDialog").close();
  renderAll();
  showToast("Фурнитура сохранена");
}

function downloadDatabaseFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

let databaseImportKind = "";

export function bindSettingsEvents() {
$("#exportTechnicalDb").addEventListener("click", () => {
  downloadDatabaseFile("okno-smeta-technical.json", {
    kind: "okno-smeta-technical",
    version: 1,
    savedAt: new Date().toISOString(),
    data: technicalSnapshot(),
  });
  showToast("Техническая база выгружена в файл");
});

$("#exportProjectsDb").addEventListener("click", () => {
  downloadDatabaseFile("okno-smeta-projects.json", {
    kind: "okno-smeta-projects",
    version: 1,
    savedAt: new Date().toISOString(),
    projects: readStoredProjects(),
  });
  showToast("База проектов выгружена в файл");
});

$("#importTechnicalDb").addEventListener("click", () => {
  databaseImportKind = "technical";
  $("#databaseFileInput").value = "";
  $("#databaseFileInput").click();
});

$("#importProjectsDb").addEventListener("click", () => {
  databaseImportKind = "projects";
  $("#databaseFileInput").value = "";
  $("#databaseFileInput").click();
});

$("#databaseFileInput").addEventListener("change", async () => {
  const file = $("#databaseFileInput").files?.[0];
  if (!file) return;
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    showToast("Файл не удалось прочитать как JSON");
    return;
  }
  if (databaseImportKind === "technical") {
    if (payload?.kind !== "okno-smeta-technical" || payload.version !== 1 || !payload.data || typeof payload.data !== "object") {
      showToast("Выберите файл экспорта технической базы");
      return;
    }
    applyTechnicalSnapshot(payload.data);
    reloadProgramStateFromDatabase();
    populateCoefficientForm();
    populateTechnologyForm();
    populateGlassSettings();
    setHardwareDraft(cloneData(hardwareCatalog));
    $("#hardwareCatalogEditor").removeAttribute("data-ready");
    showToast("Техническая база загружена в программу");
    return;
  }
  if (payload?.kind !== "okno-smeta-projects" || payload.version !== 1 || !Array.isArray(payload.projects)) {
    showToast("Выберите файл экспорта базы проектов");
    return;
  }
  const next = payload.projects.filter(
    (project) => project && typeof project.id === "string" && typeof project.name === "string" && Array.isArray(project.items),
  );
  try {
    programStorageSet(PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    showToast("Не удалось записать базу проектов");
    return;
  }
  setProjects(readStoredProjects());
  renderProjectsList();
  showToast(`База проектов загружена: ${projects.length}`);
});
}
