// Loads config + the current week, restores saved state, and renders the four tabs.
// Data comes from data.js, saved state from storage.js, roll rules from randomizer.js.
import { loadConfig, loadCurrent, loadWeek, loadFavorites } from "./data.js";
import { createStorage, keys } from "./storage.js";
import * as rules from "./randomizer.js";
import { DAY_KEYS, esc, fmtDate, fmtWeekday } from "./ui/util.js";
import { renderWeek, bindWeek } from "./ui/week.js";
import { renderShop, bindShop } from "./ui/shop.js";
import { renderCook, bindCook, defaultCookDay } from "./ui/cook.js";
import { renderFaves, bindFaves } from "./ui/faves.js";

const $ = (id) => document.getElementById(id);

async function boot() {
  const [config, current, seedFavorites] = await Promise.all([loadConfig(), loadCurrent(), loadFavorites()]);
  const params = new URLSearchParams(location.search);
  const weekId = current.weeks.includes(params.get("week")) ? params.get("week") : current.week;
  const week = await loadWeek(weekId);

  const storage = createStorage();
  const stores = config.stores;
  const today = params.has("live") || !current.asOf ? localISO() : current.asOf;
  const ruleSet = { ...rules.DEFAULT_RULES, ...config.favorites };

  const ctx = {
    config, current, week, storage, stores, today, rules: ruleSet,
    nextWeek: rules.addDays(current.week, 7),
    byId: Object.fromEntries(week.items.map((i) => [i.id, i])),
    homeStore: (stores.find((s) => s.purchase === false) || stores[stores.length - 1]).id,
    state: { checked: {}, store: {} }, hide: false, favs: {}, roll: null,
    fmtDate,
    storeOf: (id) => ctx.state.store[id] || ctx.byId[id].store,
    storeIndex: (id) => stores.findIndex((s) => s.id === id),
    storeName: (id) => stores.find((s) => s.id === id)?.name ?? id,
    storeShort: (id) => stores.find((s) => s.id === id)?.short ?? id,
    isFavorite: (day) => !!ctx.favs[rules.slugify(day.dish)],
  };

  // ---------- saved state ----------
  async function hydrate() {
    const checked = {}, store = {};
    for (const { key, value } of await storage.list(keys.itemsPrefix(week.week))) {
      const id = key.split("/").pop();
      if (!ctx.byId[id] || !value) continue;
      if (value.c) checked[id] = true;
      if (value.s && stores.some((s) => s.id === value.s) && value.s !== ctx.byId[id].store) store[id] = value.s;
    }
    ctx.state = { checked, store };
    ctx.hide = (await storage.get(keys.ui("hide-ticked"))) === true;

    const favs = Object.fromEntries(seedFavorites.map((f) => [f.id, f]));
    for (const { key, value } of await storage.list(keys.favoritesPrefix)) {
      const id = key.slice(keys.favoritesPrefix.length);
      if (value?.removed) delete favs[id]; else if (value?.dish) favs[id] = value;
    }
    ctx.favs = favs;
    ctx.roll = await storage.get(keys.rotation(ctx.nextWeek));
  }

  async function persistItem(id) {
    const c = !!ctx.state.checked[id], s = ctx.state.store[id] || null;
    if (c || s) await storage.set(keys.item(week.week, id), { c, s });
    else await storage.remove(keys.item(week.week, id));
  }

  // ---------- actions ----------
  const actions = {
    async tick(id, on) { if (on) ctx.state.checked[id] = true; else delete ctx.state.checked[id]; await persistItem(id); },
    async setStore(id, s) {
      if (s === ctx.byId[id].store) delete ctx.state.store[id]; else ctx.state.store[id] = s;
      await persistItem(id); rerender();
    },
    async setAllStores(target) {
      const changed = [];
      for (const item of week.items) {
        const before = ctx.storeOf(item.id);
        if (target === "def") delete ctx.state.store[item.id];
        else if (before !== ctx.homeStore) { if (target === item.store) delete ctx.state.store[item.id]; else ctx.state.store[item.id] = target; }
        if (ctx.storeOf(item.id) !== before) changed.push(item.id);
      }
      await Promise.all(changed.map(persistItem)); rerender();
    },
    async clearTicks() {
      const ids = Object.keys(ctx.state.checked); ctx.state.checked = {};
      await Promise.all(ids.map(persistItem)); rerender();
    },
    async setHide(on) { ctx.hide = on; await storage.set(keys.ui("hide-ticked"), on); },
    async toggleLike(dayKey, button) {
      const day = week.days.find((d) => d.key === dayKey), id = rules.slugify(day.dish);
      if (ctx.favs[id]) {
        if (likeArmed !== id) {
          likeArmed = id; button.textContent = "Tap again to remove"; button.classList.add("warn");
          setTimeout(() => { if (likeArmed === id) { likeArmed = null; rerender(); } }, 3000);
          return;
        }
        likeArmed = null;
        const seeded = seedFavorites.some((f) => f.id === id);
        delete ctx.favs[id]; rerender();
        if (seeded) await storage.set(keys.favorite(id), { removed: true }); else await storage.remove(keys.favorite(id));
        return;
      }
      const fav = { id, dish: day.dish, short: day.short, protein: day.protein, slot: rules.slotFor(day.minutes.total, ctx.rules),
        totalMinutes: day.minutes.total, premium: !!day.premium, lastCooked: day.date, note: "" };
      ctx.favs[id] = fav; rerender();
      await storage.set(keys.favorite(id), fav);
    },
    async roll() {
      const picks = rules.rollPicks(Object.values(ctx.favs), ctx.nextWeek, ctx.rules);
      ctx.roll = { picks, rolledAt: new Date().toISOString(), week: ctx.nextWeek };
      rerender();
      await storage.set(keys.rotation(ctx.nextWeek), ctx.roll);
    },
    async resetDemo() { await storage.clear(); await hydrate(); rerender(); },
  };
  let likeArmed = null, cookDay = null;

  // ---------- rendering ----------
  function renderHeader() {
    const buy = stores.filter((s) => s.purchase !== false).map((s) => s.name).join(" + ");
    const shopDay = week.shopDay;
    const pastBadge = week.week < current.week ? ` <span class="badge-past">Past week</span>` : "";
    $("eyebrow").textContent = `Shop ${fmtWeekday(shopDay)} ${fmtDate(shopDay)} · ${buy}`;
    $("title").innerHTML = `Mesa, week of ${esc(fmtDate(week.week))}${pastBadge}`;
    $("summary").textContent = week.summary;
    $("weeknav").innerHTML = current.weeks.length > 1
      ? `<span class="lab">Weeks</span><span class="seg" role="group" aria-label="Choose a week">${current.weeks.map((w) => `<button type="button" data-week="${w}" aria-pressed="${w === week.week}">${fmtDate(w)}</button>`).join("")}</span>`
      : "";
    $("weeknav").querySelectorAll("[data-week]").forEach((b) => b.addEventListener("click", () => {
      const url = new URL(location.href);
      if (b.dataset.week === current.week) url.searchParams.delete("week"); else url.searchParams.set("week", b.dataset.week);
      location.href = url.toString();
    }));
  }

  function renderRules() {
    const c = config;
    $("rules").innerHTML = `<summary>House rules in this demo (data/config.json)</summary>
      <ul class="rule-list">
        <li>${c.week.dinners} dinners for ${c.household.people}: one weekend "use up the fridge" dish, then ${c.week.weeknightDinners} weeknights of ${c.cooking.weeknightMaxMinutes} minutes or less.</li>
        <li>Never on the menu: ${c.excludedIngredients.map(esc).join(", ")}.</li>
        <li>Shop day: ${esc(c.week.shopDay)}. Stores: ${c.stores.filter((s) => s.purchase !== false).map((s) => esc(s.name)).join(", ")}.</li>
        <li>Premium proteins (${c.budget.premiumProteins.map(esc).join(", ")}): at most ${c.budget.premiumMaxPerMonth} a month. Fresh fish early in the week.</li>
        <li>Favourites return ${c.favorites.minGapDays}+ days after they were last cooked, up to ${c.favorites.maxPicks} a week.</li>
      </ul>`;
  }

  function rerender() {
    const y = window.scrollY;
    $("v-week").innerHTML = renderWeek(ctx); bindWeek($("v-week"), actions);
    $("v-shop").innerHTML = renderShop(ctx); bindShop($("v-shop"), ctx, actions);
    $("v-faves").innerHTML = renderFaves(ctx); bindFaves($("v-faves"), actions);
    if (cookDay) { $("v-cook").innerHTML = renderCook(ctx, cookDay); bindCook($("v-cook"), actions); }
    window.scrollTo(0, y);
  }

  function route() {
    const h = (location.hash || "#week").slice(1);
    let tab = "week", day = null;
    if (h === "shop") tab = "shop";
    else if (h === "faves") tab = "faves";
    else if (DAY_KEYS.includes(h)) { tab = "cook"; day = h; }
    cookDay = day;
    ["week", "shop", "cook", "faves"].forEach((t) => { $("v-" + t).hidden = t !== tab; });
    document.querySelectorAll("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
    if (tab === "cook") { $("v-cook").innerHTML = renderCook(ctx, day); bindCook($("v-cook"), actions); window.scrollTo(0, 0); }
  }

  await hydrate();
  document.querySelector('nav.tabs a[data-tab="cook"]').setAttribute("href", "#" + defaultCookDay(week, today));
  renderHeader(); renderRules();
  rerender();
  window.addEventListener("hashchange", route);
  route();
  storage.subscribe(async () => { await hydrate(); rerender(); }); // another tab changed the saved state

  const resetBtn = $("reset-demo");
  let armed = false;
  resetBtn.addEventListener("click", () => {
    if (!armed) {
      armed = true; resetBtn.textContent = "Tap again to reset";
      setTimeout(() => { armed = false; resetBtn.textContent = "Reset demo data"; }, 3000);
      return;
    }
    armed = false; resetBtn.textContent = "Reset demo data"; actions.resetDemo();
  });
  document.body.dataset.ready = "true";
}

function localISO() {
  const t = new Date();
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

boot().catch((err) => {
  console.error(err);
  $("v-week").hidden = false;
  $("v-week").innerHTML = `<div class="err"><b>Mesa could not start.</b><br>${esc(err.message)}<br>If you opened index.html directly, serve the folder instead: <code>python3 -m http.server</code>, then open http://localhost:8000.</div>`;
});
