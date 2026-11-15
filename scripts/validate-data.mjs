// Data quality gate. Run with `npm run validate`; CI runs it on every push.
//
// Layer 1: structure. Every JSON file must match its schema in schemas/.
// Layer 2: referential integrity. Every ingredient points at a shopping item, every item is used.
// Layer 3: business rules from data/config.json (cook time, premium budget, exclusions, week shape).
//
// The weekly planning run writes these files, so this gate is what keeps a bad week from reaching the app.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateSchema } from "./lib/schema.mjs";
import { addDays } from "../js/randomizer.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DAYS = ["wknd", "mon", "tue", "wed", "thu", "fri"];
const readJson = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), "utf8"));

export function loadDataset(root = ROOT) {
  const read = (...p) => JSON.parse(readFileSync(join(root, ...p), "utf8"));
  const current = read("data", "current.json");
  const weeks = {};
  for (const file of readdirSync(join(root, "data", "weeks")).filter((f) => f.endsWith(".json"))) weeks[file.replace(".json", "")] = read("data", "weeks", file);
  return {
    config: read("data", "config.json"), current, favorites: read("data", "favorites.json"), weeks,
    schemas: Object.fromEntries(["config", "current", "week", "favorites"].map((n) => [n, read("schemas", `${n}.schema.json`)])),
  };
}

const isMonday = (iso) => new Date(iso + "T12:00:00Z").getUTCDay() === 1;
const mentions = (text, word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text);

