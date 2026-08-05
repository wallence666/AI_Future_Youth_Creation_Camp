/* features/social.js — 打卡 + 評論（spec F3/F4）
 * 景點、官方收錄美食、入駐店舖三類詳情卡通用：
 *   打卡：需登入 + 定位授權，距目標 ≤500m（後端校驗），同目標每日 1 次 +10 分；
 *   評論：文字 ≤200 字 + 可選照片 ≤3 張（jpg/png/webp ≤5MB），分頁倒序，作者可刪。
 * 每次詳情卡打開時 enhance(targetType, targetId) 重新掛載。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const MAX_PHOTOS = 3, MAX_MB = 5;

  let T = null;              // 當前目標 {type, id}
  let page = 1, total = 0;
  let picked = [];           // 待上傳照片 File[]

  /* ---------- 工具 ---------- */
  function fmtAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60e3) return '剛剛';
    if (diff < 3600e3) return Math.floor(diff / 60e3) + ' 分鐘前';
    if (diff < 86400e3) return Math.floor(diff / 3600e3) + ' 小時前';
    const d = new Date(ts + 8 * 3600e3);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('此裝置不支援定位'));
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => reject(new Error('未能取得定位，請授權定位後再試')),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 }
      );
    });
  }

  /* ---------- 掛載 ---------- */
  function enhance(targetType, targetId) {
    const zone = App.$('socialZone');
    if (!zone) return;
    T = { type: targetType, id: String(targetId) };
    page = 1; total = 0; picked = [];
    zone.innerHTML = `
      <div class="ck-row">
        <button class="btn btn-checkin" id="ckBtn">📍 打卡 <small>+${App.config.POINTS.checkin} 分</small></button>
        <span class="ck-count" id="ckInfo">…</span>
      </div>
      <div class="cm-head"><b>評論</b><span class="cm-total" id="cmTotal"></span></div>
      <div class="cm-form">
        <textarea id="cmInput" maxlength="200" rows="2" placeholder="分享你的體驗…（≤200 字，+${App.config.POINTS.comment} 分）"></textarea>
        <div class="cm-form-row">
          <button class="cm-photo-btn" id="cmPhotoBtn" type="button">📷 加圖 <span id="cmPhotoInfo"></span></button>
          <button class="cm-submit" id="cmSubmit" type="button">發表</button>
        </div>
        <input type="file" id="cmFiles" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <div class="cm-preview" id="cmPreview"></div>
      </div>
      <div class="cm-list" id="cmList"><div class="me-empty">載入中…</div></div>
      <button class="cm-more" id="cmMore" hidden>加載更多</button>`;
    bindCheckin();
    bindCommentForm();
    App.$('cmMore').onclick = () => loadComments(page + 1);
    refreshSummary();
    loadComments(1);
  }

  /* ---------- 打卡 ---------- */
  function bindCheckin() {
    App.$('ckBtn').onclick = async () => {
      if (!App.auth.requireLogin()) return;
      const btn = App.$('ckBtn');
      btn.disabled = true;
      try {
        const pos = await getPosition();
        const j = await App.api.post('/api/checkins', { targetType: T.type, targetId: T.id, lat: pos.lat, lng: pos.lng });
        App.toast(`打卡成功！+${App.config.POINTS.checkin} 積分`);
        refreshSummary();
      } catch (e) {
        App.toast(e.message);
        if (e.status === 409) refreshSummary();
      } finally {
        btn.disabled = false;
      }
    };
  }
  async function refreshSummary() {
    try {
      const j = await App.api.get(`/api/targets/${T.type}/${T.id}/summary`);
      App.$('ckInfo').textContent = `${j.checkins} 人已打卡 · ${j.comments} 條評論`;
      App.$('cmTotal').textContent = j.comments ? `（${j.comments}）` : '';
      const btn = App.$('ckBtn');
      if (j.myCheckinToday) {
        btn.classList.add('done');
        btn.innerHTML = '✓ 今日已打卡';
      }
    } catch (e) {
      App.$('ckInfo').textContent = '';
    }
  }

  /* ---------- 評論 ---------- */
  function bindCommentForm() {
    const fileInput = App.$('cmFiles');
    App.$('cmPhotoBtn').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const files = [...fileInput.files];
      for (const f of files) {
        if (picked.length >= MAX_PHOTOS) { App.toast(`最多 ${MAX_PHOTOS} 張照片`); break; }
        if (f.size > MAX_MB * 1024 * 1024) { App.toast(`「${f.name}」超過 ${MAX_MB}MB`); continue; }
        picked.push(f);
      }
      fileInput.value = '';
      renderPreview();
    };
    App.$('cmSubmit').onclick = submitComment;
  }
  function renderPreview() {
    App.$('cmPhotoInfo').textContent = picked.length ? `${picked.length}/${MAX_PHOTOS}` : '';
    App.$('cmPreview').innerHTML = picked.map((f, i) =>
      `<span class="cm-thumb"><img src="${URL.createObjectURL(f)}" alt="預覽"><i data-i="${i}">×</i></span>`).join('');
    App.$('cmPreview').querySelectorAll('i').forEach(el => {
      el.onclick = () => { picked.splice(Number(el.dataset.i), 1); renderPreview(); };
    });
  }
  async function submitComment() {
    if (!App.auth.requireLogin()) return;
    const input = App.$('cmInput');
    const content = input.value.trim();
    if (!content) { App.toast('評論內容不能為空'); return; }
    const btn = App.$('cmSubmit');
    btn.disabled = true;
    try {
      const form = new FormData();
      form.append('targetType', T.type);
      form.append('targetId', T.id);
      form.append('content', content);
      picked.forEach(f => form.append('photos', f));
      const j = await App.api.postForm('/api/comments', form);
      input.value = ''; picked = []; renderPreview();
      App.toast(j.gained > 0 ? `已發表，+${j.gained} 積分` : '已發表（今日計分已達上限）');
      loadComments(1);
      refreshSummary();
    } catch (e) {
      App.toast(e.message);
    } finally {
      btn.disabled = false;
    }
  }
  async function loadComments(p) {
    try {
      const j = await App.api.get(`/api/comments?targetType=${T.type}&targetId=${encodeURIComponent(T.id)}&page=${p}`);
      page = p; total = j.total;
      const me = App.auth.currentUser && App.auth.currentUser();
      const html = j.items.map(c => `
        <div class="cm-item" data-id="${c.id}">
          <div class="cm-top"><b>${App.esc(c.username)}</b><span class="cm-time">${fmtAgo(c.created_at)}</span>
            ${me && (me.id === c.user_id || me.role === 'admin') ? `<button class="cm-del" data-id="${c.id}">刪除</button>` : ''}
          </div>
          <div class="cm-text">${App.esc(c.content)}</div>
          ${c.photos.length ? `<div class="cm-photos">${c.photos.map(p2 => `<a href="${App.esc(p2)}" target="_blank" rel="noopener"><img src="${App.esc(p2)}" alt="評論照片" loading="lazy"></a>`).join('')}</div>` : ''}
        </div>`).join('');
      const list = App.$('cmList');
      if (p === 1) list.innerHTML = html || '<div class="me-empty">暫無評論，來搶沙發～</div>';
      else list.insertAdjacentHTML('beforeend', html);
      list.querySelectorAll('.cm-del').forEach(b => { b.onclick = () => delComment(Number(b.dataset.id)); });
      App.$('cmMore').hidden = page * j.pageSize >= total;
    } catch (e) {
      if (page === 1) App.$('cmList').innerHTML = `<div class="me-empty">${App.esc(e.message)}</div>`;
    }
  }
  async function delComment(id) {
    try {
      await App.api.del(`/api/comments/${id}`);
      App.toast('已刪除');
      loadComments(1);
      refreshSummary();
    } catch (e) {
      App.toast(e.message);
    }
  }

  App.social = { enhance };
})();
