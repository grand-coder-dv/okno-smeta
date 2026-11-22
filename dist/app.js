const MATERIALS = {
  pvc: {
    label: "ПВХ",
    frame: "#eef1f4",
    edge: "#aeb8c4",
    profiles: [
      { id: "pvc60", name: "ПВХ 60 мм · 3 камеры", factor: 0.9, seals: 2 },
      { id: "pvc70", name: "ПВХ 70 мм · 5 камер", factor: 1, seals: 2 },
      { id: "pvc82", name: "ПВХ 82 мм · 7 камер", factor: 1.18, seals: 3 },
    ],
    finishes: [
      { id: "white", name: "Белый", factor: 1 },
      { id: "anthracite", name: "Антрацит", factor: 1.13 },
      { id: "golden-oak", name: "Золотой дуб", factor: 1.16 },
      { id: "walnut", name: "Орех", factor: 1.16 },
    ],
  },
  aluminum: {
    label: "Алюминий",
    frame: "#4c5868",
    edge: "#202b39",
    profiles: [
      { id: "alu45", name: "Алюминий 45 мм · холодный", factor: 0.86, seals: 1 },
      { id: "alu70", name: "Алюминий 70 мм · тёплый", factor: 1, seals: 2 },
      { id: "alu90", name: "Алюминий 90 мм · тёплый+", factor: 1.24, seals: 3 },
    ],
    finishes: [
      { id: "ral-white", name: "RAL 9016 белый", factor: 1 },
      { id: "ral-anthracite", name: "RAL 7016 антрацит", factor: 1.08 },
      { id: "ral-black", name: "RAL 9005 чёрный", factor: 1.08 },
      { id: "anodized", name: "Анодированный", factor: 1.12 },
    ],
  },
  wood: {
    label: "Дерево",
    frame: "#9d6742",
    edge: "#633d25",
    profiles: [
      { id: "pine78", name: "Сосна · 78 мм", factor: 0.9, seals: 2 },
      { id: "oak78", name: "Дуб · 78 мм", factor: 1.25, seals: 2 },
      { id: "woodalu92", name: "Дерево–алюминий · 92 мм", factor: 1.42, seals: 3 },
    ],
    finishes: [
      { id: "natural", name: "Натуральный лак", factor: 1 },
      { id: "walnut", name: "Орех", factor: 1.08 },
      { id: "wenge", name: "Венге", factor: 1.1 },
      { id: "painted", name: "Укрывная окраска", factor: 1.12 },
    ],
  },
};

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

const RATES_STORAGE_KEY = "oknoSmetaRates";

function readStoredRates() {
  const defaults = cloneRates();
  try {
    const saved = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || "null");
    const merge = (base, source) => {
      for (const [key, fallback] of Object.entries(base)) {
        const value = source?.[key];
        if (typeof fallback === "object") merge(fallback, value);
        else if (typeof value === "number" && Number.isFinite(value) && value >= 0) base[key] = value;
      }
    };
    merge(defaults, saved);
  } catch {
    return cloneRates();
  }
  return defaults;
}

function persistRates(reset = false) {
  try {
    if (reset) localStorage.removeItem(RATES_STORAGE_KEY);
    else localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    return true;
  } catch {
    return false;
  }
}

let rates = readStoredRates();
let technology = readStoredTechnology();
let impostSequence = 10;
let canvasLayout = null;
let dragState = null;
let state = {
  material: "pvc",
  profile: "pvc70",
  finish: "white",
  shape: "rect",
  width: 1400,
  height: 1300,
  quantity: 1,
  cols: 2,
  rows: 1,
  vImposts: [{ id: "root-v-1", position: 700 }],
  hImposts: [],
  defaultGlass: "double",
  selectedPane: 0,
  selectedField: null,
  selectedImpost: null,
  panes: [
    { opening: "tiltturn", glass: "double", innerImposts: [] },
    { opening: "fixed", glass: "double", innerImposts: [] },
  ],
};

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

