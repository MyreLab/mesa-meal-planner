// The ONLY module that knows where data comes from. Today: static JSON next to the page.
// Swap the body of getJSON() (or this whole file) for API calls and nothing else changes.
import { addDays } from "./randomizer.js";
import { localISO, weekOffset, shiftCurrent, shiftWeek, shiftFavorites } from "./demo-dates.js";

const BASE = new URL("../data/", import.meta.url);
const cache = new Map();

// The sample files are fixed, so the dates are moved to the current week as they are read (see
// demo-dates.js). ?fixed keeps the original November dates.
const fixed = new URLSearchParams(globalThis.location?.search ?? "").has("fixed");
let clock;
const getClock = () => clock ??= getJSON("current.json").then((c) => {
  const today = localISO();
  return { today, n: weekOffset(c.week, today) };
});

async function getJSON(rel) {
  if (!cache.has(rel)) {
    cache.set(rel, fetch(new URL(rel, BASE)).then((res) => {
      if (!res.ok) throw new Error(`Could not load data/${rel} (HTTP ${res.status})`);
      return res.json();
    }));
  }
  return cache.get(rel);
}

export const loadConfig = () => getJSON("config.json");
export async function loadCurrent() {
  const current = await getJSON("current.json");
  if (fixed) return current;
  const { today, n } = await getClock();
  return shiftCurrent(current, n, today);
}

export async function loadWeek(monday) {
  if (fixed) return getJSON(`weeks/${monday}.json`);
  const { n } = await getClock();
  return shiftWeek(await getJSON(`weeks/${addDays(monday, -n)}.json`), n);
}

export async function loadFavorites() {
  const favorites = (await getJSON("favorites.json")).favorites;
  if (fixed) return favorites;
  const { n } = await getClock();
  return shiftFavorites(favorites, n);
}
