"""Captures desktop-browser screenshots of every feature (with the feature circled), terminal screenshots
of the data checks, and a short GIF that walks through every feature.

Usage:  python3 -m http.server 8000   (in one terminal, from the repo root)
        python3 scripts/media/capture.py
Needs:  pip install playwright pillow, and Node for the terminal shots
        (set CHROME_PATH to use a system Chrome)
A fixed random seed is injected so the sample "Roll favourites" result is the same every time.
"""
import io, json, os, re, shutil, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "screenshots"
BASE = os.environ.get("MESA_URL", "http://localhost:8000/?fixed")
SHOWN_URL = "myrelab.github.io/mesa-meal-planner/"
FONTS = (ROOT / "assets" / "fonts").as_uri()
SHOTS.mkdir(parents=True, exist_ok=True)
W = 760  # viewport width of the website shots

SEED = """
(() => { let a = 16 >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();
"""

FONT_CSS = f"""
@font-face {{ font-family: Figtree; font-weight: 400; src: url({FONTS}/figtree-latin-400-normal.woff2); }}
@font-face {{ font-family: Figtree; font-weight: 600; src: url({FONTS}/figtree-latin-600-normal.woff2); }}
@font-face {{ font-family: "Young Serif"; src: url({FONTS}/young-serif-latin-400-normal.woff2); }}
@font-face {{ font-family: "IBM Plex Mono"; font-weight: 400; src: url({FONTS}/ibm-plex-mono-latin-400-normal.woff2); }}
@font-face {{ font-family: "IBM Plex Mono"; font-weight: 500; src: url({FONTS}/ibm-plex-mono-latin-500-normal.woff2); }}
"""


def launch(p):
    chrome = os.environ.get("CHROME_PATH")
    return p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()


def render_html(browser, html, width, height, out, scale=2, selector=None):
    """Renders an HTML snippet to a PNG."""
    with tempfile.TemporaryDirectory() as tmp:
        f = Path(tmp) / "x.html"
        f.write_text("<!doctype html><meta charset=utf-8><style>" + FONT_CSS + "body{margin:0}</style>" + html)
        pg = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=scale)
        pg.goto(f.as_uri()); pg.wait_for_timeout(300)
        (pg.locator(selector) if selector else pg).screenshot(path=str(out))
        pg.close()


# ---------- the browser window around each website shot ----------

def bar_png(browser, width, tab, scale):
    out = Path(tempfile.gettempdir()) / f"mesa-bar-{width}-{tab}-{scale}.png"
    url = SHOWN_URL + (f"#{tab}" if tab else "")
    html = f"""<div id=b style="width:{width}px;height:40px;background:#2A2234;display:flex;align-items:center;gap:8px;padding:0 14px;box-sizing:border-box;border-bottom:1px solid #382E44;font-family:Figtree,sans-serif">
      <i style="width:11px;height:11px;border-radius:50%;background:#4A4057"></i><i style="width:11px;height:11px;border-radius:50%;background:#4A4057"></i><i style="width:11px;height:11px;border-radius:50%;background:#4A4057"></i>
      <span style="margin-left:14px;flex:1;max-width:{width - 130}px;height:24px;border-radius:12px;background:#17121D;color:#ABA0B8;font-size:13px;line-height:24px;padding:0 14px;box-sizing:border-box;white-space:nowrap;overflow:hidden">{url}</span></div>"""
    render_html(browser, html, width, 40, out, scale=scale, selector="#b")
    return Image.open(out).convert("RGB")


