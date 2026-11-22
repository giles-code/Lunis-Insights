# Lunis Insights

The single source of truth for the **Insights** section of the Lunis Partners website. It holds the Future
Finance Report series (daily briefs, weekly editions and monthly reports) and standalone insights. Every article
is one folder with a Markdown file: short fields at the top and the article below. GitHub checks the files,
renders any missing PDFs and builds the website feed in `dist/`. The website reads that feed, so editing a file
here is all it takes to update the site.

Only articles with `status: published` reach the site. Everything in this repository is public, so publish
public editions only.

## What is in the repository

```
articles/     One folder per article: articles/<publication year>/<id>/index.md, plus its PDF and card
              image if it has them. Currently 20 monthly Future Finance Reports (March 2025 to October 2026).
schema/       article.schema.json: the fields allowed at the top of every index.md.
taxonomy.json Reference lists: article types, series, practices, jurisdictions, topics, materiality, authors
              and the code rules.
SCHEMA.md     The full article rules, body conventions and a worked example.
scripts/      build.mjs (validates everything and builds dist/), pdf.mjs (renders an article's PDF).
skill/        SKILL.md: the steps Claude follows to publish an article from a submitter's details.
site/         The website pages: insights.html (list) and ffr-edition.html (one article, ?c=<CODE>),
              with their CSS/JS in site/assets/ and the home-page Insights block in site/snippets/.
assets/       Shared images (cover, header mark).
dist/         Generated website feed. Never edit by hand.
```

## Article types

| `type` | What it is | `id` | `code` (permanent public reference) | Also required |
|---|---|---|---|---|
| `daily` | Daily brief | `future-finance-daily-YYYY-MM-DD` | `FFD-YYMMDD` (publication date) | `series`, `edition` |
| `weekly` | Weekly edition | `future-finance-weekly-YYYY-wWW` | `FFW-YYWW` (ISO week of `period.end`) | `series`, `edition`, `period` |
| `monthly` | Monthly Future Finance Report | `future-finance-monthly-YYYY-MM` | `FFM-YYMM` (month covered) | `series`, `edition`, `period` |
| `insight` | Standalone article | any lower-case slug | `INS-NNNN` (next free number) | — |

The code opens the page: `ffr-edition.html?c=FFM-2610`. Never change or reuse a published code.

## The fields

Required on every article:

| Field | What it holds |
|---|---|
| `id` | Lower-case slug, the same as the folder name (pattern in the table above) |
| `code` | Permanent public reference (pattern in the table above). The build rejects duplicates |
| `type` | `daily`, `weekly`, `monthly` or `insight` |
| `title` | 5–140 characters, e.g. `Future Finance Report — October 2026` |
| `date` | Publication date, quoted: `'2026-11-19'` |
| `summary` | 40–420 characters, plain text. Card text and page description |
| `status` | `draft` (kept off the site), `published` or `withdrawn` |

Required for series items:

| Field | What it holds |
|---|---|
| `series` | `future-finance` |
| `edition` | Short label on cards: `October 2026`, `Week 47, 2026`, `Thursday 19 November 2026` |
| `period` | Weekly and monthly only: `{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }`, the review window |

Optional:

| Field | What it holds |
|---|---|
| `subtitle` | Up to 200 characters; useful for a daily's headline story |
| `jurisdictions` | From `taxonomy.json`: `EU`, `CH`, `UK`, `APAC`, `MENA`, `US`, `CA`, `LATAM`, `AFRICA`, `OFFSHORE`, `INTL` |
| `topics` | Up to 8 from `taxonomy.json`, e.g. `stablecoins`, `mica`, `aml-cft`, `tokenisation`, `funds` |
| `practice` | `advisory`, `governance` or `training` |
| `authors` | From `taxonomy.json`: `lunis-advisory` (default), `giles-swan` |
| `parent` | `id` of the weekly or monthly that brings this item together. The parent page lists its children |
| `highlights` | Up to 10 `{ materiality: High/Medium/Low, jurisdiction, text, anchor? }`. Shown as cards when the body has no "Executive Summary" |
| `keyDates` | `{ date: YYYY-MM-DD or YYYY-MM, jurisdiction, event, source?, url? }`. Feeds the "Coming up" panel |
| `sources` | `{ title, url }` list of primary sources |
| `pdf` | PDF file name in the folder, conventionally `<CODE>.pdf` |
| `image` | Card image: a file name in the folder or an `https://` URL |
| `featured` | `true` pins the article as featured on the list page |
| `legacy` | `{ originalBrand, originalTitle, note }` for back-catalogue editions |

## Written content

The article body is Markdown below the fields. Start at `##` (the page title comes from `title`). Monthly and
weekly reports run `## Executive Summary`, one `##` per region, numbered `### 1. EU — headline` entries,
`## Also noted` and a horizon scan. Public editions leave out client-specific material; the build rejects a body
that still has the confidential footer. Full conventions and an example are in [`SCHEMA.md`](SCHEMA.md).

## Adding or changing an article

1. Ask Claude to publish it: [`skill/SKILL.md`](skill/SKILL.md) sets out the steps. Or copy an existing
   folder, rename it to the new `id` and edit `index.md`.
2. Check locally, or let GitHub do it on push:

   ```
   npm ci
   npm run check      # validate only
   npm run build      # validate and rebuild dist/
   npm run pdf -- <CODE>
   ```

3. On every push to `main`, `.github/workflows/build.yml` renders any PDFs named in the fields but missing,
   validates everything and commits a rebuilt `dist/`.

## Website feed

The pages read `https://raw.githubusercontent.com/giles-code/Lunis-Insights/main/dist/`.

- `dist/index.json`: taxonomy, counts and one card per published article (newest first), with previous/next,
  parent and children. Read by `insights.html`.
- `dist/articles/<CODE>.json`: the card plus the rendered article, contents, highlights, key dates and sources.
  Read by `ffr-edition.html?c=<CODE>`.
- `dist/key-dates.json`: future key dates across all published articles, de-duplicated. Feeds "Coming up".
