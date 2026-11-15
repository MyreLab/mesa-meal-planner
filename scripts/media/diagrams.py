"""Renders the README diagrams and charts to docs/diagrams/*.png.

Usage:  python3 scripts/media/diagrams.py
Needs:  pip install playwright (and a Chromium/Chrome; set CHROME_PATH to use a system Chrome)
Charts read live numbers from `node scripts/simulate-rolls.mjs --json` and data/favorites.json,
so they stay in step with the sample data.
"""
import json, os, subprocess, tempfile, datetime as dt
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "diagrams"
FONTS = (ROOT / "assets" / "fonts").as_uri()
OUT.mkdir(parents=True, exist_ok=True)

CSS = f"""
@font-face {{ font-family: Figtree; font-weight: 400; src: url({FONTS}/figtree-latin-400-normal.woff2); }}
@font-face {{ font-family: Figtree; font-weight: 600; src: url({FONTS}/figtree-latin-600-normal.woff2); }}
@font-face {{ font-family: Figtree; font-weight: 700; src: url({FONTS}/figtree-latin-700-normal.woff2); }}
@font-face {{ font-family: "Young Serif"; src: url({FONTS}/young-serif-latin-400-normal.woff2); }}
@font-face {{ font-family: "IBM Plex Mono"; font-weight: 400; src: url({FONTS}/ibm-plex-mono-latin-400-normal.woff2); }}
@font-face {{ font-family: "IBM Plex Mono"; font-weight: 500; src: url({FONTS}/ibm-plex-mono-latin-500-normal.woff2); }}
:root {{ --bg:#F4F1F8; --surface:#fff; --ink:#221C2B; --muted:#645B70; --line:#E0D8EA; --accent:#5B3790; --accent-soft:#ECE3F7; --ochre:#9A6A12; --ochre-soft:#F4E8CF; --wheat:#A33A26; --wheat-soft:#F6DED7; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: var(--bg); font-family: Figtree, sans-serif; color: var(--ink); }}
svg text {{ font-family: Figtree, sans-serif; fill: var(--ink); }}
svg .t {{ font-weight: 600; font-size: 16px; }}
svg .s {{ font-size: 13px; fill: var(--muted); }}
svg .m {{ font-family: "IBM Plex Mono", monospace; font-size: 12.5px; fill: var(--ink); }}
svg .mm {{ font-family: "IBM Plex Mono", monospace; font-size: 12px; fill: var(--muted); }}
svg .h {{ font-family: "Young Serif", serif; font-size: 26px; }}
svg .eyebrow {{ font-size: 12px; font-weight: 700; letter-spacing: .08em; fill: var(--muted); text-transform: uppercase; }}
svg .lab {{ font-size: 12.5px; font-weight: 600; fill: var(--muted); }}
"""

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

class Svg:
    def __init__(self, w, h, title, subtitle=None):
        self.w, self.h, self.parts = w, h, []
        self.parts.append(f'<text class="h" x="40" y="52">{esc(title)}</text>')
        if subtitle: self.parts.append(f'<text class="s" x="40" y="76" style="font-size:14px">{esc(subtitle)}</text>')
    def add(self, s): self.parts.append(s)
    def group(self, x, y, w, h, label):
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="none" stroke="#CFC4E0" stroke-dasharray="5 5"/>')
        self.add(f'<text class="eyebrow" x="{x+16}" y="{y+24}">{esc(label)}</text>')
    def box(self, x, y, w, h, title, lines=(), fill="#fff", stroke="#E0D8EA", mono=False, dash=False, accent=None, tcls="t"):
        d = ' stroke-dasharray="6 4"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="{stroke}" stroke-width="1.5"{d}/>')
        if accent: self.add(f'<rect x="{x}" y="{y+10}" width="4" height="{h-20}" rx="2" fill="{accent}"/>')
        cls = "m" if mono else tcls
        ty = y + 26
        self.add(f'<text class="{cls}" x="{x+16}" y="{ty}" style="{"font-weight:500;font-size:14px" if mono else ""}">{esc(title)}</text>')
        for i, ln in enumerate(lines):
            self.add(f'<text class="s" x="{x+16}" y="{ty+22+i*19}">{esc(ln)}</text>')
    def arrow(self, pts, dash=False, color="#5B3790", label=None, lx=None, ly=None, anchor="middle"):
        d = "M" + " L".join(f"{x},{y}" for x, y in pts)
        dash_attr = ' stroke-dasharray="6 5"' if dash else ""
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="2"{dash_attr} marker-end="url(#a{color[1:]})" stroke-linejoin="round"/>')
        if label:
            x, y = (lx, ly) if lx is not None else ((pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2 - 8)
            tw = len(label) * 6.6 + 12
            bx = x - tw / 2 if anchor == "middle" else x - 6
            self.add(f'<rect x="{bx}" y="{y-13}" width="{tw}" height="19" rx="9" fill="#F4F1F8"/>')
            self.add(f'<text class="mm" x="{x if anchor=="middle" else x}" y="{y}" text-anchor="{anchor}" style="fill:{color if color!="#5B3790" else "#645B70"}">{esc(label)}</text>')
    def render(self):
        colors = ["#5B3790", "#645B70", "#A33A26", "#9A6A12"]
        defs = "".join(f'<marker id="a{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="{c}"/></marker>' for c in colors)
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}"><defs>{defs}</defs><rect width="{self.w}" height="{self.h}" fill="#F4F1F8"/>{"".join(self.parts)}</svg>'

