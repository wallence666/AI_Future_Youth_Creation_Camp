# 澳行無阻 — 遊客主應用 UI/UX 重新設計 · 設計計畫

**來源研究文件**：`.design-foundations/research/2026-08-06-axwz-app-redesign.md`
**日期**：2026-08-07　**Track**：Standard　**進入點**：Discover（無既有 DESIGN.md/JOURNEY.md）

---

## Context

**Problem**：重新設計「澳行無阻」遊客主應用（`app/index.html`）的 UI 與 UX——視覺語言從現有藏青金「夜間尊貴」風格，換成 Google 地圖/Citymapper 式的中性工具感淺色介面；同時一併檢視並簡化既有互動流程（地圖/熱力圖/美食圖切換、篩選、景點與美食詳情抽屜、底部工作表、回報人流、打卡、評論、積分、代金券兌換），讓核心操作更直覺、步驟更少。CrowdIndex 模型、Leaflet 地圖核心、後端 API 等底層資料流不變。

**Constraints**：
- 範圍只限遊客主應用，商家/管理後台不動，兩套視覺語言並存是已接受的取捨
- 葡式瓷磚（azulejo）藍白作為地方識別強調色，非主色調；三色熱力帶（綠/黃/紅）色值不變，新底色需與其對比度符合 WCAG AA
- 手機優先（PWA），但需兼顧比賽 Demo 現場投影/大螢幕的可讀性
- 時間緊迫，執行要精簡、盡量一次到位，不做多輪反覆打磨

**Success criteria**：
- 視覺：中性克制、資訊優先的淺色介面成立，azulejo 藍白識別可辨識但不喧賓奪主，全部文字/背景對比通過 WCAG AA
- 互動：核心任務（查擁擠度、找美食、回報/打卡/評論/兌換）操作步驟不多於現況，明顯冗餘步驟被移除
- 一致性：新 token 系統覆蓋所有介面元件，無寫死色值/字體
- 可展示：手機與投影/大螢幕情境下都可讀清楚

## Chosen Approach

單一遊客主應用的「換皮 + 流程精簡」一次到位重設計：先跑一個 Discover 階段把既有 IA/流程正式寫成 JOURNEY.md（順便抓出可簡化的步驟），再用一個高判斷力的 DNA 階段鎖定視覺識別（Google 地圖 UI + azulejo 瓷磚兩份錨定參考），最後三個 Design 階段（設計系統／文案／數據視覺化）平行展開、各自消費同一份鎖定的 DESIGN.md 與 JOURNEY.md。不拆多輪迭代，因應時間壓力。

## Rejected Approaches

- **保留藏青金、只淺色化外殼**：使用者已在研究階段明確否決（整套重新設計，識別可換），不再列入選項
- **Quick track（單頁面直接改）**：應用內互動介面種類多（地圖、抽屜、工作表、篩選、多個表單型 modal），且使用者確認流程本身也要重新設計，複雜度不符合 Quick 的「單一畫面、目標明確」條件，故升級為 Standard
- **DNA 與設計系統合併成一個階段**：時間雖緊迫，但 DNA（高判斷力、fable 等級）與設計系統落地（機械化延伸、sonnet 等級）性質不同，合併會讓整個階段被迫用高成本模型跑，拆開讓後三個階段可以快速並行，對「一次到位」反而更有效率

## Assumptions

- 現有後端 API、資料結構（`spots.json`/`foods.json`/CrowdIndex 各項）不因本次重設計而變動，Design 階段只處理呈現層
- 三色熱力帶語意色（綠/黃/紅）沿用現有色值，不在 DNA 階段重新生成
- 比賽 Demo 沒有多語系需求，維持現有繁中內容

## Decision Log

- **型別/色彩併入 DNA 階段（Phase 2），不獨立成 Phase**：研究階段已 pin 住淺色底與 azulejo 藍色相家族，2/4 軸已定，獨立成兩階段對時間緊迫的專案效益不高，合併後仍完整跑 diverge/critique，只是少一次階段切換開銷
- **設計系統階段（Phase 3）排除治理模型（§D：版本/棄用/多團隊協作/design-to-code pipeline）**：`design-systems` doctrine 本身指出治理模型是給多團隊/多產品共享場景，本專案是單人/小隊比賽專案，不適用，故只取 §B token tiers + §C atomic decomposition
- **色盲冗餘編碼歸在 Phase 5（data-viz）而非 Phase 2（color）**：依 pillar-taxonomy §2 disjoint scope，「brand/UI 調色盤」屬 `color`，「圖表/資料色彩可及性」屬 `data-viz`，熱力帶是資料編碼不是品牌配色，歸屬 data-viz
- **JTBD 學派鎖定 Moesta Switch interview（四力模型）**：`journey` doctrine 規則要求整案只用一個學派，Moesta 對產品團隊最可執行，故定案，Phase 1 不得混用其他學派

