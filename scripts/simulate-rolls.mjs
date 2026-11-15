// Monte Carlo check of the favourites roll on the sample data.
// Usage: node scripts/simulate-rolls.mjs [rolls] [--json]
// Reports how often each due favourite is picked and confirms no rule is ever broken.
import { fileURLToPath } from "node:url";
import { loadDataset } from "./validate-data.mjs";
import { DEFAULT_RULES, addDays, dueFavorites, rollPicks, mulberry32 } from "../js/randomizer.js";

export function simulate(rolls = 10000, seed = 42) {
  const { config, current, favorites } = loadDataset();
  const rules = { ...DEFAULT_RULES, ...config.favorites };
  const monday = addDays(current.week, 7);
  const favs = favorites.favorites;
  const dueIds = new Set(dueFavorites(favs, monday, rules).map((f) => f.id));

  const rng = mulberry32(seed);
  const counts = Object.fromEntries(favs.map((f) => [f.id, 0]));
  const sizes = { 0: 0, 1: 0, 2: 0 };
  let violations = 0;
  for (let i = 0; i < rolls; i++) {
    const picks = rollPicks(favs, monday, rules, rng);
    sizes[picks.length] = (sizes[picks.length] ?? 0) + 1;
    picks.forEach((p) => counts[p.id]++);
    const broken = picks.length > rules.maxPicks
      || picks.filter((p) => p.premium).length > rules.maxPremium
      || picks.filter((p) => p.slot === "weekend").length > rules.maxWeekendOnly
      || picks.some((p) => !dueIds.has(p.id));
    if (broken) violations++;
  }
  return {
    monday, rolls, violations, rollSizes: sizes, dueCount: dueIds.size,
    favourites: favs.map((f) => ({ id: f.id, dish: f.dish, short: f.short, premium: f.premium, slot: f.slot, lastCooked: f.lastCooked, due: dueIds.has(f.id), pickRate: counts[f.id] / rolls })),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rolls = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 10000);
  const r = simulate(rolls);
  if (process.argv.includes("--json")) { console.log(JSON.stringify(r, null, 2)); }
  else {
    console.log(`${r.rolls} rolls for the week of ${r.monday}: ${r.dueCount} favourites due, ${r.violations} rule violations`);
    for (const f of r.favourites) console.log(`${f.due ? "due " : "wait"}  ${(f.pickRate * 100).toFixed(1).padStart(5)}%  ${f.dish}`);
  }
  if (r.violations) process.exit(1);
}
