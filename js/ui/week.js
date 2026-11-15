import { ICON, PROTEIN, WHEAT } from "./icons.js";
import { DAY_KEYS, DAY_NAME, DAY_LAB, esc, usesUp } from "./util.js";

export function dishTags(day) {
  const w = WHEAT[day.wheat];
  return `<div class="tags">
    <span class="tag">${ICON[day.protein](PROTEIN[day.protein])}${esc(day.proteinLabel)}</span>
    <span class="tag ${w.cls}" title="${esc(day.wheatNote)}">${ICON[w.icon](w.label)}${w.label}</span>
  </div>`;
}

const storeChip = (ctx, id) => `<span class="st s${ctx.storeIndex(id)}" title="${esc(ctx.storeName(id))}">${esc(ctx.storeShort(id))}</span>`;

export function ingredientList(ctx, day) {
  const row = (g) => `<li>${storeChip(ctx, ctx.storeOf(g.item))}<span>${g.qty ? `<span class="q">${esc(g.qty)}</span> ` : ""}${esc(g.text)}</span></li>`;
  return `<ul class="ing">${day.ingredients.map(row).join("")}<li><span class="side-lab">Side: ${esc(day.side.name)}</span></li>${day.side.ingredients.map(row).join("")}</ul>`;
}

export function likeButton(ctx, day) {
  const on = ctx.isFavorite(day);
  return `<button type="button" class="like" data-like="${day.key}" aria-pressed="${on}">${ICON.heart("")}${on ? "In the rotation" : "We liked this"}</button>`;
}

function iconKey(week) {
  const proteins = Object.keys(PROTEIN).filter((k) => week.days.some((d) => d.protein === k));
  return `<div class="icon-key">
    <div class="row"><b>Protein</b>${proteins.map((k) => `<span>${ICON[k](PROTEIN[k])}${PROTEIN[k]}</span>`).join("")}</div>
    <div class="row"><b>Wheat</b><span style="color:var(--accent)">${ICON.wheatFree("Wheat-free")}none</span><span style="color:var(--ochre)">${ICON.wheat("Check label")}wheat-free if labels check</span><span style="color:var(--wheat)">${ICON.wheat("Contains wheat")}contains wheat</span></div>
  </div>`;
}

export function renderWeek(ctx) {
  const { week, byId } = ctx;
  const dayOf = Object.fromEntries(week.days.map((d) => [d.key, d]));
  const lunches = DAY_KEYS.filter((k) => week.lunches[k]).length;
  const toBuy = week.items.filter((i) => ctx.storeOf(i.id) !== ctx.homeStore).length;
  const stores = new Set(week.items.map((i) => ctx.storeOf(i.id)).filter((s) => s !== ctx.homeStore)).size;
  const dayNum = (k) => dayOf[k].date.slice(8).replace(/^0/, "");

  const GRID_LAB = { ...DAY_LAB, wknd: "Wknd" };
  const head = [`<div></div>`, ...DAY_KEYS.map((k) => `<div class="hd${k === "wknd" ? " wk" : ""}">${GRID_LAB[k]}<small>${dayNum(k)}</small></div>`)];
  const dinners = [`<div class="row-lab">Dinner</div>`, ...DAY_KEYS.map((k) => {
    const d = dayOf[k], w = WHEAT[d.wheat];
    const tone = d.wheat === "free" ? "accent" : d.wheat === "check" ? "ochre" : "wheat";
    return `<a class="cell din${k === "wknd" ? " wk" : ""}" href="#${k}"><span style="display:flex;gap:3px">${ICON[d.protein](PROTEIN[d.protein])}<span style="color:var(--${tone});display:inline-flex">${ICON[w.icon](w.label)}</span></span><b>${esc(d.short)}</b><span class="x">\u00d7${d.portions}</span></a>`;
  })];
  const lunchRow = [`<div class="row-lab">Lunch</div>`, ...DAY_KEYS.map((k) => {
    const from = week.lunches[k];
    return from
      ? `<a class="cell lun" href="#${from}"><span style="display:flex">${ICON[dayOf[from].protein](PROTEIN[dayOf[from].protein])}</span><b>${esc(dayOf[from].short)}</b><span class="from">from ${DAY_LAB[from]}</span></a>`
      : `<div class="cell none${k === "wknd" ? " wk" : ""}"><span class="from">no packed lunch</span></div>`;
  })];

  const cards = week.days.map((d) => {
    const uses = usesUp(d, byId);
    const pairing = d.pairing ? `<div class="callout olive">Optional pairing: ${esc(d.pairing.text)}</div>` : "";
    return `
    <article class="day${d.key === "wknd" ? " wknd" : ""}" id="card-${d.key}">
      <div style="min-width:0;display:grid;gap:2px">
        <div class="day-name">${DAY_NAME[d.key]} · ${ctx.fmtDate(d.date)} · ${d.key === "wknd" ? "use up the fridge" : esc(d.origin)}</div>
        <h2>${esc(d.dish)}</h2>
        <div class="src">Side: ${esc(d.side.name)}</div>
      </div>
      ${dishTags(d)}
      <div class="meta">
        <span class="pill time">${d.minutes.hands} min hands-on</span>
        <span class="pill time">${d.minutes.total} min total</span>
        <span class="pill feeds">${esc(d.feeds)}</span>
        ${d.premium ? `<span class="pill">Premium protein</span>` : ""}
        ${uses.length ? `<span class="pill">Uses up: ${esc(uses.join(", "))}</span>` : ""}
      </div>
      ${ingredientList(ctx, d)}
      <div class="heads">${esc(d.headsUp)}</div>
      ${pairing}
      <div class="day-foot">
        <span class="foot-actions"><a class="btn" href="#${d.key}">Cook ${d.key === "wknd" ? "it" : DAY_LAB[d.key]}</a>${likeButton(ctx, d)}</span>
        ${d.source.url ? `<a href="${esc(d.source.url)}" target="_blank" rel="noopener">${esc(d.source.label)}</a>` : `<span class="src">${esc(d.source.label)}</span>`}
      </div>
    </article>`;
  }).join("");

  const legend = ctx.stores.map((s, i) => `<span class="st s${i}" style="padding:0 6px">${esc(s.short)}</span> ${esc(s.name)}`).join(" · ");

  return `
    <div class="stats">
      <div class="stat"><div class="n">${week.days.length}</div><div class="l">dinners for ${ctx.config.household.people} (1 weekend + ${week.days.length - 1} weeknights)</div></div>
      <div class="stat"><div class="n">${lunches}</div><div class="l">lunches, no extra cooking</div></div>
      <div class="stat"><div class="n">${toBuy}</div><div class="l">things to buy, ${stores} ${stores === 1 ? "store" : "stores"}</div></div>
    </div>
    <div class="flow">
      <h3>How the week feeds itself</h3>
      <div class="flow-grid">${[...head, ...dinners, ...lunchRow].join("")}</div>
      <div class="legend"><span class="l1">cooked that night (\u00d7portions)</span><span class="l2">packed lunch, from an earlier dinner</span></div>
      ${iconKey(week)}
    </div>
    <p class="note">Store tags follow your choices on the Shop tab: ${legend}.</p>
    ${cards}`;
}

export function bindWeek(root, actions) {
  root.querySelectorAll("[data-like]").forEach((b) => b.addEventListener("click", () => actions.toggleLike(b.dataset.like, b)));
}
