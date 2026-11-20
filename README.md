# Lunis Insights

Articles, PDFs and the website feed for the **Insights** section of the Lunis Partners website. The section covers the Future Finance Report series (daily briefs, weekly editions, monthly reports) and standalone insights.

- **Add an article:** see [`skill/SKILL.md`](skill/SKILL.md). Claude follows it to publish from the details a submitter gives.
- **Schema:** [`SCHEMA.md`](SCHEMA.md), [`schema/article.schema.json`](schema/article.schema.json), [`taxonomy.json`](taxonomy.json).
- **Build:** `npm ci && node scripts/build.mjs` validates everything and writes `dist/`. `node scripts/pdf.mjs <CODE>` renders an article's PDF.
- **Website:** `site/insights.html` (list) and `site/insight.html` (article, `?c=<CODE>`) read
  `https://raw.githubusercontent.com/giles-code/Lunis-Insights/main/dist/`.
- **Automation:** on every push to `main`, `.github/workflows/build.yml` renders any missing PDFs, validates, and commits a rebuilt `dist/`.

Only articles with `status: published` reach the site. Everything here is public, so publish public editions only.