# ------------------------------------------------------------------ diagrams
def architecture():
    s = Svg(1200, 760, "Architecture: ports and adapters, no build step",
            "Rendering code never knows where data or saved state lives. Both sit behind a small interface.")
    P, A = "#5B3790", "#ECE3F7"
    s.group(30, 100, 290, 500, "Presentation")
    s.box(48, 136, 254, 74, "index.html + css/styles.css", ["App shell, tabs, self-hosted fonts"], mono=False)
    for i, (n, d) in enumerate([("Week", "flow grid + day cards"), ("Shop", "aisles, store switch, ticks"), ("Cook", "recipe + side per day"), ("Faves", "rotation + roll button")]):
        s.box(48, 226 + i * 88, 254, 74, f"ui/{n.lower()}.js", [d], mono=True, fill="#fff")
    s.group(350, 100, 270, 500, "Application")
    s.box(368, 136, 234, 440, "app.js", ["Loads config and the week,", "restores saved state,", "owns the action handlers", "(tick, switch store, like,", "roll) and re-renders.", "", "Talks to the three modules", "on the right and nothing else."], mono=True, fill=A, stroke=P, accent=P)
    s.group(650, 100, 520, 500, "Ports and adapters")
    s.box(668, 136, 220, 96, "data.js", ["READ port", "loadConfig / Current /", "Week / Favorites"], mono=True, accent=P)
    s.box(940, 136, 214, 96, "data/*.json", ["Static files fetched by URL", "Written by the planning run"], mono=True, fill="#fff")
    s.box(668, 262, 220, 112, "storage.js", ["STATE port", "get / set / remove /", "list(prefix) / subscribe"], mono=True, accent=P)
    s.box(940, 262, 214, 52, "localStorage adapter", [], mono=True)
    s.add('<text class="s" x="956" y="334" style="font-size:12px">Today. Per device, no server.</text>')
    s.box(940, 346, 214, 84, "HTTP adapter + D1", ["Roadmap: shared between", "two phones"], mono=True, dash=True, stroke="#9A6A12", fill="#F4E8CF")
    s.box(668, 440, 220, 112, "randomizer.js", ["PURE functions, no I/O", "Seedable RNG, so every", "roll is reproducible"], mono=True, accent=P)
    s.box(940, 440, 214, 112, "Roll rules", ["28-day gap vs. real cook day", "max 2 picks, 1 premium,", "1 weekend-only dish"], mono=False)
    # arrows
    for i in range(4): s.arrow([(368, 262 + i * 88), (302, 262 + i * 88)], color="#645B70")
    s.arrow([(368, 173), (302, 173)], color="#645B70")
    s.arrow([(602, 184), (668, 184)], label="load", lx=635, ly=172)
    s.arrow([(602, 318), (668, 318)], label="save", lx=635, ly=306)
    s.arrow([(602, 496), (668, 496)], label="call", lx=635, ly=484)
    s.arrow([(888, 184), (940, 184)])
    s.arrow([(888, 288), (940, 288)])
    s.arrow([(888, 340), (940, 379)], dash=True, color="#9A6A12")
    s.arrow([(888, 496), (940, 496)], color="#645B70")
    s.add('<text class="s" x="1000" y="124" style="font-size:12px"></text>')
    s.group(30, 626, 1140, 100, "Quality gate (runs in CI on every push)")
    s.box(48, 654, 360, 56, "npm test", [], mono=True)
    s.add('<text class="s" x="64" y="702" style="font-size:12px">41 tests: roll rules, storage adapter, data contract</text>')
    s.box(430, 654, 360, 56, "npm run validate", [], mono=True)
    s.add('<text class="s" x="446" y="702" style="font-size:12px">schemas + referential integrity + business rules</text>')
    s.box(812, 654, 340, 56, "simulate-rolls.mjs", [], mono=True)
    s.add('<text class="s" x="828" y="702" style="font-size:12px">10,000 seeded rolls, zero rule violations</text>')
    return s.render()

