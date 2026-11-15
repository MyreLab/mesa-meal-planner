import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RULES, addDays, daysBetween, slotFor, returnDate, slotDays, earliestSlot, isDue, earliestFor,
  dueFavorites, rollPicks, shuffle, cooldown, mulberry32, slugify,
} from "../js/randomizer.js";

const MONDAY = "2026-11-23"; // weekend slot = Sun Nov 22, weekdays = Nov 23-27
const fav = (over = {}) => ({ id: "x", dish: "X", slot: "any", premium: false, lastCooked: "2026-10-01", ...over });

test("date helpers are timezone-safe", () => {
  assert.equal(addDays("2026-11-23", 7), "2026-11-30");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09"); // US daylight-saving change
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(daysBetween("2026-11-14", "2026-11-23"), 9);
});

test("slotFor: only dishes over 40 minutes are weekend-only", () => {
  assert.equal(slotFor(40), "any");
  assert.equal(slotFor(41), "weekend");
  assert.equal(slotFor(75), "weekend");
});

test("a favourite returns 28 days after it was last cooked", () => {
  assert.equal(returnDate(fav({ lastCooked: "2026-10-18" })), "2026-11-15");
});

test("due is checked against the day it would actually be cooked", () => {
  // Weekday dish: the last real slot is Friday Nov 27, so lastCooked Oct 30 (back Nov 27) is due...
  assert.equal(isDue(fav({ lastCooked: "2026-10-30" }), MONDAY), true);
  // ...and Oct 31 (back Nov 28) is not, because Friday is the last weekday slot.
  assert.equal(isDue(fav({ lastCooked: "2026-10-31" }), MONDAY), false);
});

test("weekend-only dishes can only use the Sunday before the week", () => {
  const stew = fav({ slot: "weekend" });
  assert.deepEqual(slotDays(stew, MONDAY), ["2026-11-22"]);
  assert.equal(isDue({ ...stew, lastCooked: "2026-10-25" }, MONDAY), true);  // back Nov 22
  assert.equal(isDue({ ...stew, lastCooked: "2026-10-26" }, MONDAY), false); // back Nov 23, a weekday
});

test("earliest is null when the dish can go on any slot, otherwise the first allowed day", () => {
  assert.equal(earliestFor(fav({ lastCooked: "2026-10-12" }), MONDAY), null);            // back Nov 9, anytime
  assert.equal(earliestFor(fav({ lastCooked: "2026-10-27" }), MONDAY), "2026-11-24");    // back Nov 24 (Tue)
  assert.equal(earliestSlot(fav({ lastCooked: "2026-10-27" }), MONDAY), "2026-11-24");
  assert.equal(earliestFor(fav({ slot: "weekend", lastCooked: "2026-10-01" }), MONDAY), null);
});

test("roll picks at most 2, from those due", () => {
  const favs = ["a", "b", "c", "d"].map((id) => fav({ id, dish: id.toUpperCase() }));
  const picks = rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(1));
  assert.equal(picks.length, 2);
  assert.ok(picks.every((p) => favs.some((f) => f.id === p.id)));
});

test("roll never picks a favourite that is not due", () => {
  const favs = [fav({ id: "due", lastCooked: "2026-10-01" }), fav({ id: "waiting", lastCooked: "2026-11-10" })];
  for (let seed = 0; seed < 50; seed++) {
    const ids = rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(seed)).map((p) => p.id);
    assert.deepEqual(ids, ["due"]);
  }
});

test("roll returns nothing when nothing is due", () => {
  assert.deepEqual(rollPicks([fav({ lastCooked: "2026-11-20" })], MONDAY), []);
});

test("at most one premium dish per roll", () => {
  const favs = [fav({ id: "steak", premium: true }), fav({ id: "salmon", premium: true }), fav({ id: "steak2", premium: true }), fav({ id: "plain" })];
  for (let seed = 0; seed < 200; seed++) {
    const picks = rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(seed));
    assert.ok(picks.filter((p) => p.premium).length <= 1, `seed ${seed}`);
  }
});

test("at most one weekend-only dish per roll (there is one weekend slot)", () => {
  const favs = [fav({ id: "chili", slot: "weekend" }), fav({ id: "stew", slot: "weekend" }), fav({ id: "quick" })];
  for (let seed = 0; seed < 200; seed++) {
    const picks = rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(seed));
    assert.ok(picks.filter((p) => p.slot === "weekend").length <= 1, `seed ${seed}`);
  }
});

test("the same seed gives the same roll", () => {
  const favs = ["a", "b", "c", "d", "e"].map((id) => fav({ id, dish: id }));
  assert.deepEqual(rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(7)), rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(7)));
});

test("every due favourite can be picked (the roll is not biased to the first in the list)", () => {
  const favs = ["a", "b", "c", "d"].map((id) => fav({ id, dish: id }));
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) rollPicks(favs, MONDAY, DEFAULT_RULES, mulberry32(seed)).forEach((p) => seen.add(p.id));
  assert.equal(seen.size, 4);
});

test("shuffle keeps every element and does not mutate its input", () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, mulberry32(3));
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test("cooldown reports progress and due state", () => {
  const f = fav({ lastCooked: "2026-10-18" }); // back Nov 15
  assert.deepEqual(cooldown(f, "2026-11-14"), { back: "2026-11-15", left: 1, due: false, pct: 96 });
  assert.equal(cooldown(f, "2026-11-15").due, true);
  assert.equal(cooldown(f, "2026-12-30").pct, 100);
});

test("slugify matches the key format used by saved favourites", () => {
  assert.equal(slugify("Lemon-garlic chicken thighs"), "lemon-garlic-chicken-thighs");
  assert.equal(slugify("Beans & kale: a stew!"), "beans-and-kale-a-stew");
});

test("simulation: 2,000 random rolls over random favourite lists never break a rule", () => {
  const rng = mulberry32(2026);
  for (let n = 0; n < 2000; n++) {
    const favs = Array.from({ length: 1 + Math.floor(rng() * 10) }, (_, i) => fav({
      id: `f${i}`, dish: `F${i}`, slot: rng() < 0.3 ? "weekend" : "any", premium: rng() < 0.3,
      lastCooked: addDays("2026-09-01", Math.floor(rng() * 80)),
    }));
    const picks = rollPicks(favs, MONDAY, DEFAULT_RULES, rng);
    assert.ok(picks.length <= DEFAULT_RULES.maxPicks);
    assert.ok(picks.filter((p) => p.premium).length <= DEFAULT_RULES.maxPremium);
    assert.ok(picks.filter((p) => p.slot === "weekend").length <= DEFAULT_RULES.maxWeekendOnly);
    assert.equal(new Set(picks.map((p) => p.id)).size, picks.length, "no duplicates");
    const due = new Set(dueFavorites(favs, MONDAY).map((f) => f.id));
    for (const p of picks) {
      assert.ok(due.has(p.id), "picked a favourite that was not due");
      const f = favs.find((x) => x.id === p.id);
      const cookDay = p.earliest ?? slotDays(f, MONDAY)[0];
      assert.ok(cookDay >= returnDate(f), "earliest is before the return date");
    }
  }
});
