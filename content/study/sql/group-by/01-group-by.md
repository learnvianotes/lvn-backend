---
id: 1ca9a498-62ae-7ac3-abc8-dbb610b68818
key: topic:sql/group-by
subject: sql
topic: group-by
title: GROUP BY
slug: group-by
order: 1
---

`GROUP BY` splits rows into groups that share the same values, then aggregates each group into a single output row.

# One row per group

```sql filename:SQL
SELECT dept_id,
       COUNT(*)            AS headcount,
       SUM(salary)         AS payroll,
       ROUND(AVG(salary))  AS avg_salary,
       MAX(salary)         AS top_salary
FROM employees
GROUP BY dept_id
ORDER BY dept_id;
```

```text filename:Output
dept_id | headcount | payroll | avg_salary | top_salary
--------+-----------+---------+------------+-----------
NULL    | 1         | 60000   | 60000.0    | 60000
1       | 4         | 460000  | 115000.0   | 150000
2       | 3         | 252000  | 84000.0    | 110000
3       | 2         | 165000  | 82500.0    | 85000
```

Dev, with no department, forms his own `NULL` group — all `NULL`s are grouped together.

# The golden rule

Every column in `SELECT` must either be in `GROUP BY` or be inside an aggregate. Otherwise the query asks for “the name” of a group that contains four names.

```sql filename:SQLite%20%E2%80%94%20allowed%2C%20but%20not%20portable
SELECT dept_id, name, MAX(salary) AS top_salary      -- name is not grouped or aggregated
FROM employees
WHERE dept_id IS NOT NULL
GROUP BY dept_id
ORDER BY dept_id;
```

```text filename:Output
dept_id | name  | top_salary
--------+-------+-----------
1       | Asha  | 150000
2       | Priya | 110000
3       | Sara  | 85000
```

> [!WARNING] Watch out
>
> PostgreSQL, SQL Server and Oracle reject that query (<em>column must appear in the GROUP BY clause or be used in an aggregate function</em>); MySQL rejects it under the default `ONLY_FULL_GROUP_BY`. SQLite accepts it and, as a special case with a single `MAX`/`MIN`, returns the name from the max row. Don't rely on it — use a window function or a join (see <em>Top-N per group</em>).

# Grouping by several columns or expressions

```sql filename:SQL
SELECT p.category,
       o.status,
       SUM(oi.quantity) AS units
FROM order_items oi
JOIN orders o   ON o.order_id = oi.order_id
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category, o.status
ORDER BY p.category, o.status;
```

```text filename:Output
category    | status    | units
------------+-----------+------
Electronics | cancelled | 2
Electronics | delivered | 3
Electronics | shipped   | 1
Furniture   | delivered | 2
Furniture   | shipped   | 3
Stationery  | delivered | 20
Stationery  | pending   | 20
```

```sql filename:SQL
SELECT strftime('%Y', hire_date) AS hire_year, COUNT(*) AS hires
FROM employees
WHERE hire_date >= '2020-01-01'
GROUP BY hire_year
ORDER BY hire_year;
```

```text filename:Output
hire_year | hires
----------+------
2020      | 1
2021      | 1
2022      | 1
2023      | 1
2024      | 1
```

# Subtotals: ROLLUP, CUBE, GROUPING SETS

```sql filename:PostgreSQL%20%2F%20SQL%20Server%20%2F%20Oracle%20%2F%20MySQL
SELECT dept_id, EXTRACT(YEAR FROM hire_date) AS yr, SUM(salary)
FROM employees
GROUP BY ROLLUP (dept_id, yr);          -- per (dept, year), per dept, grand total

-- MySQL: GROUP BY dept_id, yr WITH ROLLUP
-- GROUPING SETS ((dept_id), (yr), ())  -- exactly the groupings you list
-- CUBE (dept_id, yr)                   -- every combination
```

SQLite has no `ROLLUP`; the same result is a `UNION ALL` of the groupings:

```sql filename:SQL
SELECT d.name AS department, SUM(e.salary) AS payroll
FROM employees e JOIN departments d ON d.dept_id = e.dept_id
GROUP BY d.name
UNION ALL
SELECT 'ALL DEPARTMENTS', SUM(e.salary)
FROM employees e JOIN departments d ON d.dept_id = e.dept_id
ORDER BY payroll;
```

```text filename:Output
department      | payroll
----------------+--------
HR              | 165000
Sales           | 252000
Engineering     | 460000
ALL DEPARTMENTS | 877000
```

```question
Can you GROUP BY a column that is not in the SELECT list?

---

Yes — `SELECT COUNT(*) FROM employees GROUP BY dept_id` returns one count per department without showing which is which. It is legal, just rarely useful. The reverse (selecting a non-grouped, non-aggregated column) is the error.
```

```question
What does GROUP BY do with NULL values?

---

It treats all `NULL`s in the grouping column as one group (even though `NULL = NULL` is not true). The group shows up with `NULL` as its key.
```
