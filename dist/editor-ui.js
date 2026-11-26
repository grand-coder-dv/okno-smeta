// Экран редактора: инспектор, итог, кнопки и общий пересчёт.
function profileTarget(edge) {
  if (!edge) return null;
  if (edge.type === "circle-frame") return { side: "ring", vertex: null };
  if (edge.type === "frame" || edge.type === "polygon") return { side: edge.side, vertex: null };
  if (edge.type === "vertex") return { side: null, vertex: edge.side };
  return null;
}
function hasConstructionAddon(role, target) {
  return Boolean(target && (state.addons || []).some((addon) => addon.role === role && addon.side === target.side && addon.vertex === target.vertex));
}
function toggleConstructionAddon(role) {
  const edge = activeProfileEdge?.owner === state ? activeProfileEdge : null;
  const target = profileTarget(edge);
  if (!target) return;
  state.addons = state.addons || [];
  const index = state.addons.findIndex((addon) => addon.role === role && addon.side === target.side && addon.vertex === target.vertex);
  if (index >= 0) state.addons.splice(index, 1);
  else state.addons.push({ id: createImpostId("addon", role), role, side: target.side, vertex: target.vertex });
  renderAll();
}
function renderProfileInspector(edge) {
  const model = constructionModel();
  const sameIndex = (member) => (member.select?.index ?? null) === (edge.index ?? null);
  let member = model.members.find((item) => item.select && (item.role === "frame" || item.role === "sash") && item.select.type === edge.type && item.select.side === edge.side && sameIndex(item));
  if (!member && edge.type === "circle-frame") member = model.members.find((item) => item.role === "frame" && item.kind === "ring");
  if (!member && edge.type === "circle-sash") member = model.members.find((item) => item.role === "sash" && item.select?.type === "circle-sash" && sameIndex(item));
  const frames = model.members.filter((item) => item.role === "frame");
  if (!member && edge.type === "vertex") {
    const next = frames.find((item) => item.side === edge.side);
    const previous = frames.find((item) => item.side === (edge.side + frames.length - 1) % frames.length);
    const corner = model.members.find((item) => item.role === "corner" && item.vertex === edge.side);
    member = {
      roleLabel: "Рама",
      kindLabel: `Угол ${edge.side + 1}`,
      widthMm: corner?.widthMm,
      lengthMm: corner?.lengthMm,
      joints: next?.joints || previous?.joints || "—",
      shapeLabel: "Вершина контура",
    };
  }
  $("#profileInspector").hidden = false;
  $("#profileRole").textContent = member?.roleLabel || "Профиль";
  $("#profileKind").textContent = member?.kindLabel || "Сторона";
  $("#profileWidth").textContent = member?.widthMm ? `${Math.round(member.widthMm)} мм` : "—";
  $("#profileLength").textContent = Number.isFinite(member?.lengthMm) ? `${Math.round(member.lengthMm)} мм` : "—";
  $("#profileJoints").textContent = member?.joints || "—";
  $("#profileShape").textContent = member?.shapeLabel || "Прямая";
  $("#profileHint").textContent = {
    rect: "Прямое окно считается тем же контуром: длины стоек и поперечин равны габариту. Косые углы, дуги и окружность включаются формой.",
    skew: "Поднимите угол, задайте длину стороны или разбейте профиль. Косые концы импоста задаются на выбранном импосте.",
    arch: "Выберите сторону рамы или створки и включите дугу. В смете длина этой стороны — развёртка дуги.",
    circle: "Круглое окно построено по диаметру. У кольца можно добавить расширитель или соединитель.",
  }[state.shape] || "";
  const edit = $("#profileEditGeometry");
  edit.hidden = !((state.shape === "arch" && (edge.type === "frame" || edge.type === "sash")) || (state.shape === "skew" && (edge.type === "vertex" || edge.type === "polygon")));
  edit.textContent = state.shape === "arch" ? "Дуга стороны" : "Изменить геометрию";
  const sideTools = edge.type === "frame" || edge.type === "polygon" || edge.type === "circle-frame";
  const target = profileTarget(edge);
  const extender = $("#profileAddExtender");
  const connector = $("#profileAddConnector");
  const corner = $("#profileAddCorner");
  const shtulp = $("#profileAddShtulp");
  extender.hidden = !sideTools;
  connector.hidden = !sideTools;
  corner.hidden = edge.type !== "vertex";
  shtulp.hidden = edge.type !== "sash" && edge.type !== "skew-sash";
  const tech = getTechnology();
  extender.textContent = `${hasConstructionAddon("extender", target) ? "Убрать расширитель" : "Расширитель"} ${tech.extender} мм`;
  connector.textContent = `${hasConstructionAddon("connector", target) ? "Убрать соединитель" : "Соединитель"} ${tech.connector} мм`;
  corner.textContent = `${hasConstructionAddon("corner", target) ? "Убрать угловой" : "Угловой профиль"} ${tech.corner} мм`;
  shtulp.textContent = "Штульп на этой стороне";
}
function renderInspector() {
  const edge = activeProfileEdge?.owner === state ? activeProfileEdge : null;
  if (edge && !state.selectedImpost) {
    $("#paneInspector").hidden = true;
    $("#impostInspector").hidden = true;
    renderProfileInspector(edge);
    return;
  }
  $("#profileInspector").hidden = true;
  const pane = sectionPanes()[state.selectedPane];
  const record = getSelectedImpostRecord();
  if (state.selectedImpost && !record) state.selectedImpost = null;

  if (record) {
    $("#paneInspector").hidden = true;
    $("#impostInspector").hidden = false;
    const vertical = record.selected.orientation === "vertical";
    const isRoot = record.selected.scope === "root";
    const positionInput = $("#impostPosition");
    const originSelect = $("#impostPositionOrigin");
    const dimension = vertical ? state.width : state.height;
    const reverse = impostPositionOrigin[record.selected.orientation] === "end";
    originSelect.innerHTML = vertical
      ? '<option value="start">От левого края конструкции</option><option value="end">От правого края конструкции</option>'
      : '<option value="start">От верхнего края конструкции</option><option value="end">От нижнего края конструкции</option>';
    originSelect.value = reverse ? "end" : "start";
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
      const offset = vertical ? physical.x : physical.y;
      position = offset + record.item.position * size;
      min = offset + limits.min * size;
      max = offset + limits.max * size;
    }
    const nestedScope = record.pane?.opening === "fixed" ? "глухом проёме" : "створке";
    $("#selectedImpostScope").textContent = isRoot ? "Импост рамы" : `Импост в ${nestedScope} № ${record.selected.paneIndex + 1}`;
    $("#selectedImpostName").textContent = record.item.shtulp
      ? (vertical ? "Штульп, стойка" : "Штульп, поперечина")
      : (vertical ? "Вертикальный" : "Горизонтальный");
    $("#impostPositionLabel").textContent = "Расстояние от выбранного края, мм";
    if (sharedAxis) {
      const group = sharedImpostLimits(sharedAxis, record.selected.orientation);
      const first = group.members[0];
      if (first) {
        const axis = first.start + first.item.position * first.size;
        position = axis;
        min = group.min;
        max = group.max;
      }
    }
    if(reverse){
      position = dimension - position;
      [min,max] = [dimension-max,dimension-min];
    }
    positionInput.min = Math.ceil(min);
    positionInput.max = Math.floor(max);
    positionInput.value = Math.round(position);
    const endBox=$("#impostEndSizes");
    const ends=record.item.endOffsets||[0,0];
    if(endBox){
      const slanted=state.shape==="skew" && ends.some(Boolean);
      endBox.hidden=!slanted;
      if(slanted){
        const base=isRoot ? record.item.position
          : (vertical ? getPanePhysicalRect(record.selected.paneIndex).x : getPanePhysicalRect(record.selected.paneIndex).y)
            +(vertical ? getPanePhysicalRect(record.selected.paneIndex).width : getPanePhysicalRect(record.selected.paneIndex).height)*record.item.position;
        const labels=vertical ? ["Верхний конец","Нижний конец"] : ["Левый конец","Правый конец"];
        const axis=vertical ? "X" : "Y";
        [0,1].forEach(end=>{
          const value=Math.round(base+(ends[end]||0));
          const shown=reverse ? dimension-value : value;
          $(`#impostEndSize${end}`).textContent=`${labels[end]}: ${axis} = ${shown} мм`;
        });
      }
    }
    const bar = constructionModel().members.find((member) => member.impostId === record.item.id && member.scope === record.selected.scope);
    const facts = $("#impostProfileFacts");
    if (facts) facts.textContent = bar ? `${bar.roleLabel}, ${bar.kindLabel.toLowerCase()}; ширина ${Math.round(bar.widthMm)} мм; длина ${Math.round(bar.lengthMm)} мм` : "";
    const shtulpButton = $("#toggleShtulp");
    if (shtulpButton) {
      shtulpButton.textContent = record.item.shtulp ? "Сделать импостом" : "Сделать штульпом";
      shtulpButton.setAttribute("aria-pressed", String(Boolean(record.item.shtulp)));
    }
    return;
  }

  if (!pane) { $("#paneInspector").hidden = true; $("#impostInspector").hidden = true; return; }
  $("#paneInspector").hidden = false;
  $("#impostInspector").hidden = true;
  const selectedCount=selectedSections().length;
  $(".selected-pane-label span").textContent = selectedCount > 1 ? "Выбрано" : "Проём";
  $("#selectedPaneName").textContent = selectedCount > 1
    ? `${selectedCount} ${selectedCount % 10 === 1 && selectedCount % 100 !== 11 ? "проём" :
        [2,3,4].includes(selectedCount % 10) && ![12,13,14].includes(selectedCount % 100) ? "проёма" : "проёмов"}`
    : `№ ${sectionNumber(state.selectedPane)}`;
  const openingSelect = $("#openingType");
  const entry=sectionLayout()[state.selectedPane];
  const openingPane=entry.sashOwner?.pane || pane;
  const canAddSash = ["turn", "tiltturn", "tilt"].some(openingAllowed);
  openingSelect.disabled = !canAddSash;
  $$("#openingType option").forEach(option => {
    if (!OPENINGS[option.value] || option.value === "fixed") return;
    option.hidden = option.disabled = !openingAllowed(option.value);
  });
  const openingField = openingSelect.closest("label") || openingSelect;
  if (openingSelect.disabled) openingField.style.setProperty("display", "none", "important");
  else openingField.style.removeProperty("display");
  openingSelect.title = openingSelect.disabled ? "Для этой формы и профильной системы створки недоступны" : "";
  openingSelect.querySelector('[data-mixed-opening]')?.remove();
  const mixed = selectedSections().some(entry => (entry.sashOwner?.pane || entry.pane).opening !== openingPane.opening);
  if (mixed) {
    const option = new Option("Разные типы открывания", "");
    option.disabled = true;
    option.dataset.mixedOpening = "";
    openingSelect.prepend(option);
  }
  openingSelect.value = mixed ? "" : openingPane.opening;
  const canTurn = ["turn", "tiltturn", "tilt"].includes(openingPane.opening);
  $("#hingeSideField").hidden = !canTurn;
  $("#hingeSideField").style.display = canTurn ? "" : "none";
  $("#hingeSide").innerHTML = openingPane.opening === "tilt"
    ? '<option value="bottom">Снизу</option><option value="top">Сверху</option>'
    : '<option value="left">Слева · ручка справа</option><option value="right">Справа · ручка слева</option>';
  $("#hingeSide").value = openingPane.opening === "tilt"
    ? (openingPane.hingeSide === "top" ? "top" : "bottom") : (openingPane.hingeSide === "right" ? "right" : "left");
  const select = $("#paneGlass");
  select.value = pane.glass;
  let note = $("#paneGlassSize");
  if (!note) { note = document.createElement("small"); note.id = "paneGlassSize"; select.after(note); }
  const tech=getTechnology();
  const geometry=glassGeometry(entry,tech);
  const labels=geometry.fields.map(f=>glassSizeLabel({...f,...fittedGlass(entry,geometry,f,tech)}));
  note.textContent=`${state.shape !== "circle" && !customProfileArcs() && !hasSlantedImposts() ? "Размер" : "Габарит по контуру, ориентировочно"}: ${[...new Set(labels)].join("; ")}`;
  const hardwareNote = $("#paneHardwareNote");
  const hardware = selectedHardware();
  const handleItem = selectedHandle();
  if (!hardware) {
    hardwareNote.hidden = true;
    hardwareNote.textContent = "";
    hardwareNote.classList.remove("warn");
  } else if (openingPane.opening === "fixed") {
    hardwareNote.hidden = false;
    hardwareNote.classList.remove("warn");
    hardwareNote.textContent = `На изделие: ${hardware.name}${handleItem ? `, ручка ${handleItem.name}` : ""}`;
  } else {
    const size = sashProfileSize(openingPane);
    const outside = size && !hardwareFitsSize(hardware, size.width, size.height);
    hardwareNote.hidden = false;
    hardwareNote.classList.toggle("warn", Boolean(outside));
    hardwareNote.textContent = size
      ? `${hardware.name}: створка ${size.width}×${size.height} мм${outside ? ` вне диапазона ${hardware.minWidth}–${hardware.maxWidth} × ${hardware.minHeight}–${hardware.maxHeight}` : ""}${handleItem ? ` · ручка ${handleItem.name}` : ""}`
      : `${hardware.name}${handleItem ? ` · ручка ${handleItem.name}` : ""}`;
  }
  const innerCount = pane.innerImposts.length;
  const paneKind = pane.opening === "fixed" ? "глухом проёме" : "створке";
  $("#innerImpostHint").textContent = innerCount
    ? `Установлено: ${innerCount}`
    : "Добавьте вертикальный или горизонтальный";
}

