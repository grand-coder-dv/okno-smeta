// Текущее изделие: состояние, размеры, форма, проверки и формат чисел.
let catalogDraft = null;
let catalogMaterial = "pvc";
let catalogSequence = 0;
let impostSequence = 10;
let canvasLayout = null;
let dragState = null;

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
const impostPositionOrigin = {vertical:"start", horizontal:"start"};
function selectedSections() {
  const entries = sectionLayout();
  const indices = multiSections.size ? [...multiSections] : [state.selectedPane];
  return indices.map(i => entries[i]).filter(entry => entry && !entry.pane.split);
}
let orderItems = [];
let editingOrderItemId = null;
let orderItemSequence = 0;
let draftProductName = "Изделие 1";
let projects = readStoredProjects();
let activeProjectId = null;
let activeProjectSnapshot = null;
let projectWritePending = false;
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
  const profiles = MATERIALS[state.material].profiles;
  const profile = profiles.find(item => item.id === state.profile) || availableProfiles()[0] || profiles[0];
  return { ...profile, ...profileTypeSettings(profile) };
}

function openingAllowed(opening) {
  if (opening === "fixed") return true;
  const profile = getProfile();
  if (state.shape === "circle" && !profile.allowCircleSashes) return false;
  return profile[{ turn: "allowTurn", tiltturn: "allowTiltturn", tilt: "allowTilt" }[opening]] !== false;
}

function normalizeUnsupportedOpenings() {
  function visit(pane) {
    if (pane.sashFill && !openingAllowed(pane.opening)) { pane.opening = "fixed"; delete pane.hingeSide; }
    if (pane.split) (pane.children || []).forEach(visit);
    else if (!openingAllowed(pane.opening)) { pane.opening = "fixed"; delete pane.hingeSide; }
  }
  (state.panes || []).forEach(visit);
}

function getFinish() {
  return MATERIALS[state.material].finishes.find((item) => item.id === state.finish) || MATERIALS[state.material].finishes[0];
}

const GLASS_BITE_FIELDS = [["glassBiteFrame", "рама"], ["glassBiteSash", "створка"], ["glassBiteImpost", "импост"]];
const SASH_LAP = 24;
function getTechnology() {
  const profile = getProfile();
  const fallback = technology[state.material];
  return {
    frame: clamp(profile.frameWidth ?? fallback.frame, 20, 250),
    sash: clamp(profile.sashWidth ?? fallback.sash, 20, 250),
    impost: clamp(profile.impostWidth ?? fallback.impost, 20, 250),
    bite: Object.fromEntries(GLASS_BITE_FIELDS.map(([field, part]) =>
      [part, clamp(profile[field] ?? profile.glassBite ?? 14, 0, 100)])),
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
  return shape === "circle";
}
function inferredShapeMode(config) {
  if(config.shapeModeVersion || config.shape!=="rect")return config.shape;
  if(config.framePolygon?.length>=3)return "skew";
  const hasArc=arcs=>Object.values(arcs||{}).some(Boolean);
  const anySash=panes=>(panes||[]).some(p=>hasArc(p.sashArcs)||anySash(p.children));
  return hasArc(config.frameArcs)||anySash(config.panes)?"arch":"rect";
}
function setWindowShapeMode(mode) {
  if(!Object.hasOwn(SHAPES,mode)||mode===state.shape)return;
  state.shape=mode;
  state.shapeModeVersion=1;
  // A new outline starts with one empty fixed opening; old shape geometry
  // and section settings must not carry over to it.
  delete state.frameArcs;
  delete state.framePolygon;
  state.vImposts=[];
  state.hImposts=[];
  state.cols=1;
  state.rows=1;
  state.defaultGlass="double";
  state.panes=[{opening:"fixed",glass:state.defaultGlass,innerImposts:[]}];
  state.selectedPane=0;
  state.selectedImpost=null;
  multiSections.clear();
  activeProfileEdge=null;
  sharedAxis=null;
  if(mode==="circle")state.height=state.width;
}

function setConfigurationError(message = "") {
  const node = $("#configurationError");
  node.textContent = message;
  node.hidden = !message;
}

function validateCurrentProduct() {
  if (!Number.isFinite(state.width) || state.width < 400 || state.width > 5000) return "Ширина изделия должна быть от 400 до 5000 мм.";
  if (!Number.isFinite(state.height) || state.height < 400 || state.height > 4000) return "Высота изделия должна быть от 400 до 4000 мм.";
  if (!Number.isInteger(state.quantity) || state.quantity < 1 || state.quantity > 9999) return "Количество должно быть целым числом от 1 до 9999.";
  const material = MATERIALS[state.material];
  if (!material) return "Выбран неизвестный материал профиля.";
  if (!PRODUCT_TYPES[state.productType || "window"]) return "Выбран неизвестный тип изделия.";
  if (!availableProfiles().some((item) => item.id === state.profile)) return "Для этого типа изделия нет доступной профильной системы.";
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

function restoreProductState(configuration) {
  state = cloneData(configuration);
  state.shape = inferredShapeMode(state);
  state.shapeModeVersion = 1;
  activeProfileEdge = null;
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

function resetCurrentProduct(previous = null) {
  editingOrderItemId = null;
  draftProductName = `Изделие ${orderItemSequence + 1}`;
  state = createDefaultState();
  if (previous) {
    for (const key of ["material", "profile", "finish", "productType", "shape", "width", "height", "defaultGlass"]) {
      if (previous[key] !== undefined) state[key] = previous[key];
    }
    if (state.shape === "skew" && previous.framePolygon) state.framePolygon = cloneData(previous.framePolygon);
    if (state.shape === "arch" && previous.frameArcs) state.frameArcs = cloneData(previous.frameArcs);
    state.panes = [{ opening: "fixed", glass: state.defaultGlass, innerImposts: [] }];
  }
  activeProfileEdge = null;
  multiSections.clear();
  sharedAxis = null;
  syncFormFromState();
  markCurrentStateBaseline();
  setConfigurationError();
  renderAll();
  renderOrder();
  renderProjectToolbar();
}