## Verification Plan

**驗證方法對照**（依 done-when 類別，workflow-conventions.md §3 詞彙）：
- **Artifact presence**（DW-1.1~1.4、DW-2.1、DW-3.1~3.2、DW-4.1、DW-5.1~5.2）：檢查對應檔案/章節確實存在且欄位齊全
- **Contrast**（DW-2.2、DW-2.4）：`palette.mjs` 自動跑分，light/dark 皆需過 WCAG AA
- **Token coverage**（DW-2.3、DW-3.1~3.3）：mock 渲染後掃描確認無寫死 hex/字體
- **Heuristic pass**（DW-1.5、DW-2.5、DW-3.4、DW-4.2、DW-4.3、DW-4.4、DW-5.3、DW-5.4）：design-review-agent 對照對應法則/清單複查（未定義 token 掃描、Yifrah 公式核對、揭露文字保真度、預測 vs 已發生視覺區分等），回傳 PASS 或 Major 已解決

**Dirty cases**（取自各階段 Edge cases）：
1. 離線狀態下 page spec 的 states 是否仍完整覆蓋（Phase 1）
2. 流程精簡後，未定位/篩選無結果等既有錯誤路徑是否仍保留（Phase 1）
3. DESIGN.md 未鎖定時，Phase 3/4/5 是否正確擋下、不得越過 gate 開始工作
4. 五個 DNA 候選若集體收斂到同一 tells 叢集，是否觸發 loop back 而非妥協選最不差的（Phase 2）
5. 熱力帶三色與新底色對比若未過 AA，`palette.mjs` 是否正確標記失敗（Phase 2）
6. 元件在多重互動狀態（抽屜拖曳中、工作表半開）下 token 是否仍定義完整（Phase 3）
7. 錯誤文案是否覆蓋每個離線/API 失敗情境，且無歸咎使用者語氣（Phase 4）
8. 地圖縮小、標記重疊時色盲冗餘圖示是否仍可辨識（Phase 5）
9. 趨勢圖表的預測值段落是否與已發生數據有明確視覺區分（Phase 5）

**Verification level：Standard**（每階段完成後由 design-review-agent 複查一次；Phase 1/2 兩個 Full gate 額外要求使用者親自確認才能解鎖下一階段）

---

## Phase 1: Discover — JTBD/IA/流程與頁面規格
**Stage:** Discover
**Model:** fable
**Doctrine:** journey, usability
**Gate:** Full

**Goal:** 把現有（隱含在代碼裡的）JTBD、IA 與互動流程正式寫成 JOURNEY.md，並依 UX 法則找出、精簡明顯冗餘的步驟。

**Scope:**
- IN：核心任務（查景點擁擠度、找美食、回報人流、打卡、評論、積分/代金券兌換）；地圖圖層切換、篩選、搜尋、詳情抽屜、底部工作表的 IA 與流程
- OUT：後端 API/資料結構改動；商家/管理後台

**Constraints:**
- JTBD 用 Moesta Switch interview 四力模型書寫 job story，不與其他學派混用
- 流程精簡須具體引用 Hick's law（決策選項數）或 Fitts's law（CTA/FAB 尺寸位置），不能只是主觀「感覺變簡單」
- 抽屜/工作表資訊分組須引用 Miller/Cowan（~4±1 組塊）
- 三色熱力帶語意與 CrowdIndex 數據來源誠實揭露不可被精簡掉（見專案既有 docs/01）

**Edge cases:**
- 離線（Service Worker 快取回退）狀態需在 page spec 的 states 明確定義
- 未定位、篩選結果為空、資料載入失敗等既有錯誤狀態，精簡後仍需有對應處理路徑

**Produces:** JOURNEY.md（Job + Journey + IA + Flows + Page specs）
**Depends on:** 研究文件 | **Unlocks:** Phase 2, 3, 4, 5

