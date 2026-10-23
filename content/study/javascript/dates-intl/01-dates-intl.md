---
id: d93d2b92-4bc0-71f1-a6f8-7b15d06f1084
key: topic:javascript/dates-intl
subject: javascript
topic: dates-intl
title: Dates & Intl
slug: dates-intl
order: 1
---

`Date` stores a single number — milliseconds since 1 Jan 1970 UTC — and has an awkward API. `Intl` formats dates, numbers and lists for any locale; `Temporal` is the modern replacement arriving now.

# Creating dates

```javascript filename:JavaScript
const epoch = new Date(0);
console.log(epoch.toISOString());
const utc = new Date(Date.UTC(2024, 0, 31, 12, 30));   // months are 0-based!
console.log(utc.toISOString(), utc.getTime());
console.log(new Date("2024-02-29T10:00:00Z").toISOString());
console.log(new Date("not a date").getTime(), String(new Date("nope")));
```

```text filename:Output
1970-01-01T00:00:00.000Z
2024-01-31T12:30:00.000Z 1706704200000
2024-02-29T10:00:00.000Z
NaN Invalid Date
```

> [!WARNING] Watch out
>
> Months are <strong>0-based</strong> (`0` = January) but days are 1-based. Date-only strings like `"2024-01-15"` are parsed as <strong>UTC</strong>, while `"2024-01-15T10:00"` (no zone) is <strong>local</strong> time. Always store and send ISO strings with `Z` or an offset.

# Reading and doing arithmetic

```javascript filename:JavaScript
const d = new Date(Date.UTC(2024, 0, 31));
console.log(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCDay());
d.setUTCMonth(d.getUTCMonth() + 1);        // Jan 31 + 1 month → overflows!
console.log(d.toISOString().slice(0, 10));

const a = new Date("2024-03-01T00:00:00Z"), b = new Date("2024-03-15T00:00:00Z");
const days = (b - a) / (1000 * 60 * 60 * 24);   // subtraction → milliseconds
console.log(days, a < b);
const addDays = (date, n) => new Date(date.getTime() + n * 86_400_000);
console.log(addDays(a, 10).toISOString());
```

```text filename:Output
2024 0 31 3
2024-03-02
14 true
2024-03-11T00:00:00.000Z
```

> [!NOTE] Key point
>
> `Date` objects are <strong>mutable</strong> — `setX` methods change them in place. Copy first: `new Date(d)`. Adding fixed milliseconds ignores daylight-saving shifts; for calendar maths use `Temporal` or a library (date-fns, Luxon, Day.js).

# Formatting with Intl

```javascript filename:JavaScript
const when = new Date(Date.UTC(2024, 6, 4, 15, 5));
const opts = { dateStyle: "long", timeStyle: "short", timeZone: "UTC" };
console.log(new Intl.DateTimeFormat("en-US", opts).format(when));
console.log(new Intl.DateTimeFormat("en-GB", opts).format(when));
console.log(when.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }));

console.log(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(1234567.5));
console.log(new Intl.NumberFormat("en-US", { notation: "compact" }).format(2_500_000));
console.log(new Intl.NumberFormat("en-US", { style: "percent" }).format(0.256));
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
console.log(rtf.format(-1, "day"), "|", rtf.format(3, "week"));
console.log(new Intl.ListFormat("en", { type: "conjunction" }).format(["JS", "CSS", "HTML"]));
console.log(new Intl.PluralRules("en", { type: "ordinal" }).select(22));
```

```text filename:Output
July 4, 2024 at 3:05 PM
4 July 2024 at 15:05
Thu, 4 Jul
₹12,34,567.50
2.5M
26%
yesterday | in 3 weeks
JS, CSS, and HTML
two
```

# Temporal (the future of dates)

`Temporal` (Stage 3, shipping in browsers from 2025–26) replaces `Date` with immutable, zone-aware types: `Temporal.PlainDate`, `PlainTime`, `ZonedDateTime`, `Instant`, `Duration`. Month numbers start at 1, and arithmetic like `date.add({ months: 1 })` is calendar-correct.

```javascript filename:JavaScript
// Temporal isn't enabled by default in Node 24 — shown for reference.
const d = Temporal.PlainDate.from("2024-01-31");
console.log(d.add({ months: 1 }).toString());   // 2024-02-29 (clamped, not overflowed)
```

```question
How do you compare two dates?

---

Compare their timestamps: `a.getTime() === b.getTime()` for equality (`===` on Date objects compares references), and `<`/`>` or subtraction for ordering, since Dates coerce to their millisecond value.
```
