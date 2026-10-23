---
id: 8df92f7d-499d-777d-98c7-d7222128429c
key: topic:sql/median-running-difference
subject: sql
topic: median-running-difference
title: Median, Percentiles & Running Differences
slug: median-percentiles-running-differences
order: 1
---

There is no universal `MEDIAN()` in SQL. Interviewers ask you to build it from window functions — and to compute running totals and row-to-row differences.

# Median with ROW\_NUMBER and COUNT

```sql filename:SQL
-- works for odd and even counts: average the middle one or two rows
WITH ordered AS (
    SELECT salary,
           ROW_NUMBER() OVER (ORDER BY salary) AS rn,
           COUNT(*)     OVER ()                AS n
    FROM employees
)
SELECT AVG(salary) AS median_salary
FROM ordered
WHERE rn IN ((n + 1) / 2, (n + 2) / 2);
```

```text filename:Output
median_salary
-------------
90000.0
```

With 10 salaries, integer division gives rows 5 and 6 (85000 and 95000) → 90000. With 9 rows both expressions give 5, the single middle row.

```sql filename:SQL
-- median per department
WITH ordered AS (
    SELECT dept_id, salary,
           ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary) AS rn,
           COUNT(*)     OVER (PARTITION BY dept_id)                AS n
    FROM employees
    WHERE dept_id IS NOT NULL
)
SELECT dept_id, AVG(salary) AS median_salary
FROM ordered
WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
GROUP BY dept_id
ORDER BY dept_id;
```

```text filename:Output
dept_id | median_salary
--------+--------------
1       | 107500.0
2       | 72000.0
3       | 82500.0
```

```sql filename:SQLite%20(recent)
-- recent SQLite builds (3.53 here) include median() and percentile()
SELECT median(salary) AS median, ROUND(percentile(salary, 90)) AS p90 FROM employees;
```

```text filename:Output
median  | p90
--------+---------
90000.0 | 123000.0
```

```sql filename:PostgreSQL%20%2F%20Oracle%20%2F%20SQL%20Server%20%2F%20Snowflake
SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median,     -- interpolated
       PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY salary) AS median_disc -- an actual value
FROM employees;                                         -- PostgreSQL / Oracle (SQL Server: OVER ())
SELECT MEDIAN(salary) FROM employees;                   -- Oracle, Snowflake
```

# Running total and running difference

```sql filename:SQL
WITH monthly AS (
    SELECT strftime('%Y-%m', o.order_date) AS month, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY month
)
SELECT month, revenue,
       SUM(revenue) OVER (ORDER BY month ROWS UNBOUNDED PRECEDING) AS running_total,
       revenue - LAG(revenue, 1, 0) OVER (ORDER BY month)            AS diff_from_prev
FROM monthly
ORDER BY month;
```

```text filename:Output
month   | revenue | running_total | diff_from_prev
--------+---------+---------------+---------------
2024-01 | 66700   | 66700         | 66700
2024-02 | 12900   | 79600         | -53800
2024-03 | 63700   | 143300        | 50800
```

# Difference from the group's first / previous value

```sql filename:SQL
SELECT name, hire_date, salary,
       salary - FIRST_VALUE(salary) OVER (ORDER BY hire_date) AS vs_first_hire,
       julianday(hire_date) - julianday(LAG(hire_date) OVER (ORDER BY hire_date)) AS days_since_prev_hire
FROM employees
WHERE dept_id = 1
ORDER BY hire_date;
```

```text filename:Output
name  | hire_date  | salary | vs_first_hire | days_since_prev_hire
------+------------+--------+---------------+---------------------
Asha  | 2015-03-01 | 150000 | 0             | NULL
Ravi  | 2017-06-15 | 120000 | -30000        | 837.0
Meera | 2019-01-10 | 95000  | -55000        | 574.0
Karan | 2020-08-01 | 95000  | -55000        | 569.0
```

```question
How do you calculate a median in SQL?

---

Portable: number rows with `ROW_NUMBER() OVER (ORDER BY x)` and count them with `COUNT(*) OVER ()`, then average the rows at positions `(n+1)/2` and `(n+2)/2` (integer division). Engine functions: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY x)` (PostgreSQL, Oracle, SQL Server), `MEDIAN(x)` (Oracle, Snowflake, recent SQLite builds).
```
