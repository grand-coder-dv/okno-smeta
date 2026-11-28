import { PRODUCT_TYPES } from "./catalog.js";
import { $, catalogDraft, createCatalogId, escapeHtml } from "./product.js";
import { PART_NAMES, allParts, compatibleParts, compatibleSteel } from "./profile-parts.js";

const groups = [
  ["Рама", ["frame"]], ["Створка", ["sash"]], ["Импост/Штульп", ["impost", "shtulp"]],
  ["Штапик", ["bead"]], ["Расширитель", ["extender"]], ["Соединитель", ["connector"]],
  ["Угловой профиль", ["corner"]], ["Армирование", ["steel"]],
];
export const partTitle = part => [part.article, part.name].join(" · ");
const option = (part, selected) => `<option value="${escapeHtml(part.id)}" ${part.id === selected ? "selected" : ""}>${escapeHtml(partTitle(part))}</option>`;

export function defaultPartFields(catalog, profile, type) {
  const parts = allParts(catalog);
  const defaults = profile.types?.[type]?.defaultParts || {};
  return Object.entries(PART_NAMES).filter(([role]) => role !== "steel").map(([role, name]) => {
    const choices = compatibleParts(parts, role, profile.id, type);
    return `<label class="catalog-field"><span>${name}</span><select data-default-part="${role}" ${choices.length ? "" : "disabled"}>
      <option value="">${choices.length ? "Автоматически" : "Нет артикулов"}</option>
      ${choices.map(item => option(item, defaults[role])).join("")}</select></label>`;
  }).join("");
}

function checkList(title, key, options, selected = []) {
  return `<fieldset><legend>${title}</legend>${options.map(([id, label]) => `<label><input type="checkbox" name="${key}" value="${escapeHtml(id)}" ${selected.includes(id) ? "checked" : ""}> ${escapeHtml(label)}</label>`).join("")}</fieldset>`;
}

function editPart(role, existing) {
  const parts = allParts(catalogDraft);
  const item = existing || {};
  const systems = Object.values(catalogDraft).flatMap(material => material.profiles.map(profile => [profile.id, material.label + " · " + profile.name]));
  const dialog = document.createElement("dialog");
  dialog.className = "part-dialog";
  const number = (name, title, value, min, max) => `<label>${title}<input ${value == null ? "" : "required"} type="number" step="any" min="${min}" ${max ? 'max="'+max+'"' : ""} name="${name}" value="${value == null ? "" : Number(value)}"></label>`;
  const steel = role === "steel";
  const accessory = role === "seal" || role === "assembly";
  const standard = existing?.id.startsWith("standard-");
  const minWidth = ["frame","sash","impost","shtulp"].includes(role) ? 20 : role === "bead" ? 1 : 10;
  dialog.innerHTML = `<form><h3>${PART_NAMES[role]}</h3><div class="part-fields">
    <label>Артикул<input required maxlength="80" name="article" value="${escapeHtml(item.article || "")}"></label>
    <label>Название<input required maxlength="120" name="name" value="${escapeHtml(item.name || "")}"></label>
    ${steel || accessory ? "" : number("width","Ширина / высота, мм",standard ? item.width : item.width ?? 70,minWidth,250)}
    ${accessory ? "" : number("maxLength","Максимальная длина, мм",item.maxLength ?? 6000,1)}
    ${steel || accessory ? "" : number("bite","Заход стекла, мм",standard ? item.bite : item.bite ?? 14,0,100)}
    ${number("price",role === "assembly" ? "Цена, ₽/компл." : "Цена, ₽/пог. м",item.price ?? 0,0)}
    </div>${steel ? checkList("Подходит для профилей","hosts",parts.filter(p => !["steel", "seal", "assembly"].includes(p.role)).map(p => [p.id, partTitle(p)]),item.hosts)
      : `<details class="system-picker"><summary>Профильные системы <strong data-system-caption></strong></summary>${checkList("Выберите системы","systems",systems,item.systems)}</details>` + checkList("Типы изделий","types",Object.entries(PRODUCT_TYPES),item.types)}
    ${!steel && !accessory && existing && compatibleSteel(parts,item).length ? `<label>Основное армирование<select name="steelId">${compatibleSteel(parts,item).map(p => option(p,item.steelId)).join("")}</select></label>` : ""}
    <p role="alert"></p><div><button type="button" class="button ghost">Отмена</button> <button class="button primary">Применить</button></div></form>`;
  document.body.append(dialog);
  const picker = dialog.querySelector(".system-picker");
  if (picker) {
    const updateCaption = () => {
      const checked = [...picker.querySelectorAll("input:checked")];
      picker.querySelector("[data-system-caption]").textContent = checked.length === 1
        ? checked[0].parentElement.textContent.trim() : checked.length ? "Выбрано: " + checked.length : "Выбрать";
    };
    picker.addEventListener("change", updateCaption);
    updateCaption();
  }
  dialog.onclose = () => dialog.remove();
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.querySelector("form").onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const part = { id: item.id || createCatalogId("part"), role, article: data.get("article").trim(), name: data.get("name").trim(),
      price: Number(data.get("price")) };
    if (!accessory) part.maxLength = Number(data.get("maxLength"));
    if (steel) part.hosts = data.getAll("hosts");
    else {
      Object.assign(part, { systems: data.getAll("systems"), types: data.getAll("types") });
      if (!accessory) Object.assign(part, {
        width: data.get("width") === "" ? null : Number(data.get("width")),
        bite: data.get("bite") === "" ? null : Number(data.get("bite")), steelId: data.get("steelId"),
      });
    }
    if (!part.name || !part.article || (steel ? !part.hosts.length : !part.systems.length || !part.types.length)) {
      dialog.querySelector("[role=alert]").textContent = "Заполните название, артикул и отметьте совместимость.";
      return;
    }
    if (existing) Object.assign(existing,part);
    else {
      const owner = Object.values(catalogDraft).find(material => material.profiles.some(p => part.systems?.includes(p.id)) || material.parts?.some(p => part.hosts?.includes(p.id)));
      (owner.parts ||= []).push(part);
    }
    renderPartsCatalog();
    dialog.close();
  };
  dialog.showModal();
}

