# Design: Ledger Tide
**Date:** 2026-08-07 · **Status:** confirmed
**Archetype:** Data-Dense Professional · **Register:** product structure · expressive at: 擁擠指數數字揭示、城市摘要膠囊更新脈動
**Grounding:** Google 地圖行動版 UI 的資訊優先／克制配色工具介面 + 葡式瓷磚（azulejo）藍白紋樣的地方識別
**DNA:** Data-Dense Professional（基礎家族，全部四軸預設） · **Dominant axis:** composition（Editorial Spread 的大尺寸數字＋分欄節奏，是整個介面辨識度的來源）
**Composition:** \<dealt\>（Data-Dense Professional × Editorial Spread，variance 7，seed: axwz|2026-08-07|0|pin:chroma=muted,hue=blue） — 超大顯示級數字（擁擠指數）對比克制的資訊分欄，磁磚式浮動元件（搜尋列/篩選chip/FAB/城市膠囊）以雜誌排版的不對稱邏輯落位，而非置中卡片網格；地圖本身滿版當作「編輯跨頁的圖」，浮動 UI 是跨頁上的文字/註記
**Pins:** hue=blue（azulejo 定案）、chroma=muted（研究階段「配色克制」定案）；淺色底為額外硬性約束（非 dealer 軸，來自研究文件）

## Direction
中性、工具感、資訊優先——像 Google 地圖那樣讓內容（地圖、擁擠指數、美食）說話，介面本身盡量安靜。葡式瓷磚藍白只在極少數位置點題，讓「這是澳門的 app」的識別感不靠滿版裝飾，而是靠一個克制、可辨認的細節。適合遊客邊走邊查的使用情境：資訊密度高但不喧鬧，重要數字（擁擠指數）用尺寸把它從背景資訊裡拉出來。

## Signature move
Azulejo 藍白四方連續小磁磚紋理，只以低透明度背景紋理的形式出現在**人流三色帶徽章/晶片**（暢通/緩行/擁擠 badge）內部——把「地方識別」直接綁在產品最核心的資訊語言（CrowdIndex）上，而不是隨機裝飾。其餘介面（地圖、卡片、表單、按鈕）完全素色，不重複這個紋理。

## Expressive moments
- **擁擠指數數字揭示**（抽屜開啟時）：`crowd-idx` 用整個 type scale 裡最大的級距（--text-4xl），是全介面唯一的「大字」時刻，其餘皆為 body/label 級距
- **城市摘要膠囊更新**：每 30 秒數據刷新時膠囊有一次極輕的透明度脈動（150ms），提示「這是活的即時數據」，非裝飾性動效
其餘所有畫面（導覽、篩選、表單、清單）維持 structure register 的安靜基線

## Type
- Display: **Noto Sans TC**（系統若無則退回 `-apple-system, "PingFang TC", sans-serif`）— 不用襯線；research 階段已定調「工具感」，襯線（原有 `Noto Serif TC`）與此方向衝突，全面改用無襯線
- Body: **Noto Sans TC**（同上 stack）
- Scale: 1.25 比例，base 14px — 12 / 14 / 16 / 20 / 25 / 31 / 39px（對應 --text-xs 至 --text-4xl，僅 crowd-idx 用最大級）
- Leading: body 1.5 · display（crowd-idx）1.1（緊縮，強化數字的圖形感）；Weights: 400 / 600 / 700（不用 300 或 900，避免系統字重不一致的鋸齒風險）

