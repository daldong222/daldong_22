// 야후 파이낸스 시세 프록시 — 일봉(5년) + 인트라데이(5일)
// GET /api/quotes?symbols=^GSPC,GC=F,BTC-USD
module.exports = async (req, res) => {
  const symbols = String(req.query.symbols || "").split(",").filter(Boolean);
  const range = req.query.range || "5y";
  const out = {};

  async function fetchChart(sym, rng, interval) {
    const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    for (const h of hosts) {
      try {
        const url = `https://${h}/v8/finance/chart/${encodeURIComponent(sym)}?range=${rng}&interval=${interval}`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DaldongDash/1.0)" } });
        if (!r.ok) continue;
        const j = await r.json();
        const R = j && j.chart && j.chart.result && j.chart.result[0];
        if (!R) continue;
        const ts = R.timestamp || [];
        const cl = (R.indicators && R.indicators.quote && R.indicators.quote[0] && R.indicators.quote[0].close) || [];
        const arr = [];
        for (let i = 0; i < ts.length; i++) if (cl[i] != null) arr.push({ t: ts[i] * 1000, v: cl[i] });
        return { arr, meta: R.meta || {} };
      } catch (e) { /* try next host */ }
    }
    return null;
  }

  async function one(sym) {
    const daily = await fetchChart(sym, range, "1d");
    if (!daily) return { error: "fetch failed" };
    const closes = daily.arr;
    const meta = daily.meta;
    const price = meta.regularMarketPrice != null ? meta.regularMarketPrice : (closes.length ? closes[closes.length - 1].v : null);
    // 전일 대비 변동률: 일봉 마지막 직전 종가를 전일 종가로 사용 (하루 기준)
    const prev = closes.length > 1 ? closes[closes.length - 2].v : price;
    const changePct = prev ? ((price - prev) / prev * 100) : 0;
    // 1일/1주 차트용 인트라데이(30분봉, 5일) — 없으면 무시
    let intra = [];
    const iv = await fetchChart(sym, "5d", "30m");
    if (iv) intra = iv.arr;
    return { price, changePct, closes, intra };
  }

  await Promise.all(symbols.map(async (s) => { out[s] = await one(s); }));
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=900");
  res.status(200).json(out);
};
