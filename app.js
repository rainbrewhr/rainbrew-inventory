/* Rainbrew Inventory - one shared client for the four apps (admin, stockkeeper, procurement, request).
   Every page sets window.RB_APP; the database (row-level security + RPC functions) decides what each role may do. */
(function () {
  'use strict';
  var CFG = window.RAINBREW, APP = window.RB_APP;
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  var BRAND = 'Rainbrew Inventory System';
  var UNITS = ['bottle', 'box', 'jar', 'g', 'kg', 'pack', 'pcs', 'sack', 'bag', 'gallon', 'roll', 'can'];
  var OPS = ['Admin', 'Stock Keeper', 'Procurement Officer'];
  var ROLES = ['Admin', 'Stock Keeper', 'Procurement Officer', 'Station Staff', 'Requester', 'Viewer'];
  var REQUESTERS = ['Admin', 'Stock Keeper', 'Station Staff', 'Requester'];

  var APPS = {
    all: { title: '', tabs: ['dash', 'stock', 'release', 'receive', 'buy', 'req', 'buyreq', 'mine', 'waste', 'swaste', 'count', 'reports', 'items', 'places', 'users', 'history'] },
    admin: { title: 'Admin', tabs: ['dash', 'stock', 'release', 'receive', 'buy', 'req', 'buyreq', 'waste', 'count', 'reports', 'items', 'places', 'users', 'history'] },
    stockkeeper: { title: 'Stock Keeper', tabs: ['release', 'receive', 'waste', 'count', 'stock', 'dash', 'reports', 'history'] },
    procurement: { title: 'Procurement', tabs: ['buy', 'release', 'receive', 'stock', 'dash', 'reports', 'history'] },
    request: { title: 'Request', tabs: ['req', 'buyreq', 'mine', 'stock', 'swaste'] }
  };
  var TABS = {
    dash: { label: 'Dashboard', roles: OPS.concat('Viewer'), view: vDash },
    release: { label: 'Release', roles: OPS, view: function (b) { return RB.views.release(b); } },
    receive: { label: 'Receive', roles: OPS, view: vReceive },
    buy: { label: 'Buy list', roles: OPS, view: function (b) { return RB.views.buy(b); } },
    waste: { label: 'Waste', roles: ['Admin', 'Stock Keeper'], view: function (b) { return vWaste(b, null); } },
    count: { label: 'Count', roles: ['Admin', 'Stock Keeper'], view: function (b) { return RB.views.count(b); } },
    stock: { label: 'Stock', roles: OPS.concat(['Viewer', 'Station Staff', 'Requester']), view: function (b) { return RB.views.stock(b); } },
    reports: { label: 'Reports', roles: OPS, view: function (b) { return RB.views.reports(b); } },
    items: { label: 'Items', roles: ['Admin'], view: function (b) { return RB.views.items(b); } },
    places: { label: 'Places', roles: ['Admin'], view: vPlaces },
    users: { label: 'Users', roles: ['Admin'], view: vUsers },
    history: { label: 'History', roles: OPS, view: function (b) { return RB.views.history(b, false); } },
    req: { label: 'Request items', roles: REQUESTERS, view: vRequest },
    buyreq: { label: 'Request to buy', roles: REQUESTERS, view: vBuyRequest },
    mine: { label: 'My requests', roles: REQUESTERS, view: function (b) { return RB.views.history(b, true); } },
    swaste: { label: 'Station waste', roles: ['Admin', 'Stock Keeper', 'Station Staff'], view: function (b) { return vWaste(b, 'station'); } }
  };

  /* ---------- theme ---------- */
  function applyTheme(t) { document.documentElement.dataset.theme = t; }
  function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('rb_theme'); } catch (e) { /* storage unavailable */ }
    applyTheme(saved === 'dark' || saved === 'light' ? saved : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  })();

  /* ---------- icons (Lucide paths, inlined so there is nothing extra to load) ---------- */
  var ICONS = {
    dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    stock: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    release: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    receive: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    buy: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    req: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
    buyreq: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    waste: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    count: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 14l2 2 4-4"/>',
    reports: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    items: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1"/>',
    places: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    mine: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };
  var TAB_ICON = { dash: 'dash', stock: 'stock', release: 'release', receive: 'receive', buy: 'buy', req: 'req', buyreq: 'buyreq', waste: 'waste', count: 'count', reports: 'reports', items: 'items', places: 'places', users: 'users', history: 'history', mine: 'mine', swaste: 'waste' };
  function icon(name) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
  function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('') || '?'; }

  var LANDING = { 'Admin': 'dash', 'Stock Keeper': 'release', 'Procurement Officer': 'buy', 'Station Staff': 'req', 'Requester': 'req', 'Viewer': 'dash' };
  var root = document.getElementById('root');
  var S = { user: null, profile: null, items: [], map: new Map(), stations: null, suppliers: null };
  var cur = null, navToken = 0, main = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return n == null || n === '' ? '' : String(Math.round(Number(n) * 1000) / 1000); }
  var tf = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function when(ts) { return ts ? tf.format(new Date(ts)) : ''; }
  function $(s, el) { return (el || document).querySelector(s); }
  function role() { return S.profile && S.profile.role; }
  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5000 : 2600);
  }
  async function act(btn, fn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { toast((e && e.message) || String(e), true); }
    finally { if (btn) btn.disabled = false; }
  }
  var READ_ONLY_RPC = { catalog: 1, next_id: 1 };
  async function rpc(name, args) {
    var r = await sb.rpc(name, args || {});
    if (r.error) throw new Error(r.error.message);
    if (!READ_ONLY_RPC[name]) S.catDirty = true; // a write happened: the next catalog request must hit the server
    return r.data;
  }
  async function q(promise) {
    var r = await promise;
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  function setItems(rows) { S.items = rows; S.map = new Map(rows.map(function (r) { return [r.id, r]; })); }
  var catalogInflight = null;
  // force=true means "make sure this is current": it still skips the network when the list was fetched a few seconds ago and nothing was written since.
  async function loadCatalog(force) {
    var fresh = S.items.length && S.catAt && Date.now() - S.catAt < 15000 && !S.catDirty;
    if (S.items.length && (!force || fresh)) return;
    if (catalogInflight) return catalogInflight;
    catalogInflight = rpc('catalog').then(function (rows) {
      setItems(rows); S.catAt = Date.now(); S.catDirty = false;
      try { localStorage.setItem('rb_cat_' + S.user.id, JSON.stringify(rows)); } catch (e) { /* storage unavailable */ }
    }).finally(function () { catalogInflight = null; });
    return catalogInflight;
  }
  async function stations() {
    if (!S.stations) {
      var d = await q(sb.from('locations').select('name,type,active').order('name'));
      S.stations = d.filter(function (l) { return l.type === 'Station' && l.active; }).map(function (l) { return l.name; });
    }
    return S.stations;
  }
  async function suppliers() {
    if (!S.suppliers) S.suppliers = await q(sb.from('suppliers').select('id,name').order('name'));
    return S.suppliers;
  }
  function opts(list, sel, blank) {
    return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) {
      var v = typeof x === 'string' ? x : x.value, l = typeof x === 'string' ? x : x.label;
      return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }
  function pill(s) { return '<span class="pill ' + esc(s) + '">' + esc(s) + '</span>'; }
  function node(html) { var d = document.createElement('div'); d.innerHTML = html; return d; }

  /* ---------- supplier dropdowns with "add new supplier" ---------- */
  function canAddSupplier() { return role() === 'Admin' || role() === 'Procurement Officer'; }
  function supOptions(list, sel, blank) {
    return opts(list.map(function (s) { return { value: s.id, label: s.name }; }), sel, blank) + (canAddSupplier() ? '<option value="__new__">➕ Add new supplier…</option>' : '');
  }
  document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('sup-sel')) e.target.dataset.prev = e.target.value; });
  document.addEventListener('change', async function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('sup-sel') || el.value !== '__new__') return;
    e.stopPropagation();
    var name = (prompt('New supplier name') || '').trim().toUpperCase();
    if (!name) { el.value = el.dataset.prev || ''; return; }
    try {
      var row = (await q(sb.from('suppliers').insert({ name: name }).select('id,name'))) [0];
      if (S.suppliers) { S.suppliers.push(row); S.suppliers.sort(function (a, b) { return a.name < b.name ? -1 : 1; }); }
      document.querySelectorAll('select.sup-sel').forEach(function (sel) {
        var opt = new Option(row.name, row.id), end = sel.querySelector('option[value="__new__"]');
        sel.insertBefore(opt, end);
      });
      el.value = row.id;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      toast('Supplier added');
    } catch (err) { el.value = el.dataset.prev || ''; toast(err.message, true); }
  }, true);

  /* ---------- add a product that is not listed yet ---------- */
  async function newProduct(name) {
    var ops = OPS.indexOf(role()) >= 0, sups = ops ? await suppliers() : [];
    var cats = Array.from(new Set(S.items.map(function (i) { return i.category; }).filter(Boolean))).sort();
    return new Promise(function (resolve) {
      var m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = '<div class="card sheet"><h2>New product</h2><p class="muted">This product is not in the list yet. Adding it lets you use it right away; an admin can complete its details later.</p>' +
        '<label>Product name</label><input id="np-n" value="' + esc(name) + '">' +
        '<label>Category</label><input id="np-c" list="np-cl" placeholder="e.g. PACKAGING"><datalist id="np-cl">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
        '<label>Unit</label><select id="np-u">' + opts(UNITS, 'pack', 'Choose…') + '</select>' +
        (ops ? '<label>Supplier</label><select id="np-s" class="sup-sel">' + supOptions(sups, '', '—') + '</select>' : '') +
        '<div class="row" style="margin-top:12px"><button class="btn" id="np-ok">Add product</button><button class="btn alt" id="np-no">Cancel</button></div></div>';
      document.body.appendChild(m);
      function close(v) { m.remove(); resolve(v); }
      $('#np-no', m).onclick = function () { close(null); };
      $('#np-ok', m).onclick = function (e) {
        act(e.currentTarget, async function () {
          var nm = $('#np-n', m).value.trim(); if (!nm) throw new Error('Enter the product name');
          var sup = $('#np-s', m);
          var id = await rpc('add_item', { p: { name: nm, category: $('#np-c', m).value.trim(), unit: $('#np-u', m).value, supplier_id: sup ? sup.value : '' }, p_opening: null });
          await loadCatalog(true);
          toast(nm.toUpperCase() + ' added');
          close(S.map.get(id));
        });
      };
      $('#np-n', m).focus();
    });
  }

  /* ---------- item search + quantity lines ---------- */
  function lineBuilder(box, o) {
    o = o || {};
    var lines = [];
    box.innerHTML = '<input class="lb-q" type="search" placeholder="Search item to add…" autocomplete="off"><div class="suggest hide"></div>' +
      '<div class="tbl"><table><thead><tr><th>Item</th>' + (o.stock ? '<th class="num hm">In stock</th>' : '') + '<th class="num">Qty</th>' + (o.reason ? '<th>Reason</th>' : '') + '<th></th></tr></thead><tbody></tbody></table></div>' +
      '<p class="muted lb-empty">No items yet. Search above to add.</p>';
    var qi = $('.lb-q', box), sg = $('.suggest', box), tb = $('tbody', box), empty = $('.lb-empty', box);
    function draw() {
      tb.innerHTML = lines.map(function (l, i) {
        return '<tr data-i="' + i + '"><td>' + esc(l.item.name) + '<div class="muted">' + esc(l.item.unit || '') + '</div></td>' +
          (o.stock ? '<td class="num hm">' + fmt(l.item.current_stock) + '</td>' : '') +
          '<td class="num"><input type="number" inputmode="decimal" min="0" step="any" value="' + esc(l.qty) + '" data-f="qty" style="width:92px"></td>' +
          (o.reason ? '<td><input data-f="reason" value="' + esc(l.reason || '') + '" placeholder="optional"></td>' : '') +
          '<td><button class="btn alt sm" data-rm type="button">✕</button></td></tr>';
      }).join('');
      empty.classList.toggle('hide', lines.length > 0);
    }
    tb.addEventListener('input', function (e) {
      var tr = e.target.closest('tr'); if (!tr || !e.target.dataset.f) return;
      lines[+tr.dataset.i][e.target.dataset.f] = e.target.value;
    });
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      lines.splice(+b.closest('tr').dataset.i, 1); draw();
    });
    qi.addEventListener('input', function () {
      var t = qi.value.trim().toLowerCase();
      if (!t) { sg.classList.add('hide'); return; }
      var have = new Set(lines.map(function (l) { return l.item.id; }));
      var res = S.items.filter(function (i) { return i.active && !have.has(i.id) && i.name.toLowerCase().indexOf(t) >= 0; }).slice(0, 8);
      sg.innerHTML = res.map(function (i) {
        return '<button type="button" data-id="' + i.id + '"><span>' + esc(i.name) + '<span class="muted"> ' + esc((i.stocked_at || []).join(' / ')) + '</span></span><span class="muted">' + esc(i.unit || '') + (o.stock ? ' · ' + fmt(i.current_stock) + ' in stock' : '') + '</span></button>';
      }).join('') + (o.noNew || t.length < 2 ? (res.length ? '' : '<div class="muted" style="padding:9px">No match</div>') :
        '<button type="button" data-new="1"><span><b>➕ Add “' + esc(qi.value.trim()) + '” as a new product</b>' + (res.length ? '' : '<span class="muted"> — not in the list yet</span>') + '</span></button>');
      sg.classList.remove('hide');
    });
    sg.addEventListener('click', async function (e) {
      var nb = e.target.closest('button[data-new]');
      if (nb) {
        var typed = qi.value.trim(); sg.classList.add('hide');
        var made = await newProduct(typed);
        if (made) { lines.push({ item: made, qty: '' }); qi.value = ''; draw(); var lastq = tb.querySelector('tr:last-child input[data-f=qty]'); if (lastq) lastq.focus(); }
        return;
      }
      var b = e.target.closest('button[data-id]'); if (!b) return;
      lines.push({ item: S.map.get(b.dataset.id), qty: '' });
      qi.value = ''; sg.classList.add('hide'); draw();
      var last = tb.querySelector('tr:last-child input[data-f=qty]'); if (last) last.focus();
    });
    draw();
    return {
      get lines() { return lines.filter(function (l) { return Number(l.qty) > 0; }); },
      set: function (list) { lines.length = 0; list.forEach(function (x) { lines.push(x); }); draw(); },
      clear: function () { lines.length = 0; draw(); }
    };
  }

  /* ---------- shell + auth ---------- */
  function logo() { return '<img src="icon-192.png" alt="">'; }

  function authView(msg) {
    var mode = 'in';
    root.innerHTML = '<div class="auth">' + logo() + '<h1>' + BRAND + '<small>' + esc(APPS[APP].title) + '</small></h1><div class="card">' +
      '<div class="seg"><button data-m="in" class="on">Sign in</button><button data-m="up">Create account</button></div>' +
      '<form id="af"><div id="nm" class="hide"><label>Your name</label><input id="an" autocomplete="name"></div>' +
      (APP === 'all' ? '<div id="rl" class="hide"><label>What do you do?</label><select id="ar"><option value="request">Request items for my station</option><option value="stockkeeper">Stock keeper</option><option value="procurement">Procurement</option><option value="admin">Admin / first-time setup</option></select></div>' : '') +
      '<label>Email</label><input id="ae" type="email" required autocomplete="email">' +
      '<label>Password</label><input id="ap" type="password" required minlength="8" autocomplete="current-password">' +
      '<p id="am" class="muted">' + esc(msg || '') + '</p><button class="btn" style="width:100%" id="as">Sign in</button></form>' +
      '<p class="muted" id="ah"></p></div></div>';
    var seg = root.querySelectorAll('.seg button');
    function setMode(m) {
      mode = m;
      seg.forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
      $('#nm').classList.toggle('hide', m === 'in');
      if ($('#rl')) $('#rl').classList.toggle('hide', m === 'in');
      $('#as').textContent = m === 'in' ? 'Sign in' : 'Create account';
      $('#ap').autocomplete = m === 'in' ? 'current-password' : 'new-password';
      showHint();
    }
    function chosenApp() { return APP === 'all' ? ($('#ar') ? $('#ar').value : 'request') : APP; }
    function showHint() { $('#ah').textContent = mode === 'up' ? (chosenApp() === 'request' ? 'You can start sending requests right after you sign in.' : 'An admin must approve new accounts before they can use this app.') : ''; }
    if ($('#ar')) $('#ar').onchange = showHint;
    seg.forEach(function (b) { b.onclick = function () { setMode(b.dataset.m); }; });
    $('#af').onsubmit = function (ev) {
      ev.preventDefault();
      act($('#as'), async function () {
        var email = $('#ae').value.trim(), pw = $('#ap').value;
        if (mode === 'in') {
          var r = await sb.auth.signInWithPassword({ email: email, password: pw });
          if (r.error) throw new Error(r.error.message);
          return boot();
        }
        var name = $('#an').value.trim();
        if (!name) throw new Error('Enter your name');
        var u = await sb.auth.signUp({ email: email, password: pw, options: { data: { name: name, app: chosenApp() } } });
        if (u.error) throw new Error(u.error.message);
        if (u.data.session) return boot();
        setMode('in');
        $('#am').textContent = 'Account created. Check your email to confirm it, then sign in.';
      });
    };
  }

  function closeDrawer() {
    var side = $('#side'), scrim = $('#scrim');
    if (side) side.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
  }
  function openDrawer() {
    $('#side').classList.add('open'); $('#scrim').classList.add('open');
    var first = $('#side nav.tabs button.on') || $('#side nav.tabs button'); if (first) first.focus();
  }
  function paintThemeButton() { var b = $('#theme'); if (b) { b.innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); } }

  function shell(profile) {
    var allowed = APPS[APP].tabs.filter(function (t) { return TABS[t].roles.indexOf(profile.role) >= 0; });
    root.innerHTML = '<div class="shell"><div class="scrim" id="scrim"></div>' +
      '<aside class="side" id="side" aria-label="Navigation"><div class="brandrow">' + logo() + '<div class="brandtxt"><b>' + BRAND + '</b><span>' + esc(APP === 'all' ? profile.role : APPS[APP].title) + '</span></div><button class="icon-btn sclose" id="sclose" aria-label="Close menu">' + icon('x') + '</button></div>' +
      '<nav class="tabs" aria-label="Primary">' + allowed.map(function (t) { return '<button data-t="' + t + '" title="' + esc(TABS[t].label) + '">' + icon(TAB_ICON[t] || 'dash') + '<span>' + esc(TABS[t].label) + '</span></button>'; }).join('') + (OPS.indexOf(profile.role) >= 0 ? '<a class="navlink" href="inventory/">' + icon('stock') + '<span>Executive view</span></a>' : '') + '</nav>' +
      '<div class="userrow"><span class="avatar" aria-hidden="true">' + esc(initials(profile.name)) + '</span><div class="usertxt"><b>' + esc(profile.name) + '</b><span>' + esc(profile.role) + '</span></div><button class="icon-btn" id="so" aria-label="Sign out" title="Sign out">' + icon('logout') + '</button></div></aside>' +
      '<div class="col"><header class="cmd"><button class="icon-btn menu" id="menu" aria-label="Open menu">' + icon('menu') + '</button><div class="ptitle"><h1 id="ptitle"></h1><p>' + BRAND + (APP === 'all' ? '' : ' · ' + esc(APPS[APP].title)) + '</p></div><div class="sp"></div><button class="icon-btn" id="theme"></button></header><main id="main"></main></div></div>';
    main = $('#main');
    paintThemeButton();
    $('#so').onclick = async function () { await sb.auth.signOut(); location.reload(); };
    $('#menu').onclick = openDrawer; $('#sclose').onclick = closeDrawer; $('#scrim').onclick = closeDrawer;
    $('#theme').onclick = function () {
      var t = currentTheme() === 'dark' ? 'light' : 'dark'; applyTheme(t);
      try { localStorage.setItem('rb_theme', t); } catch (e) { /* ignore */ }
      paintThemeButton();
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.onclick = function () { show(b.dataset.t); }; });
    // Phones: turn every table into a stack of labelled cards; keeps working when a view redraws its rows.
    var pending = false;
    new MutationObserver(function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; stackTables(main); });
    }).observe(main, { childList: true, subtree: true });
    window.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (h && h !== cur && TABS[h] && allowed.indexOf(h) >= 0) show(h);
    });
    return allowed;
  }

  function stackTables(scope) {
    scope.querySelectorAll('table').forEach(function (t) {
      var heads = [].map.call(t.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
      t.classList.add('stack');
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        [].forEach.call(tr.children, function (td, i) { if (td.tagName === 'TD' && td.dataset.label === undefined) td.dataset.label = heads[i] || ''; });
      });
    });
  }

  function simpleCard(title, html) {
    root.innerHTML = '<div class="auth">' + logo() + '<h1>' + BRAND + '<small>' + esc(APPS[APP].title) + '</small></h1><div class="card"><h2>' + esc(title) + '</h2>' + html + '</div></div>';
  }

  function pendingView(p) {
    var canClaim = p.requested_app === 'admin';
    simpleCard('Waiting for approval',
      '<p>Hi ' + esc(p.name) + '. Your account is created but an admin needs to approve it before you can use this app.</p>' +
      (canClaim ? '<p class="muted">Setting up the system for the first time? If there is no admin yet, you can claim the admin role.</p><button class="btn" id="claim" style="width:100%;margin-bottom:8px">Set me up as the first admin</button>' : '') +
      '<button class="btn alt" id="again" style="width:100%;margin-bottom:8px">Check again</button><button class="btn alt" id="out" style="width:100%">Sign out</button>');
    var c = $('#claim');
    if (c) c.onclick = function () { act(c, async function () { await rpc('claim_first_admin'); boot(); }); };
    $('#again').onclick = boot;
    $('#out').onclick = async function () { await sb.auth.signOut(); location.reload(); };
  }

  async function stationPicker() {
    var list = await stations();
    simpleCard('Which station are you at?',
      '<p class="muted">We use this to send your requests to the right place.</p><select id="st">' + opts(list, '', 'Choose…') + '</select><button class="btn" id="go" style="width:100%;margin-top:10px">Continue</button>');
    $('#go').onclick = function () {
      var v = $('#st').value; if (!v) return toast('Choose a station', true);
      act($('#go'), async function () { await rpc('set_my_station', { p_station: v }); boot(); });
    };
  }

  async function boot() {
    root.innerHTML = '<div class="auth">' + logo() + '<div class="skeleton"></div><div class="skeleton"></div></div>';
    var s = await sb.auth.getSession();
    if (!s.data.session) return authView();
    S.user = s.data.session.user;
    var pr = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
    if (pr.error || !pr.data) return authView('Could not load your account. ' + ((pr.error && pr.error.message) || ''));
    S.profile = pr.data;
    if (!S.profile.active) {
      simpleCard('Account disabled', '<p>Ask an admin to re-enable your account.</p><button class="btn alt" id="out">Sign out</button>');
      $('#out').onclick = async function () { await sb.auth.signOut(); location.reload(); };
      return;
    }
    if (!S.profile.approved) return pendingView(S.profile);
    if (!S.profile.station && (S.profile.role === 'Requester' || S.profile.role === 'Station Staff')) return stationPicker();
    var allowed = shell(S.profile);
    if (!allowed.length) {
      main.innerHTML = '<div class="card"><h2>No access</h2><p>Your role (' + esc(S.profile.role) + ') cannot use this app. Try a different one from the home page.</p></div>';
      return;
    }
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('rb_cat_' + S.user.id) || 'null'); } catch (e) { /* ignore */ }
    var wanted = location.hash.slice(1);
    var tab = allowed.indexOf(wanted) >= 0 ? wanted : (allowed.indexOf(LANDING[S.profile.role]) >= 0 ? LANDING[S.profile.role] : allowed[0]);
    if (cached && cached.length) {
      setItems(cached);
      show(tab);
      loadCatalog(true).then(function () { if (['dash', 'buy', 'items'].indexOf(cur) >= 0) show(cur); }).catch(function () { /* offline: keep cached */ });
    } else {
      show(tab);
    }
  }

  var SKELETON = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  async function show(tab) {
    cur = tab;
    var t = ++navToken;
    // Respond to the tap straight away: highlight the tab, set the title, close the phone menu and show a loading state.
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    var title = $('#ptitle'); if (title) title.textContent = TABS[tab].label;
    document.title = TABS[tab].label + ' · ' + BRAND;
    try { if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab); } catch (e) { /* ignore */ }
    closeDrawer();
    main.setAttribute('aria-busy', 'true');
    main.innerHTML = SKELETON;
    window.scrollTo(0, 0);
    var box = document.createElement('div');
    try { await TABS[tab].view(box); }
    catch (e) { box.innerHTML = '<div class="card"><h2>Something went wrong</h2><p class="muted">' + esc(e.message || e) + '</p><button class="btn alt" onclick="location.reload()">Reload</button></div>'; }
    if (t === navToken) { main.replaceChildren(box); main.removeAttribute('aria-busy'); }
  }

  /* ---------- views ---------- */
  async function vDash(box) {
    await loadCatalog();
    var items = S.items.filter(function (i) { return i.active; });
    var low = items.filter(function (i) { return i.status === 'LOW'; });
    var crit = items.filter(function (i) { return i.status === 'CRITICAL'; });
    var noLevels = !items.some(function (i) { return i.reorder_point != null; });
    function cnt(type) { return sb.from('requests').select('id', { count: 'exact', head: true }).eq('type', type).in('status', ['Pending', 'Partial']); }
    var res = await Promise.all([
      cnt('Transfer'), cnt('Purchase'),
      sb.from('stock_movements').select('ts,type,signed_qty,reference,station,items(name,unit)').order('ts', { ascending: false }).limit(12)
    ]);
    var recent = res[2].data || [];
    var need = crit.concat(low);
    box.innerHTML = '<div class="tiles">' +
      '<div class="tile"><b>' + items.length + '</b><span>Items tracked</span></div>' +
      '<div class="tile bad"><b>' + crit.length + '</b><span>Critical</span></div>' +
      '<div class="tile warn"><b>' + low.length + '</b><span>Low</span></div>' +
      '<div class="tile"><b>' + (res[0].count || 0) + '</b><span>Open station requests</span></div>' +
      '<div class="tile"><b>' + (res[1].count || 0) + '</b><span>Open buy requests</span></div></div>' +
      (noLevels ? '<div class="card"><b>No reorder levels set yet.</b><p class="muted">Low and critical alerts need a Reorder Point and Critical Level on each item' + (role() === 'Admin' ? ' — set them in the Items tab.' : '. Ask an admin to set them.') + '</p></div>' : '') +
      '<div class="card"><h2>Needs attention</h2>' + (need.length ?
        '<div class="tbl"><table><thead><tr><th>Item</th><th class="num">Stock</th><th class="num hm">Reorder at</th><th>Status</th></tr></thead><tbody>' +
        need.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td class="num">' + fmt(i.current_stock) + ' ' + esc(i.unit || '') + '</td><td class="num hm">' + fmt(i.reorder_point) + '</td><td>' + pill(i.status) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="muted">Nothing is low right now.</p>') + '</div>' +
      '<div class="card"><h2>Latest activity</h2>' + (recent.length ?
        '<div class="tbl"><table><tbody>' + recent.map(function (m) {
          return '<tr><td class="muted">' + esc(when(m.ts)) + '</td><td>' + esc(m.type) + '</td><td>' + esc(m.items ? m.items.name : '') + '</td><td class="num">' + (m.signed_qty > 0 ? '+' : '') + fmt(m.signed_qty) + '</td><td class="muted hm">' + esc(m.reference || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted">No activity yet.</p>') + '</div>';
  }

  function requestSelect(type) {
    return sb.from('requests').select('id,type,station,requester_name,status,notes,created_at,request_items(id,item_id,requested_qty,fulfilled_qty,remaining_qty,status,unit,items(name,unit))')
      .eq('type', type).in('status', ['Pending', 'Partial']).order('created_at', { ascending: true });
  }
  function openLines(r) { return (r.request_items || []).filter(function (l) { return l.status === 'Pending' || l.status === 'Partial'; }); }


  async function vReceive(box) {
    await loadCatalog(true);
    var res = await Promise.all([suppliers(), q(requestSelect('Purchase'))]);
    var sups = res[0], purs = res[1];
    box.innerHTML = '<div class="card"><h2>Receive delivery</h2>' +
      '<label>Supplier</label><input id="rs" list="rsl" placeholder="Supplier name"><datalist id="rsl">' + sups.map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('') + '</datalist>' +
      '<label>Against an urgent buy request (optional)</label><select id="rp">' + opts(purs.map(function (p) { return { value: p.id, label: p.id + ' · ' + openLines(p).length + ' item(s) · ' + (p.requester_name || '') }; }), '', 'Not against a request') + '</select>' +
      '<label>Items received</label><div id="lb"></div><label>Note (e.g. invoice no.)</label><input id="rn"><div style="margin-top:12px"><button class="btn" id="rgo">Receive into stock</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: true });
    if (window.RB.prefill) {
      var pf = window.RB.prefill; window.RB.prefill = null;
      $('#rs', box).value = pf.supplier || ''; lb.set(pf.lines);
    }
    $('#rp', box).onchange = function () {
      var p = purs.find(function (x) { return x.id === this.value; }, this);
      if (!p) return lb.clear();
      lb.set(openLines(p).map(function (l) { return { item: S.map.get(l.item_id), qty: String(l.remaining_qty) }; }).filter(function (x) { return x.item; }));
    };
    $('#rgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var id = await rpc('receive_stock', { p_supplier: $('#rs', box).value.trim(), p_ref: $('#rp', box).value, p_note: $('#rn', box).value.trim(), p_lines: ls });
        toast('Received · ' + id); await loadCatalog(true); show('receive');
      });
    };
  }

  function unitFor(i) { return i.purchase_unit || i.unit || ''; }
  function suggested(i) {
    var target = i.par_target != null ? Number(i.par_target) : (i.reorder_point != null ? Number(i.reorder_point) * 2 : 0);
    var need = Math.max(target - Number(i.current_stock), 1), m = i.order_multiple ? Number(i.order_multiple) : 1;
    return Math.ceil(need / m) * m;
  }

  async function vWaste(box, fixedKind) {
    await loadCatalog(true);
    var sts = await stations(), staff = role() === 'Station Staff';
    box.innerHTML = '<div class="card"><h2>' + (fixedKind ? 'Station waste' : 'Waste') + '</h2>' +
      (fixedKind ? '' : '<label>Type</label><select id="wk"><option value="stockroom">Stock room waste (deducts stock)</option><option value="station">Station waste (log only)</option></select>') +
      '<div id="wst"' + (fixedKind ? '' : ' class="hide"') + '>' + (staff ? '<p class="muted">Station: ' + esc(S.profile.station || '') + '</p>' : '<label>Station</label><select id="ws">' + opts(sts, S.profile.station || '', 'Choose…') + '</select>') + '</div>' +
      '<label>Items wasted</label><div id="lb"></div><label>Note</label><input id="wn"><div style="margin-top:12px"><button class="btn" id="wgo">Record waste</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: !fixedKind, reason: true, noNew: true });
    var wk = $('#wk', box);
    if (wk) wk.onchange = function () { $('#wst', box).classList.toggle('hide', wk.value !== 'station'); };
    $('#wgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var kind = fixedKind || wk.value;
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty, reason: l.reason || '' }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var ws = $('#ws', box);
        var id = await rpc('log_waste', { p_kind: kind, p_station: ws ? ws.value : (S.profile.station || ''), p_note: $('#wn', box).value.trim(), p_lines: ls });
        toast('Recorded · ' + id); await loadCatalog(true); show(cur);
      });
    };
  }



  async function vPlaces(box) {
    var rows = await q(sb.from('locations').select('id,name,type,active').order('type').order('name'));
    box.innerHTML = '<div class="card"><h2>Add a place</h2><div class="row"><input id="pn" class="grow" placeholder="Name, e.g. BAR STATION"><select id="pt" style="max-width:160px">' + opts(['Station', 'Stock Room'], 'Station') + '</select><button class="btn" id="padd">Add</button></div><p class="muted">Stations receive stock from requests. Stock rooms are where stock is kept.</p></div>' +
      '<div class="card tbl"><table><thead><tr><th>Place</th><th>Type</th><th>Active</th></tr></thead><tbody id="pl">' +
      rows.map(function (r) { return '<tr data-id="' + r.id + '"><td><input data-f="name" value="' + esc(r.name) + '"></td><td>' + esc(r.type) + '</td><td><input type="checkbox" data-f="active"' + (r.active ? ' checked' : '') + '></td></tr>'; }).join('') + '</tbody></table></div>';
    $('#pl', box).addEventListener('change', function (e) {
      var tr = e.target.closest('tr'), f = e.target.dataset.f; if (!tr || !f) return;
      var patch = {}; patch[f] = f === 'active' ? e.target.checked : e.target.value.trim().toUpperCase();
      sb.from('locations').update(patch).eq('id', tr.dataset.id).then(function (r) { if (r.error) return toast(r.error.message, true); S.stations = null; toast('Saved'); });
    });
    $('#padd', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var name = $('#pn', box).value.trim().toUpperCase(); if (!name) throw new Error('Enter a name');
        await q(sb.from('locations').insert({ name: name, type: $('#pt', box).value }));
        S.stations = null; toast('Added'); show('places');
      });
    };
  }

  async function vUsers(box) {
    var res = await Promise.all([q(sb.from('profiles').select('*').order('approved').order('name')), stations()]);
    var users = res[0], sts = res[1];
    box.innerHTML = '<div class="card"><h2>People</h2><p class="muted">New accounts wait here. Pick a role, tick Approved, then Save.</p></div><div class="card tbl"><table><thead><tr><th>Person</th><th>Role</th><th>Station</th><th>Approved</th><th>Active</th><th></th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr data-id="' + u.id + '"><td>' + esc(u.name) + '<div class="muted">' + esc(u.email || '') + (u.approved ? '' : ' · wants ' + esc(u.requested_role || u.requested_app || '?')) + '</div></td>' +
          '<td><select data-f="role">' + opts(ROLES, u.role) + '</select></td><td><select data-f="station">' + opts(sts, u.station || '', '—') + '</select></td>' +
          '<td><input type="checkbox" data-f="approved"' + (u.approved ? ' checked' : '') + '></td><td><input type="checkbox" data-f="active"' + (u.active ? ' checked' : '') + '></td>' +
          '<td><button class="btn sm" data-save>Save</button></td></tr>';
      }).join('') + '</tbody></table></div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-save]'); if (!b) return;
      var tr = b.closest('tr'); function g(f) { return $('[data-f=' + f + ']', tr); }
      act(b, async function () {
        await q(sb.from('profiles').update({ role: g('role').value, station: g('station').value || null, approved: g('approved').checked, active: g('active').checked }).eq('id', tr.dataset.id));
        toast('Saved');
      });
    });
  }


  async function vRequest(box) {
    await loadCatalog(true);
    var sts = await stations(), fixed = role() === 'Station Staff' || role() === 'Requester';
    box.innerHTML = '<div class="card"><h2>Request items from the stock room</h2>' +
      (fixed ? '<p class="muted">Sending to: <b>' + esc(S.profile.station || '') + '</b></p>' : '<label>Station</label><select id="rst">' + opts(sts, S.profile.station || '', 'Choose…') + '</select>') +
      '<label>Items</label><div id="lb"></div><label>Note</label><input id="rn"><div style="margin-top:12px"><button class="btn" id="rgo">Send request</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: true });
    $('#rgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var st = $('#rst', box);
        var id = await rpc('create_request', { p_type: 'Transfer', p_station: st ? st.value : (S.profile.station || ''), p_notes: $('#rn', box).value.trim(), p_lines: ls });
        toast('Sent · ' + id); show('req');
      });
    };
  }

  async function vBuyRequest(box) {
    await loadCatalog(true);
    box.innerHTML = '<div class="card"><h2>Request to buy (urgent)</h2><p class="muted">Use this when the stock room itself is short. Procurement will see it right away.</p><label>Items</label><div id="lb"></div><label>Note</label><input id="rn"><div style="margin-top:12px"><button class="btn" id="rgo">Send buy request</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: true });
    $('#rgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var id = await rpc('create_request', { p_type: 'Purchase', p_station: S.profile.station || '', p_notes: $('#rn', box).value.trim(), p_lines: ls });
        toast('Sent · ' + id); show('buyreq');
      });
    };
  }

  /* ---------- hooks for extras.js ---------- */
  window.RB = {
    S: S, sb: sb, OPS: OPS, TABS: TABS, views: {}, esc: esc, fmt: fmt, when: when, $: $, role: role, toast: toast, act: act, rpc: rpc, q: q,
    opts: opts, pill: pill, markDirty: function () { S.catDirty = true; }, lineBuilder: lineBuilder, loadCatalog: loadCatalog, stations: stations, suppliers: suppliers, show: show,
    requestSelect: requestSelect, supOptions: supOptions, UNITS: UNITS, prefill: null, openLines: openLines, unitFor: unitFor, suggested: suggested, current: function () { return cur; }
  };

  /* ---------- start ---------- */
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && S.user) location.reload(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  // start once every script (extras.js) has registered its views
  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (e) { authView(e.message || String(e)); }); });
})();
