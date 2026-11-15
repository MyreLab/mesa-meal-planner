import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset, validateDataset } from "../scripts/validate-data.mjs";
import { validateSchema } from "../scripts/lib/schema.mjs";

const fresh = () => structuredClone(loadDataset());
const errorsFor = (mutate) => { const ds = fresh(); mutate(ds); return validateDataset(ds); };

test("the shipped sample data passes every check", () => {
  assert.deepEqual(validateDataset(loadDataset()), []);
});

test("schema checker: types, required fields, patterns and unknown fields", () => {
  const schema = { type: "object", required: ["a"], additionalProperties: false, properties: { a: { type: "string", pattern: "^x" }, b: { type: "integer", minimum: 2 } } };
  assert.deepEqual(validateSchema({ a: "xy", b: 3 }, schema), []);
  assert.equal(validateSchema({}, schema).length, 1);
  assert.equal(validateSchema({ a: "yx" }, schema).length, 1);
  assert.equal(validateSchema({ a: "x", b: 1 }, schema).length, 1);
  assert.equal(validateSchema({ a: "x", c: 1 }, schema).length, 1);
  assert.equal(validateSchema({ a: 5 }, schema).length, 1);
});

test("rejects an ingredient that points at a missing shopping item", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[1].ingredients[0].item = "ghost"; });
  assert.ok(errs.some((e) => /unknown item "ghost"/.test(e)), errs.join("\n"));
});

test("rejects a shopping item no dish uses", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].items.push({ id: "orphan", store: "costco", aisle: "Pantry", name: "Orphan", qty: "1", note: "" }); });
  assert.ok(errs.some((e) => /"orphan" is not used/.test(e)));
});

test("rejects a weeknight dinner that takes too long", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[2].minutes.total = 55; });
  assert.ok(errs.some((e) => /over the 40 min weeknight limit/.test(e)));
});

test("rejects an excluded ingredient anywhere in a recipe", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[3].steps[0] += " Add some mushrooms."; });
  assert.ok(errs.some((e) => /excluded ingredient "mushrooms"/.test(e)));
});

test("rejects more premium dishes than the weekly budget", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[2].premium = true; ds.weeks["2026-11-16"].days[3].premium = true; });
  assert.ok(errs.some((e) => /premium dishes, limit is 1 a week/.test(e)));
});

test("rejects fresh fish late in the week", () => {
  const errs = errorsFor((ds) => { const d = ds.weeks["2026-11-09"].days[4]; d.protein = "fish"; d.premium = true; });
  assert.ok(errs.some((e) => /fresh fish on thu/.test(e)));
});

test("rejects a packed lunch from a dinner that makes too few portions", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[1].portions = 2; });
  assert.ok(errs.some((e) => /too few to also feed/.test(e)));
});

test("rejects a lunch that comes from a later day", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].lunches.mon = "fri"; });
  assert.ok(errs.some((e) => /not earlier in the week/.test(e)));
});

test("rejects a second wheat weeknight", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[1].wheat = "contains"; });
  assert.ok(errs.some((e) => /weeknights contain wheat/.test(e)));
});

test("rejects a dish with no side", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[1].side.ingredients = []; });
  assert.ok(errs.some((e) => /side\.ingredients: needs at least 1/.test(e)));
});

test("rejects a favourite whose slot disagrees with its cook time", () => {
  const errs = errorsFor((ds) => { ds.favorites.favorites[0].slot = "weekend"; });
  assert.ok(errs.some((e) => /should be slot "any"/.test(e)));
});

test("rejects a fridge item used on a weeknight", () => {
  const errs = errorsFor((ds) => { ds.weeks["2026-11-16"].days[1].ingredients.push({ item: "kale", qty: "1", text: "kale" }); });
  assert.ok(errs.some((e) => /only the weekend dish uses up the fridge/.test(e)));
});

test("rejects a week file that is not listed in current.json", () => {
  const errs = errorsFor((ds) => { ds.current.weeks = ["2026-11-16"]; });
  assert.ok(errs.some((e) => /not listed in current\.json/.test(e)));
});
