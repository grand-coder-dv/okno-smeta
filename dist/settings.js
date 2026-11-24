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
  const technologyTab = tab === "technology";
  $("#settingsPricesPane").hidden = tab !== "prices";
  $("#settingsTechnologyPane").hidden = !technologyTab;
  $("#settingsProfilePane").hidden = tab !== "profile";
  $("#settingsReportsPane").hidden = tab !== "reports";
  $$("[data-settings-tab]").forEach((button) => {
    const active = button.dataset.settingsTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
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
