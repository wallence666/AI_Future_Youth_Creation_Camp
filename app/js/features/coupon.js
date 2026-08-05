/* features/coupon.js — 代金券（spec F7）
 * 店舖詳情卡 promoZone：限時活動列表 + 積分兌換；
 * 兌換成功 / 「我的代金券」→ 券面 modal（6 位核銷碼 + 本地生成 QR）。
 * 依賴：vendor/qr.js（QRGen）、core/api.js、features/auth.js（requireLogin/refresh）。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};

  function fmtTs(ts) {
    const d = new Date(ts + 8 * 3600e3);   // 澳門時間
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }

  /* ================= 店舖卡：限時活動區 ================= */
  function enhanceShop(shop) {
    const zone = App.$('promoZone');
    if (!zone) return;
    const promos = shop.promos || [];
    if (!promos.length) { zone.innerHTML = ''; return; }
    zone.innerHTML = `
      <div class="promo-title">🎟️ 限時活動<small>積分兌換 · 到店出示核銷碼</small></div>
      ${promos.map(p => `
        <div class="promo-card" data-pid="${p.id}">
          <div class="pc-main">
            <b>${App.esc(p.title)}</b>
            ${p.descr ? `<p>${App.esc(p.descr)}</p>` : ''}
            <div class="pc-meta">
              <span class="pc-value">MOP ${p.coupon_value} 券</span>
              <span>剩餘 <b class="pc-stock">${p.stock}</b> 張</span>
              <span>至 ${fmtTs(p.end_at)}</span>
            </div>
          </div>
          <button class="btn btn-gold pc-exchange" data-pid="${p.id}">
            <b>${p.points_cost}</b> 積分<br>兌換
          </button>
        </div>`).join('')}`;
    zone.querySelectorAll('.pc-exchange').forEach(btn => {
      btn.onclick = () => doExchange(shop, Number(btn.dataset.pid), btn);
    });
  }

  async function doExchange(shop, promoId, btn) {
    if (!App.auth.requireLogin()) return;
    btn.disabled = true;
    try {
      const j = await App.api.post(`/api/promos/${promoId}/exchange`);
      // 本地扣庫存並重繪
      const p = (shop.promos || []).find(x => x.id === promoId);
      if (p) p.stock = Math.max(0, p.stock - 1);
      if (App.auth.refresh) App.auth.refresh();      // 頂欄積分即時更新
      enhanceShop(shop);
      showCoupon({
        code: j.coupon.code, title: j.title, shopName: shop.name,
        couponValue: j.couponValue, endAt: j.endAt, fresh: true,
      });
    } catch (e) {
      App.toast(e.message);
      btn.disabled = false;
    }
  }

  /* ================= 券面 modal（核銷碼 + QR） ================= */
  function showCoupon(c) {
    App.$('couponTitle').textContent = c.fresh ? '兌換成功 🎉' : '我的代金券';
    App.$('couponSub').textContent = `${c.shopName || ''} · ${c.title} · 面額 MOP ${c.couponValue}`;
    App.$('couponCode').textContent = c.code;
    App.$('couponExp').textContent = `有效至 ${fmtTs(c.endAt)}（澳門時間）`;
    const holder = App.$('couponQr');
    holder.innerHTML = '';
    try {
      holder.appendChild(window.QRGen.toCanvas(c.code, 200));
    } catch (e) {
      holder.innerHTML = '<div class="me-empty">QR 生成失敗，請出示文字碼</div>';
    }
    App.$('couponModal').hidden = false;
  }

  /* ================= 「我的」面板：我的代金券 ================= */
  const STATUS_LABEL = { unused: '未使用', redeemed: '已核銷', expired: '已過期' };
  async function renderMine() {
    const box = App.$('meCoupons');
    if (!box) return;
    box.innerHTML = '<div class="me-empty">載入中…</div>';
    try {
      const j = await App.api.get('/api/me/coupons');
      box.innerHTML = j.items.length
        ? j.items.map(c => `
          <div class="me-coupon st-${c.status}" data-code="${App.esc(c.code)}" data-id="${c.id}">
            <div class="mc-main">
              <b>${App.esc(c.title)}</b>
              <span>${App.esc(c.shop_name)} · MOP ${c.coupon_value}</span>
            </div>
            <div class="mc-side">
              <span class="mc-status">${STATUS_LABEL[c.status] || c.status}</span>
              ${c.status === 'unused' ? '<span class="mc-hint">點擊出示 ›</span>' : ''}
            </div>
          </div>`).join('')
        : '<div class="me-empty">暫無代金券 — 到入駐店舖詳情卡用積分兌換</div>';
      box.querySelectorAll('.me-coupon.st-unused').forEach(el => {
        el.onclick = () => {
          const c = j.items.find(x => String(x.id) === el.dataset.id);
          if (c) showCoupon({
            code: c.code, title: c.title, shopName: c.shop_name,
            couponValue: c.coupon_value, endAt: c.end_at,
          });
        };
      });
    } catch (e) {
      box.innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`;
    }
  }

  function bind() {
    App.$('couponClose').onclick = () => { App.$('couponModal').hidden = true; };
    App.$('couponModal').addEventListener('click', e => {
      if (e.target.id === 'couponModal') App.$('couponModal').hidden = true;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();

  App.coupon = { enhanceShop, showCoupon, renderMine };
})();
