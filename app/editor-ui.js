// Экран редактора: инспектор, итог, кнопки и общий пересчёт.
import { bindCanvasDragging, bindCanvasNavigation, equalizeSelectedGlass } from "./canvas-input.js";
import { renderCanvas } from "./canvas.js";
import { APP_DATABASE_KEY, MATERIALS, OPENINGS, PRODUCT_TYPES, SHAPES, appDatabase, cloneData, defaultHardwareCatalog, handlesForSet, hardwareCatalog, hardwareDraft, hardwareSetsForProduct, persistRates, profileTypeSettings, standardMaterials, readRawAppDatabase, readStoredProjects, selectedHandle, selectedHardware, setAppDatabase, setHardwareDraft, syncGlassChoices, syncHardwareChoice } from "./catalog.js";
import { activeProfileEdge, commitOverallDimension, customProfileArcs, editPolygon, editProfileSide, fittedGlass, handlePreviewMarkup, hasSlantedImposts, overallSizeLabel, refreshProfileEdit, sharedImpostLimits, syncOverallInputs } from "./drawing.js";
import { buildSpecification, hardwareFitsSize, hardwareRangeProblems, sashProfileSize } from "./estimate.js";
import { adjacentBar, circleSashesBlocked, constructionModel, createImpostId, ensurePanes, getPanePhysicalRect, getSelectedImpostRecord, glassGeometry, glassSizeLabel, makeEvenImposts, nestedImpostLimits, removeRootImpost, rootImpostLimits, sectionLayout, sectionNumber, sectionPanes, updateMaterialSelects } from "./geometry.js";
import { bindGlassSettings, populateGlassSettings } from "./glass-settings.js";
import { deleteOrderItem, deleteProject, editNameInPlace, editOrderItem, hasUnsavedProjectWork, openProject, renameCurrentOrder, renameOrderItem, renameStoredOrder, renderOrder, renderProjectToolbar, renderProjectsList, requestProjectSave, saveCurrentOrderItem, startNewProject } from "./order.js";
import { $, $$, applyPaneChanges, catalogDraft, clamp, defaultViewSide, draftProductName, editingOrderItemId, escapeHtml, formatMoney, formatNumber, getProfile, getTechnology, impostPositionOrigin, isPreliminaryShape, multiSections, normalizeUnsupportedOpenings, openingAllowed, orderItems, projectDirty, projects, resetCurrentProduct, sectionOpeningPanes, selectedSections, setCatalogDraft, setCatalogMaterial, setDraftProductName, setProjectDirty, setProjects, setSharedAxis, setWindowShapeMode, sharedAxis, state, validateCurrentProduct } from "./product.js";
import { openReportsDialog } from "./reports.js";
import { handleCatalogAction, handleHardwareAction, populateCoefficientForm, populateTechnologyForm, readCatalogDraftFromEditor, readCoefficientForm, readTechnologyForm, resetCoefficientForm, renderHardwareCatalog, renderTechnologyCatalog, saveHardwareCatalog, setSettingsTab } from "./settings.js";
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
  select.value = select.disabled ? "" : pane.glass;
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
  $("#summaryFinish").textContent = calculation.finishName;
  $("#summaryHardware").textContent = selectedHardware()?.name || "Комплект не назначен";
  $("#summaryHandle").textContent = selectedHandle()?.name || "Ручка не назначена";
  $("#editorDimensions").textContent = overallSizeLabel();
  $("#editorArea").textContent = `${formatNumber(calculation.area)} м²`;

  const preliminary = isPreliminaryShape();
  $("#currentEstimateNote").hidden = !preliminary;
  $("#currentEstimateStatus").textContent = preliminary ? "Предварительный расчёт" : "";
  $("#currentEstimateHint").textContent = preliminary
    ? "Арочные и круглые изделия требуют проверки технологии и окончательной цены."
    : "";

  const savedItem = editingOrderItemId ? orderItems.find((item) => item.id === editingOrderItemId) : null;
  const currentRoundedTotal = Math.round(calculation.total);
  const priceChanged = savedItem && savedItem.total !== currentRoundedTotal;
  $("#savedPriceComparison").hidden = !priceChanged;
  if (priceChanged) {
    $("#savedItemPrice").textContent = formatMoney(savedItem.total);
    $("#currentItemPrice").textContent = formatMoney(currentRoundedTotal);
  }
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

const afterRenderHooks = [];
export function onAfterRender(hook) { afterRenderHooks.push(hook); }

