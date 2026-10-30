// Run:  node tests/netreturn.test.js
// Tests for the break-even / net-return logic (no network, no API keys needed).
const assert = require('assert');
const NR = require('../public/netreturn.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { console.log('  FAIL  ' + name + '\n        ' + e.message); process.exitCode = 1; }
}
const base = { qty: 100, localStatus: 'confirmed', distantStatus: 'confirmed',
  costLow: 4, costHigh: 6, otherLow: 0, otherHigh: 0, localCostLow: 0, localCostHigh: 0 };
const mk = o => Object.assign({}, base, o);

console.log('Break-even logic (SIMULATED CASE NUMBERS: Rs 14-24/kg quotes, Rs 4-6/kg transport+loading)');

test('T1 large gap: Rs14 vs Rs24 -> positive range Rs4-6/kg, Rs400-600 for 100 kg', () => {
  const r = NR.compute(mk({ local: 14, distant: 24 }));
  assert.strictEqual(r.verdict, 'POSITIVE');
  assert.deepStrictEqual(r.perKg, { low: 4, high: 6 });
  assert.deepStrictEqual(r.total, { low: 400, high: 600 });
  assert.strictEqual(r.confidence, 'confirmed');
});

test('T2 gap of Rs6: range crosses zero -> UNCLEAR, never "positive"', () => {
  const r = NR.compute(mk({ local: 18, distant: 24 }));
  assert.strictEqual(r.verdict, 'UNCLEAR');
  assert.deepStrictEqual(r.perKg, { low: 0, high: 2 });
});

test('T3 gap of Rs4: even the best case is zero -> NOT_WORTH', () => {
  const r = NR.compute(mk({ local: 20, distant: 24 }));
  assert.strictEqual(r.verdict, 'NOT_WORTH');
  assert.deepStrictEqual(r.perKg, { low: -2, high: 0 });
});

test('T4 distant price lower than nearby -> NOT_WORTH with negative range', () => {
  const r = NR.compute(mk({ local: 20, distant: 17 }));
  assert.strictEqual(r.verdict, 'NOT_WORTH');
  assert.ok(r.perKg.high < 0);
});

test('T5 old or unknown-age price -> NO verdict and NO money figures, but break-even gap is still shown', () => {
  for (const st of ['old', 'unsure']) {
    const r = NR.compute(mk({ local: 14, distant: 24, distantStatus: st }));
    assert.strictEqual(r.verdict, 'NO_COMPARISON');
    assert.strictEqual(r.perKg, undefined);
    assert.strictEqual(r.total, undefined);
    assert.deepStrictEqual({ low: r.breakEven.low, high: r.breakEven.high }, { low: 4, high: 6 });
    assert.ok(r.reasons.length >= 1);
  }
  const r2 = NR.compute(mk({ local: 14, distant: 24, localStatus: 'old' }));
  assert.strictEqual(r2.verdict, 'NO_COMPARISON');
});

test('T6 unconfirmed prices (heard / board) give a result but flagged "unconfirmed"', () => {
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, distantStatus: 'heard' })).confidence, 'unconfirmed');
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, localStatus: 'board', distantStatus: 'board' })).confidence, 'unconfirmed');
});

test('T7 other charges and nearby selling cost move the range correctly', () => {
  // distant 24, local 18. Other charges Rs1-2/kg; selling nearby also costs Rs0.5-1/kg
  const r = NR.compute(mk({ local: 18, distant: 24, otherLow: 1, otherHigh: 2, localCostLow: 0.5, localCostHigh: 1 }));
  // worst: (24-6-2) - (18-0.5) = 16-17.5 = -1.5 ; best: (24-4-1) - (18-1) = 19-17 = 2
  assert.deepStrictEqual(r.perKg, { low: -1.5, high: 2 });
  assert.strictEqual(r.verdict, 'UNCLEAR');
});

test('T8 invalid inputs are rejected with clear errors (no silent numbers)', () => {
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, qty: 0 })).ok, false);
  assert.strictEqual(NR.compute(mk({ local: -5, distant: 24 })).ok, false);
  assert.strictEqual(NR.compute(mk({ local: 14, distant: NaN })).ok, false);
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, costLow: 7, costHigh: 5 })).ok, false);
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, distantStatus: undefined })).ok, false);
  assert.strictEqual(NR.compute(mk({ local: 14, distant: 24, costHigh: 9999 })).ok, false);
});

test('T9 break-even gap never negative; card rows add the gap to each nearby price', () => {
  const be = NR.breakEven({ costLow: 4, costHigh: 6, otherLow: 0, otherHigh: 0, localCostLow: 0, localCostHigh: 0 });
  assert.deepStrictEqual({ low: be.low, high: be.high }, { low: 4, high: 6 });
  const be2 = NR.breakEven({ costLow: 1, costHigh: 2, otherLow: 0, otherHigh: 0, localCostLow: 0, localCostHigh: 5 });
  assert.strictEqual(be2.low, 0);
  const rows = NR.cardRows(be, 14, 18, 2);
  assert.deepStrictEqual(rows[0], { nearby: 14, needLow: 18, needHigh: 20 });
  assert.strictEqual(rows.length, 3);
});

