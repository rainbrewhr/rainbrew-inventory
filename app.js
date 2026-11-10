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
    receive: { label: 'Receive delivery', roles: OPS, view: vReceive },
    buy: { label: 'Buy list', roles: OPS, view: function (b) { return RB.views.buy(b); } },
    waste: { label: 'Waste', roles: ['Admin', 'Stock Keeper'], view: function (b) { return vWaste(b, null); } },
    count: { label: 'Stock count', roles: ['Admin', 'Stock Keeper'], view: function (b) { return RB.views.count(b); } },
    stock: { label: 'Stock', roles: OPS.concat(['Viewer', 'Station Staff', 'Requester']), view: function (b) { return RB.views.stock(b); } },
    reports: { label: 'Reports', roles: OPS, view: function (b) { return RB.views.reports(b); } },
    items: { label: 'Items', roles: ['Admin'], view: function (b) { return RB.views.items(b); } },
    places: { label: 'Places', roles: ['Admin'], view: vPlaces },
    users: { label: 'People', roles: ['Admin'], view: vUsers },
    history: { label: 'History', roles: OPS, view: function (b) { return RB.views.history(b, false); } },
    req: { label: 'New request', roles: REQUESTERS, view: vRequest },
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
    room: '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    chevr: '<path d="M9 18l6-6-6-6"/>', search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    coffee: '<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v3M10 2v3M14 2v3"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    done: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14l-3-3"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };
  var TAB_ICON = { dash: 'dash', stock: 'stock', release: 'release', receive: 'receive', buy: 'buy', req: 'req', buyreq: 'buyreq', waste: 'waste', count: 'count', reports: 'reports', items: 'items', places: 'places', users: 'users', history: 'history', mine: 'mine', swaste: 'waste' };
  function icon(name, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
  function initials(name) { return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join('') || '?'; }

  // Sidebar pages; each page groups related screens as tabs inside it.
  var PAGES = [
    { id: 'home', label: 'Dashboard', icon: 'dash', tabs: ['dash'] },
    { id: 'stock', label: 'Stock', icon: 'stock', tabs: ['stock'] },
    { id: 'room', label: 'Stock room', icon: 'room', tabs: ['release', 'count', 'waste'] },
    { id: 'buying', label: 'Buying', icon: 'buy', tabs: ['buy', 'receive'] },
    { id: 'requests', label: 'Requests', icon: 'req', tabs: ['req', 'buyreq', 'mine', 'swaste'] },
    { id: 'records', label: 'Records', icon: 'reports', tabs: ['reports', 'history'] },
    { id: 'manage', label: 'Manage', icon: 'items', tabs: ['items', 'places', 'users'] }
  ];
  function pageOf(tab) { return PAGES.filter(function (p) { return p.tabs.indexOf(tab) >= 0; })[0]; }
  var LANDING = { 'Admin': 'dash', 'Stock Keeper': 'release', 'Procurement Officer': 'buy', 'Station Staff': 'req', 'Requester': 'req', 'Viewer': 'dash' };
  var root = document.getElementById('root');
  var S = { user: null, profile: null, items: [], map: new Map(), stations: null, suppliers: null };
  var cur = null, navToken = 0, main = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
  function fmt(n) { return n == null || n === '' ? '' : numFmt.format(Number(n)); }
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
  function setItems(rows) { rows.forEach(function (r) { if (Number(r.current_stock) <= 0) r.status = 'CRITICAL'; }); S.items = rows; S.map = new Map(rows.map(function (r) { return [r.id, r]; })); }
  function takeNav() { var p = S.navParams || {}; S.navParams = null; return p; }
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
    return opts(list.map(function (s) { return { value: s.id, label: s.name }; }), sel, blank) + (canAddSupplier() ? '<option value="__new__">+ Add new supplier…</option>' : '');
  }
  document.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('sup-sel')) e.target.dataset.prev = e.target.value; });
  document.addEventListener('change', async function (e) {
    var el = e.target;
    if (!el.classList || !el.classList.contains('sup-sel') || el.value !== '__new__') return;
    e.stopPropagation();
    var name = ((await askText({ title: 'New supplier', icon: 'truck', label: 'Supplier name', placeholder: 'e.g. CHEFS & BAKERS', required: true, ok: 'Add supplier' })) || '').trim().toUpperCase();
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
      document.body.appendChild(m); decorateButtons(m);
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
    S.drafts = S.drafts || {};
    function save() { if (o.key) S.drafts[o.key] = lines.map(function (l) { return { id: l.item.id, qty: l.qty, reason: l.reason || '' }; }); }
    if (o.key && S.drafts[o.key]) S.drafts[o.key].forEach(function (d) { var it = S.map.get(d.id); if (it) lines.push({ item: it, qty: d.qty, reason: d.reason }); });
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
          '<td><button class="icon-btn" data-rm type="button" aria-label="Remove">' + icon('x') + '</button></td></tr>';
      }).join('');
      empty.classList.toggle('hide', lines.length > 0); save();
    }
    tb.addEventListener('input', function (e) {
      var tr = e.target.closest('tr'); if (!tr || !e.target.dataset.f) return;
      lines[+tr.dataset.i][e.target.dataset.f] = e.target.value; save();
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
        '<button type="button" data-new="1"><span style="display:flex;align-items:center;gap:8px">' + icon('plus', 'sm') + '<b>Add “' + esc(qi.value.trim()) + '” as a new product</b>' + (res.length ? '' : '<span class="muted"> — not in the list yet</span>') + '</span></button>');
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
    qi.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return; e.preventDefault();
      var first = sg.querySelector('button[data-id]'); if (first) first.click();
    });
    draw();
    if (o.autofocus) setTimeout(function () { try { qi.focus({ preventScroll: true }); } catch (x) { qi.focus(); } }, 60);
    return {
      get lines() { return lines.filter(function (l) { return Number(l.qty) > 0; }); },
      set: function (list) { lines.length = 0; list.forEach(function (x) { lines.push(x); }); draw(); },
      clear: function () { lines.length = 0; draw(); },
      reset: function () { lines.length = 0; if (o.key) delete S.drafts[o.key]; draw(); }
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

  /* Back button: each open popup / panel / phone menu owns one history entry, so Back closes it instead of leaving the app. */
  var ovl = [], ovSkip = 0, hashGuard = false;
  function ovOpen(closeFn) {
    var tok = { close: closeFn };
    try { history.pushState({ rbo: 1 }, '', location.href); ovl.push(tok); } catch (e) { /* no history API: Back simply leaves, as before */ }
    return tok;
  }
  function ovRelease(tok) {
    var i = tok ? ovl.indexOf(tok) : -1; if (i < 0) return; // already closed by the Back button
    ovl.splice(i, 1); ovSkip++;
    try { history.back(); } catch (e) { ovSkip--; }
  }
  window.addEventListener('popstate', function () {
    if (ovSkip > 0) { // we closed it ourselves: drop its history entry quietly and keep the URL on the current tab
      ovSkip--; hashGuard = true; setTimeout(function () { hashGuard = false; }, 0);
      try { if (cur && location.hash.slice(1) !== cur) history.replaceState(null, '', '#' + cur); } catch (e) { /* ignore */ }
      return;
    }
    var top = ovl.pop(); if (top) { try { top.close(); } catch (e) { /* ignore */ } }
  });
  /* Swipe a phone sheet down (or the side panel right) to dismiss it. Taps and scrolling are untouched until a real drag starts. */
  function dragDismiss(handle, panel, axis, done) {
    var st = null;
    handle.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || e.target.closest('button,input,select,textarea,a')) return;
      st = { x: e.clientX, y: e.clientY, t: Date.now(), on: false, d: 0 };
    });
    handle.addEventListener('pointermove', function (e) {
      if (!st) return;
      var d = axis === 'y' ? e.clientY - st.y : e.clientX - st.x, o = axis === 'y' ? e.clientX - st.x : e.clientY - st.y;
      if (!st.on) { if (Math.abs(o) > Math.abs(d) || d < 8) { if (Math.abs(o) > 10) st = null; return; } st.on = true; try { handle.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } panel.style.transition = 'none'; }
      st.d = Math.max(0, d); panel.style.transform = axis === 'y' ? 'translateY(' + st.d + 'px)' : 'translateX(' + st.d + 'px)';
    });
    function end() {
      if (!st) return; var s2 = st; st = null; if (!s2.on) return;
      var fast = s2.d / Math.max(1, Date.now() - s2.t) > 0.6;
      panel.style.transition = 'transform .18s ease-out';
      if (s2.d > 90 || fast) { panel.style.transform = axis === 'y' ? 'translateY(110%)' : 'translateX(110%)'; setTimeout(function () { panel.style.transition = ''; panel.style.transform = ''; done(); }, 170); }
      else { panel.style.transform = ''; setTimeout(function () { panel.style.transition = ''; }, 190); }
    }
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }
  var navTok = null;
  function closeDrawer() {
    var side = $('#side'), scrim = $('#scrim');
    if (side) side.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
    if (navTok) { var t = navTok; navTok = null; ovRelease(t); }
  }
  function openDrawer() {
    if (!navTok) navTok = ovOpen(function () { navTok = null; var side = $('#side'), scrim = $('#scrim'); if (side) side.classList.remove('open'); if (scrim) scrim.classList.remove('open'); });
    $('#side').classList.add('open'); $('#scrim').classList.add('open');
    var first = $('#side nav.tabs button.on') || $('#side nav.tabs button'); if (first) first.focus();
  }
  function paintThemeButton() { var b = $('#theme'); if (b) { b.innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon'); b.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'); } }

  function shell(profile) {
    var allowed = APPS[APP].tabs.filter(function (t) { return TABS[t].roles.indexOf(profile.role) >= 0; });
    S.allowed = allowed; S.lastTab = S.lastTab || {};
    var pages = PAGES.filter(function (p) { return p.tabs.some(function (t) { return allowed.indexOf(t) >= 0; }); });
    root.innerHTML = '<div class="shell"><div class="scrim" id="scrim"></div>' +
      '<aside class="side" id="side" aria-label="Navigation"><div class="brandrow">' + logo() + '<div class="brandtxt"><b>' + BRAND + '</b><span>' + esc(profile.role) + '</span></div><button class="icon-btn sclose" id="sclose" aria-label="Close menu">' + icon('x') + '</button></div>' +
      '<nav class="tabs" aria-label="Primary">' + pages.map(function (p) { return '<button data-page="' + p.id + '" title="' + esc(p.label) + '">' + icon(p.icon) + '<span>' + esc(p.label) + '</span><em class="badge hide" data-badge="' + p.id + '"></em></button>'; }).join('') + '</nav>' +
      '<div class="userrow"><span class="avatar" aria-hidden="true">' + esc(initials(profile.name)) + '</span><div class="usertxt"><b>' + esc(profile.name) + '</b><span>' + esc(profile.role) + '</span></div><button class="icon-btn" id="so" aria-label="Sign out" title="Sign out">' + icon('logout') + '</button></div></aside>' +
      '<div class="col"><header class="cmd"><button class="icon-btn menu" id="menu" aria-label="Open menu">' + icon('menu') + '</button><div class="ptitle"><h1 id="ptitle"></h1><p id="psub"></p></div><div class="sp"></div><button class="icon-btn" id="theme"></button></header><div class="subnav" id="subnav" role="tablist"></div><main id="main"></main></div>' +
      (allowed.indexOf('req') >= 0 ? '<div class="fabs" id="fabs"><button class="fab alt" id="fab-buy" aria-label="Request to buy" title="Request to buy">' + icon('buy', 'lg') + '<span>Request to buy</span></button><button class="fab" id="fab-req" aria-label="New stock request" title="New stock request">' + icon('plus', 'lg') + '<span>New request</span></button></div>' : '') + '</div>';
    main = $('#main');
    if ($('#fabs')) { var lastY = window.scrollY, away = false; window.addEventListener('scroll', function () { var y = window.scrollY, d = y - lastY; if (Math.abs(d) < 8) return; var want = d > 0 && y > 120; if (want !== away) { away = want; document.body.classList.toggle('fab-away', away); } lastY = y; }, { passive: true }); }
    if ($('#fabs')) { document.body.classList.add('has-fab'); $('#fab-req').onclick = function () { show('req'); }; $('#fab-buy').onclick = function () { show('buyreq'); }; }
    paintThemeButton();
    $('#so').onclick = async function () { await sb.auth.signOut(); location.reload(); };
    $('#menu').onclick = openDrawer; $('#sclose').onclick = closeDrawer; $('#scrim').onclick = closeDrawer;
    $('#theme').onclick = function () {
      var t = currentTheme() === 'dark' ? 'light' : 'dark'; applyTheme(t);
      try { localStorage.setItem('rb_theme', t); } catch (e) { /* ignore */ }
      paintThemeButton();
    };
    if (!shell.keys) { shell.keys = true; document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); closeItem(); } }); }
    root.querySelectorAll('nav.tabs button').forEach(function (b) {
      b.onclick = function () {
        var pg = PAGES.filter(function (p) { return p.id === b.dataset.page; })[0];
        var ok = pg.tabs.filter(function (t) { return allowed.indexOf(t) >= 0; });
        show(S.lastTab[pg.id] && ok.indexOf(S.lastTab[pg.id]) >= 0 ? S.lastTab[pg.id] : ok[0]);
      };
    });
    function warm() { loadCatalog(true).catch(function () { /* the view will report any real error */ }); }
    root.addEventListener('pointerdown', function (e) { if (e.target.closest('nav.tabs button,#subnav button,.fab')) warm(); }, { passive: true });
    $('#subnav').addEventListener('click', function (e) { var b = e.target.closest('button[data-t]'); if (b) show(b.dataset.t); });
    // Phones: turn every table into a stack of labelled cards; keeps working when a view redraws its rows.
    var pending = false;
    new MutationObserver(function () {
      if (pending) return; pending = true;
      requestAnimationFrame(function () { pending = false; decorateNumbers(main); stackTables(main); decorateButtons(main); });
    }).observe(main, { childList: true, subtree: true });
    window.addEventListener('hashchange', function () {
      var h = location.hash.slice(1);
      if (!hashGuard && h && h !== cur && TABS[h] && allowed.indexOf(h) >= 0) show(h);
    });
    refreshBadges();
    return allowed;
  }

  // Open-request counts on the sidebar so people see where work is waiting.
  var badgeAt = 0;
  async function refreshBadges(force) {
    if (OPS.indexOf(role()) < 0 || (!force && Date.now() - badgeAt < 20000)) return;
    badgeAt = Date.now();
    function cnt(type) { return sb.from('requests').select('id', { count: 'exact', head: true }).eq('type', type).in('status', ['Pending', 'Partial']); }
    try {
      var r = await Promise.all([cnt('Transfer'), cnt('Purchase')]);
      [['room', r[0].count], ['buying', r[1].count]].forEach(function (x) {
        var el = document.querySelector('[data-badge="' + x[0] + '"]'); if (!el) return;
        el.textContent = x[1] || ''; el.classList.toggle('hide', !x[1]);
      });
    } catch (e) { /* badges are optional */ }
  }

  // Guide people with an icon on every action button, chosen from its label.
  var BTN_ICONS = [[/sign out/i, 'logout'], [/print/i, 'print'], [/csv|export/i, 'receive'], [/copy/i, 'copy'], [/reject|delete|remove|clear/i, 'x'], [/release/i, 'release'], [/receive/i, 'receive'], [/count/i, 'count'], [/waste/i, 'waste'],
    [/buy|order/i, 'buy'], [/request|send/i, 'req'], [/add|new|create/i, 'plus'], [/post|record|apply|save|confirm|continue|update|set me up|claim|go$/i, 'check'], [/reload|again|check|done/i, 'done']];
  function decorateButtons(scope) {
    scope.querySelectorAll('button.btn').forEach(function (b) {
      if (b.dataset.deco || b.querySelector('svg')) return; b.dataset.deco = '1';
      var t = b.textContent.trim(); if (!t) return;
      for (var i = 0; i < BTN_ICONS.length; i++) if (BTN_ICONS[i][0].test(t)) { b.insertAdjacentHTML('afterbegin', icon(BTN_ICONS[i][1])); break; }
    });
  }

  function decorateNumbers(scope) {
    scope.querySelectorAll('input[type=number]:not([data-ns])').forEach(function (inp) {
      inp.setAttribute('data-ns', '1');
      if (inp.hasAttribute('data-nostep') || !inp.parentNode) return;
      var w = document.createElement('span'); w.className = 'numstep';
      var mk = function (dir) { var b = document.createElement('button'); b.type = 'button'; b.tabIndex = -1; b.className = 'ns-b'; b.setAttribute('aria-label', dir < 0 ? 'Minus' : 'Plus'); b.innerHTML = icon(dir < 0 ? 'minus' : 'plus', 'sm'); b.dataset.d = dir; return b; };
      inp.parentNode.insertBefore(w, inp); w.appendChild(mk(-1)); w.appendChild(inp); w.appendChild(mk(1));
      inp.style.width = '';
      w.addEventListener('click', function (e) {
        var b = e.target.closest('.ns-b'); if (!b || inp.disabled) return;
        var step = parseFloat(inp.dataset.step || inp.getAttribute('step')); if (!(step > 0)) step = 1;
        var min = inp.min !== '' ? Number(inp.min) : -Infinity, max = inp.max !== '' ? Number(inp.max) : Infinity;
        var v = Math.round(((parseFloat(inp.value) || 0) + step * Number(b.dataset.d)) * 1000) / 1000;
        inp.value = String(Math.min(max, Math.max(min, v)));
        inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
      });
      inp.addEventListener('wheel', function () { if (document.activeElement === inp) inp.blur(); }, { passive: true });
      inp.addEventListener('keydown', function (e) { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); });
    });
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

  var SK_ROWS = function (n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="sk-row"><i class="sk"></i><b class="sk"></b><u class="sk"></u></div>'; return h; };
  var SKELETONS = {
    dash: '<div class="sk sk-title"></div><div class="sk sk-sub"></div><div class="sk-kpis"><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div><div class="sk sk-kpi"></div></div><div class="sk-two"><div class="sk sk-card"></div><div class="sk sk-card"></div></div>',
    table: '<div class="sk sk-filters"></div><div class="sk-rows">' + SK_ROWS(7) + '</div>',
    form: '<div class="sk sk-form"></div>'
  };
  var SK_KIND = { dash: 'dash', req: 'form', buyreq: 'form', waste: 'form', swaste: 'form', receive: 'form', reports: 'form' };
  function skeletonFor(tab) { return SKELETONS[SK_KIND[tab] || 'table']; }
  var dateFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric' });
  function paintNav(tab) {
    var pg = pageOf(tab);
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('on', !!pg && b.dataset.page === pg.id); });
    var tabs = pg ? pg.tabs.filter(function (t) { return S.allowed.indexOf(t) >= 0; }) : [];
    $('#subnav').innerHTML = tabs.length > 1 ? tabs.map(function (t) { return '<button role="tab" data-t="' + t + '" class="' + (t === tab ? 'on' : '') + '" aria-selected="' + (t === tab) + '">' + icon(TAB_ICON[t] || 'dash') + esc(TABS[t].label) + '</button>'; }).join('') : '';
    $('#ptitle').textContent = pg ? pg.label : TABS[tab].label;
    $('#psub').textContent = tabs.length > 1 ? '' : dateFmt.format(new Date());
    document.title = TABS[tab].label + ' · ' + BRAND;
    if ($('#fabs')) { $('#fab-req').classList.toggle('cur', tab === 'req'); $('#fab-buy').classList.toggle('cur', tab === 'buyreq'); $('#fab-req').setAttribute('aria-current', tab === 'req' ? 'page' : 'false'); $('#fab-buy').setAttribute('aria-current', tab === 'buyreq' ? 'page' : 'false'); }
  }
  async function show(tab, params) {
    var changed = tab !== cur;
    var keepY = changed ? 0 : window.scrollY || 0;
    cur = tab;
    var t = ++navToken;
    S.navParams = params || null;
    var pg = pageOf(tab); if (pg) S.lastTab[pg.id] = tab;
    // Answer the tap straight away: highlight, retitle, close the phone menu and show a loading state.
    paintNav(tab);
    try { if (location.hash.slice(1) !== tab) history.replaceState(null, '', '#' + tab); } catch (e) { /* ignore */ }
    closeDrawer();
    main.setAttribute('aria-busy', 'true');
    if (changed) { main.innerHTML = skeletonFor(tab); window.scrollTo(0, 0); } else { main.classList.add('loading'); } // refresh: keep what is on screen, dim it, keep the scroll position
    var box = document.createElement('div');
    try { await TABS[tab].view(box); }
    catch (e) { box.innerHTML = '<div class="card">' + emptyState('alert', navigator.onLine === false ? 'You are offline' : 'This page could not load', navigator.onLine === false ? 'Reconnect to the internet, then try again. Nothing you did was lost.' : String(e.message || e), '<button class="btn alt" data-retry style="margin-top:14px">Try again</button>') + '</div>'; var rt = box.querySelector('[data-retry]'); if (rt) rt.onclick = function () { show(tab); }; }
    if (t !== navToken) return;
        main.replaceChildren(box);
    main.classList.remove('loading'); main.removeAttribute('aria-busy');
    if (!changed) window.scrollTo(0, keepY);
    refreshBadges(!changed);
  }

  /* ---------- popups (replace the browser's prompt / confirm) ---------- */
  function popup(o) {
    var before = document.activeElement;
    return new Promise(function (resolve) {
      var m = document.createElement('div'); m.className = 'modal';
      m.innerHTML = '<div class="card sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="sh">' +
        (o.icon ? '<span class="big-ico ico ' + (o.tone || '') + '">' + icon(o.icon) + '</span>' : '') + '<h2>' + esc(o.title) + '</h2><button class="icon-btn" data-x aria-label="Close">' + icon('x') + '</button></div>' +
        '<div class="sb">' + (o.body || '') + '<p class="muted" data-err style="color:var(--crit);margin:10px 0 0" role="alert"></p></div>' +
        '<div class="sf">' + (o.actions || []).map(function (a, i) { return '<button class="btn ' + (a.kind || '') + '" data-a="' + i + '">' + (a.icon ? icon(a.icon) : '') + esc(a.label) + '</button>'; }).join('') + '</div></div>';
      document.body.appendChild(m); decorateNumbers(m);
      var tok = ovOpen(function () { close(null); });
      function close(v) { document.removeEventListener('keydown', onKey); ovRelease(tok); m.remove(); if (before && before.focus) before.focus(); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } }
      document.addEventListener('keydown', onKey);
      m.addEventListener('mousedown', function (e) { if (e.target === m && !o.persistent) close(null); });
      $('[data-x]', m).onclick = function () { close(null); };
      if (!o.persistent) dragDismiss($('.sh', m), $('.sheet', m), 'y', function () { close(null); });
      m.querySelectorAll('[data-a]').forEach(function (btn) {
        btn.onclick = async function () {
          var a = o.actions[+btn.dataset.a], err = $('[data-err]', m); err.textContent = '';
          if (!a.run) return close(a.value);
          var all = m.querySelectorAll('[data-a]'); all.forEach(function (x) { x.disabled = true; });
          try { var v = await a.run(m); close(v === undefined ? true : v); }
          catch (e) { err.textContent = e.message || String(e); all.forEach(function (x) { x.disabled = false; }); }
        };
      });
      var first = m.querySelector('input,select,textarea') || m.querySelector('[data-a]:last-child'); if (first) setTimeout(function () { first.focus(); }, 40);
      m.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { var go = m.querySelector('[data-a].primary-go'); if (go) go.click(); } });
    });
  }
  function confirmBox(message, o) {
    o = o || {};
    return popup({ title: o.title || 'Are you sure?', icon: o.icon || (o.danger ? 'alert' : 'info'), tone: o.danger ? 'crit' : 'accent', body: '<p style="margin:6px 0 0">' + esc(message) + '</p>',
      actions: [{ label: 'Cancel', kind: 'alt', value: false }, { label: o.ok || 'Confirm', kind: (o.danger ? 'bad' : '') + ' primary-go', value: true }] }).then(function (v) { return v === true; });
  }
  function askText(o) {
    return popup({ title: o.title, icon: o.icon || 'edit', tone: 'accent', body: '<label>' + esc(o.label || '') + '</label>' + (o.multiline ? '<textarea id="ask" rows="3" placeholder="' + esc(o.placeholder || '') + '"></textarea>' : '<input id="ask" placeholder="' + esc(o.placeholder || '') + '" value="' + esc(o.value || '') + '">'),
      actions: [{ label: 'Cancel', kind: 'alt', value: null }, { label: o.ok || 'Save', kind: 'primary-go', run: function (m) { var v = $('#ask', m).value.trim(); if (o.required && !v) throw new Error('This is required'); return v; } }] });
  }
  function copyBox(text) {
    return popup({ title: 'Copy this list', icon: 'copy', tone: 'accent', body: '<textarea id="cp" rows="8" readonly>' + esc(text) + '</textarea>', actions: [{ label: 'Done', kind: 'alt', value: null }, { label: 'Copy', icon: 'copy', run: function (m) { var t = $('#cp', m); t.select(); try { document.execCommand('copy'); } catch (e) { /* manual copy */ } return true; } }] });
  }
  function emptyState(ic, title, text, action) {
    return '<div class="empty"><div class="art">' + icon(ic, 'lg') + '</div><b>' + esc(title) + '</b><p>' + esc(text || '') + '</p>' + (action || '') + '</div>';
  }

  /* ---------- item inspector (side panel) ---------- */
  var drawerEl = null, drawerId = null, drawerTok = null, drawerDrag = false;
  function ensureDrawer() {
    if (drawerEl) return;
    var sc = document.createElement('div'); sc.className = 'dscrim'; sc.id = 'dscrim'; sc.onclick = closeItem;
    drawerEl = document.createElement('aside'); drawerEl.className = 'drawer'; drawerEl.setAttribute('role', 'dialog'); drawerEl.setAttribute('aria-modal', 'true'); drawerEl.setAttribute('aria-label', 'Item details');
    document.body.appendChild(sc); document.body.appendChild(drawerEl);
    drawerEl.addEventListener('transitionend', function () { /* keep inline drag styles clean */ });
  }
  function closeItem() {
    if (!drawerEl) return;
    drawerEl.classList.remove('open'); $('#dscrim').classList.remove('open'); drawerId = null;
    if (drawerTok) { var t = drawerTok; drawerTok = null; ovRelease(t); }
  }
  var MOVE = { RECEIVE: ['receive', 'in', 'Received'], RELEASE: ['release', 'out', 'Released'], ADJUST: ['sliders', 'out', 'Adjusted'], WASTE: ['waste', 'out', 'Waste'], OPENING: ['stock', 'in', 'Opening balance'] };
  function statusTone(st) { return st === 'CRITICAL' ? 'crit' : st === 'LOW' ? 'warn' : 'ok'; }
  async function openItem(id) {
    var it = S.map.get(id); if (!it) return;
    ensureDrawer(); drawerId = id;
    if (!drawerTok) drawerTok = ovOpen(function () { drawerTok = null; if (drawerEl) { drawerEl.classList.remove('open'); $('#dscrim').classList.remove('open'); } drawerId = null; });
    var ops = OPS.indexOf(role()) >= 0, canAdjust = role() === 'Admin' || role() === 'Stock Keeper';
    var sm = {}; try { (await suppliers()).forEach(function (x) { sm[x.id] = x.name; }); } catch (e) { /* names are optional */ }
    var alts = [it.alt_supplier_1_id, it.alt_supplier_2_id].map(function (x) { return sm[x]; }).filter(Boolean);
    var full = it.par_target || (it.reorder_point ? it.reorder_point * 2 : 0), pct = full ? Math.max(0, Math.min(100, Number(it.current_stock) / full * 100)) : 0;
    var tone = statusTone(it.status);
    function tags(list) { return (list && list.length) ? '<div class="tags">' + list.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join('') + '</div>' : '<span class="muted">—</span>'; }
    drawerEl.innerHTML = '<div class="dh"><span class="ico ' + tone + '">' + icon('stock', 'lg') + '</span><div style="flex:1;min-width:0"><h2>' + esc(it.name) + '</h2><div class="row" style="gap:8px">' + pill(it.status) + '<span class="muted">' + esc(it.category || 'Uncategorised') + '</span></div></div><button class="icon-btn" id="dx" aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="db"><div class="statgrid"><div class="stat"><span>On hand</span><b style="color:var(--' + (tone === 'ok' ? 'text' : tone === 'warn' ? 'warn' : 'crit') + ')">' + fmt(it.current_stock) + '<small>' + esc(it.unit || '') + '</small></b></div>' +
      '<div class="stat"><span>Reorder at</span><b>' + (it.reorder_point != null ? fmt(it.reorder_point) : '—') + '</b></div><div class="stat"><span>Critical at</span><b>' + (it.critical_level != null ? fmt(it.critical_level) : '—') + '</b></div><div class="stat"><span>Target (PAR)</span><b>' + (it.par_target != null ? fmt(it.par_target) : '—') + '</b></div></div>' +
      (full ? '<div class="level" style="margin:-4px 0 18px" title="' + Math.round(pct) + '% of target"><i style="width:' + pct + '%;background:var(--' + (tone === 'ok' ? 'ok' : tone) + ')"></i></div>' : '<p class="muted" style="margin:-6px 0 16px">' + icon('info', 'sm') + ' No reorder level set yet' + (role() === 'Admin' ? ' — set one in Manage › Items.' : '.') + '</p>') +
      '<dl class="kv"><dt>Stocked at</dt><dd>' + tags(it.stocked_at) + '</dd><dt>Used by</dt><dd>' + tags(it.used_by) + '</dd><dt>Supplier</dt><dd>' + esc(sm[it.supplier_id] || '—') + '</dd>' + (alts.length ? '<dt>Alternatives</dt><dd>' + esc(alts.join(', ')) + '</dd>' : '') + (it.lead_time_days ? '<dt>Lead time</dt><dd>' + it.lead_time_days + ' days</dd>' : '') + (it.notes ? '<dt>Notes</dt><dd style="font-weight:500">' + esc(it.notes) + '</dd>' : '') + '</dl>' +
      (ops ? '<div class="section" style="margin-top:6px">Recent movements</div><ul class="tl" id="dtl"><li><div class="skeleton" style="width:100%"></div></li></ul>' : '') + '</div>' +
      '<div class="df">' + (canAdjust ? '<button class="btn" id="dadj">' + icon('sliders') + 'Adjust stock</button>' : '') + (REQUESTERS.indexOf(role()) >= 0 ? '<button class="btn ' + (canAdjust ? 'alt' : '') + '" id="dreq">' + icon('req') + 'Request this</button>' : '') + (role() === 'Admin' ? '<button class="btn alt" id="dedit">' + icon('edit') + 'Edit</button>' : '') + '</div>';
    decorateButtons(drawerEl);
    $('#dx', drawerEl).onclick = closeItem;
    dragDismiss($('.dh', drawerEl), drawerEl, 'x', closeItem);
    var adj = $('#dadj', drawerEl); if (adj) adj.onclick = function () { adjustDialog(it); };
    var rq = $('#dreq', drawerEl); if (rq) rq.onclick = function () { closeItem(); show('req', { addItem: it.id }); };
    var ed = $('#dedit', drawerEl); if (ed) ed.onclick = function () { closeItem(); show('items', { q: it.name }); };
    requestAnimationFrame(function () { drawerEl.classList.add('open'); $('#dscrim').classList.add('open'); });
    if (!ops) return;
    try {
      var mv = await q(sb.from('stock_movements').select('id,ts,type,signed_qty,reference,station,supplier,user_name,note').eq('item_id', id).order('ts', { ascending: false }).order('id', { ascending: false }).limit(25));
      if (drawerId !== id) return;
      $('#dtl', drawerEl).innerHTML = mv.length ? mv.map(function (m) {
        var k = MOVE[m.type] || ['sliders', 'out', m.type], why = m.type === 'RELEASE' ? 'to ' + (m.station || '') : m.type === 'RECEIVE' ? (m.supplier ? 'from ' + m.supplier : '') : (m.note || '');
        return '<li><span class="dot ' + k[1] + '">' + icon(k[0], 'sm') + '</span><div class="tx"><b>' + k[2] + '</b> <span style="display:inline">' + esc(why) + '</span><span>' + esc(when(m.ts)) + ' · ' + esc(m.user_name || '') + (m.reference ? ' · ' + esc(m.reference) : '') + '</span></div><span class="q ' + (m.signed_qty > 0 ? 'pos' : 'neg') + '">' + (m.signed_qty > 0 ? '+' : '−') + fmt(Math.abs(m.signed_qty)) + '</span></li>';
      }).join('') : '<li><span class="muted">No movements yet.</span></li>';
    } catch (e) { var tl = $('#dtl', drawerEl); if (tl) tl.innerHTML = '<li><span class="muted">' + esc(e.message) + '</span></li>'; }
  }
  var REASONS = ['Received delivery', 'Stock count correction', 'Damaged / waste', 'Returned to stock', 'Transfer out', 'Other'];
  function adjustDialog(it) {
    popup({ title: 'Adjust stock', icon: 'sliders', tone: 'accent',
      body: '<p class="muted" style="margin:0 0 4px"><b style="color:var(--text)">' + esc(it.name) + '</b> · on hand <span class="mono">' + fmt(it.current_stock) + '</span> ' + esc(it.unit || '') + '</p>' +
        '<label>Add or remove</label><div class="stepper"><button type="button" class="btn alt" data-st="-1" aria-label="Minus one">' + icon('minus') + '</button><input id="ad-q" data-nostep="1" type="number" step="any" inputmode="decimal" placeholder="0"><button type="button" class="btn alt" data-st="1" aria-label="Plus one">' + icon('plus') + '</button></div>' +
        '<div class="quick">' + [-10, -5, -1, 1, 5, 10].map(function (n) { return '<button type="button" class="btn alt" data-st="' + n + '">' + (n > 0 ? '+' : '−') + Math.abs(n) + '</button>'; }).join('') + '</div>' +
        '<p class="muted" id="ad-prev" style="margin:10px 0 0"></p><label>Reason</label><select id="ad-r"><option value="">Choose a reason…</option>' + REASONS.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select><label>Note (optional)</label><input id="ad-n" placeholder="Invoice no., what happened…">',
      actions: [{ label: 'Cancel', kind: 'alt', value: null }, { label: 'Apply', icon: 'check', kind: 'primary-go', run: async function (m) {
        var d = Number($('#ad-q', m).value), r = $('#ad-r', m).value;
        if (!d) throw new Error('Enter a quantity to add or remove.'); if (!r) throw new Error('Choose a reason.');
        if (Number(it.current_stock) + d < 0) throw new Error('That would take stock below zero.');
        await rpc('adjust_stock', { p_item_ids: [it.id], p_delta: d, p_reason: r, p_note: $('#ad-n', m).value.trim() || null });
        it.current_stock = Number(it.current_stock) + d; toast(it.name + ' updated'); openItem(it.id); // server confirmed: show the new balance now
        loadCatalog(true).then(function () { show(cur); }, function () { show(cur); }); return true;
      } }] }).then(function () { /* closed */ });
    setTimeout(function () {
      var m = document.querySelector('.modal'); if (!m) return;
      var inp = $('#ad-q', m), prev = $('#ad-prev', m);
      function upd() { var d = Number(inp.value) || 0; prev.innerHTML = d ? 'New balance: <b class="mono" style="color:var(--text)">' + fmt(Number(it.current_stock) + d) + '</b> ' + esc(it.unit || '') : ''; }
      inp.addEventListener('input', upd);
      m.addEventListener('click', function (e) { var b = e.target.closest('[data-st]'); if (b) { inp.value = Math.round(((Number(inp.value) || 0) + Number(b.dataset.st)) * 1000) / 1000; upd(); } });
    }, 0);
  }

  /* ---------- views ---------- */
  async function vDash(box) {
    await loadCatalog();
    var items = S.items.filter(function (i) { return i.active; });
    var counts = { OK: 0, LOW: 0, CRITICAL: 0 };
    items.forEach(function (i) { counts[i.status === 'LOW' ? 'LOW' : i.status === 'CRITICAL' ? 'CRITICAL' : 'OK'] += 1; });
    var need = items.filter(function (i) { return i.status === 'CRITICAL' || i.status === 'LOW'; }).sort(function (a, b) { return (a.status === 'CRITICAL' ? 0 : 1) - (b.status === 'CRITICAL' ? 0 : 1) || Number(a.current_stock) - Number(b.current_stock); });
    var ops = OPS.indexOf(role()) >= 0;
    var since = new Date(Date.now() - 13 * 864e5).toISOString();
    function cnt(type) { return sb.from('requests').select('id', { count: 'exact', head: true }).eq('type', type).in('status', ['Pending', 'Partial']); }
    var res = await Promise.all([ops ? cnt('Transfer') : null, ops ? cnt('Purchase') : null,
      sb.from('stock_movements').select('ts,type').in('type', ['RECEIVE', 'RELEASE']).gte('ts', since).limit(4000),
      sb.from('stock_movements').select('id,ts,type,signed_qty,reference,item_id,items(name,unit)').order('ts', { ascending: false }).limit(7)]);
    var openT = res[0] ? res[0].count || 0 : 0, openP = res[1] ? res[1].count || 0 : 0, recent = res[3].data || [];
    // activity chart: lines received vs released per day (Manila time)
    var dayKey = function (d) { return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); };
    var days = []; for (var d = 13; d >= 0; d--) days.push(dayKey(Date.now() - d * 864e5));
    var by = {}; days.forEach(function (k) { by[k] = { in: 0, out: 0 }; });
    (res[2].data || []).forEach(function (m) { var k = dayKey(m.ts); if (by[k]) by[k][m.type === 'RECEIVE' ? 'in' : 'out'] += 1; });
    var peak = Math.max.apply(null, days.map(function (k) { return Math.max(by[k].in, by[k].out); }).concat([1]));
    var dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    // donut
    var C = 2 * Math.PI * 54, total = items.length || 1, off = 0;
    var segs = [['OK', 'Optimal', 'var(--ok)'], ['LOW', 'Low', 'var(--warn)'], ['CRITICAL', 'Critical / out', 'var(--crit)']].map(function (x) {
      var len = counts[x[0]] / total * C, el = counts[x[0]] ? '<circle class="seg" data-st="' + x[0] + '" cx="74" cy="74" r="54" fill="none" stroke="' + x[2] + '" stroke-width="16" stroke-dasharray="' + Math.max(len - 2, 0) + ' ' + C + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 74 74)"><title>' + x[1] + ': ' + counts[x[0]] + '</title></circle>' : '';
      off += len; return el;
    }).join('');
    // risk by category
    var cats = {}; items.forEach(function (i) { var c = i.category || 'Uncategorised'; (cats[c] = cats[c] || { n: 0, LOW: 0, CRITICAL: 0 }).n += 1; if (i.status === 'LOW' || i.status === 'CRITICAL') cats[c][i.status] += 1; });
    var catRows = Object.keys(cats).map(function (c) { return [c, cats[c]]; }).sort(function (a, b) { return (b[1].CRITICAL * 2 + b[1].LOW) - (a[1].CRITICAL * 2 + a[1].LOW) || b[1].n - a[1].n; }).slice(0, 6);
    var hr = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', hour12: false }) * 1, greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    var first = String(S.profile.name || '').split(' ')[0];
    var go = function (tab, label, ic, kind) { return TABS[tab].roles.indexOf(role()) >= 0 ? '<button class="btn ' + (kind || 'alt') + '" data-go="' + tab + '">' + icon(ic) + label + '</button>' : ''; };
    function kpi(ico, tone, n, label, attrs) { return '<button class="card kpi s3 t-' + (Number(n) > 0 ? tone : 'none') + '" ' + attrs + '><span class="ico ' + tone + '">' + icon(ico, 'lg') + '</span><span><b>' + n + '</b><span class="l">' + label + '</span></span>' + icon('chevr', 'go') + '</button>'; }
    box.innerHTML = '<div class="hello"><div><h2>' + greet + ', <em>' + esc(first) + '</em></h2><p>' + items.length + ' items tracked · ' + (counts.CRITICAL + counts.LOW ? '<b style="color:var(--text)">' + (counts.CRITICAL + counts.LOW) + ' need attention</b>' : 'everything is stocked') + '</p></div><div class="row">' + go('release', 'Release requests', 'release', 'accent') + go('receive', 'Receive delivery', 'receive') + go('count', 'Stock count', 'count') + '</div></div>' +
      '<div class="dash">' +
      kpi('alert', 'crit', counts.CRITICAL, 'Critical or out of stock', 'data-stock="CRITICAL"') + kpi('alert', 'warn', counts.LOW, 'Running low', 'data-stock="LOW"') +
      (ops ? kpi('release', 'accent', openT, 'Station requests waiting', 'data-go="release"') + kpi('buy', 'teal', openP, 'Buy requests open', 'data-go="buy"') : kpi('done', 'ok', counts.OK, 'Items in good supply', 'data-stock="OK"') + kpi('stock', 'teal', items.length, 'Items tracked', 'data-go="stock"')) +
      '<div class="card s4"><div class="card-head"><h2>Stock health</h2></div><div class="donut"><svg viewBox="0 0 148 148" role="img" aria-label="Stock health"><circle cx="74" cy="74" r="54" fill="none" stroke="var(--panel2)" stroke-width="16"/>' + segs + '<text class="mid" x="74" y="76" text-anchor="middle">' + items.length + '</text><text class="sub" x="74" y="92" text-anchor="middle">items</text></svg><div class="legend">' +
      [['OK', 'Optimal', 'var(--ok)'], ['LOW', 'Low stock', 'var(--warn)'], ['CRITICAL', 'Critical / out', 'var(--crit)']].map(function (x) { return '<button data-stock="' + x[0] + '"><i style="background:' + x[2] + '"></i>' + x[1] + '<b>' + counts[x[0]] + '</b></button>'; }).join('') + '</div></div></div>' +
      '<div class="card s8"><div class="card-head"><h2>Activity · last 14 days</h2></div><div class="bars" role="img" aria-label="Received and released lines per day">' +
      days.map(function (k) { var v = by[k]; return '<div class="col2" title="' + k + ': ' + v.in + ' received, ' + v.out + ' released"><div class="stack2"><span class="bar in" style="height:' + (v.in / peak * 100) + '%"></span><span class="bar out" style="height:' + (v.out / peak * 100) + '%"></span></div><small>' + dow[new Date(k + 'T12:00:00+08:00').getDay()] + '</small></div>'; }).join('') +
      '</div><div class="chart-legend"><span><i style="background:var(--teal)"></i>Received</span><span><i style="background:var(--accent)"></i>Released</span></div></div>' +
      '<div class="card s7"><div class="card-head"><h2>Needs attention</h2>' + (need.length > 6 ? '<button class="btn ghost sm" data-stock="CRITICAL">View all ' + need.length + icon('chevr', 'sm') + '</button>' : '') + '</div>' +
      (need.length ? '<ul class="list">' + need.slice(0, 6).map(function (i) { return '<li data-item="' + i.id + '"><span class="ico ' + statusTone(i.status) + '">' + icon('stock') + '</span><span class="t"><b>' + esc(i.name) + '</b><span>' + esc((i.stocked_at || []).join(' / ') || i.category || '') + '</span></span><span class="r">' + fmt(i.current_stock) + ' <span class="muted">' + esc(i.unit || '') + '</span></span>' + pill(i.status) + '</li>'; }).join('') + '</ul>' : emptyState('done', 'All stocked up', 'Nothing is running low right now.')) + '</div>' +
      '<div class="card s5"><div class="card-head"><h2>Where the risk is</h2></div><div class="hbars">' + (catRows.length ? catRows.map(function (c) { var n = c[1].n || 1, ok = n - c[1].LOW - c[1].CRITICAL; return '<div class="hbar" data-cat="' + esc(c[0]) + '"><span class="n">' + esc(c[0]) + '</span><span class="v">' + (c[1].LOW + c[1].CRITICAL) + ' / ' + c[1].n + '</span><span class="track"><i style="width:' + c[1].CRITICAL / n * 100 + '%;background:var(--crit)"></i><i style="width:' + c[1].LOW / n * 100 + '%;background:var(--warn)"></i><i style="width:' + ok / n * 100 + '%;background:var(--okbg)"></i></span></div>'; }).join('') : '<p class="muted">No items yet.</p>') + '</div></div>' +
      '<div class="card s12"><div class="card-head"><h2>Latest activity</h2>' + (ops ? '<button class="btn ghost sm" data-go="history">History' + icon('chevr', 'sm') + '</button>' : '') + '</div>' +
      (recent.length ? '<ul class="list">' + recent.map(function (m) { var k = MOVE[m.type] || ['sliders', 'out', m.type]; return '<li data-item="' + m.item_id + '"><span class="ico ' + (k[1] === 'in' ? 'teal' : 'accent') + '">' + icon(k[0]) + '</span><span class="t"><b>' + esc(m.items ? m.items.name : '') + '</b><span>' + k[2] + ' · ' + esc(when(m.ts)) + (m.reference ? ' · ' + esc(m.reference) : '') + '</span></span><span class="r" style="color:var(--' + (m.signed_qty > 0 ? 'ok' : 'crit') + ')">' + (m.signed_qty > 0 ? '+' : '−') + fmt(Math.abs(m.signed_qty)) + '</span></li>'; }).join('') + '</ul>' : emptyState('coffee', 'No activity yet', 'Releases, deliveries and counts will show up here.')) + '</div></div>';
    box.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]'); if (g) return show(g.dataset.go);
      var st = e.target.closest('[data-stock]'); if (st) return show('stock', { status: st.dataset.stock });
      var ct = e.target.closest('[data-cat]'); if (ct) return show('stock', { cat: ct.dataset.cat });
      var it = e.target.closest('[data-item]'); if (it) return openItem(it.dataset.item);
      var sg = e.target.closest('circle[data-st]'); if (sg) return show('stock', { status: sg.dataset.st });
    });
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
    var lb = lineBuilder($('#lb', box), { stock: true, key: 'receive' });
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
        var got = ls.map(function (x) { return x.item_id; }); lb.reset(); toast('Received · ' + id); if (window.RB.afterReceive) window.RB.afterReceive(got); await loadCatalog(true); show('receive');
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
    var lb = lineBuilder($('#lb', box), { stock: !fixedKind, reason: true, noNew: true, key: 'waste' + (fixedKind || '') });
    var wk = $('#wk', box);
    if (wk) wk.onchange = function () { $('#wst', box).classList.toggle('hide', wk.value !== 'station'); };
    $('#wgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var kind = fixedKind || wk.value;
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty, reason: l.reason || '' }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var ws = $('#ws', box);
        var id = await rpc('log_waste', { p_kind: kind, p_station: ws ? ws.value : (S.profile.station || ''), p_note: $('#wn', box).value.trim(), p_lines: ls });
        lb.reset(); toast('Recorded · ' + id); await loadCatalog(true); show(cur);
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
    var lb = lineBuilder($('#lb', box), { stock: true, key: 'req', autofocus: true });
    var np = takeNav(); if (np.addItem && S.map.get(np.addItem)) lb.set([{ item: S.map.get(np.addItem), qty: '' }]);
    $('#rgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var st = $('#rst', box);
        var id = await rpc('create_request', { p_type: 'Transfer', p_station: st ? st.value : (S.profile.station || ''), p_notes: $('#rn', box).value.trim(), p_lines: ls });
        lb.reset(); toast('Sent · ' + id); show('req');
      });
    };
  }

  async function vBuyRequest(box) {
    await loadCatalog(true);
    box.innerHTML = '<div class="card"><h2>Request to buy (urgent)</h2><p class="muted">Use this when the stock room itself is short. Procurement will see it right away.</p><label>Items</label><div id="lb"></div><label>Note</label><input id="rn"><div style="margin-top:12px"><button class="btn" id="rgo">Send buy request</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: true, key: 'buyreq', autofocus: true });
    $('#rgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = lb.lines.map(function (l) { return { item_id: l.item.id, qty: +l.qty }; });
        if (!ls.length) throw new Error('Add items with a quantity');
        var id = await rpc('create_request', { p_type: 'Purchase', p_station: S.profile.station || '', p_notes: $('#rn', box).value.trim(), p_lines: ls });
        lb.reset(); toast('Sent · ' + id); show('buyreq');
      });
    };
  }

  /* ---------- hooks for extras.js ---------- */
  window.RB = {
    S: S, sb: sb, OPS: OPS, TABS: TABS, views: {}, esc: esc, fmt: fmt, when: when, $: $, role: role, toast: toast, act: act, rpc: rpc, q: q,
    opts: opts, pill: pill, icon: icon, ui: { popup: popup, confirm: confirmBox, ask: askText, copy: copyBox, empty: emptyState }, openItem: openItem, takeNav: takeNav, allowed: function () { return S.allowed; }, current: function () { return cur; }, TAB_ICON: TAB_ICON, markDirty: function () { S.catDirty = true; }, lineBuilder: lineBuilder, loadCatalog: loadCatalog, stations: stations, suppliers: suppliers, show: show,
    requestSelect: requestSelect, supOptions: supOptions, UNITS: UNITS, prefill: null, openLines: openLines, unitFor: unitFor, suggested: suggested, current: function () { return cur; }
  };

  /* ---------- start ---------- */
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && S.user) location.reload(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  // start once every script (extras.js) has registered its views
  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (e) { authView(e.message || String(e)); }); });
})();
