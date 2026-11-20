---
name: lunis-insights-publisher
description: Publish a Lunis Partners insight (Future Finance daily brief, weekly edition, monthly report, or standalone insight) to the giles-code/Lunis-Insights GitHub repo so it appears on the Lunis website with its own share link and PDF.
---

# Lunis Insights publisher

You publish articles to the Lunis Partners website. Articles live in the GitHub repo **giles-code/Lunis-Insights**. The website (`insights.html` for the list, `insight.html?c=<CODE>` for an article) reads the feed that the repo builds, so nothing on Wix needs changing for a new article.

The submitter only supplies the details and the text. You do everything else: code, file, front matter, PDF, validation, commit, and the share link.

## 1. Get the repo

- Attach and clone `giles-code/Lunis-Insights` with push access. In Claude Code on the web, use the add_repo tool; otherwise `git clone`. Run `npm ci` once.
- Read `SCHEMA.md` and `taxonomy.json` before writing anything. They are the source of truth. If anything there conflicts with this skill, follow the repo.

## 2. Collect the details (ask only for what's missing)

| Ask for | Notes |
|---|---|
| Type | daily brief · weekly edition · monthly report · standalone insight |
| Text | Pasted text, or an attached .docx/.md/.pdf. Convert .docx with `pandoc -t gfm --wrap=none` |
| Publication date | Default: today (Europe/London) |
| Review window | Weekly and monthly only. Weekly default: the previous Saturday to Friday. Monthly default: the calendar month |
| Own PDF? | If they attach a finished public PDF, use it. Otherwise one is generated |
| Status | Default `published`. Use `draft` if they say it is not ready |

Work out everything else yourself: summary, jurisdictions, topics, highlights, key dates and sources. Ask with one compact question, not a series of questions.

## 3. Assign id and code (never reuse; check the repo first)

| Type | id | code |
|---|---|---|
| daily | `future-finance-daily-YYYY-MM-DD` | `FFD-YYMMDD` (publication date) |
| weekly | `future-finance-weekly-YYYY-wWW` | `FFW-YYWW` (ISO week of the period end) |
| monthly | `future-finance-monthly-YYYY-MM` | `FFM-YYMM` (month covered) |
| insight | short lower-case slug from the title | `INS-NNNN`: one more than the highest existing INS code (`grep -rh "^code: INS-" articles`) |

If the id or code already exists, stop and ask whether this replaces the published item (a correction) or is a different item.

## 4. Write `articles/<YYYY>/<id>/index.md`

- Front matter must match `schema/article.schema.json`, as in the example in `SCHEMA.md`. Quote every date (`'2026-11-19'`).
- Titles: `Future Finance Daily — 19 November 2026` · `Future Finance Weekly — Week 47, 2026` · `Future Finance Report — November 2026`. Editions: `Thursday 19 November 2026` · `Week 47, 2026` · `November 2026`.
- Summary: 2–3 plain sentences, 40–420 characters, saying what happened and why it matters.
- `jurisdictions` and `topics` must use keys from `taxonomy.json` only (at most 8 topics). If a topic is genuinely missing, add it to `taxonomy.json` in the same commit and tell the submitter.
- `highlights` (weekly/monthly): one per High or Medium item. `keyDates`: every dated deadline in the text, including month-only dates as `YYYY-MM`.
- `pdf: <CODE>.pdf`.
- Body: Markdown starting at `##`, following the body conventions in `SCHEMA.md`.

**Linking the sequence.**
- Daily → weekly: if that week's weekly edition already exists, set `parent` on the daily.
- Weekly → monthly: if the month's report already exists, set `parent` on the weekly.
- Publishing a weekly: also set `parent: <weekly id>` on every daily whose date falls in its period.
- Publishing a monthly: also set `parent: <monthly id>` on every weekly whose period ends in that month.

## 5. Public-edition check (mandatory)

This is a public website. Before saving, remove or generalise:
- "Decide and Act" tables, suggested owners (CEO/CRO/COO), "Suggested Actions", "Revenue Impact".
- Any client name, client product-line names (e.g. "Core Trading Markets", "Yield, Earn and Staking Services"), "our client", and internal remarks.
- The footer "Confidential — prepared for board and senior management use".

Rename "CASP Implications (firm analysis)" to "What it means for firms". Keep regulators' names, dates, figures and sources exactly as given. Do not add facts that aren't in the submitted text.

## 6. Build, check, publish

```bash
node scripts/pdf.mjs <CODE>     # skip if the submitter supplied a PDF (save it as <CODE>.pdf)
node scripts/build.mjs          # must print ✓; fix every ✗ it reports
```

- Look at page 1 and one inner page of the PDF (`pdftoppm -r 50 -png -f 1 -l 2`) to check the layout.
- Show the submitter: the title, code, summary, highlight count, the files touched, and anything you removed under step 5. Get a yes before pushing. Skip this only if they said to publish without review.
- Commit to `main`: `Add FFD-261119: Future Finance Daily — 19 November 2026`. Include `dist/`. Run `git pull --rebase` first, because the GitHub Action sometimes adds its own commit. Then push.
- If the push is declined for email privacy, commit as `giles-code <318535383+giles-code@users.noreply.github.com>`.
- If Chrome isn't available, commit without the PDF but keep `pdf:` in the front matter. The GitHub Action renders missing PDFs and rebuilds `dist/`.

## 7. Report back

Give the share link and the reference code:
`https://<site>/insight.html?c=<CODE>` (on the preview site today: `https://headless-szfaokhodwa-gilesswan-1409.wix-site-host.com/insight.html?c=<CODE>`).
It appears on the site within about five minutes, which is how long GitHub's raw-file cache takes to refresh.

## Corrections and withdrawals

- **Correction:** edit the same file and keep the id and code. Re-render the PDF.
- **Withdrawal:** set `status: withdrawn`. Never delete the folder or reuse the code. Links then show "could not find", which is intended.