function renderSummary(calculation) {
  const totalArea = calculation.area * state.quantity;
  $("#totalPrice").textContent = formatMoney(calculation.total);
  $("#unitPrice").textContent = `${formatMoney(calculation.unitPrice)} за одно окно`;
  $("#summaryArea").textContent = `${formatNumber(totalArea)} м²`;
  $("#summarySashes").textContent = `${calculation.sashCount * state.quantity}`;
  $("#summaryPanes").textContent = `${calculation.glassUnits * state.quantity}`;
  $("#summaryGlassArea").textContent = `${formatNumber(calculation.glazingArea * state.quantity)} м²`;
  $("#summaryQuantity").textContent = `${state.quantity} шт.`;
  $("#summaryMaterial").textContent = calculation.material.label;
  $("#summaryProductType").textContent = PRODUCT_TYPES[state.productType || "window"];
  $("#summaryProfile").textContent = calculation.profile.name;
  const tech = getTechnology();
  const extras = [];
  if (calculation.shtulp > 0) extras.push(`штульп ${tech.shtulp}`);
  if (calculation.extender > 0) extras.push(`расширитель ${tech.extender}`);
  if (calculation.connector > 0) extras.push(`соединитель ${tech.connector}`);
  if (calculation.corner > 0) extras.push(`угол ${tech.corner}`);
  $("#summaryTechnology").textContent = `рама ${tech.frame} · створка ${tech.sash} · импост ${tech.impost}${extras.length ? ` · ${extras.join(" · ")}` : ""} мм`;
  $("#summaryShape").textContent = SHAPES[state.shape];
  $("#summaryFinish").textContent = calculation.finish.name;
  $("#summaryHardware").textContent = selectedHardware()?.name || "Тариф прайса";
  $("#summaryHandle").textContent = selectedHandle()?.name || "Стандартная";
  $("#specTotal").textContent = formatMoney(calculation.total);
  $("#editorDimensions").textContent = overallSizeLabel();
  $("#editorArea").textContent = `${formatNumber(calculation.area)} м²`;

  const preliminary = isPreliminaryShape();
  $("#currentEstimateStatus").textContent = preliminary ? "Предварительный расчёт" : "Демонстрационный расчёт";
  $("#currentEstimateHint").textContent = preliminary
    ? "Арочные и круглые изделия требуют проверки технологии и окончательной цены."
    : "Замените тарифы на ваши в разделе «Прайс».";

  const savedItem = editingOrderItemId ? orderItems.find((item) => item.id === editingOrderItemId) : null;
  const currentRoundedTotal = Math.round(calculation.total);
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
    button.disabled = button.dataset.value === "circle" && !getProfile().allowCircleShape;
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

function renderHardwareChoices() {
  syncHardwareChoice();
  const sets = hardwareSetsForProduct();
  const setSelect = $("#hardwareSet");
  setSelect.innerHTML = sets.length
    ? sets.map((set) => `<option value="${escapeHtml(set.id)}">${escapeHtml(set.name)}</option>`).join("")
    : `<option value="">Нет фурнитуры для этой системы</option>`;
  setSelect.value = state.hardwareId || "";
  setSelect.disabled = !sets.length;
  const handles = handlesForSet(state.hardwareId);
  const handleSelect = $("#hardwareHandle");
  handleSelect.innerHTML = handles.length
    ? handles.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")
    : `<option value="">Нет ручки для этой фурнитуры</option>`;
  handleSelect.value = state.handleId || "";
  handleSelect.disabled = !handles.length;
  const note = $("#hardwareRangeNote");
  const set = selectedHardware();
  const problems = hardwareRangeProblems();
  note.classList.toggle("warn", problems.length > 0);
  if (!set) note.textContent = "Назначьте комплект этой профильной системе и типу изделия во вкладке «Фурнитура».";
  else if (problems.length) note.textContent = `Диапазон створки ${set.minWidth}–${set.maxWidth} × ${set.minHeight}–${set.maxHeight} мм. Вне диапазона: ${problems.join("; ")}.`;
  else note.textContent = `Для створки: ширина ${set.minWidth}–${set.maxWidth} мм, высота ${set.minHeight}–${set.maxHeight} мм.`;
}

function renderAll() {
  ensurePanes();
  renderHardwareChoices();
  $("#editorProductName").textContent=draftProductName;
  syncGlassChoices();
  const calculation = buildSpecification();
  renderCanvas();
  syncOverallInputs();
  refreshProfileEdit();
  renderInspector();
  for(const [id,orientation] of [["equalGlassWidth","vertical"],["equalGlassHeight","horizontal"]]){
    const button=$(`#${id}`);
    const roots=orientation==="vertical"?state.vImposts:state.hImposts;
    button.hidden=!roots.length && !sectionPanes().some(p=>p.split?.orientation===orientation);
    button.disabled=selectedSections().length<2;
  }
  renderSummary(calculation);
  renderSpecification(calculation);
  if(customProfileArcs()) {
    $("#currentEstimateStatus").textContent="Расчёт изделия с дугами";
    $("#currentEstimateHint").textContent="Площадь стеклопакетов рассчитана по контуру дуг, длина импостов — по контуру рамы. Перед изготовлением проверьте технологические размеры.";
  }
  if (circleSashesBlocked() && sectionPanes().some(p => !p.split && p.opening !== "fixed")) {
    $("#currentEstimateStatus").textContent = "Створка не разрешена текущим профилем";
    $("#currentEstimateHint").textContent = "Конфигурация сохранена в редакторе. Чтобы сохранить изделие, разрешите круглые створки в технологии, выберите совместимый профиль или подтвердите замену на глухое остекление.";
  }
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
  if (hasSectionSettings && !window.confirm("Изменение сетки сбросит створки, стеклопакеты и вложенные импосты проёмов. Продолжить?")) {
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
      normalizeUnsupportedOpenings();
      renderAll();
    });
  });

  $("#profileSystem").addEventListener("change", (event) => {
    state.profile = event.target.value;
    state.productType = "window";
    updateMaterialSelects(false, true);
    if (state.shape === "circle" && !getProfile().allowCircleShape) setWindowShapeMode("rect");
    normalizeUnsupportedOpenings();
    renderAll();
  });
  $("#productType").addEventListener("change", event => {
    state.productType = event.target.value;
    updateMaterialSelects();
    const typeDimensions = {
      window: { width: 1300, height: 1400 },
      entranceDoor: { width: 950, height: 2250 },
      balconyDoor: { width: 800, height: 2100 },
    }[state.productType];
    if (typeDimensions && state.shape === "circle") setWindowShapeMode("rect");
    if (typeDimensions) {
      state.width = typeDimensions.width;
      state.height = typeDimensions.height;
    }
    if (state.shape === "circle" && !getProfile().allowCircleShape) setWindowShapeMode("rect");
    normalizeUnsupportedOpenings();
    syncFormFromState();
    renderAll();
  });
  $("#finish").addEventListener("change", (event) => {
    state.finish = event.target.value;
    renderAll();
  });
  $("#hardwareSet").addEventListener("change", (event) => {
    state.hardwareId = event.target.value;
    syncHardwareChoice();
    renderAll();
  });
  $("#hardwareHandle").addEventListener("change", (event) => {
    state.handleId = event.target.value;
    renderAll();
  });

  const shapeOptions=$("#shapeOptions");
  if(!shapeOptions.querySelector('[data-value="skew"]')){
    const skew=document.createElement("button");
    skew.type="button";skew.dataset.value="skew";skew.setAttribute("aria-pressed","false");
    skew.innerHTML='<span class="shape-icon skew"></span>Косое';
    shapeOptions.querySelector('[data-value="arch"]')?.before(skew);
  }
  shapeOptions.addEventListener("click",event=>{
    const button=event.target.closest("button[data-value]");
    if(!button || button.dataset.value===state.shape)return;
    setWindowShapeMode(button.dataset.value);
    syncFormFromState();
    renderAll();
  });

  for(const key of ["width","height"]){
    $("#"+key).addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();event.currentTarget.blur();}});
    $("#"+key).addEventListener("change",event=>commitOverallDimension(key,event.currentTarget));
  }

  $("#quantity").addEventListener("input", (event) => {
    state.quantity = clamp(event.target.value, 1, 9999);
    renderAll();
  });
  $("#quantity").addEventListener("change", (event) => (event.target.value = state.quantity));
  $$(".stepper button").forEach((button) => {
    button.addEventListener("click", () => {
      state.quantity = clamp(state.quantity + Number(button.dataset.step), 1, 9999);
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
    if (!openingAllowed(event.target.value)) { renderInspector(); return; }
    const targets = [...new Set(selectedSections().map(entry=>entry.sashOwner?.pane || entry.pane))];
    const old = targets.map(pane => pane.opening);
    targets.forEach(pane => { pane.opening = event.target.value; });
    const issue = validateCurrentProduct();
    if (issue) {
      targets.forEach((pane, i) => { pane.opening = old[i]; });
      renderAll();
      showToast(issue);
      return;
    }
    renderAll();
  });
  $("#hingeSide").addEventListener("change", event => {
    const entry=sectionLayout()[state.selectedPane];
    const pane=entry?.sashOwner?.pane || entry?.pane;
    if (!pane || (pane.split && !pane.sashFill)) return;
    pane.hingeSide = event.target.value;
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
    showToast("Стеклопакет применён ко всем проёмам");
  });

  $("#addInnerVertical").addEventListener("click", () => addInnerImpost("vertical"));
  $("#equalGlassWidth").addEventListener("click",()=>equalizeSelectedGlass("vertical"));
  $("#equalGlassHeight").addEventListener("click",()=>equalizeSelectedGlass("horizontal"));
  $("#addInnerHorizontal").addEventListener("click", () => addInnerImpost("horizontal"));
  $("#impostPositionOrigin").addEventListener("change", event => {
    const record=getSelectedImpostRecord();
    if(!record)return;
    impostPositionOrigin[record.selected.orientation]=event.target.value;
    renderInspector();
  });
  $("#impostPosition").addEventListener("change", (event) => {
    const record = getSelectedImpostRecord();
    if (!record) return;
    if (event.target.value === "") { renderAll(); return; }
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) return;
    const vertical=record.selected.orientation==="vertical";
    const dimension=vertical?state.width:state.height;
    const absolute=impostPositionOrigin[record.selected.orientation]==="end"?dimension-value:value;
    if (sharedAxis) {
      const group = sharedImpostLimits(sharedAxis, record.selected.orientation);
      if (!group.members.length || group.min > group.max) { renderAll(); return; }
      const position = clamp(absolute, group.min, group.max);
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
      record.item.position = Math.min(Math.max(absolute, limits.min), limits.max);
    } else {
      const physical = getPanePhysicalRect(record.selected.paneIndex);
      const size = vertical ? physical.width : physical.height;
      const offset = vertical ? physical.x : physical.y;
      const limits = nestedImpostLimits(record.item, record.pane);
      record.item.position = Math.min(Math.max((absolute-offset) / size, limits.min), limits.max);
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
      if (!removeRootImpost(record.selected.orientation,record.item.id)) return;
      state.selectedPane=null;
    } else if (record.pane.split) {
      if (record.pane.children.some(child => child.split) && !window.confirm("Удалить импост и все проёмы внутри этого деления?")) return;
      const first = record.pane.children[0];
      if (!record.pane.sashFill) {
        record.pane.opening = first.opening;
        record.pane.hingeSide = first.hingeSide;
      }
      record.pane.glass = first.glass;
      delete record.pane.split;
      delete record.pane.sashFill;
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
    openReportsDialog();
  });
  $("#saveOrderItem").addEventListener("click", saveCurrentOrderItem);
  $("#renameEditorProduct").addEventListener("click",()=>{
    const entered=window.prompt("Название изделия:",draftProductName);
    if(entered===null)return;
    const name=entered.trim();
    if(!name||name.length>100)return showToast("Название должно содержать от 1 до 100 символов.");
    draftProductName=name;
    $("#editorProductName").textContent=name;
    if(editingOrderItemId){
      const item=orderItems.find(candidate=>candidate.id===editingOrderItemId);
      if(item){item.name=name;item.updatedAt=new Date().toISOString();projectDirty=true;renderOrder();renderProjectToolbar();}
    }
  });
  $("#orderItems").addEventListener("click", (event) => {
    const button = event.target.closest("[data-order-action]");
    const item = event.target.closest("[data-order-item-id]");
    if (!button || !item) return;
    if (button.dataset.orderAction === "edit") editOrderItem(item.dataset.orderItemId);
    if (button.dataset.orderAction === "rename") renameOrderItem(item.dataset.orderItemId);
    if (button.dataset.orderAction === "delete") deleteOrderItem(item.dataset.orderItemId);
  });
  $("#newProject").addEventListener("click", startNewProject);
  $("#renameCurrentOrder").addEventListener("click", renameCurrentOrder);
  $("#saveProject").addEventListener("click", requestProjectSave);
  window.addEventListener("storage", event => {
    if (event.key !== APP_DATABASE_KEY && event.key !== null) return;
    const fresh = readRawAppDatabase();
    if (fresh) appDatabase = fresh;
    projects = readStoredProjects();
    renderProjectsList();
  });
  $("#myProjects").addEventListener("click", () => {
    projects = readStoredProjects();
    renderProjectsList();
    $("#projectsDialog").showModal();
  });
  $("#projectNameForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#projectNameInput").value.trim();
    if (!name) {
      $("#projectNameError").textContent = "Введите название заказа";
      $("#projectNameError").hidden = false;
      return;
    }
    if (await saveProjectRecord(name)) $("#projectNameDialog").close();
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
    if (button.dataset.projectAction === "rename") renameStoredOrder(card.dataset.projectId);
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
    hardwareDraft = cloneData(hardwareCatalog);
    $("#hardwareCatalogEditor").removeAttribute("data-ready");
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
      programStorageRemove(RATES_STORAGE_KEY);
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
  $("#hardwareCatalogEditor").addEventListener("click", handleHardwareAction);
  const refreshHandlePreview = (event) => {
    const card = event.target.closest("[data-handle-id]");
    if (!card || !event.target.matches("[data-handle-style], [data-handle-color]")) return;
    card.querySelector("[data-handle-preview]").innerHTML = handlePreviewMarkup(
      card.querySelector("[data-handle-style]").value,
      card.querySelector("[data-handle-color]").value,
    );
  };
  $("#hardwareCatalogEditor").addEventListener("input", refreshHandlePreview);
  $("#hardwareCatalogEditor").addEventListener("change", refreshHandlePreview);
  $("#saveHardware").addEventListener("click", saveHardwareCatalog);
  $("#resetHardware").addEventListener("click", () => {
    hardwareDraft = defaultHardwareCatalog();
    renderHardwareCatalog();
    showToast("Стандартная фурнитура подготовлена — нажмите «Сохранить фурнитуру»");
  });
  $("#profileSettingsEditor").addEventListener("change", event => {
    if (!event.target.matches("[data-type-enabled]")) return;
    event.target.closest("[data-product-type]").querySelector(".profile-type-fields").hidden = !event.target.checked;
  });
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
  ["#saveTechnology", "#saveProfileSettings"].forEach(selector => $(selector).addEventListener("click", () => {
    captureGlassDraft();
    readCatalogDraftFromEditor();
    for (const [material, catalog] of Object.entries(catalogDraft)) {
      if (!catalog.profiles.some(profile => profileTypeSettings(profile, "window").enabled))
        return showToast(`${MATERIALS[material].label}: включите тип «Окно» хотя бы для одной системы`);
    }
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
    try { programStorageSet(glassCatalogKey, JSON.stringify(glassDraft)); }
    catch { return showToast("Не удалось сохранить каталог стеклопакетов"); }
    glassCatalog = structuredClone(glassDraft);
    readTechnologyForm();
    $("#pricesDialog").close();
    renderAll();
    showToast("Каталог профильных систем сохранён");
  }));
  $("#resetTechnology").addEventListener("click", () => {
    catalogDraft = cloneMaterials();
    glassDraft = standardGlassCatalog();
    catalogMaterial = state.material;
    renderTechnologyCatalog();
    renderGlassCatalog();
    showToast("Стандартный каталог подготовлен — нажмите «Сохранить каталог»");
  });

  bindCanvasDragging();
  bindCanvasZoom();
  $("#profileEditGeometry").addEventListener("click", () => {
    const edge = activeProfileEdge?.owner === state ? activeProfileEdge : null;
    if (!edge) return;
    if (edge.type === "vertex" || edge.type === "polygon") editPolygon(edge);
    else editProfileSide({ dataset: { profileEdge: edge.type, edgeIndex: edge.index ?? "", edgeSide: edge.side } });
  });
  $("#profileAddExtender").addEventListener("click", () => toggleConstructionAddon("extender"));
  $("#profileAddConnector").addEventListener("click", () => toggleConstructionAddon("connector"));
  $("#profileAddCorner").addEventListener("click", () => toggleConstructionAddon("corner"));
  $("#profileAddShtulp").addEventListener("click", () => {
    const edge = activeProfileEdge?.owner === state ? activeProfileEdge : null;
    if (!edge || edge.type === "skew-sash") {
      showToast("На косом контуре штульп включается на выбранном импосте.");
      return;
    }
    const entry = sectionLayout()[edge.index];
    const item = entry && adjacentBar(entry, [2, 1, 3, 0][edge.side]);
    if (!item) {
      showToast("Штульп ставится на импост между створками, а не на сторону рамы.");
      return;
    }
    item.shtulp = !item.shtulp;
    renderAll();
  });
  $("#toggleShtulp").addEventListener("click", () => {
    const record = getSelectedImpostRecord();
    if (!record) return;
    record.item.shtulp = !record.item.shtulp;
    renderAll();
  });
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
  syncOverallInputs(true);
  $("#quantity").value = state.quantity;
  $("#columns").value = state.cols;
  $("#rows").value = state.rows;
  $("#defaultGlass").value = state.defaultGlass;
}