export function validateDataset({ config, current, favorites, weeks, schemas }) {
  const errors = [];
  const fail = (where, msg) => errors.push(`${where}: ${msg}`);

  // ---- layer 1: structure
  validateSchema(config, schemas.config).forEach((e) => fail("config.json", e));
  validateSchema(current, schemas.current).forEach((e) => fail("current.json", e));
  validateSchema(favorites, schemas.favorites).forEach((e) => fail("favorites.json", e));
  for (const [id, week] of Object.entries(weeks)) validateSchema(week, schemas.week).forEach((e) => fail(`weeks/${id}.json`, e));
  if (errors.length) return errors; // semantic checks assume a well-formed shape

  // ---- pointers
  if (!current.weeks.includes(current.week)) fail("current.json", `week ${current.week} is not listed in weeks`);
  for (const w of current.weeks) if (!weeks[w]) fail("current.json", `weeks lists ${w} but data/weeks/${w}.json does not exist`);
  for (const w of Object.keys(weeks)) if (!current.weeks.includes(w)) fail(`weeks/${w}.json`, "is not listed in current.json weeks");

  const storeIds = new Set(config.stores.map((s) => s.id));
  const homeStores = new Set(config.stores.filter((s) => s.purchase === false).map((s) => s.id));
  const excluded = config.excludedIngredients;
  const premiumByMonth = {};

  for (const [id, week] of Object.entries(weeks)) {
    const at = `weeks/${id}.json`;
    if (week.week !== id) fail(at, `week field ${week.week} does not match the file name`);
    if (!isMonday(week.week)) fail(at, "week must start on a Monday");
    if (week.shopDay !== addDays(week.week, -1)) fail(at, `shopDay should be the day before the week starts (${addDays(week.week, -1)})`);

    // ---- week shape
    if (week.days.map((d) => d.key).join() !== DAYS.join()) fail(at, `days must be exactly ${DAYS.join(", ")} in order`);
    week.days.forEach((d, i) => { if (d.date !== addDays(week.week, i - 1)) fail(at, `${d.key} should be dated ${addDays(week.week, i - 1)}, found ${d.date}`); });
    if (week.days.length !== config.week.dinners) fail(at, `expected ${config.week.dinners} dinners, found ${week.days.length}`);

    // ---- referential integrity
    const itemIds = week.items.map((i) => i.id);
    if (new Set(itemIds).size !== itemIds.length) fail(at, "item ids must be unique");
    const byId = Object.fromEntries(week.items.map((i) => [i.id, i]));
    for (const item of week.items) if (!storeIds.has(item.store)) fail(at, `item ${item.id} uses unknown store "${item.store}"`);
    const used = new Set();
    for (const d of week.days) {
      const refs = [...d.ingredients, ...d.side.ingredients].map((g) => g.item);
      if (d.pairing) refs.push(d.pairing.item);
      for (const ref of refs) { if (!byId[ref]) fail(at, `${d.key} references unknown item "${ref}"`); used.add(ref); }
    }
    // Kit items (lunch containers) are household supplies, not ingredients, so they may be unreferenced.
    for (const item of week.items) if (item.aisle !== "Kit" && !used.has(item.id)) fail(at, `item "${item.id}" is not used by any dish`);

    // Every dish has a side: the schema requires side.ingredients and side.steps, and the item
    // reference check above puts the side's ingredients on the shopping list.

    // ---- fridge rule: "In the fridge" items are not bought, and only the weekend dish uses them
    for (const item of week.items.filter((i) => i.aisle === "In the fridge")) {
      if (!homeStores.has(item.store)) fail(at, `fridge item "${item.id}" should default to a have-it store`);
      for (const d of week.days.filter((x) => x.key !== "wknd")) {
        if ([...d.ingredients, ...d.side.ingredients].some((g) => g.item === item.id)) fail(at, `fridge item "${item.id}" is used on ${d.key}; only the weekend dish uses up the fridge`);
      }
    }

    // ---- lunches: only from an earlier dinner with enough portions for lunch
    DAYS.forEach((k, i) => {
      const from = week.lunches[k];
      if (!from) return;
      const source = week.days.find((d) => d.key === from);
      if (DAYS.indexOf(from) >= i) fail(at, `${k} lunch comes from ${from}, which is not earlier in the week`);
      if (source && source.portions < config.household.people * 2) fail(at, `${from} makes ${source.portions} portions, too few to also feed ${k}'s lunch`);
    });

    // ---- cooking rules
    const weeknights = week.days.filter((d) => d.key !== "wknd");
    for (const d of weeknights) if (d.minutes.total > config.cooking.weeknightMaxMinutes) fail(at, `${d.key} takes ${d.minutes.total} min, over the ${config.cooking.weeknightMaxMinutes} min weeknight limit`);
    for (const d of week.days) if (d.minutes.hands > d.minutes.total) fail(at, `${d.key} hands-on time exceeds total time`);
    const wheatNights = weeknights.filter((d) => d.wheat === "contains").length;
    if (wheatNights > config.cooking.maxWeeknightsWithWheat) fail(at, `${wheatNights} weeknights contain wheat, limit is ${config.cooking.maxWeeknightsWithWheat}`);

    // ---- exclusions
    for (const d of week.days) {
      const text = [d.dish, d.side.name, ...d.ingredients.map((g) => g.text), ...d.side.ingredients.map((g) => g.text), ...d.steps, ...d.side.steps].join(" ");
      for (const word of excluded) if (mentions(text, word)) fail(at, `${d.key} mentions excluded ingredient "${word}"`);
    }
    for (const item of week.items) for (const word of excluded) if (mentions(item.name, word)) fail(at, `item "${item.id}" is an excluded ingredient ("${word}")`);

    // ---- budget: premium proteins
    const premium = week.days.filter((d) => d.premium);
    if (premium.length > config.budget.premiumMaxPerWeek) fail(at, `${premium.length} premium dishes, limit is ${config.budget.premiumMaxPerWeek} a week`);
    for (const d of premium.filter((x) => x.protein === "fish")) if (!config.budget.freshFishDays.includes(d.key)) fail(at, `fresh fish on ${d.key}; it belongs on ${config.budget.freshFishDays.join(" or ")}`);
    premiumByMonth[week.week.slice(0, 7)] = (premiumByMonth[week.week.slice(0, 7)] ?? 0) + premium.length;
  }
  for (const [month, n] of Object.entries(premiumByMonth)) if (n > config.budget.premiumMaxPerMonth) fail("weeks", `${n} premium dishes in ${month}, limit is ${config.budget.premiumMaxPerMonth} a month`);

  // ---- favourites
  const seen = new Set();
  for (const f of favorites.favorites) {
    if (seen.has(f.id)) fail("favorites.json", `duplicate id ${f.id}`);
    seen.add(f.id);
    const expected = f.totalMinutes > config.favorites.weekendOnlyOverMinutes ? "weekend" : "any";
    if (f.slot !== expected) fail("favorites.json", `${f.id}: ${f.totalMinutes} min should be slot "${expected}", found "${f.slot}"`);
    for (const word of excluded) if (mentions(f.dish, word)) fail("favorites.json", `${f.id} mentions excluded ingredient "${word}"`);
  }
  return errors;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = validateDataset(loadDataset());
  if (errors.length) {
    console.error(`Data check failed (${errors.length} problem${errors.length === 1 ? "" : "s"}):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  const ds = loadDataset();
  console.log(`Data check passed: ${Object.keys(ds.weeks).length} weeks, ${ds.favorites.favorites.length} favourites, config v${ds.config.schemaVersion}.`);
}
