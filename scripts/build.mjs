// Validates every article and builds the site feed in dist/.
// Usage: node scripts/build.mjs            (validate + build)
//        node scripts/build.mjs --check    (validate only, no writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = 'https://raw.githubusercontent.com/giles-code/Lunis-Insights/main/';
const CHECK_ONLY = process.argv.includes('--check');

const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'taxonomy.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/article.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const keys = (list) => new Set(list.map((x) => x.key));
const T = {
  types: keys(taxonomy.types), series: keys(taxonomy.series), jurisdictions: keys(taxonomy.jurisdictions),
  topics: keys(taxonomy.topics), practices: keys(taxonomy.practices), authors: keys(taxonomy.authors),
};
const seriesByKey = Object.fromEntries(taxonomy.series.map((s) => [s.key, s]));

const errors = [];
const warn = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

// ---------- helpers ----------
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return { year: d.getUTCFullYear(), week };
}
const yy = (y) => String(y).slice(2);
const pad = (n) => String(n).padStart(2, '0');

function expectedCode(fm) {
  if (fm.type === 'daily') { const [y, m, d] = fm.date.split('-'); return `FFD-${yy(y)}${m}${d}`; }
  if (fm.type === 'weekly' && fm.period) { const w = isoWeek(fm.period.end); return `FFW-${yy(w.year)}${pad(w.week)}`; }
  if (fm.type === 'monthly' && fm.period) {
    // month covered = month containing most of the period: use the period end unless it falls in the first 3 days
    const e = new Date(fm.period.end + 'T00:00:00Z');
    if (e.getUTCDate() <= 3) e.setUTCDate(0);
    return `FFM-${yy(e.getUTCFullYear())}${pad(e.getUTCMonth() + 1)}`;
  }
  return null;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name === 'index.md' ? [p] : [];
  });
}

