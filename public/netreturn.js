/* Break-even / net-return logic for Kisan Mitra (Round 1 prototype)
 * Pure functions: used by the browser (window.NetReturn), the server and the tests.
 *
 * What it does:  estimates the RANGE of extra money per kg from selling in a distant market
 *                after transport/loading and other charges.
 * What it never does: guarantee a price, verify a quote, or give harvest-timing advice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NetReturn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STATUSES = ['confirmed', 'heard', 'board', 'old', 'unsure'];
  var BLOCKING = ['old', 'unsure'];            // price too old/unknown -> no verdict
  var r2 = function (x) { return Math.round(x * 100) / 100; };
  var isNum = function (x) { return typeof x === 'number' && isFinite(x); };

  /** Break-even gap: how much higher the distant price must be than the nearby price. */
  function breakEven(c) {
    var low = (c.costLow || 0) + (c.otherLow || 0) - (c.localCostHigh || 0);
    var high = (c.costHigh || 0) + (c.otherHigh || 0) - (c.localCostLow || 0);
    return { low: r2(Math.max(0, low)), high: r2(Math.max(0, high)), rawLow: r2(low), rawHigh: r2(high) };
  }

  function validate(i) {
    var errors = [];
    var price = function (v, name) { if (!isNum(v) || v < 0.5 || v > 1000) errors.push(name + ' must be between 0.5 and 1000 Rs/kg'); };
    var cost = function (v, name) { if (!isNum(v) || v < 0 || v > 200) errors.push(name + ' must be between 0 and 200 Rs/kg'); };
    price(i.local, 'Nearby price');
    price(i.distant, 'Distant price');
    cost(i.costLow, 'Transport+loading (low)'); cost(i.costHigh, 'Transport+loading (high)');
    cost(i.otherLow, 'Other charges (low)'); cost(i.otherHigh, 'Other charges (high)');
    cost(i.localCostLow, 'Nearby selling cost (low)'); cost(i.localCostHigh, 'Nearby selling cost (high)');
    if (!isNum(i.qty) || i.qty < 1 || i.qty > 100000) errors.push('Quantity must be between 1 and 100000 kg');
    if (isNum(i.costLow) && isNum(i.costHigh) && i.costLow > i.costHigh) errors.push('Transport+loading: low cannot be above high');
    if (isNum(i.otherLow) && isNum(i.otherHigh) && i.otherLow > i.otherHigh) errors.push('Other charges: low cannot be above high');
    if (isNum(i.localCostLow) && isNum(i.localCostHigh) && i.localCostLow > i.localCostHigh) errors.push('Nearby selling cost: low cannot be above high');
    if (STATUSES.indexOf(i.localStatus) < 0) errors.push('Nearby price status is missing');
    if (STATUSES.indexOf(i.distantStatus) < 0) errors.push('Distant price status is missing');
    return errors;
  }

  /**
   * compute(input) ->
   *  { ok:false, errors:[...] }  or
   *  { ok:true, verdict:'POSITIVE'|'UNCLEAR'|'NOT_WORTH'|'NO_COMPARISON', confidence:'confirmed'|'unconfirmed',
   *    breakEven:{low,high}, perKg:{low,high}, total:{low,high}, grossGap, reasons:[...] }
   */
  function compute(i) {
    var errors = validate(i);
    if (errors.length) return { ok: false, errors: errors };

    var be = breakEven(i);
    var gross = r2(i.distant - i.local);
    var res = { ok: true, breakEven: be, grossGap: gross, reasons: [] };

    var blocked = [];
    if (BLOCKING.indexOf(i.localStatus) >= 0) blocked.push('nearby price is ' + (i.localStatus === 'old' ? 'older than today' : 'of unknown freshness'));
    if (BLOCKING.indexOf(i.distantStatus) >= 0) blocked.push('distant price is ' + (i.distantStatus === 'old' ? 'older than today' : 'of unknown freshness'));
    if (blocked.length) {
      res.verdict = 'NO_COMPARISON';
      res.confidence = 'none';
      res.reasons = blocked;
      return res;
    }

    // worst case: distant nets least, nearby nets most. best case is the opposite.
    var advLow = (i.distant - i.costHigh - i.otherHigh) - (i.local - i.localCostLow);
    var advHigh = (i.distant - i.costLow - i.otherLow) - (i.local - i.localCostHigh);
    res.perKg = { low: r2(advLow), high: r2(advHigh) };
    res.total = { low: r2(advLow * i.qty), high: r2(advHigh * i.qty) };

    if (advLow > 0) res.verdict = 'POSITIVE';
    else if (advHigh <= 0) res.verdict = 'NOT_WORTH';
    else res.verdict = 'UNCLEAR';

    res.confidence = (i.localStatus === 'confirmed' && i.distantStatus === 'confirmed') ? 'confirmed' : 'unconfirmed';
    return res;
  }

  /** Clean whatever the AI extractor returned. Anything out of range becomes null. */
  function sanitizeExtraction(o) {
    o = (o && typeof o === 'object') ? o : {};
    var num = function (v, lo, hi) {
      if (typeof v === 'string') v = parseFloat(v.replace(',', '.'));
      return (isNum(v) && v >= lo && v <= hi) ? r2(v) : null;
    };
    var range = function (x, lo, hi) {
      x = (x && typeof x === 'object') ? x : {};
      var a = num(x.low, lo, hi), b = num(x.high, lo, hi);
      if (a === null && b !== null) a = b;
      if (b === null && a !== null) b = a;
      if (a !== null && b !== null && a > b) { var t = a; a = b; b = t; }
      return { low: a, high: b };
    };
    var status = function (v) { return STATUSES.indexOf(v) >= 0 ? v : null; };
    var strs = function (arr) {
      return (Array.isArray(arr) ? arr : []).filter(function (s) { return typeof s === 'string' && s.trim(); })
        .slice(0, 5).map(function (s) { return s.trim().slice(0, 200); });
    };
    return {
      localPricePerKg: num(o.localPricePerKg, 0.5, 1000),
      distantPricePerKg: num(o.distantPricePerKg, 0.5, 1000),
      transportLoadingPerKg: range(o.transportLoadingPerKg, 0, 200),
      otherChargesPerKg: range(o.otherChargesPerKg, 0, 200),
      quantityKg: num(o.quantityKg, 1, 100000),
      localStatus: status(o.localStatus),
      distantStatus: status(o.distantStatus),
      needsClarification: strs(o.needsClarification),
      notes: (typeof o.notes === 'string') ? o.notes.trim().slice(0, 300) : '',
    };
  }

  /** Table rows for the printable card: for each nearby price, the distant price must exceed this range. */
  function cardRows(be, from, to, step) {
    var rows = [];
    for (var p = from; p <= to + 1e-9; p += step) {
      rows.push({ nearby: r2(p), needLow: r2(p + be.low), needHigh: r2(p + be.high) });
    }
    return rows;
  }


  /* ---------- Mandi-wise profit table (MP mandi portal style) ----------
   * All money is Rs per QUINTAL here. Prices are board (modal) prices, not quotes.
   * Transport options:
   *   auto  : cheapest vehicle (or the chosen one) from assumed average rates; a vehicle is paid in full
   *   perKm : farmer's own rate, Rs per quintal per km
   *   fixed : one Rs-per-quintal quote used for every other mandi
   */
  var VEHICLES = [
    { id: 'mini',    rate: 0.40, cap: 8,   kmh: 35 },
    { id: 'pickup',  rate: 0.32, cap: 15,  kmh: 40 },
    { id: 'tractor', rate: 0.22, cap: 60,  kmh: 22 },
    { id: 'truck',   rate: 0.20, cap: 100, kmh: 45 }
  ];
  function transportPerQtl(distKm, qty, t) {
    if (!(distKm >= 1)) return { perQtl: 0, vehicle: null };
    t = t || { mode: 'auto' };
    if (t.mode === 'fixed') return { perQtl: r2(Math.max(0, +t.fixedPerQtl || 0)), vehicle: null };
    if (t.mode === 'perKm') return { perQtl: r2(Math.max(0, +t.ratePerQtlKm || 0) * distKm), vehicle: null };
    var list = VEHICLES.filter(function (v) { return !t.vehicle || t.vehicle === 'any' || v.id === t.vehicle; });
    var best = null;
    list.forEach(function (v) {
      var perQ = Math.ceil(qty / v.cap) * v.cap * v.rate * distKm / qty;
      if (!best || perQ < best.perQtl) best = { perQtl: perQ, vehicle: v.id };
    });
    return { perQtl: r2(best.perQtl), vehicle: best.vehicle };
  }

  /**
   * mandiTable({ rows:[{mandi, modal, min, max, date, live, distKm}], local, qty, transport, other, localCost })
   *  -> { ok, rows:[...sorted best net first, each with transport, net, adv, advTotal], local, best, verdict, caution }
   * verdict: 'PROFIT' | 'SMALL' | 'NONE' | 'NO_LOCAL' | 'NO_DATA'
   */
  function mandiTable(o) {
    var qty = +o.qty;
    if (!(qty > 0 && qty <= 100000)) return { ok: false, error: 'qty' };
    var other = Math.max(0, +o.other || 0), localCost = Math.max(0, +o.localCost || 0);
    var rows = (o.rows || []).filter(function (r) { return isNum(r.modal) && r.modal > 0; }).map(function (r) {
      var isLocal = r.mandi === o.local;
      var tr = isLocal ? { perQtl: localCost, vehicle: null } : transportPerQtl(r.distKm, qty, o.transport);
      var charges = isLocal ? 0 : other;
      var net = r.modal - tr.perQtl - charges;
      return Object.assign({}, r, { isLocal: isLocal, transport: tr.perQtl, vehicle: tr.vehicle, other: charges, net: r2(net) });
    });
    var local = rows.filter(function (r) { return r.isLocal; })[0] || null;
    var res = { ok: true, rows: rows, local: local, best: null, verdict: 'NO_DATA', caution: [] };
    if (!rows.length) return res;
    rows.forEach(function (r) {
      r.adv = local ? r2(r.net - local.net) : null;
      r.advTotal = local ? r2(r.adv * qty) : null;
    });
    rows.sort(function (a, b) { return b.net - a.net; });
    if (!local) { res.verdict = 'NO_LOCAL'; res.best = rows[0]; return res; }
    var others = rows.filter(function (r) { return !r.isLocal; });
    if (!others.length) { res.verdict = 'NO_DATA'; return res; }
    var best = others[0];
    res.best = best;
    var threshold = Math.max(50, 0.04 * Math.max(local.net, 0));   // a gain below this can vanish with a small price move
    res.verdict = best.adv >= threshold ? 'PROFIT' : (best.adv > 0 ? 'SMALL' : 'NONE');
    if (!local.live || !best.live) res.caution.push('sample');
    if (other === 0) res.caution.push('other0');
    return res;
  }

  return { mandiTable: mandiTable, transportPerQtl: transportPerQtl, VEHICLES: VEHICLES, compute: compute, breakEven: breakEven, validate: validate, sanitizeExtraction: sanitizeExtraction, cardRows: cardRows, STATUSES: STATUSES };
});
