const DEFAULT_MATERIALS = {
  pvc: {
    label: "ПВХ",
    frame: "#eef1f4",
    edge: "#aeb8c4",
    profiles: [
      { id: "pvc60", name: "ПВХ 60 мм · 3 камеры", factor: 0.9, seals: 2, frameWidth: 60, sashWidth: 68, impostWidth: 72 },
      { id: "pvc70", name: "ПВХ 70 мм · 5 камер", factor: 1, seals: 2, frameWidth: 70, sashWidth: 78, impostWidth: 82 },
      { id: "pvc82", name: "ПВХ 82 мм · 7 камер", factor: 1.18, seals: 3, frameWidth: 82, sashWidth: 90, impostWidth: 94 },
    ],
    finishes: [
      { id: "white", name: "Белый", factor: 1, color: "#eef1f4" },
      { id: "anthracite", name: "Антрацит", factor: 1.13, color: "#4b5159" },
      { id: "golden-oak", name: "Золотой дуб", factor: 1.16, color: "#a66f3e" },
      { id: "walnut", name: "Орех", factor: 1.16, color: "#70462f" },
    ],
  },
  aluminum: {
    label: "Алюминий",
    frame: "#4c5868",
    edge: "#202b39",
    profiles: [
      { id: "alu45", name: "Алюминий 45 мм · холодный", factor: 0.86, seals: 1, frameWidth: 45, sashWidth: 52, impostWidth: 50 },
      { id: "alu70", name: "Алюминий 70 мм · тёплый", factor: 1, seals: 2, frameWidth: 70, sashWidth: 76, impostWidth: 72 },
      { id: "alu90", name: "Алюминий 90 мм · тёплый+", factor: 1.24, seals: 3, frameWidth: 90, sashWidth: 98, impostWidth: 92 },
    ],
    finishes: [
      { id: "ral-white", name: "RAL 9016 белый", factor: 1, color: "#f1f1ed" },
      { id: "ral-anthracite", name: "RAL 7016 антрацит", factor: 1.08, color: "#3b4146" },
      { id: "ral-black", name: "RAL 9005 чёрный", factor: 1.08, color: "#17191c" },
      { id: "anodized", name: "Анодированный", factor: 1.12, color: "#8f989f" },
    ],
  },
  wood: {
    label: "Дерево",
    frame: "#9d6742",
    edge: "#633d25",
    profiles: [
      { id: "pine78", name: "Сосна · 78 мм", factor: 0.9, seals: 2, frameWidth: 78, sashWidth: 82, impostWidth: 86 },
      { id: "oak78", name: "Дуб · 78 мм", factor: 1.25, seals: 2, frameWidth: 78, sashWidth: 82, impostWidth: 86 },
      { id: "woodalu92", name: "Дерево–алюминий · 92 мм", factor: 1.42, seals: 3, frameWidth: 92, sashWidth: 98, impostWidth: 100 },
    ],
    finishes: [
      { id: "natural", name: "Натуральный лак", factor: 1, color: "#b77a4f" },
      { id: "walnut", name: "Орех", factor: 1.08, color: "#74492e" },
      { id: "wenge", name: "Венге", factor: 1.1, color: "#3d2b24" },
      { id: "painted", name: "Укрывная окраска", factor: 1.12, color: "#e5e2dc" },
    ],
  },
};

const cloneMaterials = (source = DEFAULT_MATERIALS) => JSON.parse(JSON.stringify(source));

function readStoredMaterials() {
  try {
    const stored = JSON.parse(localStorage.getItem("oknoSmetaProfileCatalog") || "null");
    const next = cloneMaterials();
    Object.keys(next).forEach((materialKey) => {
      const storedMaterial = stored?.[materialKey];
      if (!storedMaterial) return;
      if (Array.isArray(storedMaterial.profiles) && storedMaterial.profiles.length) {
        next[materialKey].profiles = storedMaterial.profiles.map((profile) => {
          const fallback = next[materialKey].profiles.find((item) => item.id === profile.id) || next[materialKey].profiles[0];
          return { ...fallback, ...profile };
        });
      }
      if (Array.isArray(storedMaterial.finishes) && storedMaterial.finishes.length) {
        next[materialKey].finishes = storedMaterial.finishes.map((finish) => {
          const fallback = next[materialKey].finishes.find((item) => item.id === finish.id) || next[materialKey].finishes[0];
          return { ...fallback, ...finish };
        });
      }
    });
    return next;
  } catch {
    return cloneMaterials();
  }
}

let MATERIALS = readStoredMaterials();

const GLASS = {
  single: { name: "Однокамерный", detail: "24 мм", color: "#cce9f3" },
  double: { name: "Двухкамерный", detail: "40 мм", color: "#bfe3ef" },
  energy: { name: "Энергосберегающий", detail: "40 мм · i-стекло", color: "#c7eadf" },
  acoustic: { name: "Шумоизоляционный", detail: "44 мм · триплекс", color: "#cbdcf1" },
};

const OPENINGS = {
  fixed: { name: "Глухая", short: "Г" },
  turn: { name: "Поворотная", short: "П" },
  tiltturn: { name: "Поворотно-откидная", short: "ПО" },
  tilt: { name: "Откидная", short: "О" },
};

const SHAPES = {
  rect: "Прямоугольная",
  arch: "Арочная",
  circle: "Круглая",
};

const DEFAULT_RATES = Object.freeze({
  frame: { pvc: 1850, aluminum: 3250, wood: 4350 },
  impost: { pvc: 1250, aluminum: 2180, wood: 2940 },
  seal: { pvc: 170, aluminum: 230, wood: 220 },
  bead: { pvc: 260, aluminum: 420, wood: 560 },
  assembly: { pvc: 870, aluminum: 1350, wood: 1780 },
  reinforcement: 360,
  glass: { single: 3600, double: 4850, energy: 5650, acoustic: 6950 },
  hardware: { fixed: 0, turn: 3150, tiltturn: 4650, tilt: 3720 },
  handle: 520,
  archSurcharge: 25,
  circleSurcharge: 38,
  markup: 10,
});

const DEFAULT_TECHNOLOGY = Object.freeze({
  pvc: { frame: 70, sash: 78, impost: 82 },
  aluminum: { frame: 70, sash: 76, impost: 72 },
  wood: { frame: 78, sash: 82, impost: 86 },
});

const cloneRates = () => JSON.parse(JSON.stringify(DEFAULT_RATES));
const cloneTechnology = () => JSON.parse(JSON.stringify(DEFAULT_TECHNOLOGY));
const cloneData = (value) => JSON.parse(JSON.stringify(value));
const RATES_STORAGE_KEY = "oknoSmetaRates";
const PROJECTS_STORAGE_KEY = "oknoSmetaProjectsV1";

function readStoredRates() {
  const next = cloneRates();
  try {
    const stored = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return next;
    Object.keys(next).forEach((group) => {
      if (typeof next[group] === "object") {
        Object.keys(next[group]).forEach((key) => {
          const value = stored?.[group]?.[key];
          if (typeof value === "number" && Number.isFinite(value) && value >= 0) next[group][key] = value;
        });
      } else {
        const value = stored[group];
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) next[group] = value;
      }
    });
    return next;
  } catch {
    return next;
  }
}

function persistRates() {
  try {
    localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    return true;
  } catch {
    return false;
  }
}

function readStoredProjects() {
  try {
    const stored = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (project) => project && typeof project.id === "string" && typeof project.name === "string" && Array.isArray(project.items),
    );
  } catch {
    return [];
  }
}

function persistProjects(nextProjects) {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
    return true;
  } catch {
    return false;
  }
}

function readStoredTechnology() {
  try {
    const stored = JSON.parse(localStorage.getItem("oknoSmetaTechnology") || "null");
    const next = cloneTechnology();
    Object.keys(next).forEach((material) => {
      ["frame", "sash", "impost"].forEach((part) => {
        const value = Number(stored?.[material]?.[part]);
        if (Number.isFinite(value)) next[material][part] = Math.min(Math.max(value, 20), 250);
      });
    });
    return next;
  } catch {
    return cloneTechnology();
  }
}

let rates = readStoredRates();
const glassCatalogKey = "oknoSmetaGlassCatalog";
function standardGlassCatalog() {
  return Object.fromEntries(["pvc", "aluminum", "wood"].map(material => [material, structuredClone(GLASS)]));
}
function loadGlassCatalog() {
  const defaults = standardGlassCatalog();
  try {
    const saved = JSON.parse(localStorage.getItem(glassCatalogKey));
    for (const material of Object.keys(defaults)) {
      if (saved?.[material] && Object.keys(saved[material]).length) defaults[material] = saved[material];
    }
  } catch {}
  return defaults;
}
let glassCatalog = loadGlassCatalog();
let glassDraft;
function fitsGlassProfile(item, profile) {
  return !Array.isArray(item.profileIds) || item.profileIds.includes(profile);
}
function materialGlass() {
  return Object.fromEntries(Object.entries(glassCatalog[state.material])
    .filter(([, item]) => fitsGlassProfile(item, state.profile)));
}
function syncGlassChoices() {
  const catalog = materialGlass();
  if (!Object.hasOwn(catalog, state.defaultGlass)) state.defaultGlass = Object.hasOwn(catalog, "double") ? "double" : Object.keys(catalog)[0];
  sectionPanes().forEach(pane => { if (!Object.hasOwn(catalog, pane.glass)) pane.glass = state.defaultGlass; });
  const options = Object.entries(catalog).map(([id, item]) =>
    `<option value="${escapeHtml(id)}">${escapeHtml(item.name)}${item.detail ? ` · ${escapeHtml(item.detail)}` : ""}</option>`).join("");
  for (const id of ["defaultGlass", "paneGlass"]) {
    const select = $("#" + id);
    if (select.innerHTML !== options && select.dataset.glassOptions !== options) {
      select.innerHTML = options;
      select.dataset.glassOptions = options;
    }
  }
  $("#defaultGlass").value = state.defaultGlass;
}
function renderGlassCatalog() {
  const profiles = catalogDraft[catalogMaterial].profiles;
  const items = Object.entries(glassDraft[catalogMaterial]);
  $("#glassCatalogCount").textContent = `${items.length} шт.`;
  $("#glassCatalogEditor").innerHTML = items.map(([id, item]) => `
    <article class="catalog-profile-card glass-catalog-card" data-glass-id="${escapeHtml(id)}">
      <label class="catalog-field"><span>Название</span><input data-glass-name value="${escapeHtml(item.name)}"></label>
      <label class="catalog-field"><span>Толщина и описание</span><input data-glass-detail value="${escapeHtml(item.detail)}"></label>
      <label class="catalog-field"><span>Цена за м²</span><input data-glass-rate type="number" min="0" step="any" value="${item.rate ?? ""}" ${Object.hasOwn(GLASS,id) ? `placeholder="${rates.glass[id]}"` : ""}></label>
      <button type="button" class="catalog-remove-button" data-remove-glass>Удалить</button>
      <fieldset class="glass-profile-options">
        <legend>Подходит для профильных систем</legend>
        ${profiles.map(profile => `<label><input type="checkbox" data-glass-profile value="${escapeHtml(profile.id)}" ${fitsGlassProfile(item, profile.id) ? "checked" : ""}><span>${escapeHtml(profile.name)}</span></label>`).join("")}
      </fieldset>
    </article>`).join("");
}
function captureGlassDraft() {
  $$("#glassCatalogEditor [data-glass-id]").forEach(row => {
    const item = glassDraft[catalogMaterial][row.dataset.glassId];
    item.name = row.querySelector("[data-glass-name]").value.trim();
    item.detail = row.querySelector("[data-glass-detail]").value.trim();
    const raw = row.querySelector("[data-glass-rate]").value;
    item.rate = raw === "" ? null : Number(raw);
    const boxes = [...row.querySelectorAll("[data-glass-profile]")];
    const checked = boxes.filter(box => box.checked).map(box => box.value);
    if (Array.isArray(item.profileIds) || checked.length !== boxes.length) item.profileIds = checked;
  });
}

let technology = readStoredTechnology();
let catalogDraft = null;
let catalogMaterial = "pvc";
let catalogSequence = 0;
let impostSequence = 10;
let canvasLayout = null;
let dragState = null;

function createDefaultState() {
  return {
    material: "pvc",
    profile: "pvc70",
    finish: "white",
    shape: "rect",
    width: 1300,
    height: 1300,
    quantity: 1,
    cols: 1,
    rows: 1,
    vImposts: [],
    hImposts: [],
    defaultGlass: "double",
    selectedPane: 0,
    selectedImpost: null,
    panes: [
      { opening: "fixed", glass: "double", innerImposts: [] },
    ],
  };
}

let state = createDefaultState();
let multiSections = new Set();
let sharedAxis = null;
function selectedSections() {
  const entries = sectionLayout();
  const indices = multiSections.size ? [...multiSections] : [state.selectedPane];
  return indices.map(i => entries[i]).filter(entry => entry && !entry.pane.split);
}
let orderItems = [];
let editingOrderItemId = null;
let orderItemSequence = 0;
let projects = readStoredProjects();
let activeProjectId = null;
let activeProjectName = "";
let projectDirty = false;
let currentStateBaseline = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