function partTable(parts, assembly = false) {
  if (!parts.length) return "";
  const number = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  return `<table class="part-table"><thead><tr><th>Артикул</th><th>Название</th><th>Ширина, мм</th><th>${assembly ? "Цена, ₽/компл." : "Цена, ₽/м"}</th></tr></thead>
    <tbody>${parts.map(part => `<tr data-id="${escapeHtml(part.id)}">
      <td><button type="button" class="part-link" aria-label="Редактировать ${escapeHtml(part.article)}">${escapeHtml(part.article)}</button></td>
      <td>${escapeHtml(part.name)}</td><td>${part.width == null ? "—" : number.format(part.width)}</td><td>${number.format(part.price)}</td>
    </tr>`).join("")}</tbody></table>`;
}

export function renderPartsCatalog() {
  const editor = $("#partsEditor");
  const opened = new Set([...editor.querySelectorAll("details[open]")].map(el => el.dataset.group));
  const parts = allParts(catalogDraft);
  if (!editor.children.length) opened.add("Профили");
  const details = (title, body) => `<details data-group="${title}" ${opened.has(title) ? "open" : ""}><summary>${title}</summary>${body}</details>`;
  editor.innerHTML = details("Профили",groups.map(([name,roles]) => details(name,
    partTable(parts.filter(part => roles.includes(part.role))) +
    roles.map(role => `<button type="button" class="part-add" data-add="${role}">+ ${PART_NAMES[role]}</button>`).join("")
  )).join("")) + details("Комплектующие", ["seal", "assembly"].map(role => details(PART_NAMES[role],
    partTable(parts.filter(part => part.role === role), role === "assembly") +
    `<button type="button" class="part-add" data-add="${role}">+ ${PART_NAMES[role]}</button>`,
  )).join("")) + details("Фурнитура","") + details("Стеклопакеты","");
  editor.onclick = event => {
    const button = event.target.closest("[data-id], [data-add]");
    if (!button) return;
    const item = parts.find(p => p.id === button.dataset.id);
    editPart(item?.role || button.dataset.add, item);
  };
}
