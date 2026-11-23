(() => {
  const STORAGE_KEY = "okno-smeta-report-templates-v1";
  const types = [
    ["invoice", "Счёт"], ["contract", "Договор"],
    ["proposal", "Коммерческое предложение"], ["specification", "Подробная спецификация"],
  ];
  const defaults = {
    company: {name:"", details:"", contact:"", customer:""},
    templates: {
      invoice: {title:"Счёт на оплату", intro:"Заказ на изготовление изделий", footer:"Оплата по согласованию сторон.", sketches:false, characteristics:false, prices:true, details:false, body:""},
      contract: {title:"Договор", intro:"Заказ на изготовление изделий", footer:"Подписи сторон: ____________________ / ____________________", sketches:false, characteristics:true, prices:true, details:false, body:"Предмет договора, сроки, порядок оплаты и гарантийные условия укажите здесь перед печатью."},
      proposal: {title:"Коммерческое предложение", intro:"Состав заказа и характеристики изделий", footer:"Предложение подготовлено на основании текущих параметров заказа.", sketches:true, characteristics:true, prices:true, details:false, body:""},
      specification: {title:"Спецификация заказа", intro:"Подробный состав и стоимость каждого изделия", footer:"Размеры указаны по внешнему габариту рамы.", sketches:false, characteristics:true, prices:true, details:true, body:""},
    },
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  let settings = load();
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return copy(defaults);
      const result = copy(defaults);
      for (const key of Object.keys(result.company)) if (typeof saved.company?.[key] === "string") result.company[key] = saved.company[key].slice(0, 500);
      for (const [type] of types) for (const key of Object.keys(result.templates[type])) {
        const value = saved.templates?.[type]?.[key];
        if (typeof value === typeof result.templates[type][key]) result.templates[type][key] = typeof value === "string" ? value.slice(0, 3000) : value;
      }
      return result;
    } catch { return copy(defaults); }
  }
  const h = value => escapeHtml(String(value ?? ""));
  const money = value => formatMoney(Number(value) || 0);
  const field = (label, key, value, multiline=false) => `<label class="report-field"><span>${label}</span>${multiline
    ? `<textarea data-report-field="${key}" rows="3" maxlength="3000">${h(value)}</textarea>`
    : `<input data-report-field="${key}" value="${h(value)}" maxlength="500" />`}</label>`;
  function renderEditor() {
    const company = settings.company;
    document.querySelector("#reportTemplateEditor").innerHTML = `<section class="report-editor-card"><h3>Общие данные</h3><div class="report-editor-grid">
      ${field("Организация / исполнитель", "company.name", company.name)}
      ${field("Заказчик", "company.customer", company.customer)}
      ${field("Реквизиты и банковские данные", "company.details", company.details, true)}
      ${field("Контакты", "company.contact", company.contact, true)}
      </div></section>` + types.map(([id, name]) => {
        const t = settings.templates[id];
        return `<details class="report-editor-card" ${id === "proposal" ? "open" : ""}><summary>${h(name)}</summary><div class="report-editor-grid">
          ${field("Заголовок документа", `${id}.title`, t.title)}
          ${field("Вступление", `${id}.intro`, t.intro, true)}
          ${id === "contract" ? field("Текст договора", `${id}.body`, t.body, true) : ""}
          ${field("Текст в конце", `${id}.footer`, t.footer, true)}
          <div class="report-options">${[["sketches","Эскизы изделий"],["characteristics","Характеристики"],["prices","Цены и итоги"],["details","Подробные строки спецификации"]].map(([key,label])=>`<label><input type="checkbox" data-report-field="${id}.${key}" ${t[key]?"checked":""}/> ${label}</label>`).join("")}</div>
        </div></details>`;
      }).join("");
  }
  function collectEditor() {
    document.querySelectorAll("#reportTemplateEditor [data-report-field]").forEach(input => {
      const [type, key] = input.dataset.reportField.split(".");
      const target = type === "company" ? settings.company : settings.templates[type];
      if (target) target[key] = input.type === "checkbox" ? input.checked : input.value.trim();
    });
  }
  function choices() {
    document.querySelector("#reportChoices").innerHTML = types.map(([id,name])=>`<label class="report-choice"><input type="checkbox" value="${id}" ${id==="proposal"?"checked":""}/><span><b>${h(name)}</b><small>${id==="proposal"?"Изделия, эскизы и характеристики":id==="specification"?"Все строки заказа":id==="invoice"?"Позиции и сумма к оплате":"Условия и состав заказа"}</small></span></label>`).join("");
  }
  function chosen() { return [...document.querySelectorAll("#reportChoices input:checked")].map(x=>x.value); }
  function date() { return new Intl.DateTimeFormat("ru-RU", {day:"2-digit", month:"long", year:"numeric"}).format(new Date()); }
  function itemInfo(item,index) {
    const c=item.configuration, presentation=item.presentation||{};
    const material=MATERIALS[c.material];
    return {
      name:item.name||`Изделие ${index+1}`,
      desc:[PRODUCT_TYPES[c.productType||"window"]||"Окно",presentation.material||material?.label||c.material,presentation.shape||SHAPES[c.shape]||c.shape,overallSizeLabel(c)].join(" · "),
      profile:presentation.profile||material?.profiles.find(p=>p.id===c.profile)?.name||c.profile,
      finish:presentation.finish||material?.finishes.find(f=>f.id===c.finish)?.name||c.finish,
    };
  }
  function summary() {
    const quantity=orderItems.reduce((n,item)=>n+item.quantity,0),total=orderItems.reduce((n,item)=>n+item.total,0);
    return `<div class="report-total"><span>${orderItems.length} поз. · ${quantity} шт.</span><strong>${money(total)}</strong></div>`;
  }
  function itemCards(t) {
    return orderItems.map((item,i)=>{
      const info=itemInfo(item,i);
      return `<article class="report-item">
        ${t.sketches?`<div class="report-sketch">${orderItemSketch(item.configuration,true)}</div>`:""}
        <div class="report-item-content"><h3>${i+1}. ${h(info.name)}</h3>
          ${t.characteristics?`<p>${h(info.desc)}</p><p>Профиль: ${h(info.profile)} · Отделка: ${h(info.finish)}</p>`:""}
          <p>Количество: ${item.quantity} шт.${t.prices?` · ${money(item.unitPrice)} за шт.`:""}</p>
          ${t.prices?`<strong>${money(item.total)}</strong>`:""}
        </div></article>`;
    }).join("");
  }
  function invoiceTable(t) {
    return `<table class="report-table"><thead><tr><th>№</th><th>Изделие</th><th>Кол-во</th>${t.prices?"<th>Цена</th><th>Сумма</th>":""}</tr></thead><tbody>${orderItems.map((item,i)=>{
      const info=itemInfo(item,i);
      return `<tr><td>${i+1}</td><td><b>${h(info.name)}</b>${t.characteristics?`<small>${h(info.desc)}</small>`:""}</td><td>${item.quantity} шт.</td>${t.prices?`<td>${money(item.unitPrice)}</td><td>${money(item.total)}</td>`:""}</tr>`;
    }).join("")}</tbody></table>`;
  }
  function detailed(t) {
    return orderItems.map((item,i)=>{
      const info=itemInfo(item,i);
      const rows=(item.specification||[]).map((line,j)=>`<tr><td>${j+1}</td><td><b>${h(line.name)}</b>${line.note?`<small>${h(line.note)}</small>`:""}</td><td>${h(line.characteristic)}</td><td>${line.unit==="шт."||line.unit==="компл."?Math.round(line.qty):formatNumber(line.qty)}</td><td>${h(line.unit)}</td>${t.prices?`<td>${money(line.rate)}</td><td>${money(line.total)}</td>`:""}</tr>`).join("");
      return `<section class="report-detail"><h3>${i+1}. ${h(info.name)} · ${item.quantity} шт.</h3>${t.characteristics?`<p>${h(info.desc)} · ${h(info.profile)} · ${h(info.finish)}</p>`:""}${t.sketches?`<div class="report-sketch">${orderItemSketch(item.configuration,true)}</div>`:""}
        ${t.details?rows?`<table class="report-table"><thead><tr><th>№</th><th>Наименование</th><th>Характеристика</th><th>Кол-во</th><th>Ед.</th>${t.prices?"<th>Цена</th><th>Сумма</th>":""}</tr></thead><tbody>${rows}</tbody></table>`:"<p>Строки спецификации не сохранены.</p>":""}
        ${t.prices?`<p class="report-subtotal">Итого по изделию: ${money(item.total)}</p>`:""}</section>`;
    }).join("");
  }
  function report(id) {
    const t=settings.templates[id];
    const orderName=document.querySelector("#currentProjectName").textContent.trim() || "Заказ";
    const body=id==="invoice"?invoiceTable(t):id==="specification"?detailed(t):itemCards(t);
    return `<article class="report-document report-${id}"><header class="report-header"><div><span>${h(settings.company.name||"Организация не указана")}</span><h1>${h(t.title)}</h1><p>${h(orderName)} · ${date()}</p></div>${t.prices?summary():""}</header>
      ${settings.company.details&&id==="invoice"?`<p class="report-legal">Реквизиты: ${h(settings.company.details)}</p>`:""}
      ${settings.company.customer?`<p><b>Заказчик:</b> ${h(settings.company.customer)}</p>`:""}
      ${t.intro?`<p class="report-intro">${h(t.intro)}</p>`:""}
      ${id==="contract"&&t.body?`<section class="report-terms">${h(t.body)}</section>`:""}
      ${body}${t.prices?`<div class="report-final">Итого по заказу: ${money(orderItems.reduce((n,item)=>n+item.total,0))}</div>`:""}
      <footer class="report-footer">${h(t.footer)}${settings.company.contact?`<p>${h(settings.company.contact)}</p>`:""}</footer></article>`;
  }
  function render(ids) { return ids.map(report).join(""); }
  function message(text) { document.querySelector("#reportDialogMessage").textContent=text; }
  window.openReportsDialog = function () {
    choices();
    document.querySelector("#reportPreview").hidden=true;
    message(orderItems.length ? "" : "Сначала сохраните хотя бы одно изделие в текущем заказе.");
    document.querySelector("#reportsDialog").showModal();
  };
  document.querySelector("#closeReportsDialog").addEventListener("click",()=>document.querySelector("#reportsDialog").close());
  document.querySelector("#editReportTemplates").addEventListener("click",()=>{
    document.querySelector("#reportsDialog").close();
    document.querySelector("#pricesDialog").showModal();
    setSettingsTab("reports");
  });
  document.querySelector("#previewReports").addEventListener("click",()=>{
    const ids=chosen();if(!ids.length)return message("Выберите хотя бы один отчёт.");
    if(!orderItems.length)return message("Сначала сохраните изделие в заказе.");
    const preview=document.querySelector("#reportPreview");preview.innerHTML=render(ids);preview.hidden=false;message("");
    preview.scrollIntoView({behavior:"smooth",block:"start"});
  });
  document.querySelector("#printReports").addEventListener("click",()=>{
    const ids=chosen();if(!ids.length)return message("Выберите хотя бы один отчёт.");
    if(!orderItems.length)return message("Сначала сохраните изделие в заказе.");
    document.querySelector("#printOrder").innerHTML=render(ids);
    document.querySelector("#reportsDialog").close();
    document.body.classList.add("printing-order");
    window.print();
  });
  document.querySelector("#saveReportTemplates").addEventListener("click",()=>{
    collectEditor();
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));showToast("Настройки отчётов сохранены");}
    catch{showToast("Не удалось сохранить настройки отчётов в браузере");}
  });
  document.querySelector("#resetReportTemplates").addEventListener("click",()=>{
    settings=copy(defaults);renderEditor();showToast("Шаблоны восстановлены. Нажмите «Сохранить отчёты».");
  });
  renderEditor();
})();
