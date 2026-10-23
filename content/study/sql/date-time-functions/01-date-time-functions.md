---
id: 1d72c3b8-b5fc-74df-91ec-484377b22420
key: topic:sql/date-time-functions
subject: sql
topic: date-time-functions
title: Date & Time Functions
slug: date-time-functions
order: 1
---

Dates are the least portable part of SQL. The concepts — extract a part, add an interval, difference two dates, truncate to a period — exist everywhere under different names.

# Dialect map

| Task | SQLite | PostgreSQL | MySQL | SQL Server |
| --- | --- | --- | --- | --- |
| Now | `datetime('now')` | `now()` | `NOW()` | `GETDATE()` / `SYSDATETIME()` |
| Today | `date('now')` | `CURRENT_DATE` | `CURDATE()` | `CAST(GETDATE() AS date)` |
| Year of d | `strftime('%Y', d)` | `EXTRACT(YEAR FROM d)` | `YEAR(d)` | `YEAR(d)` / `DATEPART(year, d)` |
| Add 1 month | `date(d, '+1 month')` | `d + INTERVAL '1 month'` | `DATE_ADD(d, INTERVAL 1 MONTH)` | `DATEADD(month, 1, d)` |
| Days between | `julianday(b) - julianday(a)` | `b - a` (dates) | `DATEDIFF(b, a)` | `DATEDIFF(day, a, b)` |
| Start of month | `date(d, 'start of month')` | `date_trunc('month', d)` | `DATE_FORMAT(d, '%Y-%m-01')` | `DATETRUNC(month, d)` (2022) |
| Format | `strftime('%d/%m/%Y', d)` | `to_char(d, 'DD/MM/YYYY')` | `DATE_FORMAT(d, '%d/%m/%Y')` | `FORMAT(d, 'dd/MM/yyyy')` |

> [!NOTE] SQLite
>
> SQLite stores dates as ISO-8601 text (`'2024-03-15'`, `'2024-03-15 09:30:00'`), which sorts and compares correctly as strings. Its date functions take such a string plus <em>modifiers</em>.

# Extracting parts

```sql filename:SQL
SELECT hire_date,
       strftime('%Y', hire_date)           AS year,
       CAST(strftime('%m', hire_date) AS INTEGER) AS month,
       strftime('%w', hire_date)           AS weekday_0_sun,
       strftime('%d/%m/%Y', hire_date)     AS indian_format
FROM employees
WHERE emp_id IN (1, 2, 3)
ORDER BY emp_id;
```

```text filename:Output
hire_date  | year | month | weekday_0_sun | indian_format
-----------+------+-------+---------------+--------------
2015-03-01 | 2015 | 3     | 0             | 01/03/2015
2017-06-15 | 2017 | 6     | 4             | 15/06/2017
2019-01-10 | 2019 | 1     | 4             | 10/01/2019
```

# Date arithmetic

```sql filename:SQL
SELECT date('2024-01-31', '+1 month')             AS plus_month,
       date('2024-03-15', '-10 days')             AS minus_days,
       date('2024-03-15', 'start of month')       AS month_start,
       date('2024-03-15', 'start of month', '+1 month', '-1 day') AS month_end,
       julianday('2024-03-01') - julianday('2024-02-01')          AS days_in_feb;
```

```text filename:Output
plus_month | minus_days | month_start | month_end  | days_in_feb
-----------+------------+-------------+------------+------------
2024-03-02 | 2024-03-05 | 2024-03-01  | 2024-03-31 | 29.0
```

> [!WARNING] Watch out
>
> Month arithmetic has edge cases: SQLite turns `2024-01-31 + 1 month` into `2024-03-02` (Feb 31 overflows). PostgreSQL and MySQL clamp to the last day (`2024-02-29`). Test month-end logic explicitly.

# Tenure and age

```sql filename:SQL
-- as of a fixed reporting date, so the output never changes
SELECT name, hire_date,
       CAST((julianday('2024-12-31') - julianday(hire_date)) / 365.25 AS INTEGER) AS years_service
FROM employees
ORDER BY hire_date
LIMIT 4;
```

```text filename:Output
name   | hire_date  | years_service
-------+------------+--------------
Asha   | 2015-03-01 | 9
Priya  | 2016-11-20 | 8
Ravi   | 2017-06-15 | 7
Vikram | 2018-09-05 | 6
```

# Grouping by period

```sql filename:SQL
SELECT strftime('%Y-%m', o.order_date)          AS month,
       COUNT(DISTINCT o.order_id)                AS orders,
       SUM(oi.quantity * oi.unit_price)          AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY month
ORDER BY month;
```

```text filename:Output
month   | orders | revenue
--------+--------+--------
2024-01 | 2      | 66700
2024-02 | 2      | 12900
2024-03 | 3      | 63700
```

> [!TIP] Do
>
> Store timestamps in <strong>UTC</strong> (`TIMESTAMPTZ` in PostgreSQL, `DATETIME2`/`DATETIMEOFFSET` in SQL Server) and convert to local time only for display.

> [!WARNING] Performance
>
> Wrapping an indexed column in a function (`WHERE strftime('%Y', order_date) = '2024'`) usually prevents index use. Rewrite as a range: `WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'`.

```question
How do you find orders placed in the last 30 days?

---

`WHERE order_date >= CURRENT_DATE - INTERVAL '30 days'` (PostgreSQL), `>= DATE_SUB(CURDATE(), INTERVAL 30 DAY)` (MySQL), `>= DATEADD(day, -30, CAST(GETDATE() AS date))` (SQL Server), `>= date('now', '-30 days')` (SQLite). Keep the column bare so an index on it can be used.
```