def pipeline():
    s = Svg(1200, 700, "How a week gets planned: a small data pipeline",
            "In real use Claude runs the planning step on a schedule. Mesa is the front end that reads its output.")
    P = "#5B3790"
    xs = [40, 330, 620, 910]; w = 250; y1, y2, h = 120, 360, 110
    n1 = [("1  Scheduled run", ["Starts the weekly planning", "job. No one has to remember."]),
          ("2  Ask the household", ["What is left in the fridge?", "Which dishes did we like?"]),
          ("3  Read the inputs", ["playbook, config.json,", "favourites, saved roll"]),
          ("4  Write the week", ["data/weeks/<monday>.json", "plus the updated current.json"])]
    for x, (t, l) in zip(xs, n1): s.box(x, y1, w, h, t, l, accent=P)
    n2 = [("5  Validation gate", ["Schema, integrity, rules.", "A bad week stops here."], "#ECE3F7", P),
          ("6  Publish", ["Commit to the repo (history", "of every week for free)."], "#fff", "#E0D8EA"),
          ("7  Static hosting", ["GitHub Pages serves the", "JSON next to the page."], "#fff", "#E0D8EA"),
          ("8  App reads it", ["data.js fetches the week,", "app.js renders four tabs."], "#fff", "#E0D8EA")]
    for x, (t, l, f, st) in zip(xs, n2): s.box(x, y2, w, h, t, l, fill=f, stroke=st, accent=P if f != "#fff" else None)
    for i in range(3): s.arrow([(xs[i] + w, y1 + 55), (xs[i + 1], y1 + 55)])
    for i in range(3): s.arrow([(xs[i] + w, y2 + 55), (xs[i + 1], y2 + 55)])
    s.arrow([(xs[3] + w / 2, y1 + h), (xs[3] + w / 2, 305), (xs[0] + w / 2, 305), (xs[0] + w / 2, y2)], label="validate before publishing", lx=600, ly=297)
    # failure loop
    s.arrow([(xs[0] + w / 2 + 60, y2), (xs[0] + w / 2 + 60, 330), (xs[3] + w / 2 - 60, 330), (xs[3] + w / 2 - 60, y1 + h)], dash=True, color="#A33A26", label="fails: fix the week and retry", lx=600, ly=350)
    # state loop
    s.box(xs[3], 560, w, 96, "Saved state", ["ticks, store choices, likes,", "rolls via storage.js"], fill="#F4E8CF", stroke="#9A6A12", accent="#9A6A12")
    s.arrow([(xs[3] + w / 2, y2 + h), (xs[3] + w / 2, 560)], color="#9A6A12", dash=True)
    s.arrow([(xs[3], 608), (28, 608), (28, y1 + 55), (xs[0], y1 + 55)], color="#9A6A12", dash=True, label="likes and rolls feed the next run", lx=420, ly=600)
    s.add('<text class="s" x="40" y="680" style="font-size:12.5px">Solid arrows: weekly data flow. Dashed amber: the feedback loop from the household. Dashed red: the failure path.</text>')
    return s.render()

