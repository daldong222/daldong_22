// 텔레그램 공개 채널 최근 글 스크래퍼
// GET /api/telegram?ch=daldong_22            (전체 채널 최신글)
// GET /api/telegram?ch=daldong_22&tag=시황    (특정 해시태그만 필터 — 시황 브리핑 방 용)
module.exports = async (req, res) => {
  const ch = (req.query.ch || "daldong_22").replace(/[^a-zA-Z0-9_]/g, "");
  const tag = req.query.tag ? String(req.query.tag) : null;
  try {
    const r = await fetch(`https://t.me/s/${ch}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DaldongDash/1.0)" } });
    const html = await r.text();

    const items = [];
    // 각 메시지 블록 파싱
    const blockRe = /<div class="tgme_widget_message[^"]*"[^>]*data-post="([^"]+)"([\s\S]*?)(?=<div class="tgme_widget_message[^"]*"[^>]*data-post=|<\/section>)/g;
    let m;
    while ((m = blockRe.exec(html))) {
      const post = m[1];              // 예: daldong_22/4161
      const chunk = m[2];
      const textM = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const timeM = chunk.match(/datetime="([^"]+)"/);
      let text = textM ? textM[1] : "";
      text = text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
      if (tag && !text.includes(tag)) continue;         // 해시태그 필터
      const time = timeM ? new Date(timeM[1]).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "";
      items.push({ url: `https://t.me/${post}`, text: text.slice(0, 90) || "(미디어 글)", time });
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json(items.slice(-8).reverse());     // 최신 8개
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
