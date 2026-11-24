// Диалог настроек: прайс и каталог профилей.
const PRICE_BINDINGS = {
  pvcFrame: ["frame", "pvc"],
  aluminumFrame: ["frame", "aluminum"],
  woodFrame: ["frame", "wood"],
  pvcImpost: ["impost", "pvc"],
  aluminumImpost: ["impost", "aluminum"],
  woodImpost: ["impost", "wood"],
  glassSingle: ["glass", "single"],
  glassDouble: ["glass", "double"],
  glassEnergy: ["glass", "energy"],
  glassAcoustic: ["glass", "acoustic"],
  hardwareTurn: ["hardware", "turn"],
  hardwareTiltturn: ["hardware", "tiltturn"],
  hardwareTilt: ["hardware", "tilt"],
  handle: ["handle"],
  reinforcement: ["reinforcement"],
  pvcSeal: ["seal", "pvc"],
  aluminumSeal: ["seal", "aluminum"],
  woodSeal: ["seal", "wood"],
  pvcBead: ["bead", "pvc"],
  aluminumBead: ["bead", "aluminum"],
  woodBead: ["bead", "wood"],
  pvcAssembly: ["assembly", "pvc"],
  aluminumAssembly: ["assembly", "aluminum"],
  woodAssembly: ["assembly", "wood"],
  archSurcharge: ["archSurcharge"],
  circleSurcharge: ["circleSurcharge"],
  skewSurcharge: ["skewSurcharge"],
  markup: ["markup"],
};

function getRate(path) {
  return path.reduce((value, key) => value[key], rates);
}

function setRate(path, value) {
  if (path.length === 1) rates[path[0]] = value;
  else rates[path[0]][path[1]] = value;
}

function ensureSkewSurchargeInput() {
  const form=$("#pricesForm");
  if(form.elements.namedItem("skewSurcharge")) return;
  form.elements.namedItem("circleSurcharge").closest("label").insertAdjacentHTML("afterend", '<label><span>Косая форма</span><input name="skewSurcharge" type="number" min="0" max="300" step="1" /></label>');
}
function populatePriceForm() {
  ensureSkewSurchargeInput();
  Object.entries(PRICE_BINDINGS).forEach(([name, path]) => {
    $("#pricesForm").elements[name].value = getRate(path);
  });
}

function readPriceForm() {
  ensureSkewSurchargeInput();
  Object.entries(PRICE_BINDINGS).forEach(([name, path]) => {
    const input = $("#pricesForm").elements[name];
    setRate(path, name === "skewSurcharge" ? clamp(input.value, 0, 300) : Math.max(0, Number(input.value) || 0));
  });
}

