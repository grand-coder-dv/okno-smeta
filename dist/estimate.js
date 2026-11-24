// Смета: строки спецификации и стоимость текущего изделия.
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

  const openingGroups = sectionPanes().reduce((groups, pane) => {
    if (pane.split && !pane.sashFill) return groups;
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
