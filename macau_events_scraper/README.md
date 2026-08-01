# 澳門未來活動／演唱會爬蟲

抓取澳門「未來 N 個月」內的大型活動與演唱會資訊，包含活動名稱、日期、地點與連結。

## 資料來源

| 來源 | 網址 | 內容 | 地點資料 |
|---|---|---|---|
| Cotai Ticketing | cotaiticketing.com | 金沙中國場館（The Venetian Arena、The Londoner Arena 等）售票節目，多為演唱會 | 每頁固定有「Venues」欄位，準確可靠 |
| Galaxy Entertainment 官方售票 | galaxymacau.com | 銀河娛樂集團場館（Galaxy Arena 等）售票節目，多為演唱會 | 每頁固定有「Venue:」欄位，準確可靠 |
| MGTO 活動日曆 | macaotourism.gov.mo | 澳門旅遊局公布的節慶、公眾假期、大型節慶活動 | 需進入各活動詳細頁面關鍵字比對擷取，格式不一，取不到時會標示未取得 |

Cotai Ticketing 與 Galaxy Entertainment 的爬取邏輯都放在 [scraper/cotai.py](scraper/cotai.py) 中
（`scrape_cotai_ticketing()` / `scrape_galaxy()`），`scrape()` 會回傳兩者合併後的結果。

## 安裝

```bash
cd macau_events_scraper
pip install -r requirements.txt
```

## 執行

```bash
python main.py                  # 預設：未來 2 個月
python main.py --months 3       # 未來 3 個月
python main.py --no-mgto-venue  # 跳過 MGTO 地點擷取（較快，但地點多半留空）
python main.py --output out.json
```

執行後會在終端機印出活動列表，並輸出 `events.json`（預設檔名）供後續使用。

## 已知限制

- Broadway Macau（百老匯）官網是純前端 SPA（沒有可爬的伺服器渲染內容），因此其節目
  仍以出現在 galaxymacau.com 售票列表上的為準，若之後改版可再另外處理。
- MGTO 日曆中同一活動有時會橫跨多個不連續日期（例如「Feb 19, 23 & Mar 3」），程式
  目前簡化為「最早～最晚」的區間，僅用於判斷是否落在查詢範圍內，不代表活動連續進行。
- MGTO 各活動詳細頁面格式不完全一致，部分頁面（尤其是公眾假期類）抓不到明確地點。
- 兩個網站皆可能隨時改版導致選擇器失效，僅供學習與展示用途，正式使用前請確認
  對方網站的服務條款是否允許爬取。
