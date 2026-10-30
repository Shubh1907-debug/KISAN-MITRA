// Price accuracy: compares the prices the app shows (/api/prices) with a FRESH, separate pull from data.gov.in.
// Run (server must be running with DATA_GOV_API_KEY set):   node tests/price_accuracy.js
// Optional: APP=http://localhost:3000  DATA_GOV_API_KEY=...  (the key is read from .env if present)
const fs = require('fs'), path = require('path');
try { fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) {}
const APP = process.env.APP || 'http://localhost:3000', KEY = process.env.DATA_GOV_API_KEY;
const RES = '9ef84268-d588-465a-a308-a864a43d0070', STATE = process.env.MANDI_STATE || 'Madhya Pradesh';
const COMM = { wheat: 'Wheat', soybean: 'Soyabean', gram: 'Bengal Gram(Gram)(Whole)', mustard: 'Mustard', paddy: 'Paddy(Dhan)(Common)', maize: 'Maize', onion: 'Onion', potato: 'Potato', tomato: 'Tomato', cotton: 'Cotton' };
const iso = s => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : null; };
(async () => {
  if (!KEY) { console.log('DATA_GOV_API_KEY not set. Put it in .env or the environment.'); process.exit(1); }
  const app = await (await fetch(APP + '/api/prices')).json();
  if (!app.live) { console.log('App is NOT showing live data (sample mode). Check the key and restart the server.'); process.exit(1); }
  let total = 0, match = 0, tol = 0; const bad = [];
  for (const [crop, name] of Object.entries(COMM)) {
    const u = new URL('https://api.data.gov.in/resource/' + RES);
    u.search = new URLSearchParams({ 'api-key': KEY, format: 'json', limit: '1000', 'filters[state]': STATE, 'filters[commodity]': name });
    const d = await (await fetch(u)).json(); const g = {};
    for (const r of d.records || []) {            // independent re-computation: modal price averaged over markets of a district on the latest date
      const dist = String(r.district || '').trim(), day = iso(r.arrival_date), m = parseFloat(r.modal_price);
      if (!dist || !day || !(m > 0)) continue;
      ((g[dist] = g[dist] || {})[day] = g[dist][day] || []).push(m);
    }
    for (const [dist, p] of Object.entries(app.prices[crop] || {})) {
      const key = Object.keys(g).find(k => k.toLowerCase() === dist.toLowerCase()); if (!key) continue;
      const days = Object.keys(g[key]).sort(), day = days.includes(p.date) ? p.date : days[days.length - 1];
      const arr = g[key][day], src = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
      total++; if (p.modal === src && p.date === day) match++; if (Math.abs(p.modal - src) <= Math.max(1, src * 0.01)) tol++;
      else bad.push(crop + ' / ' + dist + ': app ' + p.modal + ' (' + p.date + ') vs source ' + src + ' (' + day + ')');
    }
  }
  console.log('Compared ' + total + ' crop x mandi prices.');
  console.log('Exact match: ' + match + '/' + total + ' = ' + (100 * match / total).toFixed(1) + '%   (within 1%: ' + (100 * tol / total).toFixed(1) + '%)');
  if (bad.length) console.log('Mismatches:\n  ' + bad.join('\n  '));
})().catch(e => { console.log('Failed:', e.message); process.exit(1); });
