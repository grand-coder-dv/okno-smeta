import { PART_NAMES, allParts, compatibleParts, compatibleSteel } from "./profile-parts.js";
// Смета: строки спецификации и стоимость текущего изделия.
import { HANDLE_LENGTHS, HANDLE_STYLES, MATERIALS, OPENINGS, PRODUCT_TYPES, SHAPES, glassApplication, materialGlass, rates, selectedHandle, selectedHardware } from "./catalog.js";
import { customProfileArcs, overallSizeLabel } from "./drawing.js";
import { geometry, glassGeometry, sectionLayout, sectionNumber, sectionPanes } from "./geometry.js";
import { SASH_LAP, finishDescription, getFinishes, getProfile, getTechnology, singleFinishFactor, state } from "./product.js";
export function hardwareFitsSize(set, width, height) {
  return width >= set.minWidth && width <= set.maxWidth && height >= set.minHeight && height <= set.maxHeight;
}

export function sashProfileSize(sashPane) {
  const tech = getTechnology();
  const entry = sectionLayout().find((item) => item.pane === sashPane);
  if (!entry) return null;
  const shell = sashPane.split ? { ...entry, pane: { ...sashPane, innerImposts: [], split: null } } : entry;
  const box = glassGeometry(shell, tech).sashBox;
  if (!box || box[2] <= box[0] || box[3] <= box[1]) return null;
  if (state.shape === "circle") {
    const diameter = Math.max(0, state.width - 2 * (tech.frame - SASH_LAP));
    return { width: Math.round(diameter), height: Math.round(diameter) };
  }
  return { width: Math.round(box[2] - box[0]), height: Math.round(box[3] - box[1]) };
}

export function hardwareRangeProblems() {
  const set = selectedHardware();
  if (!set) return [];
  const problems = [];
  const seen = new Set();
  sectionLayout().forEach((entry, index) => {
    const pane = entry.sashOwner?.pane || entry.pane;
    if (!pane || seen.has(pane) || pane.opening === "fixed" || (pane.split && !pane.sashFill)) return;
    seen.add(pane);
    const size = sashProfileSize(pane);
    const outside = size && !hardwareFitsSize(set, size.width, size.height) ? [size] : [];
    const leafIndex = sectionLayout().findIndex((item) => !item.pane.split && (item.pane === pane || item.sashOwner?.pane === pane));
    if (outside.length) problems.push(`створка ${sectionNumber(leafIndex >= 0 ? leafIndex : index)} (${outside.map((size) => `${size.width}×${size.height}`).join(", ")} мм)`);
  });
  return problems;
}

