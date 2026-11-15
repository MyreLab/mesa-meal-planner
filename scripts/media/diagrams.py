"""Renders the README pipeline diagram to docs/diagrams/pipeline.png (dark theme).

Usage:  python3 scripts/media/diagrams.py
Needs:  pip install playwright (and a Chromium/Chrome; set CHROME_PATH to use a system Chrome)
"""
import os, tempfile
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
:root {{ --bg:#17121D; --surface:#211A29; --ink:#EBE5F2; --muted:#ABA0B8; --line:#382E44; --accent:#C4A5F0; }}
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

# The shapes are drawn with the light palette, then mapped to the dark one (same values as css/styles.css).
DARK = {"#F4F1F8": "#17121D", "#fff": "#211A29", "#E0D8EA": "#382E44", "#ECE3F7": "#302344", "#5B3790": "#C4A5F0",
        "#645B70": "#ABA0B8", "#A33A26": "#E58A73", "#9A6A12": "#DDAF55", "#F4E8CF": "#352B17", "#221C2B": "#EBE5F2",
        "#CFC4E0": "#4A3F58", "#BDB3CC": "#5A4E6B"}

def dark(svg):
    for light, dk in DARK.items(): svg = svg.replace(f'"{light}"', f'"{dk}"').replace(f":{light}", f":{dk}")
    return svg

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

class Svg:
    def __init__(self, w, h, trim=0):
        self.w, self.h, self.trim, self.parts = w, h - trim, trim, []
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
        return dark(self._render())
    def _render(self):
        colors = ["#5B3790", "#645B70", "#A33A26", "#9A6A12"]
        defs = "".join(f'<marker id="a{c[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="{c}"/></marker>' for c in colors)
        return f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 {self.trim} {self.w} {self.h}"><defs>{defs}</defs><rect y="{self.trim}" width="{self.w}" height="{self.h}" fill="#F4F1F8"/>{"".join(self.parts)}</svg>'

# ------------------------------------------------------------------ diagrams
def pipeline():
    s = Svg(1200, 700, trim=70)
    P = "#5B3790"
    xs = [40, 330, 620, 910]; w = 250; y1, y2, h = 120, 360, 110
    n1 = [("1  Scheduled run", ["Starts the weekly planning", "job. No one has to remember."]),
          ("2  Ask the household", ["What is left in the fridge?", "Which dishes did we like?"]),
          ("3  Read the inputs", ["playbook, config.json,", "favourites, saved roll"]),
          ("4  Write the week", ["data/weeks/<monday>.json", "plus the updated current.json"])]
    for x, (t, l) in zip(xs, n1): s.box(x, y1, w, h, t, l, accent=P)
    n2 = [("5  Validation gate", ["Schema, integrity, rules.", "A bad week stops here."], "#ECE3F7", P),
          ("6  Publish", ["Commit to the repo (history", "of every week for free)."], "#fff", "#E0D8EA"),
          ("7  Hosting", ["The website hosts the JSON", "right next to the page."], "#fff", "#E0D8EA"),
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

def main():
    chrome = os.environ.get("CHROME_PATH")
    jobs = {"pipeline": pipeline}
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