**Done when:**
- [ ] DW-1.1: JOURNEY.md `## Job` 完整（job story + 功能/情感/社會三面向），JTBD 學派標註 Moesta，未混用
- [ ] DW-1.2: JOURNEY.md `## IA` 有組織方案、結構類型、全域導覽標籤
- [ ] DW-1.3: JOURNEY.md `## Flows` 涵蓋全部核心任務流程，每個流程標註其精簡依據的法則（Hick/Fitts）
- [ ] DW-1.4: JOURNEY.md `## Page specs` 對每個主要畫面/面板（地圖首頁、景點/美食詳情抽屜、篩選面板、回報/打卡/評論/兌換表單）有完整條目，含 states
- [ ] DW-1.5: design-review-agent 啟發式評估精簡後流程，無 Critical 發現，Major 發現已解決或明確接受

## Phase 2: Design — DNA 與色彩/字體 Token
**Stage:** Design
**Model:** fable
**Doctrine:** design-dna, archetypes, foundations, color, fonts
**Gate:** Full

**Goal:** 跑完整 ground→diverge→critique→converge 流程，鎖定 DESIGN.md（含色彩/字體 token block）。

**Scope:**
- IN：色彩策略、字體、間距/圓角/陰影、動效基調、signature move；WCAG 對比驗證
- OUT：元件層級規格（Phase 3）、文案語氣（Phase 4）

**Constraints:**
- 兩份錨定參考已由研究階段定案：Google 地圖行動版 UI（工具感）+ 葡式瓷磚 azulejo 藍白紋樣（地方識別），GROUNDING 行照此寫，不可另起爐灶
- azulejo 藍已實質 pin 住強調色的色相家族，淺色底也已 pin；五個候選仍需正常跑 diverge/critique，不可因兩軸已定就跳過
- 三色熱力帶（綠/黃/紅）色值不動，需用 `palette.mjs` 驗證新底色/文字與這三色對比皆過 WCAG AA
- 金色（gold）不得出現在任一候選（已定案不保留）

**Edge cases:**
- 若五候選色相/字體收斂到同一統計中心（tells scan 命中同一叢集），須重新 ground 後 loop 一輪，不可直接妥協選最不差的
- azulejo 藍若與連結色等既有語意色衝突，DESIGN.md 需明確區分語意

**Produces:** DESIGN.md（鎖定，含完整 token block）
**Depends on:** Phase 1（JOURNEY.md） | **Unlocks:** Phase 3, 4, 5

**Done when:**
- [ ] DW-2.1: DESIGN.md 存在且已鎖定（token block 齊全 + 使用者確認），GROUNDING 行引用兩份既定參考
- [ ] DW-2.2: 色彩 token 涵蓋語意別名（--background/--surface/--text/--accent-solid）與 functional colors，dark/light 皆過 palette.mjs 對比檢查
- [ ] DW-2.3: 型別 scale（--text-xs 至 --text-4xl）齊全
- [ ] DW-2.4: 熱力帶三色與新 token 底色/文字對比皆通過 WCAG AA
- [ ] DW-2.5: tells scan 無高嚴重度命中（或已具體說明合理豁免理由）

## Phase 3: Design — 設計系統／元件規格
**Stage:** Design
**Model:** sonnet
**Doctrine:** design-systems
**Gate:** Standard

**Goal:** 把 DESIGN.md 全域 token 升級成三層語意 token（global→alias→component），用 atomic design 把既有介面拆成可重用元件規格。

**Scope:**
- IN：三層 token；atoms→molecules→organisms 對應既有元件（按鈕/篩選chip/卡片/fab/pill → 搜尋列/景點卡 → 抽屜/底部工作表/圖層面板/彈窗）
- OUT：治理模型（版本/棄用/多團隊協作流程）——單人/小隊比賽專案不需要，不在此階段產出

**Constraints:**
- 三層 token 需符合 W3C DTCG 格式（$type/$value/$description）
- 沿用 Phase 2 鎖定的 global token，不重新生成 palette；改動全域色彩需回頭跑 palette.mjs
- 元件對應以 Phase 1 JOURNEY.md 的 page specs 為準，不可漏掉已定義的畫面/面板

**Edge cases:**
- 抽屜/工作表等元件有多種互動狀態（開合/拖曳/載入中），規格需覆蓋這些狀態的 token 差異
- 熱力帶色需獨立於一般 accent alias，若既有 alias 不合用需新增專屬 alias 並標註原因

**Produces:** token tiers（global/alias/component）+ component specs
**Depends on:** Phase 1（JOURNEY.md）、Phase 2（DESIGN.md locked） | **Unlocks:** mock/build 階段消費

