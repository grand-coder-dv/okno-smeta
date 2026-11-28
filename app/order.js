// Заказ: список изделий, сохранение проектов и их список.
import { renderCanvas } from "./canvas.js";
import { MATERIALS, PRODUCT_TYPES, SHAPES, changeStoredProjects, cloneData, readStoredProjects } from "./catalog.js";
import { overallSizeLabel } from "./drawing.js";
import { showToast } from "./editor-ui.js";
import { buildSpecification } from "./estimate.js";
import { circleSashesBlocked, ensurePanes, sectionPanes } from "./geometry.js";
import { $, activeProjectId, activeProjectName, activeProjectSnapshot, canvasLayout, createOrderItemId, currentProductIsDirty, draftProductName, editingOrderItemId, escapeHtml, finishDescription, formatMoney, formatNumber, getFinishes, isPreliminaryShape, orderItemSequence, orderItems, pluralizeRu, projectDirty, projectWritePending, projects, replaceState, resetCurrentProduct, restoreProductState, setActiveProjectId, setActiveProjectName, setActiveProjectSnapshot, setCanvasLayout, setConfigurationError, setDraftProductName, setEditingOrderItemId, setOrderItemSequence, setOrderItems, setProjectDirty, setProjects, snapshotCurrentState, state, validateCurrentProduct } from "./product.js";
export function orderItemSketch(config, detailed = false) {
  // Draw the saved configuration with the same renderer as the large editor.
  const previousState = state;
  const previousLayout = canvasLayout;
  const preview = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    replaceState(config);
    renderCanvas({ svg: preview, thumbnail: !detailed });
    if (detailed) preview.querySelectorAll(".pane-hit, .pane-selected, .impost-hit, .impost-grip, .impost-endpoint, [data-profile-edge], [data-profile-length]").forEach(node => node.remove());
    const prefix = `order-preview-${Math.random().toString(36).slice(2)}-`;
    preview.innerHTML = preview.innerHTML
      .replace(/(\s)id="([^"]+)"/g, (_, space, id) => `${space}id="${prefix}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
    preview.classList.add("order-sketch");
    preview.setAttribute("role", "img");
    preview.setAttribute("aria-label", "Эскиз изделия");
    return preview.outerHTML;
  } finally {
    replaceState(previousState);
    setCanvasLayout(previousLayout);
  }
}

export function renderOrder() {
  const container = $("#orderItems");
  $("#orderEmpty").hidden = orderItems.length > 0;
  container.innerHTML = orderItems
    .map((item, index) => {
      const material = MATERIALS[item.configuration.material];
      const shape = SHAPES[item.configuration.shape] || item.configuration.shape;
      const dimensions = overallSizeLabel(item.configuration);
      return `
        <article class="order-item${item.id === editingOrderItemId ? " editing" : ""}" data-order-item-id="${escapeHtml(item.id)}">
          <div class="order-item-preview">${orderItemSketch(item.configuration)}</div>
          <div class="order-item-title">
            <div class="order-item-heading">
              <strong>${escapeHtml(item.name || `Изделие ${index + 1}`)}</strong>
              <button type="button" class="order-rename" data-order-action="rename" aria-label="Переименовать ${escapeHtml(item.name || `Изделие ${index + 1}`)}" title="Переименовать">✎</button>
              ${item.preliminary ? '<span class="preliminary-badge">Предварительно</span>' : ""}
              ${item.id === editingOrderItemId ? '<span class="editing-badge">Редактируется</span>' : ""}
            </div>
            <small>${escapeHtml(PRODUCT_TYPES[item.configuration.productType || "window"] || "Окно")} · ${escapeHtml(material?.label || item.configuration.material)} · ${escapeHtml(shape)} · ${dimensions}<br>${item.quantity} шт. · ${formatMoney(item.unitPrice)} за шт.</small>
          </div>
          <div class="order-item-price">
            <span>Сумма позиции</span>
            <b>${formatMoney(item.total)}</b>
          </div>
          <div class="order-item-actions">
            <button class="button secondary" type="button" data-order-action="edit">Редактировать</button>
            <button class="button danger" type="button" data-order-action="delete">Удалить</button>
          </div>
        </article>`;
    })
    .join("");

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);
  const preliminary = orderItems.some((item) => item.preliminary);
  $("#orderPositionCount").textContent = `${orderItems.length} ${pluralizeRu(orderItems.length, "позиция", "позиции", "позиций")}`;
  $("#orderTotalPositions").textContent = orderItems.length;
  $("#orderTotalQuantity").textContent = totalQuantity;
  $("#orderTotalPrice").textContent = formatMoney(totalPrice);
  $("#orderTotalLabel").textContent = preliminary ? "Предварительная сумма заказа" : "Сумма заказа";
  const saveButton = $("#saveOrderItem");
  saveButton.title = editingOrderItemId ? "Сохранить изменения и добавить следующее" : "Сохранить изделие и добавить следующее";
  saveButton.setAttribute("aria-label", saveButton.title);
}

