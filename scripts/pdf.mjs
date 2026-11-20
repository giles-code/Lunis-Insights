// Renders an article's index.md to a PDF in the Lunis Advisory house style
// (sage cover with logo, dark green pages, gold accents, contents page with page numbers).
// Usage: node scripts/pdf.mjs <code-or-id> [--html]   |   node scripts/pdf.mjs --missing   |   node scripts/pdf.mjs --all
// Needs Google Chrome or Chromium (set CHROME=/path if not found). Uses pdfinfo/pdftotext (poppler) for
// contents page numbers when available; without them the contents page is printed without numbers.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const want = process.argv[2];
if (!want) { console.error('usage: node scripts/pdf.mjs <code-or-id> | --missing | --all'); process.exit(1); }
const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy.json'), 'utf8'));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name === 'index.md' ? [p] : [];
  });
}
function readArticle(f) {
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { f, fm: YAML.parse(m[1]), body: m[2] } : null;
}

if (want === '--missing' || want === '--all') {
  let n = 0;
  for (const f of walk(path.join(ROOT, 'articles'))) {
    const a = readArticle(f);
    if (!a || !a.fm.pdf || a.fm.status === 'withdrawn') continue;
    if (want === '--all' || !fs.existsSync(path.join(path.dirname(f), a.fm.pdf))) {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url), a.fm.code], { stdio: 'inherit' }); n++;
    }
  }
  console.log(`${n} PDF(s) rendered.`);
  process.exit(0);
}

const found = walk(path.join(ROOT, 'articles')).map(readArticle).find((a) => a && (a.fm.code === want || a.fm.id === want));
if (!found) { console.error(`no article with code or id "${want}"`); process.exit(1); }
const { f, fm, body } = found;
if (!fm.pdf) { console.error('front matter has no `pdf:` file name'); process.exit(1); }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtDate = (d, o) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', o || { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const typeLabel = taxonomy.types.find((t) => t.key === fm.type)?.label || '';
const series = taxonomy.series.find((s) => s.key === fm.series);
const jshort = { EU: 'EU', CH: 'Switzerland', UK: 'UK', APAC: 'APAC', MENA: 'MENA', US: 'US', CA: 'Canada', LATAM: 'LatAm', AFRICA: 'Africa', OFFSHORE: 'Offshore', INTL: 'standard setters' };
const kicker = { monthly: 'MONTHLY GLOBAL DIGITAL ASSETS REGULATORY INTELLIGENCE', weekly: 'WEEKLY DIGITAL ASSETS REGULATORY INTELLIGENCE', daily: 'DAILY DIGITAL ASSETS REGULATORY BRIEF' }[fm.type] || 'LUNIS PARTNERS INSIGHTS';
const runningTitle = `${series ? series.title : fm.title}${fm.edition ? ' · ' + fm.edition : ''}`;
const cssStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// ---------- body HTML with heading ids and house-style classes ----------
const MAJOR = /^(Executive Summary|Contents|Also noted|Horizon|Priority|Decide|DORA and MiCA|Verification|Sources|Notes|Methodology)/i;
const toc = []; const used = new Set();
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 's';
const renderer = new marked.Renderer();
renderer.heading = function (text, level, raw) {
  let id = slug(raw || text); const base = id; let n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id);
  const plain = (raw || text).replace(/<[^>]+>/g, '').replace(/\*/g, '').replace(/&amp;/g, '&');
  let cls = '';
  if (level === 2) cls = MAJOR.test(plain) ? 'major' : 'region';
  if (level <= 3) toc.push({ level, id, text: plain, cls });
  return `<h${level} id="${id}"${cls ? ` class="${cls}"` : ''}>${text}</h${level}>\n`;
};
renderer.link = (href, title, text) => `<a href="${href}">${text}</a>`;
let html = marked.parse(body, { renderer, gfm: true });
html = html
  .replace(/\\?\[(High)\\?\]/g, '<span class="m-high">[High]</span>')
  .replace(/\\?\[(Medium)\\?\]/g, '<span class="m-med">[Medium]</span>')
  .replace(/\\?\[(Low)\\?\]/g, '<span class="m-low">[Low]</span>')
  .replace(/<td>(\s*)(High|Critical)(\s*)<\/td>/g, '<td class="m-high">$2</td>')
  .replace(/<td>(\s*)(Medium)(\s*)<\/td>/g, '<td class="m-med">$2</td>')
  .replace(/<td>(\s*)(Low)(\s*)<\/td>/g, '<td class="m-low">$2</td>');
