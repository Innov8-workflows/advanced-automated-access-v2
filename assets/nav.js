/* ============================================================
   MOBILE DRAWER - generated pages
   ============================================================
   The homepage has always had a burger and a drawer. The 328 generated pages
   had the drawer CSS but no markup and no script, and the kit hides .nav-links
   below 1024px - so every page except the homepage had NO top level navigation
   at all on a phone. The only way out of a service page was the footer.

   The drawer is BUILT HERE rather than printed into every page. Shipping the
   markup produced 2.2 KB of identical HTML on 328 pages, 730 KB in total, which
   took the site straight past its payload budget. This file is fetched and
   cached once and costs those pages nothing.

   It is assembled from what is already in the document - the brand block, the
   desktop nav links, the phone number, the first mailto on the page - so the
   drawer cannot drift out of step with the nav it came from, and there is no
   second list of links to maintain.

   Behaviour matches the homepage on purpose, so the two halves of the site do
   not feel like different websites: .open class, aria-expanded on the button,
   the page behind locked, and the drawer closing when a link is followed.
   Escape also closes it, which the homepage does not do - worth folding back
   into the homepage next time it is touched.
   ============================================================ */
(function () {
  'use strict';
  var burger = document.getElementById('burger');
  var header = document.querySelector('.nav');
  if (!burger || !header || document.getElementById('drawer')) return;

  var ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  var CLOSE = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  var links = [].map.call(header.querySelectorAll('.nav-links a'), function (a) {
    return '<a href="' + a.getAttribute('href') + '">'
      + a.textContent.trim() + ' ' + ARROW + '</a>';
  }).join('');
  if (!links) return;

  var brand = header.querySelector('.brand');
  var call = header.querySelector('.nav-call');
  var mail = document.querySelector('a[href^="mailto:"]');

  var drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.id = 'drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Menu');
  drawer.innerHTML =
    '<div class="drawer-top">'
      + (brand ? brand.outerHTML : '')
      + '<button class="burger" type="button" id="closeDrawer" aria-label="Close menu" style="display:flex">'
      + CLOSE + '</button>'
    + '</div>'
    + '<nav>' + links + '</nav>'
    + '<div class="drawer-foot">'
      + (call ? '<a class="btn btn-primary btn-block" href="' + call.getAttribute('href')
          + '" data-track="call">Call ' + (call.querySelector('.lbl') || call).textContent.trim() + '</a>' : '')
      + (mail ? '<a class="btn btn-ghost btn-block" href="' + mail.getAttribute('href')
          + '" data-track="email">Email the office</a>' : '')
    + '</div>';
  document.body.appendChild(drawer);

  /* the cloned brand must not keep a duplicate id or aria-label from the header */
  var b2 = drawer.querySelector('.brand');
  if (b2) { b2.removeAttribute('id'); b2.setAttribute('aria-hidden', 'true'); b2.tabIndex = -1; }

  function set(open) {
    drawer.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    /* the kit locks the body rather than the html element - match it */
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = drawer.querySelector('nav a');
      if (first) first.focus();
    } else {
      burger.focus();
    }
  }

  burger.addEventListener('click', function () { set(true); });
  drawer.querySelector('#closeDrawer').addEventListener('click', function () { set(false); });
  [].forEach.call(drawer.querySelectorAll('nav a'), function (a) {
    a.addEventListener('click', function () { set(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('open')) set(false);
  });
})();
