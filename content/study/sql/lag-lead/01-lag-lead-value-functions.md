---
id: 758f3acf-4348-7573-a6ad-1185f5841fc2
key: topic:sql/lag-lead
subject: sql
topic: lag-lead
title: LAG, LEAD & Value Functions
slug: lag-lead-value-functions
order: 1
---

`LAG` and `LEAD` read a value from a previous or following row of the same window — day-over-day changes, gaps between events and “next step” analysis without a self join.

```sql filename:SQL
SELECT day, amount,
       LAG(amount)       OVER (ORDER BY day) AS prev_day,
       LEAD(amount)      OVER (ORDER BY day) AS next_day,
       amount - LAG(amount) OVER (ORDER BY day) AS change,
       LAG(amount, 2, 0) OVER (ORDER BY day) AS two_days_ago
FROM daily_sales
ORDER BY day;
```

```text filename:Output
day        | amount | prev_day | next_day | change | two_days_ago
-----------+--------+----------+----------+--------+-------------
2024-03-01 | 120    | NULL     | 80       | NULL   | 0
2024-03-02 | 80     | 120      | 150      | -40    | 0
2024-03-03 | 150    | 80       | 90       | 70     | 120
2024-03-04 | 90     | 150      | 200      | -60    | 80
2024-03-05 | 200    | 90       | 60       | 110    | 150
2024-03-06 | 60     | 200      | NULL     | -140   | 90
```

Signature: `LAG(expr, offset = 1, default = NULL)`. The first row has no previous row, so it gets the default.

# Growth in percent

```sql filename:SQL
WITH monthly AS (
    SELECT strftime('%Y-%m', o.order_date) AS month,
           SUM(oi.quantity * oi.unit_price) AS revenue
    FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY month
)
SELECT month, revenue,
       LAG(revenue) OVER (ORDER BY month) AS prev,
       ROUND(100.0 * (revenue - LAG(revenue) OVER (ORDER BY month))
             / LAG(revenue) OVER (ORDER BY month), 1) AS growth_pct
FROM monthly
ORDER BY month;
```

```text filename:Output
month   | revenue | prev  | growth_pct
--------+---------+-------+-----------
2024-01 | 66700   | NULL  | NULL
2024-02 | 12900   | 66700 | -80.7
2024-03 | 63700   | 12900 | 393.8
```

# Per group: time between a customer's orders

```sql filename:SQL
SELECT customer_id, order_id, order_date,
       LAG(order_date) OVER w AS previous_order,
       julianday(order_date) - julianday(LAG(order_date) OVER w) AS days_since
FROM orders
WINDOW w AS (PARTITION BY customer_id ORDER BY order_date)
ORDER BY customer_id, order_date;
```

```text filename:Output
customer_id | order_id | order_date | previous_order | days_since
------------+----------+------------+----------------+-----------
1           | 101      | 2024-01-05 | NULL           | NULL
1           | 103      | 2024-02-03 | 2024-01-05     | 29.0
1           | 108      | 2024-03-15 | 2024-02-03     | 41.0
2           | 102      | 2024-01-12 | NULL           | NULL
2           | 106      | 2024-03-01 | 2024-01-12     | 49.0
3           | 104      | 2024-02-14 | NULL           | NULL
3           | 107      | 2024-03-08 | 2024-02-14     | 23.0
4           | 105      | 2024-02-20 | NULL           | NULL
```

> [!NOTE] Key point
>
> `WINDOW w AS (…)` names a window once and reuses it (standard SQL; PostgreSQL, MySQL 8, SQLite — not SQL Server before 2022).

# FIRST\_VALUE, LAST\_VALUE, NTH\_VALUE

```sql filename:SQL
SELECT name, dept_id, salary,
       FIRST_VALUE(name) OVER (PARTITION BY dept_id ORDER BY salary DESC) AS top_earner,
       LAST_VALUE(name)  OVER (PARTITION BY dept_id ORDER BY salary DESC) AS last_value_default,
       LAST_VALUE(name)  OVER (PARTITION BY dept_id ORDER BY salary DESC
                               ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS lowest_earner
FROM employees
WHERE dept_id = 2
ORDER BY salary DESC;
```

```text filename:Output
name  | dept_id | salary | top_earner | last_value_default | lowest_earner
------+---------+--------+------------+--------------------+--------------
Priya | 2       | 110000 | Priya      | Priya              | Arjun
Neha  | 2       | 72000  | Priya      | Neha               | Arjun
Arjun | 2       | 70000  | Priya      | Arjun              | Arjun
```

> [!WARNING] Watch out
>
> `LAST_VALUE` with the default frame returns the <strong>current</strong> row (the frame ends at the current row), not the last row of the partition. Specify `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, or use `FIRST_VALUE` with the opposite sort.

```question
How do you compute the difference between the current row and the previous row?

---

`value - LAG(value) OVER (PARTITION BY group ORDER BY time)`. Before window functions this needed a self join on “the previous row”, which is slower and harder to write.
```