function formatMoney(value) {
  return moneyFormatter.format(Math.round(value));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function pluralizeRu(count, one, few, many) {
  const value = Math.abs(Number(count)) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createCatalogId(prefix) {
  catalogSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${catalogSequence}`;
}

function getProfile() {
  return MATERIALS[state.material].profiles.find((item) => item.id === state.profile) || MATERIALS[state.material].profiles[0];
}

function getFinish() {
  return MATERIALS[state.material].finishes.find((item) => item.id === state.finish) || MATERIALS[state.material].finishes[0];
}

const SASH_OVERLAP_MM = 24;
const DEFAULT_GLASS_BITE_MM = 14;

function getTechnology() {
  const profile = getProfile();
  const fallback = technology[state.material];
  return {
    frame: clamp(profile.frameWidth ?? fallback.frame, 20, 250),
    sash: clamp(profile.sashWidth ?? fallback.sash, 20, 250),
    impost: clamp(profile.impostWidth ?? fallback.impost, 20, 250),
    glassBite: clamp(profile.glassBite ?? DEFAULT_GLASS_BITE_MM, 0, 100),
  };
}

function createOrderItemId() {
  orderItemSequence += 1;
  return `order-item-${Date.now().toString(36)}-${orderItemSequence}`;
}

function snapshotCurrentState() {
  return cloneData({ ...state, selectedImpost: null });
}

function comparableCurrentState(source = state) {
  const comparable = cloneData(source);
  delete comparable.selectedPane;
  delete comparable.selectedImpost;
  return JSON.stringify(comparable);
}

function markCurrentStateBaseline() {
  currentStateBaseline = comparableCurrentState();
}

function currentProductIsDirty() {
  return Boolean(currentStateBaseline && comparableCurrentState() !== currentStateBaseline);
}

function isPreliminaryShape(shape = state.shape) {
  return shape === "arch" || shape === "circle";
}

function setConfigurationError(message = "") {
  const node = $("#configurationError");
  node.textContent = message;
  node.hidden = !message;
}

function validateCurrentProduct() {
  if (!Number.isFinite(state.width) || state.width < 400 || state.width > 5000) return "Ширина изделия должна быть от 400 до 5000 мм.";
  if (!Number.isFinite(state.height) || state.height < 400 || state.height > 4000) return "Высота изделия должна быть от 400 до 4000 мм.";
  if (!Number.isInteger(state.quantity) || state.quantity < 1 || state.quantity > 99) return "Количество должно быть целым числом от 1 до 99.";
  const material = MATERIALS[state.material];
  if (!material) return "Выбран неизвестный материал профиля.";
  if (!material.profiles.some((item) => item.id === state.profile)) return "Выбранная профильная система больше недоступна.";
  if (!material.finishes.some((item) => item.id === state.finish)) return "Выбранный цвет или отделка больше недоступны.";
  if (!Array.isArray(state.panes) || state.panes.length !== state.cols * state.rows) return "Количество секций не соответствует выбранной разбивке.";

  const tech = getTechnology();
  for (const [index, entry] of sectionLayout().entries()) {
    if (entry.pane.split) continue;
    const small = paneGlassGeometry(entry,tech).fields.find(f => f.clearWidth < 120 || f.clearHeight < 120);
    if (small) return `Секция № ${sectionNumber(index)}: световой проём под стеклопакет должен быть не менее 120 × 120 мм.`;
  }
  return "";
}

function restoreProductState(configuration) {
  state = cloneData(configuration);
  multiSections.clear();
  sharedAxis = null;
  state.selectedImpost = null;
  state.selectedPane = clamp(state.selectedPane ?? 0, 0, Math.max((sectionPanes().length || 1) - 1, 0));
  updateMaterialSelects();
  ensurePanes();
  syncFormFromState();
  markCurrentStateBaseline();
  setConfigurationError();
  renderAll();
}

function resetCurrentProduct() {
  editingOrderItemId = null;
  state = createDefaultState();
  multiSections.clear();
  sharedAxis = null;
  syncFormFromState();
  markCurrentStateBaseline();
  setConfigurationError();
  renderAll();
  renderOrder();
  renderProjectToolbar();
}

function renderOrder() {
  const container = $("#orderItems");
  $("#orderEmpty").hidden = orderItems.length > 0;
  container.innerHTML = orderItems
    .map((item, index) => {
      const material = MATERIALS[item.configuration.material];
      const shape = SHAPES[item.configuration.shape] || item.configuration.shape;
      const dimensions = item.configuration.shape === "circle"
        ? `Ø ${numberFormatter.format(item.configuration.width)} мм`
        : `${numberFormatter.format(item.configuration.width)} × ${numberFormatter.format(item.configuration.height)} мм`;
      return `
        <article class="order-item${item.id === editingOrderItemId ? " editing" : ""}" data-order-item-id="${escapeHtml(item.id)}">
          <div class="order-item-title">
            <div>
              <strong>${escapeHtml(item.name || `Изделие ${index + 1}`)}</strong>
              ${item.preliminary ? '<span class="preliminary-badge">Предварительно</span>' : ""}
              ${item.id === editingOrderItemId ? '<span class="editing-badge">Редактируется</span>' : ""}
            </div>
            <small>${escapeHtml(material?.label || item.configuration.material)} · ${escapeHtml(shape)} · ${dimensions}<br>${item.quantity} шт. × ${formatMoney(item.unitPrice)}</small>
          </div>
          <div class="order-item-price">
            <span>Сумма позиции</span>
            <b>${formatMoney(item.total)}</b>
          </div>
          <div class="order-item-actions">
            <button class="button secondary" type="button" data-order-action="edit">Редактировать</button>
            <button class="button danger" type="button" data-order-action="delete">Удалить</button>
          </div>
        </article>`;
    })
    .join("");

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);
  const preliminary = orderItems.some((item) => item.preliminary);
  $("#orderPositionCount").textContent = `${orderItems.length} ${pluralizeRu(orderItems.length, "позиция", "позиции", "позиций")}`;
  $("#orderTotalPositions").textContent = orderItems.length;
  $("#orderTotalQuantity").textContent = totalQuantity;
  $("#orderTotalPrice").textContent = formatMoney(totalPrice);
  $("#orderTotalLabel").textContent = preliminary ? "Предварительная сумма заказа" : "Сумма заказа";
  $("#saveOrderItem").textContent = editingOrderItemId ? "Сохранить изменения и добавить следующее" : "Сохранить изделие и добавить следующее";
}

function renderPrintOrder() {
  const printOrder = $("#printOrder");
  const hasOrder = orderItems.length > 0;
  document.body.classList.toggle("printing-order", hasOrder);
  if (!hasOrder) {
    printOrder.innerHTML = "";
    return;
  }

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);
  const preliminary = orderItems.some((item) => item.preliminary);
  const printedAt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const positionsMarkup = orderItems
    .map((item, itemIndex) => {
      const configuration = item.configuration;
      const material = MATERIALS[configuration.material];
      const profile = material?.profiles.find((candidate) => candidate.id === configuration.profile);
      const finish = material?.finishes.find((candidate) => candidate.id === configuration.finish);
      const presentation = item.presentation || {};
      const dimensions = configuration.shape === "circle"
        ? `Ø ${numberFormatter.format(configuration.width)} мм`
        : `${numberFormatter.format(configuration.width)} × ${numberFormatter.format(configuration.height)} мм`;
      const specificationRows = (item.specification || [])
        .map(
          (line, lineIndex) => `
            <tr>
              <td>${lineIndex + 1}</td>
              <td><b>${escapeHtml(line.name)}</b>${line.note ? `<small>${escapeHtml(line.note)}</small>` : ""}</td>
              <td>${escapeHtml(line.characteristic)}</td>
              <td>${line.unit === "шт." || line.unit === "компл." ? Math.round(line.qty) : formatNumber(line.qty)}</td>
              <td>${escapeHtml(line.unit)}</td>
              <td>${formatMoney(line.rate)}</td>
              <td><b>${formatMoney(line.total)}</b></td>
            </tr>`,
        )
        .join("");

      return `
        <article class="print-order-item">
          <div class="print-order-item-header">
            <div>
              <span>Позиция ${itemIndex + 1}</span>
              <h2>${escapeHtml(item.name || `Изделие ${itemIndex + 1}`)}</h2>
              <p>${escapeHtml(presentation.material || material?.label || configuration.material)} · ${escapeHtml(presentation.shape || SHAPES[configuration.shape] || configuration.shape)} · ${dimensions}</p>
              <p>${escapeHtml(presentation.profile || profile?.name || configuration.profile)} · ${escapeHtml(presentation.finish || finish?.name || configuration.finish)}</p>
            </div>
            <div class="print-order-item-total">
              ${item.preliminary ? "<span>Предварительный расчёт</span>" : "<span>Сумма позиции</span>"}
              <strong>${formatMoney(item.total)}</strong>
              <small>${item.quantity} шт. × ${formatMoney(item.unitPrice)}</small>
            </div>
          </div>
          ${specificationRows ? `
            <table class="print-order-table">
              <thead><tr><th>№</th><th>Наименование</th><th>Характеристика</th><th>Кол-во</th><th>Ед.</th><th>Цена</th><th>Сумма</th></tr></thead>
              <tbody>${specificationRows}</tbody>
            </table>` : '<p class="print-order-no-spec">Подробная спецификация для этой позиции не сохранена.</p>'}
        </article>`;
    })
    .join("");

  printOrder.innerHTML = `
    <header class="print-order-header">
      <div><span>ОкноСмета</span><h1>Смета заказа</h1><p>Сформировано: ${escapeHtml(printedAt)}</p></div>
      <div class="print-order-summary">
        <span>${orderItems.length} поз. · ${totalQuantity} ${pluralizeRu(totalQuantity, "окно", "окна", "окон")}</span>
        <strong>${formatMoney(totalPrice)}</strong>
        ${preliminary ? "<small>Предварительная сумма заказа</small>" : ""}
      </div>
    </header>
    ${positionsMarkup}
    <footer class="print-order-footer">
      <span>${preliminary ? "Предварительная сумма заказа" : "Итого по заказу"}</span>
      <strong>${formatMoney(totalPrice)}</strong>
      <p>Расчёт не является публичной офертой. Размеры указаны по внешнему габариту рамы.</p>
    </footer>`;
}

function createProjectId() {
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function projectTotals(project) {
  return {
    positions: project.items.length,
    quantity: project.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    total: project.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
  };
}

function renderProjectToolbar() {
  const currentDirty = currentProductIsDirty();
  $("#currentProjectName").textContent = activeProjectName || "Новый проект";
  const status = $("#projectSaveStatus");
  if (activeProjectId && !projectDirty && !currentDirty) {
    status.textContent = "Сохранён";
    status.classList.add("saved");
  } else if (currentDirty) {
    status.textContent = editingOrderItemId ? "Изменения изделия не сохранены" : "Изделие не добавлено";
    status.classList.remove("saved");
  } else if (projectDirty) {
    status.textContent = "Есть изменения";
    status.classList.remove("saved");
  } else {
    status.textContent = "Не сохранён";
    status.classList.remove("saved");
  }
  $("#saveProject").textContent = activeProjectId ? "Сохранить изменения" : "Сохранить проект";
}

function renderProjectsList() {
  const list = $("#projectsList");
  const sorted = [...projects].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  $("#projectsEmpty").hidden = sorted.length > 0;
  list.innerHTML = sorted
    .map((project) => {
      const totals = projectTotals(project);
      const updated = new Date(project.updatedAt || project.createdAt || Date.now());
      const updatedText = Number.isNaN(updated.getTime())
        ? "Дата не указана"
        : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(updated);
      return `
        <article class="project-card${project.id === activeProjectId ? " active" : ""}" data-project-id="${escapeHtml(project.id)}">
          <div class="project-card-info">
            <div class="project-card-title"><strong>${escapeHtml(project.name)}</strong>${project.id === activeProjectId ? "<span>Открыт</span>" : ""}</div>
            <div class="project-card-meta">Изменён: ${escapeHtml(updatedText)}<br>${totals.positions} ${pluralizeRu(totals.positions, "позиция", "позиции", "позиций")} · ${totals.quantity} ${pluralizeRu(totals.quantity, "окно", "окна", "окон")} · ${formatMoney(totals.total)}</div>
          </div>
          <div class="project-card-actions">
            <button class="button secondary" type="button" data-project-action="open">Открыть</button>
            <button class="button danger" type="button" data-project-action="delete">Удалить</button>
          </div>
        </article>`;
    })
    .join("");
}

function hasUnsavedProjectWork() {
  return projectDirty || currentProductIsDirty();
}

function confirmDiscardUnsavedWork(actionText) {
  if (!hasUnsavedProjectWork()) return true;
  return window.confirm(`Есть несохранённые изменения. ${actionText} без их сохранения?`);
}

function confirmProjectSaveWithoutCurrentProduct() {
  if (!currentProductIsDirty()) return true;
  const message = editingOrderItemId
    ? "Изменения открытого изделия ещё не сохранены в заказе. Сохранить проект без этих изменений?"
    : "Текущее изделие ещё не добавлено в заказ. Сохранить проект без него?";
  return window.confirm(message);
}

function saveProjectRecord(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return false;
  const now = new Date().toISOString();
  const existing = activeProjectId ? projects.find((project) => project.id === activeProjectId) : null;
  const project = {
    id: existing?.id || createProjectId(),
    name: cleanName,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    items: cloneData(orderItems),
    orderItemSequence,
  };
  const nextProjects = existing
    ? projects.map((candidate) => (candidate.id === existing.id ? project : candidate))
    : [...projects, project];
  if (!persistProjects(nextProjects)) {
    showToast("Не удалось сохранить проект в браузере");
    return false;
  }
  projects = nextProjects;
  activeProjectId = project.id;
  activeProjectName = project.name;
  projectDirty = false;
  renderProjectToolbar();
  renderProjectsList();
  showToast(`Проект «${project.name}» сохранён`);
  return true;
}

function requestProjectSave() {
  if (!orderItems.length) {
    showToast("Добавьте в заказ хотя бы одно изделие");
    return;
  }
  if (!confirmProjectSaveWithoutCurrentProduct()) return;
  if (activeProjectId) {
    saveProjectRecord(activeProjectName);
    return;
  }
  $("#projectNameInput").value = "";
  $("#projectNameError").hidden = true;
  $("#projectNameDialog").showModal();
  $("#projectNameInput").focus();
}

function openProject(projectId) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  if (!confirmDiscardUnsavedWork(`Открыть проект «${project.name}»`)) return;
  orderItems = cloneData(project.items);
  orderItemSequence = Math.max(
    Number(project.orderItemSequence) || 0,
    ...orderItems.map((item) => Number(String(item.name || "").match(/\d+/)?.[0]) || 0),
    orderItems.length,
  );
  activeProjectId = project.id;
  activeProjectName = project.name;
  projectDirty = false;
  resetCurrentProduct();
  renderProjectsList();
  $("#projectsDialog").close();
  showToast(`Проект «${project.name}» открыт`);
}

function deleteProject(projectId) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project || !window.confirm(`Удалить проект «${project.name}»? Восстановить его будет невозможно.`)) return;
  const nextProjects = projects.filter((candidate) => candidate.id !== projectId);
  if (!persistProjects(nextProjects)) {
    showToast("Не удалось удалить проект из браузера");
    return;
  }
  projects = nextProjects;
  if (activeProjectId === projectId) {
    activeProjectId = null;
    activeProjectName = "";
    projectDirty = orderItems.length > 0;
  }
  renderProjectToolbar();
  renderProjectsList();
  showToast(`Проект «${project.name}» удалён`);
}

function startNewProject() {
  if (!confirmDiscardUnsavedWork("Создать новый проект")) return;
  activeProjectId = null;
  activeProjectName = "";
  projectDirty = false;
  orderItems = [];
  orderItemSequence = 0;
  resetCurrentProduct();
  renderProjectsList();
  showToast("Создан новый проект");
}

function saveCurrentOrderItem() {
  ensurePanes();
  const validationError = validateCurrentProduct();
  if (validationError) {
    setConfigurationError(validationError);
    showToast(validationError);
    return;
  }

  setConfigurationError();
  const calculation = buildSpecification();
  const savedUnitPrice = Math.round(calculation.unitPrice);
  const currentItem = editingOrderItemId ? orderItems.find((item) => item.id === editingOrderItemId) : null;
  const nextItem = {
    id: currentItem?.id || createOrderItemId(),
    name: currentItem?.name || `Изделие ${orderItemSequence}`,
    configuration: snapshotCurrentState(),
    quantity: state.quantity,
    unitPrice: savedUnitPrice,
    total: savedUnitPrice * state.quantity,
    preliminary: isPreliminaryShape(),
    presentation: {
      material: calculation.material.label,
      profile: calculation.profile.name,
      finish: calculation.finish.name,
      shape: SHAPES[state.shape],
    },
    specification: cloneData(calculation.lines),
    updatedAt: new Date().toISOString(),
  };

  if (currentItem) {
    const index = orderItems.findIndex((item) => item.id === currentItem.id);
    orderItems[index] = nextItem;
    showToast(`${nextItem.name} обновлено`);
  } else {
    orderItems.push(nextItem);
    showToast(`${nextItem.name} добавлено в заказ`);
  }
  projectDirty = true;
  resetCurrentProduct();
}

function editOrderItem(itemId) {
  const item = orderItems.find((candidate) => candidate.id === itemId);
  if (!item) return;
  editingOrderItemId = item.id;
  restoreProductState(item.configuration);
  renderOrder();
  $("#saveOrderItem").scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteOrderItem(itemId) {
  const item = orderItems.find((candidate) => candidate.id === itemId);
  if (!item || !window.confirm(`Удалить «${item.name}» из заказа?`)) return;
  orderItems = orderItems.filter((candidate) => candidate.id !== itemId);
  projectDirty = true;
  if (editingOrderItemId === itemId) resetCurrentProduct();
  else {
    renderOrder();
    renderProjectToolbar();
  }
  showToast(`${item.name} удалено`);
}

function createImpostId(scope, orientation) {
  impostSequence += 1;
  return `${scope}-${orientation[0]}-${impostSequence}`;
}

function makeEvenImposts(count, size, orientation) {
  return Array.from({ length: count }, (_, index) => ({
    id: createImpostId("root", orientation),
    position: Math.round(((index + 1) * size) / (count + 1) / 10) * 10,
  }));
}

function minimumSegment(size, impostCount) {
  return Math.min(220, Math.max(70, (size / (impostCount + 1)) * 0.36));
}

function normalizeRootImposts() {
  const normalize = (items, size) => {
    items.sort((a, b) => a.position - b.position);
    const gap = minimumSegment(size, items.length);
    items.forEach((item, index) => {
      const lower = index === 0 ? gap : items[index - 1].position + gap;
      item.position = Math.max(lower, Math.min(Number(item.position) || lower, size - gap));
    });
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const upper = index === items.length - 1 ? size - gap : items[index + 1].position - gap;
      items[index].position = Math.min(items[index].position, upper);
    }
  };
  normalize(state.vImposts, state.width);
  normalize(state.hImposts, state.height);
  state.cols = state.vImposts.length + 1;
  state.rows = state.hImposts.length + 1;
}

function primaryBoundaries(orientation) {
  const size = orientation === "vertical" ? state.width : state.height;
  const items = orientation === "vertical" ? state.vImposts : state.hImposts;
  return [0, ...items.map((item) => item.position), size];
}

function sectionLayout(x = primaryBoundaries("vertical"), y = primaryBoundaries("horizontal")) {
  const entries = [];
  function visit(pane, rect, [l,r,t,b]) {
    entries.push({ pane, rect, edges: [l,r,t,b] });
    if (!pane.split) return;
    const [a,c] = pane.children;
    const p = pane.split.position;
    if (pane.split.orientation === "vertical") {
      const d = rect.width*p;
      visit(a,{...rect,width:d},[l,false,t,b]);
      visit(c,{...rect,x:rect.x+d,width:rect.width-d},[false,r,t,b]);
    } else {
      const d = rect.height*p;
      visit(a,{...rect,height:d},[l,r,t,false]);
      visit(c,{...rect,y:rect.y+d,height:rect.height-d},[l,r,false,b]);
    }
  }
  state.panes.forEach((pane,i) => {
    const c=i%state.cols, r=Math.floor(i/state.cols);
    visit(pane,{x:x[c],y:y[r],width:x[c+1]-x[c],height:y[r+1]-y[r]},
      [c===0,c===state.cols-1,r===0,r===state.rows-1]);
  });
  return entries;
}
function sectionPanes() { return sectionLayout().map(e => e.pane); }
function getPanePhysicalRect(i) { return sectionLayout()[i].rect; }
function sectionNumber(i) { return sectionPanes().slice(0,i+1).filter(p => !p.split).length; }

function paneGlassUnits(pane) {
  const vertical = pane.innerImposts.filter((item) => item.orientation === "vertical").length;
  const horizontal = pane.innerImposts.filter((item) => item.orientation === "horizontal").length;
  return (vertical + 1) * (horizontal + 1);
}

function ensurePanes() {
  normalizeRootImposts();
  const count = state.cols * state.rows;
  const panes = Array.from({ length: count }, (_, index) => {
    if (state.panes[index]) {
      return {
        ...state.panes[index],
        innerImposts: Array.isArray(state.panes[index].innerImposts) ? state.panes[index].innerImposts.map((item) => ({ ...item })) : [],
      };
    }
    return { opening: "fixed", glass: state.defaultGlass, innerImposts: [] };
  });
  state.panes = panes;
  sectionPanes().forEach(p => { if (p.split) p.innerImposts = [p.split]; });
  if (state.selectedPane !== null) state.selectedPane = clamp(state.selectedPane, 0, Math.max(sectionPanes().length - 1, 0));
  if (state.selectedImpost?.scope === "pane" && !sectionPanes()[state.selectedImpost.paneIndex]?.innerImposts.some(item => item.id === state.selectedImpost.id)) state.selectedImpost = null;
  if (!state.selectedImpost) while (sectionPanes()[state.selectedPane]?.split) state.selectedPane += 1;
}

function getSelectedImpostRecord() {
  const selected = state.selectedImpost;
  if (!selected) return null;
  if (selected.scope === "root") {
    const collection = selected.orientation === "vertical" ? state.vImposts : state.hImposts;
    const item = collection.find((candidate) => candidate.id === selected.id);
    return item ? { selected, item, collection } : null;
  }
  const pane = sectionPanes()[selected.paneIndex];
  const item = pane?.innerImposts.find((candidate) => candidate.id === selected.id);
  return item ? { selected, item, collection: pane.innerImposts, pane } : null;
}

function rootImpostLimits(item, orientation) {
  const collection = orientation === "vertical" ? state.vImposts : state.hImposts;
  const size = orientation === "vertical" ? state.width : state.height;
  const index = collection.findIndex((candidate) => candidate.id === item.id);
  const gap = minimumSegment(size, collection.length);
  return {
    min: index <= 0 ? gap : collection[index - 1].position + gap,
    max: index >= collection.length - 1 ? size - gap : collection[index + 1].position - gap,
  };
}

function nestedImpostLimits(item, pane) {
  const siblings = pane.innerImposts.filter((candidate) => candidate.orientation === item.orientation).sort((a, b) => a.position - b.position);
  const index = siblings.findIndex((candidate) => candidate.id === item.id);
  const gap = Math.min(0.16, 0.42 / (siblings.length + 1));
  return {
    min: index <= 0 ? gap : siblings[index - 1].position + gap,
    max: index >= siblings.length - 1 ? 1 - gap : siblings[index + 1].position - gap,
  };
}

function updateMaterialSelects(reset = false) {
  const material = MATERIALS[state.material];
  if (reset || !material.profiles.some((item) => item.id === state.profile)) state.profile = material.profiles[1]?.id || material.profiles[0].id;
  if (reset || !material.finishes.some((item) => item.id === state.finish)) state.finish = material.finishes[0].id;

  $("#profileSystem").innerHTML = material.profiles
    .map((item) => `<option value="${item.id}" ${item.id === state.profile ? "selected" : ""}>${item.name}</option>`)
    .join("");
  $("#finish").innerHTML = material.finishes
    .map((item) => `<option value="${item.id}" ${item.id === state.finish ? "selected" : ""}>${item.name}</option>`)
    .join("");
}

function paneGlassGeometry(entry, tech = getTechnology()) {
  const {pane, rect, edges} = entry;
  const cuts = edges.map(edge => edge ? tech.frame : tech.impost / 2);
  const sash = pane.opening !== "fixed";
  const outer = [rect.x+cuts[0], rect.y+cuts[2], rect.x+rect.width-cuts[1], rect.y+rect.height-cuts[3]];
  const sashBox = sash ? [outer[0]-SASH_OVERLAP_MM, outer[1]-SASH_OVERLAP_MM,
    outer[2]+SASH_OVERLAP_MM, outer[3]+SASH_OVERLAP_MM] : null;
  const opening = sash ? [sashBox[0]+tech.sash,sashBox[1]+tech.sash,sashBox[2]-tech.sash,sashBox[3]-tech.sash] : outer;
  const [l,t,r,b] = opening;
  const intervals = (orientation, low, high, origin, length) => {
    const axes = pane.innerImposts.filter(item => item.orientation === orientation && !pane.split)
      .map(item => origin + item.position * length).sort((a,b) => a-b);
    return Array.from({length:axes.length+1},(_,i) => [
      i ? axes[i-1]+tech.impost/2 : low,
      i < axes.length ? axes[i]-tech.impost/2 : high,
    ]);
  };
  const fields = intervals("horizontal",t,b,rect.y,rect.height).flatMap(([top,bottom]) =>
    intervals("vertical",l,r,rect.x,rect.width).map(([left,right]) => {
      const bite = tech.glassBite;
      const clearWidth = right-left, clearHeight = bottom-top;
      return {x:left-bite,y:top-bite,width:clearWidth+2*bite,height:clearHeight+2*bite,clearWidth,clearHeight};
    }));
  return {fields,sashBox,opening};
}

function paneGlazingArea(index, pane, shapeFactor = 1) {
  return paneGlassGeometry(sectionLayout()[index]).fields.reduce((sum, field) =>
    sum + (field.clearWidth > 0 && field.clearHeight > 0 ? field.width * field.height : 0), 0) * shapeFactor / 1_000_000;
}

function glassDimensionText(field) {
  return field.clearWidth > 0 && field.clearHeight > 0
    ? `${Math.round(field.width)} × ${Math.round(field.height)}` : "—";
}

function geometry() {
  const widthM = state.width / 1000;
  const heightM = state.height / 1000;
  let area;
  let perimeter;
  let verticalFactor = 1;
  let horizontalFactor = 1;

  if (state.shape === "circle") {
    area = Math.PI * (widthM / 2) ** 2;
    perimeter = Math.PI * widthM;
    verticalFactor = 0.78;
    horizontalFactor = 0.78;
  } else if (state.shape === "arch") {
    const rise = Math.min(widthM / 2, heightM * 0.42);
    const a = widthM / 2;
    const b = rise;
    const lowerHeight = heightM - rise;
    area = widthM * lowerHeight + (Math.PI * a * b) / 2;
    const h = ((a - b) ** 2) / ((a + b) ** 2);
    const ellipse = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    perimeter = widthM + 2 * lowerHeight + ellipse / 2;
    verticalFactor = 0.88;
    horizontalFactor = 0.94;
  } else {
    area = widthM * heightM;
    perimeter = 2 * (widthM + heightM);
  }

  const shapeFactor = Math.min(1, area / Math.max(widthM * heightM, 0.001));
  const primaryImpost = state.vImposts.length * heightM * verticalFactor + state.hImposts.length * widthM * horizontalFactor;
  let nestedImpost = 0;
  let nestedCount = 0;
  let glassUnits = 0;
  const paneGlazingAreas = [];
  sectionPanes().forEach((pane, index) => {
    const paneRect = getPanePhysicalRect(index);
    pane.innerImposts.forEach((item) => {
      nestedCount += 1;
      nestedImpost += item.orientation === "vertical" ? (paneRect.height / 1000) * verticalFactor : (paneRect.width / 1000) * horizontalFactor;
    });
    if (pane.split) return;
    glassUnits += paneGlassUnits(pane);
    paneGlazingAreas[index] = paneGlazingArea(index, pane, shapeFactor);
  });
  const glazingArea = paneGlazingAreas.reduce((sum, value) => sum + value, 0);
  const impost = primaryImpost + nestedImpost;
  return { area, perimeter, glazingArea, paneGlazingAreas, impost, primaryImpost, nestedImpost, nestedCount, glassUnits };
}

function buildSpecification() {
  const dimensions = geometry();
  const material = MATERIALS[state.material];
  const profile = getProfile();
  const finish = getFinish();
  const tech = getTechnology();
  const quantity = state.quantity;
  const lines = [];

  const addLine = ({ name, note = "", characteristic, qty, unit, rate, sort = 0 }) => {
    const total = qty * rate;
    lines.push({ name, note, characteristic, qty, unit, rate, total, sort });
    return total;
  };

  const frameRate = rates.frame[state.material] * profile.factor;
  const frameUnitTotal = dimensions.perimeter * frameRate;
  addLine({
    name: "Профиль рамы",
    note: "Внешний контур конструкции",
    characteristic: `${profile.name}; ${finish.name}; ширина ${tech.frame} мм`,
    qty: dimensions.perimeter * quantity,
    unit: "пог. м",
    rate: frameRate,
  });

  let impostUnitTotal = 0;
  if (dimensions.impost > 0.001) {
    const impostRate = rates.impost[state.material] * profile.factor;
    impostUnitTotal = dimensions.impost * impostRate;
    addLine({
      name: "Импост",
      note: "Профиль разбивки светового проёма",
      characteristic: `Ширина ${tech.impost} мм; в раме: ${state.vImposts.length + state.hImposts.length}; в секциях: ${dimensions.nestedCount}`,
      qty: dimensions.impost * quantity,
      unit: "пог. м",
      rate: impostRate,
    });
  }

  if (state.material === "pvc") {
    addLine({
      name: "Стальное армирование",
      note: "Усиление рамы и импостов",
      characteristic: "Оцинкованный профиль",
      qty: (dimensions.perimeter + dimensions.impost) * quantity,
      unit: "пог. м",
      rate: rates.reinforcement,
    });
  }

  addLine({
    name: "Контур уплотнения",
    note: "Эластомерный уплотнитель",
    characteristic: `${profile.seals} контура`,
    qty: dimensions.perimeter * profile.seals * quantity,
    unit: "пог. м",
    rate: rates.seal[state.material],
  });

  const beadLength = dimensions.perimeter * 0.78 + dimensions.impost * 2;
  addLine({
    name: "Штапик",
    note: "Фиксация стеклопакета в створке и раме",
    characteristic: `Системный, ${material.label}`,
    qty: beadLength * quantity,
    unit: "пог. м",
    rate: rates.bead[state.material],
  });

  const glassGroups = sectionPanes().reduce((groups, pane, index) => {
    if (pane.split) return groups;
    const group = groups[pane.glass] || { fields: 0, area: 0 };
    group.fields += paneGlassUnits(pane);
    group.area += dimensions.paneGlazingAreas[index] || 0;
    groups[pane.glass] = group;
    return groups;
  }, {});
  Object.entries(glassGroups).forEach(([glassKey, group]) => {
    const glass = materialGlass()[glassKey] ?? materialGlass()[state.defaultGlass] ?? Object.values(materialGlass())[0];
    addLine({
      name: `${glass.name} стеклопакет`,
      note: "Заполнение светового проёма",
      characteristic: `${glass.detail}; полей: ${group.fields}`,
      qty: group.area * quantity,
      unit: "м²",
      rate: glass.rate ?? rates.glass[glassKey] ?? rates.glass[state.defaultGlass] ?? rates.glass["double"],
    });
  });

  const openingGroups = sectionPanes().reduce((groups, pane) => {
    if (pane.split) return groups;
    if (pane.opening !== "fixed") groups[pane.opening] = (groups[pane.opening] || 0) + 1;
    return groups;
  }, {});
  Object.entries(openingGroups).forEach(([openingKey, count]) => {
    addLine({
      name: `Фурнитура: ${OPENINGS[openingKey].name.toLowerCase()}`,
      note: "Комплект петель, запоров и ответных планок",
      characteristic: `Комплект на створку; ширина профиля ${tech.sash} мм`,
      qty: count * quantity,
      unit: "компл.",
      rate: rates.hardware[openingKey],
    });
  });

  const sashCount = Object.values(openingGroups).reduce((sum, value) => sum + value, 0);
  if (sashCount) {
    addLine({
      name: "Оконная ручка",
      note: "Ручка с креплением",
      characteristic: "В цвет профиля",
      qty: sashCount * quantity,
      unit: "шт.",
      rate: rates.handle,
    });
  }

  addLine({
    name: "Сборочный комплект",
    note: "Соединители, крепёж, опорные и дистанционные элементы",
    characteristic: `Для системы: ${profile.name}`,
    qty: quantity,
    unit: "компл.",
    rate: rates.assembly[state.material],
  });

  const finishUnitTotal = (frameUnitTotal + impostUnitTotal) * Math.max(0, finish.factor - 1);
  if (finishUnitTotal > 0.01) {
    addLine({
      name: "Декоративная отделка профиля",
      note: "Ламинация, окраска или анодирование",
      characteristic: finish.name,
      qty: quantity,
      unit: "компл.",
      rate: finishUnitTotal,
    });
  }

  let unitSubtotal = lines.reduce((sum, line) => sum + line.total, 0) / quantity;
  const shapeRate = state.shape === "arch" ? rates.archSurcharge : state.shape === "circle" ? rates.circleSurcharge : 0;
  if (shapeRate > 0) {
    const shapeUnitTotal = unitSubtotal * (shapeRate / 100);
    addLine({
      name: "Изготовление нестандартной формы",
      note: "Гибка профиля и индивидуальная сборка",
      characteristic: `${SHAPES[state.shape]}; +${shapeRate}%`,
      qty: quantity,
      unit: "компл.",
      rate: shapeUnitTotal,
    });
    unitSubtotal += shapeUnitTotal;
  }

  if (rates.markup > 0) {
    addLine({
      name: "Расчётная наценка",
      note: "Задаётся в настройках прайса",
      characteristic: `${rates.markup}%`,
      qty: quantity,
      unit: "компл.",
      rate: unitSubtotal * (rates.markup / 100),
    });
  }

  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return { lines, total, unitPrice: total / quantity, sashCount, ...dimensions, material, profile, finish };
}

function shapePaths(x, y, width, height, frame) {
  if (state.shape === "circle") {
    return {
      outer: `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" />`,
      inner: `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${Math.max(width / 2 - frame, 2)}" ry="${Math.max(height / 2 - frame, 2)}" />`,
      innerBox: { x: x + frame, y: y + frame, width: width - frame * 2, height: height - frame * 2 },
    };
  }

  if (state.shape === "arch") {
    const rise = Math.min(width / 2, height * 0.42);
    const outer = `M ${x} ${y + height} L ${x} ${y + rise} A ${width / 2} ${rise} 0 0 1 ${x + width} ${y + rise} L ${x + width} ${y + height} Z`;
    const ix = x + frame;
    const iy = y + frame;
    const iw = width - frame * 2;
    const ih = height - frame * 2;
    const innerRise = Math.max(rise - frame * 0.72, 8);
    const inner = `M ${ix} ${iy + ih} L ${ix} ${iy + innerRise} A ${iw / 2} ${innerRise} 0 0 1 ${ix + iw} ${iy + innerRise} L ${ix + iw} ${iy + ih} Z`;
    return { outer: `<path d="${outer}" />`, inner: `<path d="${inner}" />`, innerBox: { x: ix, y: iy, width: iw, height: ih } };
  }

  return {
    outer: `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" />`,
    inner: `<rect x="${x + frame}" y="${y + frame}" width="${width - frame * 2}" height="${height - frame * 2}" rx="2" />`,
    innerBox: { x: x + frame, y: y + frame, width: width - frame * 2, height: height - frame * 2 },
  };
}

