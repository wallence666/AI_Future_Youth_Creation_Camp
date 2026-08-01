"""共用的日期解析工具，把兩個資料來源不同格式的日期文字轉成 date 物件。"""

import re
from datetime import date

MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

_COTAI_DATE_RE = re.compile(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})")
_MGTO_TOKEN_RE = re.compile(r"(?:([A-Za-z]+)\s+)?(\d{1,2})(?:\s*-\s*(\d{1,2}))?")
_GALAXY_DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2})\s*(?:[-–]\s*(\d{1,2}))?\s*,\s*(\d{4})"
)


def parse_cotai_date(raw_time: str):
    """解析 cotaiticketing 節目頁的「Show Time」文字，例如：
    '15 Aug 2026 (Saturday) 6pm'。
    若是「Daily ...」這類常設活動（沒有單一日期）則回傳 None。
    """
    if not raw_time:
        return None
    m = _COTAI_DATE_RE.search(raw_time)
    if not m:
        return None
    day, month_name, year = m.groups()
    month = MONTHS.get(month_name.lower())
    if not month:
        return None
    try:
        d = date(int(year), month, int(day))
    except ValueError:
        return None
    return d, d


def parse_mgto_dates(raw_text: str, year: int):
    """解析 MGTO 活動日曆的日期文字，例如：
    'Feb 17-19' / 'Mar 20-29' / 'Feb 19, 23 & Mar 3' / 'February 19 & 28'

    這類文字可能包含多個不連續日期（用逗號或 & 分隔），這裡採取簡化策略：
    取所有出現過的日期中最早與最晚者，當作事件的起訖範圍（足以用來判斷
    活動是否落在查詢區間內，但不代表活動每天都在進行）。
    """
    if not raw_text:
        return None, None

    cleaned = raw_text.replace("&", ",")
    tokens = [t.strip() for t in cleaned.split(",") if t.strip()]

    dates = []
    last_month = None
    for tok in tokens:
        m = _MGTO_TOKEN_RE.match(tok)
        if not m:
            continue
        month_name, day1, day2 = m.groups()
        if month_name:
            month = MONTHS.get(month_name.lower())
            if month:
                last_month = month
        if not last_month:
            continue
        for day in filter(None, (day1, day2)):
            try:
                dates.append(date(year, last_month, int(day)))
            except ValueError:
                continue

    if not dates:
        return None, None
    return min(dates), max(dates)


def parse_galaxy_dates(raw_time: str):
    """解析 Galaxy Entertainment 節目頁「Event Date:」文字，例如：
    'August 29, 2026 (Saturday), 7:00 PM; August 30, 2026 (Sunday), 6:00 PM'
    或 'Aug 1 – 2 , 2026 (Saturday - Sunday) 7PM'（同一活動橫跨多天時，
    Event Date 底下可能有多行，這裡以「; 」串接後一次解析）。
    """
    if not raw_time:
        return None, None

    dates = []
    for month_name, day1, day2, year in _GALAXY_DATE_RE.findall(raw_time):
        month = MONTHS.get(month_name.lower())
        if not month:
            continue
        for day in filter(None, (day1, day2)):
            try:
                dates.append(date(int(year), month, int(day)))
            except ValueError:
                continue

    if not dates:
        return None, None
    return min(dates), max(dates)
