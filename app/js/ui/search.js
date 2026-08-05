/* ui/search.js — 頂部搜索（景點 / 美食 / 入駐店舖）
 * 自原 app.js 搬遷；增量：入駐店舖結果帶「入駐」標註。
 */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  function bind() {
    const input = App.$('searchInput'), box = App.$('searchResults'), clear = App.$('searchClear');
    let timer = null;
    input.addEventListener('input', () => {
      clear.hidden = !input.value;
      clearTimeout(timer);
      timer = setTimeout(() => doSearch(input.value.trim()), 140);
    });
    input.addEventListener('focus', () => { if (input.value.trim()) doSearch(input.value.trim()); });
    clear.onclick = () => { input.value = ''; clear.hidden = true; box.hidden = true; input.focus(); };
    document.addEventListener('click', e => {
      if (!e.target.closest('.topbar')) box.hidden = true;
    });
  }

  function doSearch(q) {
    const box = App.$('searchResults');
    if (!q) { box.hidden = true; return; }
    const hitSpots = S.spots.filter(s =>
      s.name.includes(q) || s.district.includes(q) || (s.desc || '').includes(q));
    const hitFoods = S.foods.filter(f =>
      f.name.includes(q) || f.cuisine.includes(q) || (f.tags || []).some(t => t.includes(q)) ||
      (f.signature || []).some(d => d.includes(q)) || (f.addr || '').includes(q));
    const rows = [];
    hitSpots.slice(0, 4).forEach(s => {
      const r = CrowdEngine.latest.find(x => x.spot.id === s.id);
      rows.push(`<button class="sr-item" data-type="spot" data-id="${s.id}">
        <span class="sr-ic heat">📍</span>
        <span class="sr-main"><span class="sr-name">${App.esc(s.name)}</span>
        <span class="sr-sub">${App.esc(s.district)} · 景點</span></span>
        ${r ? `<span class="sr-band" style="background:${r.band.color}">${r.band.label}</span>` : ''}
      </button>`);
    });
    hitFoods.slice(0, 6).forEach(f => {
      const isShop = f.targetType === 'shop';
      rows.push(`<button class="sr-item" data-type="food" data-id="${f.id}">
        <span class="sr-ic">${isShop ? '🏪' : (App.config.CUISINE_ICON[f.cuisine] || '🍴')}</span>
        <span class="sr-main"><span class="sr-name">${App.esc(f.name)}</span>
        <span class="sr-sub">${isShop ? '入駐店舖 · ' : ''}${App.esc(f.cuisine)} · 人均 MOP ${f.price} · ${App.esc((f.signature || [])[0] || '')}</span></span>
      </button>`);
    });
    box.innerHTML = rows.length ? rows.join('') : '<div class="sr-item" style="color:var(--tx2)">找不到相關結果</div>';
    box.hidden = false;
    box.querySelectorAll('.sr-item[data-id]').forEach(el => {
      el.onclick = () => {
        box.hidden = true;
        const { type, id } = el.dataset;
        if (type === 'spot') {
          const s = S.spots.find(x => x.id === id);
          App.basemap.flyTo(s.lat, s.lng, 15.5); App.drawer.openSpot(s);
        } else {
          const f = S.foods.find(x => x.id === id);
          if (S.layerMode === 'heat') App.layers.setLayerMode('food');
          App.basemap.flyTo(f.lat, f.lng, 16.5); App.drawer.openFood(f);
        }
        App.$('searchInput').blur();
      };
    });
  }

  App.search = { bind };
})();