def data_model():
    s = Svg(1200, 780, "Data model: static data, saved state, one set of keys",
            "Everything is JSON. Each file has a schema in schemas/, and saved-state keys mirror the household version.")
    P = "#5B3790"
    s.group(24, 100, 360, 640, "Static data (written by the planning run)")
    s.box(40, 136, 328, 196, "config.json", ["household, week shape, cooking limits", "excludedIngredients[]", "stores[] { id, name, short, purchase }", "budget { premiumProteins, caps }", "favorites { minGapDays, maxPicks, ... }"], mono=True, accent=P)
    s.box(40, 356, 328, 106, "current.json", ["week: \"2026-11-16\"", "weeks: [ \"2026-11-09\", \"2026-11-16\" ]", "asOf: \"2026-11-14\"  (demo clock)"], mono=True, accent=P)
    s.box(40, 486, 328, 150, "favorites.json", ["favorites[] { id, dish, protein, slot,", "  premium, totalMinutes, lastCooked }", "id is the slug in favorites/<slug>", "and in rotation picks[].id"], mono=True, accent=P)
    s.group(414, 100, 400, 640, "weeks/<monday>.json")
    s.box(430, 136, 368, 150, "days[6]", ["key: wknd | mon | tue | wed | thu | fri", "ingredients[] { item, qty, text }", "side { name, ingredients[], steps[] }", "minutes, portions, wheat, premium"], mono=True, accent=P)
    s.box(430, 308, 368, 150, "items[]  (the shopping list)", ["id, name, aisle, qty, note", "store: default store id", "Days are derived from the recipes,", "never stored twice."], mono=True, accent=P)
    s.box(430, 480, 368, 96, "lunches", ["{ tue: \"mon\", wed: \"tue\", ... }", "A lunch is a leftover from an", "earlier dinner with enough portions."], mono=True, accent=P)
    s.box(430, 598, 368, 108, "meta", ["source, playbook, createdOn", "Lineage: which run wrote this", "file, under which rules."], mono=True, fill="#fff")
    s.group(844, 100, 332, 640, "Saved state (storage.js)")
    s.box(860, 136, 300, 120, "shops/w-<monday>/items/<id>", ["{ c: true, s: \"grocery\" }", "c: ticked.  s: store override", "or null for the default."], mono=True, fill="#F4E8CF", stroke="#9A6A12", accent="#9A6A12")
    s.box(860, 280, 300, 100, "favorites/<slug>", ["A liked dish, or", "{ removed: true } to hide a", "seeded favourite."], mono=True, fill="#F4E8CF", stroke="#9A6A12", accent="#9A6A12")
    s.box(860, 404, 300, 120, "rotation/w-<monday>", ["{ picks: [ { id, dish,", "  earliest } ], rolledAt }", "The saved roll for next week."], mono=True, fill="#F4E8CF", stroke="#9A6A12", accent="#9A6A12")
    s.box(860, 548, 300, 70, "ui/hide-ticked", ["Device-only preference."], mono=True, fill="#fff")
    s.add('<text class="s" x="860" y="650" style="font-size:12.5px">Every record is stored as { value, updatedAt }.</text>')
    s.add('<text class="s" x="860" y="670" style="font-size:12.5px">updatedAt is what a synced adapter</text>')
    s.add('<text class="s" x="860" y="690" style="font-size:12.5px">would use for last-write-wins.</text>')
    # relations
    s.arrow([(368, 408), (430, 408)], label="week", lx=399, ly=396)
    s.arrow([(368, 250), (400, 250), (400, 380), (430, 380)], label="store id", lx=400, ly=318)
    s.arrow([(798, 330), (830, 330), (830, 196), (860, 196)], label="item id", lx=830, ly=184)
    return s.render()

# ------------------------------------------------------------------ charts
def d(s): return dt.date.fromisoformat(s)