function setSettingsTab(tab) {
  if (catalogDraft && $("#pricesDialog").open) {
    readCatalogDraftFromEditor();
    captureGlassDraft();
    if (tab !== "prices") renderTechnologyCatalog();
  }
  if ($("#pricesDialog").open) captureHardwareDraft();
  const technologyTab = tab === "technology";
  $("#settingsPricesPane").hidden = tab !== "prices";
  $("#settingsTechnologyPane").hidden = !technologyTab;
  $("#settingsProfilePane").hidden = tab !== "profile";
  $("#settingsHardwarePane").hidden = tab !== "hardware";
  $("#settingsReportsPane").hidden = tab !== "reports";
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

function renderTechnologyCatalog() {
  if (!catalogDraft) catalogDraft = cloneMaterials(MATERIALS);
  const material = catalogDraft[catalogMaterial];
  const profileRows = material.profiles.map(profile => `
    <article class="catalog-profile-card catalog-profile-name-row" data-profile-id="${escapeHtml(profile.id)}">
      <label class="catalog-field catalog-name-field"><span>Название системы</span>
        <input data-profile-field="name" value="${escapeHtml(profile.name)}" maxlength="80" required />
      </label>
      <button class="catalog-remove-button" type="button" data-catalog-action="remove-profile" aria-label="Удалить профильную систему">Удалить</button>
    </article>`).join("");
  const settingsRows = material.profiles.map(profile => `
    <article class="catalog-system-settings" data-profile-id="${escapeHtml(profile.id)}">
      <h4 class="catalog-settings-title">${escapeHtml(profile.name)}</h4>
      <div class="profile-type-list">${Object.entries(PRODUCT_TYPES).map(([type, label]) => {
        const settings = profileTypeSettings(profile, type);
        return `<section class="profile-type-card" data-product-type="${type}">
          <label class="profile-type-toggle"><input type="checkbox" data-type-enabled ${settings.enabled ? "checked" : ""} /> ${label}</label>
          <div class="profile-type-fields" ${settings.enabled ? "" : "hidden"}>
            ${[["frameWidth","Рама, мм",20,250],["sashWidth","Створка, мм",20,250],["impostWidth","Импост, мм",20,250],
              ["glassBiteFrame","Заход стекла: рама, мм",0,100],["glassBiteSash","Заход стекла: створка, мм",0,100],
              ["glassBiteImpost","Заход стекла: импост, мм",0,100],["factor","Коэффициент цены",0.1,5],["seals","Контуры уплотнения",1,5]]
              .map(([field,title,min,max]) => `<label class="catalog-field"><span>${title}</span><input type="number" data-type-field="${field}"
                value="${field === "factor" ? Number(settings[field]) || 1 : clamp(settings[field], min, max)}" min="${min}" max="${max}" step="${field === "factor" ? "0.01" : "1"}" /></label>`).join("")}
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowCircleShape" ${settings.allowCircleShape ? "checked" : ""} /> Круглая форма</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowCircleSashes" ${settings.allowCircleSashes ? "checked" : ""} /> Створки в круглой форме</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTiltturn" ${settings.allowTiltturn !== false ? "checked" : ""} /> Поворотно-откидная</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTurn" ${settings.allowTurn !== false ? "checked" : ""} /> Поворотная</label>
            <label class="profile-type-option"><input type="checkbox" data-type-field="allowTilt" ${settings.allowTilt !== false ? "checked" : ""} /> Откидная</label>
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

  const glassSection = $("#glassCatalogSection");
  $("#technologyCatalogEditor").innerHTML = `
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Профильные системы</h3><span>${material.profiles.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-catalog-action="add-profile">+ Добавить систему</button>
      </div>
      <div class="catalog-profile-list">${profileRows}</div>
    </section>
    <section class="catalog-section">
      <div class="catalog-section-header">
        <div><h3>Цвета профиля</h3><span>${material.finishes.length} шт.</span></div>
        <button class="button ghost catalog-add-button" type="button" data-catalog-action="add-finish">+ Добавить цвет</button>
      </div>
      <div class="catalog-color-list">${finishRows}</div>
    </section>`;
  $("#technologyCatalogEditor").append(glassSection);
  $("#profileSettingsEditor").innerHTML = `<section class="catalog-section">
    <div class="catalog-section-header"><div><h3>Настройки профильных систем</h3><span>${material.profiles.length} шт.</span></div></div>
    <div class="catalog-profile-list">${settingsRows}</div>
  </section>`;
  updateCatalogMaterialTabs();
}

function readCatalogDraftFromEditor() {
  if (!catalogDraft) return;
  const material = catalogDraft[catalogMaterial];
  $$("#technologyCatalogEditor [data-profile-id]").forEach((row) => {
    const profile = material.profiles.find((item) => item.id === row.dataset.profileId);
    if (!profile) return;
    profile.name = row.querySelector('[data-profile-field="name"]').value.trim() || "Новая профильная система";
  });
  $$("#profileSettingsEditor [data-profile-id]").forEach((row) => {
    const profile = material.profiles.find(item => item.id === row.dataset.profileId);
    if (!profile) return;
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

function handleCatalogAction(event) {
  const button = event.target.closest("[data-catalog-action]");
  if (!button) return;
  readCatalogDraftFromEditor();
  captureGlassDraft();
  const material = catalogDraft[catalogMaterial];
  if (button.dataset.catalogAction === "add-profile") {
    const defaults = DEFAULT_MATERIALS[catalogMaterial].profiles[0];
    material.profiles.push({
      id: createCatalogId(`${catalogMaterial}-profile`),
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
  renderTechnologyCatalog();
  renderGlassCatalog();
}

function populateTechnologyForm() {
  catalogDraft = cloneMaterials(MATERIALS);
  glassDraft = structuredClone(glassCatalog);
  catalogMaterial = state.material;
  renderTechnologyCatalog();
  renderGlassCatalog();
}

function readTechnologyForm() {
  readCatalogDraftFromEditor();
  MATERIALS = cloneMaterials(catalogDraft);
  localStorage.setItem("oknoSmetaProfileCatalog", JSON.stringify(MATERIALS));
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

function renderHardwareCatalog() {
  if (!hardwareDraft) hardwareDraft = cloneData(hardwareCatalog);
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

function handleHardwareAction(event) {
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

function saveHardwareCatalog() {
  captureHardwareDraft();
  const issue = hardwareDraftIssue();
  if (issue) {
    showToast(issue);
    return;
  }
  hardwareCatalog = sanitizeHardwareCatalog(hardwareDraft);
  if (!persistHardwareCatalog()) {
    showToast("Не удалось сохранить фурнитуру в браузере");
    return;
  }
  hardwareDraft = cloneData(hardwareCatalog);
  $("#pricesDialog").close();
  renderAll();
  showToast("Фурнитура сохранена");
}
