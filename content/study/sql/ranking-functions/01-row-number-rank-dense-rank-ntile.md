---
id: 471e9327-a7c7-7c26-a89d-9e8ddadc920d
key: topic:sql/ranking-functions
subject: sql
topic: ranking-functions
title: ROW_NUMBER, RANK, DENSE_RANK & NTILE
slug: row-number-rank-dense-rank-ntile
order: 1
---

Ranking functions number rows in a defined order. They differ only in how they treat <strong>ties</strong> — the favourite interview detail.

```sql filename:SQL
SELECT name, salary,
       ROW_NUMBER() OVER (ORDER BY salary DESC) AS row_num,
       RANK()       OVER (ORDER BY salary DESC) AS rnk,
       DENSE_RANK() OVER (ORDER BY salary DESC) AS dense_rnk
FROM employees
WHERE dept_id IN (1, 2)
ORDER BY salary DESC, name;
```

```text filename:Output
name  | salary | row_num | rnk | dense_rnk
------+--------+---------+-----+----------
Asha  | 150000 | 1       | 1   | 1
Ravi  | 120000 | 2       | 2   | 2
Priya | 110000 | 3       | 3   | 3
Karan | 95000  | 5       | 4   | 4
Meera | 95000  | 4       | 4   | 4
Neha  | 72000  | 6       | 6   | 5
Arjun | 70000  | 7       | 7   | 6
```

| Function | Ties | Sequence for 150, 120, 110, 95, 95, 72 |
| --- | --- | --- |
| `ROW_NUMBER()` | Arbitrary but unique numbers | 1, 2, 3, 4, 5, 6 |
| `RANK()` | Same rank, then a <strong>gap</strong> | 1, 2, 3, 4, 4, 6 |
| `DENSE_RANK()` | Same rank, <strong>no gap</strong> | 1, 2, 3, 4, 4, 5 |

> [!WARNING] Watch out
>
> `ROW_NUMBER` among ties is non-deterministic — Meera and Karan could swap between runs. Add a tie-breaker: `ORDER BY salary DESC, emp_id`.

# Ranking within groups

```sql filename:SQL
SELECT dept_id, name, salary,
       DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rank_in_dept
FROM employees
WHERE dept_id IS NOT NULL
ORDER BY dept_id, rank_in_dept, name;
```

```text filename:Output
dept_id | name   | salary | rank_in_dept
--------+--------+--------+-------------
1       | Asha   | 150000 | 1
1       | Ravi   | 120000 | 2
1       | Karan  | 95000  | 3
1       | Meera  | 95000  | 3
2       | Priya  | 110000 | 1
2       | Neha   | 72000  | 2
2       | Arjun  | 70000  | 3
3       | Sara   | 85000  | 1
3       | Vikram | 80000  | 2
```

# Top-N per group

```sql filename:SQL
-- the 2 best-paid employees of each department
WITH ranked AS (
    SELECT dept_id, name, salary,
           ROW_NUMBER() OVER (PARTITION BY dept_id ORDER BY salary DESC, emp_id) AS rn
    FROM employees
    WHERE dept_id IS NOT NULL
)
SELECT dept_id, name, salary
FROM ranked
WHERE rn <= 2
ORDER BY dept_id, rn;
```

```text filename:Output
dept_id | name   | salary
--------+--------+-------
1       | Asha   | 150000
1       | Ravi   | 120000
2       | Priya  | 110000
2       | Neha   | 72000
3       | Sara   | 85000
3       | Vikram | 80000
```

Choose the function by the business rule: `ROW_NUMBER` for <em>exactly N rows</em>, `DENSE_RANK` for <em>the top N salary levels, including ties</em>.

# NTILE, PERCENT\_RANK, CUME\_DIST

```sql filename:SQL
SELECT name, salary,
       NTILE(4)       OVER (ORDER BY salary DESC)          AS quartile,
       ROUND(PERCENT_RANK() OVER (ORDER BY salary), 2)     AS pct_rank,
       ROUND(CUME_DIST()    OVER (ORDER BY salary), 2)     AS cume_dist
FROM employees
ORDER BY salary DESC, emp_id;
```

```text filename:Output
name   | salary | quartile | pct_rank | cume_dist
-------+--------+----------+----------+----------
Asha   | 150000 | 1        | 1.0      | 1.0
Ravi   | 120000 | 1        | 0.89     | 0.9
Priya  | 110000 | 1        | 0.78     | 0.8
Meera  | 95000  | 2        | 0.56     | 0.7
Karan  | 95000  | 2        | 0.56     | 0.7
Sara   | 85000  | 2        | 0.44     | 0.5
Vikram | 80000  | 3        | 0.33     | 0.4
Neha   | 72000  | 3        | 0.22     | 0.3
Arjun  | 70000  | 4        | 0.11     | 0.2
Dev    | 60000  | 4        | 0.0      | 0.1
```

- `NTILE(n)` splits the ordered rows into `n` buckets as evenly as possible (earlier buckets get the extra rows: 10 rows → 3, 3, 2, 2).
- `PERCENT_RANK()` = `(rank − 1) / (rows − 1)` — 0 for the lowest, 1 for the highest.
- `CUME_DIST()` = fraction of rows with a value ≤ the current one.

# Deduplicating with ROW\_NUMBER

```sql filename:SQL
-- each customer's most recent order
SELECT customer_id, order_id, order_date
FROM (
    SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders o
)
WHERE rn = 1
ORDER BY customer_id;
```

```text filename:Output
customer_id | order_id | order_date
------------+----------+-----------
1           | 108      | 2024-03-15
2           | 106      | 2024-03-01
3           | 107      | 2024-03-08
4           | 105      | 2024-02-20
```

```question
RANK vs DENSE\_RANK vs ROW\_NUMBER?

---

All number rows in window order. `ROW_NUMBER` always gives unique consecutive numbers (ties broken arbitrarily). `RANK` gives ties the same number and then skips (1, 2, 2, 4). `DENSE_RANK` gives ties the same number without skipping (1, 2, 2, 3). For “Nth highest salary” use `DENSE_RANK`.
```