def rotation_chart():
    favs = json.loads((ROOT / "data" / "favorites.json").read_text())["favorites"]
    cfg = json.loads((ROOT / "data" / "config.json").read_text())["favorites"]
    cur = json.loads((ROOT / "data" / "current.json").read_text())
    gap = cfg["minGapDays"]; as_of = d(cur["asOf"])
    nxt = d(cur["week"]) + dt.timedelta(days=7)
    wk_start, wk_end = nxt - dt.timedelta(days=1), nxt + dt.timedelta(days=4)
    for f in favs:
        f["ret"] = d(f["lastCooked"]) + dt.timedelta(days=gap)
        last_slot = wk_start if f["slot"] == "weekend" else wk_end
        f["due"] = f["ret"] <= last_slot
    favs.sort(key=lambda f: f["ret"])
    x0, x1 = dt.date(2026, 10, 10), dt.date(2026, 12, 22)
    W, H = 1200, 220 + len(favs) * 54
    L, R = 330, 1160
    sx = lambda day: L + (day - x0).days / (x1 - x0).days * (R - L)
    s = Svg(W, H, "Favourites rotation: who is due back for next week?",
            f"Each bar is the {gap}-day cool-down after a dish was last cooked. Weekend-only dishes can only use the Sunday slot.")
    top = 150
    # window band
    s.add(f'<rect x="{sx(wk_start)}" y="{top-20}" width="{sx(wk_end + dt.timedelta(days=1))-sx(wk_start)}" height="{len(favs)*54+20}" fill="#ECE3F7" opacity=".7"/>')
    s.add(f'<text class="lab" x="{sx(wk_start)}" y="{top-30}" style="fill:#5B3790">Next roll window, Nov 22 - 27</text>')
    # gridlines (weekly ticks)
    day = x0
    while day <= x1:
        if day.weekday() == 0:
            s.add(f'<line x1="{sx(day)}" x2="{sx(day)}" y1="{top-20}" y2="{top+len(favs)*54}" stroke="#E0D8EA"/>')
            s.add(f'<text class="mm" x="{sx(day)}" y="{top+len(favs)*54+22}" text-anchor="middle">{day.strftime("%b")} {day.day}</text>')
        day += dt.timedelta(days=1)
    s.add(f'<line x1="{sx(as_of)}" x2="{sx(as_of)}" y1="{top-20}" y2="{top+len(favs)*54}" stroke="#221C2B" stroke-dasharray="4 4"/>')
    s.add(f'<text class="lab" x="{sx(as_of)}" y="{top+len(favs)*54+44}" text-anchor="middle" style="fill:#221C2B">today (sample clock)</text>')
    for i, f in enumerate(favs):
        y = top + i * 54
        name = f["dish"] if len(f["dish"]) < 34 else f["short"]
        s.add(f'<text class="t" x="{L-16}" y="{y+17}" text-anchor="end" style="font-size:14px">{esc(name)}</text>')
        tags = [("weekend only" if f["slot"] == "weekend" else None), ("premium" if f["premium"] else None)]
        s.add(f'<text class="s" x="{L-16}" y="{y+34}" text-anchor="end" style="font-size:12px">{esc(" , ".join(t for t in tags if t) or "any day")}</text>')
        fill = "#5B3790" if f["due"] else "#BDB3CC"
        a, b = sx(d(f["lastCooked"])), sx(f["ret"])
        s.add(f'<rect x="{a}" y="{y+6}" width="{b-a}" height="20" rx="4" fill="{fill}"/>')
        s.add(f'<circle cx="{a}" cy="{y+16}" r="5" fill="#fff" stroke="{fill}" stroke-width="2.5"/>')
        status = "due" if f["due"] else "not yet"
        s.add(f'<text class="mm" x="{b+10}" y="{y+20}" style="fill:#221C2B">back {f["ret"].strftime("%b")} {f["ret"].day} - {status}</text>')
    ly = H - 22
    s.add(f'<rect x="40" y="{ly-12}" width="22" height="12" rx="3" fill="#5B3790"/><text class="s" x="70" y="{ly-2}">cool-down ends in time: due for the roll</text>')
    s.add(f'<rect x="360" y="{ly-12}" width="22" height="12" rx="3" fill="#BDB3CC"/><text class="s" x="390" y="{ly-2}">still cooling down</text>')
    s.add(f'<circle cx="560" cy="{ly-6}" r="5" fill="#fff" stroke="#5B3790" stroke-width="2.5"/><text class="s" x="572" y="{ly-2}">last cooked</text>')
    return s.render()

