(function () {
  var d = document, w = window;
  // Old single-page links: #home/#about/#rooms/#dining/#contact exist on the home page; #gallery moved
  var LEGACY = { '#gallery': '/gallery/' };
  if (location.pathname === '/' && LEGACY[location.hash] && !d.getElementById(location.hash.slice(1))) { location.replace(LEGACY[location.hash]); return; }
  var h = d.querySelector('.site-header');
  function sc() { if (h) h.classList.toggle('scrolled', w.scrollY > 40); }
  sc(); w.addEventListener('scroll', sc, { passive: true });

  // Mobile nav
  var b = d.getElementById('burger'), n = d.getElementById('site-nav');
  function nav(o) {
    n.classList.toggle('open', o);
    b.setAttribute('aria-expanded', o ? 'true' : 'false');
    b.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
    d.body.classList.toggle('nav-open', o);
  }
  if (b && n) {
    b.addEventListener('click', function () { nav(!n.classList.contains('open')); });
    n.addEventListener('click', function (e) { if (e.target === n || e.target.closest('a')) nav(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && n.classList.contains('open')) { nav(false); b.focus(); } });
  }

  // GA4 events
  function ev(name, p) { if (typeof w.gtag === 'function') w.gtag('event', name, Object.assign({ transport_type: 'beacon' }, p || {})); }
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var u = a.href, p = { link_url: u, link_text: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 100), page_path: location.pathname };
    if (u.indexOf('bookings.resavenue.com') > -1) ev('book_now_click', p);
    else if (u.indexOf('wa.me/') > -1) ev('whatsapp_click', p);
    else if (u.indexOf('tel:') === 0) ev('phone_click', p);
  });

  // Hero + carousel rotation (6 s); extra slides load after page load
  var rm = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function start() {
    d.querySelectorAll('[data-rotate]').forEach(function (el) {
      var s = el.querySelectorAll('img');
      if (s.length < 2 || rm) return;
      s.forEach(function (x) {
        if (x.dataset.srcset) { x.srcset = x.dataset.srcset; x.removeAttribute('data-srcset'); }
        if (x.dataset.src) { x.src = x.dataset.src; x.removeAttribute('data-src'); }
      });
      var i = 0;
      setInterval(function () { s[i].classList.remove('active'); i = (i + 1) % s.length; s[i].classList.add('active'); }, 6000);
    });
  }
  if (d.readyState === 'complete') start(); else w.addEventListener('load', start);

  // Gallery lightbox
  var dl = d.getElementById('lightbox');
  if (dl && dl.showModal) {
    var li = dl.querySelector('img');
    d.querySelectorAll('[data-full]').forEach(function (bt) {
      bt.addEventListener('click', function () { li.src = bt.dataset.full; li.alt = bt.querySelector('img').alt; dl.showModal(); });
    });
    dl.addEventListener('click', function (e) { if (e.target === dl || e.target.closest('.lb-close')) dl.close(); });
  }

  // Enquiry form -> WhatsApp
  d.querySelectorAll('form[data-whatsapp]').forEach(function (f) {
    var ci = f.elements.checkin, co = f.elements.checkout, td = new Date().toISOString().slice(0, 10);
    if (ci && co) { ci.min = td; co.min = td; ci.addEventListener('change', function () { co.min = ci.value || td; }); }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (k) { var x = f.elements[k]; return x ? String(x.value).trim() : ''; };
      var m = ['Hello! My name is ' + v('name') + '.', 'Email: ' + v('email')];
      if (v('checkin')) m.push('Check-in: ' + v('checkin'));
      if (v('checkout')) m.push('Check-out: ' + v('checkout'));
      if (v('guests')) m.push('Guests: ' + v('guests'));
      m.push('', 'Message: ' + v('message'));
      ev('form_submit', { form_id: f.id });
      w.open('https://wa.me/917760850555?text=' + encodeURIComponent(m.join('\n')), '_blank', 'noopener');
    });
  });

  d.querySelectorAll('[data-year]').forEach(function (y) { y.textContent = new Date().getFullYear(); });
})();
