# Kisan Mitra - asli mandi bhaav + weather + price forecast

## Chalane ke steps
1. Node.js 18+ install kijiye (nodejs.org). Check: `node -v`
2. `.env.example` ko copy karke `.env` naam dijiye aur do keys bharaiye:
   - GEMINI_API_KEY      -> aistudio.google.com/apikey (free)
   - DATA_GOV_API_KEY    -> data.gov.in par register/login -> My Account -> API key (free)
3. Is folder mein terminal kholiye:  `node server.js`
4. Browser: http://localhost:3000

## Features
- Price Comparison / Market Trends / Estimated Returns: DATA_GOV_API_KEY ho to ASLI (Agmarknet) bhaav, warna sample.
- Weather tab: 8 mandi shehron ka 7 din ka mausam + koi bhi shehar/gaon search (Open-Meteo, key nahi chahiye).
- Price Forecast tab: price trend + mausam + AI explanation.
- AI Assistant: live data par based jawab.

## Break-even Check (Round 1 prototype tab)
New tab "Break-even Check": estimates the net advantage of a distant market as a **range**, after transport + loading and other charges.
- No price guarantee, does not verify prices, gives no harvest-timing advice (a Version 1 limitation).
- Every price gets a status (confirmed / heard / board / old / unsure). An old or unknown-age price gives no rupee estimate, only the break-even gap.
- Optional AI: extracts only the numbers from a messy Hindi/English message; the user must check them. AI does not make the decision.
- Optional: fill fields from the app's board prices (Agmarknet / sample); status is set to "board".
- Printable Break-even Card (Print / Save as PDF).
- Break-even Check no longer has a simulated example. Prices are filled from live Agmarknet board data when the server has a working data.gov.in key (sample demo prices are clearly marked otherwise). Transport and other costs are not in any database: the farmer enters their own quotes.

Run the tests (no key or internet needed):
    node tests/netreturn.test.js

## Users database (register / login)
- Register karne wale users server ke database mein save hote hain: `data/kisan.db` (SQLite).
  Passwords hashed (scrypt) save hote hain, plain text nahi.
- Sab users dekhne ke liye `.env` mein `ADMIN_PASSWORD=...` likhiye, phir http://localhost:3000/admin kholiye
  (username: admin). Wahan CSV download bhi hai.
- `data/kisan.db` ko DB Browser for SQLite (sqlitebrowser.org) se bhi khol sakti hain.
- Purane (browser mein bane) accounts migrate nahi hote; dobara register kijiye.

## Zaroori baatein
- data.gov.in ka ye dataset sirf AAJ ka bhaav deta hai, purani history nahi. Isliye server har baar chalne par
  (aur har 6 ghante mein) bhaav `data/history.json` mein jodta hai. History roz badhti hai; numeric forecast ke liye
  kam se kam 5 din chahiye. Server ko roz ek baar chalaiye.
- Kisi fasal ka data na aaye to terminal mein "no-data crops" dikhega aur app wahan SAMPLE dikhayega.
  Fasal ka naam server.js ke COMMODITIES mein badla ja sakta hai.
- Forecast sirf anumaan hai (simple trend + AI ka vichaar), guarantee nahi.
- `.env` aur `data/` kisi ko share/upload mat kijiye.
- Browser mein `index.html` double-click karke mat kholiye, hamesha http://localhost:3000.

## New tabs: Crop Doctor, Agro-Climate, Yojana Setu
- **Crop Doctor** now shows **Crop name** (common name, e.g. Tomato / टमाटर), **Plant (scientific name)** (Latin, e.g. Solanum lycopersicum) and the **Diagnosis**. The AI is told to name what it sees, not to copy the farmer's crop hint, and to mention a mismatch in the summary. Upload a leaf photo (resized in the browser to 1024px); Gemini Vision returns a diagnosis with confidence, severity, treatment type and prevention. It gives no pesticide doses. Needs `GEMINI_API_KEY`. There is no custom-trained model, so Gemini is the only engine.
- **Agro-Climate**: modelled soil moisture at four depths plus 3-day heat, rain and wind warnings for the mandi districts in `MANDI_GEO` (Open-Meteo, no key). Thresholds are indicative.
- **Yojana Setu**: 10 central schemes with official links, filtered by need. State schemes are not included yet; verify details on the portals.

