---
id: ceebcbd9-225d-78bb-8984-caecee8a62cd
key: topic:sql/window-functions
subject: sql
topic: window-functions
title: "Window Functions: The Basics"
slug: window-functions-the-basics
order: 1
---

A window function computes a value <strong>across a set of related rows</strong> — without collapsing them like `GROUP BY` does. Each row keeps its identity and gains an aggregate, a rank or a neighbour's value.

> [!INFO]
>
> <strong>OVER clause</strong> — `f(…) OVER (PARTITION BY … ORDER BY … frame)` — `PARTITION BY` splits rows into independent groups, `ORDER BY` orders rows inside each partition, the frame picks which rows around the current one are included.

# GROUP BY vs window

```sql filename:SQL
-- GROUP BY: one row per department
SELECT dept_id, AVG(salary) AS dept_avg
FROM employees WHERE dept_id IN (2, 3)
GROUP BY dept_id
ORDER BY dept_id;

-- window: every employee kept, department average attached
SELECT name, dept_id, salary,
       AVG(salary) OVER (PARTITION BY dept_id) AS dept_avg,
       salary - AVG(salary) OVER (PARTITION BY dept_id) AS diff
FROM employees WHERE dept_id IN (2, 3)
ORDER BY dept_id, emp_id;
```

```text filename:Output
dept_id | dept_avg
--------+---------
2       | 84000.0
3       | 82500.0

name   | dept_id | salary | dept_avg | diff
-------+---------+--------+----------+---------
Priya  | 2       | 110000 | 84000.0  | 26000.0
Arjun  | 2       | 70000  | 84000.0  | -14000.0
Neha   | 2       | 72000  | 84000.0  | -12000.0
Vikram | 3       | 80000  | 82500.0  | -2500.0
Sara   | 3       | 85000  | 82500.0  | 2500.0
```

# Aggregates as window functions

```sql filename:SQL
SELECT name, dept_id, salary,
       SUM(salary)   OVER ()                     AS company_payroll,
       ROUND(100.0 * salary / SUM(salary) OVER (), 1) AS pct_of_company,
       COUNT(*)      OVER (PARTITION BY dept_id) AS dept_size,
       MAX(salary)   OVER (PARTITION BY dept_id) AS dept_max
FROM employees
WHERE dept_id IS NOT NULL
ORDER BY dept_id, salary DESC, emp_id;
```

```text filename:Output
name   | dept_id | salary | company_payroll | pct_of_company | dept_size | dept_max
-------+---------+--------+-----------------+----------------+-----------+---------
Asha   | 1       | 150000 | 877000          | 17.1           | 4         | 150000
Ravi   | 1       | 120000 | 877000          | 13.7           | 4         | 150000
Meera  | 1       | 95000  | 877000          | 10.8           | 4         | 150000
Karan  | 1       | 95000  | 877000          | 10.8           | 4         | 150000
Priya  | 2       | 110000 | 877000          | 12.5           | 3         | 110000
Neha   | 2       | 72000  | 877000          | 8.2            | 3         | 110000
Arjun  | 2       | 70000  | 877000          | 8.0            | 3         | 110000
Sara   | 3       | 85000  | 877000          | 9.7            | 2         | 85000
Vikram | 3       | 80000  | 877000          | 9.1            | 2         | 85000
```

`OVER ()` with nothing inside = one window containing all rows (of the result after `WHERE`).

# Adding ORDER BY makes it cumulative

```sql filename:SQL
SELECT day, amount,
       SUM(amount) OVER (ORDER BY day)  AS running_total,
       COUNT(*)    OVER (ORDER BY day)  AS days_so_far
FROM daily_sales
ORDER BY day;
```

```text filename:Output
day        | amount | running_total | days_so_far
-----------+--------+---------------+------------
2024-03-01 | 120    | 120           | 1
2024-03-02 | 80     | 200           | 2
2024-03-03 | 150    | 350           | 3
2024-03-04 | 90     | 440           | 4
2024-03-05 | 200    | 640           | 5
2024-03-06 | 60     | 700           | 6
```

> [!NOTE] Key point
>
> With `ORDER BY` inside `OVER`, the default frame becomes “from the start of the partition up to the current row”, so `SUM` turns into a running total. Details in <em>Running Totals &amp; Window Frames</em>.

# The family

| Kind | Functions |
| --- | --- |
| Aggregate | `SUM`, `AVG`, `COUNT`, `MIN`, `MAX` + `OVER (…)` |
| Ranking | `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `PERCENT_RANK`, `CUME_DIST` |
| Offset / value | `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, `NTH_VALUE` |

# Where you can use them

Window functions are evaluated in the `SELECT` step, so they are allowed only in `SELECT` and `ORDER BY`. To filter on one, compute it in a CTE/subquery first:

```sql filename:SQL
SELECT name FROM employees
WHERE salary > AVG(salary) OVER ();
```

```text filename:Error
misuse of window function AVG()
```

```sql filename:SQL
WITH x AS (
    SELECT name, salary, AVG(salary) OVER () AS avg_all FROM employees
)
SELECT name, salary FROM x WHERE salary > avg_all ORDER BY salary DESC, name;
```

```text filename:Output
name  | salary
------+-------
Asha  | 150000
Ravi  | 120000
Priya | 110000
Karan | 95000
Meera | 95000
```

```sql filename:Snowflake%20%2F%20BigQuery%20%2F%20DuckDB%20(QUALIFY)
-- Snowflake / BigQuery / DuckDB / Databricks: filter on a window directly
SELECT name, dept_id, salary
FROM employees
QUALIFY ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC) = 1;
```

```question
What is the difference between GROUP BY and a window function?

---

`GROUP BY` collapses each group into one output row, so you lose row detail. A window function computes over a group (the partition) but returns a value on <strong>every</strong> row — so you can show each employee next to their department average, rank or running total.
```

```question
What is PARTITION BY?

---

The window equivalent of `GROUP BY`: it splits rows into independent partitions, and the window function restarts for each one. Without it, the whole result set is a single partition.
```