def simulation_chart():
    sim = json.loads(subprocess.check_output(["node", str(ROOT / "scripts" / "simulate-rolls.mjs"), "--json"], cwd=ROOT))
    rows = sorted([f for f in sim["favourites"] if f["due"]], key=lambda f: -f["pickRate"])
    W, H = 1200, 300 + len(rows) * 46
    L, R = 330, 1050
    sx = lambda v: L + v / 0.6 * (R - L)
    s = Svg(W, H, f"Does the roll behave? {sim['rolls']:,} simulated rolls",
            f"Next week has {sim['dueCount']} favourites due. A fair roll would pick each one about 40% of the time, before the caps.")
    top = 130
    for v in [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]:
        s.add(f'<line x1="{sx(v)}" x2="{sx(v)}" y1="{top-10}" y2="{top+len(rows)*46}" stroke="#E0D8EA"/>')
        s.add(f'<text class="mm" x="{sx(v)}" y="{top+len(rows)*46+20}" text-anchor="middle">{int(v*100)}%</text>')
    s.add(f'<line x1="{sx(0.4)}" x2="{sx(0.4)}" y1="{top-10}" y2="{top+len(rows)*46}" stroke="#221C2B" stroke-dasharray="4 4"/>')
    s.add(f'<text class="lab" x="{sx(0.4)+6}" y="{top-16}" style="fill:#221C2B">uniform share without caps (40%)</text>')
    for i, f in enumerate(rows):
        y = top + i * 46
        tag = ("premium" if f["premium"] else "weekend only" if f["slot"] == "weekend" else "any day")
        s.add(f'<text class="t" x="{L-16}" y="{y+16}" text-anchor="end" style="font-size:14px">{esc(f["short"])}</text>')
        s.add(f'<text class="s" x="{L-16}" y="{y+33}" text-anchor="end" style="font-size:12px">{tag}</text>')
        s.add(f'<rect x="{L}" y="{y+4}" width="{sx(f["pickRate"])-L}" height="24" rx="4" fill="#5B3790"/>')
        s.add(f'<text class="mm" x="{sx(f["pickRate"])+10}" y="{y+21}" style="fill:#221C2B">{f["pickRate"]*100:.1f}%</text>')
    yb = top + len(rows) * 46 + 64
    sizes = sim["rollSizes"]; tot = sim["rolls"]
    s.add(f'<text class="t" x="40" y="{yb}" style="font-size:15px">Result</text>')
    notes = [f"Rule violations: {sim['violations']} of {tot:,} rolls (max 2 picks, 1 premium, 1 weekend-only, only due dishes).",
             f"Picks per roll: 2 picks in {sizes.get('2',0)/tot*100:.0f}% of rolls, 1 pick in {sizes.get('1',0)/tot*100:.0f}%, none in {sizes.get('0',0)/tot*100:.0f}%.",
             "The two premium dishes (steak, salmon) sit below 40% because only one premium pick is allowed per roll. That is the cap working."]
    for i, n in enumerate(notes): s.add(f'<text class="s" x="40" y="{yb+26+i*22}" style="font-size:14px">{esc(n)}</text>')
    return s.render()

def main():
    chrome = os.environ.get("CHROME_PATH")
    jobs = {"architecture": architecture, "pipeline": pipeline, "data-model": data_model,
            "rotation-timeline": rotation_chart, "roll-simulation": simulation_chart}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()
        for name, fn in jobs.items():
            svg = fn()
            with tempfile.TemporaryDirectory() as tmp:
                html = Path(tmp) / f"{name}.html"
                html.write_text(f"<!doctype html><meta charset=utf-8><style>{CSS}</style><body>{svg}</body>")
                page = browser.new_page(viewport={"width": 1200, "height": 800}, device_scale_factor=2)
                page.goto(html.as_uri()); page.wait_for_timeout(300)
                page.locator("svg").first.screenshot(path=str(OUT / f"{name}.png"))
                page.close()
            print("wrote", OUT / f"{name}.png")
        browser.close()

if __name__ == "__main__":
    main()
