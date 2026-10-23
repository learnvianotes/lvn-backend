---
id: 61f3e477-ccac-750c-8001-7caf0f5dd94b
key: topic:sql/null-handling
subject: sql
topic: null-handling
title: NULL & Three-Valued Logic
slug: null-three-valued-logic
order: 1
---

`NULL` means <em>unknown / missing</em>. It is not zero, not an empty string, and not equal to anything — not even another `NULL`.

> [!INFO]
>
> <strong>Three-valued logic</strong> — SQL conditions evaluate to `TRUE`, `FALSE` or `UNKNOWN`. Any comparison with `NULL` (`=`, `<>`, `<`…) is `UNKNOWN`, and `WHERE` keeps only `TRUE` rows.

# Comparisons with NULL

```sql filename:SQL
SELECT NULL = NULL      AS eq,
       NULL <> 1        AS ne,
       NULL IS NULL     AS is_null,
       1 IS NOT NULL    AS is_not_null,
       NULL + 5         AS arithmetic,
       'a' || NULL      AS concat;
```

```text filename:Output
eq   | ne   | is_null | is_not_null | arithmetic | concat
-----+------+---------+-------------+------------+-------
NULL | NULL | 1       | 1           | NULL       | NULL
```

(SQLite shows `TRUE`/`FALSE` as `1`/`0` and `UNKNOWN` as `NULL`.) `NULL` propagates through arithmetic and concatenation — one missing value makes the whole expression `NULL`.

```sql filename:SQL
SELECT name FROM employees WHERE email = NULL;        -- always empty!
SELECT name FROM employees WHERE email IS NULL ORDER BY name;
```

```text filename:Output
name
----

name
----
Dev
Neha
```

# Truth tables

| `AND` | TRUE | FALSE | UNKNOWN |
| --- | --- | --- | --- |
| <strong>TRUE</strong> | TRUE | FALSE | UNKNOWN |
| <strong>FALSE</strong> | FALSE | FALSE | FALSE |
| <strong>UNKNOWN</strong> | UNKNOWN | FALSE | UNKNOWN |

| `OR` | TRUE | FALSE | UNKNOWN |
| --- | --- | --- | --- |
| <strong>TRUE</strong> | TRUE | TRUE | TRUE |
| <strong>FALSE</strong> | TRUE | FALSE | UNKNOWN |
| <strong>UNKNOWN</strong> | TRUE | UNKNOWN | UNKNOWN |

`NOT UNKNOWN` is still `UNKNOWN`. So a row with a `NULL` column fails <em>both</em> `x = 5` and `NOT (x = 5)`:

```sql filename:SQL
SELECT COUNT(*) AS total,
       SUM(dept_id = 1)                   AS in_eng,
       SUM(NOT (dept_id = 1))             AS not_in_eng,
       SUM(dept_id IS NULL)               AS no_dept
FROM employees;
```

```text filename:Output
total | in_eng | not_in_eng | no_dept
------+--------+------------+--------
10    | 4      | 5          | 1
```

# The NOT IN trap

```sql filename:SQL
-- customers outside Mumbai and Delhi (Kavya's city is NULL)
SELECT name FROM customers WHERE city NOT IN ('Mumbai', 'Delhi') ORDER BY name;
SELECT 'x' AS found WHERE 3 NOT IN (1, 2, NULL);
```

```text filename:Output
name
-----
Sneha

found
-----
```

> [!WARNING] Watch out
>
> `x NOT IN (1, 2, NULL)` is never true: it means `x <> 1 AND x <> 2 AND x <> NULL`, and the last part is unknown. If a `NOT IN (subquery)` can return a `NULL`, the whole query returns nothing. Use `NOT EXISTS` instead (see Semi &amp; Anti Joins). Also note Kavya (city `NULL`) is missing from the first result.

# NULL-handling functions

| Function | Returns | Portability |
| --- | --- | --- |
| `COALESCE(a, b, c…)` | First non-`NULL` argument | Standard — everywhere |
| `NULLIF(a, b)` | `NULL` if `a = b`, else `a` | Standard — everywhere |
| `IFNULL(a, b)` | `b` if `a` is `NULL` | MySQL, SQLite |
| `ISNULL(a, b)` / `NVL(a, b)` | Same idea | SQL Server / Oracle |
| `a IS DISTINCT FROM b` | Null-safe `<>` (`NULL` vs `NULL` → false) | Standard; PostgreSQL, SQL Server 2022, SQLite (`IS NOT`) |

```sql filename:SQL
SELECT name,
       COALESCE(email, 'no email')          AS contact,
       COALESCE(dept_id, 0)                 AS dept
FROM employees
WHERE emp_id IN (6, 7, 10)
ORDER BY emp_id;

-- NULLIF avoids division by zero: x / 0 → x / NULL → NULL
SELECT 100 / NULLIF(0, 0) AS safe_div;

-- null-safe equality (SQLite: IS / IS NOT; standard: IS [NOT] DISTINCT FROM)
SELECT NULL IS NULL AS both_null, 1 IS NOT NULL AS differ, NULL IS 1 AS null_vs_1;
```

```text filename:Output
name  | contact       | dept
------+---------------+-----
Arjun | arjun@corp.in | 2
Neha  | no email      | 2
Dev   | no email      | 0

safe_div
--------
NULL

both_null | differ | null_vs_1
----------+--------+----------
1         | 1      | 0
```

# NULL in aggregates, sorting and grouping

- Aggregates <strong>ignore</strong> `NULL`s: `COUNT(email)` counts non-null emails; `AVG` divides by the non-null count.
- `COUNT(*)` counts rows, whatever they contain.
- `GROUP BY` and `DISTINCT` put all `NULL`s into <strong>one</strong> group.
- `ORDER BY` puts `NULL`s first or last depending on the engine.
- `UNIQUE` allows multiple `NULL`s (except SQL Server).

```sql filename:SQL
SELECT COUNT(*) AS all_rows, COUNT(email) AS with_email, COUNT(dept_id) AS with_dept
FROM employees;
```

```text filename:Output
all_rows | with_email | with_dept
---------+------------+----------
10       | 8          | 9
```

```question
What is the difference between NULL, 0 and an empty string?

---

`0` and `''` are known values that compare and sort normally. `NULL` is the absence of a value: comparisons with it yield `UNKNOWN`, it is skipped by aggregates and needs `IS NULL`. (Oracle is odd: it treats `''` as `NULL`.)
```

```question
Why does WHERE col &lt;&gt; 'x' not return rows where col is NULL?

---

`NULL <> 'x'` is `UNKNOWN`, and `WHERE` keeps only `TRUE`. Write `WHERE col <> 'x' OR col IS NULL`, or `WHERE col IS DISTINCT FROM 'x'`.
```