function openingSymbol(type, x, y, width, height, side) {
  const pad = Math.min(11, width * 0.08, height * 0.08);
  const left = x + pad;
  const right = x + width - pad;
  const top = y + pad;
  const bottom = y + height - pad;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const stroke = "#4d7085";
  let paths = "";

  const mirrored = side === "right" && ["turn", "tiltturn"].includes(type);
  const hinge = mirrored ? right : left, free = mirrored ? left : right;
  const handle = mirrored ? left + 4 : right - 4;
  if (type === "turn" || type === "tiltturn") {
    paths += `<path d="M ${hinge} ${top} L ${free} ${cy} L ${hinge} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type === "tilt" || type === "tiltturn") {
    paths += `<path d="M ${left} ${bottom} L ${cx} ${top} L ${right} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type !== "fixed") {
    paths += `<line x1="${handle}" y1="${cy - 10}" x2="${handle}" y2="${cy + 10}" stroke="#20384c" stroke-width="3" stroke-linecap="round" />`;
  }
  return paths;
}

function sharedImpostLimits(group, orientation) {
  const v = orientation === "vertical";
  const entries = sectionLayout();
  const members = group.flatMap(({id,index}) => {
    const entry = entries[index];
    const item = index == null ? (v ? state.vImposts : state.hImposts).find(i => i.id === id)
      : entry?.pane.innerImposts.find(i => i.id === id);
    if (!item) return [];
    const start = entry ? (v ? entry.rect.x : entry.rect.y) : 0;
    const size = entry ? (v ? entry.rect.width : entry.rect.height) : 1;
    const limits = entry ? nestedImpostLimits(item, entry.pane) : rootImpostLimits(item, orientation);
    return [{item,start,size,min:start+limits.min*size,max:start+limits.max*size}];
  });
  return {members, min:Math.max(...members.map(m=>m.min)), max:Math.min(...members.map(m=>m.max))};
}

