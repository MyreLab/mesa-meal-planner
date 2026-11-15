import { test } from "node:test";
import assert from "node:assert/strict";
import { planMonday, weekOffset, shiftCurrent, shiftWeek, shiftFavorites, localISO } from "../js/demo-dates.js";
import { loadDataset, validateDataset } from "../scripts/validate-data.mjs";

const weekdayOf = (iso) => new Date(iso + "T12:00:00Z").getUTCDay(); // Sunday = 0

test("plan week: Monday to Friday use that week, the weekend looks ahead", () => {
  for (const d of ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]) assert.equal(planMonday(d), "2026-11-09", d);
  assert.equal(planMonday("2026-11-14"), "2026-11-16"); // Saturday, the same day the sample was pinned to
  assert.equal(planMonday("2026-11-15"), "2026-11-16"); // Sunday
});

test("the offset is always a whole number of weeks, so weekdays never move", () => {
  for (let i = 0; i < 800; i++) {
    const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10);
    assert.ok(weekOffset("2026-11-16", d) % 7 === 0, d);
    assert.equal(weekdayOf(planMonday(d)), 1, d);
  }
});

test("on the pinned Saturday nothing moves", () => {
  assert.equal(weekOffset("2026-11-16", "2026-11-14"), 0);
});

test("a shifted dataset keeps its shape and still passes every check", () => {
  const ds = structuredClone(loadDataset());
  const today = "2027-02-03"; // a Wednesday
  const n = weekOffset(ds.current.week, today);
  ds.current = shiftCurrent(ds.current, n, today);
  ds.favorites = { ...ds.favorites, favorites: shiftFavorites(ds.favorites.favorites, n) };
  ds.weeks = Object.fromEntries(Object.entries(ds.weeks).map(([id, w]) => {
    const s = shiftWeek(w, n);
    return [s.week, s];
  }));
  assert.equal(ds.current.week, planMonday(today));
  assert.ok(ds.current.weeks.every((w) => ds.weeks[w]));
  assert.deepEqual(validateDataset(ds), []);
});

test("shifting a week renames the title and keeps each dinner on the same weekday", () => {
  const week = loadDataset().weeks["2026-11-16"];
  const out = shiftWeek(week, 56);
  assert.equal(out.week, "2027-01-11");
  assert.equal(out.title, "Week of Jan 11");
  week.days.forEach((d, i) => assert.equal(weekdayOf(out.days[i].date), weekdayOf(d.date)));
  assert.equal(week.week, "2026-11-16"); // the original is untouched
});

test("localISO gives the local calendar day", () => {
  assert.match(localISO(), /^\d{4}-\d{2}-\d{2}$/);
});
