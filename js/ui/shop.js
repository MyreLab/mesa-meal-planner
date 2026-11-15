import { CHECK_SVG } from "./icons.js";
import { DAY_LAB, esc, itemDays } from "./util.js";

function itemRow(ctx, item, daysOf) {
  const on = !!ctx.state.checked[item.id], cur = ctx.storeOf(item.id);
  const days = (daysOf.get(item.id) || []).map((d) => `<span>${DAY_LAB[d]}</span>`).join("");
  const seg = ctx.stores.map((s) => `<button type="button" data-id="${esc(item.id)}" data-s="${esc(s.id)}" aria-pressed="${s.id === cur}" class="${s.id === cur && s.id !== item.store ? "moved" : ""}" aria-label="Get ${esc(item.name)}: ${esc(s.name)}">${esc(s.short)}</button>`).join("");
  return `<div class="item${on ? " checked" : ""}">
    <label for="cb-${esc(item.id)}"><input type="checkbox" id="cb-${esc(item.id)}" data-id="${esc(item.id)}"${on ? " checked" : ""}><span class="box">${CHECK_SVG}</span></label>
    <label for="cb-${esc(item.id)}" class="nm">${esc(item.name)}${item.note ? `<span class="nt">${esc(item.note)}</span>` : ""}</label>
    <span class="qq">${esc(item.qty)}</span>
    <div class="under"><span class="days">${days}</span><span class="seg" role="group" aria-label="Where to get it">${seg}</span></div>
  </div>`;
}

export function listText(ctx) {
  const lines = [`Groceries - ${ctx.week.title}`, ""];
  ctx.stores.forEach((s) => {
    const list = ctx.week.items.filter((i) => ctx.storeOf(i.id) === s.id && !ctx.state.checked[i.id]);
    if (!list.length) return;
    lines.push(s.purchase === false ? "CHECK AT HOME" : s.name.toUpperCase());
    list.forEach((i) => lines.push(`${i.name}${i.qty ? ` - ${i.qty}` : ""}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

export function renderShop(ctx) {
  const daysOf = itemDays(ctx.week);
  const buyStores = ctx.stores.filter((s) => s.purchase !== false);
  const counts = Object.fromEntries(ctx.stores.map((s) => [s.id, ctx.week.items.filter((i) => ctx.storeOf(i.id) === s.id).length]));
  const moved = Object.keys(ctx.state.store).length;
  const sections = ctx.stores.map((s, idx) => {
    const list = ctx.week.items.filter((i) => ctx.storeOf(i.id) === s.id);
    const aisles = [...new Set(list.map((i) => i.aisle))];
    const rows = list.length
      ? aisles.map((a) => `<div class="aisle">${esc(a)}</div>` + list.filter((i) => i.aisle === a).map((i) => itemRow(ctx, i, daysOf)).join("")).join("")
      : `<p class="empty">Nothing on this list. Move items here with the ${esc(s.short)} button on any item.</p>`;
    const hint = s.purchase === false
      ? `<p class="note">Tick what you have. Out of something? Tap ${buyStores.map((b) => esc(b.short)).join(" or ")} to add it to that store's list.</p>`
      : idx === 0 && list.length ? `<p class="note">The quantity on the right is what this week's recipes use, not the pack size.</p>` : "";
    return `<div class="store" data-store="${esc(s.id)}">
      <div class="store-head">
        <div class="store-title"><h2>${esc(s.name)}</h2><span class="count" id="cnt-${esc(s.id)}"></span></div>
        <div class="bar"><i id="bar-${esc(s.id)}"></i></div>
        ${hint}
      </div>${rows}</div>`;
  }).join("");
  const quick = buyStores.map((s) => `<button class="btn ghost small" type="button" data-all="${esc(s.id)}">All ${esc(s.name)}</button>`).join("");
  return `
    <div class="planner">
      <h3>Where are we buying it?</h3>
      <div class="split">${ctx.stores.map((s) => `<div class="${counts[s.id] ? "on" : ""}"><b>${counts[s.id]}</b><span>${esc(s.name)}</span></div>`).join("")}</div>
      <p class="note">Each item has a ${ctx.stores.map((s) => esc(s.short)).join(" / ")} switch. Lists below regroup as you change them${moved ? `; <b style="color:var(--ochre)">${moved} moved</b> from the suggested split` : ""}.</p>
      <div class="quick"><span class="lab">Set everything to buy:</span>${quick}<button class="btn ghost small" type="button" data-all="def">Suggested split</button></div>
    </div>
    <div class="shop-bar">
      <label class="toggle" for="hide-done"><input type="checkbox" id="hide-done"${ctx.hide ? " checked" : ""}> Hide ticked items</label>
      <span class="grow"></span>
      <button class="btn ghost" id="reset" type="button">Clear ticks</button>
      <button class="btn" id="copy" type="button">Copy list</button>
    </div>
    <p class="sync" id="sync" data-s="${ctx.storage.kind === "memory" ? "stale" : "live"}" aria-live="polite">${esc(ctx.storage.label)}</p>
    <div id="copy-msg" aria-live="polite"></div>
    <div id="lists" class="${ctx.hide ? "hide-done" : ""}" style="display:grid;gap:16px">${sections}</div>`;
}

export function updateCounts(ctx) {
  ctx.stores.forEach((s) => {
    const list = ctx.week.items.filter((i) => ctx.storeOf(i.id) === s.id);
    const done = list.filter((i) => ctx.state.checked[i.id]).length;
    const c = document.getElementById("cnt-" + s.id), b = document.getElementById("bar-" + s.id);
    if (c) c.textContent = `${done} / ${list.length}`;
    if (b) b.style.width = (list.length ? (done / list.length) * 100 : 0) + "%";
  });
}

export function bindShop(root, ctx, actions) {
  updateCounts(ctx);
  root.querySelectorAll("#lists input[type=checkbox]").forEach((cb) => cb.addEventListener("change", (e) => {
    actions.tick(e.target.dataset.id, e.target.checked);
    e.target.closest(".item").classList.toggle("checked", e.target.checked);
    updateCounts(ctx);
  }));
  root.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => actions.setStore(b.dataset.id, b.dataset.s)));
  root.querySelectorAll("[data-all]").forEach((b) => b.addEventListener("click", () => actions.setAllStores(b.dataset.all)));
  root.querySelector("#hide-done").addEventListener("change", (e) => {
    actions.setHide(e.target.checked);
    root.querySelector("#lists").classList.toggle("hide-done", e.target.checked);
  });
  const reset = root.querySelector("#reset");
  let armed = false;
  reset.addEventListener("click", () => {
    if (!armed) {
      armed = true; reset.textContent = "Tap again to clear"; reset.classList.add("warn");
      setTimeout(() => { armed = false; reset.textContent = "Clear ticks"; reset.classList.remove("warn"); }, 3000);
      return;
    }
    actions.clearTicks();
  });
  root.querySelector("#copy").addEventListener("click", () => copyList(ctx, root));
}

function copyList(ctx, root) {
  const msg = root.querySelector("#copy-msg"), text = listText(ctx);
  const ok = () => { msg.innerHTML = `<p class="copied">Copied the unticked items.</p>`; };
  const fail = () => {
    msg.innerHTML = `<p class="note">Copy is not available here. Select the text below and copy it.</p><textarea class="fallback" id="fallback-text" readonly>${esc(text)}</textarea>`;
    const t = root.querySelector("#fallback-text"); t.focus(); t.select();
  };
  try { navigator.clipboard.writeText(text).then(ok, fail); } catch { fail(); }
}
