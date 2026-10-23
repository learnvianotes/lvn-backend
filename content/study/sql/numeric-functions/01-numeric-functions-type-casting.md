---
id: 61931b52-60c5-7c0d-a1c1-8e99759636e8
key: topic:sql/numeric-functions
subject: sql
topic: numeric-functions
title: Numeric Functions & Type Casting
slug: numeric-functions-type-casting
order: 1
---

Rounding, absolute values, modulo and explicit casts — plus the integer-division and rounding rules that trip people up.

| Function | Does | Example → result |
| --- | --- | --- |
| `ROUND(x, d)` | Round to `d` decimals (half away from zero in most engines) | `ROUND(2.567, 1)` → `2.6` |
| `CEIL(x)` / `FLOOR(x)` | Round up / down to an integer | `CEIL(2.1)` → `3` |
| `ABS(x)` | Absolute value | `ABS(-7)` → `7` |
| `x % y` / `MOD(x, y)` | Remainder | `17 % 5` → `2` |
| `POWER(x, y)`, `SQRT(x)` | Powers and roots | `POWER(2, 10)` → `1024` |
| `SIGN(x)` | −1, 0 or 1 | `SIGN(-3)` → `-1` |
| `CAST(x AS type)` | Convert type | `CAST('42' AS INTEGER)` → `42` |

```sql filename:SQL
SELECT ROUND(2.567, 1)  AS r1,
       ROUND(2.5)       AS half_up,
       ROUND(-2.5)      AS half_neg,
       CEIL(2.1)        AS ceil_,
       FLOOR(-2.1)      AS floor_,
       ABS(-7)          AS abs_,
       17 % 5           AS mod_,
       POWER(2, 10)     AS pow_,
       SQRT(144)        AS sqrt_,
       SIGN(-3)         AS sign_;
```

```text filename:Output
r1  | half_up | half_neg | ceil_ | floor_ | abs_ | mod_ | pow_   | sqrt_ | sign_
----+---------+----------+-------+--------+------+------+--------+-------+------
2.6 | 3.0     | -3.0     | 3.0   | -3.0   | 7    | 2    | 1024.0 | 12.0  | -1
```

# Integer division and averages

```sql filename:SQL
SELECT 7 / 2                    AS int_div,
       7 / 2.0                  AS real_div,
       CAST(7 AS REAL) / 2      AS cast_div,
       7 * 1.0 / 2              AS times_one;

-- percentage of employees in Engineering: the classic integer-division bug
SELECT SUM(dept_id = 1) * 100 / COUNT(*)                  AS wrong_looking,
       ROUND(SUM(dept_id = 1) * 100.0 / COUNT(*), 1)      AS pct
FROM employees;
```

```text filename:Output
int_div | real_div | cast_div | times_one
--------+----------+----------+----------
3       | 3.5      | 3.5      | 3.5

wrong_looking | pct
--------------+-----
40            | 40.0
```

Both answers are 40 here only because 4/10 divides evenly; with 4/9 the first would print `44` instead of `44.4`. Multiply by `100.0` (or cast) <strong>before</strong> dividing.

# CAST and conversions

```sql filename:SQL
SELECT CAST('42' AS INTEGER) + 1     AS to_int,
       CAST(3.99 AS INTEGER)         AS truncates,
       CAST(150000 AS TEXT) || ' INR' AS to_text,
       CAST('12abc' AS INTEGER)      AS lenient,
       '10' + 5                      AS implicit;
```

```text filename:Output
to_int | truncates | to_text    | lenient | implicit
-------+-----------+------------+---------+---------
43     | 3         | 150000 INR | 12      | 15
```

> [!WARNING] Watch out
>
> SQLite converts leniently (`'12abc'` → `12`). PostgreSQL and SQL Server raise an error on a bad cast; use `TRY_CAST` (SQL Server), `SAFE_CAST` (BigQuery) or validate first. Relying on implicit conversion (`'10' + 5`) also hides bugs and can disable index use.

```sql filename:Standard%20%2F%20PostgreSQL%20%2F%20SQL%20Server
SELECT CAST(salary AS DECIMAL(10, 2)) FROM employees;     -- standard
SELECT salary::numeric(10, 2) FROM employees;              -- PostgreSQL shorthand
SELECT CONVERT(VARCHAR(20), salary) FROM employees;        -- SQL Server
SELECT TRY_CAST('12abc' AS INT);                           -- SQL Server → NULL instead of error
```

# Bucketing numbers

```sql filename:SQL
SELECT (salary / 25000) * 25000       AS bucket_from,
       COUNT(*)                        AS employees
FROM employees
GROUP BY bucket_from
ORDER BY bucket_from;
```

```text filename:Output
bucket_from | employees
------------+----------
50000       | 3
75000       | 4
100000      | 2
150000      | 1
```

```question
What does ROUND(2.5) return?

---

`3` in SQLite, MySQL, PostgreSQL (numeric), SQL Server and Oracle — they round half <em>away from zero</em>. But PostgreSQL's `round()` on `double precision` and many programming languages use banker's rounding (half to even, `2`). Know your types when cents matter.
```
