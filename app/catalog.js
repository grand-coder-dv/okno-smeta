// Справочники: профили, стеклопакеты, цены, технология, фурнитура и чтение localStorage.
import { renderAll, showToast } from "./editor-ui.js";
import { sectionPanes } from "./geometry.js";
import { renderProjectsList } from "./order.js";
import { $, escapeHtml, projectWritePending, projects, setProjectWritePending, setProjects, state } from "./product.js";
import { reloadReportSettings } from "./reports.js";
import { PART_NAMES } from "./profile-parts.js";
export const DEFAULT_MATERIALS = {
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

export const cloneMaterials = (source = DEFAULT_MATERIALS) => JSON.parse(JSON.stringify(source));

export const RATES_STORAGE_KEY = "oknoSmetaRates";
export const PROJECTS_STORAGE_KEY = "oknoSmetaProjectsV1";
export const APP_DATABASE_KEY = "oknoSmetaAppDatabase";
export const PROFILE_STORAGE_KEY = "oknoSmetaProfileCatalog";
const TECHNOLOGY_STORAGE_KEY = "oknoSmetaTechnology";
const REPORTS_STORAGE_KEY = "okno-smeta-report-templates-v1";
const TECHNICAL_STORAGE_KEYS = [
  PROFILE_STORAGE_KEY,
  RATES_STORAGE_KEY,
  TECHNOLOGY_STORAGE_KEY,
  "oknoSmetaGlassCatalog",
  "oknoSmetaHardware",
  REPORTS_STORAGE_KEY,
];

export function readRawAppDatabase() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_DATABASE_KEY) || "null");
    if (parsed?.version === 1 && parsed.technical && typeof parsed.technical === "object" && Array.isArray(parsed.projects)) return parsed;
  } catch {}
  return null;
}

function migrateLegacyDatabase() {
  const technical = {};
  TECHNICAL_STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw == null) return;
    try { technical[key] = JSON.parse(raw); } catch {}
  });
  let projects = [];
  try {
    const stored = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
    if (Array.isArray(stored)) projects = stored;
  } catch {}
  return { version: 1, technical, projects };
}

export let appDatabase = readRawAppDatabase() || migrateLegacyDatabase();
try { localStorage.setItem(APP_DATABASE_KEY, JSON.stringify(appDatabase)); } catch {}

const SUPABASE_URL = "https://chydhzufoqlqfpjwlkkg.supabase.co";
const SUPABASE_KEY = "sb_publishable_sKWBvN0N1L4FiB2AC7_fdQ_VWZ9dmRQ";
let cloudReady = false;
let cloudPushTimer = 0;

function databaseHasUserData(database) {
  return Boolean(database && (database.projects?.length || Object.keys(database.technical || {}).length));
}

function saveAppDatabase() {
  appDatabase.updatedAt = new Date().toISOString();
  localStorage.setItem(APP_DATABASE_KEY, JSON.stringify(appDatabase));
  if (cloudReady) scheduleCloudPush();
}

function scheduleCloudPush() {
  clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => { void pushAppDatabaseToCloud(); }, 400);
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function pushAppDatabaseToCloud() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_database?on_conflict=id`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, payload: appDatabase, updated_at: appDatabase.updatedAt }),
  });
  if (!response.ok) throw new Error(await response.text());
}

function applyCloudDatabase(payload) {
  if (payload?.version !== 1 || !payload.technical || !Array.isArray(payload.projects)) return;
  appDatabase = payload;
  localStorage.setItem(APP_DATABASE_KEY, JSON.stringify(appDatabase));
  if (typeof reloadProgramStateFromDatabase === "function") reloadProgramStateFromDatabase();
}

export async function syncAppDatabaseFromCloud() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/app_database?id=eq.1&select=payload,updated_at`, { headers: supabaseHeaders() });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    const remote = rows[0];
    const remoteTime = Date.parse(remote?.updated_at || remote?.payload?.updatedAt || 0);
    const localTime = Date.parse(appDatabase.updatedAt || 0);
    if (remote?.payload && remoteTime >= localTime) applyCloudDatabase(remote.payload);
    else if (databaseHasUserData(appDatabase)) await pushAppDatabaseToCloud();
    cloudReady = true;
  } catch (error) {
    console.warn(error);
    if (typeof showToast === "function") showToast("Общая база Supabase недоступна. Проверьте таблицу app_database.");
  }
}

