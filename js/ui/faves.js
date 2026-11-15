import { ICON, PROTEIN } from "./icons.js";
import { esc, fmtDate } from "./util.js";
import { addDays, cooldown, dueFavorites, returnDate } from "../randomizer.js";

export function renderFaves(ctx) {
  const { rules, nextWeek, today } = ctx;
  const list = Object.values(ctx.favs).sort((a, b) => returnDate(a, rules).localeCompare(returnDate(b, rules)));
  const rows = list.map((f) => {
    const { back, left, due, pct } = cooldown(f, today, rules);
    return `<div class="fav">
      <span>${ICON[f.protein] ? ICON[f.protein](PROTEIN[f.protein] || "") : ""}</span>
      <span class="nm">${esc(f.dish)}<small>Last had ${fmtDate(f.lastCooked)} · back from ${fmtDate(back)}</small></span>
      <span class="chip ${due ? "due" : "wait"}">${due ? "Due back" : `${left} day${left === 1 ? "" : "s"}`}</span>
      <div class="chips">
        ${f.slot === "weekend" ? `<span class="chip">Weekend only</span>` : `<span class="chip">Any day</span>`}
        ${f.premium ? `<span class="chip">Premium protein</span>` : ""}
        ${f.note ? `<span class="chip">${esc(f.note)}</span>` : ""}
      </div>
      <div class="tl-bar" style="grid-column:2 / -1" aria-hidden="true"><i style="width:${pct}%"></i></div>
    </div>`;
  }).join("");

  const due = dueFavorites(list, nextWeek, rules);
  const next = list[0];
  const weekLabel = `${fmtDate(addDays(nextWeek, -1))} - ${fmtDate(addDays(nextWeek, 4))}`;
  const roll = ctx.roll;
  const picksHtml = roll && roll.picks && roll.picks.length
    ? `<ul class="picks">${roll.picks.map((p) => { const f = ctx.favs[p.id]; return `<li>${f && ICON[f.protein] ? ICON[f.protein]("") : ""}${esc(p.dish)}${p.earliest ? ` <span class="chip wait">from ${fmtDate(p.earliest)}</span>` : ""}${p.slot === "weekend" ? ` <span class="chip">Weekend</span>` : ""}</li>`; }).join("")}</ul>
       <p class="note">Saved. These go into the plan when the next week is built.</p>`
    : roll ? `<p class="note">Rolled: nothing was due back for this week.</p>` : "";
  return `
    <div class="rollbox">
      <h3>Next week's favourites · ${weekLabel}</h3>
      ${due.length
        ? `<p class="note">${due.length} favourite${due.length === 1 ? " is" : "s are"} due back. The roll picks up to ${rules.maxPicks} at random, with at most ${rules.maxPremium} premium protein dish and ${rules.maxWeekendOnly} weekend-only dish.</p>`
        : `<p class="note">Nothing is due back for this week yet.${next ? ` First to return: <b>${esc(next.dish)}</b> from ${fmtDate(returnDate(next, rules))}.` : ""}</p>`}
      ${picksHtml}
      <div class="foot-actions"><button class="btn" type="button" id="roll"${due.length ? "" : " disabled"}>${roll && roll.picks && roll.picks.length ? "Roll again" : "Roll favourites"}</button></div>
      <div id="roll-msg" aria-live="polite"></div>
    </div>
    <div style="display:grid;gap:8px">
      <h3>In the rotation</h3>
      <p class="note">Each liked dish comes back no sooner than ${Math.round(rules.minGapDays / 7)} weeks after you last had it. Tap <b>We liked this</b> on any dish card to add it. Dishes over ${rules.weekendOnlyOverMinutes} minutes are weekend-only.</p>
    </div>
    ${list.length ? `<div class="faves">${rows}</div>` : `<div class="rollbox"><p class="note">No favourites yet. Tap <b>We liked this</b> on any dish card after you have had it.</p></div>`}`;
}

export function bindFaves(root, actions) {
  const btn = root.querySelector("#roll");
  if (btn) btn.addEventListener("click", () => actions.roll());
}
