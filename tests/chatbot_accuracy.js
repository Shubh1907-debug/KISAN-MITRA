// Chatbot accuracy: asks 15 questions whose correct answer is known from the app's own price data, then checks the reply.
// Run (server running, AI key set, ideally live prices):   node tests/chatbot_accuracy.js
// The check is automatic (right mandi name / right price in the reply); READ the printed answers too and fix any wrong verdict by hand.
const APP = process.env.APP || 'http://localhost:3000';
const NAMES = { wheat: 'Wheat', soybean: 'Soybean', gram: 'Gram', mustard: 'Mustard', maize: 'Maize', onion: 'Onion', potato: 'Potato', tomato: 'Tomato' };
(async () => {
  const pr = await (await fetch(APP + '/api/prices')).json();
  if (!pr.live) console.log('NOTE: prices are SAMPLE here (no live data), so "correct" is relative to sample numbers.');
  const crops = Object.keys(NAMES).map(id => ({ id, name: NAMES[id], mandiPrices: Object.entries((pr.prices || {})[id] || {}).map(([mandi, p]) => ({ mandi, price: p.modal, source: 'live' })) })).filter(c => c.mandiPrices.length >= 2);
  if (!crops.length) { console.log('No price data to build questions from (need live prices, or run the app UI sample mode manually).'); process.exit(1); }
  const context = { today: new Date().toISOString().slice(0, 10), dataSource: pr.live ? 'live: Agmarknet via data.gov.in' : 'sample', currency: 'INR per quintal', crops: crops.map(c => ({ name: c.name, mandiPrices: c.mandiPrices })) };
  const qs = [];
  crops.forEach(c => { const best = c.mandiPrices.slice().sort((a, b) => b.price - a.price)[0]; qs.push({ q: 'Which mandi gives the highest price for ' + c.name + ' right now?', expect: [best.mandi], why: 'best = ' + best.mandi + ' ₹' + best.price }); });
  crops.forEach(c => { const m = c.mandiPrices[0]; qs.push({ q: 'What is the ' + c.name + ' price in ' + m.mandi + '?', expect: [String(m.price), m.price.toLocaleString('en-IN')], why: m.mandi + ' = ₹' + m.price }); });
  const picked = qs.slice(0, 15); let ok = 0;
  for (const t of picked) {
    let text = '';
    try { const r = await fetch(APP + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: t.q, history: [], context, lang: 'en' }) }); text = (await r.json()).text || ''; } catch (e) { text = 'ERROR ' + e.message; }
    const pass = t.expect.some(e => text.replace(/,/g, '').includes(e.replace(/,/g, '')) || text.includes(e));
    if (pass) ok++;
    console.log((pass ? 'PASS ' : 'FAIL ') + t.q + '\n      expected: ' + t.why + '\n      answer:   ' + text.replace(/\s+/g, ' ').slice(0, 220));
  }
  console.log('\nChatbot accuracy: ' + ok + '/' + picked.length + ' = ' + (100 * ok / picked.length).toFixed(0) + '% correct');
})().catch(e => { console.log('Failed:', e.message); process.exit(1); });