export function buildSpecification() {
  const dimensions = geometry();
  const material = MATERIALS[state.material];
  const profile = getProfile();
  const finishes = getFinishes();
  const { base, interior, exterior } = finishes;
  const finishName = finishDescription(finishes);
  const tech = getTechnology();
  const quantity = state.quantity;
  const lines = [];
  const unpriced = new Set();

  const addLine = ({ name, note = "", characteristic, qty, unit, rate, sort = 0 }) => {
    const priced = Number.isFinite(rate) && rate >= 0;
    if (!priced) unpriced.add(name);
    const price = priced ? rate : 0;
    const total = qty * price;
    lines.push({ name, note: priced ? note : [note, "Цена не задана в каталоге"].filter(Boolean).join(" · "), characteristic, qty, unit, rate: price, total, sort });
    return total;
  };

  const frameParts = dimensions.members.filter((member) => member.role === "frame");
  const lengthNote = (parts) => {
    const shown = parts.slice(0, 12).map((member) => String(Math.round(member.lengthMm)));
    return `${shown.join(" + ")}${parts.length > 12 ? ` + ещё ${parts.length - 12}` : ""} мм`;
  };
  const partRate = role => profile.parts[role] ? profile.parts[role].price * profile.factor : null;
  const partName = (role, fallback) => {
    const part = profile.parts[role];
    return part ? fallback + " · " + part.article + " · " + part.name : fallback;
  };
  const frameRate = partRate("frame");
  const frameUnitTotal = dimensions.perimeter * frameRate;
  addLine({
    name: partName("frame", "Профиль рамы"),
    note: `${PRODUCT_TYPES[state.productType || "window"]}; наружный габарит: ${overallSizeLabel()}; ${lengthNote(frameParts)}`,
    characteristic: `${profile.name}; ${finishName}; ширина ${tech.frame} мм; ${frameParts.length} шт.`,
    qty: dimensions.perimeter * quantity,
    unit: "пог. м",
    rate: frameRate,
  });

  const profileMeters = (role) => dimensions.members.filter((member) => member.role === role);
  const addProfileMeters = (role, name, widthMm, note) => {
    const parts = profileMeters(role);
    const meters = parts.reduce((sum, member) => sum + member.lengthMm, 0) / 1000;
    if (meters <= 0.001) return 0;
    const rate = partRate(role);
    const unitTotal = meters * rate;
    addLine({
      name: partName(role, name),
      note: `${note ? `${note}; ` : ""}${lengthNote(parts)}`,
      characteristic: `${profile.name}; ${finishName}; ширина ${Math.round(widthMm)} мм; ${parts.length} шт.`,
      qty: meters * quantity,
      unit: "пог. м",
      rate,
    });
    return unitTotal;
  };
  const sashUnitTotal = addProfileMeters("sash", "Профиль створки", tech.sash, "Стойки и поперечины створки по наружному контуру");
  const impostRate = partRate("impost");
  let impostUnitTotal = 0;
  if (dimensions.impost > 0.001) {
    impostUnitTotal = dimensions.impost * impostRate;
    addLine({
      name: partName("impost", "Импост"),
      note: `Ось внутри рамы или створки; ${lengthNote(profileMeters("impost"))}`,
      characteristic: `Ширина ${tech.impost} мм; в раме: ${profileMeters("impost").filter((member) => member.scope === "root").length}; в секциях: ${dimensions.nestedCount}`,
      qty: dimensions.impost * quantity,
      unit: "пог. м",
      rate: impostRate,
    });
  }
  const shtulpUnitTotal = addProfileMeters("shtulp", "Штульп", tech.shtulp, "Профиль притвора створок");
  const extenderUnitTotal = addProfileMeters("extender", "Расширитель", tech.extender, "Добор по наружной стороне рамы");
  const connectorUnitTotal = addProfileMeters("connector", "Соединитель", tech.connector, "Стыковочный профиль по стороне рамы");
  const cornerUnitTotal = addProfileMeters("corner", "Угловой профиль", tech.corner, "Угловой соединитель на вершине рамы");

  const parts = allParts(MATERIALS);
  const type = state.productType || "window";
  const catalog = materialGlass();
  const defaultGlass = catalog[state.defaultGlass] ?? Object.values(catalog)[0];
  const compatibleBeads = compatibleParts(parts, "bead", profile.id, type);
  const beadGroups = new Map();
  const glassGroups = new Map();
  sectionPanes().forEach((pane, index) => {
    const fields = dimensions.paneGlassCounts[index];
    const glass = catalog[pane.glass] ?? defaultGlass;
    if (!fields || !glass) return;
    const group = glassGroups.get(glass) || { fields: 0, area: 0 };
    group.fields += fields;
    group.area += dimensions.paneGlazingAreas[index];
    glassGroups.set(glass, group);

    const link = glassApplication(glass, profile.id, type);
    const bead = compatibleBeads.find(part => part.id === link?.beadId) ?? profile.parts.bead;
    beadGroups.set(bead, (beadGroups.get(bead) || 0) + dimensions.paneBeadLengths[index]);
  });

  const addReinforcement = (host, title, meters) => {
    const choices = compatibleSteel(parts, host);
    const steel = choices.find(item => item.id === host.steelId) || choices[0];
    if (steel) addLine({
      name: "Армирование · " + steel.article + " · " + steel.name,
      note: title + " · " + host.article, characteristic: host.name,
      qty: meters * quantity, unit: "пог. м", rate: steel.price,
    });
  };
  for (const [role, title] of Object.entries(PART_NAMES)) {
    const meters = role === "frame" ? dimensions.perimeter : dimensions[role];
    if (!meters || role === "steel" || role === "bead") continue;
    const host = profile.parts[role];
    if (host) addReinforcement(host, title, meters);
  }
  for (const [bead, meters] of beadGroups) if (bead) addReinforcement(bead, PART_NAMES.bead, meters);

  addLine({
    name: partName("seal", "Контур уплотнения"),
    note: "Эластомерный уплотнитель",
    characteristic: `${profile.seals} контура`,
    qty: dimensions.perimeter * profile.seals * quantity,
    unit: "пог. м",
    rate: profile.parts.seal?.price,
  });

  for (const [bead, meters] of beadGroups) addLine({
    name: bead ? `Штапик · ${bead.article} · ${bead.name}` : "Штапик",
    note: "По контуру стеклопакетов",
    characteristic: `Системный, ${material.label}`,
    qty: meters * quantity,
    unit: "пог. м",
    rate: bead ? bead.price * profile.factor : null,
  });

  for (const glass of Object.values(catalog)) {
    const group = glassGroups.get(glass);
    if (!group) continue;
    addLine({
      name: `${glass.name} стеклопакет`,
      note: "Заполнение светового проёма",
      characteristic: `${glass.detail}; полей: ${group.fields}`,
      qty: group.area * quantity,
      unit: "м²",
      rate: glass.rate,
    });
  }

  const hardware = selectedHardware();
  const handleItem = selectedHandle();
  const openingGroups = sectionPanes().reduce((groups, pane) => {
    if (pane.split && !pane.sashFill) return groups;
    if (pane.opening !== "fixed") groups[pane.opening] = (groups[pane.opening] || 0) + 1;
    return groups;
  }, {});
  Object.entries(openingGroups).forEach(([openingKey, count]) => {
    const sashes = sectionPanes().filter((pane) => !(pane.split && !pane.sashFill) && pane.opening === openingKey);
    const outside = hardware ? sashes.filter((pane) => {
      const size = sashProfileSize(pane);
      return size && !hardwareFitsSize(hardware, size.width, size.height);
    }).length : 0;
    const measured = sashes.map((pane) => sashProfileSize(pane)).filter(Boolean);
    addLine({
      name: hardware
        ? `Фурнитура ${hardware.name}: ${OPENINGS[openingKey].name.toLowerCase()}`
        : `Фурнитура: ${OPENINGS[openingKey].name.toLowerCase()}`,
      note: hardware
        ? `Комплект ${hardware.name}; створка ${hardware.minWidth}–${hardware.maxWidth} × ${hardware.minHeight}–${hardware.maxHeight} мм`
        : "Комплект петель, запоров и ответных планок",
      characteristic: [
        measured.length ? `Створка ${measured.map((size) => `${size.width}×${size.height}`).join(", ")} мм` : "Комплект на створку",
        `ширина профиля ${tech.sash} мм`,
        outside ? `вне диапазона: ${outside}` : "",
      ].filter(Boolean).join("; "),
      qty: count * quantity,
      unit: "компл.",
      rate: hardware?.price,
    });
  });

  const sashCount = Object.values(openingGroups).reduce((sum, value) => sum + value, 0);
  if (sashCount) {
    addLine({
      name: handleItem ? `Ручка: ${handleItem.name}` : "Оконная ручка",
      note: handleItem ? "Ручка комплекта фурнитуры" : "Ручка с креплением",
      characteristic: handleItem
        ? `${HANDLE_STYLES[handleItem.style] || "Оконная"}, ${HANDLE_LENGTHS[handleItem.style] || 175} мм${hardware ? `; ${hardware.name}` : ""}`
        : "В цвет профиля",
      qty: sashCount * quantity,
      unit: "шт.",
      rate: handleItem?.price,
    });
  }

  addLine({
    name: partName("assembly", "Сборочный комплект"),
    note: "Соединители, крепёж, опорные и дистанционные элементы",
    characteristic: `Для системы: ${profile.name}`,
    qty: quantity,
    unit: "компл.",
    rate: profile.parts.assembly?.price,
  });

  const profileBase = frameUnitTotal + sashUnitTotal + impostUnitTotal + shtulpUnitTotal + extenderUnitTotal + connectorUnitTotal + cornerUnitTotal;
  let finishFactor = Math.max(interior.factor, exterior.factor);
  if (interior.id !== exterior.id && (interior.id === base.id || exterior.id === base.id)) {
    finishFactor = singleFinishFactor(interior.id === base.id ? exterior : interior);
  }
  const finishUnitTotal = profileBase * Math.max(0, finishFactor - 1);
  if (finishUnitTotal > 0.01) {
    addLine({
      name: "Декоративная отделка профиля",
      note: "Ламинация, окраска или анодирование",
      characteristic: finishName,
      qty: quantity,
      unit: "компл.",
      rate: finishUnitTotal,
    });
  }

  let unitSubtotal = lines.reduce((sum, line) => sum + line.total, 0) / quantity;
  const shapeRate = state.shape === "arch" && customProfileArcs() ? rates.archSurcharge : state.shape === "circle" ? rates.circleSurcharge : state.shape === "skew" ? rates.skewSurcharge : 0;
  if (shapeRate > 0) {
    const shapeUnitTotal = unitSubtotal * (shapeRate / 100);
    addLine({
      name: "Изготовление нестандартной формы",
      note: state.shape === "skew" ? "Раскрой под углом и индивидуальная сборка" : "Гибка профиля и индивидуальная сборка",
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
      note: "Настройки → Общее",
      characteristic: `${rates.markup}%`,
      qty: quantity,
      unit: "компл.",
      rate: unitSubtotal * (rates.markup / 100),
    });
  }

  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return { lines, unpriced: [...unpriced], total, unitPrice: total / quantity, sashCount, ...dimensions, material, profile, finishName };
}
