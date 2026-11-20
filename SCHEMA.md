# Lunis Insights — article schema

Every article is one folder in this repository:

```
articles/<publication year>/<id>/
  index.md        front matter (YAML) + body (Markdown)   ← required
  <CODE>.pdf      downloadable PDF                        ← optional, named in `pdf:`
  <image>         card image                              ← optional, named in `image:`
```

`node scripts/build.mjs` validates every article against `schema/article.schema.json` and `taxonomy.json`, then writes the feed the website reads:

| File | Used by | Contents |
|---|---|---|
| `dist/index.json` | `insights.html` | taxonomy, counts, and one card per published article (newest first), with sequence (previous/next), parent and children |
| `dist/articles/<CODE>.json` | `ffr-edition.html?c=<CODE>` | the card plus rendered `html`, `toc`, `highlights`, `keyDates`, `sources` |
| `dist/key-dates.json` | "Coming up" panel | future key dates across all published articles, de-duplicated |

## Article types

| `type` | What it is | `id` | `code` (shareable) | Required extras |
|---|---|---|---|---|
| `daily` | Daily brief | `future-finance-daily-YYYY-MM-DD` | `FFD-YYMMDD` (publication date) | `series`, `edition` |
| `weekly` | Weekly edition | `future-finance-weekly-YYYY-wWW` | `FFW-YYWW` (ISO week of `period.end`) | `series`, `edition`, `period` |
| `monthly` | Monthly Future Finance Report | `future-finance-monthly-YYYY-MM` | `FFM-YYMM` (month covered) | `series`, `edition`, `period` |
| `insight` | Standalone article | any lower-case slug | `INS-NNNN` (next free number) | — |

The **code** is the permanent public reference. The share link is
`https://<site>/ffr-edition.html?c=FFM-2610`. The build rejects a duplicate or a code that doesn't match the rule. Never change or reuse a published code.

**Sequencing.** Items of the same series and type are numbered by date. Each page links to the previous and next item. A daily brief can name its weekly edition in `parent`, and a weekly edition can name its monthly report. The parent page then lists everything it "brings together".

## Front matter fields

| Field | Required | Notes |
|---|---|---|
| `id` | ✔ | Lower-case slug; equals the folder name |
| `code` | ✔ | See table above |
| `type` | ✔ | `daily` · `weekly` · `monthly` · `insight` |
| `series` | series items | `future-finance` |
| `title` | ✔ | 5–140 characters. Convention: `Future Finance Report — October 2026`, `Future Finance Weekly — Week 47, 2026`, `Future Finance Daily — 19 November 2026` |
| `subtitle` | | Up to 200 characters; good for a daily's headline story |
| `edition` | series items | Short label on cards: `October 2026` · `Week 47, 2026` · `Thursday 19 November 2026` |
| `date` | ✔ | Publication date, `YYYY-MM-DD` (quote it: `'2026-11-19'`) |
| `period` | weekly, monthly | `{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }` — the review window |
| `summary` | ✔ | 40–420 characters, plain text. Card text and meta description |
| `jurisdictions` | | Keys from `taxonomy.json`: `EU UK APAC MENA US CA LATAM AFRICA OFFSHORE INTL` |
| `topics` | | Up to 8 keys from `taxonomy.json` (e.g. `stablecoins`, `mica`, `aml-cft`) |
| `practice` | | `advisory` · `governance` · `training` |
| `authors` | | Keys from `taxonomy.json` (default `lunis-advisory`) |
| `parent` | | `id` of the consolidating weekly/monthly |
| `highlights` | | Up to 10 `{ materiality: High\|Medium\|Low, jurisdiction, text, anchor? }`. Shown as cards when the body has no "Executive Summary" section |
| `keyDates` | | `{ date: YYYY-MM-DD or YYYY-MM, jurisdiction, event, source?, url? }` — feeds "Coming up" |
| `sources` | | `{ title, url }` list for the primary sources |
| `pdf` | | File name in the folder, conventionally `<CODE>.pdf` |
| `image` | | File name in the folder or an `https://` URL |
| `featured` | | `true` to pin as featured (reserved for the list page) |
| `status` | ✔ | `draft` (kept out of the feed) · `published` · `withdrawn` |
| `legacy` | | `{ originalBrand, originalTitle, note }` for back-catalogue editions |

## Body conventions (Markdown, GitHub-flavoured)

- Start at `##`. Never use `#`; the page title comes from `title`.
- Sub-groups inside `## Also noted` (e.g. "Stablecoins, CBDC and payments") are `###` headings, so they appear in the contents.
- Monthly and weekly reports: `## Executive Summary`, then one `##` per region (`## European Union`, `## United Kingdom` …). Each entry is a numbered `### 1. EU — headline`. Finish with `## Also noted` and `## Horizon Scan …`.
- Inside an entry, use bold run-in labels: `**Summary:**`, `**What it means for firms:**`, `**Timeline:**`, `**Assessment:**`.
- Tables use pipe syntax. Links are inline. No images in the body for now.
- **Public edition rules.** Leave out the client-specific material: the "Decide and Act" table, suggested owners, "Suggested Actions", "Revenue Impact", the confidential footer and the client's product-line names. The build rejects a body that still contains the confidential footer.

## Minimal example (daily)

```markdown
---
id: future-finance-daily-2026-11-19
code: FFD-261119
type: daily
series: future-finance
title: Future Finance Daily — 19 November 2026
subtitle: FCA closes its perimeter consultation; CFTC comment period ends
edition: Thursday 19 November 2026
date: '2026-11-19'
summary: The FCA's consultations on perimeter and DeFi guidance closed yesterday. The CFTC's comment period on event contracts also ended. What happens next and when final rules are expected.
jurisdictions: [UK, US]
topics: [crypto-licensing, defi, derivatives]
practice: advisory
authors: [lunis-advisory]
parent: future-finance-weekly-2026-w47
keyDates:
  - { date: '2027-01', jurisdiction: UK, event: 'FCA final perimeter and DeFi guidance expected', source: 'FCA CP26/36' }
sources:
  - { title: 'FCA CP26/36', url: 'https://www.fca.org.uk/' }
pdf: FFD-261119.pdf
status: published
---

## UK — perimeter guidance consultation closes

**Summary:** …

**What it means for firms:** …
```
