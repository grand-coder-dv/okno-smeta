import { resolveParts } from "./profile-parts.js";
// Текущее изделие: состояние, размеры, форма, проверки и формат чисел.
import { MATERIALS, PRODUCT_TYPES, SHAPES, availableProfiles, cloneData, materialGlass, profileTypeSettings, readStoredProjects, technology } from "./catalog.js";
import { activeProfileEdge, customProfileArcs, fittedGlass, hasSlantedImposts, setActiveProfileEdge } from "./drawing.js";
import { renderAll, syncFormFromState } from "./editor-ui.js";
import { ensurePanes, glassGeometry, sectionLayout, sectionNumber, sectionPanes, updateMaterialSelects } from "./geometry.js";
import { renderOrder, renderProjectToolbar } from "./order.js";
export let catalogDraft = null;
export let catalogMaterial = "pvc";
let catalogSequence = 0;
export let impostSequence = 10;
export function nextImpostSequence() {
  impostSequence += 1;
  return impostSequence;
}
export let canvasLayout = null;
export let dragState = null;
export let canvasZoom = 1;

function createDefaultState() {
  return {
    material: "pvc",
    productType: "window",
    profile: "pvc70",
    finish: "white",
    shape: "rect",
    shapeModeVersion: 1,
    width: 1300,
    height: 1400,
    quantity: 1,
    cols: 1,
    rows: 1,
    vImposts: [],
    hImposts: [],
    defaultGlass: "double",
    hardwareId: "",
    handleId: "",
    selectedPane: 0,
    selectedImpost: null,
    panes: [
      { opening: "fixed", glass: "double", innerImposts: [] },
    ],
  };
}

export let state = createDefaultState();
export let multiSections = new Set();
export let sharedAxis = null;
export const impostPositionOrigin = {vertical:"start", horizontal:"start"};
export function selectedSections() {
  const entries = sectionLayout();
  const indices = multiSections.size ? [...multiSections] : [state.selectedPane];
  return indices.map(i => entries[i]).filter(entry => entry && !entry.pane.split);
}

export function sectionOpeningPanes(sections = selectedSections()) {
  return [...new Set(sections.map(({ pane, sashOwner }) => sashOwner?.pane || pane))];
}
export let orderItems = [];
export let editingOrderItemId = null;
export let orderItemSequence = 0;
export let draftProductName = "Изделие 1";
export let projects = [];
export function loadStoredProjects() { projects = readStoredProjects(); }
export let activeProjectId = null;
export let activeProjectSnapshot = null;
export let projectWritePending = false;
export let activeProjectName = "";
export let projectDirty = false;
let currentStateBaseline = "";

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];
export const numberFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max);
}

export function formatMoney(value) {
  return moneyFormatter.format(Math.round(value));
}

