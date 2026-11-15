# Roadmap: from public demo to a private, synced household planner

This is a plan, not finished work. Mesa today runs on invented sample data, with saved state on one device. The roadmap describes how the same code could become a planner that two people share, without putting any real household data in this public repo.

## The shape of the plan

```
public repo: mesa-meal-planner           private repo: household deployment
  engine + sample data + demo     ---->    real config, weeks, favourites, routines
  (this repo, GitHub Pages)                (Cloudflare Worker + D1 + Access)
```

## 1. Split the repos

- The public `mesa-meal-planner` stays the engine: front end, schemas, validator, tests and sample data, with a public demo.
- A separate **private** repo (or a private deployment config) holds the real household setup. Real meal plans, routines and names never touch this repo or its history.
- The private repo consumes the engine by copying or vendoring `js/`, `css/`, `schemas/` and `scripts/`, and replaces `data/` with real files. Because the front end is static and data-driven, this needs no code changes.

## 2. Hosting: Cloudflare Workers with static assets

Cloudflare recommends Workers with static assets for new projects over Pages. One Worker serves the same static front end and adds a few small routes under `/api/*`. The static files stay identical to the ones GitHub Pages serves today.

## 3. Shared sync between phones: Cloudflare D1

Ticks, store choices, favourites and rolls move from `localStorage` to D1 (SQLite), so two phones see each other's changes right away. KV is the alternative, but its writes can take up to about 60 seconds to propagate, which is noticeable when two people tick the same list.

The swap is a second adapter for `js/storage.js` and `js/data.js`. That is why both exist as small interfaces today: the rendering code never changes.

A sketch of the table, one row per saved-state key (the key layout is already identical):

```sql
CREATE TABLE kv (
  key        TEXT PRIMARY KEY,   -- e.g. shops/w-2026-11-16/items/garlic
  value      TEXT NOT NULL,      -- JSON, same shape the localStorage adapter stores
  updated_at TEXT NOT NULL       -- ISO timestamp, already written by storage.js
);

-- last write wins, and a stale write from an offline phone cannot overwrite a newer one
INSERT INTO kv (key, value, updated_at) VALUES (?1, ?2, ?3)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
WHERE excluded.updated_at > kv.updated_at;

-- list(prefix)
SELECT key, value, updated_at FROM kv WHERE key >= ?1 AND key < ?2;  -- prefix and prefix + U+FFFF
```

The HTTP adapter implements `get`, `set`, `remove` and `list(prefix)` against `/api/kv/*`, and uses polling or a refetch on focus in place of the `storage` event that `subscribe` uses today.

## 4. Login: Cloudflare Access

Cloudflare Access (free for up to 50 users) sits in front of the whole site and the API. Only the household's email addresses are allowed in, with a one-time email PIN. The allowed emails are set in the Cloudflare dashboard and never committed. Access must also cover the `*.workers.dev` hostname and any preview URLs, so there is no unprotected path to the data.

## 5. Weekly data

The scheduled AI planning run (see `docs/PLAYBOOK.md`) writes each new week either to D1 through the API or as a commit to the private repo, which gives version history for free. It never goes into the public repo. The validation gate runs on the file before it is accepted, in both cases.

## 6. Cost

Expected $0 on the free tiers (GitHub, Workers, D1, Access) for two users. A custom domain is optional, at about $10 to $15 a year.

## 7. Migration

Export the current household data (favourites, rolls, shopping ticks) from the existing planner into D1. The key formats already match:

| Key | Value |
| --- | --- |
| `shops/w-<Monday>/items/<itemId>` | `{ c, s }` |
| `favorites/<slug>` | favourite record |
| `rotation/w-<Monday>` | `{ picks, rolledAt, week }` |

## Open questions

- Polling interval versus a Durable Object for push updates once the list is edited by two people at once.
- Whether to keep weeks in D1 as well, so history queries (for example "how often did we cook fish this quarter") become plain SQL.
- Backups: a nightly export of D1 to the private repo.