export function programStorageGet(key) {
  if (key === PROJECTS_STORAGE_KEY) return JSON.stringify(appDatabase.projects);
  const value = appDatabase.technical[key];
  return value === undefined ? null : JSON.stringify(value);
}

export function programStorageSet(key, json) {
  const parsed = JSON.parse(json);
  if (key === PROJECTS_STORAGE_KEY) appDatabase.projects = parsed;
  else appDatabase.technical[key] = parsed;
  saveAppDatabase();
}

export function programStorageRemove(key) {
  if (key === PROJECTS_STORAGE_KEY) appDatabase.projects = [];
  else delete appDatabase.technical[key];
  saveAppDatabase();
}

function readStoredMaterials() {
  try {
    const stored = JSON.parse(programStorageGet(PROFILE_STORAGE_KEY) || "null");
    const next = cloneMaterials();
    Object.keys(next).forEach((materialKey) => {
      const storedMaterial = stored?.[materialKey];
      if (!storedMaterial) return;
      if (storedMaterial.catalogPricing) next[materialKey].catalogPricing = true;
      if (Array.isArray(storedMaterial.parts)) next[materialKey].parts = storedMaterial.parts;
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
    return migrateMaterialPrices(next, rates);
  } catch {
    return migrateMaterialPrices(cloneMaterials(), rates);
  }
}

export const PRODUCT_TYPES = { window: "Окно", entranceDoor: "Входная дверь", balconyDoor: "Балконная дверь" };
export function profileTypeSettings(profile, type = state.productType || "window") {
  const legacy = {
    frameWidth: profile.frameWidth, sashWidth: profile.sashWidth, impostWidth: profile.impostWidth,
    shtulpWidth: profile.shtulpWidth ?? profile.sashWidth ?? 70,
    extenderWidth: profile.extenderWidth ?? 40,
    connectorWidth: profile.connectorWidth ?? 20,
    cornerWidth: profile.cornerWidth ?? profile.frameWidth ?? 70,
    glassBiteFrame: profile.glassBiteFrame ?? profile.glassBite ?? 14,
    glassBiteSash: profile.glassBiteSash ?? profile.glassBite ?? 14,
    glassBiteImpost: profile.glassBiteImpost ?? profile.glassBite ?? 14,
    factor: profile.factor, seals: profile.seals,
    allowCircleShape: true, allowCircleSashes: profile.allowCircleSashes === true,
    allowTiltturn: true, allowTurn: true, allowTilt: true,
  };
  return { ...legacy, ...(profile.types?.[type] || {}), enabled: profile.types?.[type]?.enabled ?? type === "window" };
}
export function availableProfiles(material = state.material, type = state.productType || "window") {
  return MATERIALS[material].profiles.filter(profile => profileTypeSettings(profile, type).enabled);
}

export const GLASS = {
  single: { name: "Однокамерный", detail: "24 мм", color: "#cce9f3" },
  double: { name: "Двухкамерный", detail: "40 мм", color: "#bfe3ef" },
  energy: { name: "Энергосберегающий", detail: "40 мм · i-стекло", color: "#c7eadf" },
  acoustic: { name: "Шумоизоляционный", detail: "44 мм · триплекс", color: "#cbdcf1" },
};

export const OPENINGS = {
  fixed: { name: "Глухая", short: "Г" },
  turn: { name: "Поворотная", short: "П" },
  tiltturn: { name: "Поворотно-откидная", short: "ПО" },
  tilt: { name: "Откидная", short: "О" },
};

export const SHAPES = {
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

export const cloneRates = () => JSON.parse(JSON.stringify(DEFAULT_RATES));
const cloneTechnology = () => JSON.parse(JSON.stringify(DEFAULT_TECHNOLOGY));
export const cloneData = (value) => JSON.parse(JSON.stringify(value));

function readStoredRates() {
  const next = cloneRates();
  try {
    const stored = JSON.parse(programStorageGet(RATES_STORAGE_KEY) || "null");
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

export function persistRates() {
  try {
    programStorageSet(RATES_STORAGE_KEY, JSON.stringify(rates));
    return true;
  } catch {
    return false;
  }
}

export function readStoredProjects() {
  try {
    const stored = JSON.parse(programStorageGet(PROJECTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (project) => project && typeof project.id === "string" && typeof project.name === "string" && Array.isArray(project.items),
    );
  } catch {
    return [];
  }
}

export async function changeStoredProjects(change) {
  if (!navigator.locks?.request) {
    showToast("Для безопасного сохранения откройте приложение через HTTPS или localhost в браузере с поддержкой Web Locks");
    return false;
  }
  if (projectWritePending) return false;
  setProjectWritePending(true);
  try {
    return await navigator.locks.request(PROJECTS_STORAGE_KEY, () => {
      const raw = programStorageGet(PROJECTS_STORAGE_KEY);
      const latest = JSON.parse(raw ?? "[]");
      if (!Array.isArray(latest)) throw new Error("Неверный формат заказов");
      const next = change(latest);
      if (!next) return false;
      programStorageSet(PROJECTS_STORAGE_KEY, JSON.stringify(next));
      return true;
    });
  } catch {
    showToast("Не удалось записать заказы в браузере. Изменения остались в редакторе.");
    return false;
  } finally {
    setProjectWritePending(false);
    setProjects(readStoredProjects());
    renderProjectsList();
  }
}

function readStoredTechnology() {
  try {
    const stored = JSON.parse(programStorageGet(TECHNOLOGY_STORAGE_KEY) || "null");
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

export let rates = readStoredRates();
export let MATERIALS = readStoredMaterials();

function migrateMaterialPrices(materials, legacy) {
  for (const [key, material] of Object.entries(materials)) {
    if (material.catalogPricing) continue;
    const parts = material.parts ||= [];
    const systems = material.profiles.map(profile => profile.id);
    const types = Object.keys(PRODUCT_TYPES);
    const fallbackRates = {
      frame: legacy.frame[key], sash: legacy.frame[key], impost: legacy.impost[key], shtulp: legacy.impost[key],
      extender: legacy.frame[key], connector: legacy.frame[key], corner: legacy.frame[key],
      bead: legacy.bead[key], seal: legacy.seal[key], assembly: legacy.assembly[key],
    };
    const templates = Object.entries(fallbackRates).map(([role, price]) => ({
      id: `standard-${key}-${role}`, article: `STD-${key.toUpperCase()}-${role.toUpperCase()}`,
      name: `${PART_NAMES[role]} · ${material.label}`, role, price, systems, types,
    }));
    parts.push(...templates.filter(part => !parts.some(item => item.id === part.id)));
    if (key === "pvc" && !parts.some(part => part.id === "standard-pvc-steel")) {
      parts.push({
        id: "standard-pvc-steel", article: "STD-PVC-STEEL", name: "Стальное армирование",
        role: "steel", price: legacy.reinforcement,
        hosts: templates.filter(part => !["bead", "seal", "assembly"].includes(part.role)).map(part => part.id),
      });
    }
    material.catalogPricing = true;
  }
  return materials;
}

export function standardMaterials() {
  return migrateMaterialPrices(cloneMaterials(), DEFAULT_RATES);
}

export const glassCatalogKey = "oknoSmetaGlassCatalog";
export function standardGlassCatalog(prices = DEFAULT_RATES.glass) {
  return Object.fromEntries(Object.keys(DEFAULT_MATERIALS).map(material => [
    material, Object.fromEntries(Object.entries(GLASS).map(([id, item]) => [id, { ...item, rate: prices[id] }])),
  ]));
}
function loadGlassCatalog() {
  const defaults = standardGlassCatalog(rates.glass);
  try {
    const saved = JSON.parse(programStorageGet(glassCatalogKey));
    for (const material of Object.keys(defaults)) {
      if (saved?.[material] && typeof saved[material] === "object" && !Array.isArray(saved[material])) {
        defaults[material] = Object.fromEntries(Object.entries(saved[material]).map(([id, item]) => [
          id, { ...item, rate: item?.rate ?? rates.glass[item?.rateKey || id] ?? null },
        ]));
      }
    }
  } catch {}
  return defaults;
}
export let glassCatalog = loadGlassCatalog();
export function glassApplication(item, profileId, productType) {
  if (Array.isArray(item.applications)) {
    return item.applications.find(link => link?.profileId === profileId && link.productType === productType);
  }
  if (!Array.isArray(item.profileIds) || item.profileIds.includes(profileId)) return { beadId: "" };
}
export function materialGlass() {
  return Object.fromEntries(Object.entries(glassCatalog[state.material])
    .filter(([, item]) => glassApplication(item, state.profile, state.productType || "window")));
}
export function syncGlassChoices() {
  const catalog = materialGlass();
  const ids = Object.keys(catalog);
  if (ids.length) {
    if (!Object.hasOwn(catalog, state.defaultGlass)) state.defaultGlass = Object.hasOwn(catalog, "double") ? "double" : ids[0];
    sectionPanes().forEach(pane => { if (!Object.hasOwn(catalog, pane.glass)) pane.glass = state.defaultGlass; });
  }
  const options = Object.entries(catalog).map(([id, item]) =>
    `<option value="${escapeHtml(id)}">${escapeHtml(item.name)}${item.detail ? ` · ${escapeHtml(item.detail)}` : ""}</option>`).join("")
    || '<option value="">Нет совместимых стеклопакетов</option>';
  for (const id of ["defaultGlass", "paneGlass"]) {
    const select = $("#" + id);
    if (select.innerHTML !== options && select.dataset.glassOptions !== options) {
      select.innerHTML = options;
      select.dataset.glassOptions = options;
    }
    select.disabled = !ids.length;
    if (select.disabled) select.value = "";
  }
  if (ids.length) $("#defaultGlass").value = state.defaultGlass;
}

export let technology = readStoredTechnology();

const HARDWARE_STORAGE_KEY = "oknoSmetaHardware";
export const HANDLE_STYLES = {
  window: "Оконная",
  turn: "Поворотная",
  cylinder: "Поворотная с цилиндром",
  bow: "Скоба",
  rod: "Штанга",
};
export const HANDLE_LENGTHS = { window: 175, turn: 175, cylinder: 250, bow: 300, rod: 1000 };
const HANDLE_STYLE_ALIASES = { bar: "window", lever: "turn", offset: "bow", knob: "window", lock: "cylinder", long: "rod" };
export function normalizeHandleStyle(style) {
  if (HANDLE_STYLES[style]) return style;
  return HANDLE_STYLE_ALIASES[style] || "window";
}
export const MATERIAL_TITLES = { pvc: "Пластик", aluminum: "Алюминий", wood: "Дерево" };

function hardwareBound(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(10000000, Math.max(0, number));
}

function linksForMaterials(materials, productTypes) {
  const links = [];
  materials.forEach((material) => {
    (MATERIALS[material]?.profiles || []).forEach((profile) => {
      links.push({ material, profileId: profile.id, productTypes: [...productTypes] });
    });
  });
  return links;
}

export function defaultHardwareCatalog() {
  const windowTypes = ["window", "balconyDoor"];
  return {
    sets: [
      { id: "hw-roto-nt", name: "ROTO NT", minWidth: 250, maxWidth: 1600, minHeight: 280, maxHeight: 2600, price: 4650, links: linksForMaterials(["pvc"], windowTypes) },
      { id: "hw-futurus", name: "Футурус", minWidth: 350, maxWidth: 1300, minHeight: 400, maxHeight: 2200, price: 4380, links: linksForMaterials(["pvc"], windowTypes) },
      { id: "hw-maco", name: "MACO Multi-Matic", minWidth: 280, maxWidth: 1500, minHeight: 320, maxHeight: 2500, price: 5100, links: linksForMaterials(["aluminum"], windowTypes) },
      { id: "hw-roto-wood", name: "ROTO NT для дерева", minWidth: 280, maxWidth: 1500, minHeight: 320, maxHeight: 2500, price: 5400, links: linksForMaterials(["wood"], windowTypes) },
      { id: "hw-door", name: "Дверная фурнитура", minWidth: 400, maxWidth: 1300, minHeight: 1400, maxHeight: 2700, price: 8900, links: linksForMaterials(["pvc", "aluminum", "wood"], ["entranceDoor"]) },
    ],
    handles: [
      { id: "hdl-window", name: "Оконная белая", color: "#f4f7f8", style: "window", price: 520, hardwareIds: ["hw-roto-nt", "hw-futurus", "hw-maco", "hw-roto-wood", "hw-door"] },
      { id: "hdl-turn", name: "Поворотная белая", color: "#f4f7f8", style: "turn", price: 690, hardwareIds: ["hw-roto-nt", "hw-futurus", "hw-maco", "hw-roto-wood", "hw-door"] },
      { id: "hdl-cylinder", name: "Поворотная с цилиндром", color: "#f4f7f8", style: "cylinder", price: 980, hardwareIds: ["hw-door", "hw-roto-nt", "hw-futurus", "hw-maco", "hw-roto-wood"] },
      { id: "hdl-bow", name: "Скоба", color: "#f4f7f8", style: "bow", price: 1450, hardwareIds: ["hw-door", "hw-roto-nt", "hw-maco", "hw-roto-wood"] },
      { id: "hdl-rod", name: "Штанга", color: "#f4f7f8", style: "rod", price: 2400, hardwareIds: ["hw-door", "hw-maco", "hw-roto-wood"] },
    ],
  };
}

export function sanitizeHardwareCatalog(raw) {
  const sets = (Array.isArray(raw?.sets) ? raw.sets : []).filter((set) => set && typeof set.id === "string").map((set) => ({
    id: set.id,
    name: String(set.name || "Фурнитура").slice(0, 80),
    minWidth: hardwareBound(set.minWidth, 250),
    maxWidth: hardwareBound(set.maxWidth, 1600),
    minHeight: hardwareBound(set.minHeight, 280),
    maxHeight: hardwareBound(set.maxHeight, 2400),
    price: hardwareBound(set.price, 0),
    links: (Array.isArray(set.links) ? set.links : []).filter((link) => link && MATERIALS[link.material] && typeof link.profileId === "string").map((link) => ({
      material: link.material,
      profileId: link.profileId,
      productTypes: (Array.isArray(link.productTypes) ? link.productTypes : []).filter((type) => PRODUCT_TYPES[type]),
    })),
  }));
  const ids = new Set(sets.map((set) => set.id));
  const handles = (Array.isArray(raw?.handles) ? raw.handles : []).filter((item) => item && typeof item.id === "string").map((item) => ({
    id: item.id,
    name: String(item.name || "Ручка").slice(0, 80),
    color: /^#[0-9a-fA-F]{6}$/.test(item.color || "") ? item.color : "#d5dde6",
    style: normalizeHandleStyle(item.style),
    price: hardwareBound(item.price, 0),
    hardwareIds: (Array.isArray(item.hardwareIds) ? item.hardwareIds : []).filter((id) => ids.has(id)),
  }));
  return { sets, handles };
}

function loadHardwareCatalog() {
  try {
    const stored = JSON.parse(programStorageGet(HARDWARE_STORAGE_KEY) || "null");
    if (!stored) return defaultHardwareCatalog();
    return sanitizeHardwareCatalog(stored);
  } catch {
    return defaultHardwareCatalog();
  }
}

export let hardwareCatalog = loadHardwareCatalog();
export let hardwareDraft = null;

export function hardwareSetsForProduct(material = state.material, profileId = state.profile, productType = state.productType || "window") {
  return hardwareCatalog.sets.filter((set) => (set.links || []).some((link) =>
    link.material === material && link.profileId === profileId && (link.productTypes || []).includes(productType)));
}

export function handlesForSet(hardwareId) {
  return hardwareCatalog.handles.filter((item) => (item.hardwareIds || []).includes(hardwareId));
}

export function syncHardwareChoice() {
  const sets = hardwareSetsForProduct();
  if (!sets.some((set) => set.id === state.hardwareId)) state.hardwareId = sets[0]?.id || "";
  const handles = handlesForSet(state.hardwareId);
  if (!handles.some((item) => item.id === state.handleId)) state.handleId = handles[0]?.id || "";
}

export function selectedHardware() {
  return hardwareCatalog.sets.find((set) => set.id === state.hardwareId) || null;
}

export function selectedHandle() {
  return hardwareCatalog.handles.find((item) => item.id === state.handleId) || null;
}

export function persistHardwareCatalog() {
  try {
    programStorageSet(HARDWARE_STORAGE_KEY, JSON.stringify(hardwareCatalog));
    return true;
  } catch {
    return false;
  }
}

export function technicalSnapshot() {
  return {
    materials: appDatabase.technical[PROFILE_STORAGE_KEY] ?? null,
    rates: appDatabase.technical[RATES_STORAGE_KEY] ?? null,
    technology: appDatabase.technical[TECHNOLOGY_STORAGE_KEY] ?? null,
    glass: appDatabase.technical[glassCatalogKey] ?? null,
    hardware: appDatabase.technical[HARDWARE_STORAGE_KEY] ?? null,
    reports: appDatabase.technical[REPORTS_STORAGE_KEY] ?? null,
  };
}

export function applyTechnicalSnapshot(data) {
  const map = {
    materials: PROFILE_STORAGE_KEY,
    rates: RATES_STORAGE_KEY,
    technology: TECHNOLOGY_STORAGE_KEY,
    glass: glassCatalogKey,
    hardware: HARDWARE_STORAGE_KEY,
    reports: REPORTS_STORAGE_KEY,
  };
  Object.entries(map).forEach(([field, key]) => {
    if (!Object.hasOwn(data, field) || data[field] == null) delete appDatabase.technical[key];
    else appDatabase.technical[key] = data[field];
  });
  saveAppDatabase();
}

export function reloadProgramStateFromDatabase() {
  rates = readStoredRates();
  MATERIALS = readStoredMaterials();
  technology = readStoredTechnology();
  glassCatalog = loadGlassCatalog();
  hardwareCatalog = loadHardwareCatalog();
  setProjects(readStoredProjects());
  reloadReportSettings();
  renderAll();
  renderProjectsList();
}

export function setMATERIALS(value) { MATERIALS = value; }

export function setAppDatabase(value) { appDatabase = value; }

export function setGlassCatalog(value) { glassCatalog = value; }

export function setHardwareCatalog(value) { hardwareCatalog = value; }

export function setHardwareDraft(value) { hardwareDraft = value; }

export function setRates(value) { rates = value; }
