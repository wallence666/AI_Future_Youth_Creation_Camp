# 澳行無阻 · MACAU ROAM FREE

此作品為灣區 AI 未來青年創造營 作品﹐為參賽作品︰

小队成員如下︰

```
陶錦華
陳曉賢
```

## 專案簡介

「澳行無阻」是一款移動優先的澳門智慧旅遊 **PWA 應用**（前後端分離，可安裝至手機主屏）——左手看擁擠（實時熱力圖），右手看好吃（在地美食圖），把行程的決定權交還給遊客。

**遊客端**
- **實時景點熱力圖**：綠／黃／紅三色帶即時呈現全澳 18 個重點景區擁擠程度，結合時間衰減函數預判未來 1–2 小時人流趨勢，回答「何時去最好」。
- **在地美食地圖**：45+ 家老字號、茶餐廳、米芝蓮小吃 + 入駐店舖，支援按距離、菜系、人均消費多維篩選。
- **互動閉環**：人流回報（150m 自動觸發 + 手動）、打卡（景點/美食/店舖）、評論（含照片）→ 賺取積分 → 兌換商家代金券（本地生成 QR，線下出示核銷）。

**商家端**（`/app/merchant.html`）：店舖資料/地圖選點/菜單/照片維護、限時代金券活動 CRUD、6 位核銷碼核銷。

**管理後台**（`/app/admin.html`）：數據概覽、商家與活動審核、店舖下架、評論管理。

## 快速開始

```bash
# 需要 Node.js ≥ 20（使用內建 node:sqlite，零原生依賴）
node server/index.js          # 默認 8000 端口；PORT=8001 可改

# 瀏覽器打開（建議手機模式）
# 應用本體   http://localhost:8000/app/
# 商家中心   http://localhost:8000/app/merchant.html
# 管理後台   http://localhost:8000/app/admin.html
# 團隊介紹頁 http://localhost:8000/
```

首次啟動自動建庫並注入演示數據：

| 賬號 | 密碼 | 角色 | 說明 |
|---|---|---|---|
| `admin` | `admin123` | 管理員 | 審核與管理 |
| `merchant_demo` | `demo123456` | 商家 | 名下「陳記餅家」（官也街，已上架） |
| `demo` | `demo123456` | 遊客 | 20 積分，可直接兌換代金券 |

端到端煙測（39 項）：`BASE=http://localhost:8001 node server/test/smoke.js`（需服務器已啟動）

## 手機訪問 / 安裝到主屏

**方式一：同一 Wi-Fi 直連（功能體驗）**

1. 手機與電腦連**同一個 Wi-Fi**；電腦啟動服務器（`node server/index.js`）
2. 查電腦局域網 IP：`ipconfig` → 無線網卡的 `IPv4 地址`（如 `192.168.1.12`）
3. 放行防火牆（二選一）：首次啟動時 Windows 彈窗勾選「專用網絡」允許；或以**管理員** PowerShell 執行一次：
   ```powershell
   New-NetFirewallRule -DisplayName 'AXWZ Dev Server' -Direction Inbound -Protocol TCP -LocalPort 8000,8001 -Action Allow
   ```
4. 手機瀏覽器打開 `http://<電腦IP>:8000/app/`（如 `http://192.168.1.12:8000/app/`）

> 排障：手機白屏/轉圈時，先在電腦瀏覽器訪問 `http://<電腦IP>:8000/api/spots`——不通即防火牆未放行。

**方式二：HTTPS 穿透（演示「安裝到主屏」PWA 亮點）**

PWA 安裝（Service Worker）僅在 localhost 或 HTTPS 下生效；局域網 IP 直連時功能完整但不彈安裝提示。演示安裝請用隧道：

```powershell
cloudflared tunnel --url http://localhost:8000   # 或：ngrok http 8000
```

手機打開隧道給的 `https://xxx.../app/`：
- **Android Chrome**：自動彈「添加到主屏幕」（或菜單 → 安裝應用）
- **iPhone Safari**：應用內引導條提示 → 分享 → 加入主屏幕

安裝後主屏顯示金色「澳」字圖標，斷網仍可打開應用外殼與官方 POI 熱力（離線兜底）。

