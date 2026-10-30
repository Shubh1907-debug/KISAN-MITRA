/* Kisan Mitra - Route Map tab (Madhya Pradesh). Roads: OSM via /api/route. Toll/road quality are estimates (see rt.note). */
(function () {
  'use strict';
  var T = function (k) { return (window.KM && KM.t) ? KM.t(k) : k; };
  var MANDIS = ['Gwalior','Bhopal','Indore','Ujjain','Sagar','Jabalpur','Morena','Shivpuri'];
  var GEO = { Gwalior:[26.2183,78.1828], Bhopal:[23.2599,77.4126], Indore:[22.7196,75.8577], Ujjain:[23.1765,75.7885], Sagar:[23.8388,78.7378], Jabalpur:[23.1815,79.9864], Morena:[26.4947,77.9930], Shivpuri:[25.4231,77.6600] };
  var MP_BOUNDS = [[22.2, 75.0], [27.4, 81.0]];        // Madhya Pradesh, zoomed on the mandi cities (approx.)
  var LBL_DOWN = { Gwalior: 1, Indore: 1, Sagar: 1 };   // label below the dot so close cities do not overlap
  var COLORS = ['#1b7f3b', '#d9822b', '#6b4bd6', '#c0392b'];
  var map, layers = [], data = null, tolls = {}, sel = null, stage = 0, pins = {};
  var trList = [], trId = null, trTimer = null, trMarker = null, trPin = null, trLine = null, trFirst = true;
  var $ = function (id) { return document.getElementById(id); };
  function mn(m) { return (window.KM && KM.mandi) ? KM.mandi(m) : m; }
  function tpl(k, p) { var t = T(k); if (p) for (var x in p) t = t.split('{' + x + '}').join(p[x]); return t; }

  function fill(sel_, def) {
    sel_.innerHTML = MANDIS.map(function (m) { return '<option value="' + m + '"' + (m === def ? ' selected' : '') + '>' + mn(m) + '</option>'; }).join('');
  }
  // lower score = better. Toll: user-entered rupees if given, otherwise NH km as a proxy.
  function score(r, i, pref) {
    var toll = tolls[i];
    if (pref === 'fast') return r.min;
    if (pref === 'short') return r.km;
    if (pref === 'toll') return toll != null && toll !== '' ? Number(toll) : r.nhKm * 2;
    return -((r.nhKm + r.shKm) / Math.max(r.km, 1));
  }
  function bestIndex() {
    var pref = $('rtPref').value, b = 0;
    data.routes.forEach(function (r, i) { if (score(r, i, pref) < score(data.routes[b], b, pref)) b = i; });
    return b;
  }

  /* ----- city pins on the map: tap to choose pickup, then selling city ----- */
  function pinHtml(m, c) { return '<div class="rt-pin ' + (LBL_DOWN[m] ? 'dn' : 'up') + '" style="--c:' + c + '"><b>' + mn(m) + '</b><i></i></div>'; }
  function pinIcon(m, c) { return L.divIcon({ className: '', html: pinHtml(m, c), iconSize: [120, 56], iconAnchor: [60, 28] }); }
  function refreshPins() {
    var f = $('rtFrom').value, t = $('rtTo').value;
    MANDIS.forEach(function (m) {
      var c = m === f ? '#1b7f3b' : m === t ? '#d9822b' : '#5b6b5a';
      pins[m].setIcon(pinIcon(m, c));
      pins[m].setZIndexOffset(m === f || m === t ? 800 : 0);
    });
  }
  function setStep() {
    var el = $('rtStep');
    if (stage === 0 && data) { el.className = 'rt-step done'; el.textContent = tpl('rt.done', { from: mn($('rtFrom').value), to: mn($('rtTo').value) }); }
    else { el.className = 'rt-step'; el.textContent = T(stage === 0 ? 'rt.step1' : 'rt.step2'); }
  }
  function tapCity(m) {
    if (stage === 0) { $('rtFrom').value = m; stage = 1; data = null; clearRoutes(); $('rtList').innerHTML = ''; refreshPins(); setStep(); loadTransporters(); }
    else {
      if (m === $('rtFrom').value) { $('rtStep').textContent = T('rt.same'); return; }
      $('rtTo').value = m; stage = 0; refreshPins(); go();
    }
  }
  function clearRoutes() { layers.forEach(function (l) { map.removeLayer(l); }); layers = []; }

  function card(r, i, best, isMain) {
    var hw = Math.round(100 * (r.nhKm + r.shKm) / Math.max(r.km, 1));
    return '<div style="border-left:6px solid ' + COLORS[i % 4] + ';padding:8px 12px;margin:8px 0;background:#fafafa;border-radius:8px">' +
      '<b>Route ' + (i + 1) + '</b>: ' + tpl('rt.sum', { km: r.km.toFixed(0), t: fmtDur(r.min) }) + '<br>' + tpl('rt.hwShort', { p: hw }) + (r.refs.length ? ' (' + r.refs.join(', ') + ')' : '') +
      ' · ' + (r.nhKm > 1 ? T('rt.tollYes') : T('rt.tollNo')) +
      '<br><label>' + T('rt.tollIn') + ' <input type="number" min="0" data-i="' + i + '" value="' + (tolls[i] == null ? '' : tolls[i]) + '" style="width:80px"></label>' +
      ' <button type="button" class="btn" data-use="' + i + '" style="margin-left:6px">' + T('rt.use') + '</button></div>';
  }
  function draw() {
    if (!data) return;
    var best = sel != null ? sel : bestIndex(), rs = data.routes, bounds = [];
    clearRoutes();
    rs.forEach(function (r, i) {
      var ll = r.coords.map(function (c) { return [c[1], c[0]]; });
      layers.push(L.polyline(ll, { color: COLORS[i % 4], weight: i === best ? 8 : 4, opacity: i === best ? 0.95 : 0.5 }).addTo(map));
      bounds = bounds.concat(ll);
    });
    if (trFirst || !trId) map.fitBounds(bounds, { padding: [30, 30] });
    var b = rs[best], others = rs.map(function (r, i) { return i; }).filter(function (i) { return i !== best; });
    $('rtList').innerHTML =
      '<div class="rt-best"><div class="big">' + T('rt.bestRoad') + '</div><div class="row2" style="font-size:1.1rem"><b>' + tpl('rt.sum', { km: b.km.toFixed(0), t: fmtDur(b.min) }) + '</b></div>' +
      '<div class="row2">' + tpl('rt.hwShort', { p: Math.round(100 * (b.nhKm + b.shKm) / Math.max(b.km, 1)) }) + (b.refs.length ? ' (' + b.refs.join(', ') + ')' : '') + ' · ' + (b.nhKm > 1 ? T('rt.tollYes') : T('rt.tollNo')) + '</div></div>' +
      (others.length ? '<details class="rt-all"><summary>' + tpl('rt.others', { n: others.length }) + '</summary>' + others.map(function (i) { return card(rs[i], i, best); }).join('') + '</details>' : '');
    $('rtList').querySelectorAll('input[data-i]').forEach(function (inp) {
      inp.addEventListener('change', function () { tolls[inp.dataset.i] = inp.value; draw(); });
    });
    $('rtList').querySelectorAll('button[data-use]').forEach(function (btn) {
      btn.addEventListener('click', function () { sel = Number(btn.dataset.use); draw(); });
    });
    setStep();
  }
  async function go() {
    var from = $('rtFrom').value, to = $('rtTo').value;
    if (from === to) { $('rtStep').textContent = T('rt.same'); return; }
    stage = 0; sel = null; tolls = {}; refreshPins();
    $('rtList').textContent = T('rt.loading');
    try {
      var r = await fetch('/api/route?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
      data = await r.json(); if (!r.ok) throw 0; trFirst = true; draw();
    } catch (e) { data = null; $('rtList').textContent = T('rt.err'); setStep(); }
  }
  /* ---------- Live transporter tracking (Rapido-style) ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function token() { var u = window.KM_USER && window.KM_USER(); return u && u.token; }
  function authFetch(url) { return fetch(url, { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); }); }
  function hav(a, b) {
    var R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDur(min) { return min < 60 ? Math.max(1, Math.round(min)) + ' ' + T('rt.tr.min') : (min / 60).toFixed(1) + ' ' + T('rt.tr.hr'); }
  function loadTransporters() {
    var sel = $('rtTrSel');
    if (!token()) { sel.innerHTML = ''; $('rtTrInfo').textContent = T('rt.tr.login'); return Promise.resolve(); }
    var from = $('rtFrom').value;
    return authFetch('/api/transporters').then(function (d) {
      trList = d.items.slice().sort(function (a, b) { return (b.areas.indexOf(from) >= 0) - (a.areas.indexOf(from) >= 0) || b.score - a.score; });
      var keep = sel.value;
      sel.innerHTML = trList.length ? trList.map(function (t) {
        var near = t.areas.indexOf(from) >= 0;
        return '<option value="' + esc(t.id) + '">' + esc(t.name) + ' — ' + esc(T('veh.' + t.vehicle)) + (t.demo ? ' (Demo)' : '') + ' · ' + esc(near ? tpl('rt.tr.serves', { from: (window.KM && KM.mandi) ? KM.mandi(from) : from }) : T('rt.tr.other')) + '</option>';
      }).join('') : '';
      if (keep) sel.value = keep;
      if (!trList.length) $('rtTrInfo').textContent = T('rt.tr.none');
    }).catch(function (e) { $('rtTrInfo').textContent = e.message; });
  }
  function truckIcon() { return L.divIcon({ className: '', html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 3px #0006)">🚚</div>', iconSize: [30, 30], iconAnchor: [15, 15] }); }
  function pollTrack() {
    if (!trId) return;
    if (!$('panel-route').classList.contains('active')) return;   // only poll while the Route Map tab is open
    authFetch('/api/transporters/track?ids=' + encodeURIComponent(trId)).then(function (d) {
      var p = d.items[0], t = trList.filter(function (x) { return x.id === trId; })[0], info = $('rtTrInfo');
      if (!p || !t) return;
      var head = '<b>' + esc(t.name) + '</b> · ' + esc(T('veh.' + t.vehicle)) + ' &nbsp; <a class="btn" href="tel:+91' + esc(t.phone.replace(/\D/g, '')) + '"' + (t.demo ? ' style="display:none"' : '') + '>📞 ' + esc(T('rt.tr.call')) + ' ' + esc(t.phone) + '</a>';
      if (!p.live) {
        if (trMarker) { map.removeLayer(trMarker); trMarker = null; } if (trLine) { map.removeLayer(trLine); trLine = null; }
        info.innerHTML = head + '<div style="margin-top:6px">' + esc(T('rt.tr.off')) + (p.lastTs ? ' ' + esc(tpl('rt.tr.offLast', { t: fmtDur((Date.now() - p.lastTs) / 60000) })) : '') + '</div>';
        return;
      }
      var pos = [p.lat, p.lng], pick = GEO[$('rtFrom').value];
      if (!trMarker) trMarker = L.marker(pos, { icon: truckIcon(), zIndexOffset: 1000 }).addTo(map); else trMarker.setLatLng(pos);
      if (pick) {
        if (!trPin) trPin = L.circleMarker(pick, { radius: 9, color: '#123522', fillColor: '#E2A33B', fillOpacity: 1, weight: 3 }).addTo(map);
        else trPin.setLatLng(pick);
        trPin.bindTooltip(tpl('rt.tr.pin', { from: (window.KM && KM.mandi) ? KM.mandi($('rtFrom').value) : $('rtFrom').value }));
        if (!trLine) trLine = L.polyline([pos, pick], { color: '#123522', weight: 3, dashArray: '6 8', opacity: .7 }).addTo(map); else trLine.setLatLngs([pos, pick]);
      }
      if (trFirst) { map.fitBounds(L.latLngBounds(pick ? [pos, pick] : [pos]).pad(0.4), { maxZoom: 11 }); trFirst = false; }
      var km = pick ? hav(pos, pick) * 1.3 : null, secs = Math.max(0, Math.round((d.now - p.ts) / 1000));
      info.innerHTML = head +
        '<div style="margin-top:6px"><span class="km-tag">' + esc(T('rt.tr.live')) + '</span> ' + esc(tpl('rt.tr.ago', { s: secs })) + (p.speed != null ? ' · ' + esc(tpl('rt.tr.speed', { k: Math.round(p.speed) })) : '') + '</div>' +
        (km != null ? '<div style="margin-top:4px">📍 ' + esc(tpl('rt.tr.dist', { km: Math.round(km), from: (window.KM && KM.mandi) ? KM.mandi($('rtFrom').value) : $('rtFrom').value })) + ' · ⏱ ' + esc(tpl('rt.tr.eta', { t: fmtDur(km / 35 * 60) })) + '</div>' : '') +
        (p.simulated ? '<div class="hint" style="margin-top:4px">⚠️ ' + esc(T('rt.tr.sim')) + '</div>' : '');
    }).catch(function () { $('rtTrInfo').insertAdjacentHTML('beforeend', '<div class="hint">' + esc(T('rt.tr.err')) + '</div>'); });
  }
  function startTrack() {
    if (!$('rtTrSel').value) return;
    stopTrack(true); trId = $('rtTrSel').value; trFirst = true;
    $('rtTrStop').classList.remove('hidden');
    map.invalidateSize(); pollTrack(); trTimer = setInterval(pollTrack, 5000);
  }
  function stopTrack(keepInfo) {
    clearInterval(trTimer); trTimer = null; trId = null;
    [trMarker, trPin, trLine].forEach(function (l) { if (l) map.removeLayer(l); }); trMarker = trPin = trLine = null;
    $('rtTrStop').classList.add('hidden'); if (!keepInfo) $('rtTrInfo').innerHTML = '';
  }
  function init() {
    if (!window.L || !$('rtMap')) return;
    fill($('rtFrom'), 'Gwalior'); fill($('rtTo'), 'Bhopal');
    map = L.map('rtMap', { minZoom: 5.5, zoomSnap: 0.25, maxBounds: [[19.5, 72.5], [28.5, 84.5]], maxBoundsViscosity: 0.9, tap: true });
    map.fitBounds(MP_BOUNDS);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 18 }).addTo(map);
    // Madhya Pradesh outline (from OpenStreetMap / Nominatim). If it cannot load, the map still works without it.
    fetch('https://nominatim.openstreetmap.org/search?q=Madhya+Pradesh,+India&format=json&polygon_geojson=1&limit=1&polygon_threshold=0.01')
      .then(function (r) { return r.json(); })
      .then(function (j) { if (j && j[0] && j[0].geojson) L.geoJSON(j[0].geojson, { style: { color: '#123522', weight: 2, dashArray: '6 6', fillColor: '#E2A33B', fillOpacity: 0.06 }, interactive: false }).addTo(map).bringToBack(); })
      .catch(function () {});
    MANDIS.forEach(function (m) {
      pins[m] = L.marker(GEO[m], { icon: pinIcon(m, '#5b6b5a'), keyboard: true, title: mn(m) }).addTo(map);
      pins[m].on('click', function () { tapCity(m); });
    });
    refreshPins(); setStep();
    $('rtGo').addEventListener('click', go);
    $('rtPref').addEventListener('change', function () { sel = null; draw(); });
    $('rtFrom').addEventListener('change', function () { refreshPins(); loadTransporters(); if (trId) { trFirst = true; pollTrack(); } });
    $('rtTo').addEventListener('change', function () { refreshPins(); go(); });
    $('rtFrom').addEventListener('change', go);
    $('rtSwap').addEventListener('click', function () { var f = $('rtFrom').value; $('rtFrom').value = $('rtTo').value; $('rtTo').value = f; refreshPins(); loadTransporters(); go(); });
    $('rtTrGo').addEventListener('click', startTrack);
    $('rtTrStop').addEventListener('click', function () { stopTrack(false); });
    if (window.KM && KM.onChange) KM.onChange(function () {
      var f = $('rtFrom').value, t = $('rtTo').value; fill($('rtFrom'), f); fill($('rtTo'), t); refreshPins(); setStep(); if (data) draw(); loadTransporters();
    });
    document.querySelector('[data-tab="route"]').addEventListener('click', function () {
      setTimeout(function () { map.invalidateSize(); map.fitBounds(MP_BOUNDS); if (!data) go(); loadTransporters(); if (trId) pollTrack(); }, 60);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