function isSelectedImpost(scope, orientation, id, paneIndex = null) {
  const selected = state.selectedImpost;
  return Boolean(selected && selected.scope === scope && selected.orientation === orientation && selected.id === id && (scope === "root" || selected.paneIndex === paneIndex));
}

function renderCanvas() {
  const svg = $("#windowCanvas");
  const maxWidth = 455;
  const maxHeight = 350;
  const ratio = state.width / state.height;
  let width = maxWidth;
  let height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  width = Math.max(width, 150);
  height = Math.max(height, 150);
  const x = 326 - width / 2;
  const y = 229 - height / 2;
  const tech = getTechnology();
  const sx = width/state.width, sy = height/state.height;
  const canvasScale = Math.min(sx, sy);
  const frame = tech.frame * canvasScale;
  const impostFace = tech.impost * canvasScale;
  const toX = value => x + value*sx, toY = value => y + value*sy;
  const material = MATERIALS[state.material];
  const profileColor = getFinish().color || material.frame;
  const paths = shapePaths(x, y, width, height, frame);
  const box = paths.innerBox;
  const rootVerticalX = state.vImposts.map((item) => x + (item.position / state.width) * width);
  const rootHorizontalY = state.hImposts.map((item) => y + (item.position / state.height) * height);
  const xBounds = [box.x, ...rootVerticalX, box.x + box.width];
  const yBounds = [box.y, ...rootHorizontalY, box.y + box.height];
  const paneRects = [];
  const dimensionGroups = new Map();
  const addDimension = (vertical, start, end, physicalOrigin, local, item, index = null) => {
    const absolute = physicalOrigin + local;
    const key = `${item.orientation}:${Math.round(absolute * 1000)}`;
    if (!dimensionGroups.has(key)) dimensionGroups.set(key, []);
    dimensionGroups.get(key).push({vertical,start,end,absolute,local,item,index,id:item.id});
  };

  let panesMarkup = "", localImpostsMarkup = "", sashMarkup = "", glassAnnotations = "";
  sectionLayout().forEach((entry, index) => {
    const {pane,rect:physical} = entry;
    const px = toX(physical.x), py = toY(physical.y);
    const paneWidth = physical.width*sx, paneHeight = physical.height*sy;
    paneRects[index] = { x: px, y: py, width: paneWidth, height: paneHeight, physicalWidth: physical.width, physicalHeight: physical.height };
    const glass = materialGlass()[pane.glass];
    const selected = index === state.selectedPane || multiSections.has(index);
    const paneKind = pane.opening === "fixed" ? "глухой секции" : "створке";
    const paneImpostFace = impostFace;
    let innerImpostsMarkup = "";

    pane.innerImposts.forEach((item) => {
      const active = isSelectedImpost("pane", item.orientation, item.id, index);
      const isVertical = item.orientation === "vertical";
      const lineX = px + item.position * paneWidth;
      const lineY = py + item.position * paneHeight;
      const physicalPosition = item.position * (isVertical ? physical.width : physical.height);
      if (isVertical) {
        addDimension(false, px, lineX, physical.x, physicalPosition, item, index);
        innerImpostsMarkup += `
          <line class="impost-visible inner-impost-visible${active ? " selected" : ""}" x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" stroke="${profileColor}" stroke-width="${paneImpostFace}" />
          <line x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" stroke="${material.edge}" stroke-width="1.2" opacity=".55" pointer-events="none" />
          <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 7}" y="${py + paneHeight / 2 - 14}" width="14" height="28" rx="7" />
          <line class="impost-hit" data-scope="pane" data-pane="${index}" data-orientation="vertical" data-id="${item.id}" x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" tabindex="0" role="slider" aria-label="Вертикальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          `;
      } else {
        addDimension(true, py, lineY, physical.y, physicalPosition, item, index);
        innerImpostsMarkup += `
          <line class="impost-visible inner-impost-visible${active ? " selected" : ""}" x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" stroke="${profileColor}" stroke-width="${paneImpostFace}" />
          <line x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" stroke="${material.edge}" stroke-width="1.2" opacity=".55" pointer-events="none" />
          <rect class="impost-grip${active ? " selected" : ""}" x="${px + paneWidth / 2 - 14}" y="${lineY - 7}" width="28" height="14" rx="7" />
          <line class="impost-hit horizontal" data-scope="pane" data-pane="${index}" data-orientation="horizontal" data-id="${item.id}" x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" tabindex="0" role="slider" aria-label="Горизонтальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          `;
      }
    });

    localImpostsMarkup += innerImpostsMarkup;
    if (pane.split) return;
    const {fields,sashBox,opening} = paneGlassGeometry(entry,tech);
    if (sashBox) {
      const [l,t,r,b]=sashBox;
      const [il,it,ir,ib]=opening;
      if (ir>il && ib>it) {
        sashMarkup += `<path d="M ${toX(l)} ${toY(t)} H ${toX(r)} V ${toY(b)} H ${toX(l)} Z
          M ${toX(il)} ${toY(it)} H ${toX(ir)} V ${toY(ib)} H ${toX(il)} Z"
          fill="${profileColor}" fill-rule="evenodd" stroke="${material.edge}" stroke-width="0.8" />`;
        sashMarkup += openingSymbol(pane.opening,toX(il),toY(it),(ir-il)*sx,(ib-it)*sy,pane.hingeSide);
      }
    }
    for(const field of fields) {
      if (field.clearWidth<=0 || field.clearHeight<=0) continue;
      const fx=toX(field.x), fy=toY(field.y), fw=field.width*sx, fh=field.height*sy;
      const fs=Math.min(10,fw/7,fh/4);
      if (selected) glassAnnotations += `<rect class="pane-selected" x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="none"/>`;
      if(fs>=4) glassAnnotations += `<text x="${fx+fw/2}" y="${fy+fh/2+Math.min(26,fh/3)}"
        text-anchor="middle" font-size="${fs}" fill="#20384c" paint-order="stroke"
        stroke="#edf6fa" stroke-width="2">${state.shape === "rect" ? "" : "≈ "}${glassDimensionText(field)} мм</text>`;
    }
    panesMarkup += `
      <g class="pane" data-index="${index}" clip-path="url(#innerClip)">
        <rect x="${px}" y="${py}" width="${paneWidth}" height="${paneHeight}" fill="${glass.color}" />
        <rect x="${px}" y="${py}" width="${paneWidth}" height="${paneHeight}" fill="url(#glassSheen)" opacity="0.55" />
        <circle cx="${px + paneWidth / 2}" cy="${py + paneHeight / 2}" r="14" fill="rgba(255,255,255,.82)" stroke="rgba(53,80,105,.22)" />
        <text class="pane-number" x="${px + paneWidth / 2}" y="${py + paneHeight / 2 + 4}">${sectionNumber(index)}</text>
        <rect class="pane-hit" data-pane="${index}" x="${px}" y="${py}" width="${paneWidth}" height="${paneHeight}" fill="transparent" tabindex="0" role="button" aria-label="Настроить секцию ${index + 1}" />
      </g>`;
  });

  let rootImpostsMarkup = "";
  state.vImposts.forEach((item, index) => {
    const lineX = rootVerticalX[index];
    const active = isSelectedImpost("root", "vertical", item.id);
    addDimension(false, x, lineX, 0, item.position, item);
    rootImpostsMarkup += `
      <line class="impost-visible${active ? " selected" : ""}" x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" stroke="${profileColor}" stroke-width="${impostFace}" />
      <line x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" stroke="${material.edge}" stroke-width="1.4" opacity=".55" pointer-events="none" />
      <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 8}" y="${box.y + box.height / 2 - 18}" width="16" height="36" rx="8" />
      <line class="impost-hit" data-scope="root" data-orientation="vertical" data-id="${item.id}" x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" tabindex="0" role="slider" aria-label="Вертикальный импост рамы" aria-valuemin="0" aria-valuemax="${state.width}" aria-valuenow="${Math.round(item.position)}" />
      `;
  });
  state.hImposts.forEach((item, index) => {
    const lineY = rootHorizontalY[index];
    const active = isSelectedImpost("root", "horizontal", item.id);
    addDimension(true, y, lineY, 0, item.position, item);
    rootImpostsMarkup += `
      <line class="impost-visible${active ? " selected" : ""}" x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" stroke="${profileColor}" stroke-width="${impostFace}" />
      <line x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" stroke="${material.edge}" stroke-width="1.4" opacity=".55" pointer-events="none" />
      <rect class="impost-grip${active ? " selected" : ""}" x="${box.x + box.width / 2 - 18}" y="${lineY - 8}" width="36" height="16" rx="8" />
      <line class="impost-hit horizontal" data-scope="root" data-orientation="horizontal" data-id="${item.id}" x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" tabindex="0" role="slider" aria-label="Горизонтальный импост рамы" aria-valuemin="0" aria-valuemax="${state.height}" aria-valuenow="${Math.round(item.position)}" />
      `;
  });

  canvasLayout = { x, y, width, height, box, xBounds, yBounds, paneRects };
  const leftDimensionX = Math.max(24, x - 39);
  const bottomDimensionY = Math.min(476, y + height + 39);
  const axisGroups = [...dimensionGroups.values()];
  const tracks = [[], []];
  const axisMarkup = axisGroups.map((group, i) => {
    const first = group[0], {vertical, end} = first;
    const common = group.length > 1;
    const start = common ? (vertical ? y : x) : first.start;
    const mid = (start + end) / 2;
    const rows = tracks[Number(vertical)];
    const range = [Math.min(start,mid-45), Math.max(end,mid+45)];
    let level = rows.findIndex(row => row.every(([a,b])=>b<range[0]||a>range[1]));
    if(level<0){level=rows.length;rows.push([]);} rows[level].push(range);
    const edge = vertical ? x+width+5 : y-5;
    const track = edge+(vertical?1:-1)*(25+level*29);
    const line=(a,b,c,d,arrows=false)=>`<line class="dimension-line" x1="${vertical?b:a}" y1="${vertical?a:b}" x2="${vertical?d:c}" y2="${vertical?c:d}" ${arrows?'marker-start="url(#dimArrow)" marker-end="url(#dimArrow)"':'opacity=".45"'}/>`;
    const text=`${Math.round(common?first.absolute:first.local)} мм`;
    return `<g>${line(start,edge,start,track)}${line(end,edge,end,track)}${line(start,track,end,track,true)}
      <g transform="translate(${vertical?track:mid} ${vertical?mid:track}) ${vertical?'rotate(-90)':''}"
      data-axis-group="${i}" tabindex="0" role="button" aria-label="Изменить ${common?'общий ':''}осевой размер ${text}" style="cursor:pointer">
      <rect x="-43" y="-12" width="86" height="24" rx="6" fill="#eef2f6"/>
      <text class="dimension-text" x="0" y="5" pointer-events="none">${text}</text></g></g>`;
  }).join("");
  canvasLayout.axisGroups = axisGroups;
  const viewTop=Math.min(0,y-46-Math.max(0,tracks[0].length-1)*29);
  const viewRight=Math.max(640,x+width+46+Math.max(0,tracks[1].length-1)*29);
  svg.setAttribute("viewBox",`0 ${viewTop} ${viewRight} ${500-viewTop}`);
  svg.innerHTML = `
    <defs>
      <filter id="windowShadow" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#122238" flood-opacity="0.2" />
      </filter>
      <linearGradient id="glassSheen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.75" />
        <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.1" />
        <stop offset="1" stop-color="#5da3bf" stop-opacity="0.24" />
      </linearGradient>
      <clipPath id="innerClip">${paths.inner}</clipPath>
      <clipPath id="glassOuterClip">${paths.outer}</clipPath>
      <marker id="dimArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
        <path d="M 8 1 L 1 4 L 8 7" fill="none" stroke="#8996a8" stroke-width="1.2" />
      </marker>
    </defs>
    <g filter="url(#windowShadow)" fill="${profileColor}" stroke="${material.edge}" stroke-width="2.2">${paths.outer}</g>
    <g fill="#bfe3ef" stroke="${material.edge}" stroke-width="1.6">${paths.inner}</g>
    <g clip-path="url(#innerClip)">${panesMarkup}${localImpostsMarkup}${rootImpostsMarkup}</g>
    <g clip-path="url(#glassOuterClip)" pointer-events="none">${sashMarkup}${glassAnnotations}</g>
    <g class="dimensions">${axisMarkup}
      <line class="dimension-line" x1="${x}" y1="${y + height + 6}" x2="${x}" y2="${bottomDimensionY + 7}" opacity=".45" />
      <line class="dimension-line" x1="${x + width}" y1="${y + height + 6}" x2="${x + width}" y2="${bottomDimensionY + 7}" opacity=".45" />
      <line class="dimension-line" x1="${x + 4}" y1="${bottomDimensionY}" x2="${x + width - 4}" y2="${bottomDimensionY}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)" />
      <g data-window-dimension="width" tabindex="0" role="button" aria-label="Изменить ширину или диаметр" style="cursor:pointer"><rect x="${x + width / 2 - 48}" y="${bottomDimensionY - 13}" width="96" height="24" rx="6" fill="#eef2f6" />
      <text class="dimension-text" x="${x + width / 2}" y="${bottomDimensionY + 5}">${state.shape === "circle" ? "Ø " : ""}${numberFormatter.format(state.width)} мм</text></g>
      <line class="dimension-line" x1="${x - 6}" y1="${y}" x2="${leftDimensionX - 7}" y2="${y}" opacity=".45" />
      <line class="dimension-line" x1="${x - 6}" y1="${y + height}" x2="${leftDimensionX - 7}" y2="${y + height}" opacity=".45" />
      <line class="dimension-line" x1="${leftDimensionX}" y1="${y + 4}" x2="${leftDimensionX}" y2="${y + height - 4}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)" />
      <g transform="translate(${leftDimensionX - 1} ${y + height / 2}) rotate(-90)" data-window-dimension="${state.shape === "circle" ? "width" : "height"}" tabindex="0" role="button" aria-label="Изменить высоту или диаметр" style="cursor:pointer">
        <rect x="-48" y="-13" width="96" height="24" rx="6" fill="#eef2f6" />
        <text class="dimension-text" x="0" y="5">${numberFormatter.format(state.height)} мм</text>
      </g>
    </g>`;

  $$("#windowCanvas .pane-hit").forEach((node) => {
    const choose = event => {
      const index = Number(node.dataset.pane);
      if ((event.ctrlKey || event.metaKey) && !state.selectedImpost) {
        if (!multiSections.size && state.selectedPane !== null) multiSections.add(state.selectedPane);
        if (multiSections.has(index)) multiSections.delete(index);
        else multiSections.add(index);
        state.selectedPane = multiSections.has(index) ? index : ([...multiSections].at(-1) ?? null);
      } else {
        multiSections.clear();
        state.selectedPane = index;
      }
      sharedAxis = null;
      state.selectedImpost = null;
      renderAll();
    };
    node.addEventListener("click", choose);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose(event);
      }
    });
  });

  $$("#windowCanvas .impost-hit").forEach((node) => {
    node.addEventListener("keydown", (event) => {
      const vertical = node.dataset.orientation === "vertical";
      const backward = vertical ? event.key === "ArrowLeft" : event.key === "ArrowUp";
      const forward = vertical ? event.key === "ArrowRight" : event.key === "ArrowDown";
      if (!backward && !forward && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectImpostFromNode(node);
      if (backward || forward) moveSelectedImpostBy((forward ? 1 : -1) * (event.shiftKey ? 50 : 10));
      renderAll();
    });
  });
}

