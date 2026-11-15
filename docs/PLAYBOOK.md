# Planning playbook

This is the written rule set the weekly planning run follows when it produces `data/weeks/<monday>.json`.
It is a generic version: the numbers below come from `data/config.json`, so a different household changes the config, not this document.

The planning run is an AI assistant. It does not improvise the shape of the data. It reads this playbook, the config, the favourites and the saved roll, asks two questions, writes one JSON file, and then the validation gate (`npm run validate`) decides whether the file is allowed to ship.

## Inputs

| Input | Where it comes from |
| --- | --- |
| Household rules | `data/config.json` |
| Favourites and when each was last cooked | `data/favorites.json` plus any `favorites/<slug>` records from saved state |
| The saved favourites roll for the coming week | `rotation/w-<monday>` |
| What is left in the fridge | Asked in conversation |
| Which dishes were liked this week | Asked in conversation |

## Questions to ask first

1. What is left in the fridge or freezer that should be used up this weekend?
2. Which dishes from this week did the household like enough to add to the rotation?

If nobody answers, plan without them and say which assumption was made at the top of the file's `summary`.

## Week shape

1. **Weekend dinner (`wknd`)**: a "use up the fridge" dish. Fridge items go on the shopping list with aisle `In the fridge` and a have-it store, so they are not bought. Longer simmers (over the weeknight limit) belong here.
2. **Five weeknight dinners (`mon` to `fri`)**: about 30 minutes, never over `cooking.weeknightMaxMinutes`. Lower-carb and mostly wheat-free, built around vegetables and protein.
3. **Packed lunches**: Monday to Thursday dinners cook extra portions that become the next day's lunch. A dinner that feeds a lunch needs enough portions for both. Aim for three or four lunches.
4. **Friday** is the indulgent night: pasta, a burger or a rich sauce. It is the one weeknight allowed to contain wheat. Add an optional wine pairing as a shopping item.

## Every dish has a side

If a recipe has no side, add one. Its ingredients go on the shopping list like any other. Sides stand in for dropped starches: cauliflower rice, charred greens, a chopped salad, quick pickles.

## Budget

- Build most weeks on chicken, eggs, tofu, beans, ground meat and tinned fish.
- Premium proteins (`budget.premiumProteins`, for example steak and fresh salmon) appear at most `budget.premiumMaxPerMonth` times a month and at most `budget.premiumMaxPerWeek` in a week.
- Fresh fish goes early in the week (`budget.freshFishDays`).

## Shopping

- One trip, `config.stores` gives the stores. Give every item a suggested store; the household can flip it in the app.
- List quantities as what the recipes use, not pack sizes.
- Never use an ingredient in `excludedIngredients`.

## Favourites

- Read the saved roll for the coming week and place those dishes in the plan, on or after each pick's `earliest` date.
- Weekend-only favourites (over `favorites.weekendOnlyOverMinutes`) go on the weekend dinner.
- New liked dishes are added by the app as `favorites/<slug>`; the next run folds them into `favorites.json`.

## Output and checks

Write `data/weeks/<monday>.json` and update `data/current.json`. Then run the gate:

```
npm run validate
```

A failing check means the week is fixed and re-validated. It is never published as is.
The checks are listed in the README under "Data contracts and quality gate".
