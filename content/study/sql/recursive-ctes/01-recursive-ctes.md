---
id: 776af9e6-6243-7b95-bc18-ea4c2246086f
key: topic:sql/recursive-ctes
subject: sql
topic: recursive-ctes
title: Recursive CTEs
slug: recursive-ctes
order: 1
---

`WITH RECURSIVE` lets a CTE refer to itself — the tool for hierarchies (org charts, categories, bills of materials), graphs and generated series.

# How it works

1. <strong>Anchor member</strong>

   A normal `SELECT` that produces the starting rows.

2. <strong>`UNION ALL`</strong>

   Separates the anchor from the recursive part.

3. <strong>Recursive member</strong>

   A `SELECT` that joins the CTE's <strong>previous</strong> rows to produce the next rows.

4. <strong>Stop</strong>

   Recursion ends when the recursive member returns no new rows.

# Generating a series

```sql filename:SQL
WITH RECURSIVE n(x) AS (
    SELECT 1                    -- anchor
    UNION ALL
    SELECT x + 1 FROM n         -- recursive step
    WHERE x < 5                 -- termination
)
SELECT x, x * x AS square FROM n;
```

```text filename:Output
x | square
--+-------
1 | 1
2 | 4
3 | 9
4 | 16
5 | 25
```

```sql filename:SQL
-- a month calendar Jan–Apr 2024, then orders per month including empty months
WITH RECURSIVE months(m) AS (
    SELECT '2024-01-01'
    UNION ALL
    SELECT date(m, '+1 month') FROM months WHERE m < '2024-04-01'
)
SELECT strftime('%Y-%m', m) AS month, COUNT(o.order_id) AS orders
FROM months
LEFT JOIN orders o ON strftime('%Y-%m', o.order_date) = strftime('%Y-%m', m)
GROUP BY m
ORDER BY m;
```

```text filename:Output
month   | orders
--------+-------
2024-01 | 2
2024-02 | 3
2024-03 | 3
2024-04 | 0
```

# Walking a hierarchy: the org chart

```sql filename:SQL
WITH RECURSIVE org(emp_id, name, manager_id, level, path) AS (
    SELECT emp_id, name, manager_id, 0, name
    FROM employees
    WHERE manager_id IS NULL                            -- start at the top (Asha)
    UNION ALL
    SELECT e.emp_id, e.name, e.manager_id, org.level + 1, org.path || ' > ' || e.name
    FROM employees e
    JOIN org ON e.manager_id = org.emp_id               -- children of the previous level
)
SELECT substr('            ', 1, level * 2) || name AS org_chart, level, path
FROM org
ORDER BY path;
```

```text filename:Output
org_chart | level | path
----------+-------+---------------------
Asha      | 0     | Asha
  Dev     | 1     | Asha > Dev
  Priya   | 1     | Asha > Priya
    Arjun | 2     | Asha > Priya > Arjun
    Neha  | 2     | Asha > Priya > Neha
  Ravi    | 1     | Asha > Ravi
    Karan | 2     | Asha > Ravi > Karan
    Meera | 2     | Asha > Ravi > Meera
  Vikram  | 1     | Asha > Vikram
    Sara  | 2     | Asha > Vikram > Sara
```

# Walking up: all managers of one employee

```sql filename:SQL
WITH RECURSIVE chain(emp_id, name, manager_id, hops) AS (
    SELECT emp_id, name, manager_id, 0 FROM employees WHERE name = 'Meera'
    UNION ALL
    SELECT m.emp_id, m.name, m.manager_id, c.hops + 1
    FROM employees m
    JOIN chain c ON m.emp_id = c.manager_id
)
SELECT hops, name FROM chain ORDER BY hops;
```

```text filename:Output
hops | name
-----+------
0    | Meera
1    | Ravi
2    | Asha
```

```sql filename:SQL
-- total salary cost under each manager (all levels), a "subtree sum"
WITH RECURSIVE reports(boss_id, emp_id) AS (
    SELECT manager_id, emp_id FROM employees WHERE manager_id IS NOT NULL
    UNION ALL
    SELECT r.boss_id, e.emp_id
    FROM reports r JOIN employees e ON e.manager_id = r.emp_id
)
SELECT b.name AS manager, COUNT(*) AS total_reports, SUM(e.salary) AS team_cost
FROM reports r
JOIN employees b ON b.emp_id = r.boss_id
JOIN employees e ON e.emp_id = r.emp_id
GROUP BY b.emp_id, b.name
ORDER BY total_reports DESC, b.emp_id;
```

```text filename:Output
manager | total_reports | team_cost
--------+---------------+----------
Asha    | 9             | 787000
Ravi    | 2             | 190000
Priya   | 2             | 142000
Vikram  | 1             | 85000
```

> [!WARNING] Watch out
>
> A cycle in the data (A manages B, B manages A) makes the recursion infinite. Guard with a depth limit (`WHERE level < 20`), track visited ids in a path string, or use `UNION` instead of `UNION ALL` (stops when no <em>new</em> rows appear). PostgreSQL 14+ has a `CYCLE` clause; SQL Server stops at `MAXRECURSION` (default 100).

> [!NOTE] Key point
>
> Keyword differences: PostgreSQL, MySQL 8 and SQLite require `WITH RECURSIVE`; SQL Server and Oracle use plain `WITH` (Oracle also has the older `CONNECT BY PRIOR`).

```question
How do you query hierarchical data in SQL?

---

Store a parent pointer (`manager_id`) and use a recursive CTE: the anchor selects the root(s), the recursive member joins the table to the CTE on `child.parent_id = cte.id`, carrying a `level` and `path`. Alternatives for read-heavy trees: materialised path, nested sets, closure tables, or PostgreSQL's `ltree`.
```
