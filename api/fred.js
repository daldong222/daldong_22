// FRED(세인트루이스 연준) 매크로 데이터 프록시
// GET /api/fred?series=M2SL,WALCL,DGS10   (환경변수 FRED_API_KEY 필요)
module.exports = async (req, res) => {
  const ids = String(req.query.series || "").split(",").filter(Boolean);
  const key = process.env.FRED_API_KEY;
  if (!key) { res.status(500).json({ error: "FRED_API_KEY 환경변수가 설정되지 않았습니다" }); return; }
  const start = req.query.start || "2021-01-01";
  const out = {};

  async function one(id) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${key}&file_type=json&observation_start=${start}&sort_order=asc`;
      const r = await fetch(url);
      const j = await r.json();
      const obs = (j.observations || [])
        .filter((o) => o.value !== "." && o.value !== "")
        .map((o) => ({ t: new Date(o.date + "T00:00:00Z").getTime(), v: parseFloat(o.value) }))
        .filter((o) => !isNaN(o.v));
      return { closes: obs, price: obs.length ? obs[obs.length - 1].v : null };
    } catch (e) { return { error: String(e && e.message || e) }; }
  }

  await Promise.all(ids.map(async (id) => { out[id] = await one(id); }));
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).json(out);
};