function getProfile() {
  return MATERIALS[state.material].profiles.find((item) => item.id === state.profile) || MATERIALS[state.material].profiles[0];
}

function getFinish() {
  return MATERIALS[state.material].finishes.find((item) => item.id === state.finish) || MATERIALS[state.material].finishes[0];
}

function getTechnology() {
  return technology[state.material];
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

function getPanePhysicalRect(index) {
  const xBounds = primaryBoundaries("vertical");
  const yBounds = primaryBoundaries("horizontal");
  const col = index % state.cols;
  const row = Math.floor(index / state.cols);
  return {
    x: xBounds[col],
    y: yBounds[row],
    width: xBounds[col + 1] - xBounds[col],
    height: yBounds[row + 1] - yBounds[row],
  };
}

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
  state.selectedPane = clamp(state.selectedPane, 0, Math.max(count - 1, 0));
  if (state.selectedImpost?.scope === "pane" && !state.panes[state.selectedImpost.paneIndex]) state.selectedImpost = null;
}

function getSelectedImpostRecord() {
  const selected = state.selectedImpost;
  if (!selected) return null;
  if (selected.scope === "root") {
    const collection = selected.orientation === "vertical" ? state.vImposts : state.hImposts;
    const item = collection.find((candidate) => candidate.id === selected.id);
    return item ? { selected, item, collection } : null;
  }
  const pane = state.panes[selected.paneIndex];
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

function getPaneFields(pane) {
  const bounds = orientation => [
    { id: "start", position: 0 },
    ...pane.innerImposts.filter(item => item.orientation === orientation)
      .sort((a, b) => a.position - b.position),
    { id: "end", position: 1 },
  ];
  const xs = bounds("vertical"), ys = bounds("horizontal");
  const fields = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const [left, right] = xs.slice(col, col + 2);
      const [top, bottom] = ys.slice(row, row + 2);
      const key = [left.id, right.id, top.id, bottom.id].join(":");
      fields.push({ key, x: left.position, y: top.position,
        width: right.position - left.position, height: bottom.position - top.position,
        edges: [left.id === "start", right.id === "end", top.id === "start", bottom.id === "end"],
        glass: pane.fieldGlass?.[key] ?? pane.glass });
    }
  }
  return fields;
}

