// The ONLY module that knows where data comes from. Today: static JSON next to the page.
// Swap the body of getJSON() (or this whole file) for API calls and nothing else changes.
const BASE = new URL("../data/", import.meta.url);
const cache = new Map();

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
export const loadCurrent = () => getJSON("current.json");
export const loadWeek = (monday) => getJSON(`weeks/${monday}.json`);
export const loadFavorites = async () => (await getJSON("favorites.json")).favorites;
