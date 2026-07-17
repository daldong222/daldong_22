// CNN 공포·탐욕 지수 프록시 (비공식 엔드포인트 — 막히면 프론트가 샘플로 폴백)
// GET /api/feargreed
module.exports = async (req, res) => {
  try {
    const r = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DaldongDash/1.0)", "Accept": "application/json" }
    });
    const j = await r.json();
    const score = j && j.fear_and_greed && typeof j.fear_and_greed.score === "number" ? Math.round(j.fear_and_greed.score) : null;
    const fg = j && j.fear_and_greed ? j.fear_and_greed : {};
    const hist = [
      ["현재", score],
      ["1주 전", fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null],
      ["1개월 전", fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null],
      ["1년 전", fg.previous_1_year != null ? Math.round(fg.previous_1_year) : null]
    ].filter((x) => x[1] != null);
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({ score, hist });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