function selectImpostFromNode(node) {
  multiSections.clear();
  sharedAxis = null;
  const scope = node.dataset.scope;
  const paneIndex = scope === "pane" ? Number(node.dataset.pane) : null;
  state.selectedImpost = {
    scope,
    orientation: node.dataset.orientation,
    id: node.dataset.id,
    ...(scope === "pane" ? { paneIndex } : {}),
  };
  if (scope === "pane") state.selectedPane = paneIndex;
}

function moveSelectedImpostBy(deltaMm) {
  const record = getSelectedImpostRecord();
  if (!record) return;
  if (record.selected.scope === "root") {
    const limits = rootImpostLimits(record.item, record.selected.orientation);
    record.item.position = clamp(Math.round((record.item.position + deltaMm) / 10) * 10, limits.min, limits.max);
    return;
  }
  const physical = getPanePhysicalRect(record.selected.paneIndex);
  const size = record.selected.orientation === "vertical" ? physical.width : physical.height;
  const limits = nestedImpostLimits(record.item, record.pane);
  const nextMm = record.item.position * size + deltaMm;
  record.item.position = Math.min(Math.max(nextMm / size, limits.min), limits.max);
}

function moveSelectedImpostToPoint(point) {
  const record = getSelectedImpostRecord();
  if (!record || !canvasLayout) return;
  const vertical = record.selected.orientation === "vertical";
  if (record.selected.scope === "root") {
    const visualStart = vertical ? canvasLayout.x : canvasLayout.y;
    const visualSize = vertical ? canvasLayout.width : canvasLayout.height;
    const physicalSize = vertical ? state.width : state.height;
    const coordinate = vertical ? point.x : point.y;
    const raw = ((coordinate - visualStart) / visualSize) * physicalSize;
    const limits = rootImpostLimits(record.item, record.selected.orientation);
    record.item.position = Math.min(Math.max(Math.round(raw / 10) * 10, limits.min), limits.max);
    return;
  }
  const paneRect = canvasLayout.paneRects[record.selected.paneIndex];
  if (!paneRect) return;
  const visualStart = vertical ? paneRect.x : paneRect.y;
  const visualSize = vertical ? paneRect.width : paneRect.height;
  const physicalSize = vertical ? paneRect.physicalWidth : paneRect.physicalHeight;
  const coordinate = vertical ? point.x : point.y;
  const rawMm = ((coordinate - visualStart) / visualSize) * physicalSize;
  const limits = nestedImpostLimits(record.item, record.pane);
  record.item.position = Math.min(Math.max(Math.round(rawMm / 10) * 10 / physicalSize, limits.min), limits.max);
}