## 目錄結構

```
├── index.html              # 團隊介紹頁（含應用入口）
├── app/                    # 前端（純靜態 PWA，僅通過 fetch 調 API）
│   ├── index.html          # 地圖主應用 │ merchant.html 商家中心 │ admin.html 管理後台
│   ├── manifest.webmanifest / sw.js / icons/   # PWA：可安裝 + 離線兜底
│   ├── css/app.css         # 移動優先樣式（safe-area、底部抽屜）
│   ├── js/
│   │   ├── core/     config（API base）・api（fetch+token）・store（狀態/事件總線）・pwa（SW 註冊/iOS 引導）
│   │   ├── map/      geo（GCJ-02 轉換）・basemap（瓦片/降級）・layers（熱力/美食圖層）
│   │   ├── model/    model（CrowdIndex v1）・blend（U 因子融合）
│   │   ├── ui/       drawer・filters・search・sheet・toast
│   │   ├── features/ auth・report（人流回報）・social（打卡/評論）・coupon（代金券/QR）
│   │   └── pages/    app・merchant・admin
│   ├── vendor/       Leaflet 1.9.4・qr.js（自研零依賴 QR 生成器）
│   └── data/         model.json（B(s)+時段曲線）・spots/foods/events.json
├── server/                 # 後端（Express + node:sqlite）
│   ├── index.js            # API 路由 + 靜態託管（/app、/uploads、/sw.js 根 scope）
│   ├── db.js               # 建表 + seed（admin/演示數據）│ config.js 業務參數
│   ├── routes/             # auth・me・spots・reports・checkins・comments・crowd・targets・shops・promos・merchant・admin
│   └── test/               # smoke.js（39 項端到端）・qr-test.js（QR 數學驗證 28 項）
├── macau_events_scraper/   # 澳門活動爬蟲（MGTO／金光綜藝館等）
├── data/                   # 原始數據（旅遊局統計 xlsx、活動 json）
└── docs/                   # 技術策劃・項目計劃・前後端分離規格書
```

## 擁擠指數模型（CrowdIndex）

```
v1 基準：CrowdIndex(s,t) = [ w1·B(s)·Tc(s,t) + w2·Park(s,t) ] × I(t) × W(s,t) × H(t)
實時融合：最終指數 = (1 − α) × v1 + α × U，α = 0.25 × min(有效回報數 / 3, 1)
```

- **B(s)**：景區基準熱度（旅遊局 24 區逐時訪客統計加權校準）
- **Tc(s,t)**：時段曲線，按地點類型分 4 群（廟宇廣場／步行街區／室內場館／濱海郊野）
- **Park(s,t)**：停車場即時空位率；預測時按半衰期 45 分鐘指數衰減回歸期望
- **I(t)／W(s,t)／H(t)**：口岸入境、天氣（Open-Meteo，室內外翻轉）、節慶演唱會放大係數
- **U**：遊客實時人流回報聚合（半衰期 15 分鐘）；回報 <3 份時 α 線性遞減至 0，避免單一回報劫持；後端不可用時自動退回純 v1（離線可演示）

全澳 Min-Max 正規化後映射綠（暢通）／黃（緩行）／紅（擁擠）三色帶，輸出相對擁擠排名。

## PWA 與離線能力

- `manifest.webmanifest`：standalone 顯示、192/512 圖標（含 maskable）、墨藍主題色
- Service Worker（根 scope）：靜態資源預緩存（cache-first）、導航 network-first 離線回退、API network-first + 最後成功副本兜底（無副本返回離線提示 JSON）
- Android Chrome 自動彈「添加到主屏幕」；iOS 顯示 Safari 分享引導條
- 離線時：應用外殼 + 官方 POI + CrowdIndex v1 完整可用（模型在客戶端運行）

## 數據來源

- 澳門旅遊局（DST）分區逐時訪客統計（2026-06）
- 自研爬蟲：MGTO 活動列表、銀河／威尼斯人／倫敦人綜藝館演唱會排期
- Open-Meteo 免密鑰天氣 API（每 10 分鐘刷新）
- 地圖底圖：Geoq 智圖（GCJ-02，自動降級 Carto Voyager）
