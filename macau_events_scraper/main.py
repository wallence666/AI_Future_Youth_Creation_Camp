"""
澳門未來活動／演唱會爬蟲

整合三個資料來源：
  1. Cotai Ticketing（金沙中國場館官方售票網）        — 演唱會、大型騷｜資料乾淨可靠
  2. Galaxy Entertainment 官方售票（銀河娛樂集團場館） — 演唱會、大型騷｜資料乾淨可靠
  3. MGTO 澳門旅遊局活動日曆                          — 節慶、公眾假期、大型節慶活動

抓取後統一格式，篩選出「未來 N 個月」內的活動，輸出成終端機表格與 JSON 檔。

使用方式：
    python main.py                 # 未來 2 個月，含 MGTO 場地擷取
    python main.py --months 3      # 未來 3 個月
    python main.py --no-mgto-venue # 跳過 MGTO 場地擷取（速度較快，但地點常為空）
    python main.py --output events.json
"""

import argparse
import json
from datetime import date, timedelta

import requests

from scraper import cotai, mgto
from scraper.dateparse import parse_cotai_date, parse_galaxy_dates, parse_mgto_dates


def add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, 28)  # 避免月底日期溢位（此處只需概略邊界，不用完全精確）
    return date(year, month, day)


def collect_events(months: int, fetch_mgto_venue: bool):
    session = requests.Session()

    events = []

    for raw in cotai.scrape(session):
        date_parser = parse_galaxy_dates if raw["source"].startswith("Galaxy") else parse_cotai_date
        parsed = date_parser(raw["raw_time"])
        if not parsed or not parsed[0]:
            continue  # 沒有單一日期的常設活動（例如每日開放的展覽），略過
        start, end = parsed
        events.append({**raw, "start_date": start, "end_date": end})

    for raw in mgto.scrape(session, fetch_venue=fetch_mgto_venue):
        start, end = parse_mgto_dates(raw["raw_time"], raw["year"])
        if not start:
            continue
        events.append({**raw, "start_date": start, "end_date": end})

    today = date.today()
    window_end = add_months(today, months)

    upcoming = [
        e for e in events
        if e["end_date"] >= today and e["start_date"] <= window_end
    ]
    upcoming.sort(key=lambda e: e["start_date"])
    return upcoming


def print_table(events):
    if not events:
        print("查無符合區間的活動。")
        return

    for e in events:
        date_text = e["start_date"].isoformat()
        if e["end_date"] != e["start_date"]:
            date_text += f" ~ {e['end_date'].isoformat()}"
        venue = e.get("venue") or "（未取得地點，請見連結）"
        print(f"[{e['source']}] {date_text}")
        print(f"  活動：{e['title']}")
        print(f"  地點：{venue}")
        print(f"  連結：{e['url']}")
        print()


def main():
    parser = argparse.ArgumentParser(description="澳門未來活動／演唱會爬蟲")
    parser.add_argument("--months", type=int, default=2, help="查詢未來幾個月內的活動（預設 2）")
    parser.add_argument("--no-mgto-venue", action="store_true", help="跳過 MGTO 活動地點擷取，加快速度")
    parser.add_argument("--output", default="events.json", help="輸出 JSON 檔案路徑")
    args = parser.parse_args()

    print("正在抓取 Cotai Ticketing 與 MGTO 活動資料 ...\n")
    events = collect_events(months=args.months, fetch_mgto_venue=not args.no_mgto_venue)

    print(f"=== 未來 {args.months} 個月內的澳門活動（共 {len(events)} 筆）===\n")
    print_table(events)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(
            [
                {**e, "start_date": e["start_date"].isoformat(), "end_date": e["end_date"].isoformat()}
                for e in events
            ],
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"已輸出至 {args.output}")


if __name__ == "__main__":
    main()
