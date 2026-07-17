// 야후 파이낸스 시세 프록시 — 브라우저 CORS 우회용 서버 함수
// GET /api/quotes?symbols=^GSPC,GC=F,BTC-USD&range=5y
module.exports = async (req, res) => {
  const symbols = String(req.query.symbols || "").split(",").filter(Boolean);
  const range = req.query.range || "5y";
  const out = {};

  async function one(sym) {
    const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    for (const h of hosts) {
      try {
        const url = `https://${h}/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=1d`;
        const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DaldongDash/1.0)" } });
        if (!r.ok) continue;
        const j = await r.json();
        const R = j && j.chart && j.chart.result && j.chart.result[0];
        if (!R) continue;
        const ts = R.timestamp || [];
        const cl = (R.indicators && R.indicators.quote && R.indicators.quote[0] && R.indicators.quote[0].close) || [];
        const closes = [];
        for (let i = 0; i < ts.length; i++) if (cl[i] != null) closes.push({ t: ts[i] * 1000, v: cl[i] });
        const meta = R.meta || {};
        const price = meta.regularMarketPrice != null ? meta.regularMarketPrice : (closes.length ? closes[closes.length - 1].v : null);
        const prev = meta.chartPreviousClose != null ? meta.chartPreviousClose : (closes.length > 1 ? closes[closes.length - 2].v : price);
        return { price, changePct: prev ? ((price - prev) / prev * 100) : 0, closes };
      } catch (e) { /* try next host */ }
    }
    return { error: "fetch failed" };
  }

  await Promise.all(symbols.map(async (s) => { out[s] = await one(s); }));
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  res.status(200).json(out);
};
