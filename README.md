# Mesa

**A personal project: a weekly meal planner that gives me six dinners, one shopping list and packed lunches from the leftovers.**

[**Live demo**](https://myrelab.github.io/mesa-meal-planner/) (no login, runs on invented sample data) | [Planning playbook](docs/PLAYBOOK.md) | [Ideas for later](docs/ROADMAP.md)

![Mesa in a browser: the week view and the shopping list](docs/screenshots/hero.png)

*Mesa* is Portuguese and Spanish for "table". It is a small website made with plain HTML, CSS and JavaScript, with all the data stored in JSON files. It works in a desktop browser and on a phone.

<p align="center"><img src="docs/screenshots/demo.gif" alt="Short screen recording: ticking items on the shopping list, switching a store, hiding ticked items, then rolling the favourites" width="640"></p>

## Why I made it

I wanted one shopping trip a week and dinners that are healthy and varied, without planning from scratch every Sunday. Planning a week is mostly a data problem: cook time, budget and what is already in the fridge all have rules, and the plan has to be right before I shop from it.

## What it does

Mesa has four tabs: Week, Shop, Cook and Faves. Here is every feature, in the browser.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/week.png" alt="Week tab"><br><b>Week.</b> Six dinners and which one feeds which packed lunch, with protein and wheat icons.</td>
<td width="50%"><img src="docs/screenshots/weeks.png" alt="Switching to the earlier week"><br><b>Weeks.</b> Switch to an earlier week to look back. Ticks are kept per week.</td>
</tr>
<tr>
<td><img src="docs/screenshots/shop.png" alt="Shop tab with the store split"><br><b>Shop.</b> How many things to buy at each store, with quick presets and a Copy list button.</td>
<td><img src="docs/screenshots/shop-store.png" alt="One item moved to another store"><br><b>Switch stores.</b> Move an item to another store and the lists regroup.</td>
</tr>
<tr>
<td><img src="docs/screenshots/shop-ticks.png" alt="Ticked items on the shopping list"><br><b>Tick as you shop.</b> Ticks are remembered in the browser.</td>
<td><img src="docs/screenshots/shop-hide.png" alt="Ticked items hidden"><br><b>Hide ticked items</b> to see only what is left.</td>
</tr>
<tr>
<td><img src="docs/screenshots/cook.png" alt="Cook tab"><br><b>Cook.</b> Pick a day to see its recipe, a side dish and what is packed for lunch.</td>
<td><img src="docs/screenshots/like.png" alt="We liked this button on a dish card"><br><b>We liked this.</b> Add a dish to the favourites rotation from its card.</td>
</tr>
<tr>
<td><img src="docs/screenshots/faves.png" alt="Faves tab before rolling"><br><b>Faves.</b> Which favourites are due back, and when each can return.</td>
<td><img src="docs/screenshots/roll.png" alt="Faves tab after pressing Roll favourites"><br><b>Roll favourites.</b> Picks next week's repeats at random, within the rules.</td>
</tr>
<tr>
<td colspan="2"><img src="docs/screenshots/rules.png" alt="The house rules panel" width="50%"><br><b>House rules.</b> The rules that drive the plan come from one data file, shown at the bottom of the page.</td>
</tr>
</table>

## The data side

This is the part I care about most.

![Pipeline: a weekly plan is written, checked, published and read by the site](docs/diagrams/pipeline.png)

- **The data lives in JSON files** in [`data/`](data): the rules (stores, cook time, budget), the favourites, and one file per week. Here is one day of a week file:

  <img src="docs/screenshots/data-json.png" alt="A day from a week file" width="420">

- **Each week is checked before it is published.** [`scripts/validate-data.mjs`](scripts/validate-data.mjs) catches mistakes such as an ingredient that is not on the shopping list, a weeknight dinner that takes too long, or too many premium proteins in a week. Run it with `npm run validate`. Here it is on a week I broke on purpose:

  <img src="docs/screenshots/checks-fail.png" alt="The data check reporting four problems" width="640">

- **The weekly plan is written by Claude** from a written set of rules ([`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)). I do not take the output on trust, which is why the check script exists.
- **The favourites roll is a small function** ([`js/randomizer.js`](js/randomizer.js)) with rules: a dish has to rest for 28 days before it can come back, and a roll gives at most two picks. It has tests, and [`scripts/simulate-rolls.mjs`](scripts/simulate-rolls.mjs) runs 10,000 rolls to confirm no rule is ever broken:

  <img src="docs/screenshots/checks-pass.png" alt="The data check, the tests and the roll simulation all passing" width="640">

- **Nothing is stored twice.** The days that use a shopping item are worked out from the recipes, so the list and the recipes cannot disagree.

## Sample data

Everything in `data/` is invented. The sample household is generic, the recipes are short methods written for this project, and there are no photographs.

## Run it yourself

```bash
git clone https://github.com/MyreLab/mesa-meal-planner.git
cd mesa-meal-planner
python3 -m http.server
# open http://localhost:8000
```

Checks need Node 20 or newer and nothing else to install:

```bash
npm test            # tests
npm run validate    # checks the data files
```

## What is in the folders

```
index.html, css/, js/   the website
data/                   sample rules, favourites and weeks (JSON)
schemas/                the expected shape of each data file
scripts/                the data check and the roll simulation
tests/                  tests
docs/                   playbook, ideas, diagrams and screenshots
```

## Credits and license

Built by [@MyreLab](https://github.com/MyreLab). Released under the [MIT license](LICENSE).

Fonts: Figtree, Young Serif and IBM Plex Mono, all under the SIL Open Font License 1.1 (see [`assets/fonts/README.md`](assets/fonts/README.md)).
