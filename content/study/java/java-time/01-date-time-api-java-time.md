---
id: 376cfc31-836f-79f0-91f3-6e4dad8bee58
key: topic:java/java-time
subject: java
topic: java-time
title: Date & Time API (java.time)
slug: date-time-api-java-time
order: 1
---

Java 8's `java.time` package replaced the broken `Date` and `Calendar` classes with immutable, thread-safe types that say exactly what they mean.

# Why the old API was bad

> [!NOTE] Mutable
>
> `Date` and `Calendar` have setters — sharing one between objects or threads leads to surprise changes.

> [!NOTE] Confusing
>
> `Date` is really an instant; months in `Calendar` start at 0 (`Calendar.JANUARY == 0`); years in `Date` are offset by 1900.

> [!NOTE] Not thread-safe
>
> `SimpleDateFormat` keeps internal state — sharing one across threads corrupts results.

> [!NOTE] One type for everything
>
> No separate concept of "a date", "a time of day" or "a duration".

# The main types

| Type | Represents | Example |
| --- | --- | --- |
| `LocalDate` | a date without time or zone | `2024-03-15` — birthdays, holidays |
| `LocalTime` | a time of day | `09:30` |
| `LocalDateTime` | date + time, no zone | `2024-03-15T09:30` — a meeting "on the wall clock" |
| `ZonedDateTime` | date + time + zone rules (DST aware) | `2024-03-15T09:30+05:30[Asia/Kolkata]` |
| `Instant` | a point on the UTC timeline (epoch nanos) | `2024-03-15T04:00:00Z` — timestamps, logs |
| `Duration` | a time-based amount (seconds/nanos) | `PT1H30M` |
| `Period` | a date-based amount (years/months/days) | `P1Y2M3D` |
| `DateTimeFormatter` | immutable, thread-safe formatter/parser | `ofPattern("dd/MM/yyyy")` |

# Creating and manipulating (always returns a new object)

```java filename:Java
import java.time.*;
import java.time.temporal.ChronoUnit;

public class Main {
    public static void main(String[] args) {
        LocalDate d = LocalDate.of(2024, 1, 31);
        System.out.println(d);
        System.out.println(d.plusMonths(1));             // clamps to Feb 29 (leap year)
        System.out.println(d.plusDays(1).getDayOfWeek());
        System.out.println(d.isLeapYear() + " " + d.lengthOfMonth());

        d.plusYears(1);                                  // result ignored — d unchanged!
        System.out.println(d);

        LocalDateTime meeting = LocalDateTime.of(2024, 3, 15, 9, 30);
        System.out.println(meeting.plusHours(2).withMinute(0));

        LocalDate a = LocalDate.of(2024, 1, 1), b = LocalDate.of(2024, 12, 25);
        System.out.println(ChronoUnit.DAYS.between(a, b));
        System.out.println(Period.between(a, b));
        System.out.println(a.isBefore(b));
    }
}
```

```text filename:Output
2024-01-31
2024-02-29
THURSDAY
true 31
2024-01-31
2024-03-15T11:00
359
P11M24D
true
```

> [!WARNING] Watch out
>
> Every `plus`/`with` method returns a <em>new</em> object. Writing `date.plusDays(1);` on its own line does nothing — assign the result.

# Zones, instants and durations

```java filename:Java
import java.time.*;

public class Main {
    public static void main(String[] args) {
        LocalDateTime local = LocalDateTime.of(2024, 3, 15, 9, 30);
        ZonedDateTime india = local.atZone(ZoneId.of("Asia/Kolkata"));
        ZonedDateTime ny = india.withZoneSameInstant(ZoneId.of("America/New_York"));
        System.out.println(india);
        System.out.println(ny);

        Instant instant = india.toInstant();
        System.out.println(instant);
        System.out.println(instant.getEpochSecond());
        System.out.println(Instant.ofEpochSecond(0));

        Duration flight = Duration.ofMinutes(135);
        System.out.println(flight + " = " + flight.toHours() + "h " + flight.toMinutesPart() + "m");
        System.out.println(Duration.between(LocalTime.of(9, 0), LocalTime.of(17, 45)));
    }
}
```

```text filename:Output
2024-03-15T09:30+05:30[Asia/Kolkata]
2024-03-15T00:00-04:00[America/New_York]
2024-03-15T04:00:00Z
1710475200
1970-01-01T00:00:00Z
PT2H15M = 2h 15m
PT8H45M
```

> [!NOTE] Duration vs Period
>
> `Duration` measures machine time (exact seconds); `Period` measures calendar time. Adding `Period.ofDays(1)` across a DST change keeps the wall-clock time; adding `Duration.ofHours(24)` keeps the exact elapsed time.

# Formatting and parsing

```java filename:Java
import java.time.*;
import java.time.format.*;

public class Main {
    public static void main(String[] args) {
        DateTimeFormatter f = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        LocalDateTime t = LocalDateTime.of(2024, 7, 4, 18, 5);
        System.out.println(t.format(f));
        System.out.println(LocalDateTime.parse("25/12/2024 08:00", f));
        System.out.println(LocalDate.parse("2024-02-29"));       // ISO format by default
        System.out.println(t.format(DateTimeFormatter.ISO_LOCAL_DATE));
        try {
            LocalDate.parse("2023-02-29");
        } catch (DateTimeParseException e) {
            System.out.println("invalid: " + e.getParsedString());
        }
    }
}
```

```text filename:Output
04/07/2024 18:05
2024-12-25T08:00
2024-02-29
2024-07-04
invalid: 2023-02-29
```

| Pattern letter | Meaning | Trap |
| --- | --- | --- |
| `yyyy` / `uuuu` | year | `YYYY` is the <em>week-based</em> year — wrong around New Year |
| `MM` / `mm` | month / <strong>minute</strong> | mixing them up is the #1 formatting bug |
| `dd` / `DD` | day of month / day of <strong>year</strong> |  |
| `HH` / `hh` + `a` | 24-hour / 12-hour + AM/PM |  |

> [!TIP] Do
>
> Store and transmit `Instant` (UTC) or ISO-8601 strings; convert to `ZonedDateTime` only for display. Inject a `Clock` instead of calling `now()` directly so tests are deterministic: `LocalDate.now(clock)`.

```question
Why is java.time better than java.util.Date?

---

Its types are immutable and thread-safe, months are 1-based, each concept has its own type (`LocalDate`, `Instant`, `Duration`, `Period`), time zones are handled explicitly via `ZoneId`, and `DateTimeFormatter` is thread-safe unlike `SimpleDateFormat`.
```

```question
LocalDateTime vs ZonedDateTime vs Instant?

---

`LocalDateTime` is a wall-clock reading with no zone — it is not a point in time. `ZonedDateTime` adds a zone (with DST rules), making it an exact moment shown in local terms. `Instant` is the exact moment in UTC, ideal for timestamps and storage.
```

```question
How do you convert between old and new APIs?

---

`date.toInstant()` / `Date.from(instant)`, `calendar.toInstant()`, `new java.sql.Date(...).toLocalDate()` / `java.sql.Date.valueOf(localDate)`, and `Timestamp.valueOf(localDateTime)`.
```