function renderPrintOrder() {
  const printOrder = $("#printOrder");
  const hasOrder = orderItems.length > 0;
  document.body.classList.toggle("printing-order", hasOrder);
  if (!hasOrder) {
    printOrder.innerHTML = "";
    return;
  }

  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = orderItems.reduce((sum, item) => sum + item.total, 0);
  const preliminary = orderItems.some((item) => item.preliminary);
  const printedAt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  const positionsMarkup = orderItems
    .map((item, itemIndex) => {
      const configuration = item.configuration;
      const material = MATERIALS[configuration.material];
      const profile = material?.profiles.find((candidate) => candidate.id === configuration.profile);
      const finish = finishDescription(getFinishes(configuration));
      const presentation = item.presentation || {};
      const dimensions = overallSizeLabel(configuration);
      const specificationRows = (item.specification || [])
        .map(
          (line, lineIndex) => `
            <tr>
              <td>${lineIndex + 1}</td>
              <td><b>${escapeHtml(line.name)}</b>${line.note ? `<small>${escapeHtml(line.note)}</small>` : ""}</td>
              <td>${escapeHtml(line.characteristic)}</td>
              <td>${line.unit === "шт." || line.unit === "компл." ? Math.round(line.qty) : formatNumber(line.qty)}</td>
              <td>${escapeHtml(line.unit)}</td>
              <td>${formatMoney(line.rate)}</td>
              <td><b>${formatMoney(line.total)}</b></td>
            </tr>`,
        )
        .join("");

      return `
        <article class="print-order-item">
          <div class="print-order-item-header">
            <div>
              <span>Позиция ${itemIndex + 1}</span>
              <h2>${escapeHtml(item.name || `Изделие ${itemIndex + 1}`)}</h2>
              <p>${escapeHtml(PRODUCT_TYPES[configuration.productType || "window"] || "Окно")} · ${escapeHtml(presentation.material || material?.label || configuration.material)} · ${escapeHtml(presentation.shape || SHAPES[configuration.shape] || configuration.shape)} · ${dimensions}</p>
              <p>${escapeHtml(presentation.profile || profile?.name || configuration.profile)} · ${escapeHtml(presentation.finish || finish || configuration.finish)}</p>
            </div>
            <div class="print-order-item-total">
              ${item.preliminary ? "<span>Предварительный расчёт</span>" : "<span>Сумма позиции</span>"}
              <strong>${formatMoney(item.total)}</strong>
              <small>${item.quantity} шт. · ${formatMoney(item.unitPrice)} за шт.</small>
            </div>
          </div>
          ${specificationRows ? `
            <table class="print-order-table">
              <thead><tr><th>№</th><th>Наименование</th><th>Характеристика</th><th>Кол-во</th><th>Ед.</th><th>Цена</th><th>Сумма</th></tr></thead>
              <tbody>${specificationRows}</tbody>
            </table>` : '<p class="print-order-no-spec">Подробная спецификация для этой позиции не сохранена.</p>'}
        </article>`;
    })
    .join("");

  printOrder.innerHTML = `
    <header class="print-order-header">
      <div><span>ОкноСмета</span><h1>Смета заказа</h1><p>Сформировано: ${escapeHtml(printedAt)}</p></div>
      <div class="print-order-summary">
        <span>${orderItems.length} поз. · ${totalQuantity} ${pluralizeRu(totalQuantity, "окно", "окна", "окон")}</span>
        <strong>${formatMoney(totalPrice)}</strong>
        ${preliminary ? "<small>Предварительная сумма заказа</small>" : ""}
      </div>
    </header>
    ${positionsMarkup}
    <footer class="print-order-footer">
      <span>${preliminary ? "Предварительная сумма заказа" : "Итого по заказу"}</span>
      <strong>${formatMoney(totalPrice)}</strong>
      <p>Расчёт не является публичной офертой. Размеры указаны по внешнему габариту рамы.</p>
    </footer>`;
}