test('T10 AI extraction is sanitised: absurd or wrong-type values become null, ranges ordered, text capped', () => {
  const s = NR.sanitizeExtraction({
    localPricePerKg: '18', distantPricePerKg: 99999, quantityKg: -3,
    transportLoadingPerKg: { low: 6, high: 4 }, otherChargesPerKg: { low: null, high: 'x' },
    localStatus: 'heard', distantStatus: 'definitely-confirmed',
    needsClarification: ['unit unclear', 5, '   ', 'x'.repeat(500)], notes: 'n'.repeat(900),
  });
  assert.strictEqual(s.localPricePerKg, 18);
  assert.strictEqual(s.distantPricePerKg, null);
  assert.strictEqual(s.quantityKg, null);
  assert.deepStrictEqual(s.transportLoadingPerKg, { low: 4, high: 6 });
  assert.deepStrictEqual(s.otherChargesPerKg, { low: null, high: null });
  assert.strictEqual(s.localStatus, 'heard');
  assert.strictEqual(s.distantStatus, null);
  assert.strictEqual(s.needsClarification.length, 2);
  assert.ok(s.needsClarification[1].length <= 200);
  assert.ok(s.notes.length <= 300);
  assert.deepStrictEqual(NR.sanitizeExtraction(null).transportLoadingPerKg, { low: null, high: null });
});

/* ---- mandi-wise profit table ---- */
const mrow = (mandi, modal, distKm, extra) => Object.assign({ mandi, modal, min: modal - 100, max: modal + 100, date: '2026-10-26', live: true, distKm }, extra || {});

test('M1 transport: own rate per quintal per km', () => {
  assert.strictEqual(NR.transportPerQtl(100, 20, { mode: 'perKm', ratePerQtlKm: 0.3 }).perQtl, 30);
  assert.strictEqual(NR.transportPerQtl(0.5, 20, { mode: 'perKm', ratePerQtlKm: 0.3 }).perQtl, 0);   // same place
});
test('M2 transport: fixed quote applies to every other mandi only', () => {
  assert.strictEqual(NR.transportPerQtl(200, 20, { mode: 'fixed', fixedPerQtl: 45 }).perQtl, 45);
  assert.strictEqual(NR.transportPerQtl(0, 20, { mode: 'fixed', fixedPerQtl: 45 }).perQtl, 0);
});
test('M3 transport auto: a part-filled big truck costs more per quintal than a small one', () => {
  const r = NR.transportPerQtl(100, 8, { mode: 'auto' });
  assert.strictEqual(r.vehicle, 'mini');                       // 8 quintal fits one mini truck exactly: 8*0.4*100/8 = 40
  assert.strictEqual(r.perQtl, 40);
  assert.strictEqual(NR.transportPerQtl(100, 8, { mode: 'auto', vehicle: 'truck' }).perQtl, 250);  // pays for the full 100 qtl truck: 100*0.2*100/8
});
test('M4 far mandi pays more but transport eats it -> sell locally (NONE)', () => {
  const r = NR.mandiTable({ qty: 20, local: 'Gwalior', transport: { mode: 'perKm', ratePerQtlKm: 0.3 }, other: 0,
    rows: [mrow('Gwalior', 2400, 0), mrow('Indore', 2500, 400)] });
  assert.strictEqual(r.verdict, 'NONE');                      // 2500 - 120 = 2380 < 2400
  assert.strictEqual(r.best.mandi, 'Indore');
  assert.strictEqual(r.best.adv, -20);
});
test('M5 clear profit: net after transport and charges beats local by margin', () => {
  const r = NR.mandiTable({ qty: 20, local: 'Gwalior', transport: { mode: 'perKm', ratePerQtlKm: 0.3 }, other: 20,
    rows: [mrow('Gwalior', 2300, 0), mrow('Morena', 2600, 40), mrow('Indore', 2700, 400)] });
  assert.strictEqual(r.verdict, 'PROFIT');
  assert.strictEqual(r.best.mandi, 'Morena');                 // 2600-12-20 = 2568 vs Indore 2700-120-20 = 2560
  assert.strictEqual(r.best.net, 2568);
  assert.strictEqual(r.best.adv, 268);
  assert.strictEqual(r.best.advTotal, 5360);
  assert.strictEqual(r.rows[0].mandi, 'Morena');              // sorted best net first
});
test('M6 tiny gain (below the safety margin) is SMALL, not PROFIT', () => {
  const r = NR.mandiTable({ qty: 10, local: 'Gwalior', transport: { mode: 'fixed', fixedPerQtl: 30 }, other: 0,
    rows: [mrow('Gwalior', 2400, 0), mrow('Morena', 2450, 40)] });
  assert.strictEqual(r.best.adv, 20);
  assert.strictEqual(r.verdict, 'SMALL');
});
test('M7 no price for the local mandi -> NO_LOCAL, still ranks the others', () => {
  const r = NR.mandiTable({ qty: 10, local: 'Sagar', transport: { mode: 'fixed', fixedPerQtl: 30 }, rows: [mrow('Gwalior', 2400, 100), mrow('Morena', 2450, 140)] });
  assert.strictEqual(r.verdict, 'NO_LOCAL');
  assert.strictEqual(r.rows.length, 2);
});
test('M8 sample prices and zero other-charges add cautions; bad qty is rejected', () => {
  const r = NR.mandiTable({ qty: 10, local: 'Gwalior', transport: { mode: 'fixed', fixedPerQtl: 10 }, other: 0,
    rows: [mrow('Gwalior', 2000, 0, { live: false }), mrow('Morena', 2600, 40, { live: false })] });
  assert.deepStrictEqual(r.caution, ['sample', 'other0']);
  assert.strictEqual(NR.mandiTable({ qty: 0, local: 'Gwalior', rows: [] }).ok, false);
  assert.strictEqual(NR.mandiTable({ qty: 5, local: 'Gwalior', rows: [] }).verdict, 'NO_DATA');
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));
