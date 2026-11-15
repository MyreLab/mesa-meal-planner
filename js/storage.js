// Saved state (ticks, store switches, liked dishes, rolls) lives behind this small interface.
//
//   get(key)            -> value | null
//   set(key, value)     -> void
//   remove(key)         -> void
//   list(prefix)        -> [{ key, value, updatedAt }]
//   subscribe(callback) -> unsubscribe   (fires when another tab changes the data)
//
// All methods are async so a network adapter (an /api/* call, for example) can replace the
// localStorage one without touching any rendering code. Every record carries an `updatedAt`
// timestamp so a later adapter can resolve conflicts between phones (last write wins).
//
// Key layout (kept compatible with the household version so a later migration is trivial):
//   shops/w-<Monday>/items/<itemId>  -> { c: boolean, s: storeId | null }
//   favorites/<slug>                 -> favourite record, or { removed: true } for a seed favourite
//   rotation/w-<Monday>              -> { picks: [...], rolledAt, week }
//   ui/<name>                        -> device-only preferences

const KEY_PATTERN = /^[a-z0-9][a-z0-9/_.-]*$/i;

function assertKey(key) {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
}

export function createMemoryAdapter() {
  const records = new Map();
  return {
    kind: "memory",
    label: "Kept in memory only. It resets when you close the page.",
    async get(key) { return records.get(key) ?? null; },
    async set(key, record) { records.set(key, record); },
    async remove(key) { records.delete(key); },
    async list(prefix) { return [...records].filter(([k]) => k.startsWith(prefix)).map(([key, record]) => ({ key, ...record })); },
    async clear() { records.clear(); },
    subscribe() { return () => {}; },
  };
}

export function createLocalAdapter(backend = globalThis.localStorage, namespace = "mesa:v1:") {
  return {
    kind: "localStorage",
    label: "Saved on this device only. It does not sync between phones.",
    async get(key) {
      const raw = backend.getItem(namespace + key);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, record) { backend.setItem(namespace + key, JSON.stringify(record)); },
    async remove(key) { backend.removeItem(namespace + key); },
    async list(prefix) {
      const out = [];
      for (let i = 0; i < backend.length; i++) {
        const raw = backend.key(i);
        if (raw && raw.startsWith(namespace + prefix)) out.push({ key: raw.slice(namespace.length), ...JSON.parse(backend.getItem(raw)) });
      }
      return out;
    },
    async clear() {
      const mine = [];
      for (let i = 0; i < backend.length; i++) { const k = backend.key(i); if (k && k.startsWith(namespace)) mine.push(k); }
      mine.forEach((k) => backend.removeItem(k));
    },
    subscribe(callback) {
      const handler = (e) => { if (e.key && e.key.startsWith(namespace)) callback(e.key.slice(namespace.length)); };
      globalThis.addEventListener?.("storage", handler);
      return () => globalThis.removeEventListener?.("storage", handler);
    },
  };
}

/** Picks localStorage when it works, otherwise falls back to memory (private mode, blocked storage). */
export function createDefaultAdapter() {
  try {
    const probe = "__mesa_probe__";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return createLocalAdapter();
  } catch {
    return createMemoryAdapter();
  }
}

export function createStorage(adapter = createDefaultAdapter(), now = () => new Date().toISOString()) {
  return {
    kind: adapter.kind,
    label: adapter.label,
    async get(key) { assertKey(key); const r = await adapter.get(key); return r ? r.value : null; },
    async set(key, value) { assertKey(key); await adapter.set(key, { value, updatedAt: now() }); },
    async remove(key) { assertKey(key); await adapter.remove(key); },
    async list(prefix) { assertKey(prefix); return adapter.list(prefix); },
    async clear() { await adapter.clear(); },
    subscribe: (cb) => adapter.subscribe(cb),
  };
}

// Key builders, so the layout above lives in exactly one place.
export const keys = {
  itemsPrefix: (monday) => `shops/w-${monday}/items/`,
  item: (monday, itemId) => `shops/w-${monday}/items/${itemId}`,
  favorite: (slug) => `favorites/${slug}`,
  favoritesPrefix: "favorites/",
  rotation: (monday) => `rotation/w-${monday}`,
  ui: (name) => `ui/${name}`,
};