function createProjectId() {
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function projectTotals(project) {
  return {
    positions: project.items.length,
    quantity: project.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    total: project.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
  };
}

export function renderProjectToolbar() {
  const currentDirty = currentProductIsDirty();
  const projectName = $("#currentProjectName");
  if (!projectName.querySelector("input")) projectName.textContent = activeProjectName || "Новый заказ";
  const status = $("#projectSaveStatus");
  if (activeProjectId && !projectDirty && !currentDirty) {
    status.textContent = "Сохранён";
    status.classList.add("saved");
  } else if (currentDirty) {
    status.textContent = editingOrderItemId ? "Изменения изделия не сохранены" : "Изделие не добавлено";
    status.classList.remove("saved");
  } else if (projectDirty) {
    status.textContent = "Есть изменения";
    status.classList.remove("saved");
  } else {
    status.textContent = "Не сохранён";
    status.classList.remove("saved");
  }
  $("#saveProject").textContent = activeProjectId ? "Сохранить изменения" : "Сохранить заказ";
}

export function renderProjectsList() {
  const list = $("#projectsList");
  const sorted = [...projects].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  $("#projectsEmpty").hidden = sorted.length > 0;
  list.innerHTML = sorted
    .map((project) => {
      const totals = projectTotals(project);
      const updated = new Date(project.updatedAt || project.createdAt || Date.now());
      const updatedText = Number.isNaN(updated.getTime())
        ? "Дата не указана"
        : new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(updated);
      return `
        <article class="project-card${project.id === activeProjectId ? " active" : ""}" data-project-id="${escapeHtml(project.id)}">
          <div class="project-card-info">
            <div class="project-card-title"><strong>${escapeHtml(project.name)}</strong>${project.id === activeProjectId ? "<span>Открыт</span>" : ""}</div>
            <div class="project-card-meta">Изменён: ${escapeHtml(updatedText)}<br>${totals.positions} ${pluralizeRu(totals.positions, "позиция", "позиции", "позиций")} · ${totals.quantity} ${pluralizeRu(totals.quantity, "окно", "окна", "окон")} · ${formatMoney(totals.total)}</div>
          </div>
          <div class="project-card-actions">
            <button class="button secondary" type="button" data-project-action="open">Открыть</button>
            <button class="button secondary" type="button" data-project-action="rename">Переименовать</button>
            <button class="button danger" type="button" data-project-action="delete">Удалить</button>
          </div>
        </article>`;
    })
    .join("");
}

export function hasUnsavedProjectWork() {
  return projectDirty || currentProductIsDirty();
}

export function editNameInPlace(element, { value, maxLength, label, invalidMessage, commit }) {
  if (!element || element.querySelector("input")) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "inline-name-input";
  input.maxLength = maxLength;
  input.value = value;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  element.replaceChildren(input);
  input.focus();
  input.select();
  let settled = false;
  const finish = (save) => {
    if (settled) return;
    const next = input.value.trim();
    if (!save || next === value) {
      settled = true;
      if (element.isConnected) element.textContent = value;
      return;
    }
    if (!next || next.length > maxLength) {
      showToast(invalidMessage);
      setTimeout(() => input.focus(), 0);
      return;
    }
    settled = true;
    element.textContent = next;
    commit(next);
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
}

export function renameCurrentOrder() {
  editNameInPlace($("#currentProjectName"), {
    value: activeProjectName || "Новый заказ",
    maxLength: 80,
    label: "Название заказа",
    invalidMessage: "Название заказа должно содержать от 1 до 80 символов.",
    commit(name) {
      setActiveProjectName(name);
      setProjectDirty(true);
      renderProjectToolbar();
      showToast("Название заказа изменено. Сохраните заказ, чтобы записать его.");
    },
  });
}

export async function renameStoredOrder(projectId) {
  if (projectWritePending) return;
  setProjects(readStoredProjects());
  const project = projects.find(item => item.id === projectId);
  if (!project) return;
  const label = document.querySelector(`[data-project-id="${CSS.escape(projectId)}"] .project-card-title strong`);
  if (!label) return;
  editNameInPlace(label, {
    value: project.name,
    maxLength: 80,
    label: "Название заказа",
    invalidMessage: "Название заказа должно содержать от 1 до 80 символов.",
    commit: (name) => storeRenamedOrder(projectId, project, name),
  });
}

async function storeRenamedOrder(projectId, project, name) {
  const baseline = JSON.stringify(project);
  const now = new Date().toISOString();
  const renamed = { ...project, name, updatedAt: now, revision: createProjectId() };
  const saved = await changeStoredProjects(latest => {
    const current = latest.find(item => item?.id === projectId);
    if (!current || JSON.stringify(current) !== baseline) {
      showToast("Заказ изменён в другой вкладке. Откройте обновлённый список.");
      return null;
    }
    return latest.map(item => item?.id === projectId ? renamed : item);
  });
  if (!saved) return;
  if (activeProjectId === projectId) {
    const pendingName = activeProjectName !== project.name;
    setActiveProjectSnapshot(JSON.stringify(renamed));
    if (!pendingName) setActiveProjectName(name);
    setProjectDirty(projectDirty || pendingName);
    renderProjectToolbar();
  }
  showToast(`Заказ «${name}» переименован`);
}

function confirmDiscardUnsavedWork(actionText) {
  if (!hasUnsavedProjectWork()) return true;
  return window.confirm(`Есть несохранённые изменения. ${actionText} без их сохранения?`);
}

function confirmProjectSaveWithoutCurrentProduct() {
  if (!currentProductIsDirty()) return true;
  const message = editingOrderItemId
    ? "Изменения открытого изделия ещё не сохранены в заказе. Сохранить заказ без этих изменений?"
    : "Текущее изделие ещё не добавлено в заказ. Сохранить заказ без него?";
  return window.confirm(message);
}

export async function saveProjectRecord(name) {
  const cleanName = String(name || "").trim();
  if (!cleanName || projectWritePending) return false;
  const id = activeProjectId, baseline = activeProjectSnapshot;
  const now = new Date().toISOString();
  const project = {
    id: id || createProjectId(), name: cleanName,
    createdAt: baseline ? JSON.parse(baseline).createdAt || now : now,
    updatedAt: now, revision: createProjectId(),
    items: cloneData(orderItems), orderItemSequence,
  };
  const saved = await changeStoredProjects(latest => {
    const existing = latest.find(p => p?.id === project.id);
    if (id ? (!existing || JSON.stringify(existing) !== baseline) : Boolean(existing)) {
      showToast("Заказ изменён или удалён в другой вкладке. Ваши изменения не записаны; открытая копия осталась в редакторе.");
      return null;
    }
    return id ? latest.map(p => p?.id === id ? project : p) : [...latest, project];
  });
  if (!saved) return false;
  setActiveProjectId(project.id);
  setActiveProjectSnapshot(JSON.stringify(project));
  setActiveProjectName(project.name);
  setProjectDirty(JSON.stringify(orderItems) !== JSON.stringify(project.items));
  renderProjectToolbar();
  renderProjectsList();
  showToast(`Заказ «${project.name}» сохранён`);
  return true;
}

export function requestProjectSave() {
  if (!orderItems.length) {
    showToast("Добавьте в заказ хотя бы одно изделие");
    return;
  }
  if (!confirmProjectSaveWithoutCurrentProduct()) return;
  const name = (activeProjectName || "Новый заказ").trim();
  if (!name || name.length > 80) {
    showToast("Название заказа должно содержать от 1 до 80 символов.");
    return;
  }
  saveProjectRecord(name);
}

export function openProject(projectId) {
  if (projectWritePending) return;
  setProjects(readStoredProjects());
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  if (!confirmDiscardUnsavedWork(`Открыть заказ «${project.name}»`)) return;
  setOrderItems(cloneData(project.items));
  setOrderItemSequence(Math.max(
    Number(project.orderItemSequence) || 0,
    ...orderItems.map((item) => Number(String(item.name || "").match(/\d+/)?.[0]) || 0),
    orderItems.length,
  ));
  setActiveProjectId(project.id);
  setActiveProjectSnapshot(JSON.stringify(project));
  setActiveProjectName(project.name);
  setProjectDirty(false);
  resetCurrentProduct();
  renderProjectsList();
  $("#projectsDialog").close();
  showToast(`Заказ «${project.name}» открыт`);
}

export async function deleteProject(projectId) {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project || !window.confirm(`Удалить заказ «${project.name}»? Восстановить его будет невозможно.`)) return;
  const expected = JSON.stringify(project);
  if (!await changeStoredProjects(latest => {
    const current = latest.find(p => p?.id === projectId);
    if (!current || JSON.stringify(current) !== expected) {
      showToast("Заказ уже изменён или удалён в другой вкладке. Проверьте обновлённый список.");
      return null;
    }
    return latest.filter(p => p?.id !== projectId);
  })) return;
  if (activeProjectId === projectId) {
    setActiveProjectId(null);
    setActiveProjectSnapshot(null);
    setActiveProjectName("");
    setProjectDirty(orderItems.length > 0);
  }
  renderProjectToolbar();
  renderProjectsList();
  showToast(`Заказ «${project.name}» удалён`);
}

export function startNewProject() {
  if (projectWritePending) return;
  if (!confirmDiscardUnsavedWork("Создать новый заказ")) return;
  setActiveProjectId(null);
  setActiveProjectSnapshot(null);
  setActiveProjectName("");
  setProjectDirty(false);
  setOrderItems([]);
  setOrderItemSequence(0);
  resetCurrentProduct();
  renderProjectsList();
  showToast("Создан новый заказ");
}

export function saveCurrentOrderItem() {
  const blockedSashes = circleSashesBlocked() ? sectionPanes().filter(p => !p.split && p.opening !== "fixed") : [];
  if (blockedSashes.length) {
    if (!window.confirm("Эта профильная система не разрешает круглые створки. Заменить створки глухим остеклением и сохранить изделие?")) return false;
    const previous = blockedSashes.map(p => p.opening);
    blockedSashes.forEach(p => { p.opening = "fixed"; });
    const issue = validateCurrentProduct();
    if (issue) {
      blockedSashes.forEach((p,i) => { p.opening = previous[i]; });
      showToast(issue);
      return false;
    }
  }
  ensurePanes();
  const validationError = validateCurrentProduct();
  if (validationError) {
    setConfigurationError(validationError);
    showToast(validationError);
    return;
  }

  setConfigurationError();
  const calculation = buildSpecification();
  const savedUnitPrice = calculation.unitPrice;
  const currentItem = editingOrderItemId ? orderItems.find((item) => item.id === editingOrderItemId) : null;
  const nextItem = {
    id: currentItem?.id || createOrderItemId(),
    name: draftProductName.trim() || currentItem?.name || `Изделие ${orderItemSequence}`,
    configuration: snapshotCurrentState(),
    quantity: state.quantity,
    unitPrice: savedUnitPrice,
    total: Math.round(calculation.total),
    preliminary: isPreliminaryShape(),
    presentation: {
      productType: PRODUCT_TYPES[state.productType || "window"],
      material: calculation.material.label,
      profile: calculation.profile.name,
      finish: calculation.finishName,
      shape: SHAPES[state.shape],
    },
    specification: cloneData(calculation.lines),
    updatedAt: new Date().toISOString(),
  };

  if (currentItem) {
    const index = orderItems.findIndex((item) => item.id === currentItem.id);
    orderItems[index] = nextItem;
    showToast(`${nextItem.name} обновлено`);
  } else {
    orderItems.push(nextItem);
    showToast(`${nextItem.name} добавлено в заказ`);
  }
  setProjectDirty(true);
  resetCurrentProduct(nextItem.configuration);
  return true;
}

export function editOrderItem(itemId) {
  const item = orderItems.find((candidate) => candidate.id === itemId);
  if (!item) return;
  if (currentProductIsDirty()) {
    const choice = window.prompt("Есть несохранённое изделие. Введите 1 — сохранить в заказ; 2 — отбросить изменения. Отмена — остаться в редакторе.", "");
    if (choice?.trim() === "1") {
      if (!saveCurrentOrderItem()) return;
    } else if (choice?.trim() !== "2") return;
  }
  setEditingOrderItemId(item.id);
  setDraftProductName(item.name || `Изделие ${orderItemSequence}`);
  restoreProductState(orderItems.find(candidate => candidate.id === itemId).configuration);
  renderOrder();
  $("#saveOrderItem").scrollIntoView({ behavior: "smooth", block: "center" });
}

export function renameOrderItem(itemId) {
  const item = orderItems.find(candidate => candidate.id === itemId);
  if (!item) return;
  const label = document.querySelector(`[data-order-item-id="${CSS.escape(itemId)}"] .order-item-heading strong`);
  if (!label) return;
  editNameInPlace(label, {
    value: item.name,
    maxLength: 100,
    label: "Название изделия",
    invalidMessage: "Название должно содержать от 1 до 100 символов.",
    commit(name) {
      item.name = name;
      if (editingOrderItemId === item.id) setDraftProductName(name);
      item.updatedAt = new Date().toISOString();
      setProjectDirty(true);
      renderOrder();
      renderProjectToolbar();
      showToast("Название изделия изменено");
    },
  });
}

export function deleteOrderItem(itemId) {
  const item = orderItems.find((candidate) => candidate.id === itemId);
  if (!item || !window.confirm(`Удалить «${item.name}» из заказа?`)) return;
  setOrderItems(orderItems.filter((candidate) => candidate.id !== itemId));
  setProjectDirty(true);
  if (editingOrderItemId === itemId) resetCurrentProduct();
  else {
    renderOrder();
    renderProjectToolbar();
  }
  showToast(`${item.name} удалено`);
}
