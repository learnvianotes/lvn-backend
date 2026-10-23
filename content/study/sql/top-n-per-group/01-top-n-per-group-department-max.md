---
id: 5af3cd95-21b3-7376-9471-a93b5403a685
key: topic:sql/top-n-per-group
subject: sql
topic: top-n-per-group
title: Top-N per Group & Department Max
slug: top-n-per-group-department-max
order: 1
---

“Highest-paid employee in each department”, “latest order per customer”, “top 2 products per category” — one pattern with a few variants.

# Department max: three ways

```sql filename:SQL
-- 1. window function
SELECT department, name, salary FROM (
    SELECT d.name AS department, e.name, e.salary,
           RANK() OVER (PARTITION BY e.dept_id ORDER BY e.salary DESC) AS rnk
    FROM employees e JOIN departments d ON d.dept_id = e.dept_id
) WHERE rnk = 1
ORDER BY department;
```

```text filename:Output
department  | name  | salary
------------+-------+-------
Engineering | Asha  | 150000
HR          | Sara  | 85000
Sales       | Priya | 110000
```

```sql filename:SQL
-- 2. join to the per-group max
SELECT d.name AS department, e.name, e.salary
FROM employees e
JOIN (SELECT dept_id, MAX(salary) AS max_sal FROM employees GROUP BY dept_id) m
  ON m.dept_id = e.dept_id AND m.max_sal = e.salary
JOIN departments d ON d.dept_id = e.dept_id
ORDER BY department;

-- 3. correlated subquery
SELECT e.dept_id, e.name, e.salary
FROM employees e
WHERE e.salary = (SELECT MAX(salary) FROM employees i WHERE i.dept_id = e.dept_id)
ORDER BY e.dept_id;
```

```text filename:Output
department  | name  | salary
------------+-------+-------
Engineering | Asha  | 150000
HR          | Sara  | 85000
Sales       | Priya | 110000

dept_id | name  | salary
--------+-------+-------
1       | Asha  | 150000
2       | Priya | 110000
3       | Sara  | 85000
```

> [!NOTE] Key point
>
> All three return <strong>ties</strong> (both rows if two people share the max). Use `ROW_NUMBER` instead of `RANK` when exactly one row per group is required, with a deterministic tie-breaker.

# Top 2 products by revenue per category

```sql filename:SQL
WITH product_revenue AS (
    SELECT p.category, p.name, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.product_id
    GROUP BY p.product_id, p.category, p.name
),
ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC, name) AS rn
    FROM product_revenue
)
SELECT category, name, revenue FROM ranked WHERE rn <= 2 ORDER BY category, rn;
```

```text filename:Output
category    | name       | revenue
------------+------------+--------
Electronics | Laptop     | 107000
Electronics | Headphones | 10000
Furniture   | Desk       | 16000
Furniture   | Chair      | 13500
Stationery  | Notebook   | 1500
Stationery  | Pen        | 300
```

# Latest order per customer (with details)

```sql filename:SQL
SELECT c.name, o.order_id, o.order_date, o.status
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_date = (SELECT MAX(order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id)
ORDER BY c.customer_id;
```

```text filename:Output
name   | order_id | order_date | status
-------+----------+------------+----------
Ananya | 108      | 2024-03-15 | shipped
Rahul  | 106      | 2024-03-01 | delivered
Sneha  | 107      | 2024-03-08 | pending
Imran  | 105      | 2024-02-20 | cancelled
```

```question
How do you get the top 3 rows per group?

---

`ROW_NUMBER()` (exactly 3) or `DENSE_RANK()` (top 3 values incl. ties) `OVER (PARTITION BY group ORDER BY metric DESC)` in a CTE/subquery, then `WHERE rn <= 3`. Alternatives: `LATERAL`/`CROSS APPLY` with `LIMIT 3` per group (PostgreSQL/SQL Server) — efficient with an index on (group, metric).
```