// ---------- read + validate ----------
const articles = [];
for (const file of walk(path.join(ROOT, 'articles'))) {
  const rel = path.relative(ROOT, file);
  const dir = path.dirname(file);
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { err(rel, 'missing YAML front matter between --- lines'); continue; }
  let fm;
  try { fm = YAML.parse(m[1], { schema: 'core' }); } catch (e) { err(rel, `YAML error: ${e.message}`); continue; }
  // YAML may turn dates into strings already (core schema) – normalise anything Date-like
  for (const k of ['date']) if (fm[k] instanceof Date) fm[k] = fm[k].toISOString().slice(0, 10);
  if (!validate(fm)) {
    for (const e of validate.errors) err(rel, `${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? ': ' + e.params.additionalProperty : ''}${e.params?.allowedValues ? ' ' + JSON.stringify(e.params.allowedValues) : ''}`);
    continue;
  }
  const folder = path.basename(dir);
  if (folder !== fm.id) err(rel, `folder name "${folder}" must equal id "${fm.id}"`);
  const yearFolder = path.basename(path.dirname(dir));
  if (yearFolder !== fm.date.slice(0, 4)) err(rel, `year folder "${yearFolder}" must equal publication year ${fm.date.slice(0, 4)}`);
  if (fm.series && !T.series.has(fm.series)) err(rel, `unknown series "${fm.series}"`);
  if (fm.series) {
    const pre = seriesByKey[fm.series]?.idPrefix?.[fm.type];
    if (pre && !fm.id.startsWith(pre)) err(rel, `id must start with "${pre}"`);
  }
  for (const j of fm.jurisdictions || []) if (!T.jurisdictions.has(j)) err(rel, `unknown jurisdiction "${j}"`);
  for (const j of (fm.highlights || []).map((h) => h.jurisdiction)) if (!T.jurisdictions.has(j)) err(rel, `highlight: unknown jurisdiction "${j}"`);
  for (const t of fm.topics || []) if (!T.topics.has(t)) err(rel, `unknown topic "${t}"`);
  for (const a of fm.authors || []) if (!T.authors.has(a)) err(rel, `unknown author "${a}" (add it to taxonomy.json)`);
  const exp = expectedCode(fm);
  if (exp && fm.code !== exp) err(rel, `code should be "${exp}" for this ${fm.type} (got "${fm.code}")`);
  if (fm.type === 'insight' && !fm.code.startsWith('INS-')) err(rel, 'standalone insights use INS-NNNN codes');
  if (fm.period && fm.period.start > fm.period.end) err(rel, 'period.start is after period.end');
  if (fm.pdf && !fs.existsSync(path.join(dir, fm.pdf))) err(rel, `pdf "${fm.pdf}" not found in the article folder`);
  if (fm.image && !/^https:\/\//.test(fm.image) && !fs.existsSync(path.join(dir, fm.image))) err(rel, `image "${fm.image}" not found`);
  const body = m[2].trim();
  if (body.length < 200 && fm.status === 'published') err(rel, 'body is too short to publish (under 200 characters)');
  if (/Confidential\s+—\s+prepared for board/i.test(body)) err(rel, 'body still contains the confidential client footer');
  articles.push({ fm, body, dir, rel });
}

// uniqueness
const seen = { id: new Map(), code: new Map() };
for (const a of articles) for (const k of ['id', 'code']) {
  const v = a.fm[k];
  if (seen[k].has(v)) err(a.rel, `duplicate ${k} "${v}" (also in ${seen[k].get(v)})`); else seen[k].set(v, a.rel);
}
const byId = new Map(articles.map((a) => [a.fm.id, a]));
for (const a of articles) if (a.fm.parent && !byId.has(a.fm.parent)) err(a.rel, `parent "${a.fm.parent}" does not exist`);

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):\n  - ` + errors.join('\n  - '));
  process.exit(1);
}

// ---------- build ----------
const published = articles.filter((a) => a.fm.status === 'published')
  .sort((x, y) => (y.fm.date.localeCompare(x.fm.date)) || x.fm.id.localeCompare(y.fm.id));

function render(body) {
  const toc = [];
  const used = new Set();
  const renderer = new marked.Renderer();
  renderer.heading = function (text, level, raw) {
    let id = slugify(raw || text) || 'section';
    let n = 2; const base = id; while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    if (level === 2 || level === 3) toc.push({ level, id, text: (raw || text).replace(/<[^>]+>/g, '') });
    return `<h${level} id="${id}">${text}</h${level}>\n`;
  };
  renderer.link = function (href, title, text) {
    const ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${title ? ` title="${title}"` : ''}${ext}>${text}</a>`;
  };
  renderer.table = function (header, body) {
    return `<div class="li-table"><table><thead>${header}</thead><tbody>${body}</tbody></table></div>\n`;
  };
  const html = marked.parse(body, { renderer, gfm: true });
  const words = body.replace(/[#>*_`|\-\[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { html, toc, words };
}

const fileUrl = (a, f) => RAW + path.relative(ROOT, path.join(a.dir, f)).split(path.sep).map(encodeURIComponent).join('/');

const cards = published.map((a) => {
  const fm = a.fm;
  return {
    id: fm.id, code: fm.code, type: fm.type, series: fm.series || null,
    title: fm.title, subtitle: fm.subtitle || null, edition: fm.edition || null,
    date: fm.date, period: fm.period || null, summary: fm.summary,
    jurisdictions: fm.jurisdictions || [], topics: fm.topics || [], practice: fm.practice || null,
    authors: (fm.authors || []).map((k) => taxonomy.authors.find((x) => x.key === k)),
    featured: !!fm.featured, parent: fm.parent || null,
    url: `ffr-edition.html?c=${fm.code}`,
    pdfUrl: fm.pdf ? fileUrl(a, fm.pdf) : null,
    image: fm.image ? (/^https:/.test(fm.image) ? fm.image : fileUrl(a, fm.image)) : null,
    highlightCount: (fm.highlights || []).length,
  };
});
const cardById = new Map(cards.map((c) => [c.id, c]));
const mini = (c) => c && ({ id: c.id, code: c.code, type: c.type, title: c.title, edition: c.edition, date: c.date, url: c.url });

// sequence: previous/next within the same series and type (by date)
for (const c of cards) {
  if (!c.series) { c.prev = c.next = null; continue; }
  const seq = cards.filter((x) => x.series === c.series && x.type === c.type).sort((x, y) => x.date.localeCompare(y.date));
  const i = seq.indexOf(c);
  c.sequence = { number: i + 1, of: seq.length };
  c.prev = mini(seq[i - 1]) || null;
  c.next = mini(seq[i + 1]) || null;
}
for (const c of cards) c.children = cards.filter((x) => x.parent === c.id).sort((x, y) => x.date.localeCompare(y.date)).map(mini);

const today = new Date().toISOString().slice(0, 10);
const keyDates = [];

if (!CHECK_ONLY) {
  const dist = path.join(ROOT, 'dist');
  fs.rmSync(path.join(dist, 'articles'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'articles'), { recursive: true });
  for (const a of published) {
    const c = cardById.get(a.fm.id);
    const { html, toc, words } = render(a.body);
    c.readingMinutes = Math.max(1, Math.round(words / 220));
    for (const k of a.fm.keyDates || []) keyDates.push({ ...k, from: mini(c) });
    const item = {
      ...c, parent: c.parent ? mini(cardById.get(c.parent)) : null,
      highlights: a.fm.highlights || [], keyDates: a.fm.keyDates || [], sources: a.fm.sources || [],
      legacy: a.fm.legacy || null, toc, html,
    };
    fs.writeFileSync(path.join(dist, 'articles', `${c.code}.json`), JSON.stringify(item));
  }
  const upcoming = keyDates.filter((k) => k.date.length === 7 ? k.date >= today.slice(0, 7) : k.date >= today)
    .sort((x, y) => x.date.localeCompare(y.date));
  // keep only the most recent source's entry for the same date+event
  const dedup = []; const keySeen = new Set();
  for (const k of upcoming.sort((x, y) => x.date.localeCompare(y.date) || y.from.date.localeCompare(x.from.date))) {
    const sig = k.date + '|' + k.jurisdiction + '|' + k.event.toLowerCase().slice(0, 60);
    if (!keySeen.has(sig)) { keySeen.add(sig); dedup.push(k); }
  }
  const counts = { total: cards.length, byType: {} };
  for (const t of taxonomy.types) counts.byType[t.key] = cards.filter((c) => c.type === t.key).length;
  const index = {
    version: '1', generated: published[0]?.fm.date || null, base: RAW,
    taxonomy, counts, items: cards,
  };
  fs.writeFileSync(path.join(dist, 'index.json'), JSON.stringify(index));
  fs.writeFileSync(path.join(dist, 'key-dates.json'), JSON.stringify({ generated: index.generated, asOf: today, items: dedup }));
  // code -> id lookup is in index.json; article files are keyed by code
}
console.log(`✓ ${articles.length} article(s) valid; ${published.length} published${CHECK_ONLY ? ' (check only)' : '; dist/ rebuilt'}.`);