## Color tokens
```css
:root {
  --neutral-1: #fcfdfd; --neutral-2: #f8f9fa; --neutral-3: #eff1f3;
  --neutral-4: #e5e8ec; --neutral-5: #dadee3; --neutral-6: #ced3d9;
  --neutral-7: #bec4cb; --neutral-8: #a5abb4; --neutral-9: #828a94;
  --neutral-10: #717882; --neutral-11: #5f6469; --neutral-12: #2c2e31;
  --accent-1: #fbfdff; --accent-2: #f5f9ff; --accent-3: #e8f2fe;
  --accent-4: #dbe9fc; --accent-5: #cce0f9; --accent-6: #bcd5f4;
  --accent-7: #a9c6ec; --accent-8: #8baeda; --accent-9: #628cc0;
  --accent-10: #537aaa; --accent-11: #4e6582; --accent-12: #232f3e;
  --accent-on-solid: #070e16;
  --error-3: #ffebe9; --error-9: #c56c65; --error-11: #86534f;
  --success-3: #e6f6e6; --success-9: #84cc86; --success-11: #486e49;
  --warning-3: #f6f0e4; --warning-9: #ceb47e; --warning-11: #6f6144;
  --info-3: #e7f2fa; --info-9: #7aabce; --info-11: #4c677a;
  --background: var(--neutral-1); --surface: var(--neutral-2);
  --surface-hover: var(--neutral-3); --surface-active: var(--neutral-4);
  --border-subtle: var(--neutral-6); --border: var(--neutral-7); --border-strong: var(--neutral-8);
  --text-secondary: var(--neutral-11); --text: var(--neutral-12);
  --accent-bg-subtle: var(--accent-3); --accent-solid: var(--accent-9);
  --accent-solid-hover: var(--accent-10); --accent-text: var(--accent-11);
}
[data-theme="dark"] { /* 見 palette.mjs 完整輸出；本專案 Demo 範圍不強制要求深色模式 */ }
```
Contrast（`palette.mjs` 自動報告，全數 PASS）：neutral-11/neutral-2 5.68:1、neutral-12/neutral-2 12.91:1、accent-11/neutral-2 5.67:1、accent-on-solid/accent-9 5.55:1（light 全過 4.5:1 / 7:1 門檻，dark 同步全過）。

**熱力帶三色（既有色值不動，見 docs/01）與新底色的對比驗證**（手動 WCAG 計算，非 palette.mjs 生成值）：
| 色帶 | Hex | vs 新底色 #fcfdfd | 結論 |
|---|---|---|---|
| 暢通 green | #3E9C6C | 3.34:1 | 未過 4.5:1（文字用）；可過 3:1（大型/UI元件用） |
| 緩行 yellow | #E9C46A | 1.64:1 | **明顯未過**，黃色本身低對比 |
| 擁擠 red | #D24833 | 4.37:1 | 貼近但未過 4.5:1 |

→ 三色**一律不得**直接當文字色或「實色底+白字」badge 使用（現行 `band-badge` 的白字擁擠徽章用法即為一例，需改）。正確用法：淡色調底（--band-fill 取 3 階，如 error-3/success-3 的淡色邏輯）+ 深色文字（--text）+ 色塊/形狀圖示（暢通=空心圈、緩行=半實圈、擁擠=實心圈，見既有線框稿），色相本身只用在小面積圖示與地圖標記的 glow/dot，不用在大面積文字背景。

## Space, shape, depth
- Spacing scale：4 / 8 / 12 / 16 / 24 / 32 / 48px
- Radius：互動元件（按鈕/chip/搜尋框）全圓角（999px，膠囊感）；卡片/抽屜/彈窗 16px；地圖標記 50%
- Borders/shadows：陰影一律用 hue-shift 過的深色（非純黑），如 `0 -4px 14px rgba(44,46,49,0.14)`；邊框以 1px `--border-subtle` 為主，強調用 `--border-strong`

## Motion
- Timing：micro 120ms／standard 200ms／large 320ms · Easing：`ease-out`（無 bounce/彈性曲線，呼應「工具感、不誇飾」）
- Allowed：抽屜滑入滑出、chip 選中態、城市膠囊數據脈動（見 Expressive moments）· Never：裝飾性彈跳、視差滾動、進場動畫超過 320ms
- prefers-reduced-motion：全數動效降級為即時切換（0.01ms），不提供例外

## Never (this project's tells at risk)
- 不用漸層背景、不用玻璃擬態（glassmorphism）面板——`ai-tells.md` 常見 AI 生成介面特徵
- Accent 藍不得擴散到大面積背景或多個元素同時使用；只出現在：目前選中的圖層/篩選狀態、主要 CTA（導航前往）、azulejo 簽名紋理（見 Signature move）——其餘一律中性灰階
- 熱力帶三色不得以「實色底+白字」呈現（見上方對比驗證表），這是本設計最容易被無意識破壞的一條規則，`audit`/`polish` 需重點檢查
- 不重新引入金色（gold）——研究階段已定案不保留
- 不用襯線字體做任何標題（呼應「工具感」而非「復古/正式」register）

## Open questions
- Dark mode（`[data-theme="dark"]`）token 已由 palette.mjs 生成備查，但本次比賽 Demo 範圍不強制實作深色模式切換 UI，留待賽後
- Azulejo 簽名紋理的實際圖案（SVG tile pattern）尚未設計具體圖形，只定了「藍白四方連續磁磚」的方向與唯一使用位置（三色帶徽章背景），具體紋理素材由 Phase 3（設計系統）落地時製作