function getCanvasPoint(event) {
  const svg = $("#windowCanvas");
  const matrix = svg.getScreenCTM();
  return matrix ? new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()) : {x:0,y:0};
}

function bindCanvasDragging() {
  const svg = $("#windowCanvas");
  const editDimension = event => {
    const target = event.target.closest?.("[data-axis-group], [data-window-dimension]");
    if (!target) return;
    event.preventDefault();
    let field = target.dataset.windowDimension;
    if (!field) {
      const group = canvasLayout.axisGroups[Number(target.dataset.axisGroup)];
      if (!group?.length) return;
      const first = group[0];
      selectImpostFromNode({dataset:{scope:first.index == null ? "root" : "pane", pane:first.index,
        orientation:first.item.orientation, id:first.id}});
      if (group.length > 1) sharedAxis = group;
      renderAll();
      field = "impostPosition";
    }
    const input = $(`#${field}`);
    input.focus();
    try { input.select(); } catch {}
  };
  svg.addEventListener("click", editDimension);
  svg.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") editDimension(event); });
  svg.addEventListener("click", event => {
    if (event.target !== svg || (state.selectedPane === null && !state.selectedImpost)) return;
    multiSections.clear();
    sharedAxis = null;
    state.selectedPane = null;
    state.selectedImpost = null;
    renderAll();
  });
  svg.addEventListener("pointerdown", (event) => {
    const node = event.target.closest?.(".impost-hit");
    if (!node) return;
    event.preventDefault();
    selectImpostFromNode(node);
    dragState = { pointerId: event.pointerId };
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {}
    document.body.style.cursor = node.dataset.orientation === "vertical" ? "col-resize" : "row-resize";
    renderAll();
  });
  svg.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    moveSelectedImpostToPoint(getCanvasPoint(event));
    renderAll();
  });
  const finishDrag = (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    document.body.style.cursor = "";
    try {
      svg.releasePointerCapture(event.pointerId);
    } catch {}
  };
  svg.addEventListener("pointerup", finishDrag);
  svg.addEventListener("pointercancel", finishDrag);
}

function largestGapPosition(items) {
  const positions = [0, ...items.map((item) => item.position).sort((a, b) => a - b), 1];
  let best = { gap: 0, position: 0.5 };
  for (let index = 0; index < positions.length - 1; index += 1) {
    const gap = positions[index + 1] - positions[index];
    if (gap > best.gap) best = { gap, position: positions[index] + gap / 2 };
  }
  return best.position;
}

function addInnerImpost(orientation) {
  const targets = selectedSections();
  if (!targets.length) return;
  const vertical = orientation === "vertical";
  const start = rect => vertical ? rect.x : rect.y;
  const size = rect => vertical ? rect.width : rect.height;
  const commonStart = Math.max(...targets.map(({rect}) => start(rect)));
  const commonEnd = Math.min(...targets.map(({rect}) => start(rect) + size(rect)));
  const axis = (commonStart + commonEnd) / 2;
  const changed = targets.map(({pane, rect}) => {
    const old = pane.innerImposts;
    const item = {id:createImpostId("pane", orientation), orientation,
      position:commonEnd > commonStart ? (axis - start(rect)) / size(rect) : 0.5};
    pane.split = item;
    pane.innerImposts = [item];
    pane.children = [
      {opening:pane.opening, hingeSide:pane.hingeSide, glass:pane.glass, innerImposts:[]},
      {opening:"fixed", glass:pane.glass, innerImposts:[]},
    ];
    return {pane, old};
  });
  const issue = validateCurrentProduct();
  if (issue) {
    changed.forEach(({pane,old}) => { delete pane.split; delete pane.children; pane.innerImposts = old; });
    showToast(issue);
    return;
  }
  const panes = sectionPanes();
  multiSections = new Set(changed.map(({pane}) => panes.indexOf(pane.children[0])));
  state.selectedPane = [...multiSections][0];
  state.selectedImpost = null;
  sharedAxis = null;
  renderAll();
  showToast(`Импостов добавлено: ${changed.length}`);
}

function renderInspector() {
  const pane = sectionPanes()[state.selectedPane];
  const record = getSelectedImpostRecord();
  if (state.selectedImpost && !record) state.selectedImpost = null;

  if (record) {
    $("#paneInspector").hidden = true;
    $("#impostInspector").hidden = false;
    const vertical = record.selected.orientation === "vertical";
    const isRoot = record.selected.scope === "root";
    const positionInput = $("#impostPosition");
    let position;
    let min;
    let max;
    if (isRoot) {
      const limits = rootImpostLimits(record.item, record.selected.orientation);
      position = record.item.position;
      min = limits.min;
      max = limits.max;
    } else {
      const physical = getPanePhysicalRect(record.selected.paneIndex);
      const size = vertical ? physical.width : physical.height;
      const limits = nestedImpostLimits(record.item, record.pane);
      position = record.item.position * size;
      min = limits.min * size;
      max = limits.max * size;
    }
    const nestedScope = record.pane?.opening === "fixed" ? "глухой секции" : "створке";
    $("#selectedImpostScope").textContent = isRoot ? "Импост рамы" : `Импост в ${nestedScope} № ${record.selected.paneIndex + 1}`;
    $("#selectedImpostName").textContent = vertical ? "Вертикальный" : "Горизонтальный";
    $("#impostPositionLabel").textContent = vertical
      ? `От левого края ${isRoot ? "рамы" : record.pane?.opening === "fixed" ? "глухой секции" : "створки"}, мм`
      : `От верхнего края ${isRoot ? "рамы" : record.pane?.opening === "fixed" ? "глухой секции" : "створки"}, мм`;
    if (sharedAxis) {
      const group = sharedImpostLimits(sharedAxis, record.selected.orientation);
      const first = group.members[0];
      if (first) {
        position = first.start + first.item.position * first.size;
        min = group.min;
        max = group.max;
      }
      $("#impostPositionLabel").textContent = `Общая ось от ${vertical ? "левого" : "верхнего"} края рамы, мм`;
    }
    positionInput.min = Math.ceil(min);
    positionInput.max = Math.floor(max);
    positionInput.value = Math.round(position);
    return;
  }

  if (!pane) { $("#paneInspector").hidden = true; $("#impostInspector").hidden = true; return; }
  $("#paneInspector").hidden = false;
  $("#impostInspector").hidden = true;
  $("#selectedPaneName").textContent = multiSections.size > 1
    ? `Выбрано секций: ${multiSections.size}` : `№ ${sectionNumber(state.selectedPane)}`;
  const openingSelect = $("#openingType");
  openingSelect.querySelector('[data-mixed-opening]')?.remove();
  const mixed = selectedSections().some(entry => entry.pane.opening !== pane.opening);
  if (mixed) {
    const option = new Option("Разные типы открывания", "");
    option.disabled = true;
    option.dataset.mixedOpening = "";
    openingSelect.prepend(option);
  }
  openingSelect.value = mixed ? "" : pane.opening;
  const canTurn = ["turn", "tiltturn"].includes(pane.opening);
  $("#hingeSideField").hidden = !canTurn;
  $("#hingeSideField").style.display = canTurn ? "" : "none";
  $("#hingeSide").value = pane.hingeSide === "right" ? "right" : "left";
  const glassSelect = $("#paneGlass");
  glassSelect.value = pane.glass;
  let glassSize = $("#paneGlassSize");
  if (!glassSize) {
    glassSize = document.createElement("small");
    glassSize.id = "paneGlassSize";
    glassSelect.after(glassSize);
  }
  const sizes = paneGlassGeometry(sectionLayout()[state.selectedPane]).fields.map(glassDimensionText);
  const distinct = [...new Set(sizes)];
  glassSize.textContent = `${state.shape === "rect" ? "Размер" : "Размер ориентировочно"}: ${distinct.join("; ")} мм`;

  const innerCount = pane.innerImposts.length;
  const paneKind = pane.opening === "fixed" ? "глухой секции" : "створке";
  $("#innerImpostHint").textContent = innerCount
    ? `В ${paneKind} установлено: ${innerCount}`
    : `Добавьте импост в ${paneKind}`;
}

