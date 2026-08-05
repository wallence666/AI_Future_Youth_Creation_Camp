/* model/blend.js — CrowdIndex v2：用戶回報因子 U 融合（spec 第 3 節）
 *
 *   U(s,t) 由後端聚合（GET /api/crowd/live，15 分鐘半衰期 / 30 分鐘窗口），
 *   前端按 α 權重融入 v1 指數：
 *     final = (1 − α) × norm_v1 + α × U，α = 0.25 × min(有效回報數 / 3, 1)
 *
 * 模型仍在客戶端運行；後端不可用時 U 缺省（uLive={}），全量退回 v1。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const ALPHA_MAX = 0.25;

  /** 拉取最新 U 因子；失敗時清空（退回 v1） */
  async function refresh() {
    try {
      const j = await App.api.get('/api/crowd/live');
      App.state.uLive = (j && j.spots) || {};
    } catch (e) {
      App.state.uLive = {};
    }
  }

  /** 將 U 融合進 tick 結果（原地修改 norm/band，並附 r.u 供 UI 標註） */
  function apply(results) {
    const u = App.state.uLive;
    for (const r of results) {
      const live = u[r.spot.id];
      r.u = null;
      if (live && live.n > 0) {
        const alpha = ALPHA_MAX * Math.min(live.n / 3, 1);
        r.norm = Math.min(Math.max((1 - alpha) * r.norm + alpha * live.u, 0), 1);
        r.band = CrowdEngine.BANDS.find(b => r.norm < b.max) || CrowdEngine.BANDS[CrowdEngine.BANDS.length - 1];
        r.u = { n: live.n, alpha: Math.round(alpha * 100) / 100 };
      }
    }
    return results;
  }

  App.blend = { refresh, apply };
})();
