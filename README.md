# Mesa

**A personal project: a weekly meal planner that gives me six dinners, one shopping list and packed lunches from the leftovers.**

[**Live demo**](https://myrelab.github.io/mesa-meal-planner/) (no login, runs on invented sample data) | [Planning playbook](docs/PLAYBOOK.md) | [Ideas for later](docs/ROADMAP.md)

![Mesa on a phone: the week, the shopping list, a recipe and the favourites rotation](docs/screenshots/hero.png)

*Mesa* is Portuguese and Spanish for "table". It is a small website made with plain HTML, CSS and JavaScript, with all the data stored in JSON files. It is meant to be used on a phone.

<p align="center"><img src="docs/screenshots/demo.gif" alt="Short screen recording: ticking items on the shopping list, switching a store, then rolling the favourites" width="300"></p>

## Why I made it

I wanted one shopping trip a week and dinners that are healthy and varied, without planning from scratch every Sunday. Planning a week is mostly a data problem: cook time, budget and what is already in the fridge all have rules, and the plan has to be right before I shop from it.

## What it does

| Week | Shop | Cook | Faves |
| --- | --- | --- | --- |
| <img src="docs/screenshots/week.png" width="200" alt="Week tab"> | <img src="docs/screenshots/shop.png" width="200" alt="Shop tab"> | <img src="docs/screenshots/cook.png" width="200" alt="Cook tab"> | <img src="docs/screenshots/faves.png" width="200" alt="Faves tab"> |

- **Week**: six dinners, starting with a weekend dish that uses up the fridge, plus which dinner feeds which packed lunch.
- **Shop**: a checklist grouped by aisle. Each item can be switched between stores, and ticks are remembered in the browser.
- **Cook**: one recipe card per day, with a side dish.
- **Faves**: dishes we liked, and a **Roll favourites** button that picks next week's repeats.

## The data side

This is the part I care about most.

![Pipeline: a weekly plan is written, checked, published and read by the site](docs/diagrams/pipeline.png)

- **The data lives in JSON files** in [`data/`](data): the rules (stores, cook time, budget), the favourites, and one file per week.
- **Each week is checked before it is published.** [`scripts/validate-data.mjs`](scripts/validate-data.mjs) catches mistakes such as an ingredient that is not on the shopping list, a weeknight dinner that takes too long, or two premium proteins in one week. Run it with `npm run validate`.
- **The weekly plan is written by Claude** from a written set of rules ([`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)). I do not take the output on trust, which is why the check script exists.
- **The favourites roll is a small function** ([`js/randomizer.js`](js/randomizer.js)) with rules: a dish has to rest for 28 days before it can come back, and a roll gives at most two picks. It has tests, and [`scripts/simulate-rolls.mjs`](scripts/simulate-rolls.mjs) runs 10,000 rolls to confirm no rule is ever broken.
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
