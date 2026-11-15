import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, createMemoryAdapter, createLocalAdapter, keys } from "../js/storage.js";

const fakeBackend = () => {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const clock = () => { let n = 0; return () => `2026-11-14T00:00:${String(n++).padStart(2, "0")}.000Z`; };

for (const [name, make] of [["memory", () => createMemoryAdapter()], ["localStorage", () => createLocalAdapter(fakeBackend())]]) {
  test(`${name} adapter: set, get, remove`, async () => {
    const store = createStorage(make());
    assert.equal(await store.get("ui/x"), null);
    await store.set("ui/x", { a: 1 });
    assert.deepEqual(await store.get("ui/x"), { a: 1 });
    await store.remove("ui/x");
    assert.equal(await store.get("ui/x"), null);
  });

  test(`${name} adapter: list filters by prefix and carries updatedAt`, async () => {
    const store = createStorage(make(), clock());
    await store.set(keys.item("2026-11-16", "garlic"), { c: true, s: null });
    await store.set(keys.item("2026-11-16", "kale"), { c: false, s: "grocery" });
    await store.set(keys.item("2026-11-09", "garlic"), { c: true, s: null });
    const rows = await store.list(keys.itemsPrefix("2026-11-16"));
    assert.deepEqual(rows.map((r) => r.key).sort(), ["shops/w-2026-11-16/items/garlic", "shops/w-2026-11-16/items/kale"]);
    assert.ok(rows.every((r) => /^2026-11-14T/.test(r.updatedAt)));
  });

  test(`${name} adapter: clear removes everything`, async () => {
    const store = createStorage(make());
    await store.set("favorites/a", { dish: "A" });
    await store.clear();
    assert.deepEqual(await store.list("favorites/"), []);
  });
}

test("localStorage adapter only touches its own namespace", async () => {
  const backend = fakeBackend();
  backend.setItem("someone-else", "keep");
  const store = createStorage(createLocalAdapter(backend));
  await store.set("ui/x", 1);
  await store.clear();
  assert.equal(backend.getItem("someone-else"), "keep");
});

test("keys must look like paths", async () => {
  const store = createStorage(createMemoryAdapter());
  await assert.rejects(() => store.set("../escape", 1), /Invalid storage key/);
  await assert.rejects(() => store.get(""), /Invalid storage key/);
});

test("key builders mirror the household layout", () => {
  assert.equal(keys.item("2026-11-16", "kale"), "shops/w-2026-11-16/items/kale");
  assert.equal(keys.favorite("steak"), "favorites/steak");
  assert.equal(keys.rotation("2026-11-23"), "rotation/w-2026-11-23");
});