function renderSummary(calculation) {
  const totalArea = calculation.area * state.quantity;
  $("#totalPrice").textContent = formatMoney(calculation.total);
  $("#unitPrice").textContent = `${formatMoney(calculation.unitPrice)} за одно окно`;
  $("#summaryArea").textContent = `${formatNumber(totalArea)} м²`;
  $("#summarySashes").textContent = `${calculation.sashCount * state.quantity}`;
  $("#summaryPanes").textContent = `${calculation.glassUnits * state.quantity}`;
  $("#summaryQuantity").textContent = `${state.quantity} шт.`;
  $("#summaryMaterial").textContent = calculation.material.label;
  $("#summaryProfile").textContent = calculation.profile.name;
  const tech = getTechnology();
  $("#summaryTechnology").textContent = `рама ${tech.frame} · створка ${tech.sash} · импост ${tech.impost} мм`;
  $("#summaryShape").textContent = SHAPES[state.shape];
  $("#summaryFinish").textContent = calculation.finish.name;
  $("#specTotal").textContent = formatMoney(calculation.total);
  $("#editorDimensions").textContent = `${numberFormatter.format(state.width)} × ${numberFormatter.format(state.height)} мм`;
  $("#editorArea").textContent = `${formatNumber(calculation.area)} м²`;

  const preliminary = isPreliminaryShape();
  $("#currentEstimateStatus").textContent = preliminary ? "Предварительный расчёт" : "Демонстрационный расчёт";
  $("#currentEstimateHint").textContent = preliminary
    ? "Арочные и круглые изделия требуют проверки технологии и окончательной цены."
    : "Замените тарифы на ваши в разделе «Прайс».";

  const savedItem = editingOrderItemId ? orderItems.find((item) => item.id === editingOrderItemId) : null;
  const currentRoundedTotal = Math.round(calculation.unitPrice) * state.quantity;
  const priceChanged = savedItem && savedItem.total !== currentRoundedTotal;
  $("#savedPriceComparison").hidden = !priceChanged;
  if (priceChanged) {
    $("#savedItemPrice").textContent = formatMoney(savedItem.total);
    $("#currentItemPrice").textContent = formatMoney(currentRoundedTotal);
  }
}

function renderSpecification(calculation) {
  $("#specificationRows").innerHTML = calculation.lines
    .map(
      (line, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><span class="spec-name"><b>${line.name}</b><small>${line.note}</small></span></td>
          <td class="spec-characteristic">${line.characteristic}</td>
          <td>${line.unit === "шт." || line.unit === "компл." ? Math.round(line.qty) : formatNumber(line.qty)}</td>
          <td>${line.unit}</td>
          <td>${formatMoney(line.rate)}</td>
          <td><b>${formatMoney(line.total)}</b></td>
        </tr>`,
    )
    .join("");
}

function updateShapeControls() {
  $$("#shapeOptions button").forEach((button) => {
    const active = button.dataset.value === state.shape;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const isCircle = state.shape === "circle";
  $("#widthLabel").textContent = isCircle ? "Диаметр, мм" : "Ширина, мм";
  $("#height").disabled = isCircle;
  $("#heightField").style.opacity = isCircle ? "0.48" : "1";
}

function updateActiveControls() {
  $$(".material-card").forEach((card) => {
    card.classList.toggle("active", card.querySelector("input").value === state.material);
  });
  $$("#splitPresets button").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.cols) === state.cols && Number(button.dataset.rows) === state.rows);
  });
  updateShapeControls();
}

function renderAll() {
  ensurePanes();
  syncGlassChoices();
  const calculation = buildSpecification();
  renderCanvas();
  renderInspector();
  renderSummary(calculation);
  renderSpecification(calculation);
  updateActiveControls();
  renderProjectToolbar();
}

function setSplit(cols, rows) {
  multiSections.clear();
  sharedAxis = null;
  const nextCols = clamp(cols, 1, 4);
  const nextRows = clamp(rows, 1, 3);
  if (nextCols === state.cols && nextRows === state.rows) return;
  const hasSectionSettings = sectionPanes().some(
    (pane) => pane.opening !== "fixed" || pane.glass !== state.defaultGlass || pane.innerImposts.length > 0,
  );
  if (hasSectionSettings && !window.confirm("Изменение сетки сбросит створки, стеклопакеты и вложенные импосты секций. Продолжить?")) {
    $("#columns").value = state.cols;
    $("#rows").value = state.rows;
    updateActiveControls();
    return;
  }
  state.vImposts = makeEvenImposts(nextCols - 1, state.width, "vertical");
  state.hImposts = makeEvenImposts(nextRows - 1, state.height, "horizontal");
  state.cols = nextCols;
  state.rows = nextRows;
  state.selectedImpost = null;
  $("#columns").value = state.cols;
  $("#rows").value = state.rows;
  ensurePanes();
  renderAll();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function bindEvents() {
  $$('input[name="material"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.material = input.value;
      updateMaterialSelects(true);
      renderAll();
    });
  });

  $("#profileSystem").addEventListener("change", (event) => {
    state.profile = event.target.value;
    renderAll();
  });
  $("#finish").addEventListener("change", (event) => {
    state.finish = event.target.value;
    renderAll();
  });

  $$("#shapeOptions button").forEach((button) => {
    button.addEventListener("click", () => {
      state.shape = button.dataset.value;
      if (state.shape === "circle") {
        state.height = state.width;
        $("#height").value = state.height;
      }
      renderAll();
    });
  });

  $("#width").addEventListener("keydown", event => { if(event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } });
  $("#width").addEventListener("change", (event) => {
    if (event.target.value === "") { event.target.value = state.width; return; }
    state.width = clamp(event.target.value, 400, 5000);
    if (state.shape === "circle") {
      state.height = state.width;
      $("#height").value = state.height;
    }
    renderAll();
  });
  $("#width").addEventListener("change", (event) => (event.target.value = state.width));

  $("#height").addEventListener("keydown", event => { if(event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } });
  $("#height").addEventListener("change", (event) => {
    if (event.target.value === "") { event.target.value = state.height; return; }
    state.height = clamp(event.target.value, 400, 4000);
    renderAll();
  });
  $("#height").addEventListener("change", (event) => (event.target.value = state.height));

  $("#quantity").addEventListener("input", (event) => {
    state.quantity = clamp(event.target.value, 1, 99);
    renderAll();
  });
  $("#quantity").addEventListener("change", (event) => (event.target.value = state.quantity));
  $$(".stepper button").forEach((button) => {
    button.addEventListener("click", () => {
      state.quantity = clamp(state.quantity + Number(button.dataset.step), 1, 99);
      $("#quantity").value = state.quantity;
      renderAll();
    });
  });

  $$("#splitPresets button").forEach((button) => {
    button.addEventListener("click", () => setSplit(button.dataset.cols, button.dataset.rows));
  });
  $("#columns").addEventListener("change", (event) => setSplit(event.target.value, state.rows));
  $("#rows").addEventListener("change", (event) => setSplit(state.cols, event.target.value));

  $("#defaultGlass").addEventListener("change", (event) => {
    state.defaultGlass = event.target.value;
    sectionPanes().forEach(pane => { pane.glass = state.defaultGlass; });
    renderAll();
  });

  $("#openingType").addEventListener("change", (event) => {
    const targets = selectedSections();
    const old = targets.map(({pane}) => pane.opening);
    targets.forEach(({pane}) => { pane.opening = event.target.value; });
    const issue = validateCurrentProduct();
    if (issue) {
      targets.forEach(({pane}, i) => { pane.opening = old[i]; });
      renderAll();
      showToast(issue);
      return;
    }
    renderAll();
  });
  $("#hingeSide").addEventListener("change", event => {
    const pane = sectionPanes()[state.selectedPane];
    if (!pane || pane.split) return;
    pane.hingeSide = event.target.value === "right" ? "right" : "left";
    renderAll();
  });
  $("#paneGlass").addEventListener("change", (event) => {
    sectionPanes()[state.selectedPane].glass = event.target.value;
    renderAll();
  });
  $("#applyGlassToAll").addEventListener("click", () => {
    const glass = sectionPanes()[state.selectedPane].glass;
    state.defaultGlass = glass;
    sectionPanes().forEach(pane => { pane.glass = glass; });
    $("#defaultGlass").value = glass;
    renderAll();
    showToast("Стеклопакет применён ко всем секциям");
  });

  $("#addInnerVertical").addEventListener("click", () => addInnerImpost("vertical"));
  $("#addInnerHorizontal").addEventListener("click", () => addInnerImpost("horizontal"));
  $("#impostPosition").addEventListener("change", (event) => {
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (event.target.value === "") { renderAll(); return; }
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    if (sharedAxis) {
      const group = sharedImpostLimits(sharedAxis, record.selected.orientation);
      if (!group.members.length || group.min > group.max) { renderAll(); return; }
      const position = clamp(value, group.min, group.max);
      const old = group.members.map(m => m.item.position);
      group.members.forEach(m => { m.item.position = (position - m.start) / m.size; });
      const issue = validateCurrentProduct();
      if (issue) {
        group.members.forEach((m,i) => { m.item.position = old[i]; });
        showToast(issue);
      }
      renderAll();
      return;
    }
    if (record.selected.scope === "root") {
      const limits = rootImpostLimits(record.item, record.selected.orientation);
      record.item.position = Math.min(Math.max(value, limits.min), limits.max);
    } else {
      const physical = getPanePhysicalRect(record.selected.paneIndex);
      const size = record.selected.orientation === "vertical" ? physical.width : physical.height;
      const limits = nestedImpostLimits(record.item, record.pane);
      record.item.position = Math.min(Math.max(value / size, limits.min), limits.max);
    }
    renderAll();
  });
  $("#impostPosition").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  });
  $("#centerImpost").addEventListener("click", () => {
    sharedAxis = null;
    multiSections.clear();
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (record.selected.scope === "root") {
      const collection = record.collection;
      const index = collection.findIndex((item) => item.id === record.item.id);
      const size = record.selected.orientation === "vertical" ? state.width : state.height;
      const left = index <= 0 ? 0 : collection[index - 1].position;
      const right = index >= collection.length - 1 ? size : collection[index + 1].position;
      record.item.position = Math.round((left + right) / 20) * 10;
    } else {
      const siblings = record.pane.innerImposts.filter((item) => item.orientation === record.selected.orientation).sort((a, b) => a.position - b.position);
      const index = siblings.findIndex((item) => item.id === record.item.id);
      const left = index <= 0 ? 0 : siblings[index - 1].position;
      const right = index >= siblings.length - 1 ? 1 : siblings[index + 1].position;
      record.item.position = (left + right) / 2;
    }
    renderAll();
  });
  $("#removeImpost").addEventListener("click", () => {
    sharedAxis = null;
    multiSections.clear();
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (record.selected.scope === "root") {
      const collection = record.selected.orientation === "vertical" ? state.vImposts : state.hImposts;
      const index = collection.findIndex((item) => item.id === record.item.id);
      collection.splice(index, 1);
    } else if (record.pane.split) {
      if (record.pane.children.some(child => child.split) && !window.confirm("Удалить импост и все секции внутри этого деления?")) return;
      const first = record.pane.children[0];
      record.pane.opening = first.opening;
      record.pane.hingeSide = first.hingeSide;
      record.pane.glass = first.glass;
      delete record.pane.split;
      delete record.pane.children;
      record.pane.innerImposts = [];
      state.selectedPane = record.selected.paneIndex;
    } else {
      const index = record.pane.innerImposts.findIndex((item) => item.id === record.item.id);
      record.pane.innerImposts.splice(index, 1);
    }
    state.selectedImpost = null;
    ensurePanes();
    syncFormFromState();
    renderAll();
    showToast("Импост удалён");
  });

  $("#scrollToSpec").addEventListener("click", () => $("#specification").scrollIntoView({ behavior: "smooth", block: "start" }));
  $("#printEstimate").addEventListener("click", () => {
    renderPrintOrder();
    window.print();
  });
  $("#saveOrderItem").addEventListener("click", saveCurrentOrderItem);
  $("#orderItems").addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-action]");
    const item = event.target.closest("[data-order-item-id]");
    if (!button || !item) return;
    if (button.dataset.orderAction === "edit") editOrderItem(item.dataset.orderItemId);
    if (button.dataset.orderAction === "delete") deleteOrderItem(item.dataset.orderItemId);
  });
  $("#newProject").addEventListener("click", startNewProject);
  $("#saveProject").addEventListener("click", requestProjectSave);
  $("#myProjects").addEventListener("click", () => {
    renderProjectsList();
    $("#projectsDialog").showModal();
  });
  $("#projectNameForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#projectNameInput").value.trim();
    if (!name) {
      $("#projectNameError").textContent = "Введите название проекта";
      $("#projectNameError").hidden = false;
      return;
    }
    if (saveProjectRecord(name)) $("#projectNameDialog").close();
  });
  ["#cancelProjectName", "#closeProjectNameDialog"].forEach((selector) => {
    $(selector).addEventListener("click", () => $("#projectNameDialog").close());
  });
  $("#closeProjectsDialog").addEventListener("click", () => $("#projectsDialog").close());
  $("#projectsList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-project-action]");
    const card = event.target.closest("[data-project-id]");
    if (!button || !card) return;
    if (button.dataset.projectAction === "open") openProject(card.dataset.projectId);
    if (button.dataset.projectAction === "delete") deleteProject(card.dataset.projectId);
  });
  ["#projectNameDialog", "#projectsDialog"].forEach((selector) => {
    $(selector).addEventListener("click", (event) => {
      if (event.target === $(selector)) $(selector).close();
    });
  });

  $("#newCalculation").addEventListener("click", () => {
    const message = editingOrderItemId
      ? "Отменить редактирование позиции? Несохранённые изменения текущего изделия будут потеряны."
      : "Начать настройку нового изделия? Текущая конфигурация будет сброшена, список заказа сохранится.";
    if (!window.confirm(message)) return;
    resetCurrentProduct();
    showToast("Создан новый расчёт");
  });

  $("#openPrices").addEventListener("click", () => {
    populatePriceForm();
    populateTechnologyForm();
    setSettingsTab("prices");
    $("#pricesDialog").showModal();
  });
  $("#pricesDialog").addEventListener("click", (event) => {
    if (event.target === $("#pricesDialog")) $("#pricesDialog").close();
  });
  $("#savePrices").addEventListener("click", () => {
    readPriceForm();
    if (!persistRates()) {
      showToast("Не удалось сохранить прайс в браузере");
      return;
    }
    $("#pricesDialog").close();
    renderAll();
    showToast("Новые тарифы сохранены и применены");
  });
  $("#resetPrices").addEventListener("click", () => {
    rates = cloneRates();
    try {
      localStorage.removeItem(RATES_STORAGE_KEY);
    } catch {
      showToast("Не удалось очистить сохранённый прайс");
      return;
    }
    populatePriceForm();
    renderAll();
    showToast("Демонстрационные тарифы восстановлены");
  });
  $$("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
  });
  $$("[data-catalog-material]").forEach((button) => {
    button.addEventListener("click", () => {
      readCatalogDraftFromEditor();
      captureGlassDraft();
      catalogMaterial = button.dataset.catalogMaterial;
      renderTechnologyCatalog();
      renderGlassCatalog();
    });
  });
  $("#technologyCatalogEditor").addEventListener("click", handleCatalogAction);
  $("#technologyCatalogEditor").addEventListener("input", event => {
    const input = event.target.closest('[data-profile-field="name"]');
    if (!input) return;
    const id = input.closest("[data-profile-id]").dataset.profileId;
    $$("#glassCatalogEditor [data-glass-profile]").forEach(box => {
      if (box.value === id) box.nextElementSibling.textContent = input.value.trim();
    });
  });
  $("#addGlassCatalog").addEventListener("click", () => {
    captureGlassDraft();
    const id = `glass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    glassDraft[catalogMaterial][id] = { name: "", detail: "", rate: null, color: "#bfe3ef" };
    renderGlassCatalog();
    $("#glassCatalogEditor [data-glass-id]:last-child [data-glass-name]").focus();
  });
  $("#glassCatalogEditor").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-glass]");
    if (!button) return;
    const catalog = glassDraft[catalogMaterial];
    if (Object.keys(catalog).length <= 1) return showToast("Оставьте хотя бы один стеклопакет для материала");
    captureGlassDraft();
    delete catalog[button.closest("[data-glass-id]").dataset.glassId];
    renderGlassCatalog();
  });
  $("#saveTechnology").addEventListener("click", () => {
    captureGlassDraft();
    readCatalogDraftFromEditor();
    for (const [material, catalog] of Object.entries(glassDraft)) {
      const profiles = catalogDraft[material].profiles;
      for (const item of Object.values(catalog)) {
        if (Array.isArray(item.profileIds)) {
          item.profileIds = item.profileIds.filter(id => profiles.some(profile => profile.id === id));
          if (!item.profileIds.length) return showToast(`${MATERIALS[material].label}: выберите систему для «${item.name || "Новый стеклопакет"}»`);
        }
      }
      const uncovered = profiles.find(profile => !Object.values(catalog).some(item => fitsGlassProfile(item, profile.id)));
      if (uncovered) return showToast(`Добавьте хотя бы один стеклопакет для системы «${uncovered.name}»`);
      for (const [id, item] of Object.entries(catalog)) {
        if (!item.name || (item.rate == null ? !Object.hasOwn(GLASS, id) : !Number.isFinite(item.rate) || item.rate < 0)) {
          return showToast(`${MATERIALS[material].label}: укажите название и неотрицательную цену стеклопакета`);
        }
      }
    }
    try { localStorage.setItem(glassCatalogKey, JSON.stringify(glassDraft)); }
    catch { return showToast("Не удалось сохранить каталог стеклопакетов"); }
    glassCatalog = structuredClone(glassDraft);
    readTechnologyForm();
    $("#pricesDialog").close();
    renderAll();
    showToast("Каталог профильных систем сохранён");
  });
  $("#resetTechnology").addEventListener("click", () => {
    catalogDraft = cloneMaterials();
    glassDraft = standardGlassCatalog();
    catalogMaterial = state.material;
    renderTechnologyCatalog();
    renderGlassCatalog();
    showToast("Стандартный каталог подготовлен — нажмите «Сохранить каталог»");
  });

  bindCanvasDragging();
  window.addEventListener("beforeprint", renderPrintOrder);
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-order"));
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedProjectWork()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function syncFormFromState() {
  $$('input[name="material"]').forEach((input) => (input.checked = input.value === state.material));
  updateMaterialSelects();
  $("#width").value = state.width;
  $("#height").value = state.height;
  $("#quantity").value = state.quantity;
  $("#columns").value = state.cols;
  $("#rows").value = state.rows;
  $("#defaultGlass").value = state.defaultGlass;
}

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
  markup: ["markup"],
};

