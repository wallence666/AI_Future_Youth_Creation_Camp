"""爬取澳門旅遊局（MGTO）官方活動日曆。

來源：https://www.macaotourism.gov.mo/en/events/calendar
涵蓋節慶、公眾假期、大型活動等，資料以「月份區塊」呈現一整年的活動列表。
活動地點需另外進到各活動的詳細頁面，用簡單的關鍵字比對（Venue / Location）
盡力擷取，並非所有頁面格式都一致，抓不到時會回傳 None。
"""

import html
import re
from collections import Counter

import requests

BASE_URL = "https://www.macaotourism.gov.mo"
CALENDAR_URL = BASE_URL + "/en/events/calendar"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MacauEventsBot/1.0)"}

_BLOCK_RE = re.compile(
    r'<a href="([^"]+)"[^>]*class="m-calendar__item"[^>]*>(.*?)</a>', re.S
)
_TAG_RE = re.compile(r'm-calendar__(major-event|public-holiday)">\s*([^<]*?)\s*<')
_DATE_RE = re.compile(r'fa-calendar"></i>\s*([^<]+?)\s*</span>')
_NAME_RE = re.compile(r'm-calendar__event-name">([^<]+)<')
_VENUE_RE = re.compile(r"(Main Venue|Venue|Location)s?\s*:\s*([^\n]+)")
_YEAR_RE = re.compile(r"\b(20\d{2})\b")


def _detect_year(page_text: str, fallback_year: int) -> int:
    counts = Counter(_YEAR_RE.findall(page_text))
    if not counts:
        return fallback_year
    return int(counts.most_common(1)[0][0])


def _venue_from_detail(session: requests.Session, url: str):
    try:
        resp = session.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException:
        return None

    text = re.sub(r"<script.*?</script>", " ", resp.text, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    text = html.unescape(text)

    m = _VENUE_RE.search(text)
    return m.group(2).strip() if m else None


def scrape(session: requests.Session = None, fetch_venue: bool = True,
           fallback_year: int = 2026):
    session = session or requests.Session()
    resp = session.get(CALENDAR_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    year = _detect_year(resp.text, fallback_year)

    seen = set()
    events = []
    for link, block in _BLOCK_RE.findall(resp.text):
        name_m = _NAME_RE.search(block)
        date_m = _DATE_RE.search(block)
        if not name_m or not date_m:
            continue

        name = html.unescape(name_m.group(1)).strip()
        raw_time = html.unescape(date_m.group(1)).strip()
        tag_m = _TAG_RE.search(block)
        tag = tag_m.group(2).strip() if tag_m else None

        url = link if link.startswith("http") else BASE_URL + link

        key = (name, raw_time, url)
        if key in seen:
            continue
        seen.add(key)

        events.append({
            "source": "MGTO",
            "title": name,
            "raw_time": raw_time,
            "tag": tag,
            "venue": None,
            "url": url,
            "year": year,
        })

    if fetch_venue:
        for ev in events:
            try:
                ev["venue"] = _venue_from_detail(session, ev["url"])
            except requests.RequestException:
                ev["venue"] = None

    return events
