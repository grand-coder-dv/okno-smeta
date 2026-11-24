// Старт страницы и регистрация инструментов агента.
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
    const ranges = { width: [400, 5000], height: [400, 4000], columns: [1, 4], rows: [1, 3], quantity: [1, 9999] };
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
              shape: { type: "string", enum: ["rect", "arch", "circle", "skew"] },
              width: { type: "number", minimum: 400, maximum: 5000 },
              height: { type: "number", minimum: 400, maximum: 4000 },
              columns: { type: "integer", minimum: 1, maximum: 4 },
              rows: { type: "integer", minimum: 1, maximum: 3 },
              quantity: { type: "integer", minimum: 1, maximum: 9999 },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async (rawInput) => {
            const input = validateConfiguration(rawInput);
            if (input.material) {
              state.material = input.material;
              updateMaterialSelects(true);
            }
            if (input.shape) setWindowShapeMode(input.shape);
            if (input.width) state.width = input.width;
            if (input.height) state.height = input.height;
            if (state.shape === "circle") state.height = state.width;
            if (input.columns) state.vImposts = makeEvenImposts(input.columns - 1, state.width, "vertical");
            if (input.rows) state.hImposts = makeEvenImposts(input.rows - 1, state.height, "horizontal");
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
            return {
              total: Math.round(calculation.total),
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
markCurrentStateBaseline();
bindEvents();
renderAll();
renderOrder();
renderProjectsList();
exposeAgentTools();
