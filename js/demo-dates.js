// Keeps the live demo on the current week. The sample files are fixed (Nov 2026), so when the page
// loads their dates are moved forward by a whole number of weeks. Weekdays never change: a Monday
// stays a Monday. Nothing is written back; the JSON files stay as they are and the validator
// still checks them as shipped. Add ?fixed to the URL to see the original November dates.
import { addDays, daysBetween } from "./randomizer.js";

const NOON = "T12:00:00Z";

/** Today as YYYY-MM-DD in the visitor's own time zone. */
export function localISO(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** The Monday of the plan that applies on `today`. Saturday and Sunday already look ahead to next week. */
export function planMonday(today) {
  const dow = (new Date(today + NOON).getUTCDay() + 6) % 7; // Monday = 0 ... Sunday = 6
  return addDays(today, dow >= 5 ? 7 - dow : -dow);
}

/** Days to move the sample data by so that its current week becomes this week. Always a multiple of 7. */
export const weekOffset = (sampleWeek, today) => daysBetween(sampleWeek, planMonday(today));

const label = (iso) => new Date(iso + NOON).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const shiftCurrent = (current, n, today) => ({
  ...current,
  week: addDays(current.week, n),
  weeks: current.weeks.map((w) => addDays(w, n)),
  asOf: today,
});

export function shiftWeek(week, n) {
  const id = addDays(week.week, n);
  return {
    ...week,
    week: id,
    shopDay: addDays(week.shopDay, n),
    title: /^Week of /.test(week.title) ? `Week of ${label(id)}` : week.title,
    meta: week.meta?.createdOn ? { ...week.meta, createdOn: addDays(week.meta.createdOn, n) } : week.meta,
    days: week.days.map((d) => ({ ...d, date: addDays(d.date, n) })),
  };
}

export const shiftFavorites = (favorites, n) =>
  favorites.map((f) => ({ ...f, lastCooked: addDays(f.lastCooked, n) }));
