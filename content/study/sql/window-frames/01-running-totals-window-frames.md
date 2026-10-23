---
id: e5c94587-2688-76ce-9e63-3b109980458b
key: topic:sql/window-frames
subject: sql
topic: window-frames
title: Running Totals & Window Frames
slug: running-totals-window-frames
order: 1
---

The <strong>frame</strong> decides which rows around the current row a window aggregate sees: everything so far (running total), the last 3 rows (moving average), or the whole partition.

# Frame syntax

```sql filename:SQL
{ROWS | RANGE | GROUPS} BETWEEN <start> AND <end>

-- <start>/<end>:  UNBOUNDED PRECEDING | n PRECEDING | CURRENT ROW | n FOLLOWING | UNBOUNDED FOLLOWING
```

| `OVER (…)` | Default frame |
| --- | --- |
| No `ORDER BY` | The whole partition |
| With `ORDER BY` | `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — start to current row <em>including peers (ties)</em> |

# Running total, moving average, centered window

```sql filename:SQL
SELECT day, amount,
       SUM(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
       ROUND(AVG(amount) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS moving_avg_3,
       MAX(amount) OVER (ORDER BY day ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS max_neighbourhood
FROM daily_sales
ORDER BY day;
```

```text filename:Output
day        | amount | running_total | moving_avg_3 | max_neighbourhood
-----------+--------+---------------+--------------+------------------
2024-03-01 | 120    | 120           | 120.0        | 120
2024-03-02 | 80     | 200           | 100.0        | 150
2024-03-03 | 150    | 350           | 116.7        | 150
2024-03-04 | 90     | 440           | 106.7        | 200
2024-03-05 | 200    | 640           | 146.7        | 200
2024-03-06 | 60     | 700           | 116.7        | 200
```

The first two moving averages use fewer than 3 rows (there is nothing before day 1). Filter them out or show them as incomplete if that matters.

# ROWS vs RANGE: the ties trap

```sql filename:SQL
SELECT name, salary,
       SUM(salary) OVER (ORDER BY salary)                                         AS range_default,
       SUM(salary) OVER (ORDER BY salary ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_frame
FROM employees
WHERE dept_id = 1
ORDER BY salary, emp_id;
```

```text filename:Output
name  | salary | range_default | rows_frame
------+--------+---------------+-----------
Meera | 95000  | 190000        | 95000
Karan | 95000  | 190000        | 190000
Ravi  | 120000 | 310000        | 310000
Asha  | 150000 | 460000        | 460000
```

> [!WARNING] Watch out
>
> Meera and Karan both earn 95000, so with the default `RANGE` frame they are <em>peers</em> and both see 190000. `ROWS` counts physical rows: 95000 then 190000. For running totals, specify `ROWS` (and a unique tie-breaker in `ORDER BY`).

# Running total per group, and a reset

```sql filename:SQL
SELECT customer_id, order_id, order_date,
       COUNT(*) OVER (PARTITION BY customer_id ORDER BY order_date
                      ROWS UNBOUNDED PRECEDING) AS nth_order_of_customer
FROM orders
ORDER BY customer_id, order_date;
```

```text filename:Output
customer_id | order_id | order_date | nth_order_of_customer
------------+----------+------------+----------------------
1           | 101      | 2024-01-05 | 1
1           | 103      | 2024-02-03 | 2
1           | 108      | 2024-03-15 | 3
2           | 102      | 2024-01-12 | 1
2           | 106      | 2024-03-01 | 2
3           | 104      | 2024-02-14 | 1
3           | 107      | 2024-03-08 | 2
4           | 105      | 2024-02-20 | 1
```

# Cumulative share (Pareto)

```sql filename:SQL
WITH product_rev AS (
    SELECT p.name, SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi JOIN products p ON p.product_id = oi.product_id
    GROUP BY p.product_id, p.name
)
SELECT name, revenue,
       ROUND(100.0 * SUM(revenue) OVER (ORDER BY revenue DESC ROWS UNBOUNDED PRECEDING)
             / SUM(revenue) OVER (), 1) AS cumulative_pct
FROM product_rev
ORDER BY revenue DESC;
```

```text filename:Output
name       | revenue | cumulative_pct
-----------+---------+---------------
Laptop     | 107000  | 72.2
Desk       | 16000   | 82.9
Chair      | 13500   | 92.0
Headphones | 10000   | 98.8
Notebook   | 1500    | 99.8
Pen        | 300     | 100.0
```

```question
How do you calculate a running total in SQL?

---

`SUM(amount) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)`, adding `PARTITION BY` to restart per group. Without window functions: a correlated subquery `(SELECT SUM(amount) FROM t t2 WHERE t2.day <= t.day)` — O(n²).
```

```question
What is the difference between ROWS and RANGE?

---

`ROWS` defines the frame by physical row count (2 PRECEDING = the two rows before). `RANGE` defines it by value of the `ORDER BY` key, so all rows with the same key (peers) are included together — which is why the default frame gives tied rows the same running total.
```
