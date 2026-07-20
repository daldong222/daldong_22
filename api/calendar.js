// 경제지표 캘린더 (FRED 자동 갱신) — GET /api/calendar
// 발표일정 + 실제 수치를 FRED에서 받아 KST 기준으로 정리
const KEY = process.env.FRED_API_KEY;
const B = "https://api.stlouisfed.org/fred";

// 지표 정의: FRED 시계열 id로 발표일정(release)까지 자동 해석
// calc: yoy(전년비) / mom(전월비) / lvl(수치) / chg(전월 대비 증감, 천 단위)
const IND = [
  { id: "CPIAUCSL", name: "CPI (전년比)",        imp: 3, calc: "yoy", t: "21:30", pre: "월" },
  { id: "CPILFESL", name: "근원 CPI (전년比)",   imp: 3, calc: "yoy", t: "21:30", pre: "월" },
  { id: "PCEPI",    name: "PCE 물가 (전년比)",   imp: 3, calc: "yoy", t: "22:30", pre: "월" },
  { id: "PPIACO",   name: "PPI (전년比)",        imp: 2, calc: "yoy", t: "21:30", pre: "월" },
  { id: "PAYEMS",   name: "고용보고서(NFP)",     imp: 3, calc: "chg", t: "21:30", pre: "월" },
  { id: "UNRATE",   name: "실업률",              imp: 2, calc: "lvl", t: "21:30", pre: "월", suf: "%" },
  { id: "ICSA",     name: "신규 실업수당 청구",  imp: 2, calc: "lvl", t: "21:30", pre: "주", suf: "K", div: 1000 },
  { id: "RSAFS",    name: "소매판매 (전월比)",   imp: 2, calc: "mom", t: "21:30", pre: "월" },
  { id: "UMCSENT",  name: "미시간대 소비자심리", imp: 2, calc: "lvl", t: "23:00", pre: "월" },
  { id: "GDPC1",    name: "GDP (전분기比·연율)", imp: 3, calc: "qoq", t: "21:30", pre: "분기" },
];

// FOMC 결정 발표 (미 동부 14:00 → KST 익일 03:00)
const FOMC = [
  "2026-01-28","2026-03-18","2026-04-29","2026-06-17",
  "2026-07-29","2026-09-16","2026-10-28","2026-12-09",
  "2027-01-27","2027-03-17","2027-04-28","2027-06-16",
  "2027-07-28","2027-09-22","2027-11-03","2027-12-15",
];

const j = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error("fred " + r.status); return r.json(); };
const iso = (d) => new Date(d).toISOString().slice(0, 10);

async function releaseId(seriesId) {
  const d = await j(`${B}/series/release?series_id=${seriesId}&api_key=${KEY}&file_type=json`);
  return d.releases && d.releases[0] && d.releases[0].id;
}
async function releaseDates(rid) {
  const from = iso(Date.now() - 60 * 864e5), to = iso(Date.now() + 240 * 864e5);
  const d = await j(`${B}/release/dates?release_id=${rid}&api_key=${KEY}&file_type=json&realtime_start=${from}&realtime_end=${to}&include_release_dates_with_no_data=true&sort_order=asc&limit=300`);
  return (d.release_dates || []).map((x) => x.date);
}
async function obs(seriesId, n = 16) {
  const d = await j(`${B}/series/observations?series_id=${seriesId}&api_key=${KEY}&file_type=json&sort_order=desc&limit=${n}`);
  return (d.observations || []).filter((o) => o.value !== ".").map((o) => ({ d: o.date, v: +o.value }));
}

function valueOf(cfg, a) {
  if (!a.length) return null;
  const f = (x, d = 1) => x.toFixed(d);
  if (cfg.calc === "yoy") return a.length >= 13 && a[12].v ? f((a[0].v / a[12].v - 1) * 100) + "%" : null;
  if (cfg.calc === "mom") return a.length >= 2 && a[1].v ? f((a[0].v / a[1].v - 1) * 100) + "%" : null;
  if (cfg.calc === "qoq") return a.length >= 2 && a[1].v ? f((Math.pow(a[0].v / a[1].v, 4) - 1) * 100) + "%" : null;
  if (cfg.calc === "chg") { if (a.length < 2) return null; const c = Math.round(a[0].v - a[1].v); return (c > 0 ? "+" : "") + c + "K"; }
  const v = cfg.div ? a[0].v / cfg.div : a[0].v;
  return f(v, cfg.suf === "%" ? 1 : 0) + (cfg.suf === "%" ? "%" : cfg.suf === "K" ? "K" : "");
}
function prevOf(cfg, a) {
  if (!a.length) return null;
  const shifted = a.slice(1);
  return valueOf(cfg, shifted);
}
// 대상 기간 라벨 (예: 6월 / 2분기 / 7월 12일주)
function periodLabel(cfg, a) {
  if (!a.length) return "";
  const d = new Date(a[0].d);
  if (cfg.pre === "분기") return `${Math.floor(d.getMonth() / 3) + 1}분기`;
  if (cfg.pre === "주") return "주간";
  return `${d.getMonth() + 1}월`;
}

module.exports = async (req, res) => {
  const out = { items: [], ts: Date.now() };
  if (!KEY) { res.status(200).json({ ...out, error: "no_key" }); return; }
  const today = iso(Date.now());

  const results = await Promise.all(IND.map(async (cfg) => {
    try {
      const rid = await releaseId(cfg.id);
      if (!rid) return [];
      const [dates, a] = await Promise.all([releaseDates(rid), obs(cfg.id)]);
      const past = dates.filter((d) => d < today).slice(-1);
      const next = dates.filter((d) => d >= today).slice(0, 2);
      const items = [];
      const label = periodLabel(cfg, a);
      // 최근 발표 (실제치 포함)
      past.forEach((d) => items.push({
        d, t: cfg.t, name: `${label} ${cfg.name}`.trim(), imp: cfg.imp,
        prev: prevOf(cfg, a) || "—", fc: null, act: valueOf(cfg, a),
      }));
      // 예정
      next.forEach((d, i) => items.push({
        d, t: cfg.t, name: cfg.name, imp: cfg.imp,
        prev: valueOf(cfg, a) || "—", fc: null, act: null,
      }));
      return items;
    } catch (e) { return []; }
  }));

  results.forEach((arr) => out.items.push(...arr));

  // FOMC (KST 익일 03:00)
  FOMC.filter((d) => d >= today).slice(0, 2).forEach((d) => {
    const kst = iso(new Date(d + "T00:00:00Z").getTime() + 864e5);
    out.items.push({ d: kst, t: "03:00", name: "FOMC 금리결정", imp: 3, prev: "3.50~3.75%", fc: null, act: null });
  });

  out.items.sort((a, b) => a.d.localeCompare(b.d) || b.imp - a.imp);
  // 과거 3개 + 미래 9개로 제한
  const past = out.items.filter((x) => x.d < today).slice(-3);
  const up = out.items.filter((x) => x.d >= today).slice(0, 9);
  out.items = [...past, ...up];

  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");
  res.status(200).json(out);
};
