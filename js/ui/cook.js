import { ICON, PROTEIN } from "./icons.js";
import { DAY_KEYS, DAY_NAME, DAY_LAB, esc } from "./util.js";
import { dishTags, ingredientList, likeButton } from "./week.js";

export function renderCook(ctx, key) {
  const { week } = ctx;
  const d = week.days.find((x) => x.key === key);
  const from = week.lunches[key];
  const fromDay = from && week.days.find((x) => x.key === from);
  const pick = week.days.map((x) => `<a href="#${x.key}" aria-current="${x.key === key}">${ICON[x.protein](PROTEIN[x.protein])}${x.key === "wknd" ? "Wknd" : DAY_LAB[x.key]}<small>${esc(x.short)}</small></a>`).join("");
  const lunch = fromDay
    ? `<div class="callout">Lunch today: <b>${esc(fromDay.dish)}</b>, packed on ${DAY_LAB[from]}.</div>`
    : `<div class="callout">${key === "wknd" ? "Uses up what is in the fridge before the new shop." : "No packed lunch from this week's dinners today."}</div>`;
  return `
    <nav class="daypick" aria-label="Pick a day">${pick}</nav>
    ${lunch}
    <article class="recipe">
      <div style="display:grid;gap:6px">
        <div class="day-name">${DAY_NAME[key]} · ${ctx.fmtDate(d.date)} · ${esc(d.origin)}</div>
        <h2>${esc(d.dish)}</h2>
        <div class="src">With: ${esc(d.side.name)}</div>
      </div>
      ${dishTags(d)}
      <div class="meta">
        <span class="pill time">${d.minutes.hands} min hands-on</span>
        <span class="pill time">${d.minutes.total} min total</span>
        <span class="pill feeds">${esc(d.feeds)}</span>
      </div>
      <div class="callout olive">${esc(d.headsUp)}</div>
      ${d.wheat !== "free" ? `<div class="callout">${esc(d.wheatNote)}</div>` : ""}
      <div style="display:grid;gap:8px"><h3>Ingredients</h3>${ingredientList(ctx, d)}</div>
      <div style="display:grid;gap:10px"><h3>Method</h3><ol class="steps">${d.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol></div>
      <div style="display:grid;gap:10px"><h3>Side: ${esc(d.side.name)}</h3><ol class="steps">${d.side.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol></div>
      ${d.pairing ? `<div class="callout olive">Optional pairing: ${esc(d.pairing.text)}</div>` : ""}
      <div class="foot">${d.notes.map((n) => `<span>${esc(n)}</span>`).join("")}
        <span>${esc(d.source.label)}, written for this demo.</span></div>
      <div class="foot-actions">${likeButton(ctx, d)}</div>
    </article>`;
}

export function bindCook(root, actions) {
  root.querySelectorAll("[data-like]").forEach((b) => b.addEventListener("click", () => actions.toggleLike(b.dataset.like, b)));
}

export const defaultCookDay = (week, today) => {
  const hit = week.days.find((d) => d.date === today);
  if (hit) return hit.key;
  return today < week.days[0].date ? "wknd" : DAY_KEYS[1];
};
