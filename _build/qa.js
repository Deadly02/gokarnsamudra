// QA checks for the generated site. Usage: node qa.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { parse } = require('node-html-parser');
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.gokarnasamudra.com';
const pages = require('./pages.json');
const errs = [], warns = [];
const E = (p, m) => errs.push(`${p}: ${m}`);
const W = (p, m) => warns.push(`${p}: ${m}`);
const norm = s => s.toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9{}_ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = s => s.split(/\s+/).filter(Boolean);
const fileFor = p => p.endsWith('.html') ? path.join(ROOT, p) : path.join(ROOT, p, 'index.html');
const BRAND = /gokarna samudra beach resort/gi;
const minWords = { home: 800, room: 400, venue: 400, article: 400, about: 400, guide: 1200, post: 800 };
const maxWords = { room: 600, venue: 600, article: 600, about: 600 };
const titles = {}, descs = {};
let weight = {};

for (const pg of pages) {
  const f = fileFor(pg.path);
  const html = fs.readFileSync(f, 'utf8');
  const root = parse(html, { comment: false });
  const p = pg.path;
  const title = root.querySelector('title')?.text || '';
  const desc = root.querySelector('meta[name=description]')?.getAttribute('content') || '';
  if (!title || title.length > 60) E(p, `title length ${title.length}`);
  if (desc.length === 0 || desc.length > 155) E(p, `description length ${desc.length}`);
  if (titles[title]) E(p, 'duplicate title'); titles[title] = 1;
  if (descs[desc]) E(p, 'duplicate description'); descs[desc] = 1;
  const h1s = root.querySelectorAll('h1');
  if (h1s.length !== 1) E(p, `${h1s.length} h1`);
  else if (h1s[0].text.trim().length < 20) E(p, `h1 too short: ${h1s[0].text}`);
  const canon = root.querySelector('link[rel=canonical]')?.getAttribute('href') || '';
  if (!canon.startsWith(SITE + '/') || (!canon.endsWith('/') && !canon.endsWith('.html'))) E(p, `canonical ${canon}`);
  const ogi = root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
  if (!ogi.startsWith('https://')) E(p, 'og:image missing/relative');
  else if (!fs.existsSync(path.join(ROOT, ogi.replace(SITE, '')))) E(p, 'og:image file missing');
  for (const k of ['og:title', 'og:description', 'og:url', 'og:site_name', 'og:locale']) if (!root.querySelector(`meta[property="${k}"]`)) E(p, `missing ${k}`);
  if (!root.querySelector('meta[name="twitter:card"]')) E(p, 'missing twitter:card');
  if (root.querySelector('meta[name=keywords]')) E(p, 'meta keywords present');
  // JSON-LD
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.text);
      const g = j['@graph'] || [];
      const faq = g.find(n => n['@type'] === 'FAQPage');
      if (faq) {
        const vis = root.querySelectorAll('.faq-item').map(it => [it.querySelector('h3').text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), it.querySelector('.faq-answer').text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')]);
        faq.mainEntity.forEach((q, i) => { if (!vis[i] || vis[i][0] !== q.name || vis[i][1] !== q.acceptedAnswer.text) E(p, `FAQ schema mismatch #${i}`); });
        if (vis.length !== faq.mainEntity.length) E(p, 'FAQ count mismatch');
      }
      if (p !== '/' && p !== '/404.html' && !g.find(n => n['@type'] === 'BreadcrumbList')) E(p, 'no BreadcrumbList');
      if (!g.find(n => n['@type'] === 'Resort')) E(p, 'no Resort node');
      if (JSON.stringify(j).includes('aggregateRating')) E(p, 'aggregateRating present');
    } catch (e) { E(p, 'JSON-LD parse error ' + e.message); }
  }
  // links
  const main = root.querySelector('main');
  const anchors = root.querySelectorAll('a[href]');
  const byText = {};
  for (const a of anchors) {
    const href = a.getAttribute('href');
    const text = norm(a.getAttribute('aria-label') || a.text);
    if (a.getAttribute('target') === '_blank' && !/noopener/.test(a.getAttribute('rel') || '') ) E(p, `_blank without noopener ${href}`);
    if (a.getAttribute('target') === '_blank' && !/noreferrer/.test(a.getAttribute('rel') || '')) E(p, `_blank without noreferrer ${href}`);
    if (!text) E(p, `empty anchor text ${href}`);
    if (byText[text] && byText[text] !== href) E(p, `duplicate anchor text "${text}" -> ${byText[text]} & ${href}`);
    byText[text] = byText[text] || href;
    if (href.startsWith('/') && !href.startsWith('//')) {
      const [u, hash] = href.split('#');
      const target = u.endsWith('/') ? path.join(ROOT, u, 'index.html') : path.join(ROOT, u.split('?')[0]);
      if (!fs.existsSync(target)) E(p, `broken link ${href}`);
      else if (hash) { const t = parse(fs.readFileSync(target, 'utf8')); if (!t.querySelector('#' + hash)) E(p, `missing anchor ${href}`); }
    } else if (href.startsWith('#') && href.length > 1 && !root.querySelector(href)) E(p, `missing anchor ${href}`);
    if (/\{\{/.test(href)) E(p, `placeholder href ${href}`);
  }
  // booking CTA texts unique
  const bookTexts = anchors.filter(a => (a.getAttribute('href') || '').includes('resavenue')).map(a => norm(a.text));
  if (new Set(bookTexts).size !== bookTexts.length) E(p, `duplicate booking CTA text ${bookTexts}`);
  // in-content internal links
  const contentLinks = new Set(main.querySelectorAll('a[href^="/"]').filter(a => !a.closest('.breadcrumb')).map(a => a.getAttribute('href').split('#')[0]).filter(h => h !== p));
  if (contentLinks.size < 3) E(p, `only ${contentLinks.size} related internal links`);
  // images
  for (const img of root.querySelectorAll('img')) {
    for (const at of ['alt', 'width', 'height']) if (img.getAttribute(at) == null) E(p, `img missing ${at}: ${img.getAttribute('src')}`);
    const src = img.getAttribute('data-src') || img.getAttribute('src');
    if (src.startsWith('/') && !fs.existsSync(path.join(ROOT, src))) E(p, `img missing file ${src}`);
    const alt = img.getAttribute('alt') || '';
    if (!/at Gokarna Samudra Beach Resort, Gokarna$|of Gokarna Samudra Beach Resort, Gokarna$/.test(alt)) E(p, `alt format: ${alt}`);
    for (const s of (img.getAttribute('srcset') || img.getAttribute('data-srcset') || '').split(',').map(x => x.trim().split(' ')[0]).filter(Boolean)) if (!fs.existsSync(path.join(ROOT, s))) E(p, `srcset missing ${s}`);
  }
  // deprecated + render-blocking
  if (/<(center|font|marquee|big|strike|tt|frameset|frame)\b/i.test(html)) E(p, 'deprecated tag');
  for (const l of root.querySelectorAll('link[rel=stylesheet]')) if (!l.closest('noscript')) E(p, `render-blocking stylesheet ${l.getAttribute('href')}`);
  for (const s of root.querySelectorAll('script[src]')) if (s.getAttribute('async') == null && s.getAttribute('defer') == null) E(p, `blocking script ${s.getAttribute('src')}`);
  if (/style="/.test(html)) W(p, 'inline style attribute');
  // sections
  for (const s of main.querySelectorAll('section')) {
    if (!s.id) E(p, 'section without id');
    const h = s.querySelector('h1,h2'); if (!h || !h.id) E(p, `section ${s.id} heading without id`);
  }
  if (!root.querySelector('a.skip-link[href="#main"]')) E(p, 'no skip link');
  // copy rules
  const mainText = main.querySelectorAll('h1,h2,h3,p,li,td,th,caption,figcaption').filter(n => !n.closest('.testimonials') && !n.closest('.breadcrumb')).map(n => n.text).join(' \n ').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
  const wc = words(mainText).length;
  if (minWords[pg.type] && wc < minWords[pg.type]) E(p, `word count ${wc} < ${minWords[pg.type]}`);
  if (maxWords[pg.type] && wc > maxWords[pg.type] + 120) W(p, `word count ${wc} > ${maxWords[pg.type]}`);
  for (const n of main.querySelectorAll('p,li,.faq-answer p').filter(n => !n.closest('.testimonials'))) {
    const t = n.text.replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    for (const s of t.split(/(?<=[.!?])\s+/)) { const c = words(s).length; if (c > 15) E(p, `sentence ${c} words: ${s.slice(0, 80)}`); }
  }
  for (const a of root.querySelectorAll('.faq-answer')) { const c = words(a.text).length; if (c < 40 || c > 60) E(p, `FAQ answer ${c} words`); }
  const lead = root.querySelector('.hero .lead'); if (!lead) E(p, 'no .hero .lead'); else if (words(lead.text).length > 50) E(p, `lead ${words(lead.text).length} words`);
  const low = ' ' + norm(mainText.replace(BRAND, ' ')) + ' ';
  if (/\b(beachfront|luxury|villa|villas)\b/.test(low)) E(p, 'banned word');
  if (/\bbest\b(?! time)/.test(low.replace(/best time/g, ''))) E(p, 'banned "best" claim');
  for (const [i, k] of (pg.kw || []).entries()) {
    const kn = norm(k);
    const count = low.split(' ' + kn + ' ').length - 1;
    if (count > 2) E(p, `keyword "${k}" x${count}`);
    if (i === 0 && !/gokarna samudra beach resort/i.test(k)) {
      const first = ' ' + norm(words(mainText).slice(0, 100).join(' ')) + ' ';
      if (!first.includes(' ' + kn + ' ')) E(p, `primary keyword not in first 100 words`);
      if (!norm(title).includes(kn.replace(/ gokarna$/, '')) ) W(p, `primary keyword not in title`);
      if (!root.querySelectorAll('img').some(im => norm(im.getAttribute('alt') || '').includes(kn))) E(p, `primary keyword not in any alt`);
    } else if (count === 0 && i > 0) W(p, `secondary keyword unused "${k}"`);
  }
  const titleWords = norm(title.split('|')[0]).split(' ').filter(w => w.length > 3);
  for (const tw of titleWords) if (!low.includes(' ' + tw)) W(p, `title word "${tw}" not in body`);
  if (p !== '/' && p !== '/404.html' && !root.querySelector('nav.breadcrumb')) E(p, 'no visible breadcrumb');
  if (['article', 'guide', 'post'].includes(pg.type) && !root.querySelector('.updated time')) E(p, 'no Last updated time');
  // weight: html + css + js + eager images (largest srcset) + rotating slides
  const imgs = new Set();
  for (const img of root.querySelectorAll('img')) {
    if (img.getAttribute('loading') === 'lazy') continue;
    const set = (img.getAttribute('data-srcset') || img.getAttribute('srcset') || '').split(',').map(x => x.trim().split(' ')[0]).filter(Boolean);
    const pick = set.length ? set[set.length - 1] : img.getAttribute('src');
    if (pick && pick.startsWith('/')) imgs.add(pick);
  }
  const lazyImgs = new Set(root.querySelectorAll('img[loading=lazy]').map(img => { const set = (img.getAttribute('srcset') || '').split(',').map(x => x.trim().split(' ')[0]).filter(Boolean); return set[set.length - 1] || img.getAttribute('src'); }).filter(s => s.startsWith('/')));
  const sz = f => fs.statSync(path.join(ROOT, f.split('?')[0])).size;
  const gz = b => zlib.gzipSync(b).length;
  const htmlB = gz(html), cssB = gz(fs.readFileSync(path.join(ROOT, 'assets/css/style.css'))), jsB = gz(fs.readFileSync(path.join(ROOT, 'assets/js/main.js')));
  const eager = [...imgs].reduce((a, f) => a + sz(f), 0);
  const all = eager + [...lazyImgs].filter(f => !imgs.has(f)).reduce((a, f) => a + sz(f), 0);
  weight[p] = { initialKB: Math.round((htmlB + cssB + jsB + eager) / 1024), fullScrollKB: Math.round((htmlB + cssB + jsB + all) / 1024) };
  if (all + htmlB + cssB + jsB > 1024 * 1024) E(p, `page weight ${Math.round((all + htmlB) / 1024)}KB`);
  if (/\{\{/.test(title + desc)) E(p, 'placeholder in title/description');
}
// images on disk
for (const f of fs.readdirSync(path.join(ROOT, 'assets/img'))) { const s = fs.statSync(path.join(ROOT, 'assets/img', f)).size; if (s > 300 * 1024) E('img', `${f} ${Math.round(s / 1024)}KB`); }
// htaccess gzip
const ht = fs.readFileSync(path.join(ROOT, '.htaccess'), 'utf8');
if (!/AddOutputFilterByType DEFLATE text\/html/.test(ht)) E('.htaccess', 'no gzip for html');
// sitemap
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const pg of pages.filter(x => x.path !== '/404.html')) if (!sm.includes(`<loc>${SITE}${pg.path}</loc>`)) E('sitemap', `missing ${pg.path}`);
// every sitemap URL must exist in the deployable output (same exclusions as .cpanel.yml / deploy.yml)
const EXCL = /^(\.git|\.github|_build|node_modules|blog\.gokarnasamudra\.com)(\/|$)|\.md$/;
for (const [, loc] of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  if (!loc.startsWith(SITE + '/')) { E('sitemap', `foreign URL ${loc}`); continue; }
  const rel = loc.slice(SITE.length + 1);
  const file = rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel;
  if (EXCL.test(file) || !fs.existsSync(path.join(ROOT, file))) E('sitemap', `URL not in deployable output: ${loc}`);
}
// no placeholder may reach any deployed file
const SKIP = new Set(['.git', '.github', '_build', 'node_modules', 'blog.gokarnasamudra.com', '.claude', '.cpanel.yml', '.gitignore']);
const TEXT = /\.(html?|txt|xml|json|webmanifest|css|js|svg|php)$|^\.htaccess$/i;
(function walk(d) { for (const f of fs.readdirSync(d)) { if (SKIP.has(f) || f.endsWith('.md')) continue; const full = path.join(d, f); const st = fs.statSync(full); if (st.isDirectory()) walk(full); else if (TEXT.test(f) && fs.readFileSync(full, 'utf8').includes('{{')) E(path.relative(ROOT, full), 'contains "{{"'); } })(ROOT);
for (const pg of pages) if (pg.faqs.length && pg.faqs.length < 3) W(pg.path, `only ${pg.faqs.length} FAQs after hiding unfilled facts`);
// placeholders
const ph = new Set();
for (const pg of pages) for (const m of fs.readFileSync(fileFor(pg.path), 'utf8').matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) ph.add(m[1]);
for (const f of ['llms.txt']) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) ph.add(m[1]);
console.log('WEIGHT', JSON.stringify(weight));
console.log('PLACEHOLDERS', [...ph].sort().join(', '));
console.log(`WARNINGS (${warns.length})\n` + warns.join('\n'));
console.log(`ERRORS (${errs.length})\n` + errs.join('\n'));
process.exit(errs.length ? 1 : 0);