**Done when:**
- [ ] DW-3.1: 三層 token 齊全，alias 層皆為語意命名（非顏色名稱本身）
- [ ] DW-3.2: atomic 分解涵蓋 JOURNEY.md 所有 page specs 對應元件，無寫死色值/字體
- [ ] DW-3.3: 熱力帶三色以獨立 alias token 呈現，與一般 accent 語意明確區分
- [ ] DW-3.4: design-review-agent 確認無元件使用未定義 token

## Phase 4: Design — 文案／微文案
**Stage:** Design
**Model:** sonnet
**Doctrine:** content-design
**Gate:** Standard

**Goal:** 用 content-first 流程為 JOURNEY.md 各頁面/狀態寫出符合中性工具感語氣的文案，並讓既有模型誠實揭露內容（7/18 停車覆蓋率、observedMax 校準等）維持清楚易懂。

**Scope:**
- IN：按鈕/CTA 標籤、空狀態、錯誤訊息、載入狀態文案、模型說明資訊彈窗、既有誠實揭露文字的語氣調整
- OUT：語言在地化/多語系

**Constraints:**
- 錯誤訊息遵循 Yifrah 公式：發生什麼→為什麼→怎麼修，不歸咎使用者
- 中性工具感語氣：直接、簡短、不誇飾，避免行銷語氣（呼應「像 Google 地圖」定調）
- 既有誠實揭露文案內容不可被簡化到失真，只調整語氣/呈現方式使其更易讀

**Edge cases:**
- 離線/API 失敗錯誤文案需覆蓋 Phase 1 定義的所有錯誤狀態，不可遺漏
- 空狀態（篩選無結果、無停車數據景點）文案需給下一步動作建議，不能只說「沒有資料」

**Produces:** page specs 補上 microcopy（依 Phase 1 頁面條目逐一附加文案，不改動 Phase 1 已定的結構/states 欄位；Phase 3/5 只讀取 Phase 1 的原始頁面規格，不依賴本階段附加的文案）
**Depends on:** Phase 1（頁面/狀態清單）、Phase 2（語氣/register 定調） | **Unlocks:** mock/build 消費，與 Phase 3/5 並行

**Done when:**
- [ ] DW-4.1: JOURNEY.md 所有 page specs 的 states（loading/empty/error/success）都有對應文案
- [ ] DW-4.2: 錯誤訊息全數符合 Yifrah 公式
- [ ] DW-4.3: 誠實揭露文字保留原意，經審視語氣後更易讀
- [ ] DW-4.4: design-review-agent 確認無術語/行銷語氣殘留，voice 與 register 一致

## Phase 5: Design — 數據視覺化規格
**Stage:** Design
**Model:** sonnet
**Doctrine:** data-viz
**Gate:** Standard

**Goal:** 讓熱力圖三色帶與「何時去最好」趨勢圖表符合誠實編碼原則，補上色盲安全的冗餘標示。

**Scope:**
- IN：熱力圖三色帶圖例與地圖標記的色盲冗餘標示（形狀/圖示）、CrowdIndex 趨勢/預測折線圖編碼檢查（軸線、基準線、時間範圍）
- OUT：CrowdIndex 模型計算邏輯本身（不動，見既有 docs/01）

**Constraints:**
- 色彩不得是熱力帶唯一編碼管道：綠/黃/紅需各自搭配形狀或圖示差異，符合色盲安全原則（約 8% 男性紅綠色盲）
- 趨勢圖表 y 軸不可截斷、需標示基準線與時間範圍
- 沿用 Phase 2 鎖定的 token；熱力帶色值本身不變，只補編碼冗餘

**Edge cases:**
- 地圖縮小時多個標記重疊，色盲冗餘圖示在小尺寸下仍需可辨識
- 預測值與即時值需視覺上明確區分（如虛線 vs 實線），避免使用者誤把預測當已發生

**Produces:** chart/legend specs（熱力圖圖例 + 趨勢圖表編碼規格）
**Depends on:** Phase 1（JOURNEY.md）、Phase 2（DESIGN.md token） | **Unlocks:** mock/build 消費，與 Phase 3/4 並行

**Done when:**
- [ ] DW-5.1: 熱力帶三色皆有非色彩冗餘編碼，通過色盲模擬檢查
- [ ] DW-5.2: 趨勢圖表無截斷軸線、無誤導框架，時間範圍與基準線清楚標示
- [ ] DW-5.3: 預測值與即時值有明確視覺區分
- [ ] DW-5.4: design-review-agent 對照誠實編碼清單複查，無 Critical 發現
