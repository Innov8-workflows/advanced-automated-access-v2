/* ============================================================
   SITE SEARCH - client runtime
   ============================================================
   Chris asked for a search box in the header. Built as one external file so it
   is fetched and cached once for all 324 pages, and so the script's own URL
   gives us the site base for free - see BASE below. No library, no CDN, no
   external search service.

   Cost to a visitor who never searches: this file, and nothing else. The index
   is only fetched when the panel is first opened.

   Why a linear scan and not an inverted index: there are 324 documents totalling
   ~180 KB of indexed text. Scanning all of it with indexOf takes well under a
   millisecond, so an inverted index would be more code, more state and more to
   get wrong for no measurable gain. If this site ever reaches thousands of
   pages, that is the point to revisit it.
   ============================================================ */
(function () {
  'use strict';

  /* --- where we are -------------------------------------------------------
     The real site runs at the domain root, the review copies run from a GitHub
     Pages SUBPATH (/advanced-automated-access-v2/...). Deriving the base from
     this script's own src covers both without stage.js needing another rewrite
     rule, which is one less thing to forget. */
  var BASE = (function () {
    var el = document.currentScript;
    if (!el) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/\/assets\/search\.js(\?|$)/.test(all[i].src)) { el = all[i]; break; }
      }
    }
    if (!el || !el.src) return '';
    return el.src.replace(/\/assets\/search\.js(\?.*)?$/, '');
  })();

  /* group order and labels. Services first and news last is the whole point of
     grouping: there are 180 news posts and 9 services, so a flat relevance list
     buries the pages a specifier actually wants. */
  var GROUPS = [
    ['service', 'Products and services'],
    ['product', 'Systems'],
    ['area', 'Areas we cover'],
    ['project', 'Projects'],
    ['news', 'News'],
    ['page', 'Pages']
  ];
  var PER_GROUP = 5;

  var data = null;        // parsed index, once loaded
  var loading = null;     // in-flight promise, so a fast typist cannot fire two
  var items = [];         // current result rows, in render order
  var active = -1;        // highlighted row

  /* --- markup ------------------------------------------------------------- */
  var panel = document.createElement('div');
  panel.className = 'sch';
  panel.hidden = true;
  panel.innerHTML =
    '<div class="sch-back" data-close></div>' +
    '<div class="sch-box" role="dialog" aria-modal="true" aria-label="Search this site">' +
      '<div class="sch-top">' +
        '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
          '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input class="sch-in" type="search" autocomplete="off" spellcheck="false"' +
          ' placeholder="Search systems, projects, areas or news"' +
          ' role="combobox" aria-expanded="false" aria-controls="sch-list"' +
          ' aria-autocomplete="list" aria-label="Search this site">' +
        '<button class="sch-x" type="button" data-close aria-label="Close search">' +
          '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
      '</div>' +
      '<div class="sch-body">' +
        '<div class="sch-hint">Type to search all ' +
          '<span class="sch-n"></span> pages on the site.</div>' +
        '<div class="sch-list" id="sch-list" role="listbox" aria-label="Search results"></div>' +
      '</div>' +
    '</div>';

  var input, list, hint, nSpan;

  function mount() {
    if (input) return;
    document.body.appendChild(panel);
    input = panel.querySelector('.sch-in');
    list = panel.querySelector('.sch-list');
    hint = panel.querySelector('.sch-hint');
    nSpan = panel.querySelector('.sch-n');

    input.addEventListener('input', function () { run(input.value); });
    input.addEventListener('keydown', onKey);
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) close();
    });
  }

  /* --- index -------------------------------------------------------------- */
  function load() {
    if (data) return Promise.resolve(data);
    if (loading) return loading;
    loading = fetch(BASE + '/search-index.json', { credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('index ' + r.status);
        return r.json();
      })
      .then(function (j) {
        /* Positional rows keep the payload small:
           [url, title, typeIndex, description, excerpt] */
        data = j.d.map(function (row) {
          return {
            url: row[0], title: row[1], type: j.t[row[2]],
            desc: row[3] || '', ex: row[4] || '',
            hay: (row[1] + ' ' + (row[3] || '') + ' ' + (row[4] || '')).toLowerCase()
          };
        });
        if (nSpan) nSpan.textContent = String(data.length);
        return data;
      })
      .catch(function (e) {
        loading = null;
        if (hint) hint.textContent = 'Search is unavailable right now. Please use the menu.';
        throw e;
      });
    return loading;
  }

  /* --- scoring ------------------------------------------------------------
     Every token must appear somewhere (AND), which is what people expect from
     a site search. The last token also matches as a prefix so results appear
     while you are still typing the word. */
  function score(it, toks, last) {
    var t = it.title.toLowerCase(), d = it.desc.toLowerCase(), s = 0;
    for (var i = 0; i < toks.length; i++) {
      var q = toks[i];
      var isLast = (i === toks.length - 1) && last;
      var inHay = it.hay.indexOf(q) >= 0;
      if (!inHay) return 0;                       // AND: one miss and it is out
      if (t.indexOf(q) === 0) s += 60;            // title starts with the term
      else if (new RegExp('\\b' + esc(q)).test(t)) s += 40;  // word start in title
      else if (t.indexOf(q) >= 0) s += 24;
      if (d.indexOf(q) >= 0) s += 8;
      s += 2;                                      // it is in the excerpt at least
      if (isLast) s += 1;
    }
    if (it.type === 'service' || it.type === 'product') s += 6;  // nudge the money pages
    return s;
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function run(qRaw) {
    var q = (qRaw || '').trim().toLowerCase();
    if (!q) { render(null); return; }
    if (!data) { load().then(function () { run(qRaw); }); return; }
    var toks = q.split(/\s+/).filter(Boolean);
    var hits = [];
    for (var i = 0; i < data.length; i++) {
      var sc = score(data[i], toks, true);
      if (sc > 0) hits.push({ it: data[i], sc: sc });
    }
    hits.sort(function (a, b) { return b.sc - a.sc || a.it.title.localeCompare(b.it.title); });
    render(hits, q, toks);
  }

  /* --- render ------------------------------------------------------------- */
  function h(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* Escape first, then mark the matches on the escaped string - and escape the
     token the same way so a query containing & or < still lines up. */
  function mark(s, toks) {
    var out = h(s);
    for (var i = 0; i < toks.length; i++) {
      var t = h(toks[i]);
      if (!t) continue;
      out = out.replace(new RegExp('(' + esc(t) + ')', 'gi'), '<mark>$1</mark>');
    }
    return out;
  }

  function render(hits, q, toks) {
    items = []; active = -1;
    if (!hits) {
      list.innerHTML = '';
      hint.hidden = false;
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    hint.hidden = true;
    if (!hits.length) {
      list.innerHTML = '<div class="sch-none">No pages match <b>' + h(q) +
        '</b>. Try a system name, a town or a client.</div>';
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    var html = '', n = 0;
    for (var g = 0; g < GROUPS.length; g++) {
      var key = GROUPS[g][0];
      var inGroup = hits.filter(function (x) { return x.it.type === key; });
      if (!inGroup.length) continue;
      html += '<div class="sch-grp" role="presentation">' + GROUPS[g][1] +
        '<span>' + inGroup.length + '</span></div>';
      for (var i = 0; i < Math.min(inGroup.length, PER_GROUP); i++) {
        var it = inGroup[i].it;
        var id = 'sch-o' + n;
        items.push(it);
        html += '<a class="sch-hit" id="' + id + '" role="option" aria-selected="false"' +
          ' href="' + h(BASE + it.url) + '">' +
          '<span class="sch-t">' + mark(it.title, toks) + '</span>' +
          (it.desc ? '<span class="sch-d">' + mark(clip(it.desc, 120), toks) + '</span>' : '') +
          '</a>';
        n++;
      }
      if (inGroup.length > PER_GROUP) {
        html += '<div class="sch-more">and ' + (inGroup.length - PER_GROUP) +
          ' more in ' + GROUPS[g][1].toLowerCase() + '</div>';
      }
    }
    list.innerHTML = html;
    input.setAttribute('aria-expanded', 'true');
  }
  function clip(s, n) { return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }

  /* --- keyboard ----------------------------------------------------------- */
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter') {
      if (active >= 0 && items[active]) { e.preventDefault(); go(items[active]); }
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (!items.length) return;
    e.preventDefault();
    active += (e.key === 'ArrowDown' ? 1 : -1);
    if (active < 0) active = items.length - 1;
    if (active >= items.length) active = 0;
    var rows = list.querySelectorAll('.sch-hit');
    for (var i = 0; i < rows.length; i++) {
      var on = (i === active);
      rows[i].setAttribute('aria-selected', on ? 'true' : 'false');
      rows[i].classList.toggle('on', on);
      if (on) {
        input.setAttribute('aria-activedescendant', rows[i].id);
        rows[i].scrollIntoView({ block: 'nearest' });
      }
    }
  }
  function go(it) { window.location.href = BASE + it.url; }

  /* --- open / close ------------------------------------------------------- */
  var lastFocus = null;
  function open() {
    mount();
    lastFocus = document.activeElement;
    panel.hidden = false;
    document.documentElement.classList.add('sch-open');
    load();                       // first open is when the index is fetched
    input.focus();
    input.select();
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    document.documentElement.classList.remove('sch-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* --- triggers ----------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-search]');
    if (b) { e.preventDefault(); open(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) ||
      e.target.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); open(); return;
    }
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); open();
    }
  });
})();
