// Renders an article's index.md to a branded PDF in the same folder (file name = front matter `pdf`).
// Usage: node scripts/pdf.mjs <code-or-id> [--html]   (--html also keeps the intermediate HTML)
// Needs Google Chrome or Chromium. Set CHROME=/path/to/chrome if it is not found automatically.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const want = process.argv[2];
if (!want) { console.error('usage: node scripts/pdf.mjs <code-or-id> | --missing'); process.exit(1); }
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy.json'), 'utf8'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name === 'index.md' ? [p] : [];
  });
}
if (want === '--missing') {
  let n = 0;
  for (const f of walk(path.join(ROOT, 'articles'))) {
    const m = fs.readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const fm = YAML.parse(m[1]);
    if (fm.pdf && fm.status !== 'withdrawn' && !fs.existsSync(path.join(path.dirname(f), fm.pdf))) {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), fm.code], { stdio: 'inherit' }); n++;
    }
  }
  console.log(`${n} missing PDF(s) rendered.`);
  process.exit(0);
}
let found;
for (const f of walk(path.join(ROOT, 'articles'))) {
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) continue;
  const fm = YAML.parse(m[1]);
  if (fm.code === want || fm.id === want) { found = { f, fm, body: m[2] }; break; }
}
if (!found) { console.error(`no article with code or id "${want}"`); process.exit(1); }
const { f, fm, body } = found;
if (!fm.pdf) { console.error('front matter has no `pdf:` file name'); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const typeLabel = taxonomy.types.find((t) => t.key === fm.type)?.label || '';
const series = taxonomy.series.find((s) => s.key === fm.series);
const jlabel = (k) => taxonomy.jurisdictions.find((j) => j.key === k)?.label || k;

const html = marked.parse(body, { gfm: true });
const hasExec = /^##\s+Executive Summary/m.test(body);
const highlights = (fm.highlights || []).map((h) => `
  <div class="hl hl-${h.materiality.toLowerCase()}"><span class="tag">${esc(h.materiality)} · ${esc(jlabel(h.jurisdiction))}</span><p>${esc(h.text)}</p></div>`).join('');

const doc = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(fm.title)}</title>
<style>
@page { size: A4; margin: 20mm 18mm 22mm; @bottom-left { content: "Lunis Partners · ${esc(series ? series.title : 'Insights')} · ${esc(fm.edition || '')}"; font: 8pt Inter, sans-serif; color: #6b7280; } @bottom-right { content: counter(page); font: 8pt Inter, sans-serif; color: #6b7280; } }
@page :first { margin: 0; @bottom-left { content: none } @bottom-right { content: none } }
:root { --ink:#14213d; --accent:#8a6d3b; --muted:#6b7280; --rule:#e5e7eb; --high:#9b2c2c; --med:#b7791f; --low:#4a5568; }
* { box-sizing: border-box; }
body { font: 10pt/1.5 Inter, system-ui, sans-serif; color: #1f2937; margin: 0; }
.cover { height: 297mm; padding: 34mm 22mm 24mm; background: var(--ink); color: #fff; display: flex; flex-direction: column; page-break-after: always; }
.cover .brand { font: 600 11pt Inter; letter-spacing: .22em; text-transform: uppercase; color: #d6c7a1; }
.cover .kicker { margin-top: 60mm; font: 600 9pt Inter; letter-spacing: .18em; text-transform: uppercase; color: #cbd5e1; }
.cover h1 { font: 500 34pt/1.1 Lora, Georgia, serif; margin: 6mm 0 4mm; }
.cover h1 em { color: #d6c7a1; }
.cover .edition { font: italic 18pt Lora, Georgia, serif; color: #e2e8f0; }
.cover dl { margin-top: auto; display: grid; grid-template-columns: 34mm 1fr; gap: 2mm 6mm; font-size: 9.5pt; color: #e2e8f0; }
.cover dt { color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; font-size: 8pt; padding-top: 1pt; }
.cover .code { margin-top: 10mm; font-size: 8.5pt; color: #94a3b8; }
.summary { font: 12pt/1.55 Lora, Georgia, serif; color: var(--ink); border-left: 3px solid var(--accent); padding-left: 5mm; margin: 0 0 7mm; }
.hls { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 8mm; }
.hl { border: 1px solid var(--rule); border-top: 3px solid var(--low); padding: 3mm 4mm; break-inside: avoid; }
.hl-high { border-top-color: var(--high); } .hl-medium { border-top-color: var(--med); }
.hl .tag { font: 600 7.5pt Inter; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.hl p { margin: 1.5mm 0 0; font-size: 9pt; }
h2 { font: 500 17pt/1.2 Lora, Georgia, serif; color: var(--ink); margin: 9mm 0 3mm; padding-bottom: 2mm; border-bottom: 1px solid var(--rule); break-after: avoid; }
h3 { font: 600 11.5pt/1.3 Inter; color: var(--ink); margin: 7mm 0 2mm; break-after: avoid; }
h2 + h3 { margin-top: 3mm; }
p, li { orphans: 3; widows: 3; }
ul { padding-left: 5mm; } li { margin: 1mm 0; }
blockquote { margin: 2mm 0; padding: 2mm 4mm; background: #f8f7f3; border-left: 3px solid var(--accent); font-size: 9pt; }
blockquote p { margin: 0; }
a { color: #1d4ed8; text-decoration: none; word-break: break-word; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 3mm 0 5mm; }
th { text-align: left; background: var(--ink); color: #fff; font-weight: 600; padding: 1.5mm 2mm; }
td { border-bottom: 1px solid var(--rule); padding: 1.5mm 2mm; vertical-align: top; }
tr { break-inside: avoid; }
.end { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid var(--rule); font-size: 8pt; color: var(--muted); }
</style></head><body>
<section class="cover">
  <div class="brand">Lunis Partners</div>
  <div class="kicker">${esc(series ? series.strapline : typeLabel)}</div>
  <h1>${esc(series ? series.title : fm.title)}</h1>
  <div class="edition">${esc(fm.edition || fmtDate(fm.date))}${series ? ' · ' + esc(typeLabel) : ''}</div>
  <dl>
    <dt>Published</dt><dd>${fmtDate(fm.date)}</dd>
    ${fm.period ? `<dt>Review window</dt><dd>${fmtDate(fm.period.start)} – ${fmtDate(fm.period.end)}</dd>` : ''}
    ${fm.jurisdictions?.length ? `<dt>Coverage</dt><dd>${fm.jurisdictions.map(jlabel).map(esc).join(' · ')}</dd>` : ''}
  </dl>
  <div class="code">Reference ${esc(fm.code)} · lunispartners.com/insight.html?c=${esc(fm.code)}</div>
</section>
<main>
  ${hasExec ? '' : `<p class="summary">${esc(fm.summary)}</p>`}
  ${highlights && !hasExec ? `<div class="hls">${highlights}</div>` : ''}
  ${html}
  <p class="end">© ${fm.date.slice(0, 4)} Lunis Partners. This publication is general information on regulatory developments, not legal or regulatory advice for any particular firm. Reference ${esc(fm.code)}.</p>
</main></body></html>`;

const dir = path.dirname(f);
const tmp = path.join(os.tmpdir(), `lunis-${fm.code}.html`);
fs.writeFileSync(tmp, doc);
if (process.argv.includes('--html')) fs.copyFileSync(tmp, path.join(dir, `${fm.code}.html`));
const chrome = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!chrome) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(1); }
const out = path.join(dir, fm.pdf);
execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
  `--print-to-pdf=${out}`, pathToFileURL(tmp).href], { stdio: 'pipe' });
console.log(`✓ ${path.relative(ROOT, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
