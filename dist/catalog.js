// Справочники: профили, стеклопакеты, цены, технология и чтение localStorage.
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

const PRODUCT_TYPES = { window: "Окно", entranceDoor: "Входная дверь", balconyDoor: "Балконная дверь" };
function profileTypeSettings(profile, type = state.productType || "window") {
  const legacy = {
    frameWidth: profile.frameWidth, sashWidth: profile.sashWidth, impostWidth: profile.impostWidth,
    glassBiteFrame: profile.glassBiteFrame ?? profile.glassBite ?? 14,
    glassBiteSash: profile.glassBiteSash ?? profile.glassBite ?? 14,
    glassBiteImpost: profile.glassBiteImpost ?? profile.glassBite ?? 14,
    factor: profile.factor, seals: profile.seals,
    allowCircleShape: true, allowCircleSashes: profile.allowCircleSashes === true,
    allowTiltturn: true, allowTurn: true, allowTilt: true,
  };
  return { ...legacy, ...(profile.types?.[type] || {}), enabled: profile.types?.[type]?.enabled ?? type === "window" };
}
function availableProfiles(material = state.material, type = state.productType || "window") {
  return MATERIALS[material].profiles.filter(profile => profileTypeSettings(profile, type).enabled);
}

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
  skew: "Косая",
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
  skewSurcharge: 0,
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

async function changeStoredProjects(change) {
  if (!navigator.locks?.request) {
    showToast("Для безопасного сохранения откройте приложение через HTTPS или localhost в браузере с поддержкой Web Locks");
    return false;
  }
  if (projectWritePending) return false;
  projectWritePending = true;
  try {
    return await navigator.locks.request(PROJECTS_STORAGE_KEY, () => {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      const latest = JSON.parse(raw ?? "[]");
      if (!Array.isArray(latest)) throw new Error("Неверный формат заказов");
      const next = change(latest);
      if (!next) return false;
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
      return true;
    });
  } catch {
    showToast("Не удалось записать заказы в браузере. Изменения остались в редакторе.");
    return false;
  } finally {
    projectWritePending = false;
    projects = readStoredProjects();
    renderProjectsList();
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