function getRate(path) {
  return path.reduce((value, key) => value[key], rates);
}

function setRate(path, value) {
  if (path.length === 1) rates[path[0]] = value;
  else rates[path[0]][path[1]] = value;
}

function populatePriceForm() {
  Object.entries(PRICE_BINDINGS).forEach(([name, path]) => {
    $("#pricesForm").elements[name].value = getRate(path);
  });
}

function readPriceForm() {
  Object.entries(PRICE_BINDINGS).forEach(([name, path]) => {
    const input = $("#pricesForm").elements[name];
    setRate(path, Math.max(0, Number(input.value) || 0));
  });
}

function setSettingsTab(tab) {
  const technologyTab = tab === "technology";
  $("#settingsPricesPane").hidden = technologyTab;
  $("#settingsTechnologyPane").hidden = !technologyTab;
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
  const profileRows = material.profiles
    .map(
      (profile) => `
        <article class="catalog-profile-card" data-profile-id="${escapeHtml(profile.id)}">
          <label class="catalog-field catalog-name-field">
            <span>Название системы</span>
            <input data-profile-field="name" value="${escapeHtml(profile.name)}" maxlength="80" required />
          </label>
          <label class="catalog-field">
            <span>Рама, мм</span>
            <input type="number" data-profile-field="frameWidth" value="${clamp(profile.frameWidth, 20, 250)}" min="20" max="250" />
          </label>
          <label class="catalog-field">
            <span>Створка, мм</span>
            <input type="number" data-profile-field="sashWidth" value="${clamp(profile.sashWidth, 20, 250)}" min="20" max="250" />
          </label>
          <label class="catalog-field">
            <span>Импост, мм</span>
            <input type="number" data-profile-field="impostWidth" value="${clamp(profile.impostWidth, 20, 250)}" min="20" max="250" />
          </label>
          <label class="catalog-field">
            <span>Заход стеклопакета, мм на сторону</span>
            <input type="number" data-profile-field="glassBite" value="${clamp(profile.glassBite ?? DEFAULT_GLASS_BITE_MM, 0, 100)}" min="0" max="100" step="any" />
          </label>
          <label class="catalog-field">
            <span>Коэффициент цены</span>
            <input type="number" data-profile-field="factor" value="${Number(profile.factor) || 1}" min="0.1" max="5" step="0.01" />
          </label>
          <label class="catalog-field">
            <span>Контуры уплотнения</span>
            <input type="number" data-profile-field="seals" value="${clamp(profile.seals, 1, 5)}" min="1" max="5" />
          </label>
          <button class="catalog-remove-button" type="button" data-catalog-action="remove-profile" aria-label="Удалить профильную систему">Удалить</button>
        </article>`,
    )
    .join("");

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
  updateCatalogMaterialTabs();
}

function readCatalogDraftFromEditor() {
  if (!catalogDraft) return;
  const material = catalogDraft[catalogMaterial];
  $$("#technologyCatalogEditor [data-profile-id]").forEach((row) => {
    const profile = material.profiles.find((item) => item.id === row.dataset.profileId);
    if (!profile) return;
    profile.name = row.querySelector('[data-profile-field="name"]').value.trim() || "Новая профильная система";
    profile.glassBite = clamp(row.querySelector('[data-profile-field="glassBite"]').value || DEFAULT_GLASS_BITE_MM, 0, 100);
    profile.frameWidth = clamp(row.querySelector('[data-profile-field="frameWidth"]').value, 20, 250);
    profile.sashWidth = clamp(row.querySelector('[data-profile-field="sashWidth"]').value, 20, 250);
    profile.impostWidth = clamp(row.querySelector('[data-profile-field="impostWidth"]').value, 20, 250);
    profile.factor = clamp(row.querySelector('[data-profile-field="factor"]').value, 0.1, 5);
    profile.seals = Math.round(clamp(row.querySelector('[data-profile-field="seals"]').value, 1, 5));
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
      glassBite: DEFAULT_GLASS_BITE_MM,
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
}

function exposeAgentTools() {
  const context = typeof document === "undefined" ? undefined : document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();

  const validateConfiguration = (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Ожидается объект с параметрами окна");
    const allowed = new Set(["material", "shape", "width", "height", "columns", "rows", "quantity"]);
    Object.keys(input).forEach((key) => {
      if (!allowed.has(key)) throw new Error(`Неизвестный параметр: ${key}`);
    });
    if (input.material !== undefined && !MATERIALS[input.material]) throw new Error("Неизвестный материал");
    if (input.shape !== undefined && !SHAPES[input.shape]) throw new Error("Неизвестная форма");
    const ranges = { width: [400, 5000], height: [400, 4000], columns: [1, 4], rows: [1, 3], quantity: [1, 99] };
    Object.entries(ranges).forEach(([key, [min, max]]) => {
      if (input[key] === undefined) return;
      if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] < min || input[key] > max) {
        throw new Error(`Параметр ${key} должен быть числом от ${min} до ${max}`);
      }
      if (["columns", "rows", "quantity"].includes(key) && !Number.isInteger(input[key])) throw new Error(`Параметр ${key} должен быть целым числом`);
    });
    return input;
  };

  const reportRegistrationError = () => console.info("Agent tools are unavailable in this browser context.");
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "configure_window",
          title: "Настроить окно",
          description: "Изменяет материал, форму, размеры и разбивку текущего рассчитываемого окна",
          inputSchema: {
            type: "object",
            properties: {
              material: { type: "string", enum: ["pvc", "aluminum", "wood"] },
              shape: { type: "string", enum: ["rect", "arch", "circle"] },
              width: { type: "number", minimum: 400, maximum: 5000 },
              height: { type: "number", minimum: 400, maximum: 4000 },
              columns: { type: "integer", minimum: 1, maximum: 4 },
              rows: { type: "integer", minimum: 1, maximum: 3 },
              quantity: { type: "integer", minimum: 1, maximum: 99 },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (rawInput) => {
            const input = validateConfiguration(rawInput);
            if (input.material) {
              state.material = input.material;
              updateMaterialSelects(true);
            }
            if (input.shape) state.shape = input.shape;
            if (input.width) state.width = input.width;
            if (input.height) state.height = input.height;
            if (state.shape === "circle") state.height = state.width;
            if (input.columns) state.vImposts = makeEvenImposts(input.columns - 1, state.width, "vertical");
            if (input.rows) state.hImposts = makeEvenImposts(input.rows - 1, state.height, "horizontal");
            if (input.quantity) state.quantity = input.quantity;
            state.selectedImpost = null;
            ensurePanes();
            syncFormFromState();
            renderAll();
            const calculation = buildSpecification();
            return { total: Math.round(calculation.total), area: Number(calculation.area.toFixed(2)), glassFields: calculation.glassUnits };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(reportRegistrationError);

    void Promise.resolve(
      context.registerTool(
        {
          name: "get_window_estimate",
          title: "Получить смету окна",
          description: "Возвращает текущую стоимость и подробную спецификацию окна без изменения расчёта",
          inputSchema: { type: "object", properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: async (input) => {
            if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new Error("Инструмент не принимает параметры");
            const calculation = buildSpecification();
            return {
              total: Math.round(calculation.total),
              unitPrice: Math.round(calculation.unitPrice),
              quantity: state.quantity,
              specification: calculation.lines.map((line) => ({
                name: line.name,
                characteristic: line.characteristic,
                quantity: Number(line.qty.toFixed(2)),
                unit: line.unit,
                amount: Math.round(line.total),
              })),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(reportRegistrationError);
  } catch (error) {
    reportRegistrationError();
  }
}

updateMaterialSelects();
syncFormFromState();
markCurrentStateBaseline();
bindEvents();
renderAll();
renderOrder();
renderProjectsList();
exposeAgentTools();
