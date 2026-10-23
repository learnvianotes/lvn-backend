---
id: abc21206-a7c1-7340-b996-a414b0b2ce1b
key: topic:sql/aggregate-functions
subject: sql
topic: aggregate-functions
title: Aggregate Functions
slug: aggregate-functions
order: 1
---

Aggregate functions collapse many rows into one value: how many, how much, the average, the extremes.

| Function | Returns | NULLs |
| --- | --- | --- |
| `COUNT(*)` | Number of rows | Counted |
| `COUNT(col)` | Number of non-null values | Ignored |
| `COUNT(DISTINCT col)` | Number of different non-null values | Ignored |
| `SUM(col)` | Total | Ignored (all `NULL` → `NULL`) |
| `AVG(col)` | Mean = `SUM / COUNT(col)` | Ignored |
| `MIN(col)` / `MAX(col)` | Smallest / largest (also for text and dates) | Ignored |

```sql filename:SQL
SELECT COUNT(*)                 AS employees,
       COUNT(email)             AS with_email,
       COUNT(DISTINCT dept_id)  AS departments,
       SUM(salary)              AS payroll,
       AVG(salary)              AS avg_salary,
       MIN(hire_date)           AS first_hire,
       MAX(name)                AS last_name_alpha
FROM employees;
```

```text filename:Output
employees | with_email | departments | payroll | avg_salary | first_hire | last_name_alpha
----------+------------+-------------+---------+------------+------------+----------------
10        | 8          | 3           | 937000  | 93700.0    | 2015-03-01 | Vikram
```

# NULLs change averages

```sql filename:SQL
CREATE TABLE ratings (product TEXT, stars INTEGER);
INSERT INTO ratings VALUES ('A', 5), ('A', 3), ('A', NULL), ('B', NULL);

SELECT product,
       COUNT(*)              AS rows_,
       COUNT(stars)          AS rated,
       AVG(stars)            AS avg_ignoring_null,
       AVG(COALESCE(stars, 0)) AS avg_null_as_zero,
       SUM(stars)            AS total
FROM ratings
GROUP BY product
ORDER BY product;
```

```text filename:Output
product | rows_ | rated | avg_ignoring_null | avg_null_as_zero   | total
--------+-------+-------+-------------------+--------------------+------
A       | 3     | 2     | 4.0               | 2.6666666666666665 | 8
B       | 1     | 0     | NULL              | 0.0                | NULL
```

Decide what `NULL` means for your metric. Product B shows the other surprise: `SUM` over only `NULL`s is `NULL`, not `0` — wrap it: `COALESCE(SUM(x), 0)`.

# Aggregates over an empty set

```sql filename:SQL
SELECT COUNT(*) AS n, SUM(salary) AS total, MAX(salary) AS top
FROM employees
WHERE dept_id = 4;             -- Marketing has nobody
```

```text filename:Output
n | total | top
--+-------+-----
0 | NULL  | NULL
```

> [!NOTE] Key point
>
> Without `GROUP BY`, an aggregate query always returns <strong>exactly one row</strong> — even when no rows matched. With `GROUP BY`, no matching rows means no groups and zero result rows.

# Conditional aggregation

```sql filename:SQL
SELECT SUM(CASE WHEN category = 'Electronics' THEN price END) AS electronics_value,
       AVG(CASE WHEN category = 'Furniture'   THEN price END) AS avg_furniture,
       COUNT(CASE WHEN price < 100 THEN 1 END)                 AS cheap_items
FROM products;
```

```text filename:Output
electronics_value | avg_furniture | cheap_items
------------------+---------------+------------
69500             | 6250.0        | 2
```

> [!WARNING] Watch out
>
> You cannot nest aggregates (`MAX(AVG(salary))`) in one level in most engines. Aggregate in a subquery or CTE first, then aggregate the result.

```question
What is the difference between COUNT(\*), COUNT(1) and COUNT(column)?

---

`COUNT(*)` and `COUNT(1)` both count rows and perform the same in modern engines. `COUNT(column)` counts rows where that column is <strong>not</strong> `NULL`. `COUNT(DISTINCT column)` counts distinct non-null values.
```

```question
Does AVG include NULL values?

---

No. `AVG(x)` = `SUM(x) / COUNT(x)` over non-null values only. To treat missing as zero, use `AVG(COALESCE(x, 0))`.
```