function paneGlazing(index, pane, shapeFactor = 1) {
  const rect = getPanePhysicalRect(index);
  const tech = getTechnology();
  const col = index % state.cols, row = Math.floor(index / state.cols);
  const outer = [col === 0, col === state.cols - 1, row === 0, row === state.rows - 1];
  const sash = pane.opening === "fixed" ? 0 : tech.sash;
  const issues = [];
  const fields = getPaneFields(pane).map((field, i) => {
    const cuts = field.edges.map((edge, side) =>
      edge ? (outer[side] ? tech.frame : tech.impost / 2) + sash : tech.impost / 2);
    const width = rect.width * field.width - cuts[0] - cuts[1];
    const height = rect.height * field.height - cuts[2] - cuts[3];
    const valid = width >= 20 && height >= 20;
    if (!valid) issues.push(`поле ${i + 1}: недостаточно места под стекло`);
    return { ...field, area: valid ? width * height * shapeFactor / 1_000_000 : 0 };
  });
  return { fields, issues, area: fields.reduce((sum, field) => sum + field.area, 0) };
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
  const paneGlazingFields = [];
  const issues = [];
  state.panes.forEach((pane, index) => {
    const paneRect = getPanePhysicalRect(index);
    pane.innerImposts.forEach((item) => {
      nestedCount += 1;
      nestedImpost += item.orientation === "vertical" ? (paneRect.height / 1000) * verticalFactor : (paneRect.width / 1000) * horizontalFactor;
    });
    glassUnits += paneGlassUnits(pane);
    const glazing = paneGlazing(index, pane, shapeFactor);
    paneGlazingAreas[index] = glazing.area;
    paneGlazingFields[index] = glazing.fields;
    if (glazing.issues.length) issues.push(`Секция ${index + 1}: ${glazing.issues.join(", ")}`);
  });
  const glazingArea = paneGlazingAreas.reduce((sum, value) => sum + value, 0);
  const impost = primaryImpost + nestedImpost;
  return { issues, approximate: state.shape !== "rect", area, perimeter, glazingArea, paneGlazingAreas, paneGlazingFields, impost, primaryImpost, nestedImpost, nestedCount, glassUnits };
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

  const glassGroups = {};
  for (const field of dimensions.paneGlazingFields.flat()) {
    const group = glassGroups[field.glass] ??= { fields: 0, area: 0 };
    group.fields += 1;
    group.area += field.area;
  }

  Object.entries(glassGroups).forEach(([glassKey, group]) => {
    const glass = GLASS[glassKey];
    addLine({
      name: `${glass.name} стеклопакет`,
      note: "Заполнение светового проёма",
      characteristic: `${glass.detail}; полей: ${group.fields}`,
      qty: group.area * quantity,
      unit: "м²",
      rate: rates.glass[glassKey],
    });
  });

  const openingGroups = state.panes.reduce((groups, pane) => {
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

function openingSymbol(type, x, y, width, height) {
  const pad = Math.min(11, width * 0.08, height * 0.08);
  const left = x + pad;
  const right = x + width - pad;
  const top = y + pad;
  const bottom = y + height - pad;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const stroke = "#4d7085";
  let paths = "";

  if (type === "turn" || type === "tiltturn") {
    paths += `<path d="M ${left} ${top} L ${right} ${cy} L ${left} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type === "tilt" || type === "tiltturn") {
    paths += `<path d="M ${left} ${bottom} L ${cx} ${top} L ${right} ${bottom}" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-dasharray="5 4" />`;
  }
  if (type !== "fixed") {
    paths += `<line x1="${right - 4}" y1="${cy - 10}" x2="${right - 4}" y2="${cy + 10}" stroke="#20384c" stroke-width="3" stroke-linecap="round" />`;
  }
  return paths;
}

function impostValueTag(x, y, value, inner = false) {
  const text = `${Math.round(value)} мм`;
  const width = Math.max(58, text.length * 7 + 14);
  return `<g class="impost-value-tag${inner ? " inner" : ""}">
    <rect x="${x - width / 2}" y="${y - 12}" width="${width}" height="24" rx="7" />
    <text x="${x}" y="${y + 4}">${text}</text>
  </g>`;
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
  const canvasScale = Math.min(width / state.width, height / state.height);
  const frame = clamp(tech.frame * canvasScale, 12, 38);
  const sashFace = clamp(tech.sash * canvasScale, 8, 34);
  const impostFace = clamp(tech.impost * canvasScale, 7, 32);
  const material = MATERIALS[state.material];
  const paths = shapePaths(x, y, width, height, frame);
  const box = paths.innerBox;
  const rootVerticalX = state.vImposts.map((item) => x + (item.position / state.width) * width);
  const rootHorizontalY = state.hImposts.map((item) => y + (item.position / state.height) * height);
  const xBounds = [box.x, ...rootVerticalX, box.x + box.width];
  const yBounds = [box.y, ...rootHorizontalY, box.y + box.height];
  const paneRects = [];

  let panesMarkup = "";
  state.panes.forEach((pane, index) => {
    const col = index % state.cols;
    const row = Math.floor(index / state.cols);
    const px = xBounds[col];
    const py = yBounds[row];
    const paneWidth = xBounds[col + 1] - px;
    const paneHeight = yBounds[row + 1] - py;
    const physical = getPanePhysicalRect(index);
    paneRects[index] = { x: px, y: py, width: paneWidth, height: paneHeight, physicalWidth: physical.width, physicalHeight: physical.height };
    const selected = index === state.selectedPane;
    const paneKind = pane.opening === "fixed" ? "глухой секции" : "створке";
    const paneSashFace = Math.min(sashFace, paneWidth * 0.22, paneHeight * 0.22);
    const paneImpostFace = Math.min(impostFace, paneWidth * 0.2, paneHeight * 0.2);
    let innerImpostsMarkup = "";

    pane.innerImposts.forEach((item) => {
      const active = isSelectedImpost("pane", item.orientation, item.id, index);
      const isVertical = item.orientation === "vertical";
      const lineX = px + item.position * paneWidth;
      const lineY = py + item.position * paneHeight;
      const physicalPosition = item.position * (isVertical ? physical.width : physical.height);
      if (isVertical) {
        innerImpostsMarkup += `
          <line class="impost-visible inner-impost-visible${active ? " selected" : ""}" x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" stroke="${material.frame}" stroke-width="${paneImpostFace}" />
          <line x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" stroke="${material.edge}" stroke-width="1.2" opacity=".55" pointer-events="none" />
          <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 7}" y="${py + paneHeight / 2 - 14}" width="14" height="28" rx="7" />
          <line class="impost-hit" data-scope="pane" data-pane="${index}" data-orientation="vertical" data-id="${item.id}" x1="${lineX}" y1="${py}" x2="${lineX}" y2="${py + paneHeight}" tabindex="0" role="slider" aria-label="Вертикальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          ${active ? impostValueTag(lineX, py + 18, physicalPosition, true) : ""}`;
      } else {
        innerImpostsMarkup += `
          <line class="impost-visible inner-impost-visible${active ? " selected" : ""}" x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" stroke="${material.frame}" stroke-width="${paneImpostFace}" />
          <line x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" stroke="${material.edge}" stroke-width="1.2" opacity=".55" pointer-events="none" />
          <rect class="impost-grip${active ? " selected" : ""}" x="${px + paneWidth / 2 - 14}" y="${lineY - 7}" width="28" height="14" rx="7" />
          <line class="impost-hit horizontal" data-scope="pane" data-pane="${index}" data-orientation="horizontal" data-id="${item.id}" x1="${px}" y1="${lineY}" x2="${px + paneWidth}" y2="${lineY}" tabindex="0" role="slider" aria-label="Горизонтальный импост в ${paneKind} ${index + 1}" aria-valuenow="${Math.round(physicalPosition)}" />
          ${active ? impostValueTag(px + 42, lineY, physicalPosition, true) : ""}`;
      }
    });

    const fields = getPaneFields(pane);
    const activeField = fields.find(field => field.key === state.selectedField) ?? fields[0];
    const marks = fields.map((field, fieldIndex) => {
      const fx = px + field.x * paneWidth, fy = py + field.y * paneHeight;
      const fw = field.width * paneWidth, fh = field.height * paneHeight;
      const box = `x="${fx}" y="${fy}" width="${fw}" height="${fh}"`;
      return {
        fill: `<rect ${box} fill="${GLASS[field.glass].color}" />`,
        hit: `<rect class="pane-hit" ${box} data-pane="${index}" data-field="${field.key}"
          fill="transparent" tabindex="0" role="button"
          aria-label="Секция ${index + 1}, поле ${fieldIndex + 1}" />`,
        mark: selected && !state.selectedImpost && field === activeField
          ? `<rect class="pane-selected" x="${fx + 3}" y="${fy + 3}"
            width="${Math.max(0, fw - 6)}" height="${Math.max(0, fh - 6)}" />` : "",
      };
    });

    panesMarkup += `
      <g class="pane" data-index="${index}" clip-path="url(#innerClip)">
        ${marks.map(item => item.fill).join("")}
        <rect x="${px}" y="${py}" width="${paneWidth}" height="${paneHeight}" fill="url(#glassSheen)" opacity="0.55" />
        ${pane.opening !== "fixed" ? `<rect x="${px + paneSashFace / 2}" y="${py + paneSashFace / 2}" width="${Math.max(paneWidth - paneSashFace, 2)}" height="${Math.max(paneHeight - paneSashFace, 2)}" fill="none" stroke="${material.frame}" stroke-width="${paneSashFace}" pointer-events="none" />` : ""}
        ${openingSymbol(pane.opening, px, py, paneWidth, paneHeight)}
        ${marks.map(item => item.mark).join("")}
        <circle cx="${px + paneWidth / 2}" cy="${py + paneHeight / 2}" r="14" fill="rgba(255,255,255,.82)" stroke="rgba(53,80,105,.22)" />
        <text class="pane-number" x="${px + paneWidth / 2}" y="${py + paneHeight / 2 + 4}">${index + 1}</text>
        ${marks.map(item => item.hit).join("")}
        ${innerImpostsMarkup}
      </g>`;
  });

  let rootImpostsMarkup = "";
  state.vImposts.forEach((item, index) => {
    const lineX = rootVerticalX[index];
    const active = isSelectedImpost("root", "vertical", item.id);
    rootImpostsMarkup += `
      <line class="impost-visible${active ? " selected" : ""}" x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" stroke="${material.frame}" stroke-width="${impostFace}" />
      <line x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" stroke="${material.edge}" stroke-width="1.4" opacity=".55" pointer-events="none" />
      <rect class="impost-grip${active ? " selected" : ""}" x="${lineX - 8}" y="${box.y + box.height / 2 - 18}" width="16" height="36" rx="8" />
      <line class="impost-hit" data-scope="root" data-orientation="vertical" data-id="${item.id}" x1="${lineX}" y1="${box.y - 2}" x2="${lineX}" y2="${box.y + box.height + 2}" tabindex="0" role="slider" aria-label="Вертикальный импост рамы" aria-valuemin="0" aria-valuemax="${state.width}" aria-valuenow="${Math.round(item.position)}" />
      ${active ? impostValueTag(lineX, box.y + 18, item.position) : ""}`;
  });
  state.hImposts.forEach((item, index) => {
    const lineY = rootHorizontalY[index];
    const active = isSelectedImpost("root", "horizontal", item.id);
    rootImpostsMarkup += `
      <line class="impost-visible${active ? " selected" : ""}" x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" stroke="${material.frame}" stroke-width="${impostFace}" />
      <line x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" stroke="${material.edge}" stroke-width="1.4" opacity=".55" pointer-events="none" />
      <rect class="impost-grip${active ? " selected" : ""}" x="${box.x + box.width / 2 - 18}" y="${lineY - 8}" width="36" height="16" rx="8" />
      <line class="impost-hit horizontal" data-scope="root" data-orientation="horizontal" data-id="${item.id}" x1="${box.x - 2}" y1="${lineY}" x2="${box.x + box.width + 2}" y2="${lineY}" tabindex="0" role="slider" aria-label="Горизонтальный импост рамы" aria-valuemin="0" aria-valuemax="${state.height}" aria-valuenow="${Math.round(item.position)}" />
      ${active ? impostValueTag(box.x + 42, lineY, item.position) : ""}`;
  });

  canvasLayout = { x, y, width, height, box, xBounds, yBounds, paneRects };
  const leftDimensionX = Math.max(24, x - 39);
  const bottomDimensionY = Math.min(476, y + height + 39);
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
      <marker id="dimArrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
        <path d="M 8 1 L 1 4 L 8 7" fill="none" stroke="#8996a8" stroke-width="1.2" />
      </marker>
    </defs>
    <g filter="url(#windowShadow)" fill="${material.frame}" stroke="${material.edge}" stroke-width="2.2">${paths.outer}</g>
    <g fill="#bfe3ef" stroke="${material.edge}" stroke-width="1.6">${paths.inner}</g>
    <g clip-path="url(#innerClip)">${panesMarkup}${rootImpostsMarkup}</g>
    <g class="dimensions">
      <line class="dimension-line" x1="${x}" y1="${y + height + 6}" x2="${x}" y2="${bottomDimensionY + 7}" opacity=".45" />
      <line class="dimension-line" x1="${x + width}" y1="${y + height + 6}" x2="${x + width}" y2="${bottomDimensionY + 7}" opacity=".45" />
      <line class="dimension-line" x1="${x + 4}" y1="${bottomDimensionY}" x2="${x + width - 4}" y2="${bottomDimensionY}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)" />
      <rect x="${x + width / 2 - 48}" y="${bottomDimensionY - 13}" width="96" height="24" rx="6" fill="#eef2f6" />
      <text class="dimension-text" x="${x + width / 2}" y="${bottomDimensionY + 5}">${state.shape === "circle" ? "Ø " : ""}${numberFormatter.format(state.width)} мм</text>
      <line class="dimension-line" x1="${x - 6}" y1="${y}" x2="${leftDimensionX - 7}" y2="${y}" opacity=".45" />
      <line class="dimension-line" x1="${x - 6}" y1="${y + height}" x2="${leftDimensionX - 7}" y2="${y + height}" opacity=".45" />
      <line class="dimension-line" x1="${leftDimensionX}" y1="${y + 4}" x2="${leftDimensionX}" y2="${y + height - 4}" marker-start="url(#dimArrow)" marker-end="url(#dimArrow)" />
      <g transform="translate(${leftDimensionX - 1} ${y + height / 2}) rotate(-90)">
        <rect x="-48" y="-13" width="96" height="24" rx="6" fill="#eef2f6" />
        <text class="dimension-text" x="0" y="5">${numberFormatter.format(state.height)} мм</text>
      </g>
    </g>`;

  $$("#windowCanvas .pane-hit").forEach((node) => {
    const choose = () => {
      state.selectedPane = Number(node.dataset.pane);
      state.selectedField = node.dataset.field;
      state.selectedImpost = null;
      renderAll();
    };
    node.addEventListener("click", choose);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        choose();
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
  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 640,
    y: ((event.clientY - rect.top) / rect.height) * 500,
  };
}

function bindCanvasDragging() {
  const svg = $("#windowCanvas");
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
  const pane = state.panes[state.selectedPane];
  const siblings = pane.innerImposts.filter((item) => item.orientation === orientation);
  if (siblings.length >= 3) {
    showToast("В одной секции допускается до трёх импостов одного направления");
    return;
  }
  const item = {
    id: createImpostId("pane", orientation),
    orientation,
    position: largestGapPosition(siblings),
  };
  pane.innerImposts.push(item);
  state.selectedImpost = { scope: "pane", paneIndex: state.selectedPane, orientation, id: item.id };
  renderAll();
  showToast(`Импост добавлен в ${pane.opening === "fixed" ? "глухую секцию" : "створку"}`);
}

function renderInspector() {
  const pane = state.panes[state.selectedPane];
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
    positionInput.min = Math.ceil(min);
    positionInput.max = Math.floor(max);
    positionInput.value = Math.round(position);
    return;
  }

  $("#paneInspector").hidden = false;
  $("#impostInspector").hidden = true;
  $("#selectedPaneName").textContent = `№ ${state.selectedPane + 1}`;
  $("#openingType").value = pane.opening;
  const fields = getPaneFields(pane);
  const field = fields.find(item => item.key === state.selectedField) ?? fields[0];
  state.selectedField = field.key;
  $("#paneGlass").value = field.glass;
  if (fields.length > 1) $("#selectedPaneName").textContent += ` · поле ${fields.indexOf(field) + 1}`;
  const innerCount = pane.innerImposts.length;
  const paneKind = pane.opening === "fixed" ? "глухой секции" : "створке";
  $("#innerImpostHint").textContent = innerCount
    ? `В ${paneKind} установлено: ${innerCount}`
    : `Добавьте импост в ${paneKind}`;
}

function renderSummary(calculation) {
  const totalArea = calculation.area * state.quantity;
  $("#totalPrice").textContent = calculation.issues.length ? "—" : formatMoney(calculation.total);
  $("#unitPrice").textContent = calculation.issues.length ? "Исправьте размеры секций" : `${calculation.approximate ? "Предварительно: " : ""}${formatMoney(calculation.unitPrice)} за одно окно`;
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
  $("#specTotal").textContent = calculation.issues.length ? "—" : formatMoney(calculation.total);
  $("#editorDimensions").textContent = `${numberFormatter.format(state.width)} × ${numberFormatter.format(state.height)} мм`;
  $("#editorArea").textContent = `${formatNumber(calculation.area)} м²`;
}

function renderSpecification(calculation) {
  const target = $("#specificationRows");
  const notice = (text) => `<tr><td colspan="7">${text}</td></tr>`;
  if (calculation.issues.length) {
    target.innerHTML = calculation.issues.map(notice).join("");
    return;
  }
  target.innerHTML = (calculation.approximate ? notice("Предварительная смета: геометрия арки или круга рассчитана приближённо.") : "") + calculation.lines
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
  const calculation = buildSpecification();
  renderCanvas();
  renderInspector();
  renderSummary(calculation);
  renderSpecification(calculation);
  updateActiveControls();
}

function resetPaneSettings() {
  state.panes = [];
  state.selectedPane = 0;
  state.selectedField = null;
  state.selectedImpost = null;
}

function confirmGridChange() {
  if (window.confirm("При изменении разбивки настройки всех секций будут сброшены. Продолжить?")) return true;
  $("#columns").value = state.cols;
  $("#rows").value = state.rows;
  return false;
}

function setSplit(cols, rows) {
  const nextCols = clamp(cols, 1, 4);
  const nextRows = clamp(rows, 1, 3);
  if (nextCols === state.cols && nextRows === state.rows) return;
  if (!confirmGridChange()) return;
  resetPaneSettings();
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

  $("#width").addEventListener("input", (event) => {
    state.width = clamp(event.target.value, 400, 5000);
    if (state.shape === "circle") {
      state.height = state.width;
      $("#height").value = state.height;
    }
    renderAll();
  });
  $("#width").addEventListener("change", (event) => (event.target.value = state.width));

  $("#height").addEventListener("input", (event) => {
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
    state.panes = state.panes.map((pane) => ({ ...pane, glass: state.defaultGlass, fieldGlass: {} }));
    renderAll();
  });

  $("#openingType").addEventListener("change", (event) => {
    state.panes[state.selectedPane].opening = event.target.value;
    renderAll();
  });
  $("#paneGlass").addEventListener("change", (event) => {
    const pane = state.panes[state.selectedPane];
    const fields = getPaneFields(pane);
    const field = fields.find(item => item.key === state.selectedField) ?? fields[0];
    if (fields.length === 1) {
      pane.glass = event.target.value;
      pane.fieldGlass = {};
    } else {
      pane.fieldGlass ??= {};
      pane.fieldGlass[field.key] = event.target.value;
    }
    renderAll();
  });
  $("#applyGlassToAll").addEventListener("click", () => {
    const glass = $("#paneGlass").value;
    state.defaultGlass = glass;
    state.panes = state.panes.map((pane) => ({ ...pane, glass, fieldGlass: {} }));
    $("#defaultGlass").value = glass;
    renderAll();
    showToast("Стеклопакет применён ко всем секциям");
  });

  $("#addInnerVertical").addEventListener("click", () => addInnerImpost("vertical"));
  $("#addInnerHorizontal").addEventListener("click", () => addInnerImpost("horizontal"));
  $("#impostPosition").addEventListener("input", (event) => {
    const record = getSelectedImpostRecord();
    if (!record || event.target.value === "") return;
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
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
  $("#impostPosition").addEventListener("change", () => renderAll());
  $("#centerImpost").addEventListener("click", () => {
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (record.selected.scope === "root") {
      if (!confirmGridChange()) return;
      resetPaneSettings();
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
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (record.selected.scope === "root") {
      if (!confirmGridChange()) return;
      resetPaneSettings();
      const collection = record.selected.orientation === "vertical" ? state.vImposts : state.hImposts;
      const index = collection.findIndex((item) => item.id === record.item.id);
      collection.splice(index, 1);
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
    const { issues } = buildSpecification();
    if (issues.length) return showToast(issues[0]);
    window.print();
  });

  $("#newCalculation").addEventListener("click", () => {
    if (!window.confirm("Начать новый расчёт? Текущая конфигурация будет сброшена.")) return;
    state = {
      material: "pvc",
      profile: "pvc70",
      finish: "white",
      shape: "rect",
      width: 1400,
      height: 1300,
      quantity: 1,
      cols: 2,
      rows: 1,
      vImposts: [{ id: createImpostId("root", "vertical"), position: 700 }],
      hImposts: [],
      defaultGlass: "double",
      selectedPane: 0,
      selectedField: null,
      selectedImpost: null,
      panes: [
        { opening: "tiltturn", glass: "double", innerImposts: [] },
        { opening: "fixed", glass: "double", innerImposts: [] },
      ],
    };
    syncFormFromState();
    renderAll();
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
    const saved = persistRates();
    $("#pricesDialog").close();
    renderAll();
    showToast(saved ? "Новые тарифы сохранены" : "Тарифы применены, но браузер не сохранил их");
  });
  $("#resetPrices").addEventListener("click", () => {
    rates = cloneRates();
    const saved = persistRates(true);
    populatePriceForm();
    renderAll();
    showToast(saved ? "Демонстрационные тарифы восстановлены" : "Прайс сброшен только на этой странице");
  });
  $$("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
  });
  $("#saveTechnology").addEventListener("click", () => {
    readTechnologyForm();
    $("#pricesDialog").close();
    renderAll();
    showToast("Технологические размеры сохранены");
  });
  $("#resetTechnology").addEventListener("click", () => {
    technology = cloneTechnology();
    localStorage.removeItem("oknoSmetaTechnology");
    populateTechnologyForm();
    renderAll();
    showToast("Стандартные размеры профилей восстановлены");
  });

  bindCanvasDragging();
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

const TECHNOLOGY_BINDINGS = {
  pvcFrameWidth: ["pvc", "frame"],
  pvcSashWidth: ["pvc", "sash"],
  pvcImpostWidth: ["pvc", "impost"],
  aluminumFrameWidth: ["aluminum", "frame"],
  aluminumSashWidth: ["aluminum", "sash"],
  aluminumImpostWidth: ["aluminum", "impost"],
  woodFrameWidth: ["wood", "frame"],
  woodSashWidth: ["wood", "sash"],
  woodImpostWidth: ["wood", "impost"],
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

function populateTechnologyForm() {
  Object.entries(TECHNOLOGY_BINDINGS).forEach(([name, [material, part]]) => {
    $("#pricesForm").elements[name].value = technology[material][part];
  });
}

function readTechnologyForm() {
  Object.entries(TECHNOLOGY_BINDINGS).forEach(([name, [material, part]]) => {
    const input = $("#pricesForm").elements[name];
    technology[material][part] = clamp(input.value, 20, 250);
  });
  localStorage.setItem("oknoSmetaTechnology", JSON.stringify(technology));
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
        if ((input.columns !== undefined && input.columns !== state.cols) ||
            (input.rows !== undefined && input.rows !== state.rows)) {
          throw new Error("Измените разбивку в интерфейсе и подтвердите сброс настроек секций.");
        }
            if (input.material) {
              state.material = input.material;
              updateMaterialSelects(true);
            }
            if (input.shape) state.shape = input.shape;
            if (input.width) state.width = input.width;
            if (input.height) state.height = input.height;
            if (state.shape === "circle") state.height = state.width;
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
            if (calculation.issues.length) return { total: null, approximate: calculation.approximate, issues: calculation.issues };
            return {
              total: Math.round(calculation.total),
              approximate: calculation.approximate,
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
bindEvents();
renderAll();
exposeAgentTools();