const hasExec = toc.some((t) => /^Executive Summary/i.test(t.text));

const assetUrl = (n) => pathToFileURL(path.join(ASSETS, n)).href;
const coverage = (fm.jurisdictions || []).map((j) => jshort[j] || j).join(' · ');
const highlights = (!hasExec && fm.highlights?.length) ? `<section class="hls">${fm.highlights.map((h) =>
  `<p><span class="m-${h.materiality === 'High' ? 'high' : h.materiality === 'Medium' ? 'med' : 'low'}">[${esc(h.materiality)}]</span> ${esc(h.text)}</p>`).join('')}</section>` : '';

function buildDoc(pages) {
  const tocHtml = toc.map((t) => `<div class="toc-row l${t.level}${t.cls === 'region' ? ' region' : ''}"><a href="#${t.id}">${esc(t.text)}</a><span class="pg">${pages?.[t.id] ?? ''}</span></div>`).join('');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(fm.title)}</title>
<style>
:root { --bg:#45544A; --bg2:#4D5D52; --head:#2C3830; --rule:#8A9C8F; --gold:#DAC48A; --text:#FFFFFF; --soft:#DDE5DF; --high:#FFB3A7; --med:#F5C76B; --low:#A9D8B2; }
@page { size:A4; margin:21mm 17mm 18mm; background:#45544A;
  @top-left { content: url(${assetUrl('lunis-mark-header.svg')}) "  LUNIS ADVISORY"; font:700 6.8pt Arial, "Liberation Sans", sans-serif; color:#DAC48A; letter-spacing:.04em; vertical-align:bottom; padding-bottom:2.2mm; border-bottom:0.6pt solid #DAC48A; }
  @top-right { content: "${cssStr(runningTitle)}"; font:6.8pt Arial, "Liberation Sans", sans-serif; color:#DDE5DF; vertical-align:bottom; padding-bottom:2.6mm; border-bottom:0.6pt solid #DAC48A; }
  @bottom-left { content: "Lunis Partners · Public edition · general information, not advice · Ref. ${cssStr(fm.code)}"; font:6.3pt Arial, "Liberation Sans", sans-serif; color:#DDE5DF; vertical-align:top; padding-top:4mm; }
  @bottom-right { content: counter(page); font:700 7pt Arial, "Liberation Sans", sans-serif; color:#DAC48A; vertical-align:top; padding-top:4mm; }
}
@page cover { margin:0; @top-left { content:none; border:0 } @top-right { content:none; border:0 } @bottom-left { content:none } @bottom-right { content:none } }
html { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { margin:0; font:9.6pt/1.55 Arial, "Liberation Sans", Helvetica, sans-serif; color:var(--text); }
a { color:var(--gold); text-decoration:underline; text-decoration-thickness:0.5pt; text-underline-offset:1.5pt; word-break:break-word; }

.cover { page:cover; position:relative; width:210mm; height:297mm; background:url(${assetUrl('lunis-advisory-cover.jpg')}) center/cover no-repeat; break-after:page; overflow:hidden; }
.cover .kicker { position:absolute; top:133mm; left:0; right:0; text-align:center; font:7.6pt Arial, "Liberation Sans", sans-serif; letter-spacing:.06em; color:var(--gold); }
.cover h1 { position:absolute; top:139mm; left:0; right:0; text-align:center; font:400 27pt/1.15 Arial, "Liberation Sans", sans-serif; margin:0; color:#fff; }
.cover .ed { position:absolute; top:154mm; left:0; right:0; text-align:center; font:italic 17pt Arial, "Liberation Sans", sans-serif; color:#fff; }
.cover dl { position:absolute; top:205mm; left:23mm; right:23mm; display:grid; grid-template-columns:31mm 1fr; gap:1.2mm 0; font:7.6pt Arial, "Liberation Sans", sans-serif; margin:0; }
.cover dt { color:var(--gold); text-transform:uppercase; } .cover dd { margin:0; color:#fff; }
.cover .note { position:absolute; top:240mm; left:23mm; right:23mm; font:7pt/1.55 Arial, "Liberation Sans", sans-serif; color:#E8EDE9; }
.cover .note b { color:var(--gold); font-weight:400; }

h2.major { font:700 15pt/1.25 Arial, "Liberation Sans", sans-serif; color:#fff; margin:0 0 5mm; padding-bottom:2.2mm; border-bottom:1.4pt solid var(--gold); break-after:avoid; }
h2.region { font:700 11.5pt Arial, "Liberation Sans", sans-serif; color:var(--gold); text-transform:uppercase; letter-spacing:.02em; margin:0 0 4mm; padding-bottom:1.6mm; border-bottom:0.6pt solid var(--gold); break-after:avoid; }
main h2 { break-before:page; }
main h2:first-of-type { break-before:auto; }
h3 { font:700 10.6pt/1.35 Arial, "Liberation Sans", sans-serif; color:#fff; margin:6mm 0 2.5mm; break-after:avoid; }
h2 + h3 { margin-top:2mm; }
h4 { font:700 9.6pt Arial, "Liberation Sans", sans-serif; color:var(--gold); margin:4mm 0 1.5mm; break-after:avoid; }
p { margin:0 0 2.6mm; orphans:3; widows:3; }
ul, ol { margin:0 0 3mm; padding-left:6mm; }
ul { list-style:none; } ul > li { position:relative; } ul > li::before { content:"–"; position:absolute; left:-4.5mm; color:var(--soft); }
li { margin:1.2mm 0; } li > p { margin:0 0 1mm; }
blockquote { margin:0 0 3mm; padding:0.5mm 0 0.5mm 3.5mm; border-left:1.3pt solid var(--soft); color:#F1F4F2; }
blockquote p { margin:0 0 1.2mm; }
hr { border:0; border-top:0.6pt solid var(--rule); margin:4mm 0; }
.m-high { color:var(--high); font-weight:700; } .m-med { color:var(--med); font-weight:700; } .m-low { color:var(--low); font-weight:700; }

table { width:100%; border-collapse:collapse; margin:2mm 0 5mm; font-size:7.6pt; line-height:1.4; }
th { background:var(--head); color:#fff; font-weight:700; text-align:center; padding:1.8mm 1.6mm; border:0.5pt solid var(--rule); }
td { background:var(--bg2); color:#fff; padding:1.6mm 1.8mm; border:0.5pt solid var(--rule); vertical-align:top; }
tr { break-inside:avoid; }

.contents { break-after:page; }
.contents .toc-row { display:flex; gap:3mm; font-size:7.4pt; line-height:1.35; padding:0.45mm 0; break-inside:avoid; }
.contents .toc-row a { flex:1; color:#fff; text-decoration:none; }
.contents .toc-row .pg { min-width:8mm; text-align:right; color:#fff; }
.contents .l2 a { font-weight:700; } .contents .l2.region { padding-left:4mm; } .contents .l2.region a { font-weight:400; text-transform:uppercase; }
.contents .l3 { padding-left:8mm; }

.hls p { margin-bottom:2mm; }
.end { margin-top:8mm; padding-top:3mm; border-top:0.6pt solid var(--gold); font-size:7.4pt; color:var(--soft); break-inside:avoid; }
</style></head><body>
<section class="cover">
  <div class="kicker">${esc(kicker)}</div>
  <h1>${esc(series ? series.title : fm.title)}</h1>
  <div class="ed">${esc(fm.edition || fmtDate(fm.date))}</div>
  <dl>
    <dt>Report date:</dt><dd>${esc(longDate(fm.date))}</dd>
    ${fm.period ? `<dt>Review window:</dt><dd>${esc(fmtDate(fm.period.start, { day: 'numeric', month: 'long', timeZone: 'UTC' }))} – ${esc(fmtDate(fm.period.end))}</dd>` : ''}
    ${coverage ? `<dt>Coverage:</dt><dd>${esc(coverage)}</dd>` : ''}
    <dt>Reference:</dt><dd>${esc(fm.code)}</dd>
  </dl>
  <div class="note"><b>Public edition.</b> General information on regulatory developments, not legal or regulatory advice for any particular firm.${fm.legacy?.originalBrand ? ` First published by ${esc(fm.legacy.originalBrand)}; republished by Lunis Partners.` : ''}<br>Online: lunispartners.com/ffr-edition.html?c=${esc(fm.code)}</div>
</section>
${toc.length > 3 ? `<section class="contents"><h2 class="major">Contents</h2>${tocHtml}</section>` : ''}
<main><div style="color:#45544A;font-size:3pt;line-height:3pt;height:3pt;margin-bottom:-3pt">LUNISMAINSTART</div>
  ${!hasExec ? `<p style="font-size:11pt;line-height:1.55">${esc(fm.summary)}</p>` : ''}
  ${highlights}
  ${html}
  <p class="end">© ${fm.date.slice(0, 4)} Lunis Partners. This public edition is general information on regulatory developments. It is not legal or regulatory advice for any particular firm; check primary sources before acting. Reference ${esc(fm.code)} · lunispartners.com/ffr-edition.html?c=${esc(fm.code)}</p>
</main></body></html>`;
}

const chrome = process.env.CHROME || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!chrome) { console.error('Chrome not found; set CHROME=/path/to/chrome'); process.exit(1); }
const dir = path.dirname(f);
const out = path.join(dir, fm.pdf);
const tmp = path.join(os.tmpdir(), `lunis-${fm.code}.html`);
const print = (doc) => {
  fs.writeFileSync(tmp, doc);
  execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-pdf-header-footer',
    '--allow-file-access-from-files', `--print-to-pdf=${out}`, pathToFileURL(tmp).href], { stdio: 'pipe' });
};

// Pass 1 prints placeholder page numbers; pass 2 fills in the pages where each heading landed.
const PH = '00';
print(buildDoc(Object.fromEntries(toc.map((t) => [t.id, PH]))));
let pages = null;
try {
  const n = Number(execFileSync('pdfinfo', [out]).toString().match(/Pages:\s+(\d+)/)[1]);
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const texts = [];
  for (let p = 1; p <= n; p++) texts.push(execFileSync('pdftotext', ['-f', String(p), '-l', String(p), out, '-']).toString().split('\n').map(norm).filter(Boolean));
  // the printed page counter starts at 1 on the cover, so page index p (0-based) prints as p+1
  let from = texts.findIndex((t) => t.some((l) => l.includes('lunismainstart'))); if (from < 1) from = 1;
  pages = {};
  for (const t of toc) {
    const key = norm(t.text).slice(0, 40);
    let hit = -1;
    // a heading starts its own line, so match the start of a line (titles may wrap onto the next one)
    for (let p = from; p < n && hit < 0; p++) for (let i = 0; i < texts[p].length; i++) {
      const joined = texts[p].slice(i, i + 3).join('');
      if (joined.startsWith(key) && (t.level === 3 || texts[p][i].length <= key.length + 4 || key.length >= 40)) { hit = p; break; }
    }
    if (hit >= 0) { pages[t.id] = hit + 1; from = hit; } else pages[t.id] = '';
  }
} catch { pages = null; }
print(buildDoc(pages));
if (process.argv.includes('--html')) fs.copyFileSync(tmp, path.join(dir, `${fm.code}.html`));
console.log(`✓ ${path.relative(ROOT, out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