export function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function pluralizeRu(count, one, few, many) {
  const value = Math.abs(Number(count)) % 100;
  const last = value % 10;
  if (value > 10 && value < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createCatalogId(prefix) {
  catalogSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${catalogSequence}`;
}

export function getProfile() {
  const profiles = MATERIALS[state.material].profiles;
  const profile = profiles.find(item => item.id === state.profile) || availableProfiles()[0] || profiles[0];
  const result = { ...profile, ...profileTypeSettings(profile) };
  result.parts = resolveParts(MATERIALS, state, profile);
  for (const [role, part] of Object.entries(result.parts)) {
    if (part.width != null) result[role + "Width"] = part.width;
    const biteField = { frame: "glassBiteFrame", sash: "glassBiteSash", impost: "glassBiteImpost" }[role];
    if (biteField && part.bite != null) result[biteField] = part.bite;
  }
  return result;
}

export function openingAllowed(opening) {
  if (opening === "fixed") return true;
  const profile = getProfile();
  if (state.shape === "circle" && !profile.allowCircleSashes) return false;
  return profile[{ turn: "allowTurn", tiltturn: "allowTiltturn", tilt: "allowTilt" }[opening]] !== false;
}

export function normalizeUnsupportedOpenings() {
  function visit(pane) {
    if (pane.sashFill && !openingAllowed(pane.opening)) { pane.opening = "fixed"; delete pane.hingeSide; }
    if (pane.split) (pane.children || []).forEach(visit);
    else if (!openingAllowed(pane.opening)) { pane.opening = "fixed"; delete pane.hingeSide; }
  }
  (state.panes || []).forEach(visit);
}

export function getFinish() {
  return MATERIALS[state.material].finishes.find((item) => item.id === state.finish) || MATERIALS[state.material].finishes[0];
}

const GLASS_BITE_FIELDS = [["glassBiteFrame", "рама"], ["glassBiteSash", "створка"], ["glassBiteImpost", "импост"]];
export const SASH_LAP = 24;
export function getTechnology() {
  const profile = getProfile();
  const fallback = technology[state.material];
  return {
    frame: clamp(profile.frameWidth ?? fallback.frame, 20, 250),
    sash: clamp(profile.sashWidth ?? fallback.sash, 20, 250),
    impost: clamp(profile.impostWidth ?? fallback.impost, 20, 250),
    shtulp: clamp(profile.shtulpWidth ?? profile.sashWidth ?? fallback.sash, 20, 250),
    extender: clamp(profile.extenderWidth ?? 40, 10, 250),
    connector: clamp(profile.connectorWidth ?? 20, 10, 250),
    corner: clamp(profile.cornerWidth ?? profile.frameWidth ?? fallback.frame, 10, 250),
    shtulpBite: profile.parts.shtulp?.bite ?? profile.glassBiteImpost ?? 14,
    bite: Object.fromEntries(GLASS_BITE_FIELDS.map(([field, part]) =>
      [part, clamp(profile[field] ?? profile.glassBite ?? 14, 0, 100)])),
  };
}

export function createOrderItemId() {
  orderItemSequence += 1;
  return `order-item-${Date.now().toString(36)}-${orderItemSequence}`;
}

export function snapshotCurrentState() {
  const selected = Object.entries(getProfile().parts);
  const snapshot = cloneData({ ...state, selectedImpost: null });
  if (selected.length) snapshot.partChoices = Object.fromEntries(selected.map(([role, part]) => [role, part.id]));
  return snapshot;
}

export function comparableCurrentState(source = state) {
  const comparable = cloneData(source);
  delete comparable.selectedPane;
  delete comparable.selectedImpost;
  return JSON.stringify(comparable);
}

export function markCurrentStateBaseline() {
  currentStateBaseline = comparableCurrentState();
}

export function currentProductIsDirty() {
  return Boolean(currentStateBaseline && comparableCurrentState() !== currentStateBaseline);
}

export function isPreliminaryShape(shape = state.shape) {
  return shape === "circle";
}
export function inferredShapeMode(config) {
  if(config.shapeModeVersion || config.shape!=="rect")return config.shape;
  if(config.framePolygon?.length>=3)return "skew";
  const hasArc=arcs=>Object.values(arcs||{}).some(Boolean);
  const anySash=panes=>(panes||[]).some(p=>hasArc(p.sashArcs)||anySash(p.children));
  return hasArc(config.frameArcs)||anySash(config.panes)?"arch":"rect";
}
export function setWindowShapeMode(mode) {
  if(!Object.hasOwn(SHAPES,mode)||mode===state.shape)return;
  state.shape=mode;
  state.shapeModeVersion=1;
  // A new outline starts with one empty fixed opening; old shape geometry
  // and section settings must not carry over to it.
  delete state.frameArcs;
  delete state.framePolygon;
  state.addons=[];
  state.vImposts=[];
  state.hImposts=[];
  state.cols=1;
  state.rows=1;
  state.defaultGlass="double";
  state.panes=[{opening:"fixed",glass:state.defaultGlass,innerImposts:[]}];
  state.selectedPane=0;
  state.selectedImpost=null;
  multiSections.clear();
  setActiveProfileEdge(null);
  sharedAxis=null;
  if(mode==="skew") state.framePolygon=[[0,0],[1,0],[1,1],[0,1]];
  if(mode==="circle")state.height=state.width;
}

export function setConfigurationError(message = "") {
  const node = $("#configurationError");
  node.textContent = message;
  node.hidden = !message;
}

export function validateCurrentProduct() {
  if (!Number.isFinite(state.width) || state.width < 400 || state.width > 5000) return "Ширина изделия должна быть от 400 до 5000 мм.";
  if (!Number.isFinite(state.height) || state.height < 400 || state.height > 4000) return "Высота изделия должна быть от 400 до 4000 мм.";
  if (!Number.isInteger(state.quantity) || state.quantity < 1 || state.quantity > 9999) return "Количество должно быть целым числом от 1 до 9999.";
  const material = MATERIALS[state.material];
  if (!material) return "Выбран неизвестный материал профиля.";
  if (!PRODUCT_TYPES[state.productType || "window"]) return "Выбран неизвестный тип изделия.";
  if (!availableProfiles().some((item) => item.id === state.profile)) return "Для этого типа изделия нет доступной профильной системы.";
  if (!Object.keys(materialGlass()).length) return "Назначьте совместимый стеклопакет во вкладке «Стеклопакеты».";
  if (state.shape === "circle" && !getProfile().allowCircleShape) return "Для этой профильной системы круглая форма недоступна.";
  if (!material.finishes.some((item) => item.id === state.finish)) return "Выбранный цвет или отделка больше недоступны.";
  if (!Array.isArray(state.panes) || state.panes.length !== state.cols * state.rows) return "Количество секций не соответствует выбранной разбивке.";

  const tech = getTechnology();
  for (const [i,entry] of sectionLayout().entries()) {
    if (entry.pane.split) continue;
    if (!openingAllowed(entry.pane.opening)) return `Секция № ${sectionNumber(i)}: тип открывания недоступен для этой системы.`;
    const geo=glassGeometry(entry,tech);
    if ((state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs()) && geo.fields.some(f=>f.clearW>1e-6 && f.clearH>1e-6 && (fittedGlass(entry,geo,f,tech).area ?? f.w*f.h)<=1e-7)) {
      return `Секция № ${sectionNumber(i)}: в этой части контура нет места для стеклопакета. Сместите или удалите импост.`;
    }
    if (geo.fields.some(f=>f.clearW< -1e-6 || f.clearH< -1e-6)) {
      return `Секция № ${sectionNumber(i)}: профили перекрывают световой проём.`;
    }
  }
  return "";
}

export function applyPaneChanges(changes, { preview = false } = {}) {
  const previous = changes.map(({ pane }) => ({ ...pane }));
  let accepted = false;
  try {
    changes.forEach(({ pane, values }) => Object.assign(pane, values));
    const issue = validateCurrentProduct();
    accepted = !preview && !issue;
    return issue;
  } finally {
    if (!accepted) {
      changes.forEach(({ pane, values }, index) => {
        for (const key of Object.keys(values)) {
          if (Object.hasOwn(previous[index], key)) pane[key] = previous[index][key];
          else delete pane[key];
        }
      });
    }
  }
}

export function restoreProductState(configuration) {
  state = cloneData(configuration);
  state.shape = inferredShapeMode(state);
  state.shapeModeVersion = 1;
  setActiveProfileEdge(null);
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

export function resetCurrentProduct(previous = null) {
  editingOrderItemId = null;
  draftProductName = `Изделие ${orderItemSequence + 1}`;
  state = createDefaultState();
  if (previous) {
    for (const key of ["material", "profile", "finish", "productType", "shape", "width", "height", "defaultGlass", "hardwareId", "handleId"]) {
      if (previous[key] !== undefined) state[key] = previous[key];
    }
    if (state.shape === "skew" && previous.framePolygon) state.framePolygon = cloneData(previous.framePolygon);
    if (state.shape === "arch" && previous.frameArcs) state.frameArcs = cloneData(previous.frameArcs);
    state.panes = [{ opening: "fixed", glass: state.defaultGlass, innerImposts: [] }];
  }
  setActiveProfileEdge(null);
  multiSections.clear();
  sharedAxis = null;
  syncFormFromState();
  markCurrentStateBaseline();
  setConfigurationError();
  renderAll();
  renderOrder();
  renderProjectToolbar();
}

export function setActiveProjectId(value) { activeProjectId = value; }

export function setActiveProjectName(value) { activeProjectName = value; }

export function setActiveProjectSnapshot(value) { activeProjectSnapshot = value; }

export function setCanvasLayout(value) { canvasLayout = value; }

export function setCanvasZoom(value) { canvasZoom = value; }

export function setCatalogDraft(value) { catalogDraft = value; }

export function setCatalogMaterial(value) { catalogMaterial = value; }

export function setDraftProductName(value) { draftProductName = value; }

export function setDragState(value) { dragState = value; }

export function setEditingOrderItemId(value) { editingOrderItemId = value; }

export function setMultiSections(value) { multiSections = value; }

export function setOrderItemSequence(value) { orderItemSequence = value; }

export function setOrderItems(value) { orderItems = value; }

export function setProjectDirty(value) { projectDirty = value; }

export function setProjectWritePending(value) { projectWritePending = value; }

export function setProjects(value) { projects = value; }

export function setSharedAxis(value) { sharedAxis = value; }

export function replaceState(value) { state = value; }
