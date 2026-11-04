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
  async function rpc(name, args) {
    var r = await sb.rpc(name, args || {});
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function q(promise) {
    var r = await promise;
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  function setItems(rows) { S.items = rows; S.map = new Map(rows.map(function (r) { return [r.id, r]; })); }
  async function loadCatalog(force) {
    if (!force && S.items.length) return;
    var rows = await rpc('catalog');
    setItems(rows);
    try { localStorage.setItem('rb_cat_' + S.user.id, JSON.stringify(rows)); } catch (e) { /* storage unavailable */ }
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
      '<label>Email</label><input id="ae" type="email" required autocomplete="email">' +
      '<label>Password</label><input id="ap" type="password" required minlength="8" autocomplete="current-password">' +
      '<p id="am" class="muted">' + esc(msg || '') + '</p><button class="btn" style="width:100%" id="as">Sign in</button></form>' +
      '<p class="muted" id="ah"></p></div></div>';
    var seg = root.querySelectorAll('.seg button');
    function setMode(m) {
      mode = m;
      seg.forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
      $('#nm').classList.toggle('hide', m === 'in');
      $('#as').textContent = m === 'in' ? 'Sign in' : 'Create account';
      $('#ap').autocomplete = m === 'in' ? 'current-password' : 'new-password';
      $('#ah').textContent = m === 'up' ? (APP === 'request' ? 'You can start sending requests right after you sign in.' : 'An admin must approve new accounts before they can use this app.') : '';
    }
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
        var u = await sb.auth.signUp({ email: email, password: pw, options: { data: { name: name, app: APP } } });
        if (u.error) throw new Error(u.error.message);
        if (u.data.session) return boot();
        setMode('in');
        $('#am').textContent = 'Account created. Check your email to confirm it, then sign in.';
      });
    };
  }

  function shell(profile) {
    var allowed = APPS[APP].tabs.filter(function (t) { return TABS[t].roles.indexOf(profile.role) >= 0; });
    root.innerHTML = '<header class="top">' + logo() + '<h1>' + BRAND + '<small>' + esc(APPS[APP].title) + '</small></h1><div class="who">' + esc(profile.name) + '<br>' + esc(profile.role) + '</div><button id="so">Sign out</button></header>' +
      '<nav class="tabs">' + allowed.map(function (t) { return '<button data-t="' + t + '">' + esc(TABS[t].label) + '</button>'; }).join('') + '</nav><main id="main"></main>';
    main = $('#main');
    $('#so').onclick = async function () { await sb.auth.signOut(); location.reload(); };
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.onclick = function () { show(b.dataset.t); }; });
    return allowed;
  }

  function simpleCard(title, html) {
    root.innerHTML = '<div class="auth">' + logo() + '<h1>' + BRAND + '<small>' + esc(APPS[APP].title) + '</small></h1><div class="card"><h2>' + esc(title) + '</h2>' + html + '</div></div>';
  }

  function pendingView(p) {
    var canClaim = APP === 'admin' && p.requested_app === 'admin';
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
    if (APP === 'request' && !S.profile.station && (S.profile.role === 'Requester' || S.profile.role === 'Station Staff')) return stationPicker();
    var allowed = shell(S.profile);
    if (!allowed.length) {
      main.innerHTML = '<div class="card"><h2>No access</h2><p>Your role (' + esc(S.profile.role) + ') cannot use this app. Try a different one from the home page.</p></div>';
      return;
    }
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem('rb_cat_' + S.user.id) || 'null'); } catch (e) { /* ignore */ }
    var tab = allowed[0];
    if (cached && cached.length) {
      setItems(cached);
      show(tab);
      loadCatalog(true).then(function () { if (['dash', 'buy', 'items'].indexOf(cur) >= 0) show(cur); }).catch(function () { /* offline: keep cached */ });
    } else {
      show(tab);
    }
  }

  async function show(tab) {
    cur = tab;
    var t = ++navToken;
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tab); });
    var box = document.createElement('div');
    if (!main.firstChild) main.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try { await TABS[tab].view(box); }
    catch (e) { box.innerHTML = '<div class="card"><h2>Something went wrong</h2><p class="muted">' + esc(e.message || e) + '</p><button class="btn alt" onclick="location.reload()">Reload</button></div>'; }
    if (t === navToken) main.replaceChildren(box);
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
    opts: opts, pill: pill, lineBuilder: lineBuilder, loadCatalog: loadCatalog, stations: stations, suppliers: suppliers, show: show,
    requestSelect: requestSelect, supOptions: supOptions, UNITS: UNITS, prefill: null, openLines: openLines, unitFor: unitFor, suggested: suggested, current: function () { return cur; }
  };

  /* ---------- start ---------- */
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && S.user) location.reload(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  // start once every script (extras.js) has registered its views
  document.addEventListener('DOMContentLoaded', function () { boot().catch(function (e) { authView(e.message || String(e)); }); });
})();