function syncCanvasViewSide() {
  const menu = $("#canvasViewSide");
  if (!menu) return;
  const value = state.viewSide === "exterior" ? "exterior" : "interior";
  if (menu.matches("select")) {
    menu.value = value;
    return;
  }
  const labels = { interior: "Вид из помещения", exterior: "Вид с улицы" };
  const viewButton = menu.querySelector("button");
  if (!viewButton) return;
  viewButton.textContent = labels[value];
  menu.querySelectorAll("[role='option']").forEach((option) => {
    option.setAttribute("aria-selected", String(option.dataset.value === value));
  });
}

export function renderAll() {
  ensurePanes();
  renderHardwareChoices();
  const productName = $("#editorProductName");
  if (!productName.querySelector("input")) productName.textContent = draftProductName;
  syncGlassChoices();
  const calculation = buildSpecification();
  syncCanvasViewSide();
  renderCanvas();
  syncOverallInputs();
  refreshProfileEdit();
  renderInspector();
  const glassPick = selectedSections();
  const glassOverlap = (a, b, axis) => {
    const start = axis === "x" ? a.rect.x : a.rect.y;
    const end = start + (axis === "x" ? a.rect.width : a.rect.height);
    const other = axis === "x" ? b.rect.x : b.rect.y;
    const otherEnd = other + (axis === "x" ? b.rect.width : b.rect.height);
    return Math.min(end, otherEnd) - Math.max(start, other) > 8;
  };
  for(const [id,orientation] of [["equalGlassWidth","vertical"],["equalGlassHeight","horizontal"]]){
    const button=$(`#${id}`);
    const roots=orientation==="vertical"?state.vImposts:state.hImposts;
    const cross=orientation==="vertical"?"y":"x";
    const aligned=glassPick.length>=2 && glassPick.some((a,i)=>glassPick.slice(i+1).some(b=>glassOverlap(a,b,cross)));
    button.hidden=glassPick.length<2 || !aligned || (!roots.length && !sectionPanes().some(p=>p.split?.orientation===orientation));
    button.disabled=button.hidden;
  }
  const deleteButton=$("#canvasDelete");
  if (deleteButton) {
    const impost=getSelectedImpostRecord();
    const sashes=[...new Set(selectedSections().map(entry=>entry.sashOwner?.pane || entry.pane))]
      .filter(pane=>pane && !(pane.split && !pane.sashFill) && pane.opening!=="fixed");
    const label=impost?"Удалить импост":"Удалить створку";
    deleteButton.hidden=!impost && !sashes.length;
    deleteButton.title=label;
    deleteButton.setAttribute("aria-label", label);
  }
  renderSummary(calculation);
  if(customProfileArcs()) {
    $("#currentEstimateNote").hidden = false;
    $("#currentEstimateStatus").textContent="Расчёт изделия с дугами";
    $("#currentEstimateHint").textContent="Площадь стеклопакетов рассчитана по контуру дуг, длина импостов — по контуру рамы. Перед изготовлением проверьте технологические размеры.";
  }
  if (circleSashesBlocked() && sectionPanes().some(p => !p.split && p.opening !== "fixed")) {
    $("#currentEstimateNote").hidden = false;
    $("#currentEstimateStatus").textContent = "Створка не разрешена текущим профилем";
    $("#currentEstimateHint").textContent = "Конфигурация сохранена в редакторе. Чтобы сохранить изделие, разрешите круглые створки в технологии, выберите совместимый профиль или подтвердите замену на глухое остекление.";
  }
  if (calculation.unpriced.length) {
    $("#currentEstimateNote").hidden = false;
    $("#currentEstimateStatus").textContent = "Расчёт неполный";
    $("#currentEstimateHint").textContent = `Назначьте позиции в каталогах: ${calculation.unpriced.join(", ")}.`;
  }
  if ($("#defaultGlass").disabled) {
    $("#currentEstimateNote").hidden = false;
    $("#currentEstimateStatus").textContent = "Нет совместимых стеклопакетов";
    $("#currentEstimateHint").textContent = "Назначьте стеклопакет профильной системе и типу изделия во вкладке «Стеклопакеты».";
    $("#totalPrice").textContent = "—";
    $("#unitPrice").textContent = "Расчёт недоступен";
  }
  updateActiveControls();
  renderProjectToolbar();
  for (const hook of afterRenderHooks) hook();
}

function setSplit(cols, rows) {
  multiSections.clear();
  setSharedAxis(null);
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

export function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2300);
}

