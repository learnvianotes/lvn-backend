---
id: ecda39b3-e3e4-79d6-a362-980f7bb79ae7
key: topic:sql/correlated-subqueries
subject: sql
topic: correlated-subqueries
title: Correlated Subqueries
slug: correlated-subqueries
order: 1
---

A correlated subquery refers to a column of the <strong>outer</strong> query, so it is logically re-evaluated for every outer row — like a nested loop.

```sql filename:SQL
-- employees who earn more than the average of THEIR OWN department
SELECT e.name, e.dept_id, e.salary
FROM employees e
WHERE e.salary > (
    SELECT AVG(i.salary)
    FROM employees i
    WHERE i.dept_id = e.dept_id          -- ← correlation: uses the outer row
)
ORDER BY e.emp_id;
```

```text filename:Output
name  | dept_id | salary
------+---------+-------
Asha  | 1       | 150000
Ravi  | 1       | 120000
Priya | 2       | 110000
Sara  | 3       | 85000
```

1. <strong>Take an outer row</strong>

   e = Asha, dept 1.

2. <strong>Run the inner query for it</strong>

   Average salary of dept 1 = 115000.

3. <strong>Test</strong>

   150000 &gt; 115000 → keep Asha. Repeat for the next row.

# Correlated subquery in SELECT

```sql filename:SQL
SELECT c.name,
       (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS orders,
       (SELECT MAX(order_date) FROM orders o WHERE o.customer_id = c.customer_id) AS last_order
FROM customers c
ORDER BY c.customer_id;
```

```text filename:Output
name   | orders | last_order
-------+--------+-----------
Ananya | 3      | 2024-03-15
Rahul  | 2      | 2024-03-01
Sneha  | 2      | 2024-03-08
Imran  | 1      | 2024-02-20
Kavya  | 0      | NULL
```

# EXISTS is always correlated

```sql filename:SQL
-- customers who bought something from the Furniture category
SELECT c.name
FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    JOIN products p     ON p.product_id = oi.product_id
    WHERE o.customer_id = c.customer_id AND p.category = 'Furniture'
)
ORDER BY c.name;
```

```text filename:Output
name
------
Ananya
Rahul
Sneha
```

# Correlated UPDATE

```sql filename:SQL
ALTER TABLE customers ADD COLUMN lifetime_value INTEGER DEFAULT 0;

UPDATE customers
SET lifetime_value = COALESCE((
    SELECT SUM(oi.quantity * oi.unit_price)
    FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.customer_id = customers.customer_id AND o.status <> 'cancelled'
), 0);

SELECT name, lifetime_value FROM customers ORDER BY lifetime_value DESC, customer_id;
```

```text filename:Output
name   | lifetime_value
-------+---------------
Ananya | 68400
Rahul  | 61200
Sneha  | 13700
Imran  | 0
Kavya  | 0
```

> [!WARNING] Performance
>
> Correlated subqueries can be O(n × m). Optimizers often decorrelate them into joins, but not always — for large tables compare against a join to a pre-aggregated derived table/CTE, or a window function (`AVG(salary) OVER (PARTITION BY dept_id)`).

```question
What is a correlated subquery?

---

A subquery that references columns of the outer query, so its result depends on the current outer row and is (logically) evaluated once per row. Example: `WHERE salary > (SELECT AVG(salary) FROM employees i WHERE i.dept_id = e.dept_id)`. A non-correlated subquery runs once, independently.
```
