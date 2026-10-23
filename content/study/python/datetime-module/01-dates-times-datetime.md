---
id: 6c8fdbdd-a3ef-73d4-87dd-f45de12925aa
key: topic:python/datetime-module
subject: python
topic: datetime-module
title: Dates & Times (datetime)
slug: dates-times-datetime
order: 1
---

`datetime` models calendar dates, clock times and durations. The golden rule: store and compute in <strong>UTC with time-zone-aware objects</strong>, convert to local time only for display.

# The four core types

| Type | Holds | Example |
| --- | --- | --- |
| `date` | Year, month, day | `date(2026, 9, 29)` |
| `time` | Hour … microsecond (+ optional tz) | `time(14, 5)` |
| `datetime` | A date and a time (+ optional tz) | `datetime(2026, 9, 29, 14, 5)` |
| `timedelta` | A duration: days, seconds, microseconds | `timedelta(hours=36)` |

```python filename:Python
from datetime import date, datetime, timedelta

d = date(2026, 9, 29)
print(d.year, d.month, d.day, d.weekday())         # 2026 9 29 1   ← Monday is 0
print(d.isoformat(), d.isocalendar().week)         # 2026-09-29 40

dt = datetime(2026, 9, 29, 14, 5)
print(dt.date(), dt.time())                        # 2026-09-29 14:05:00
print(dt.replace(hour=9, minute=0))                # 2026-09-29 09:00:00
```

> [!NOTE] Key point
>
> `date.today()` and `datetime.now()` depend on when and where the code runs — fine in programs, but never hard-code their output in tests. Pass a fixed `datetime` (or a clock function) into code you want to test.

# Arithmetic with timedelta

```python filename:Python
from datetime import date, datetime, timedelta

print(date(2026, 12, 25) - date(2026, 9, 29))          # 87 days, 0:00:00
print((date(2026, 12, 25) - date(2026, 9, 29)).days)   # 87

start = datetime(2026, 1, 31, 22, 30)
print(start + timedelta(days=1, hours=3))              # 2026-02-02 01:30:00
print(start + timedelta(days=30))                      # 2026-03-02 22:30:00   ← no "add a month" in timedelta

span = timedelta(hours=36, minutes=15)
print(span, span.total_seconds())                      # 1 day, 12:15:00 130500.0
print(datetime(2026, 1, 1) < datetime(2026, 6, 1))     # True
```

> [!WARNING] Watch out
>
> `timedelta` has no months or years (their length varies). For “same day next month”, compute it yourself or use `dateutil.relativedelta`.

# Formatting &amp; parsing: strftime / strptime

```python filename:Python
from datetime import datetime

dt = datetime(2026, 9, 29, 14, 5, 9)
print(dt.strftime("%d/%m/%Y %H:%M"))              # 29/09/2026 14:05
print(dt.strftime("%A, %d %B %Y at %I:%M %p"))    # Tuesday, 29 September 2026 at 02:05 PM
print(f"{dt:%Y-%m-%d}")                           # 2026-09-29   ← format spec in an f-string

parsed = datetime.strptime("29-Sep-2026 18:30", "%d-%b-%Y %H:%M")
print(parsed)                                     # 2026-09-29 18:30:00
print(datetime.fromisoformat("2026-09-29T14:05:00+05:30").utcoffset())   # 5:30:00
```

| Code | Meaning | Example |
| --- | --- | --- |
| `%Y` / `%y` | Year, 4 / 2 digits | `2026` / `26` |
| `%m` / `%B` / `%b` | Month number / full name / short name | `09` / `September` / `Sep` |
| `%d` / `%j` | Day of month / day of year | `29` / `272` |
| `%H` / `%I` / `%p` | Hour 24h / 12h / AM-PM | `14` / `02` / `PM` |
| `%M` / `%S` / `%f` | Minute / second / microsecond | `05` / `09` / `000000` |
| `%A` / `%a` | Weekday full / short | `Tuesday` / `Tue` |
| `%z` / `%Z` | UTC offset / zone name | `+0530` / `IST` |

> [!NOTE] Key point
>
> Prefer ISO 8601 (`2026-09-29T14:05:00+05:30`) for storage and APIs: `isoformat()` and `fromisoformat()` round-trip it, and it sorts correctly as text.

# Naive vs aware; time zones with zoneinfo

> [!INFO]
>
> <strong>Naive vs aware</strong> — a <em>naive</em> `datetime` has no `tzinfo` — it's just wall-clock numbers. An <em>aware</em> one carries a UTC offset, so it denotes one exact instant.

```python filename:Python
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

utc = datetime(2026, 3, 8, 12, 0, tzinfo=timezone.utc)      # an exact instant
print(utc.astimezone(ZoneInfo("Asia/Kolkata")))             # 2026-03-08 17:30:00+05:30
print(utc.astimezone(ZoneInfo("America/New_York")))         # 2026-03-08 08:00:00-04:00   ← DST began that morning

meeting = datetime(2026, 9, 29, 9, 0, tzinfo=ZoneInfo("Europe/London"))
print(meeting.astimezone(timezone.utc))                     # 2026-09-29 08:00:00+00:00

naive = datetime(2026, 1, 1)
try:
    naive < utc
except TypeError:
    print("can't compare naive and aware")                  # can't compare naive and aware
```

> [!TIP] Do
>
> Use `datetime.now(timezone.utc)` and store UTC; convert with `astimezone(ZoneInfo(...))` when displaying.

> [!DANGER] Avoid
>
> `datetime.utcnow()` (deprecated since 3.12 — it returns a <em>naive</em> value that looks local) or storing local times without an offset.

# Timestamps, `time` and `calendar`

```python filename:Python
import time, calendar
from datetime import datetime, timezone

instant = datetime(2026, 9, 29, tzinfo=timezone.utc)
ts = instant.timestamp()                                   # seconds since 1970-01-01 UTC
print(ts)                                                  # 1790640000.0
print(datetime.fromtimestamp(ts, tz=timezone.utc))         # 2026-09-29 00:00:00+00:00

print(calendar.isleap(2028), calendar.monthrange(2026, 2)[1])   # True 28

t0 = time.perf_counter()                                   # for measuring durations
sum(range(10_000))
print(time.perf_counter() - t0 >= 0)                       # True
```

| Clock | Use for |
| --- | --- |
| `time.time()` | Wall-clock timestamp (can jump if the system clock changes) |
| `time.monotonic()` | Timeouts and intervals — never goes backwards |
| `time.perf_counter()` | Benchmarking — highest resolution |
| `time.sleep(s)` | Pause the current thread |

```question
What is the difference between a naive and an aware datetime?

---

A naive datetime has no time-zone information, so it can't be mapped to a single instant; an aware one has `tzinfo` (an offset), so comparisons and arithmetic across zones are correct. Python refuses to compare the two.
```

```question
How should you store timestamps in a database or API?

---

As UTC — either an aware datetime / `TIMESTAMP WITH TIME ZONE`, or an ISO 8601 string with an offset (`2026-09-29T08:00:00+00:00`). Convert to the user's zone only when displaying.
```

```question
Why not use time.time() to measure how long code takes?

---

It follows the system clock, which can be adjusted (NTP, manual changes). Use `time.perf_counter()` (or `monotonic()`), which only moves forward.
```