export function bindEvents() {
  $$('input[name="material"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.partChoices = {};
      state.material = input.value;
      updateMaterialSelects(true);
      normalizeUnsupportedOpenings();
      renderAll();
    });
  });

  $("#profileSystem").addEventListener("change", (event) => {
    state.partChoices = {};
    state.profile = event.target.value;
    state.productType = "window";
    state.viewSide = defaultViewSide(state.productType);
    updateMaterialSelects(false, true);
    if (state.shape === "circle" && !getProfile().allowCircleShape) setWindowShapeMode("rect");
    normalizeUnsupportedOpenings();
    renderAll();
  });
  $("#productType").addEventListener("change", event => {
    state.partChoices = {};
    state.productType = event.target.value;
    state.viewSide = defaultViewSide(state.productType);
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
  for (const field of ["finish", "exteriorFinish"]) {
    $("#" + field).addEventListener("change", event => {
      state[field] = event.target.value;
      renderAll();
    });
  }
  const viewMenu = $("#canvasViewSide");
  const viewButton = viewMenu.querySelector("button");
  const viewList = viewMenu.querySelector("[role='listbox']");
  const closeViewList = () => {
    viewList.hidden = true;
    viewButton.setAttribute("aria-expanded", "false");
  };
  viewButton.addEventListener("click", () => {
    const open = viewList.hidden;
    viewList.hidden = !open;
    viewButton.setAttribute("aria-expanded", String(open));
    if (open) viewList.querySelector("[aria-selected='true']")?.focus();
  });
  viewList.addEventListener("click", (event) => {
    const option = event.target.closest("[role='option']");
    if (!option) return;
    state.viewSide = option.dataset.value === "exterior" ? "exterior" : "interior";
    closeViewList();
    renderAll();
  });
  viewMenu.addEventListener("keydown", (event) => {
    const options = [...viewList.querySelectorAll("[role='option']")];
    if (event.key === "Escape") {
      closeViewList();
      viewButton.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (viewList.hidden) {
      viewList.hidden = false;
      viewButton.setAttribute("aria-expanded", "true");
    }
    const current = options.indexOf(document.activeElement);
    const start = current < 0 ? (event.key === "ArrowDown" ? -1 : 0) : current;
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(start + step + options.length) % options.length].focus();
  });
  document.addEventListener("click", (event) => {
    if (!viewMenu.contains(event.target)) closeViewList();
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
    const opening = event.target.value;
    if (!openingAllowed(opening)) { renderInspector(); return; }
    const changes = sectionOpeningPanes().map(pane => ({pane, values:{opening}}));
    const issue = applyPaneChanges(changes);
    renderAll();
    if (issue) showToast(issue);
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

  $("#equalGlassWidth").addEventListener("click",()=>equalizeSelectedGlass("vertical"));
  $("#equalGlassHeight").addEventListener("click",()=>equalizeSelectedGlass("horizontal"));
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
    setSharedAxis(null);
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
  $("#canvasDelete").addEventListener("click", () => {
    if (getSelectedImpostRecord()) { $("#removeImpost").click(); return; }
    const sashes=[...new Set(selectedSections().map(entry=>entry.sashOwner?.pane || entry.pane))]
      .filter(pane=>pane && !(pane.split && !pane.sashFill) && pane.opening!=="fixed");
    if (!sashes.length) return;
    sashes.forEach(pane => { pane.opening = "fixed"; });
    renderAll();
    showToast(sashes.length === 1 ? "Створка удалена" : `Створок удалено: ${sashes.length}`);
  });
  $("#removeImpost").addEventListener("click", () => {
    setSharedAxis(null);
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

  $("#printEstimate").addEventListener("click", () => {
    openReportsDialog();
  });
  $("#saveOrderItem").addEventListener("click", saveCurrentOrderItem);
  const renameDraftProduct = () => {
    editNameInPlace($("#editorProductName"), {
      value: draftProductName,
      maxLength: 100,
      label: "Название изделия",
      invalidMessage: "Название должно содержать от 1 до 100 символов.",
      commit(name) {
        setDraftProductName(name);
        $("#editorProductName").textContent = name;
        if (editingOrderItemId) {
          const item = orderItems.find(candidate => candidate.id === editingOrderItemId);
          if (item) {
            item.name = name;
            item.updatedAt = new Date().toISOString();
            setProjectDirty(true);
            renderOrder();
            renderProjectToolbar();
          }
        }
      },
    });
  };
  $("#renameEditorProduct").addEventListener("click", renameDraftProduct);
  $("#editorProductName").addEventListener("click", (event) => {
    if (!event.target.closest("input")) renameDraftProduct();
  });
  $("#orderItems").addEventListener("click", (event) => {
    const item = event.target.closest("[data-order-item-id]");
    if (!item || event.target.closest("input")) return;
    const title = event.target.closest(".order-item-heading strong");
    if (title) {
      renameOrderItem(item.dataset.orderItemId);
      return;
    }
    const button = event.target.closest("[data-order-action]");
    if (!button) return;
    if (button.dataset.orderAction === "edit") editOrderItem(item.dataset.orderItemId);
    if (button.dataset.orderAction === "rename") renameOrderItem(item.dataset.orderItemId);
    if (button.dataset.orderAction === "delete") deleteOrderItem(item.dataset.orderItemId);
  });
  $("#newProject").addEventListener("click", startNewProject);
  $("#renameCurrentOrder").addEventListener("click", renameCurrentOrder);
  $("#currentProjectName").addEventListener("click", (event) => {
    if (!event.target.closest("input")) renameCurrentOrder();
  });
  $("#saveProject").addEventListener("click", requestProjectSave);
  window.addEventListener("storage", event => {
    if (event.key !== APP_DATABASE_KEY && event.key !== null) return;
    const fresh = readRawAppDatabase();
    if (fresh) setAppDatabase(fresh);
    setProjects(readStoredProjects());
    renderProjectsList();
  });
  $("#myProjects").addEventListener("click", () => {
    setProjects(readStoredProjects());
    renderProjectsList();
    $("#projectsDialog").showModal();
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
  $("#projectsDialog").addEventListener("click", (event) => {
    if (event.target === $("#projectsDialog")) $("#projectsDialog").close();
  });

  $("#newCalculation").addEventListener("click", () => {
    const message = editingOrderItemId
      ? "Отменить редактирование позиции? Несохранённые изменения текущего изделия будут потеряны."
      : "Начать настройку нового изделия? Текущая конфигурация будет сброшена, список заказа сохранится.";
    if (!window.confirm(message)) return;
    resetCurrentProduct(null, null, { preferDraft: true });
    showToast("Создан новый расчёт");
  });

  $("#openPrices").addEventListener("click", () => {
    populateCoefficientForm();
    populateTechnologyForm();
    populateGlassSettings();
    setHardwareDraft(cloneData(hardwareCatalog));
    $("#hardwareCatalogEditor").removeAttribute("data-ready");
    setSettingsTab("general");
    $("#pricesDialog").showModal();
  });
  $("#pricesDialog").addEventListener("click", (event) => {
    if (event.target === $("#pricesDialog")) $("#pricesDialog").close();
  });
  $("#savePrices").addEventListener("click", () => {
    readCoefficientForm();
    if (!persistRates()) {
      showToast("Не удалось сохранить коэффициенты в браузере");
      return;
    }
    $("#pricesDialog").close();
    renderAll();
    showToast("Коэффициенты сохранены");
  });
  $("#resetPrices").addEventListener("click", resetCoefficientForm);
  $$("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
  });
  $$("[data-catalog-material]").forEach((button) => {
    button.addEventListener("click", () => {
      readCatalogDraftFromEditor();
      setCatalogMaterial(button.dataset.catalogMaterial);
      renderTechnologyCatalog();
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
    setHardwareDraft(defaultHardwareCatalog());
    renderHardwareCatalog();
    showToast("Стандартная фурнитура подготовлена — нажмите «Сохранить фурнитуру»");
  });
  $("#technologyCatalogEditor").addEventListener("change", event => {
    if (!event.target.matches("[data-type-enabled]")) return;
    event.target.closest("[data-product-type]").querySelector(".profile-type-fields").hidden = !event.target.checked;
  });
  $("#technologyCatalogEditor").addEventListener("input", event => {
    const input = event.target.closest('[data-profile-field="name"]');
    if (!input) return;
    const id = input.closest("[data-profile-id]").dataset.profileId;
    const option = [...$("#settingsSystemChoice").options].find(item => item.value === id);
    if (option) option.textContent = input.value.trim() || "Новая профильная система";
  });
  bindGlassSettings();
  ["#saveTechnology", "#saveMaterials"].forEach(selector => $(selector).addEventListener("click", () => {
    readCatalogDraftFromEditor();
    for (const [material, catalog] of Object.entries(catalogDraft)) {
      if (!catalog.profiles.some(profile => profileTypeSettings(profile, "window").enabled))
        return showToast(`${MATERIALS[material].label}: включите тип «Окно» хотя бы для одной системы`);
    }
    readTechnologyForm();
    $("#pricesDialog").close();
    renderAll();
    showToast("Каталог профильных систем сохранён");
  }));
  $("#resetTechnology").addEventListener("click", () => {
    setCatalogDraft(standardMaterials());
    setCatalogMaterial(state.material);
    renderTechnologyCatalog();
    showToast("Стандартный каталог подготовлен — нажмите «Сохранить каталог»");
  });

  bindCanvasDragging();
  bindCanvasNavigation();
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

export function syncFormFromState() {
  $$('input[name="material"]').forEach((input) => (input.checked = input.value === state.material));
  updateMaterialSelects();
  syncOverallInputs(true);
  $("#quantity").value = state.quantity;
  $("#columns").value = state.cols;
  $("#rows").value = state.rows;
  $("#defaultGlass").value = state.defaultGlass;
}
