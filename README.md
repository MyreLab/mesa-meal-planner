# Mesa

## What it is

**A weekly meal planner that gives me six dinners, one shopping list and packed lunches from the leftovers.**

Try the [Live demo](https://myrelab.github.io/mesa-meal-planner/)

[![CI](https://github.com/MyreLab/mesa-meal-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/MyreLab/mesa-meal-planner/actions/workflows/ci.yml)

![Walkthrough of Mesa in a browser: the week, switching weeks, the shopping list, cooking, favourites and the house rules](docs/screenshots/demo.gif)

*Mesa* is Portuguese for "table". It is a dashboard made with plain HTML, CSS and JavaScript, with all the data stored in JSON files. It works in a desktop browser and on a phone.

## Why I made it

I wanted one shopping trip a week and dinners that are healthy and varied, with enough leftovers for my packed lunch the next day. I wanted all my ingredients in one shopping list, organised by aisle and preferred grocery store. I also wanted this automated and with no friction, so I don't waste my Sunday on another chore.

## What it does

Mesa has four tabs: Week, Shop, Cook and Faves. Here is every feature.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/week.png" alt="Week tab"><br><b>Week.</b> Six dinners and which one feeds which packed lunch, with protein and wheat icons.</td>
<td width="50%"><img src="docs/screenshots/weeks.png" alt="Switching to the earlier week"><br><b>Past weeks.</b> Switch to an earlier week to look back. Ticks are kept per week.</td>
</tr>
<tr>
<td><img src="docs/screenshots/shop.png" alt="Shop tab with the store split"><br><b>Shop.</b> How many things to buy at each store, with quick presets and a Copy list button.</td>
<td><img src="docs/screenshots/shop-store.png" alt="One item moved to another store"><br><b>Switch stores.</b> Move an item to another store and the lists regroup.</td>
</tr>
<tr>
<td><img src="docs/screenshots/shop-ticks.png" alt="Ticked items on the shopping list"><br><b>Tick as you shop.</b> Ticks are remembered in the dashboard</td>
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

How a week gets planned: Claude Code runs the planning step on a schedule. Mesa is the front end that reads its output.

![Pipeline: a weekly plan is written, checked, published and read by the site](docs/diagrams/pipeline.png)

- **The data lives in JSON files** in [`data/`](data): the rules (stores, cook time, budget), the favourites, and one file per week. Here is one day of a week file:

  <img src="docs/screenshots/data-json.png" alt="A day from a week file" width="420">

- **Each week is checked before it is published.** [`scripts/validate-data.mjs`](scripts/validate-data.mjs) catches mistakes such as an ingredient that is not on the shopping list, a weeknight dinner that takes too long, or too many premium proteins in a week. Run it with `npm run validate`. Here it is on a week I broke on purpose:

  <img src="docs/screenshots/checks-fail.png" alt="The data check reporting four problems" width="640">

- **The weekly plan is written by Claude Code** from a written set of rules ([`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)). I do not take the output on trust, which is why the check script exists.
- **The favourites roll is a small function** ([`js/randomizer.js`](js/randomizer.js)) with rules: a dish has to rest for 28 days before it can come back, and a roll gives at most two picks. It has tests, including one that runs thousands of random rolls to check that no rule is ever broken:

  <img src="docs/screenshots/checks-pass.png" alt="The data check and the tests passing" width="640">

- **Nothing is stored twice.** The days that use a shopping item are worked out from the recipes, so the list and the recipes cannot disagree.

## Run it yourself

```bash
git clone https://github.com/MyreLab/mesa-meal-planner.git
cd mesa-meal-planner
python3 -m http.server
# open http://localhost:8000
```

Checks need Node 20 or newer:

```bash
npm install         # once
npm test            # tests
npm run validate    # checks the data files
```

## What is in the folders

```
index.html, css/, js/   the website
data/                   sample rules, favourites and weeks (JSON)
schemas/                the expected shape of each data file
scripts/                the data check and the image generators
tests/                  tests
docs/                   playbook, diagram and screenshots
```

## Credits and license

Built by [@MyreLab](https://github.com/MyreLab). Released under the [MIT license](LICENSE).
