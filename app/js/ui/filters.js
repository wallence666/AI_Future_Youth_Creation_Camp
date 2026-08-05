/* ui/filters.js — 篩選標籤列（自原 app.js 搬遷，行為不變） */
(function () {
  'use strict';
  const App = window.App = window.App || {};
  const S = App.state;

  function renderChips() {
    const row = App.$('chipRow');
    row.innerHTML = '';
    for (const def of App.config.CHIP_DEFS) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = def.label || def.key;
      b.dataset.group = def.group; b.dataset.key = def.key;
      b.onclick = () => toggleChip(def, b);
      row.appendChild(b);
    }
  }

  function toggleChip(def, el) {
    const f = S.filters;
    if (def.group === 'near') {
      f.near = !f.near;
      if (f.near && !S.userLoc) { S.pendingNear = true; App.basemap.locate(); }
    } else {
      const cur = f[def.group];
      f[def.group] = cur === def.key ? null : def.key;
    }
    syncChips();
    if (S.layerMode === 'heat') App.layers.setLayerMode('food');   // 美食篩選時自動切到美食圖層
    App.layers.applyFoodFilters();
  }

  function syncChips() {
    document.querySelectorAll('#chipRow .chip').forEach(el => {
      const g = el.dataset.group, k = el.dataset.key;
      el.classList.toggle('on', g === 'near' ? S.filters.near : S.filters[g] === k);
    });
  }

  App.filters = { renderChips, syncChips };
})();