def framed(browser, raw: Image.Image, tab, scale=2):
    bar = bar_png(browser, raw.width // scale, tab, scale)
    img = Image.new("RGB", (raw.width + 2 * scale, raw.height + bar.height + 2 * scale), "#382E44")
    img.paste(bar, (scale, scale)); img.paste(raw, (scale, bar.height + scale))
    return img


# ---------- website screenshots ----------

RING_JS = """
([sels, only_visible]) => {
  document.querySelectorAll('.mesa-ring').forEach((e) => e.remove());
  for (const raw of sels) {
    const [sel, idx] = raw.split('@');
    let els = [...document.querySelectorAll(sel)];
    if (idx !== undefined) els = [els[Number(idx)]];
    for (const el of els) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (only_visible && (r.top < 44 || r.bottom > innerHeight || r.width === 0)) continue;
      const pad = 6, d = document.createElement('div');
      d.className = 'mesa-ring';
      d.style.cssText = `position:absolute;left:${r.left + scrollX - pad}px;top:${r.top + scrollY - pad}px;width:${r.width + 2 * pad}px;height:${r.height + 2 * pad}px;border:3px solid #F2B84B;border-radius:14px;pointer-events:none;z-index:9999;box-shadow:0 0 0 2px rgba(23,18,29,.6)`;
      document.body.appendChild(d);
    }
  }
}
"""


class Site:
    def __init__(self, browser, height=620, scale=2):
        self.browser, self.scale = browser, scale
        self.ctx = browser.new_context(viewport={"width": W, "height": height}, device_scale_factor=scale, color_scheme="dark")
        self.ctx.add_init_script(SEED)
        self.page = self.ctx.new_page()
        self.page.goto(BASE); self.page.wait_for_selector("body[data-ready=true]")

    def tab(self, name):
        self.page.evaluate(f"location.hash = '#{name}'"); self.page.wait_for_timeout(250)
        self.page.evaluate("window.scrollTo(0, 0)")

    def scroll_to(self, selector, offset=-70):
        self.page.evaluate(f"document.querySelector({json.dumps(selector)}).scrollIntoView()")
        self.page.evaluate(f"window.scrollBy(0, {offset})"); self.page.wait_for_timeout(200)

    def ring(self, *sels, only_visible=True):
        """Circles the features being shown. A selector like 'x@0' circles only the first match."""
        self.page.evaluate(RING_JS, [list(sels), only_visible]); self.page.wait_for_timeout(80)

    def unring(self): self.page.evaluate(RING_JS, [[], False])

    def grab(self, name, tab, height=None):
        if height: self.page.set_viewport_size({"width": W, "height": height})
        self.page.wait_for_timeout(120)
        raw = Image.open(io.BytesIO(self.page.screenshot())).convert("RGB")
        framed(self.browser, raw, tab, self.scale).save(SHOTS / f"{name}.png", optimize=True)
        self.unring(); print("wrote", name)

    def close(self): self.ctx.close()


def costco_items(s): return s.page.locator("#v-shop .store[data-store=costco] .item")


def tick_some(s):
    for i in (0, 1, 2, 3): costco_items(s).nth(i).locator("label.nm").click()


def website_shots(browser):
    s = Site(browser)
    s.ring(".flow-grid"); s.grab("week", "", 700)
    # history: the earlier sample week
    s.page.click("#weeknav button[data-week='2026-11-09']"); s.page.wait_for_timeout(250)
    s.page.evaluate("window.scrollTo(0, 0)"); s.ring("#weeknav .seg"); s.grab("weeks", "", 700)
    s.page.click("#weeknav button[data-week='2026-11-16']"); s.page.wait_for_timeout(250)
    # "We liked this" on a dish card
    s.scroll_to("#v-week .like", -460)
    s.page.locator("#v-week .like").first.click(); s.page.wait_for_timeout(250)
    s.ring("#v-week .like@0"); s.grab("like", "", 700)
    # shop: store split and presets, then a store switch, ticks, hide ticked
    s.tab("shop"); s.scroll_to("#v-shop h3", -115)
    s.ring("#v-shop .split", "#v-shop .quick", "#copy"); s.grab("shop", "shop", 700)
    costco_items(s).nth(3).locator(".seg button[data-s=whole-foods]").click(); s.page.wait_for_timeout(250)
    s.scroll_to("#v-shop h3", -115)
    s.ring("#v-shop .split", "#v-shop .note b", "#v-shop .store[data-store=costco] .item .seg@0"); s.grab("shop-store", "shop", 700)
    tick_some(s)
    s.scroll_to("#lists", -90); s.ring("#lists input:checked + .box"); s.grab("shop-ticks", "shop", 700)
    s.page.check("#hide-done"); s.page.wait_for_timeout(200)
    s.scroll_to(".shop-bar", -90); s.ring(".toggle"); s.grab("shop-hide", "shop", 700)
    # cook
    s.tab("wed"); s.ring(".daypick", "#v-cook .callout@0"); s.grab("cook", "wed", 760)
    # faves: the rotation, then the roll
    s.tab("faves"); s.scroll_to(".faves", -120); s.ring(".faves .fav > .chip"); s.grab("faves", "faves", 800)
    s.page.evaluate("window.scrollTo(0, 0)"); s.page.click("#roll"); s.page.wait_for_timeout(250)
    s.scroll_to(".rollbox", -100); s.ring(".picks", "#roll"); s.grab("roll", "faves", 800)
    s.close()
    # the demo rules panel in the footer
    s = Site(browser)
    s.page.evaluate("document.querySelector('#rules').open = true")
    s.scroll_to("#rules", -60); s.ring("#rules"); s.grab("rules", "", 700)
    s.close()


def gif(browser):
    """One recording that walks through every feature. The still screenshots circle features; the GIF stays clean."""
    s = Site(browser, height=560, scale=1)
    bar = bar_png(browser, W, "", 1)
    frames, durations = [], []

    def snap(ms):
        raw = Image.open(io.BytesIO(s.page.screenshot())).convert("RGB")
        img = Image.new("RGB", (raw.width, raw.height + bar.height)); img.paste(bar, (0, 0)); img.paste(raw, (0, bar.height))
        frames.append(img); durations.append(ms)

    # week grid, then the earlier week and back
    s.scroll_to(".flow", -90); snap(1700)
    s.page.evaluate("window.scrollTo(0, 0)"); s.page.click("#weeknav button[data-week='2026-11-09']"); s.page.wait_for_timeout(250); snap(1300)
    s.page.click("#weeknav button[data-week='2026-11-16']"); s.page.wait_for_timeout(250); snap(900)
    # shop: split and presets, a store switch, ticks, hide ticked
    s.tab("shop"); s.scroll_to("#v-shop h3", -115); snap(1700)
    s.scroll_to("#lists", -90); snap(1200)
    costco_items(s).nth(3).locator(".seg button[data-s=whole-foods]").click(); s.page.wait_for_timeout(250)
    s.scroll_to("#v-shop h3", -115); snap(1700)
    s.scroll_to("#lists", -90); snap(700)
    for i in (0, 1, 2, 3):
        costco_items(s).nth(i).locator("label.nm").click(); s.page.wait_for_timeout(120); snap(550)
    snap(900)
    s.page.check("#hide-done"); s.page.wait_for_timeout(200); s.scroll_to(".shop-bar", -90); snap(1700)
    # cook: two days
    s.tab("wed"); snap(1700)
    s.page.click(".daypick a:nth-child(5)"); s.page.wait_for_timeout(250); s.page.evaluate("window.scrollTo(0, 0)"); snap(1300)
    # like a dish
    s.tab("week"); s.scroll_to("#v-week .like", -460); s.page.locator("#v-week .like").first.click(); s.page.wait_for_timeout(250)
    snap(1700)
    # faves: rotation, then the roll
    s.tab("faves"); s.scroll_to(".faves", -120); snap(1700)
    s.page.evaluate("window.scrollTo(0, 0)"); s.page.click("#roll"); s.page.wait_for_timeout(250)
    s.scroll_to(".rollbox", -100); snap(2400)
    # the house rules
    s.page.evaluate("document.querySelector('#rules').open = true"); s.scroll_to("#rules", -60); snap(2200)
    s.close()
    # one shared palette built from several frames, so the circles keep their colour
    sample = frames[::3]
    sheet = Image.new("RGB", (frames[0].width, frames[0].height * len(sample)))
    for i, f in enumerate(sample): sheet.paste(f, (0, i * f.height))
    pal = sheet.quantize(colors=160, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    q[0].save(SHOTS / "walkthrough.gif", save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=True, disposal=2)
    print("wrote walkthrough.gif", len(frames), "frames")


# ---------- terminal and code screenshots ----------

ANSI = re.compile(r"\x1b\[[0-9;]*m")
esc = lambda t: t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def run(cmd, cwd=ROOT):
    r = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return ANSI.sub("", r.stdout + r.stderr).rstrip()


def terminal_html(title, blocks, width):
    body = ""
    for cmd, out in blocks:
        body += f'<div><span class=pr>$</span> <span class=cm>{esc(cmd)}</span></div>'
        for line in out.splitlines():
            cls = "ok" if line.startswith(("OK", "Data check passed", "No violations")) else "bad" if re.match(r"^\s*(FAIL|✖|x )", line) else ""
            body += f'<div class="{cls}">{esc(line) or "&nbsp;"}</div>'
        body += '<div style="height:10px"></div>'
    return f"""<style>
    #t{{width:{width}px;background:#221C2B;border-radius:10px;overflow:hidden;font-family:"IBM Plex Mono",monospace;font-size:13px;line-height:1.55;color:#E6DFF0}}
    #t .hd{{background:#2E2638;padding:9px 14px;display:flex;gap:7px;align-items:center;color:#9A90A8;font-size:12px}}
    #t .hd i{{width:10px;height:10px;border-radius:50%;background:#4A4057}}
    #t .bd{{padding:14px 18px 6px;white-space:pre-wrap;word-break:break-word}}
    .pr{{color:#B79BE8}} .cm{{color:#fff;font-weight:500}} .ok{{color:#8FD6A5}} .bad{{color:#F0A6A0}}
    </style><div id=t><div class=hd><i></i><i></i><i></i><span style="margin-left:8px">{esc(title)}</span></div><div class=bd>{body}</div></div>"""


def terminal_shots(browser):
    ok = run("npm run validate --silent")
    tests = "\n".join(l for l in run("node --test").splitlines() if l.startswith(("# tests", "# pass", "# fail")))
    render_html(browser, terminal_html("terminal", [("npm run validate", ok), ("npm test", tests)], 760), 760, 600, SHOTS / "checks-pass.png", selector="#t")

    # a deliberately broken week, to show the gate catching mistakes
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        for d in ("data", "schemas", "js"): shutil.copytree(ROOT / d, t / d)
        (t / "scripts").mkdir(); (t / "node_modules").symlink_to(ROOT / "node_modules")
        shutil.copy(ROOT / "scripts" / "validate-data.mjs", t / "scripts"); shutil.copy(ROOT / "package.json", t)
        f = t / "data" / "weeks" / "2026-11-16.json"; wk = json.loads(f.read_text())
        wk["days"][1]["ingredients"].append({"item": "ghost-spice", "qty": "1 tsp", "text": "smoked paprika"})
        wk["days"][3]["minutes"] = {"hands": 30, "total": 55}
        wk["days"][2]["premium"] = True; wk["days"][4]["premium"] = True
        f.write_text(json.dumps(wk, indent=2))
        bad = run("node scripts/validate-data.mjs", cwd=t)
    bad = bad.replace(str(t), ".")
    render_html(browser, terminal_html("terminal", [("npm run validate", bad)], 760), 760, 400, SHOTS / "checks-fail.png", selector="#t")
    print("wrote terminal shots")


def json_shot(browser):
    wk = json.loads((ROOT / "data" / "weeks" / "2026-11-16.json").read_text())
    d = wk["days"][1]
    snippet = {"key": d["key"], "date": d["date"], "dish": d["dish"], "protein": d["protein"], "wheat": d["wheat"],
               "minutes": d["minutes"], "portions": d["portions"], "premium": d["premium"],
               "ingredients": d["ingredients"][:2] + ["..."]}
    txt = json.dumps(snippet, indent=2).replace('"..."', "...")
    html = f"""<style>#j{{width:520px;background:#211A29;border:1px solid #382E44;border-radius:10px;overflow:hidden;font-family:"IBM Plex Mono",monospace;font-size:13px;line-height:1.5;color:#EBE5F2}}
      #j .hd{{background:#2A2234;padding:8px 14px;color:#ABA0B8;font-size:12px;border-bottom:1px solid #382E44}} pre{{margin:0;padding:12px 16px}}</style>
      <div id=j><div class=hd>data/weeks/2026-11-16.json (one day, shortened)</div><pre>{esc(txt)}</pre></div>"""
    render_html(browser, html, 520, 500, SHOTS / "data-json.png", selector="#j")
    print("wrote data-json")


if __name__ == "__main__":
    with sync_playwright() as p:
        b = launch(p)
        website_shots(b); gif(b); terminal_shots(b); json_shot(b)
        b.close()
    for f in sorted(SHOTS.iterdir()): print(f.name, f"{f.stat().st_size/1024:.0f} KB")