## Language switch + stickers (new)
- Header mein "English | हिंदी" button: poora interface pure English ya pure Hindi mein badalta hai (choice browser mein yaad rehti hai).
- AI jawab (chat, forecast, Crop Doctor, AI fill) bhi chuni hui bhasha mein aate hain.
- Har feature par sticker + "Yeh kis kaam aata hai?" tip box (3 steps). Header ke "💡 Tips" button se tips chhupa/dikha sakte hain.
- Sab text `public/i18n.js` mein hai: naya text ya bhasha wahin jodiye.

## Merged tab
Weather, Soil & Climate and Price Forecast are now one tab ("Weather & Forecast") with three buttons inside: Mandi weather, Soil & climate, Price forecast.

## Transporters (contact + ratings)
- New **Transporters** tab: vehicle owners list themselves (name, mobile, vehicle, capacity, districts). Logged-in farmers can call or WhatsApp them straight from the app (`tel:` and `wa.me` links; there is no in-app chat).
- Ratings: 1 to 5 stars with an optional comment, one rating per user per transporter, no self-rating. The list is ordered by a smoothed score so a single 5-star rating cannot beat a well-reviewed transporter.
- Listings are self-reported and **not verified**. A listing is hidden after 3 different users report it. On a fresh install (empty `data/transporters.json`) the app seeds **12 DEMO transporters**: made-up names and owners, placeholder numbers, vehicles (mini / pickup / tractor / truck) and districts (all 8 mandi districts are covered), with sample ratings on 8 of them. They carry a "Demo" tag, Call / WhatsApp are switched off for them, and a banner says they are samples; the Rate button still works so the flow can be shown. Do not present them as real transporters. Set `DEMO_TRANSPORTERS=0` in `.env` to start with an empty list, or delete the entries from `data/transporters.json`. Real, consenting transporters list themselves with the form (now with an owner-name field).
- Data is stored in `data/transporters.json`. Login now returns a signed 7-day token (secret in `data/secret.key`, or set `AUTH_SECRET`); the transporter list and ratings need it.

## Break-even tab: portal-style mandi report with transport (new)
- Section A copies the layout of the MP mandi board report: choose **my mandi** and the **mandi to sell at**; the table lists every crop there with Min / Max / Modal rate (₹ per quintal), the same crop's modal rate in your own mandi, **transport**, other charges, **what you keep**, and **profit vs your own mandi** (per quintal and total for your quantity). Arrival tonnage is not in the data, so it is not shown.
- **Transport price options:** automatic estimate by vehicle, your own ₹ per quintal per km, or one fixed ₹ per quintal quote. "Find transporters near me" opens the Transporters tab.
- **Conclusion box (at the end)** for "my crop": sell at the chosen mandi, or stay in your own mandi, with the rupee difference; whether another of the 8 mandis is better; and other crops that pay more at that mandi. A gain below max(₹50, 4% of the local price) is called "small".
- Min / Max appear only for live data (Agmarknet via data.gov.in); sample data is labelled. Only the 8 districts in `MANDI_GEO` are covered.
- The earlier manual two-mandi check (old Section B: AI fill, board fill, price inputs and Check button) has been removed. The tab now has the mandi-wise table plus the Printable Break-even Card, which takes only the transport / other-charge / nearby-cost ranges. Logic: `public/netreturn.js` (`mandiTable`, `transportPerQtl`); `node tests/netreturn.test.js` runs 18 tests.

## Market Trends: "Crops sold" pie chart (new)
- At the bottom of the Market Trends tab: a pie chart of each crop's share of trading, with a ranked table (records and %), a conclusion (most / least traded crop, top 3 share) and a total for every mandi.
- Filters: **mandi** (All mandis or one of the 8) and **period** (Day = latest day, Week = last 7 days, Month = last 30 days).
- **Important:** the Agmarknet price feed has no tonnes sold. The chart counts "trade records" (price entries reported per crop per mandi per day, saved as `n` in the history). More records = more trading, so it shows which crop sells most, not an exact quantity. The page says this too. If you get a real arrivals / tonnage source, replace the count in `salesMatrix()`.
- Week / month totals need saved history: keep the server running daily (or set `BACKFILL_DAYS`). With no live data, clearly labelled sample numbers are shown.

## Live transporter tracking (Route Map)
- Route Map tab -> "Track a transporter live": farmer picks a transporter, sees the vehicle on the map, distance and rough ETA to the "From" place (updates every 5 s).
- Transporter side: Transporters tab -> after saving your listing, tap "Share my live location" (phone GPS). Works on https:// or localhost only. Location is kept in server memory only, and shows as offline after 2 minutes without updates.
- Demo transporters show a SIMULATED moving position (clearly labelled), since they are not real vehicles.
