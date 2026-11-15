export const DAY_KEYS = ["wknd", "mon", "tue", "wed", "thu", "fri"];
export const DAY_NAME = { wknd: "Weekend", mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };
export const DAY_LAB = { wknd: "Weekend", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const NOON = "T12:00:00Z";
export const fmtDate = (iso) => new Date(iso + NOON).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const fmtWeekday = (iso) => new Date(iso + NOON).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** Which shopping items each day uses, derived from the recipes so the data never repeats itself. */
export function itemDays(week) {
  const map = new Map(week.items.map((i) => [i.id, []]));
  for (const day of week.days) {
    const used = [...day.ingredients, ...day.side.ingredients].map((g) => g.item);
    if (day.pairing) used.push(day.pairing.item);
    for (const id of new Set(used)) map.get(id)?.push(day.key);
  }
  return map;
}

export const usesUp = (day, byId) =>
  day.ingredients.filter((g) => byId[g.item]?.aisle === "In the fridge").map((g) => byId[g.item].name.toLowerCase());
