/* Future Finance Report for the Lunis Partners site.
 * Reads the Lunis Insights feed on GitHub and renders, depending on what the page contains:
 *   #ffr-article  → one edition (insight.html?c=FFM-2610)
 *   #ffr-hub      → the Future Finance Report hub (ffr.html — only if the page uses #ffr-hub)
 *   #home-ffr     → the report band in the home page "What we think" section
 * On post.html it also redirects old blog posts of the monthly report to the matching edition page.
 * Needs assets/ffr-pages.css. Uses the site's styles.css classes (.wrap, .btn, .facts, .crumbs, .eyebrow …). */
(function () {
  'use strict';
  var FEED = 'https://raw.githubusercontent.com/giles-code/Lunis-Insights/main/dist/';
  var ARTICLE = 'insight.html', HUB = 'ffr.html';
  var MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  var MAJOR = /^(Executive Summary|Contents|Also noted|Horizon|Priority|Decide|DORA and MiCA|Verification|Sources|Notes|Methodology)/i;
  var MARK = '<svg class="ffr-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M44 9a24 24 0 1 1-24 0" fill="none" stroke="#DDC07A" stroke-width="3.4" stroke-linecap="round"/><path d="M33 22c-5 4 6 9 1 16" fill="none" stroke="#DDC07A" stroke-width="2" stroke-linecap="round"/></svg>';

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function d8(d, o) { var p = String(d).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +(p[2] || 1))).toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, o || { day: 'numeric', month: 'long', year: 'numeric' })); }
  function short(d) { return d8(d, { day: 'numeric', month: 'short', year: 'numeric' }); }
  function when(k) { return k.date.length === 7 ? d8(k.date, { month: 'long', year: 'numeric' }) : short(k.date); }
  function get(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var indexP; function index() { return indexP || (indexP = get(FEED + 'index.json')); }
  function label(tx, k, v) { var x = (tx[k] || []).filter(function (i) { return i.key === v; })[0]; return x ? x.label : v; }
  function toast(msg) {
    var t = $('#ffr-toast'); if (!t) { t = document.createElement('div'); t.id = 'ffr-toast'; t.className = 'ffr-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('on'); setTimeout(function () { t.classList.remove('on'); }, 1600);
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Link copied'); }, function () { prompt('Copy this link', text); });
    else prompt('Copy this link', text);
  }
  function editionCard(c, tx) {
    var type = label(tx, 'types', c.type);
    return '<a class="ffr-card" href="' + esc(c.url) + '"><div class="top"><span class="ffr-kicker">' + esc(type) + '</span><h3>' + esc(c.edition || c.title) + '</h3></div>' +
      '<div class="body"><p>' + esc(c.summary) + '</p><div class="foot"><span>' + short(c.date) + (c.readingMinutes ? ' · ' + c.readingMinutes + ' min' : '') + '</span><span class="link-arrow">Read &rarr;</span></div></div></a>';
  }

  /* ---------------- old blog posts → edition pages ---------------- */
  if (/post\.html$/.test(location.pathname)) {
    var slug = (new URLSearchParams(location.search).get('slug') || '').toLowerCase();
    if (/future-finance/.test(slug)) {
      var m = slug.match(new RegExp('(' + MONTHS.join('|') + ')-(20\\d\\d)'));
      if (m) { var code = 'FFM-' + m[2].slice(2) + ('0' + (MONTHS.indexOf(m[1]) + 1)).slice(-2); location.replace(ARTICLE + '?c=' + code); return; }
    }
  }

  /* ---------------- edition page ---------------- */
  function initArticle(root) {
    var q = new URLSearchParams(location.search);
    var code = (q.get('c') || q.get('code') || '').trim().toUpperCase(), id = (q.get('id') || '').trim();
    function fail(msg) {
      root.innerHTML = '<section class="ffr-dark ffr-hero"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Lunis Partners</a><span>/</span><a href="insights.html">Insights</a></nav>' +
        '<h1>' + msg + '</h1><div class="ffr-actions"><a class="btn btn-gold" href="' + HUB + '">Browse all editions</a></div></div></section>';
    }
    var load;
    if (/^[A-Z]{3}-\d{4,6}$/.test(code)) load = get(FEED + 'articles/' + code + '.json');
    else if (id) load = index().then(function (d) { var h = d.items.filter(function (i) { return i.id === id; })[0]; if (!h) throw new Error('404'); history.replaceState(null, '', location.pathname + '?c=' + h.code); return get(FEED + 'articles/' + h.code + '.json'); });
    else return fail('No edition reference was given.');
    Promise.all([load, index().catch(function () { return null; })]).then(function (r) { renderArticle(root, r[0], r[1]); })
      .catch(function (e) { fail(String(e.message) === '404' ? 'We could not find an edition with reference ' + esc(code || id) + '.' : 'This edition is unavailable at the moment. Please try again shortly.'); });
  }

  function renderArticle(root, a, idx) {
    var tx = idx ? idx.taxonomy : { types: [], jurisdictions: [], series: [] };
    var series = (tx.series || []).filter(function (s) { return s.key === a.series; })[0];
    var typeLabel = label(tx, 'types', a.type);
    var canon = location.origin + location.pathname + '?c=' + a.code;
    document.title = a.title + ' | Lunis Partners';
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', a.summary);

    // body: tables wrapped, materiality badges, region headings, executive summary panel
    var tpl = document.createElement('template'); tpl.innerHTML = a.html;
    var b = tpl.content;
    b.querySelectorAll('script,style,iframe,object,embed').forEach(function (n) { n.remove(); });
    b.querySelectorAll('table').forEach(function (t) { var w = document.createElement('div'); w.className = 'tw'; t.parentNode.insertBefore(w, t); w.appendChild(t); });
    var regions = 0, entries = 0;
    b.querySelectorAll('h2').forEach(function (h) { if (!MAJOR.test(h.textContent.trim())) { h.classList.add('region'); regions++; } });
    var inRegion = false;
    [].forEach.call(b.children, function (el) { if (el.tagName === 'H2') inRegion = el.classList.contains('region'); else if (el.tagName === 'H3' && inRegion) entries++; });
    var exec = [].filter.call(b.children, function (el) { return el.tagName === 'H2' && /^Executive Summary/i.test(el.textContent.trim()); })[0];
    if (exec) {
      var box = document.createElement('div'); box.className = 'ffr-exec'; exec.parentNode.insertBefore(box, exec);
      var n = exec; while (n && !(n !== exec && n.tagName === 'H2')) { var nx = n.nextElementSibling; box.appendChild(n); n = nx; }
    }
    var html = tpl.innerHTML
      .replace(/\[(High|Critical)\]/g, '<span class="ffr-m high">High</span>')
      .replace(/\[(Medium)\]/g, '<span class="ffr-m medium">Medium</span>')
      .replace(/\[(Low)\]/g, '<span class="ffr-m low">Low</span>');
    var highCount = (a.html.match(/\[High\]/g) || []).length || (a.highlights || []).filter(function (h) { return h.materiality === 'High'; }).length;

    var today = new Date().toISOString().slice(0, 10);
    var kd = (a.keyDates || []).filter(function (k) { return k.date.length === 7 ? k.date >= today.slice(0, 7) : k.date >= today; });
    var kdTitle = kd.length ? 'Coming up' : 'Key dates in this edition';
    if (!kd.length) kd = a.keyDates || [];
    kd = kd.slice(0, 4);

    var stats = [[entries || (a.toc || []).filter(function (t) { return t.level === 3; }).length, 'Developments'], [highCount, 'High materiality'], [regions || a.jurisdictions.length, 'Regions']];
    var glance = '<div class="ffr-glance"><span class="ffr-kicker">At a glance</span><div class="row">' + stats.map(function (s) { return '<div><div class="n">' + s[0] + '</div><div class="l">' + s[1] + '</div></div>'; }).join('') + '</div>' +
      (kd.length ? '<span class="ffr-kicker">' + kdTitle + '</span><ul>' + kd.map(function (k) { return '<li><span>' + esc(when(k)) + '</span><span>' + esc(k.event) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>';

    var period = a.period ? short(a.period.start).replace(/ \d{4}$/, '') + ' – ' + short(a.period.end) : '';
    var chips = (a.jurisdictions || []).map(function (j) { return '<span class="ffr-chip">' + esc(label(tx, 'jurisdictions', j)) + '</span>'; }).join('');
    var hero = '<section class="ffr-dark ffr-hero"><div class="wrap">' +
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Lunis Partners</a><span>/</span><a href="insights.html">Insights</a><span>/</span><a href="' + HUB + '">' + esc(series ? series.title : 'Insights') + '</a><span>/</span><span>' + esc(a.edition || a.title) + '</span></nav>' +
      '<div class="ffr-hero-grid"><div>' +
      '<div style="display:flex;align-items:center;gap:.8rem">' + MARK + '<span class="ffr-kicker">' + esc(series ? series.title : typeLabel) + ' · ' + esc(typeLabel) + (a.sequence ? ' · No. ' + a.sequence.number : '') + '</span></div>' +
      '<h1>' + (a.edition ? esc(series ? series.title : a.title).replace(/(Report|Brief|Edition)$/, '<em>$1</em>') + '<br>' + esc(a.edition) : esc(a.title)) + '</h1>' +
      '<p class="sub">' + esc(series ? series.strapline : '') + '</p>' +
      '<div class="ffr-meta"><span><b>Published</b>' + short(a.date) + '</span>' + (period ? '<span><b>Review window</b>' + period + '</span>' : '') +
      (a.readingMinutes ? '<span><b>Reading time</b>' + a.readingMinutes + ' min</span>' : '') + '</div>' +
      '<div>' + chips + '</div>' +
      '<div class="ffr-actions">' + (a.pdfUrl ? '<a class="btn btn-gold" href="' + esc(a.pdfUrl) + '">Download the PDF</a>' : '') +
      '<button type="button" class="btn ffr-btn-light" data-copy>Copy link</button></div>' +
      (a.legacy && a.legacy.originalBrand ? '<p class="ffr-legacy">First published by ' + esc(a.legacy.originalBrand) + '. Republished by Lunis Partners as a public edition.</p>' : '') +
      '</div>' + glance + '</div></div></section>';

    var toc = (a.toc || []).length > 2 ? '<nav class="ffr-toc" aria-label="Contents"><h4>In this edition</h4><ol>' + a.toc.map(function (t) {
      return '<li><a class="l' + t.level + '" href="#' + t.id + '">' + esc(t.text) + '</a></li>'; }).join('') + '</ol></nav>' : '';
    var editions = idx ? idx.items.filter(function (i) { return i.series === a.series && i.type === a.type; }) : [];
    var picker = editions.length > 1 ? '<div class="ffr-editions"><select aria-label="Go to another edition">' + editions.map(function (e) {
      return '<option value="' + esc(e.url) + '"' + (e.code === a.code ? ' selected' : '') + '>' + esc(e.edition || e.title) + '</option>'; }).join('') + '</select></div>' : '';
    var side = '<aside class="ffr-side"><div class="facts"><dl style="margin:0"><dt style="margin-top:0">This edition</dt><dd><div class="ffr-ref">' + esc(a.edition || a.title) + '<button type="button" data-copy>Copy link</button></div></dd></dl>' +
      (a.pdfUrl ? '<a class="btn btn-gold" href="' + esc(a.pdfUrl) + '">Download PDF</a>' : '') + '</div>' + picker + toc + '</aside>';

    var seq = (a.prev || a.next) ? '<div class="ffr-seq">' +
      (a.prev ? '<a href="' + esc(a.prev.url) + '"><span class="k">&larr; Previous edition</span><span class="t">' + esc(a.prev.edition || a.prev.title) + '</span></a>' : '') +
      (a.next ? '<a class="next" href="' + esc(a.next.url) + '"><span class="k">Next edition &rarr;</span><span class="t">' + esc(a.next.edition || a.next.title) + '</span></a>' : '') + '</div>' : '';
    var related = '';
    if (a.parent) related += '<p><strong>Part of:</strong> <a href="' + esc(a.parent.url) + '">' + esc(a.parent.title) + '</a></p>';
    if (a.children && a.children.length) related += '<p><strong>Brings together:</strong> ' + a.children.map(function (c) { return '<a href="' + esc(c.url) + '">' + esc(c.edition || c.title) + '</a>'; }).join(' · ') + '</p>';

    var more = editions.filter(function (e) { return e.code !== a.code; }).slice(0, 3);
    root.innerHTML = hero +
      '<section class="bg-white ffr-body"><div class="wrap"><div class="ffr-layout"><div><article class="ffr-prose">' + html + '</article>' + related + seq +
      '<p class="ffr-end">This public edition is general information on regulatory developments. It is not legal or regulatory advice for any particular firm; check primary sources before acting. &copy; ' + a.date.slice(0, 4) + ' Lunis Partners.</p>' +
      '<div class="btn-row"><a class="btn btn-ghost" href="' + HUB + '">&larr; All editions</a><a class="btn btn-gold" href="contact.html">Talk to us about this</a></div></div>' + side + '</div></div></section>' +
      (more.length ? '<section class="bg-cream"><div class="wrap"><div class="section-head"><h2>More <em>editions</em></h2><a class="link-arrow" href="' + HUB + '">All editions &rarr;</a></div><div class="grid g3">' + more.map(function (c) { return editionCard(c, tx); }).join('') + '</div></div></section>' : '');

    root.querySelectorAll('[data-copy]').forEach(function (bt) { bt.addEventListener('click', function () { copy(canon); }); });
    var sel = $('.ffr-editions select', root); if (sel) sel.addEventListener('change', function () { location.href = this.value; });
    if (location.hash) { var el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) setTimeout(function () { el.scrollIntoView(); }, 50); }
    var links = [].slice.call(root.querySelectorAll('.ffr-toc a'));
    if (links.length && 'IntersectionObserver' in window) {
      var map = {}; links.forEach(function (l) { map[l.getAttribute('href').slice(1)] = l; });
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) { links.forEach(function (l) { l.classList.remove('on'); }); var on = map[e.target.id]; on.classList.add('on');
          var box = on.closest('.ffr-side'); if (box && box.scrollHeight > box.clientHeight) { var t = on.offsetTop - box.clientHeight / 2; box.scrollTo({ top: t }); } }
      }); }, { rootMargin: '-90px 0px -70% 0px' });
      root.querySelectorAll('.ffr-prose h2[id], .ffr-prose h3[id]').forEach(function (h) { io.observe(h); });
    }
  }

  /* ---------------- hub page ---------------- */
  function initHub(root) {
    Promise.all([index(), get(FEED + 'key-dates.json').catch(function () { return { items: [] }; })]).then(function (r) {
      var d = r[0], kd = r[1], tx = d.taxonomy, s = tx.series[0];
      var items = d.items.filter(function (i) { return i.series === s.key; });
      var latest = items.filter(function (i) { return i.type === 'monthly'; })[0] || items[0];
      var types = tx.types.filter(function (t) { return items.some(function (i) { return i.type === t.key; }); });
      var state = { type: types.length > 1 ? '' : (types[0] ? types[0].key : '') };
      root.innerHTML = '<section class="ffr-dark ffr-hub-hero"><div class="wrap">' +
        '<nav class="crumbs" aria-label="Breadcrumb" style="color:rgba(255,255,255,.7)"><a href="index.html" style="color:#fff">Lunis Partners</a><span>/</span><a href="insights.html" style="color:#fff">Insights</a><span>/</span><span>' + esc(s.title) + '</span></nav>' +
        '<div style="display:flex;align-items:center;gap:.8rem">' + MARK + '<span class="ffr-kicker">' + esc(s.strapline) + '</span></div>' +
        '<h1>Future Finance <em>Report</em></h1><p class="lead">' + esc(s.description) + '</p>' +
        (latest ? '<div class="ffr-latest"><div><span class="ffr-kicker">Latest · ' + esc(label(tx, 'types', latest.type)) + '</span><h2>' + esc(latest.edition || latest.title) + '</h2><p>' + esc(latest.summary) + '</p>' +
          '<div class="btn-row"><a class="btn btn-gold" href="' + esc(latest.url) + '">Read the report</a>' + (latest.pdfUrl ? '<a class="btn ffr-btn-light" href="' + esc(latest.pdfUrl) + '">Download PDF</a>' : '') + '</div></div>' +
          '<div class="ffr-glance"><span class="ffr-kicker">Coming up</span><ul>' + (kd.items || []).slice(0, 5).map(function (k) { return '<li><span>' + esc(when(k)) + '</span><span>' + esc(k.event) + '</span></li>'; }).join('') + '</ul></div></div>' : '') +
        '</div></section>' +
        '<section class="bg-cream"><div class="wrap"><div class="section-head"><h2>All <em>editions</em></h2><span class="link-arrow">' + items.length + ' editions</span></div>' +
        '<div class="ffr-hub-layout"><div>' + (types.length > 1 ? '<div class="ffr-hub-tabs" id="ffr-tabs"></div>' : '') + '<div id="ffr-list"></div></div>' +
        '<aside class="facts" style="position:sticky;top:96px"><h3>Get each edition</h3><p class="facts-note" style="margin:0 0 1rem">The Future Finance Report is published monthly, with weekly editions and daily briefs. Ask to join the distribution list.</p><a class="btn btn-gold" href="contact.html">Join the list</a>' +
        '<dl><dt>Coverage</dt><dd>EU · UK · Asia-Pacific · Middle East · US and Canada · international standard setters</dd><dt>Share an edition</dt><dd>Use “Copy link” on any edition page.</dd></dl></aside></div></div></section>';
      function list() {
        var rows = items.filter(function (i) { return !state.type || i.type === state.type; }), html = '', year = '';
        rows.forEach(function (c, k) {
          var y = c.date.slice(0, 4);
          if (y !== year) { html += (year ? '</div>' : '') + '<div class="ffr-year">' + y + '</div><div class="grid g3">'; year = y; }
          html += editionCard(c, tx);
        });
        $('#ffr-list', root).innerHTML = (html ? html + '</div>' : '<div class="empty">No editions yet.</div>');
      }
      var tabs = $('#ffr-tabs', root);
      if (tabs) {
        tabs.innerHTML = [{ key: '', label: 'All' }].concat(types).map(function (t) { return '<button type="button" data-k="' + t.key + '" aria-pressed="' + (state.type === t.key) + '">' + esc(t.label) + '</button>'; }).join('');
        tabs.addEventListener('click', function (e) { var bt = e.target.closest('button'); if (!bt) return; state.type = bt.dataset.k; [].forEach.call(tabs.children, function (x) { x.setAttribute('aria-pressed', x === bt); }); list(); });
      }
      list();
    }).catch(function () { root.innerHTML = '<section class="bg-cream"><div class="wrap"><div class="empty"><h3>The Future Finance Report is unavailable at the moment</h3><p>Please refresh the page.</p></div></div></section>'; });
  }

  /* ---------------- home page band ---------------- */
  function initHome(el) {
    index().then(function (d) {
      var tx = d.taxonomy, s = tx.series[0];
      var items = d.items.filter(function (i) { return i.series === s.key; });
      var latest = items.filter(function (i) { return i.type === 'monthly'; })[0] || items[0];
      if (!latest) return;
      var recent = items.filter(function (i) { return i !== latest; }).slice(0, 3);
      el.className = 'ffr-home';
      var blog = document.getElementById('home-insights');
      if (blog) {
        var prune = function () { blog.querySelectorAll('a[href*="future-finance"]').forEach(function (a) { a.remove(); }); };
        new MutationObserver(prune).observe(blog, { childList: true }); prune();
      }
      el.innerHTML = '<div class="lead-panel ffr-dark"><div style="display:flex;align-items:center;gap:.7rem">' + MARK + '<span class="ffr-kicker">' + esc(s.strapline) + '</span></div>' +
        '<h3>Future Finance <em>Report</em></h3><p><strong style="color:#fff">' + esc(latest.edition || latest.title) + '.</strong> ' + esc(latest.summary) + '</p>' +
        '<div class="btn-row"><a class="btn btn-gold" href="' + esc(latest.url) + '">Read the latest report</a><a class="btn ffr-btn-light" href="' + HUB + '">All editions</a></div></div>' +
        '<div class="list"><h4>Recent editions</h4>' + recent.map(function (c) {
          return '<a class="ed" href="' + esc(c.url) + '"><span class="t">' + esc(c.edition || c.title) + '</span><span class="c"></span><span class="d">' + esc(label(tx, 'types', c.type)) + ' · ' + short(c.date) + '</span></a>';
        }).join('') + '<a class="link-arrow all" href="' + HUB + '">Browse the archive &rarr;</a></div>';
    }).catch(function () { el.remove(); });
  }

  function boot() {
    var a = $('#ffr-article'); if (a) initArticle(a);
    var h = $('#ffr-hub'); if (h) initHub(h);
    var m = $('#home-ffr'); if (m) initHome(m);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
