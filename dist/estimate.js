// Смета: строки спецификации и стоимость текущего изделия.
function hardwareFitsSize(set, width, height) {
  return width >= set.minWidth && width <= set.maxWidth && height >= set.minHeight && height <= set.maxHeight;
}

function sashGlassSizes(sashPane) {
  const tech = getTechnology();
  const leaves = [];
  sectionLayout().forEach((entry) => {
    if (entry.pane.split) return;
    if (entry.pane === sashPane || entry.sashOwner?.pane === sashPane) leaves.push(entry);
  });
  const own = leaves.filter((entry) => entry.pane === sashPane);
  const sizes = [];
  (own.length ? own : leaves).forEach((entry) => {
    const geo = glassGeometry(entry, tech);
    geo.fields.forEach((field) => {
      if (!(field.clearW > 1e-6 && field.clearH > 1e-6 && field.w > 0 && field.h > 0)) return;
      let width = field.w;
      let height = field.h;
      if (state.shape === "circle" || state.shape === "skew" || hasSlantedImposts() || customProfileArcs()) {
        const fitted = fittedGlass(entry, geo, field, tech);
        if (fitted?.w > 0 && fitted?.h > 0) {
          width = fitted.w;
          height = fitted.h;
        }
      }
      sizes.push({ width: Math.round(width), height: Math.round(height) });
    });
  });
  return sizes;
}

function hardwareRangeProblems() {
  const set = selectedHardware();
  if (!set) return [];
  const problems = [];
  const seen = new Set();
  sectionLayout().forEach((entry, index) => {
    const pane = entry.sashOwner?.pane || entry.pane;
    if (!pane || seen.has(pane) || pane.opening === "fixed" || (pane.split && !pane.sashFill)) return;
    seen.add(pane);
    const outside = sashGlassSizes(pane).filter((size) => !hardwareFitsSize(set, size.width, size.height));
    const leafIndex = sectionLayout().findIndex((item) => !item.pane.split && (item.pane === pane || item.sashOwner?.pane === pane));
    if (outside.length) problems.push(`створка ${sectionNumber(leafIndex >= 0 ? leafIndex : index)} (${outside.map((size) => `${size.width}×${size.height}`).join(", ")} мм)`);
  });
  return problems;
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
    note: `${PRODUCT_TYPES[state.productType || "window"]}; наружный габарит: ${overallSizeLabel()}`,
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
    group.fields += dimensions.paneGlassCounts[index] || 0;
    group.area += dimensions.paneGlazingAreas[index] || 0;
    if (group.fields) groups[pane.glass] = group;
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

  const hardware = selectedHardware();
  const handleItem = selectedHandle();
  const openingGroups = sectionPanes().reduce((groups, pane) => {
    if (pane.split && !pane.sashFill) return groups;
    if (pane.opening !== "fixed") groups[pane.opening] = (groups[pane.opening] || 0) + 1;
    return groups;
  }, {});
  Object.entries(openingGroups).forEach(([openingKey, count]) => {
    const outside = hardware
      ? sectionPanes().filter((pane) => !(pane.split && !pane.sashFill) && pane.opening === openingKey
        && sashGlassSizes(pane).some((size) => !hardwareFitsSize(hardware, size.width, size.height))).length
      : 0;
    addLine({
      name: hardware
        ? `Фурнитура ${hardware.name}: ${OPENINGS[openingKey].name.toLowerCase()}`
        : `Фурнитура: ${OPENINGS[openingKey].name.toLowerCase()}`,
      note: hardware
        ? `Комплект ${hardware.name}; стеклопакет створки ${hardware.minWidth}–${hardware.maxWidth} × ${hardware.minHeight}–${hardware.maxHeight} мм`
        : "Комплект петель, запоров и ответных планок",
      characteristic: [
        `Комплект на створку; ширина профиля ${tech.sash} мм`,
        outside ? `вне диапазона: ${outside}` : "",
      ].filter(Boolean).join("; "),
      qty: count * quantity,
      unit: "компл.",
      rate: hardware ? hardware.price : rates.hardware[openingKey],
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
      rate: handleItem ? handleItem.price : rates.handle,
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
