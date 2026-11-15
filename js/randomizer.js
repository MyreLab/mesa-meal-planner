// Favourites roll rules as pure functions: no DOM, no storage, no clock, no hidden randomness.
// Pass `rng` (a function returning [0, 1)) to make a roll reproducible in tests.

export const DEFAULT_RULES = Object.freeze({
  minGapDays: 28,            // a favourite is due again this many days after it was last cooked
  maxPicks: 2,               // picks per week
  maxPremium: 1,             // premium proteins (steak, fresh salmon) per roll
  maxWeekendOnly: 1,         // there is only one weekend dinner slot per week
  weekendOnlyOverMinutes: 40 // dishes that take longer than this are weekend-only
});

const NOON = "T12:00:00Z"; // noon UTC keeps day arithmetic safe around daylight-saving changes

export function addDays(iso, n) {
  const t = new Date(iso + NOON);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((new Date(b + NOON) - new Date(a + NOON)) / 86400000);
}

export const slugify = (text) =>
  text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** "weekend" for dishes longer than the weeknight limit, otherwise "any". */
export function slotFor(totalMinutes, rules = DEFAULT_RULES) {
  return totalMinutes > rules.weekendOnlyOverMinutes ? "weekend" : "any";
}

/** First day the favourite may be cooked again. */
export const returnDate = (fav, rules = DEFAULT_RULES) => addDays(fav.lastCooked, rules.minGapDays);

/**
 * Days of the week starting Monday `monday` on which this favourite could actually be cooked.
 * The weekend dinner is the Sunday before the Monday. Weekend-only dishes can only use that day.
 */
export function slotDays(fav, monday) {
  const weekend = addDays(monday, -1);
  if (fav.slot === "weekend") return [weekend];
  return [weekend, ...[0, 1, 2, 3, 4].map((i) => addDays(monday, i))];
}

/** Earliest real cooking day in that week that is on or after the return date, or null if none. */
export function earliestSlot(fav, monday, rules = DEFAULT_RULES) {
  const back = returnDate(fav, rules);
  return slotDays(fav, monday).find((day) => day >= back) ?? null;
}

/** Due means it can be cooked on at least one real day of that week. */
export const isDue = (fav, monday, rules = DEFAULT_RULES) => earliestSlot(fav, monday, rules) !== null;

/**
 * The `earliest` date shown on a pick: null when the dish can go on any slot of the week,
 * otherwise the first day it is allowed.
 */
export function earliestFor(fav, monday, rules = DEFAULT_RULES) {
  const first = earliestSlot(fav, monday, rules);
  return first && first !== slotDays(fav, monday)[0] ? first : null;
}

export const dueFavorites = (favs, monday, rules = DEFAULT_RULES) => favs.filter((f) => isDue(f, monday, rules));

/** Fisher-Yates on a copy. */
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Roll the favourites for the week starting `monday`.
 * Up to `maxPicks`, at random from those due, with at most `maxPremium` premium dish
 * and at most `maxWeekendOnly` weekend-only dish.
 */
export function rollPicks(favs, monday, rules = DEFAULT_RULES, rng = Math.random) {
  const picks = [];
  let premium = 0, weekendOnly = 0;
  for (const fav of shuffle(dueFavorites(favs, monday, rules), rng)) {
    if (picks.length >= rules.maxPicks) break;
    if (fav.premium && premium >= rules.maxPremium) continue;
    if (fav.slot === "weekend" && weekendOnly >= rules.maxWeekendOnly) continue;
    if (fav.premium) premium++;
    if (fav.slot === "weekend") weekendOnly++;
    picks.push({ id: fav.id, dish: fav.dish, premium: !!fav.premium, slot: fav.slot, earliest: earliestFor(fav, monday, rules) });
  }
  return picks;
}

/** Progress through the cool-down for the favourites list. */
export function cooldown(fav, today, rules = DEFAULT_RULES) {
  const back = returnDate(fav, rules);
  const left = daysBetween(today, back);
  const pct = Math.max(0, Math.min(100, Math.round((100 * (rules.minGapDays - Math.max(0, left))) / rules.minGapDays)));
  return { back, left, due: left <= 0, pct };
}

/** Small seedable generator so rolls can be reproduced in tests and simulations. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
