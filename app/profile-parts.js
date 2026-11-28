export const PART_NAMES = {
  frame: "Рама", sash: "Створка", impost: "Импост", shtulp: "Штульп", bead: "Штапик",
  extender: "Расширитель", connector: "Соединитель", corner: "Угловой профиль", steel: "Армирование",
};

export function allParts(materials) {
  return Object.values(materials).flatMap(material => material.parts || []);
}

export function compatibleParts(parts, role, system, type) {
  return parts.filter(part => part.role === role && part.systems?.includes(system) && part.types?.includes(type));
}

export function resolveParts(materials, product, profile) {
  const parts = allParts(materials);
  const type = product.productType || "window";
  const defaults = profile.types?.[type]?.defaultParts || {};
  const result = {};
  for (const role of Object.keys(PART_NAMES)) {
    if (role === "steel") continue;
    const choices = compatibleParts(parts, role, profile.id, type);
    const selected = choices.find(part => part.id === product.partChoices?.[role])
      || choices.find(part => part.id === defaults[role]) || choices[0];
    if (selected) result[role] = selected;
  }
  return result;
}

export function compatibleSteel(parts, part) {
  return parts.filter(item => item.role === "steel" && item.hosts?.includes(part.id));
}
