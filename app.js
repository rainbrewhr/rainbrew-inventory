/* Rainbrew Inventory - one shared client for the four apps (admin, stockkeeper, procurement, request).
   Every page sets window.RB_APP; the database (row-level security + RPC functions) decides what each role may do. */
(function () {
  'use strict';
  var CFG = window.RAINBREW, APP = window.RB_APP;
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

  var OPS = ['Admin', 'Stock Keeper', 'Procurement Officer'];
  var ROLES = ['Admin', 'Stock Keeper', 'Procurement Officer', 'Station Staff', 'Requester', 'Viewer'];
  var REQUESTERS = ['Admin', 'Stock Keeper', 'Station Staff', 'Requester'];

  var APPS = {
    admin: { title: 'Admin', tabs: ['dash', 'release', 'receive', 'buy', 'waste', 'count', 'items', 'users', 'history'] },
    stockkeeper: { title: 'Stock Keeper', tabs: ['release', 'receive', 'waste', 'count', 'dash', 'history'] },
    procurement: { title: 'Procurement', tabs: ['buy', 'release', 'receive', 'dash', 'history'] },
    request: { title: 'Request', tabs: ['req', 'buyreq', 'mine', 'swaste'] }
  };
  var TABS = {
    dash: { label: 'Dashboard', roles: OPS.concat('Viewer'), view: vDash },
    release: { label: 'Release', roles: OPS, view: vRelease },
    receive: { label: 'Receive', roles: OPS, view: vReceive },
    buy: { label: 'Buy list', roles: OPS, view: vBuy },
    waste: { label: 'Waste', roles: ['Admin', 'Stock Keeper'], view: function (b) { return vWaste(b, null); } },
    count: { label: 'Count', roles: ['Admin', 'Stock Keeper'], view: vCount },
    items: { label: 'Items', roles: ['Admin'], view: vItems },
    users: { label: 'Users', roles: ['Admin'], view: vUsers },
    history: { label: 'History', roles: OPS, view: function (b) { return vHistory(b, false); } },
    req: { label: 'Request items', roles: REQUESTERS, view: vRequest },
    buyreq: { label: 'Request to buy', roles: REQUESTERS, view: vBuyRequest },
    mine: { label: 'My requests', roles: REQUESTERS, view: function (b) { return vHistory(b, true); } },
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
        return '<button type="button" data-id="' + i.id + '"><span>' + esc(i.name) + '</span><span class="muted">' + esc(i.unit || '') + (o.stock ? ' · ' + fmt(i.current_stock) + ' in stock' : '') + '</span></button>';
      }).join('') || '<div class="muted" style="padding:9px">No match</div>';
      sg.classList.remove('hide');
    });
    sg.addEventListener('click', function (e) {
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
    root.innerHTML = '<div class="auth">' + logo() + '<h1>Rainbrew ' + esc(APPS[APP].title) + '</h1><div class="card">' +
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
    root.innerHTML = '<header class="top">' + logo() + '<h1>Rainbrew ' + esc(APPS[APP].title) + '</h1><div class="who">' + esc(profile.name) + '<br>' + esc(profile.role) + '</div><button id="so">Sign out</button></header>' +
      '<nav class="tabs">' + allowed.map(function (t) { return '<button data-t="' + t + '">' + esc(TABS[t].label) + '</button>'; }).join('') + '</nav><main id="main"></main>';
    main = $('#main');
    $('#so').onclick = async function () { await sb.auth.signOut(); location.reload(); };
    root.querySelectorAll('nav.tabs button').forEach(function (b) { b.onclick = function () { show(b.dataset.t); }; });
    return allowed;
  }

  function simpleCard(title, html) {
    root.innerHTML = '<div class="auth">' + logo() + '<h1>Rainbrew ' + esc(APPS[APP].title) + '</h1><div class="card"><h2>' + esc(title) + '</h2>' + html + '</div></div>';
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

  async function vRelease(box) {
    await loadCatalog(true);
    var reqs = await q(requestSelect('Transfer'));
    if (!reqs.length) { box.innerHTML = '<div class="card"><h2>Release</h2><p class="muted">No station requests are waiting.</p></div>'; return; }
    reqs.forEach(function (r) {
      var c = document.createElement('div'); c.className = 'card';
      var lines = openLines(r);
      c.innerHTML = '<div class="row"><h2 class="grow">' + esc(r.id) + ' → ' + esc(r.station || '') + '</h2>' + pill(r.status) + '</div>' +
        '<p class="muted">' + esc(r.requester_name || '') + ' · ' + esc(when(r.created_at)) + (r.notes ? ' · ' + esc(r.notes) : '') + '</p>' +
        '<div class="tbl"><table><thead><tr><th>Item</th><th class="num">Asked</th><th class="num">In stock</th><th class="num">Release</th></tr></thead><tbody>' +
        lines.map(function (l) {
          var it = S.map.get(l.item_id), st = it ? Number(it.current_stock) : 0, def = Math.max(0, Math.min(Number(l.remaining_qty), st));
          return '<tr data-line="' + l.id + '"><td>' + esc(l.items.name) + '<div class="muted">' + esc(l.unit || '') + '</div></td><td class="num">' + fmt(l.remaining_qty) + '</td><td class="num">' + fmt(st) + '</td><td class="num"><input type="number" min="0" step="any" inputmode="decimal" value="' + def + '" style="width:92px"></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:10px"><button class="btn" data-go>Release</button><button class="btn alt" data-no>Reject</button></div>';
      $('[data-go]', c).onclick = function (e) {
        act(e.currentTarget, async function () {
          var ls = [].map.call(c.querySelectorAll('tr[data-line]'), function (tr) { return { line_id: +tr.dataset.line, qty: +$('input', tr).value }; }).filter(function (x) { return x.qty > 0; });
          if (!ls.length) throw new Error('Enter a quantity to release');
          await rpc('release_request', { p_req: r.id, p_lines: ls });
          toast(r.id + ' released');
          await loadCatalog(true); show('release');
        });
      };
      $('[data-no]', c).onclick = function (e) {
        var why = prompt('Reason for rejecting ' + r.id + ' (optional)'); if (why === null) return;
        act(e.currentTarget, async function () { await rpc('reject_request', { p_req: r.id, p_reason: why }); toast(r.id + ' rejected'); show('release'); });
      };
      box.appendChild(c);
    });
  }

  async function vReceive(box) {
    await loadCatalog(true);
    var res = await Promise.all([suppliers(), q(requestSelect('Purchase'))]);
    var sups = res[0], purs = res[1];
    box.innerHTML = '<div class="card"><h2>Receive delivery</h2>' +
      '<label>Supplier</label><input id="rs" list="rsl" placeholder="Supplier name"><datalist id="rsl">' + sups.map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('') + '</datalist>' +
      '<label>Against an urgent buy request (optional)</label><select id="rp">' + opts(purs.map(function (p) { return { value: p.id, label: p.id + ' · ' + openLines(p).length + ' item(s) · ' + (p.requester_name || '') }; }), '', 'Not against a request') + '</select>' +
      '<label>Items received</label><div id="lb"></div><label>Note (e.g. invoice no.)</label><input id="rn"><div style="margin-top:12px"><button class="btn" id="rgo">Receive into stock</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: true });
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
  async function vBuy(box) {
    await loadCatalog(true);
    var sups = await suppliers(), nameOf = {};
    sups.forEach(function (s) { nameOf[s.id] = s.name; });
    var purs = await q(requestSelect('Purchase'));
    var groups = {};
    S.items.filter(function (i) { return i.active && (i.status === 'LOW' || i.status === 'CRITICAL'); }).forEach(function (i) {
      var k = nameOf[i.supplier_id] || 'No supplier set';
      (groups[k] = groups[k] || []).push(i);
    });
    var html = '<div class="card"><h2>Urgent buy requests</h2>' + (purs.length ? purs.map(function (p) {
      return '<h3>' + esc(p.id) + ' · ' + esc(p.requester_name || '') + ' · ' + esc(when(p.created_at)) + '</h3><div class="tbl"><table><tbody>' +
        openLines(p).map(function (l) { return '<tr><td>' + esc(l.items.name) + '</td><td class="num">' + fmt(l.remaining_qty) + ' ' + esc(l.unit || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }).join('') + '<p class="muted">Close these with Receive → pick the request.</p>' : '<p class="muted">None open.</p>') + '</div>';
    var names = Object.keys(groups).sort();
    html += '<div class="card"><h2>Reorder suggestions</h2>' + (names.length ? '' : '<p class="muted">Nothing is at or below its reorder point. (Reorder levels are set per item in Admin → Items.)</p>') + '</div>';
    box.innerHTML = html;
    names.forEach(function (n) {
      var c = document.createElement('div'); c.className = 'card';
      var rows = groups[n];
      c.innerHTML = '<div class="row"><h2 class="grow">' + esc(n) + '</h2><button class="btn alt sm">Copy list</button></div><div class="tbl"><table><thead><tr><th>Item</th><th class="num">Stock</th><th class="num">Order</th><th>Status</th></tr></thead><tbody>' +
        rows.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td class="num">' + fmt(i.current_stock) + '</td><td class="num">' + fmt(suggested(i)) + ' ' + esc(unitFor(i)) + '</td><td>' + pill(i.status) + '</td></tr>'; }).join('') + '</tbody></table></div>';
      $('button', c).onclick = function () {
        var text = n + '\n' + rows.map(function (i) { return '- ' + i.name + ': ' + fmt(suggested(i)) + ' ' + unitFor(i); }).join('\n');
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Copied'); }, function () { prompt('Copy this list', text); });
      };
      box.appendChild(c);
    });
  }

  async function vWaste(box, fixedKind) {
    await loadCatalog(true);
    var sts = await stations(), staff = role() === 'Station Staff';
    box.innerHTML = '<div class="card"><h2>' + (fixedKind ? 'Station waste' : 'Waste') + '</h2>' +
      (fixedKind ? '' : '<label>Type</label><select id="wk"><option value="stockroom">Stock room waste (deducts stock)</option><option value="station">Station waste (log only)</option></select>') +
      '<div id="wst"' + (fixedKind ? '' : ' class="hide"') + '>' + (staff ? '<p class="muted">Station: ' + esc(S.profile.station || '') + '</p>' : '<label>Station</label><select id="ws">' + opts(sts, S.profile.station || '', 'Choose…') + '</select>') + '</div>' +
      '<label>Items wasted</label><div id="lb"></div><label>Note</label><input id="wn"><div style="margin-top:12px"><button class="btn" id="wgo">Record waste</button></div></div>';
    var lb = lineBuilder($('#lb', box), { stock: !fixedKind, reason: true });
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

  async function vCount(box) {
    await loadCatalog(true);
    var cats = Array.from(new Set(S.items.map(function (i) { return i.category || ''; }))).sort();
    var items = S.items.filter(function (i) { return i.active; });
    box.innerHTML = '<div class="card"><h2>Stock count</h2><p class="muted">Type the counted quantity for what you counted and leave the rest blank. Differences are posted as adjustments.</p>' +
      '<div class="row"><input class="grow" id="cq" type="search" placeholder="Filter items…"><select id="cc" style="max-width:220px">' + opts(cats.filter(Boolean), '', 'All categories') + '</select></div></div>' +
      '<div class="card tbl"><table><thead><tr><th>Item</th><th class="num">System</th><th class="num">Counted</th></tr></thead><tbody id="ct">' +
      items.map(function (i) {
        return '<tr data-n="' + esc(i.name.toLowerCase()) + '" data-c="' + esc(i.category || '') + '"><td>' + esc(i.name) + '<div class="muted">' + esc(i.unit || '') + '</div></td><td class="num">' + fmt(i.current_stock) + '</td><td class="num"><input type="number" min="0" step="any" inputmode="decimal" data-id="' + i.id + '" data-sys="' + i.current_stock + '" style="width:92px"></td></tr>';
      }).join('') + '</tbody></table></div><button class="btn" id="cgo">Post count</button>';
    function filt() {
      var t = $('#cq', box).value.trim().toLowerCase(), c = $('#cc', box).value;
      box.querySelectorAll('#ct tr').forEach(function (tr) { tr.hidden = !((!t || tr.dataset.n.indexOf(t) >= 0) && (!c || tr.dataset.c === c)); });
    }
    $('#cq', box).oninput = filt; $('#cc', box).onchange = filt;
    $('#cgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var ls = [].map.call(box.querySelectorAll('#ct input'), function (inp) { return inp.value === '' ? null : { item_id: inp.dataset.id, counted: +inp.value, diff: +inp.value - +inp.dataset.sys }; }).filter(Boolean);
        if (!ls.length) throw new Error('Enter at least one counted quantity');
        var off = ls.filter(function (l) { return l.diff !== 0; }).length;
        if (!confirm('Post ' + ls.length + ' counted item(s)? ' + off + ' differ from the system.')) return;
        var id = await rpc('record_count', { p_lines: ls.map(function (l) { return { item_id: l.item_id, counted: l.counted }; }) });
        toast('Count posted · ' + id); await loadCatalog(true); show('count');
      });
    };
  }

  async function vItems(box) {
    await loadCatalog(true);
    var sups = await suppliers();
    var cats = Array.from(new Set(S.items.map(function (i) { return i.category; }).filter(Boolean))).sort();
    box.innerHTML = '<div class="card"><h2>Add item</h2><div class="row"><input id="an" class="grow" placeholder="Item name"><input id="ac" list="cl" class="grow" placeholder="Category"><datalist id="cl">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist><input id="au" style="max-width:110px" placeholder="Unit"><button class="btn" id="aadd">Add</button></div>' +
      '<div class="row" style="margin-top:8px"><input id="sn" class="grow" placeholder="New supplier name"><button class="btn alt" id="sadd">Add supplier</button></div></div>' +
      '<div class="card"><input id="iq" type="search" placeholder="Filter items…"></div><div class="card tbl"><table><thead><tr><th>Item</th><th>Supplier</th><th>Buy unit</th><th class="num">Lead d</th><th class="num">Order ×</th><th class="num">Reorder</th><th class="num">Critical</th><th class="num">PAR</th><th>On</th></tr></thead><tbody id="it">' +
      S.items.map(function (i) {
        function n(f) { return '<td class="num"><input type="number" min="0" step="any" data-f="' + f + '" value="' + esc(i[f] == null ? '' : i[f]) + '" style="width:74px"></td>'; }
        return '<tr data-id="' + i.id + '" data-n="' + esc(i.name.toLowerCase()) + '"><td>' + esc(i.name) + '<div class="muted">' + esc(i.category || '') + ' · ' + esc(i.unit || '') + ' · stock ' + fmt(i.current_stock) + '</div></td>' +
          '<td><select data-f="supplier_id" style="min-width:130px">' + opts(sups.map(function (s) { return { value: s.id, label: s.name }; }), i.supplier_id || '', '—') + '</select></td>' +
          '<td><input data-f="purchase_unit" value="' + esc(i.purchase_unit || '') + '" style="width:80px"></td>' + n('lead_time_days') + n('order_multiple') + n('reorder_point') + n('critical_level') + n('par_target') +
          '<td><input type="checkbox" data-f="active"' + (i.active ? ' checked' : '') + '></td></tr>';
      }).join('') + '</tbody></table></div>';
    $('#iq', box).oninput = function () { var t = this.value.trim().toLowerCase(); box.querySelectorAll('#it tr').forEach(function (tr) { tr.hidden = !!t && tr.dataset.n.indexOf(t) < 0; }); };
    $('#it', box).addEventListener('change', function (e) {
      var tr = e.target.closest('tr'), f = e.target.dataset.f; if (!tr || !f) return;
      var v = f === 'active' ? e.target.checked : (e.target.value === '' ? null : e.target.type === 'number' ? +e.target.value : e.target.value);
      var patch = {}; patch[f] = v;
      sb.from('items').update(patch).eq('id', tr.dataset.id).then(function (r) {
        if (r.error) return toast(r.error.message, true);
        toast('Saved'); loadCatalog(true);
      });
    });
    $('#aadd', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var name = $('#an', box).value.trim(); if (!name) throw new Error('Enter an item name');
        await q(sb.from('items').insert({ name: name.toUpperCase(), category: $('#ac', box).value.trim() || null, unit: $('#au', box).value.trim() || null }));
        toast('Item added'); await loadCatalog(true); show('items');
      });
    };
    $('#sadd', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var name = $('#sn', box).value.trim().toUpperCase(); if (!name) throw new Error('Enter a supplier name');
        await q(sb.from('suppliers').insert({ name: name }));
        S.suppliers = null; toast('Supplier added'); show('items');
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

  async function vHistory(box, mine) {
    var canMov = OPS.concat('Viewer').indexOf(role()) >= 0;
    box.innerHTML = '<div class="card"><h2>' + (mine ? 'My requests' : 'History') + '</h2><div class="row"><input id="hq" class="grow" type="search" placeholder="Search by ID, e.g. REQ-1104-1"><button class="btn" id="hgo">Search</button></div></div><div id="hr"></div>';
    var out = $('#hr', box);
    async function run() {
      var term = $('#hq', box).value.trim().replace(/[%,()]/g, '');
      out.innerHTML = '<div class="skeleton"></div>';
      var rq = sb.from('requests').select('id,type,station,requester_name,status,notes,created_at,updated_at,request_items(requested_qty,fulfilled_qty,status,unit,items(name))').order('created_at', { ascending: false }).limit(30);
      if (term) rq = rq.ilike('id', '%' + term + '%');
      var jobs = [rq];
      if (term && canMov) jobs.push(sb.from('stock_movements').select('ts,type,signed_qty,reference,station,supplier,user_name,items(name,unit)').ilike('reference', '%' + term + '%').order('ts', { ascending: false }).limit(100));
      if (term && /^c/i.test(term) && canMov) jobs.push(sb.from('stock_counts').select('count_id,ts,system_qty,counted_qty,variance,counted_by,items(name,unit)').ilike('count_id', '%' + term + '%').limit(200));
      var r = await Promise.all(jobs), html = '';
      if (r[0].error) { out.innerHTML = '<div class="card">' + esc(r[0].error.message) + '</div>'; return; }
      html += (r[0].data || []).map(function (x) {
        return '<div class="card"><div class="row"><h2 class="grow">' + esc(x.id) + (x.station ? ' · ' + esc(x.station) : '') + '</h2>' + pill(x.status) + '</div><p class="muted">' + esc(x.requester_name || '') + ' · ' + esc(when(x.created_at)) + (x.notes ? ' · ' + esc(x.notes) : '') + '</p>' +
          '<div class="tbl"><table><tbody>' + (x.request_items || []).map(function (l) { return '<tr><td>' + esc(l.items ? l.items.name : '') + '</td><td class="num">' + fmt(l.fulfilled_qty) + ' / ' + fmt(l.requested_qty) + ' ' + esc(l.unit || '') + '</td><td>' + pill(l.status) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      }).join('') || '<div class="card muted">No requests found.</div>';
      if (r[1] && r[1].data && r[1].data.length) {
        html += '<div class="card"><h2>Stock movements</h2><div class="tbl"><table><tbody>' + r[1].data.map(function (m) {
          return '<tr><td class="muted">' + esc(when(m.ts)) + '</td><td>' + esc(m.type) + '</td><td>' + esc(m.items ? m.items.name : '') + '</td><td class="num">' + (m.signed_qty > 0 ? '+' : '') + fmt(m.signed_qty) + '</td><td class="muted hm">' + esc(m.reference || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      }
      if (r[2] && r[2].data && r[2].data.length) {
        html += '<div class="card"><h2>Count lines</h2><div class="tbl"><table><thead><tr><th>Item</th><th class="num">System</th><th class="num">Counted</th><th class="num">Diff</th></tr></thead><tbody>' + r[2].data.map(function (c) {
          return '<tr><td>' + esc(c.items ? c.items.name : '') + '</td><td class="num">' + fmt(c.system_qty) + '</td><td class="num">' + fmt(c.counted_qty) + '</td><td class="num">' + fmt(c.variance) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      }
      out.innerHTML = html;
    }
    $('#hgo', box).onclick = run;
    $('#hq', box).onkeydown = function (e) { if (e.key === 'Enter') run(); };
    await run();
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

  /* ---------- start ---------- */
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && S.user) location.reload(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
  boot().catch(function (e) { authView(e.message || String(e)); });
})();
