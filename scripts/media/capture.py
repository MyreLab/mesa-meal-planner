"""Captures phone-sized screenshots, the hero and social images, and a short GIF of the running demo.

Usage:  python3 -m http.server 8000   (in one terminal, from the repo root)
        python3 scripts/media/capture.py
Needs:  pip install playwright pillow  (set CHROME_PATH to use a system Chrome)
A fixed random seed is injected so the sample "Roll favourites" result is the same every time.
"""
import io, os, tempfile
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "docs" / "screenshots"
BASE = os.environ.get("MESA_URL", "http://localhost:8000/")
FONTS = (ROOT / "assets" / "fonts").as_uri()
SHOTS.mkdir(parents=True, exist_ok=True)

SEED = """
(() => { let a = 16 >>> 0;
  Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
})();
"""

def launch(p):
    chrome = os.environ.get("CHROME_PATH")
    return p.chromium.launch(executable_path=chrome, args=["--no-sandbox"]) if chrome else p.chromium.launch()

def open_page(browser, scale=2):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=scale, is_mobile=True, has_touch=True)
    ctx.add_init_script(SEED)
    page = ctx.new_page()
    page.goto(BASE); page.wait_for_selector("body[data-ready=true]")
    return page

def go(page, tab):
    page.evaluate(f"location.hash = '#{tab}'"); page.wait_for_timeout(250)

def tick_some(page):
    items = page.locator("#v-shop .store[data-store=club] .item")
    for i in (0, 1, 2, 4): items.nth(i).locator("label.nm").click()
    grocery_move = page.locator("#v-shop .store[data-store=club] .item").nth(6)
    grocery_move.locator(".seg button[data-s=grocery]").click()

def screens(browser):
    page = open_page(browser)
    page.screenshot(path=str(SHOTS / "week.png"))
    go(page, "shop"); tick_some(page)
    page.evaluate("document.querySelector('#lists').scrollIntoView()"); page.evaluate("window.scrollBy(0, -78)"); page.wait_for_timeout(200)
    page.screenshot(path=str(SHOTS / "shop.png"))
    go(page, "wed"); page.screenshot(path=str(SHOTS / "cook.png"))
    go(page, "faves"); page.click("#roll"); page.wait_for_timeout(250)
    page.screenshot(path=str(SHOTS / "faves.png"))
    page.context.close()

def gif(browser):
    page = open_page(browser, scale=1)
    frames, durations = [], []
    def snap(ms):
        frames.append(Image.open(io.BytesIO(page.screenshot())).convert("RGB")); durations.append(ms)
    snap(1400)
    page.evaluate("window.scrollTo(0, 560)"); page.wait_for_timeout(150); snap(1300)
    page.evaluate("window.scrollTo(0, 0)")
    go(page, "shop"); snap(1200)
    items = page.locator("#v-shop .store[data-store=club] .item")
    page.evaluate("document.querySelector('#lists').scrollIntoView()"); page.evaluate("window.scrollBy(0, -78)")
    snap(900)
    for i in (0, 1, 2):
        items.nth(i).locator("label.nm").click(); page.wait_for_timeout(120); snap(650)
    items.nth(4).locator(".seg button[data-s=grocery]").click(); page.wait_for_timeout(150); snap(1300)
    go(page, "wed"); snap(1500)
    go(page, "faves"); snap(1000)
    page.click("#roll"); page.wait_for_timeout(250); snap(2600)
    page.context.close()
    pal = frames[0].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    q[0].save(SHOTS / "demo.gif", save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=True, disposal=2)

def compose(browser):
    css = f"""
    @font-face {{ font-family: Figtree; font-weight: 400; src: url({FONTS}/figtree-latin-400-normal.woff2); }}
    @font-face {{ font-family: Figtree; font-weight: 600; src: url({FONTS}/figtree-latin-600-normal.woff2); }}
    @font-face {{ font-family: "Young Serif"; src: url({FONTS}/young-serif-latin-400-normal.woff2); }}
    body {{ margin:0; font-family: Figtree, sans-serif; color:#221C2B; }}
    .stage {{ background: linear-gradient(135deg,#F4F1F8 0%,#E6DBF5 100%); position:relative; overflow:hidden; }}
    .phone {{ width:260px; border-radius:34px; padding:9px; background:#221C2B; box-shadow:0 24px 48px rgba(34,28,43,.28); }}
    .phone img {{ display:block; width:100%; border-radius:26px; }}
    h1 {{ font-family:"Young Serif",serif; font-weight:400; margin:0; }}
    p {{ margin:0; color:#645B70; }}
    .pill {{ display:inline-block; padding:5px 12px; border-radius:999px; background:#ECE3F7; color:#5B3790; font-weight:600; font-size:14px; margin:0 6px 6px 0; }}
    """
    uri = lambda n: (SHOTS / n).as_uri()
    hero = f"""<style>{css}</style><div class=stage style="width:1500px;height:880px;padding:56px 64px">
      <div style="width:1372px">
       <h1 style="font-size:64px">Mesa</h1>
       <p style="font-size:24px;margin-top:8px;max-width:720px">Six dinners, one shopping trip, packed lunches from leftovers.</p>
       <div style="margin-top:18px"><span class=pill>plain HTML, CSS, JS</span><span class=pill>JSON data contracts</span><span class=pill>storage adapter</span><span class=pill>no build step</span></div>
      </div>
      <div style="display:flex;gap:34px;position:absolute;left:64px;top:230px">
        {"".join(f'<div class=phone style="margin-top:{m}px"><img src="{uri(n)}"></div>' for n, m in [("week.png", 0), ("shop.png", 26), ("cook.png", 0), ("faves.png", 26)])}
      </div></div>"""
    social = f"""<style>{css}</style><div class=stage style="width:1280px;height:640px">
      <div style="position:absolute;left:72px;top:150px;width:600px">
        <h1 style="font-size:92px">Mesa</h1>
        <p style="font-size:30px;margin-top:14px;line-height:1.3">A weekly meal planner: dinners, one shopping list, leftovers for lunch.</p>
        <div style="margin-top:26px"><span class=pill>vanilla JS</span><span class=pill>JSON contracts</span><span class=pill>storage adapter</span></div>
      </div>
      <div class=phone style="position:absolute;left:760px;top:70px;transform:rotate(-4deg)"><img src="{uri('week.png')}"></div>
      <div class=phone style="position:absolute;left:1010px;top:130px;transform:rotate(3deg)"><img src="{uri('shop.png')}"></div></div>"""
    for name, html, w, h, out in [("hero", hero, 1500, 880, SHOTS / "hero.png"), ("social", social, 1280, 640, ROOT / "assets" / "social-preview.png")]:
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / f"{name}.html"; f.write_text("<!doctype html><meta charset=utf-8>" + html)
            pg = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg.goto(f.as_uri()); pg.wait_for_timeout(400)
            pg.locator(".stage").screenshot(path=str(out)); pg.close()
        print("wrote", out)

if __name__ == "__main__":
    with sync_playwright() as p:
        b = launch(p)
        screens(b); gif(b); compose(b)
        b.close()
    for f in sorted(SHOTS.iterdir()): print(f.name, f"{f.stat().st_size/1024:.0f} KB")
