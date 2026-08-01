"""爬取兩大博企官方售票網的節目列表：

1. Cotai Ticketing（金沙中國：The Venetian / The Londoner 等場館）
   來源：https://www.cotaiticketing.com/
   每個節目有獨立頁面 /shows/<slug>.html，頁面內含「Show Time」與「Venues」欄位。

2. Galaxy Entertainment Group 官方售票（銀河娛樂集團：Galaxy Arena 等場館）
   來源：https://www.galaxymacau.com/en/ticketing/event-list/
   每個節目有獨立頁面 /offers/entertainment/<slug>/，頁面內含
   「Event Date:」與「Venue:」標籤。

`scrape()` 會把兩個來源的結果合併回傳，格式統一。
"""

import html
import re

import requests

COTAI_BASE_URL = "https://www.cotaiticketing.com"
GALAXY_BASE_URL = "https://www.galaxymacau.com"
GALAXY_LIST_URL = GALAXY_BASE_URL + "/en/ticketing/event-list/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; MacauEventsBot/1.0)"}


def _text_lines(page_html: str):
    text = re.sub(r"<script.*?</script>", " ", page_html, flags=re.S)
    text = re.sub(r"<style.*?</style>", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    return [html.unescape(line).strip() for line in text.splitlines() if line.strip()]


def list_show_urls(session: requests.Session):
    resp = session.get(COTAI_BASE_URL + "/", headers=HEADERS, timeout=15)
    resp.raise_for_status()
    paths = sorted(set(re.findall(r'href="(/shows/[a-zA-Z0-9_-]+\.html)"', resp.text)))
    return [COTAI_BASE_URL + path for path in paths]


def fetch_show(session: requests.Session, url: str):
    resp = session.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()

    title_match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.S)
    title = html.unescape(title_match.group(1)).strip() if title_match else None

    lines = _text_lines(resp.text)
    if not lines or (title and "expired" in title.lower()):
        return None

    raw_time = venue = None
    if "Show Time" in lines:
        time_idx = lines.index("Show Time")
        raw_time = lines[time_idx + 1]
        try:
            venue_idx = lines.index("Venues", time_idx + 1)
            venue = lines[venue_idx + 1]
        except ValueError:
            pass

    if not title or not raw_time:
        return None

    return {
        "source": "Cotai Ticketing",
        "title": title,
        "raw_time": raw_time,
        "venue": venue,
        "url": url,
    }


def scrape_cotai_ticketing(session: requests.Session = None):
    session = session or requests.Session()
    events = []
    for url in list_show_urls(session):
        try:
            item = fetch_show(session, url)
        except requests.RequestException:
            continue
        if item:
            events.append(item)
    return events


def list_galaxy_event_urls(session: requests.Session):
    resp = session.get(GALAXY_LIST_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    paths = sorted(set(re.findall(
        r'href="(/offers/entertainment/[a-zA-Z0-9_-]+/)"', resp.text
    )))
    return [GALAXY_BASE_URL + "/en" + path for path in paths]


def fetch_galaxy_event(session: requests.Session, url: str):
    resp = session.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    resp.encoding = "utf-8"  # galaxymacau.com 未在回應標頭宣告 charset，避免被誤判為 ISO-8859-1

    title_match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.S)
    title = html.unescape(title_match.group(1)).split("|")[0].strip() if title_match else None

    lines = _text_lines(resp.text)
    if not title or "Event Date:" not in lines or "Venue:" not in lines:
        return None

    date_idx = lines.index("Event Date:")
    venue_idx = lines.index("Venue:")

    date_lines = lines[date_idx + 1:venue_idx] if venue_idx > date_idx else []
    if not date_lines:
        return None

    return {
        "source": "Galaxy Entertainment (GEG)",
        "title": title,
        "raw_time": "; ".join(date_lines),
        "venue": lines[venue_idx + 1] if venue_idx + 1 < len(lines) else None,
        "url": url,
    }


def scrape_galaxy(session: requests.Session = None):
    session = session or requests.Session()
    events = []
    for url in list_galaxy_event_urls(session):
        try:
            item = fetch_galaxy_event(session, url)
        except requests.RequestException:
            continue
        if item:
            events.append(item)
    return events


def scrape(session: requests.Session = None):
    """合併 Cotai Ticketing 與 Galaxy Entertainment 兩個博企售票網的節目。"""
    session = session or requests.Session()
    return scrape_cotai_ticketing(session) + scrape_galaxy(session)
