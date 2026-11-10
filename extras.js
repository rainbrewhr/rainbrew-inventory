/* Rainbrew Inventory - screens that carry the old system's print, report and filter features (plus new ones).
   Registers views on window.RB.views; app.js decides which role sees which tab. */
(function () {
  'use strict';
  var R = window.RB, S = R.S, sb = R.sb, esc = R.esc, fmt = R.fmt, when = R.when, $ = R.$, q = R.q, rpc = R.rpc, act = R.act, toast = R.toast, opts = R.opts, pill = R.pill, V = R.views;
  var UNITS = ['bottle', 'box', 'jar', 'g', 'kg', 'pack', 'pcs', 'sack', 'bag', 'gallon', 'roll', 'can'];
  var F = { stock: {}, release: {}, buy: {}, hist: {}, items: {}, count: {}, rep: {} };
  var REQSEL = 'id,type,station,requester_name,status,notes,created_at,updated_at,request_items(id,item_id,requested_qty,fulfilled_qty,remaining_qty,status,unit,items(name,unit))';
  var nowFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  function nowManila() { return nowFmt.format(new Date()); }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()); }
  function bounds(from, to) { return [from + 'T00:00:00+08:00', new Date(new Date(to + 'T00:00:00+08:00').getTime() + 864e5).toISOString()]; }
  function uniq(list) { return Array.from(new Set(list.filter(Boolean))).sort(); }
  function cats() { return uniq(S.items.map(function (i) { return i.category; })); }
  function flat(key) { return uniq([].concat.apply([], S.items.map(function (i) { return i[key] || []; }))); }
  function isOps() { return R.OPS.concat('Viewer').indexOf(R.role()) >= 0; }
  function supMap() { var m = {}; (S.suppliers || []).forEach(function (s) { m[s.id] = s.name; }); return m; }

  /* ---------- print + export ---------- */
  var LOGO = new URL('icon-192.png', location.href).href;
  var PRINT_CSS = 'body{font:12px/1.4 Arial,sans-serif;color:#000;margin:0}h1{font-size:16px;margin:4px 0}h2{font-size:13px;margin:14px 0 4px}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed;margin:4px 0 8px}th,td{border:1px solid #444;padding:3px 5px;text-align:left;vertical-align:top;font-size:11px;overflow-wrap:anywhere;word-break:break-word}' +
    'td{height:19px}th{background:#eee}td.n,th.n{text-align:right}.c{text-align:center}.t{font-size:15px;font-weight:bold}.m{font-size:11px}' +
    '.sig{margin-top:14px}.gen{font-size:10px;color:#444}.slip{page-break-after:always}.slip:last-child{page-break-after:auto}.hd{text-align:center;margin-bottom:8px}.hd p{margin:2px 0}.no{color:#666}' +
    '.lg{display:block;margin:0 auto 4px;height:15mm;width:auto}.slip .lg{height:10mm}tr{page-break-inside:avoid}';
  function printHtml(title, body, size) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open();
    d.write('<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '@page{size:' + (size || 'A4') + ';margin:' + (size === 'A6' ? '6mm' : '12mm') + '}</style>' + body);
    d.close();
    var tries = 0;
    (function go() {
      var imgs = [].slice.call(d.images), ready = imgs.every(function (i) { return i.complete; });
      if (!ready && tries++ < 20) return setTimeout(go, 100);
      f.contentWindow.focus(); f.contentWindow.print();
      setTimeout(function () { f.remove(); }, 2000);
    })();
  }
  function csv(name, rows) {
    var t = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
  }
  // every table gets fixed column widths (same on every page of a document); text wraps so nothing is cut off
  function widthsFor(n) {
    var first = n <= 3 ? 46 : n <= 5 ? 34 : 26, rest = (100 - first) / (n - 1);
    return [first].concat(Array.apply(null, Array(n - 1)).map(function () { return Math.round(rest * 10) / 10; }));
  }
  function table(head, rows, numCols, widths) {
    numCols = numCols || []; widths = widths || widthsFor(head.length);
    if (!rows.length) return '<p class="no">No records found.</p>';
    return '<table><colgroup>' + widths.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' + head.map(function (h, i) { return '<th' + (numCols.indexOf(i) >= 0 ? ' class="n"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td' + (numCols.indexOf(i) >= 0 ? ' class="n"' : '') + '>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function docHead(title, sub) {
    return '<div class="hd"><img class="lg" src="' + LOGO + '" alt="Rainbrew"><b>RAINBREW COFFEE SHOP</b><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '<p class="gen">Generated: ' + esc(nowManila()) + ' (Manila)</p></div>';
  }
  function slip(r) {
    var rows = (r.request_items || []).filter(function (l) { return l.status !== 'Removed'; }).map(function (l) {
      var it = S.map.get(l.item_id);
      return '<tr><td>' + esc(l.items && l.items.name) + '</td><td class="n">' + fmt(l.requested_qty) + '</td><td>' + esc(l.unit || '') + '</td><td>' + esc(it ? (it.stocked_at || []).join(' / ') : '') + '</td></tr>';
    }).join('');
    return '<section class="slip"><div class="c"><img class="lg" src="' + LOGO + '" alt="Rainbrew"><b>RAINBREW COFFEE SHOP</b></div><div class="c t">' + (r.type === 'Purchase' ? 'PURCHASE REQUEST' : 'STOCK REQUEST') + '</div><div class="c"><b>' + esc(r.id) + ' · ' + esc(r.status) + '</b></div>' +
      '<p class="m">Date: ' + esc(when(r.created_at)) + ' | Requester: ' + esc(r.requester_name || '') + ' | Requesting station: ' + esc(r.station || '') + (r.notes ? ' | Note: ' + esc(r.notes) : '') + '</p>' +
      '<table><colgroup><col style="width:38%"><col style="width:12%"><col style="width:14%"><col style="width:36%"></colgroup><thead><tr><th>Item</th><th class="n">Qty</th><th>Unit</th><th>Stock Room / Location</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="sig">Prepared / checked by: ____________________</p><p class="gen">Generated: ' + esc(nowManila()) + ' (Manila)</p></section>';
  }
  function printSlips(list, title) { if (!list.length) return toast('Nothing to print', true); printHtml(title || 'Request slips', list.map(slip).join(''), 'A6'); }

  /* ---------- filter bars ---------- */
  function fbar(defs, st) {
    return '<div class="card fcard"><div class="filters">' + defs.map(function (d) {
      if (d.t === 's') return '<div class="wide" style="position:relative"><input data-k="' + d.k + '" type="search" placeholder="' + esc(d.ph) + '" value="' + esc(st[d.k] || '') + '" aria-label="' + esc(d.ph) + '"></div>';
      if (d.t === 'd') return '<label style="margin:0">' + esc(d.ph) + '<input type="date" data-k="' + d.k + '" value="' + esc(st[d.k] || '') + '"></label>';
      return '<select data-k="' + d.k + '" aria-label="' + esc(d.ph) + '">' + opts(d.o, st[d.k] || '', d.ph) + '</select>';
    }).join('') + '</div></div>';
  }
  function wire(box, st, cb) {
    box.querySelectorAll('[data-k]').forEach(function (el) {
      el.addEventListener(el.type === 'search' ? 'input' : 'change', function () { st[el.dataset.k] = el.value; cb(); });
    });
  }
  function hit(item, st) {
    var t = (st.q || '').toLowerCase();
    if (t && item.name.toLowerCase().indexOf(t) < 0) return false;
    if (st.cat && item.category !== st.cat) return false;
    if (st.loc && (item.stocked_at || []).indexOf(st.loc) < 0) return false;
    if (st.stn && (item.used_by || []).indexOf(st.stn) < 0) return false;
    if (st.sup && item.supplier_id !== st.sup) return false;
    if (st.status && item.status !== st.status) return false;
    return true;
  }

  /* ---------- Stock levels (filters, print, csv, item ledger) ---------- */
  V.stock = async function (box) {
    await R.loadCatalog();
    var sups = await R.suppliers(), st = F.stock, sm = supMap();
    var np = R.takeNav();
    if (np.status !== undefined) st.status = np.status;
    if (np.cat !== undefined) { st.cat = np.cat; st.q = ''; }
    if (np.q) st.q = np.q;
    var all = S.items.filter(function (i) { return i.active; });
    var tally = { '': all.length, CRITICAL: 0, LOW: 0, OK: 0 };
    all.forEach(function (i) { tally[i.status === 'CRITICAL' ? 'CRITICAL' : i.status === 'LOW' ? 'LOW' : 'OK'] += 1; });
    var CH = [['', 'All', null], ['CRITICAL', 'Critical / out', 'var(--crit)'], ['LOW', 'Low', 'var(--warn)'], ['OK', 'Optimal', 'var(--ok)']];
    box.innerHTML = '<div class="card-head"><h2 style="font:600 18px var(--display)">Stock levels</h2><span class="sp"></span><button class="btn alt sm" id="sp">' + R.icon('print') + 'Print</button><button class="btn alt sm" id="sc">' + R.icon('receive') + 'CSV</button></div>' +
      '<div class="chips" id="chips"></div>' +
      fbar([{ t: 's', k: 'q', ph: 'Search by item name…' }, { t: 'c', k: 'cat', ph: 'All categories', o: cats() }, { t: 'c', k: 'loc', ph: 'All locations', o: flat('stocked_at') }, { t: 'c', k: 'stn', ph: 'All stations', o: flat('used_by') },
        { t: 'c', k: 'sup', ph: 'All suppliers', o: sups.map(function (s) { return { value: s.id, label: s.name }; }) }, { t: 'c', k: 'sort', ph: 'Sort: urgent first', o: SORT_OPTS }], st) +
      '<div class="card tbl" style="padding:6px 8px"><table><thead><tr><th>Item</th><th class="hm">Location</th><th class="num">Stock</th><th class="num hm">Reorder</th><th>Status</th><th></th></tr></thead><tbody id="sb"></tbody></table></div><p class="muted" id="sn" style="text-align:center"></p>';
    var list = [];
    function chips() {
      $('#chips', box).innerHTML = CH.map(function (c) { return '<button class="chip' + ((st.status || '') === c[0] ? ' on' : '') + '" data-ch="' + c[0] + '">' + (c[2] ? '<i style="background:' + c[2] + '"></i>' : '') + c[1] + ' <b>' + tally[c[0]] + '</b></button>'; }).join('');
    }
    function draw() {
      list = S.items.filter(function (i) { return i.active && hit(i, st); }).sort(sorter(st.sort || 'urgency', sm));
      $('#sb', box).innerHTML = list.map(function (i) {
        var tone = i.status === 'CRITICAL' ? 'crit' : i.status === 'LOW' ? 'warn' : 'ok';
        return '<tr class="click" data-id="' + i.id + '"><td><div class="cell-name"><span class="ico ' + tone + '">' + R.icon('stock') + '</span><span><b>' + esc(i.name) + '</b><span>' + esc(i.category || '') + '</span></span></div></td><td class="hm">' + esc((i.stocked_at || []).join(' / ')) + '</td><td class="num">' + fmt(i.current_stock) + ' <span class="muted">' + esc(i.unit || '') + '</span></td><td class="num hm">' + fmt(i.reorder_point) + '</td><td>' + pill(i.status) + '</td><td style="width:28px;color:var(--line2)">' + R.icon('chevr', 'sm') + '</td></tr>';
      }).join('') || '<tr><td colspan="6">' + R.ui.empty('search', 'No items match', 'Try a different search or clear a filter.') + '</td></tr>';
      $('#sn', box).textContent = list.length + ' of ' + all.length + ' items shown';
      chips();
    }
    wire(box, st, draw); draw();
    $('#chips', box).onclick = function (e) { var c = e.target.closest('[data-ch]'); if (c) { st.status = c.dataset.ch; draw(); } };
    $('#sb', box).onclick = function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) R.openItem(tr.dataset.id); };
    $('#sp', box).onclick = function () {
      printHtml('Stock levels', docHead('Stock Levels', list.length + ' item(s)') + table(['Item', 'Category', 'Location', 'Stock', 'Unit', 'Reorder', 'Status'], list.map(function (i) { return [i.name, i.category, (i.stocked_at || []).join(' / '), fmt(i.current_stock), i.unit, fmt(i.reorder_point), i.status]; }), [3, 5]));
    };
    $('#sc', box).onclick = function () { csv('stock-levels-' + today() + '.csv', [['Item', 'Category', 'Location', 'Stock', 'Unit', 'Reorder point', 'Critical level', 'PAR', 'Supplier', 'Status']].concat(list.map(function (i) { return [i.name, i.category, (i.stocked_at || []).join(' / '), i.current_stock, i.unit, i.reorder_point, i.critical_level, i.par_target, sm[i.supplier_id] || '', i.status]; }))); };
  };

  /* ---------- Release (filters + A6 print) ---------- */
  V.release = async function (box) {
    await R.loadCatalog(true);
    var sts = await R.stations(), st = F.release;
    var reqs = await q(R.requestSelect('Transfer'));
    box.innerHTML = '<div class="card"><div class="row"><h2 class="grow">Release</h2><button class="btn alt sm" id="pa">Print all open (A6)</button></div><p class="muted">' + reqs.length + ' open station request(s)</p></div>' +
      fbar([{ t: 's', k: 'q', ph: 'Search ID or requester…' }, { t: 'c', k: 'stn', ph: 'All stations', o: sts }, { t: 'c', k: 'status', ph: 'Pending + Partial', o: ['Pending', 'Partial'] }], st) + '<div id="rl"></div>';
    function visible() {
      var t = (st.q || '').toLowerCase();
      return reqs.filter(function (r) { return (!st.stn || r.station === st.stn) && (!st.status || r.status === st.status) && (!t || (r.id + ' ' + (r.requester_name || '')).toLowerCase().indexOf(t) >= 0); });
    }
    function draw() {
      var out = $('#rl', box); out.innerHTML = '';
      var vis = visible();
      if (!vis.length) { out.innerHTML = '<div class="card">' + R.ui.empty('done', 'Nothing to release', 'New station requests show up here as soon as someone sends one.') + '</div>'; return; }
      vis.forEach(function (r) {
        var c = document.createElement('div'); c.className = 'card';
        var lines = R.openLines(r);
        c.innerHTML = '<div class="row"><h2 class="grow">' + esc(r.id) + ' → ' + esc(r.station || '') + '</h2>' + pill(r.status) + '<button class="btn alt sm" data-pr>Print A6</button></div>' +
          '<p class="muted">' + esc(r.requester_name || '') + ' · ' + esc(when(r.created_at)) + (r.notes ? ' · ' + esc(r.notes) : '') + '</p>' +
          '<div class="tbl"><table><thead><tr><th>Item</th><th class="num">Asked</th><th class="num">In stock</th><th class="num">Release</th></tr></thead><tbody>' +
          lines.map(function (l) {
            var it = S.map.get(l.item_id), s = it ? Number(it.current_stock) : 0, def = Math.max(0, Math.min(Number(l.remaining_qty), s));
            return '<tr data-line="' + l.id + '"><td>' + esc(l.items.name) + '<div class="muted">' + esc(l.unit || '') + (it && it.stocked_at && it.stocked_at.length ? ' · ' + esc(it.stocked_at.join(' / ')) : '') + '</div></td><td class="num">' + fmt(l.remaining_qty) + '</td><td class="num">' + fmt(s) + '</td><td class="num"><input type="number" min="0" step="any" inputmode="decimal" value="' + def + '" style="width:92px"></td></tr>';
          }).join('') + '</tbody></table></div><div class="row" style="margin-top:10px"><button class="btn" data-go>Release</button><button class="btn alt" data-no>Reject</button></div>';
        $('[data-pr]', c).onclick = function () { printSlips([r], r.id); };
        $('[data-go]', c).onclick = function (e) {
          act(e.currentTarget, async function () {
            var ls = [].map.call(c.querySelectorAll('tr[data-line]'), function (tr) { return { line_id: +tr.dataset.line, qty: +$('input', tr).value }; }).filter(function (x) { return x.qty > 0; });
            if (!ls.length) throw new Error('Enter a quantity to release');
            await rpc('release_request', { p_req: r.id, p_lines: ls });
            toast(r.id + ' released'); await R.loadCatalog(true); R.show('release');
          });
        };
        $('[data-no]', c).onclick = async function (e) {
          var btn = e.currentTarget;
          var why = await R.ui.ask({ title: 'Reject ' + r.id, icon: 'alert', label: 'Reason (optional)', multiline: true, placeholder: 'Why is this being rejected?', ok: 'Reject request' }); if (why === null) return;
          act(btn, async function () { await rpc('reject_request', { p_req: r.id, p_reason: why }); toast(r.id + ' rejected'); R.show('release'); });
        };
        out.appendChild(c);
      });
    }
    wire(box, st, draw); draw();
    $('#pa', box).onclick = function () { printSlips(visible(), 'Open requests'); };
  };

  /* ---------- Buy list: see every product first, tick what needs buying, then work the list by supplier ---------- */
  var BUY_HEAD = ['Item', 'In stock', 'Order qty', 'Unit', 'Alternative supplier', 'Actual bought'], BUY_W = [30, 10, 12, 10, 24, 14];
  var LIST_W = [26, 9, 14, 8, 19, 16, 8], PICK_W = [34, 10, 10, 12, 16, 18];
  function urg(i) { return i.status === 'CRITICAL' ? 0 : i.status === 'LOW' ? 1 : 2; }
  function ratio(i) { var r = Number(i.reorder_point); return r > 0 ? Number(i.current_stock) / r : 1e9; }
  function byName(a, b) { return String(a.name).localeCompare(String(b.name)); }
  function sorter(key, sm) {
    var f = {
      urgency: function (a, b) { return urg(a) - urg(b) || ratio(a) - ratio(b) || Number(a.current_stock) - Number(b.current_stock) || byName(a, b); },
      low: function (a, b) { return Number(a.current_stock) - Number(b.current_stock) || byName(a, b); },
      high: function (a, b) { return Number(b.current_stock) - Number(a.current_stock) || byName(a, b); },
      name: byName,
      cat: function (a, b) { return String(a.category || '~').localeCompare(String(b.category || '~')) || byName(a, b); },
      sup: function (a, b) { return String((sm || {})[a.supplier_id] || '~').localeCompare(String((sm || {})[b.supplier_id] || '~')) || byName(a, b); }
    };
    return f[key] || f.urgency;
  }
  var SORT_OPTS = [{ value: 'low', label: 'Sort: stock, lowest first' }, { value: 'high', label: 'Sort: stock, highest first' }, { value: 'name', label: 'Sort: name A–Z' }, { value: 'cat', label: 'Sort: category' }, { value: 'sup', label: 'Sort: supplier' }];
  V.buy = async function (box) {
    await R.loadCatalog(true);
    var sups = await R.suppliers(), sm = supMap(), st = F.buy;
    var purs = await q(R.requestSelect('Purchase'));
    var KEY = 'rb_buy_' + (S.user && S.user.id);
    if (!st.loaded) {
      st.loaded = true; st.sel = {}; st.auto = {}; st.actual = {}; st.view = '';
      try { var sv = JSON.parse(localStorage.getItem(KEY) || '{}'); st.sel = sv.sel || {}; st.auto = sv.auto || {}; st.actual = sv.actual || {}; } catch (e) { /* start empty */ }
    }
    function persist() { try { localStorage.setItem(KEY, JSON.stringify({ sel: st.sel, auto: st.auto, actual: st.actual })); } catch (e) { /* storage unavailable */ } }
    var asked = {};
    purs.forEach(function (p) {
      R.openLines(p).forEach(function (l) {
        var a = asked[l.item_id] || (asked[l.item_id] = { qty: 0, who: [] });
        a.qty += Number(l.remaining_qty); if (p.requester_name && a.who.indexOf(p.requester_name) < 0) a.who.push(p.requester_name);
      });
    });
    function defQty(i) { return String(asked[i.id] ? asked[i.id].qty : R.suggested(i)); }
    // staff buy requests land on the list by themselves (once per request), so nothing they ask for is missed
    purs.forEach(function (p) {
      if (st.auto[p.id]) return; st.auto[p.id] = 1;
      R.openLines(p).forEach(function (l) { if (S.map.get(l.item_id)) st.sel[l.item_id] = String(asked[l.item_id].qty); });
    });
    Object.keys(st.sel).forEach(function (id) { var it = S.map.get(id); if (!it || !it.active) delete st.sel[id]; });
    persist();
    R.afterReceive = function (ids) { ids.forEach(function (id) { delete st.sel[id]; delete st.actual[id]; }); persist(); };
    var all = S.items.filter(function (i) { return i.active; });
    var nsel = function () { return Object.keys(st.sel).length; };
    function alt(i) { return [sm[i.alt_supplier_1_id], sm[i.alt_supplier_2_id]].filter(Boolean).join(', '); }
    st.view = 'pick'; // always open on the full product list; "To buy" is one tap away
    st.pst = st.pst || ''; st.sort = st.sort || '';

    box.innerHTML = '<div class="card"><div class="row"><h2 class="grow">Buy list</h2><span id="bact" class="row"></span></div>' +
      '<div class="seg" id="bseg"><button data-v="pick">All products</button><button data-v="list">To buy <b id="bnum"></b></button></div><p class="muted" id="bn" style="margin:10px 0 0"></p></div><div id="bbody"></div>';
    var body = $('#bbody', box);
    function head() {
      $('#bnum', box).textContent = nsel();
      box.querySelectorAll('#bseg button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === st.view); });
    }
    $('#bseg', box).onclick = function (e) { var b = e.target.closest('button[data-v]'); if (b) { st.view = b.dataset.v; render(); } };

    /* ---- step 1: every product, with filters and sorters ---- */
    function pick() {
      var tally = { '': all.length, CRITICAL: 0, LOW: 0, OK: 0, ASKED: 0 };
      all.forEach(function (i) { tally[urg(i) === 0 ? 'CRITICAL' : urg(i) === 1 ? 'LOW' : 'OK'] += 1; if (asked[i.id]) tally.ASKED += 1; });
      var CH = [['', 'All', null], ['CRITICAL', 'Critical / out', 'var(--crit)'], ['LOW', 'Low', 'var(--warn)'], ['OK', 'Optimal', 'var(--ok)'], ['ASKED', 'Asked by staff', 'var(--accent)']];
      body.innerHTML = '<div class="chips" id="bch"></div>' +
        fbar([{ t: 's', k: 'q', ph: 'Search item…' }, { t: 'c', k: 'cat', ph: 'All categories', o: cats() }, { t: 'c', k: 'sup', ph: 'All suppliers', o: sups.map(function (s) { return { value: s.id, label: s.name }; }) }, { t: 'c', k: 'sort', ph: 'Sort: urgent first', o: SORT_OPTS }], st) +
        '<div class="card" style="padding:12px 16px"><div class="row" style="gap:8px"><button class="btn alt sm" id="bsl"></button><button class="btn alt sm" id="bss">Select all shown</button><button class="btn alt sm" id="bsc">Clear selection</button><span class="sp" style="flex:1"></span><button class="btn sm" id="bgo"></button></div></div>' +
        '<div class="card tbl" style="padding:6px 8px"><table class="fx"><colgroup>' + PICK_W.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr><th>Item</th><th class="num">In stock</th><th class="num">Reorder at</th><th>Status</th><th>Supplier</th><th class="num">Order qty</th></tr></thead><tbody id="bp2"></tbody></table></div><p class="muted" id="bpn" style="text-align:center"></p>';
      var shown = [];
      function chips() { $('#bch', box).innerHTML = CH.map(function (c) { return '<button class="chip' + (st.pst === c[0] ? ' on' : '') + '" data-ch="' + c[0] + '">' + (c[2] ? '<i style="background:' + c[2] + '"></i>' : '') + c[1] + ' <b>' + tally[c[0]] + '</b></button>'; }).join(''); }
      function row(i) {
        var on = Object.prototype.hasOwnProperty.call(st.sel, i.id), a = asked[i.id];
        return '<tr class="click' + (on ? ' sel' : '') + '" data-pick="' + i.id + '"><td><label class="pickc"><input type="checkbox"' + (on ? ' checked' : '') + ' aria-label="Select ' + esc(i.name) + '"><span class="cell-name"><span><b>' + esc(i.name) + '</b><span>' + esc(i.category || '') + '</span>' +
          (a ? '<span class="askb">Asked by ' + esc(a.who.join(', ') || 'staff') + ' · ' + fmt(a.qty) + '</span>' : '') + '</span></span></label></td>' +
          '<td class="num">' + fmt(i.current_stock) + ' <span class="muted">' + esc(i.unit || '') + '</span></td><td class="num">' + (i.reorder_point != null ? fmt(i.reorder_point) : '—') + '</td><td>' + pill(i.status) + '</td><td>' + esc(sm[i.supplier_id] || '—') + '</td>' +
          '<td class="num">' + (on ? '<input type="number" min="0" step="any" inputmode="decimal" data-qty="' + i.id + '" value="' + esc(st.sel[i.id]) + '" aria-label="Order qty">' : '<span class="muted">—</span>') + '</td></tr>';
      }
      function draw() {
        shown = all.filter(function (i) {
          if (!hit(i, { q: st.q, cat: st.cat, sup: st.sup })) return false;
          if (st.pst === 'ASKED') return !!asked[i.id];
          if (st.pst) return (urg(i) === 0 ? 'CRITICAL' : urg(i) === 1 ? 'LOW' : 'OK') === st.pst;
          return true;
        }).sort(sorter(st.sort || 'urgency', sm));
        $('#bp2', box).innerHTML = shown.map(row).join('') || '<tr><td colspan="6">' + R.ui.empty('search', 'No items match', 'Try a different search or clear a filter.') + '</td></tr>';
        $('#bpn', box).textContent = shown.length + ' of ' + all.length + ' products shown';
        var lowN = all.filter(function (i) { return urg(i) < 2; }).length;
        $('#bsl', box).textContent = 'Select low & critical (' + lowN + ')';
        $('#bgo', box).textContent = nsel() ? 'Review buy list (' + nsel() + ')' : 'Nothing selected yet';
        $('#bgo', box).disabled = !nsel();
        chips(); head();
      }
      function toggle(id, on) { if (on) st.sel[id] = st.sel[id] || defQty(S.map.get(id)); else delete st.sel[id]; persist(); }
      body.onclick = function (e) {
        var c = e.target.closest('[data-ch]'); if (c) { st.pst = c.dataset.ch; draw(); return; }
        if (e.target.closest('.numstep,input[type=number]')) return;
        var tr = e.target.closest('tr[data-pick]'); if (!tr) return;
        var id = tr.dataset.pick, cb = $('input[type=checkbox]', tr);
        var now = e.target === cb ? cb.checked : !Object.prototype.hasOwnProperty.call(st.sel, id);
        toggle(id, now);
        var fresh = document.createElement('tbody'); fresh.innerHTML = row(S.map.get(id));
        tr.replaceWith(fresh.firstChild); $('#bgo', box).textContent = nsel() ? 'Review buy list (' + nsel() + ')' : 'Nothing selected yet'; $('#bgo', box).disabled = !nsel(); head();
        if (now) { var qi = body.querySelector('input[data-qty="' + id + '"]'); if (qi) { qi.focus(); qi.select(); } }
      };
      body.addEventListener('input', function (e) { var el = e.target.closest('[data-qty]'); if (el) { st.sel[el.dataset.qty] = el.value; persist(); } });
      $('#bsl', box).onclick = function () { all.filter(function (i) { return urg(i) < 2; }).forEach(function (i) { toggle(i.id, true); }); draw(); };
      $('#bss', box).onclick = function () { shown.forEach(function (i) { toggle(i.id, true); }); draw(); };
      $('#bsc', box).onclick = function () { st.sel = {}; persist(); draw(); };
      $('#bgo', box).onclick = function () { st.view = 'list'; render(); };
      wire(box, st, draw); draw();
    }

    /* ---- step 2: the chosen items, grouped by supplier ---- */
    function list() {
      var rows = Object.keys(st.sel).map(function (id) { return { item: S.map.get(id), qty: st.sel[id] }; }).filter(function (r) { return r.item; });
      function group() { var g = {}; rows.forEach(function (r) { var k = sm[r.item.supplier_id] || 'No supplier set'; (g[k] = g[k] || []).push(r); }); return g; }
      function bought(r) { return st.actual[r.item.id] == null ? '' : st.actual[r.item.id]; }
      function rowsFor(rs) { return rs.map(function (r) { return [r.item.name, fmt(r.item.current_stock), fmt(r.qty), R.unitFor(r.item), alt(r.item), bought(r)]; }); }
      function listText(name, rs) { return name + '\n' + rs.map(function (r) { return '- ' + r.item.name + ': ' + fmt(r.qty) + ' ' + R.unitFor(r.item); }).join('\n'); }
      function buyDoc(pairs) { return docHead('Procurement Buy List', today()) + pairs.map(function (p) { return '<h2>' + esc(p[0]) + '</h2>' + table(BUY_HEAD, rowsFor(p[1]), [1, 2, 5], BUY_W); }).join('') + '<p class="sig">Prepared / checked by: ____________________</p>'; }
      body.innerHTML = '<div id="bg"></div>';
      var g = group(), names = Object.keys(g).sort(), out = $('#bg', box);
      $('#bn', box).textContent = rows.length + ' item(s) to buy from ' + names.length + ' supplier(s)';
      if (!names.length) out.innerHTML = '<div class="card">' + R.ui.empty('buy', 'Nothing chosen yet', 'Go to All products, tick what needs buying, then come back here to print or share the list.', '<button class="btn alt" id="bto" style="margin-top:14px">Choose items</button>') + '</div>';
      var bto = $('#bto', box); if (bto) bto.onclick = function () { st.view = 'pick'; render(); };
      names.forEach(function (n) {
        var rs = g[n], c = document.createElement('div'); c.className = 'card';
        c.innerHTML = '<div class="row"><h2 class="grow">' + esc(n) + '</h2><button class="btn alt sm" data-p>Print</button><button class="btn alt sm" data-c>Copy</button>' + (navigator.share ? '<button class="btn alt sm" data-sh>Share</button>' : '') + '<button class="btn sm" data-r>Receive delivery</button></div><div class="tbl"><table class="fx"><colgroup>' + LIST_W.map(function (w) { return '<col style="width:' + w + '%">'; }).join('') + '</colgroup><thead><tr>' +
          BUY_HEAD.map(function (h, i) { return '<th' + ([1, 2, 5].indexOf(i) >= 0 ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
          rs.map(function (r) { var i = r.item, a = asked[i.id]; return '<tr class="click" data-item="' + i.id + '"><td>' + esc(i.name) + (a ? '<div class="askb">Asked by ' + esc(a.who.join(', ') || 'staff') + '</div>' : '') + '</td><td class="num">' + fmt(i.current_stock) + '</td><td class="num"><input type="number" min="0" step="any" inputmode="decimal" data-qty="' + i.id + '" value="' + esc(r.qty) + '" aria-label="Order qty"></td><td>' + esc(R.unitFor(i)) + '</td><td>' + esc(alt(i)) + '</td><td class="num"><input type="number" min="0" step="any" inputmode="decimal" data-act="' + i.id + '" value="' + esc(bought(r)) + '" aria-label="Actual bought"></td><td><button class="icon-btn" data-un="' + i.id + '" aria-label="Remove from list" type="button">' + R.icon('x') + '</button></td></tr>'; }).join('') + '</tbody></table></div>';
        $('[data-p]', c).onclick = function () { printHtml('Buy list ' + n, buyDoc([[n, rs]]), 'A4'); };
        $('[data-c]', c).onclick = function () { var t = listText(n, rs); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copied'); }, function () { R.ui.copy(t); }); };
        var sh = $('[data-sh]', c); if (sh) sh.onclick = function () { navigator.share({ title: 'Buy list · ' + n, text: listText(n, rs) }).catch(function () { /* cancelled */ }); };
        $('[data-r]', c).onclick = function () {
          var lines = rs.filter(function (r) { return Number(bought(r)) > 0; }).map(function (r) { return { item: r.item, qty: String(bought(r)) }; });
          if (!lines.length) return toast('Type the actual bought quantities first', true);
          R.prefill = { supplier: n === 'No supplier set' ? '' : n, lines: lines }; R.show('receive');
        };
        out.appendChild(c);
      });
      out.addEventListener('click', function (e) {
        var u = e.target.closest('[data-un]'); if (u) { delete st.sel[u.dataset.un]; persist(); list(); head(); return; }
        if (e.target.closest('input,button,select,a,.numstep')) return;
        var tr = e.target.closest('tr[data-item]'); if (tr) R.openItem(tr.dataset.item);
      });
      out.addEventListener('input', function (e) {
        var a = e.target.closest('[data-act]'); if (a) { st.actual[a.dataset.act] = a.value; persist(); return; }
        var qn = e.target.closest('[data-qty]'); if (qn) { st.sel[qn.dataset.qty] = qn.value; persist(); }
      });
      $('#bact', box).innerHTML = '<button class="btn alt sm" id="bp">Print all</button><button class="btn alt sm" id="bc">CSV</button>';
      $('#bp', box).onclick = function () { var gg = group(); printHtml('Buy list', buyDoc(Object.keys(gg).sort().map(function (n) { return [n, gg[n]]; })), 'A4'); };
      $('#bc', box).onclick = function () { var gg = group(); csv('buy-list-' + today() + '.csv', [['Supplier'].concat(BUY_HEAD)].concat([].concat.apply([], Object.keys(gg).sort().map(function (n) { return rowsFor(gg[n]).map(function (r) { return [n].concat(r); }); })))); };
      head();
    }
    function render() { $('#bact', box).innerHTML = ''; if (st.view === 'list') list(); else { $('#bn', box).textContent = 'Tick every product you need to buy. Staff buy requests are already ticked.'; pick(); } head(); }
    render();
  };

  /* ---------- Count (stock room adjusts; stations are snapshot logs) ---------- */
  V.count = async function (box) {
    await R.loadCatalog(true);
    var sts = await R.stations(), st = F.count;
    box.innerHTML = '<div class="card"><h2>Stock count</h2><label>Where are you counting?</label><select id="cw">' + opts([{ value: '', label: 'Stock room (adjusts stock)' }].concat(sts.map(function (s) { return { value: s, label: s + ' (log only)' }; })), st.where || '') + '</select>' +
      '<p class="muted" id="ch"></p></div>' + fbar([{ t: 's', k: 'q', ph: 'Filter items…' }, { t: 'c', k: 'cat', ph: 'All categories', o: cats() }, { t: 'c', k: 'loc', ph: 'All locations', o: flat('stocked_at') }], st) +
      '<div class="card tbl"><table><thead><tr><th>Item</th><th class="num" id="sh">System</th><th class="num">Counted</th></tr></thead><tbody id="ct"></tbody></table></div><p class="muted" id="cn"></p><button class="btn" id="cgo">Post count</button>';
    var items = S.items.filter(function (i) { return i.active; });
    function station() { return $('#cw', box).value; }
    st.counts = st.counts || {};
    function bucket() { var k = station() || '_room'; return st.counts[k] || (st.counts[k] = {}); }
    function tally() { var n = Object.keys(bucket()).length; $('#cn', box).textContent = n ? n + ' item(s) counted so far. They stay here while you search or filter.' : ''; }
    function draw() {
      var s = station(), keep = bucket();
      var list = items.filter(function (i) { return hit(i, st) && (!s || (i.used_by || []).indexOf(s) >= 0 || (i.used_by || []).indexOf('ALL') >= 0); });
      $('#sh', box).hidden = !!s;
      $('#ch', box).textContent = s ? 'Counts at a station are saved as a dated snapshot only. They do not change stock room quantities.' : 'Type the counted quantity for what you counted and leave the rest blank. Differences are posted as adjustments.';
      $('#ct', box).innerHTML = list.map(function (i) {
        return '<tr><td>' + esc(i.name) + '<div class="muted">' + esc(i.unit || '') + ' · ' + esc((i.stocked_at || []).join(' / ')) + '</div></td>' + (s ? '' : '<td class="num">' + fmt(i.current_stock) + '</td>') + '<td class="num"' + (s ? ' colspan="2"' : '') + '><input type="number" min="0" step="any" inputmode="decimal" data-id="' + i.id + '" data-sys="' + i.current_stock + '" value="' + esc(keep[i.id] == null ? '' : keep[i.id]) + '" style="width:92px"></td></tr>';
      }).join('') || '<tr><td class="muted">No items match.</td></tr>';
    }
    $('#cw', box).onchange = function () { st.where = station(); draw(); };
    $('#ct', box).addEventListener('input', function (e) { var el = e.target.closest('input[data-id]'); if (!el) return; if (el.value === '') delete bucket()[el.dataset.id]; else bucket()[el.dataset.id] = el.value; tally(); });
    wire(box, st, draw); draw(); tally();
    $('#cgo', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var s = station();
        var bk = bucket(), ls = Object.keys(bk).map(function (id) { var it = S.map.get(id); return it ? { item_id: id, counted: +bk[id], diff: +bk[id] - Number(it.current_stock) } : null; }).filter(Boolean);
        if (!ls.length) throw new Error('Enter at least one counted quantity');
        if (s) {
          if (!(await R.ui.confirm('Save a snapshot of ' + ls.length + ' item(s) at ' + s + '? This is a log only and does not change stock.', { title: 'Save station snapshot', ok: 'Save snapshot' }))) return;
          var sid = await rpc('next_id', { p_prefix: 'SNP' });
          await q(sb.from('station_stock_snapshots').insert(ls.map(function (l) { return { snapshot_id: sid, location: s, item_id: l.item_id, counted_qty: l.counted, counted_by: S.profile.name }; })));
          toast('Snapshot saved · ' + sid);
        } else {
          var off = ls.filter(function (l) { return l.diff !== 0; }).length;
          if (!(await R.ui.confirm('Post ' + ls.length + ' counted item(s)? ' + off + ' differ from the system and will be adjusted.', { title: 'Post stock count', ok: 'Post count' }))) return;
          var id = await rpc('record_count', { p_lines: ls.map(function (l) { return { item_id: l.item_id, counted: l.counted }; }) });
          toast('Count posted · ' + id);
        }
        st.counts[s || '_room'] = {}; await R.loadCatalog(true); R.show('count');
      });
    };
  };

  /* ---------- History (filters, A6 print, csv) ---------- */
  V.history = async function (box, mine) {
    var sts = await R.stations(), st = F.hist, canMov = isOps();
    box.innerHTML = '<div class="card"><div class="row"><h2 class="grow">' + (mine ? 'My requests' : 'History') + '</h2><button class="btn alt sm" id="hp">Print slips (A6)</button><button class="btn alt sm" id="hc">CSV</button></div></div>' +
      fbar([{ t: 's', k: 'q', ph: 'ID, e.g. REQ-1104-1' }].concat(mine || !canMov ? [] : [{ t: 's', k: 'item', ph: 'Item name (movements)' }]).concat([
        { t: 'c', k: 'type', ph: 'Any type', o: [{ value: 'Transfer', label: 'Station request' }, { value: 'Purchase', label: 'Buy request' }] },
        { t: 'c', k: 'status', ph: 'Any status', o: ['Pending', 'Partial', 'Released', 'Received', 'Rejected'] }, { t: 'c', k: 'stn', ph: 'Any station', o: sts },
        { t: 'd', k: 'from', ph: 'From' }, { t: 'd', k: 'to', ph: 'To' }]), st) + '<div id="hr"></div>';
    var out = $('#hr', box), last = { reqs: [], mv: [] }, timer;
    async function run() {
      out.innerHTML = '<div class="skeleton"></div>';
      var term = (st.q || '').trim().replace(/[%,()]/g, ''), item = (st.item || '').trim().replace(/[%,()]/g, '');
      var rq = sb.from('requests').select(REQSEL).order('created_at', { ascending: false }).limit(50);
      if (term) rq = rq.ilike('id', '%' + term + '%');
      if (st.type) rq = rq.eq('type', st.type);
      if (st.status) rq = rq.eq('status', st.status);
      if (st.stn) rq = rq.eq('station', st.stn);
      var b = st.from || st.to ? bounds(st.from || st.to, st.to || st.from) : null;
      if (st.from) rq = rq.gte('created_at', st.from + 'T00:00:00+08:00');
      if (st.to) rq = rq.lt('created_at', bounds(st.to, st.to)[1]);
      var jobs = [rq];
      var wantMov = canMov && (term || item || b);
      if (wantMov) {
        var mv = sb.from('stock_movements').select('ts,type,signed_qty,reference,station,supplier,user_name,items!inner(name,unit)').order('ts', { ascending: false }).limit(150);
        if (term) mv = mv.ilike('reference', '%' + term + '%');
        if (item) mv = mv.ilike('items.name', '%' + item + '%');
        if (b) mv = mv.gte('ts', b[0]).lt('ts', b[1]);
        jobs.push(mv);
      }
      var r = await Promise.all(jobs);
      if (r[0].error) { out.innerHTML = '<div class="card">' + esc(r[0].error.message) + '</div>'; return; }
      last.reqs = r[0].data || []; last.mv = (r[1] && r[1].data) || [];
      out.innerHTML = last.reqs.map(function (x) {
        return '<div class="card"><div class="row"><h2 class="grow">' + esc(x.id) + (x.station ? ' · ' + esc(x.station) : '') + '</h2>' + pill(x.status) + '<button class="btn alt sm" data-pr="' + esc(x.id) + '">Print A6</button>' + (R.role() === 'Admin' && ['Pending', 'Rejected'].indexOf(x.status) >= 0 ? '<button class="btn alt sm" data-del="' + esc(x.id) + '">Delete</button>' : '') + '</div>' +
          '<p class="muted">' + esc(x.requester_name || '') + ' · ' + esc(when(x.created_at)) + (x.notes ? ' · ' + esc(x.notes) : '') + '</p><div class="tbl"><table><tbody>' +
          (x.request_items || []).map(function (l) { return '<tr><td>' + esc(l.items ? l.items.name : '') + '</td><td class="num">' + fmt(l.fulfilled_qty) + ' / ' + fmt(l.requested_qty) + ' ' + esc(l.unit || '') + '</td><td>' + pill(l.status) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      }).join('') || '<div class="card">' + R.ui.empty(mine ? 'req' : 'search', mine ? 'No requests yet' : 'No requests found', mine ? 'Tap the + button to send your first request.' : 'Try a different ID, status or date range.') + '</div>';
      if (last.mv.length) {
        out.insertAdjacentHTML('beforeend', '<div class="card"><h2>Stock movements (' + last.mv.length + ')</h2><div class="tbl"><table><tbody>' + last.mv.map(function (m) {
          return '<tr><td class="muted">' + esc(when(m.ts)) + '</td><td>' + esc(m.type) + '</td><td>' + esc(m.items ? m.items.name : '') + '</td><td class="num">' + (m.signed_qty > 0 ? '+' : '') + fmt(m.signed_qty) + '</td><td class="muted hm">' + esc(m.reference || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>');
      }
    }
    function later() { clearTimeout(timer); timer = setTimeout(run, 250); }
    wire(box, st, later);
    out.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pr]'), d = e.target.closest('[data-del]');
      if (p) printSlips(last.reqs.filter(function (x) { return x.id === p.dataset.pr; }), p.dataset.pr);
      if (d) R.ui.confirm('Delete ' + d.dataset.del + '? This cannot be undone.', { title: 'Delete request', danger: true, ok: 'Delete' }).then(function (ok) { if (ok) act(d, async function () { await q(sb.from('requests').delete().eq('id', d.dataset.del)); toast('Deleted'); run(); }); });
    });
    $('#hp', box).onclick = function () { printSlips(last.reqs, 'Request slips'); };
    $('#hc', box).onclick = function () {
      var rows = [['Request', 'Type', 'Station', 'Requester', 'Status', 'Created', 'Item', 'Requested', 'Fulfilled', 'Unit']];
      last.reqs.forEach(function (x) { (x.request_items || []).forEach(function (l) { rows.push([x.id, x.type, x.station, x.requester_name, x.status, x.created_at, l.items && l.items.name, l.requested_qty, l.fulfilled_qty, l.unit]); }); });
      if (last.mv.length) { rows.push([]); rows.push(['When', 'Type', 'Item', 'Qty', 'Reference', 'Station', 'Supplier', 'User']); last.mv.forEach(function (m) { rows.push([m.ts, m.type, m.items && m.items.name, m.signed_qty, m.reference, m.station, m.supplier, m.user_name]); }); }
      csv('history-' + today() + '.csv', rows);
    };
    await run();
  };

  /* ---------- Reports (daily transactions, counts, waste, slips, stock levels) ---------- */
  V.reports = async function (box) {
    await R.loadCatalog(true);
    var st = F.rep; st.from = st.from || today(); st.to = st.to || today();
    box.innerHTML = '<div class="card"><h2>Reports</h2><div class="row"><label class="grow" style="margin:0">From<input type="date" id="rf" value="' + st.from + '"></label><label class="grow" style="margin:0">To<input type="date" id="rt" value="' + st.to + '"></label></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-r="txn">Daily transactions</button><button class="btn" data-r="count">Stock counts</button><button class="btn" data-r="waste">Waste</button><button class="btn" data-r="slips">Request slips (A6)</button><button class="btn" data-r="levels">Stock levels</button></div></div><div id="ro"></div>';
    var out = $('#ro', box);
    function show(rep) {
      out.innerHTML = '<div class="card"><div class="row"><h2 class="grow">' + esc(rep.title) + '</h2><button class="btn alt sm" id="rpb">Print</button><button class="btn alt sm" id="rcb">CSV</button></div><p class="muted">' + esc(rep.sub) + '</p><div class="tbl">' + rep.html + '</div></div>';
      $('#rpb', box).onclick = function () { printHtml(rep.title, docHead(rep.title, rep.sub) + rep.html + '<p class="gen">Generated by Rainbrew Inventory System.</p>', rep.size); };
      $('#rcb', box).onclick = function () { csv(rep.file + '-' + st.from + '_' + st.to + '.csv', rep.csv); };
    }
    var BUILD = {
      txn: async function (b) {
        var res = await Promise.all([
          q(sb.from('requests').select(REQSEL).gte('created_at', b[0]).lt('created_at', b[1]).order('created_at')),
          q(sb.from('stock_movements').select('ts,type,signed_qty,reference,station,supplier,user_name,items(name,unit)').in('type', ['RECEIVE', 'RELEASE']).gte('ts', b[0]).lt('ts', b[1]).order('ts'))]);
        var reqs = res[0], mv = res[1], rcv = mv.filter(function (m) { return m.type === 'RECEIVE'; }), rel = mv.filter(function (m) { return m.type === 'RELEASE'; });
        var lines = [].concat.apply([], reqs.map(function (r) { return (r.request_items || []).map(function (l) { return [r.id, l.items && l.items.name, fmt(l.requested_qty) + ' ' + (l.unit || ''), fmt(l.fulfilled_qty) + ' ' + (l.unit || ''), fmt(l.remaining_qty) + ' ' + (l.unit || ''), l.status]; }); }));
        var rq = reqs.map(function (r) { return [r.id, when(r.created_at), r.type === 'Purchase' ? 'Buy request' : 'Stock request', r.requester_name, r.station, r.status, r.notes]; });
        var rv = rcv.map(function (m) { return [when(m.ts), m.reference, m.items && m.items.name, fmt(m.signed_qty) + ' ' + (m.items ? m.items.unit : ''), m.supplier, m.user_name]; });
        var rl = rel.map(function (m) { return [when(m.ts), m.reference, m.items && m.items.name, fmt(-m.signed_qty) + ' ' + (m.items ? m.items.unit : ''), m.station, m.user_name]; });
        return { title: 'Daily Transaction Report', file: 'transactions', size: 'A4',
          html: '<h2>Requests</h2>' + table(['Request ID', 'Date / Time', 'Type', 'Requester', 'Station', 'Status', 'Notes'], rq) + '<h2>Request item details</h2>' + table(['Request', 'Item', 'Requested', 'Fulfilled', 'Remaining', 'Status'], lines) +
            '<h2>Receiving transactions</h2>' + table(['When', 'Reference', 'Item', 'Qty', 'Supplier', 'By'], rv) + '<h2>Releases</h2>' + table(['When', 'Reference', 'Item', 'Qty', 'To station', 'By'], rl),
          csv: [['Section', 'A', 'B', 'C', 'D', 'E', 'F', 'G']].concat(rq.map(function (r) { return ['Request'].concat(r); }), lines.map(function (r) { return ['Request item'].concat(r); }), rv.map(function (r) { return ['Receiving'].concat(r); }), rl.map(function (r) { return ['Release'].concat(r); })) };
      },
      count: async function (b) {
        var res = await Promise.all([
          q(sb.from('stock_counts').select('count_id,ts,system_qty,counted_qty,variance,counted_by,items(name,unit)').gte('ts', b[0]).lt('ts', b[1]).order('ts').order('id')),
          q(sb.from('station_stock_snapshots').select('snapshot_id,ts,location,counted_qty,counted_by,items(name,unit)').gte('ts', b[0]).lt('ts', b[1]).order('ts'))]);
        var c = res[0].map(function (x) { return ['Stock Room', x.count_id, x.items && x.items.name, fmt(x.system_qty), fmt(x.counted_qty), (x.variance > 0 ? '+' : '') + fmt(x.variance), x.counted_by, when(x.ts)]; });
        var sn = res[1].map(function (x) { return [x.location, x.snapshot_id, x.items && x.items.name, fmt(x.counted_qty), x.counted_by, when(x.ts)]; });
        var off = res[0].filter(function (x) { return Number(x.variance) !== 0; }).length;
        return { title: 'Stock Count Report', file: 'stock-counts', size: 'A4',
          html: '<p>' + res[0].length + ' counted line(s), ' + off + ' with a difference.</p>' + table(['Location', 'Count', 'Item', 'System', 'Counted', 'Difference', 'Counted by', 'When'], c, [3, 4, 5]) + '<h2>Station snapshots (log only)</h2>' + table(['Station', 'Snapshot', 'Item', 'Counted', 'By', 'When'], sn, [3]),
          csv: [['Location', 'Count', 'Item', 'System', 'Counted', 'Difference', 'Counted by', 'When']].concat(c, [[]], sn) };
      },
      waste: async function (b) {
        var res = await Promise.all([
          q(sb.from('stock_movements').select('ts,signed_qty,reference,user_name,note,items(name,unit)').eq('type', 'WASTE').gte('ts', b[0]).lt('ts', b[1]).order('ts')),
          q(sb.from('station_waste_log').select('log_id,ts,station,qty,unit,reason,note,user_name,items(name)').gte('ts', b[0]).lt('ts', b[1]).order('ts'))]);
        var a = res[0].map(function (m) { return [when(m.ts), m.reference, m.items && m.items.name, fmt(-m.signed_qty) + ' ' + (m.items ? m.items.unit : ''), m.note, m.user_name]; });
        var s = res[1].map(function (m) { return [when(m.ts), m.log_id, m.station, m.items && m.items.name, fmt(m.qty) + ' ' + (m.unit || ''), m.reason || m.note, m.user_name]; });
        return { title: 'Waste Report', file: 'waste', size: 'A4',
          html: '<h2>Stock room waste (deducted)</h2>' + table(['When', 'Ref', 'Item', 'Qty', 'Reason', 'By'], a) + '<h2>Station waste (log only)</h2>' + table(['When', 'Ref', 'Station', 'Item', 'Qty', 'Reason', 'By'], s),
          csv: [['When', 'Ref', 'Item', 'Qty', 'Reason', 'By']].concat(a, [[]], [['When', 'Ref', 'Station', 'Item', 'Qty', 'Reason', 'By']], s) };
      },
      slips: async function (b) {
        var reqs = await q(sb.from('requests').select(REQSEL).gte('created_at', b[0]).lt('created_at', b[1]).order('created_at'));
        var rows = [['Request', 'Type', 'Station', 'Status', 'Item', 'Qty', 'Unit']];
        reqs.forEach(function (r) { (r.request_items || []).forEach(function (l) { rows.push([r.id, r.type, r.station, r.status, l.items && l.items.name, l.requested_qty, l.unit]); }); });
        return { title: 'Request Archive (A6)', file: 'request-slips', size: 'A6', html: reqs.map(slip).join('') || '<p class="no">No requests in this period.</p>', csv: rows };
      },
      levels: async function () {
        var items = S.items.filter(function (i) { return i.active; });
        var byCat = {}; items.forEach(function (i) { (byCat[i.category || 'Uncategorised'] = byCat[i.category || 'Uncategorised'] || []).push(i); });
        return { title: 'Stock Level Report', file: 'stock-levels', size: 'A4',
          html: Object.keys(byCat).sort().map(function (c) { return '<h2>' + esc(c) + '</h2>' + table(['Item', 'Location', 'Stock', 'Unit', 'Status'], byCat[c].map(function (i) { return [i.name, (i.stocked_at || []).join(' / '), fmt(i.current_stock), i.unit, i.status]; }), [2]); }).join(''),
          csv: [['Category', 'Item', 'Location', 'Stock', 'Unit', 'Status']].concat(items.map(function (i) { return [i.category, i.name, (i.stocked_at || []).join(' / '), i.current_stock, i.unit, i.status]; })) };
      }
    };
    box.querySelectorAll('[data-r]').forEach(function (btn) {
      btn.onclick = function () {
        act(btn, async function () {
          st.from = $('#rf', box).value; st.to = $('#rt', box).value;
          if (!st.from || !st.to || st.to < st.from) throw new Error('Pick a valid date range');
          out.innerHTML = '<div class="skeleton"></div>';
          var rep = await BUILD[btn.dataset.r](bounds(st.from, st.to));
          rep.sub = st.from === st.to ? st.from : st.from + ' to ' + st.to;
          show(rep);
        });
      };
    });
  };

  /* ---------- Items (filters, health check, add item with opening balance, full editor) ---------- */
  function icon_info() { return R.icon('info', 'sm'); }
  V.items = async function (box) {
    await R.loadCatalog(true);
    var res = await Promise.all([R.suppliers(), q(sb.from('locations').select('name,type,active').order('name')), q(sb.from('profiles').select('name,role,station,approved,active'))]);
    var sups = S.suppliers = res[0], locs = res[1], people = res[2], st = F.items, sm = supMap();
    var np = R.takeNav(); if (np.q) st.q = np.q;
    var supOpts = sups.map(function (s) { return { value: s.id, label: s.name }; });
    var act_ = S.items.filter(function (i) { return i.active; });
    var checks = [
      ['nosup', 'Items without a supplier', act_.filter(function (i) { return !i.supplier_id; }).length],
      ['noreorder', 'Items without a reorder point (no low-stock alert)', act_.filter(function (i) { return i.reorder_point == null; }).length],
      ['nocrit', 'Items without a critical level', act_.filter(function (i) { return i.critical_level == null; }).length],
      ['nopar', 'Items without a PAR / target', act_.filter(function (i) { return i.par_target == null; }).length],
      ['noloc', 'Items without a stock room location', act_.filter(function (i) { return !(i.stocked_at || []).length; }).length],
      ['neg', 'Items with negative stock', act_.filter(function (i) { return Number(i.current_stock) < 0; }).length]];
    var pend = people.filter(function (p) { return !p.approved; }).length, nost = people.filter(function (p) { return p.active && p.approved && (p.role === 'Station Staff' || p.role === 'Requester') && !p.station; }).map(function (p) { return p.name; });
    var NEED = { nosup: function (i) { return !i.supplier_id; }, noreorder: function (i) { return i.reorder_point == null; }, nocrit: function (i) { return i.critical_level == null; }, nopar: function (i) { return i.par_target == null; }, noloc: function (i) { return !(i.stocked_at || []).length; }, neg: function (i) { return Number(i.current_stock) < 0; }, inactive: function (i) { return !i.active; } };
    var COLS = [
      { f: 'name', h: 'Item', w: 240, k: 'txt' }, { f: 'current_stock', h: 'In stock', w: 84, k: 'ro', num: 1 }, { f: 'category', h: 'Category', w: 160, k: 'txt' }, { f: 'unit', h: 'Unit', w: 90, k: 'unit' },
      { f: 'supplier_id', h: 'Supplier', w: 180, k: 'sup' }, { f: 'purchase_unit', h: 'Buy unit', w: 100, k: 'txt' }, { f: 'order_multiple', h: 'Order in', w: 90, k: 'num', num: 1 }, { f: 'lead_time_days', h: 'Lead days', w: 90, k: 'num', num: 1 },
      { f: 'reorder_point', h: 'Reorder at', w: 100, k: 'num', num: 1 }, { f: 'critical_level', h: 'Critical at', w: 100, k: 'num', num: 1 }, { f: 'par_target', h: 'PAR', w: 90, k: 'num', num: 1 },
      { f: 'alt_supplier_1_id', h: 'Alt supplier 1', w: 170, k: 'sup' }, { f: 'alt_supplier_2_id', h: 'Alt supplier 2', w: 170, k: 'sup' }, { f: 'stocked_at', h: 'Stock room', w: 170, k: 'arr' }, { f: 'used_by', h: 'Used by', w: 190, k: 'arr' },
      { f: 'pack_conversion', h: 'Pack / conversion', w: 150, k: 'txt' }, { f: 'notes', h: 'Notes', w: 220, k: 'txt' }, { f: 'active', h: 'On', w: 60, k: 'chk' }];
    var notes = [];
    if (pend) notes.push(pend + ' account(s) waiting for approval — see People');
    if (nost.length) notes.push('No station set for: ' + nost.join(', '));
    var needLabel = function (k, t) { var n = (checks.filter(function (c) { return c[0] === k; })[0] || [0, 0, 0])[2]; return { value: k, label: t + (n ? ' (' + n + ')' : '') }; };
    box.innerHTML = (notes.length ? '<div class="card note">' + icon_info() + '<span>' + esc(notes.join(' · ')) + '</span></div>' : '') + '<div class="tools2">' +
      '<details class="card"><summary><b>Add item</b></summary><div class="row" style="margin-top:8px"><input id="an" class="grow" placeholder="Item name"><input id="ac" list="cl" class="grow" placeholder="Category"><select id="au" style="max-width:110px">' + opts(UNITS, '', 'Unit') + '</select></div>' +
      '<div class="row" style="margin-top:8px"><input id="al" list="ll" class="grow" placeholder="Stock room / location (comma separated)"><input id="as" list="sl" class="grow" placeholder="Used by stations (comma separated)"></div>' +
      '<div class="row" style="margin-top:8px"><select id="ap" class="grow sup-sel">' + R.supOptions(sups, '', 'Supplier') + '</select><input id="ab" style="max-width:110px" placeholder="Buy unit"><input id="ak" style="max-width:130px" placeholder="Pack / conversion"></div>' +
      '<div class="row" style="margin-top:8px"><input id="ar" type="number" step="any" placeholder="Reorder at"><input id="ax" type="number" step="any" placeholder="Critical at"><input id="ag" type="number" step="any" placeholder="PAR / target"><input id="ao" type="number" step="any" placeholder="Opening stock"></div>' +
      '<div style="margin-top:10px"><button class="btn" id="aadd">Add item</button></div><datalist id="cl">' + cats().map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist><datalist id="ll">' + locs.filter(function (l) { return l.type === 'Stock Room'; }).map(function (l) { return '<option value="' + esc(l.name) + '">'; }).join('') + '</datalist><datalist id="sl">' + locs.filter(function (l) { return l.type === 'Station'; }).map(function (l) { return '<option value="' + esc(l.name) + '">'; }).join('') + '</datalist></details>' +
      '<details class="card"><summary><b>Suppliers (' + sups.length + ')</b></summary><div class="row" style="margin:8px 0"><input id="sn" class="grow" placeholder="New supplier name"><button class="btn alt" id="sadd">Add supplier</button></div><div class="tbl"><table><thead><tr><th>Supplier</th><th class="num">Items</th><th></th></tr></thead><tbody id="sl2">' +
        sups.map(function (sp) { var n = S.items.filter(function (i) { return i.supplier_id === sp.id || i.alt_supplier_1_id === sp.id || i.alt_supplier_2_id === sp.id; }).length; return '<tr data-sid="' + sp.id + '"><td><input data-sf value="' + esc(sp.name) + '"></td><td class="num">' + n + '</td><td>' + (n ? '' : '<button class="btn alt sm" data-sdel>Delete</button>') + '</td></tr>'; }).join('') + '</tbody></table></div></details></div>' +
      fbar([{ t: 's', k: 'q', ph: 'Search items…' }, { t: 'c', k: 'cat', ph: 'All categories', o: cats() }, { t: 'c', k: 'sup', ph: 'All suppliers', o: supOpts },
        { t: 'c', k: 'need', ph: 'All items', o: [needLabel('nosup', 'No supplier'), needLabel('noreorder', 'No reorder point'), needLabel('nocrit', 'No critical level'), needLabel('nopar', 'No PAR'), needLabel('noloc', 'No location'), needLabel('neg', 'Negative stock'), { value: 'inactive', label: 'Inactive' }] }], st) +
      '<p class="muted" id="ihint" style="margin:0 0 8px"><span id="icount"></span> · Click a cell and type. <b>Tab</b> moves right, <b>Enter</b> moves down, <b>Ctrl+D</b> fills down, and you can paste cells copied from Google Sheets. Changes save by themselves. <span id="isave" class="isave"></span></p>' +
      '<div class="sheet-wrap"><table class="sheet items"><colgroup>' + COLS.map(function (c) { return '<col style="width:' + c.w + 'px">'; }).join('') + '</colgroup><thead><tr>' + COLS.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + '>' + esc(c.h) + '</th>'; }).join('') + '</tr></thead><tbody id="it"></tbody></table></div>';
    var pendingSaves = 0;
    function status(t, cls) { var el = $('#isave', box); if (el) { el.textContent = t; el.className = 'isave ' + (cls || ''); } }
    function cell(i, c) {
      var v = i[c.f], lab = ' aria-label="' + esc(c.h) + '"';
      if (c.k === 'ro') return '<td class="num ro" data-label="' + esc(c.h) + '">' + fmt(v) + '</td>';
      if (c.k === 'chk') return '<td class="ck" data-label="' + esc(c.h) + '"><input type="checkbox" data-f="' + c.f + '"' + (v ? ' checked' : '') + lab + '></td>';
      if (c.k === 'unit') return '<td data-label="Unit"><select data-f="unit"' + lab + '>' + opts(UNITS.indexOf(v) >= 0 || !v ? UNITS : UNITS.concat([v]), v || '', '—') + '</select></td>';
      if (c.k === 'sup') return '<td data-label="' + esc(c.h) + '"><select data-f="' + c.f + '" class="sup-sel"' + lab + '>' + R.supOptions(S.suppliers, v || '', '—') + '</select></td>';
      if (c.k === 'arr') return '<td data-label="' + esc(c.h) + '"><input data-f="' + c.f + '" data-arr list="' + (c.f === 'stocked_at' ? 'll' : 'sl') + '" value="' + esc((v || []).join(', ')) + '"' + lab + '></td>';
      if (c.k === 'num') return '<td class="num" data-label="' + esc(c.h) + '"><input data-f="' + c.f + '" data-num inputmode="decimal" autocomplete="off" value="' + esc(v == null ? '' : v) + '"' + lab + '></td>';
      return '<td data-label="' + esc(c.h) + '"><input data-f="' + c.f + '"' + (c.f === 'category' ? ' list="cl"' : '') + ' autocomplete="off" value="' + esc(v || '') + '"' + lab + '></td>';
    }
    function draw() {
      var list = S.items.filter(function (i) { if (st.need === 'inactive') return !i.active && hit(i, st); return (st.need ? NEED[st.need](i) && i.active : i.active) && hit(i, st); });
      $('#icount', box).textContent = list.length + ' item(s)';
      $('#it', box).innerHTML = list.map(function (i) { return '<tr data-id="' + i.id + '">' + COLS.map(function (c) { return cell(i, c); }).join('') + '</tr>'; }).join('') || '<tr><td colspan="' + COLS.length + '" class="muted" style="padding:14px">No items match.</td></tr>';
    }
    wire(box, st, draw); draw();
    box.querySelectorAll('[data-need]').forEach(function (b) { b.onclick = function () { st.need = b.dataset.need; $('[data-k=need]', box).value = st.need; draw(); $('#it', box).scrollIntoView({ behavior: 'smooth' }); }; });
    var tb = $('#it', box);
    function save(id, patch, el) {
      el.classList.remove('bad'); pendingSaves++; status('Saving…', '');
      sb.from('items').update(patch).eq('id', id).then(function (res) {
        pendingSaves--;
        if (res.error) { el.classList.add('bad'); status(res.error.message, 'err'); toast(res.error.message, true); return; }
        var it = S.map.get(id); if (it) Object.assign(it, patch);
        R.markDirty(); if (!pendingSaves) status('All changes saved', 'ok');
      });
    }
    tb.addEventListener('change', function (e) {
      var el = e.target, f = el.dataset.f; if (!f) return;
      var id = el.closest('tr').dataset.id, v;
      if (f === 'active') v = el.checked;
      else if (el.hasAttribute('data-arr')) v = el.value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean);
      else if (el.hasAttribute('data-num')) {
        var t = el.value.trim().replace(/,/g, '');
        if (t === '') v = null; else { v = Number(t); if (!isFinite(v) || v < 0) { el.classList.add('bad'); status('"' + el.value + '" is not a number', 'err'); return; } }
      } else { v = el.value === '' ? null : el.value; if (f === 'name') { v = (v || '').trim().toUpperCase(); if (!v) { el.classList.add('bad'); status('An item needs a name', 'err'); return; } el.value = v; } }
      var patch = {}; patch[f] = v; save(id, patch, el);
    });
    function cellAt(tr, col) { var td = tr && tr.children[col]; return td && td.querySelector('input:not([type=checkbox]),select,input[type=checkbox]'); }
    function colOf(el) { return [].indexOf.call(el.closest('tr').children, el.closest('td')); }
    function go(el, tr) { var n = cellAt(tr, colOf(el)); if (n) { n.focus(); if (n.select && n.tagName === 'INPUT' && n.type !== 'checkbox') n.select(); } }
    tb.addEventListener('keydown', function (e) {
      var el = e.target; if (!el.dataset || !el.dataset.f) return; var tr = el.closest('tr');
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); go(el, e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling); }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.tagName === 'INPUT' && el.type !== 'checkbox') { e.preventDefault(); go(el, e.key === 'ArrowDown' ? tr.nextElementSibling : tr.previousElementSibling); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); var above = cellAt(tr.previousElementSibling, colOf(el)); if (!above || el.readOnly) return;
        if (el.type === 'checkbox') el.checked = above.checked; else el.value = above.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    function setCell(el, val) {
      val = String(val == null ? '' : val).trim();
      if (el.tagName === 'SELECT') {
        var opt = [].filter.call(el.options, function (o) { return o.value !== '__new__' && (o.text.trim().toUpperCase() === val.toUpperCase() || o.value === val); })[0];
        if (!opt && val !== '') { status('"' + val + '" is not in the list for ' + el.getAttribute('aria-label'), 'err'); return; }
        el.value = opt ? opt.value : '';
      } else if (el.type === 'checkbox') el.checked = /^(true|yes|y|1|x|on)$/i.test(val);
      else el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    tb.addEventListener('paste', function (e) {
      var el = e.target.closest ? e.target.closest('[data-f]') : null; if (!el) return;
      var txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\r/g, '').replace(/\n$/, '');
      if (txt.indexOf('\t') < 0 && txt.indexOf('\n') < 0) return;
      e.preventDefault();
      var col = colOf(el), tr = el.closest('tr');
      txt.split('\n').forEach(function (line) {
        if (!tr) return;
        line.split('\t').forEach(function (val, k) { var c = cellAt(tr, col + k); if (c && !c.readOnly) setCell(c, val); });
        tr = tr.nextElementSibling;
      });
    });
    $('#aadd', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        function v(id) { return $('#' + id, box).value.trim(); }
        function list(id) { return v(id).split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); }
        if (!v('an')) throw new Error('Enter an item name');
        var p = { name: v('an'), category: v('ac'), unit: v('au'), stocked_at: list('al'), used_by: list('as'), supplier_id: v('ap'), purchase_unit: v('ab'), pack_conversion: v('ak'), reorder_point: v('ar'), critical_level: v('ax'), par_target: v('ag') };
        await rpc('add_item', { p: p, p_opening: v('ao') === '' ? null : +v('ao') });
        toast('Item added'); await R.loadCatalog(true); R.show('items');
      });
    };
    $('#sl2', box).addEventListener('change', function (e) {
      var inp = e.target.closest('[data-sf]'); if (!inp) return;
      var nm = inp.value.trim().toUpperCase(); if (!nm) return;
      sb.from('suppliers').update({ name: nm }).eq('id', inp.closest('tr').dataset.sid).then(function (r) { if (r.error) return toast(r.error.message, true); S.suppliers = null; toast('Saved'); });
    });
    $('#sl2', box).addEventListener('click', function (e) {
      var d = e.target.closest('[data-sdel]'); if (!d) return; R.ui.confirm('Delete this supplier?', { title: 'Delete supplier', danger: true, ok: 'Delete' }).then(function (ok) { if (!ok) return;
      act(d, async function () { await q(sb.from('suppliers').delete().eq('id', d.closest('tr').dataset.sid)); S.suppliers = null; toast('Deleted'); R.show('items'); }); });
    });
    $('#sadd', box).onclick = function (e) {
      act(e.currentTarget, async function () {
        var name = $('#sn', box).value.trim().toUpperCase(); if (!name) throw new Error('Enter a supplier name');
        await q(sb.from('suppliers').insert({ name: name }));
        S.suppliers = null; toast('Supplier added'); R.show('items');
      });
    };
  };
})();
