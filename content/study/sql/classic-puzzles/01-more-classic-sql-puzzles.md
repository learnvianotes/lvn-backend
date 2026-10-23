---
id: 487b8b56-c809-7dfd-b4e3-132cfc7853fc
key: topic:sql/classic-puzzles
subject: sql
topic: classic-puzzles
title: More Classic SQL Puzzles
slug: more-classic-sql-puzzles
order: 1
---

A grab-bag of questions that test whether you think in sets: relational division, conditional counts, comparisons against aggregates, and self-referencing updates.

# Customers who bought every product in a category (relational division)

```sql filename:SQL
-- customers who bought ALL Furniture products (Desk and Chair)
SELECT c.name
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
JOIN products p     ON p.product_id  = oi.product_id
WHERE p.category = 'Furniture'
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT p.product_id) = (SELECT COUNT(*) FROM products WHERE category = 'Furniture')
ORDER BY c.name;
```

```text filename:Output
name
-----
Sneha
```

# Customers who ordered in every month of Q1

```sql filename:SQL
SELECT c.name
FROM customers c JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_date >= '2024-01-01' AND o.order_date < '2024-04-01'
GROUP BY c.customer_id, c.name
HAVING COUNT(DISTINCT strftime('%m', o.order_date)) = 3;
```

```text filename:Output
name
------
Ananya
```

# Products never ordered together with a Laptop

```sql filename:SQL
SELECT p.name FROM products p
WHERE p.name <> 'Laptop'
  AND NOT EXISTS (
      SELECT 1
      FROM order_items a
      JOIN order_items b ON b.order_id = a.order_id
      JOIN products l    ON l.product_id = b.product_id AND l.name = 'Laptop'
      WHERE a.product_id = p.product_id
  )
ORDER BY p.name;
```

```text filename:Output
name
--------
Chair
Desk
Monitor
Notebook
Pen
```

# Share of total per row

```sql filename:SQL
SELECT category,
       SUM(price) AS catalogue_value,
       ROUND(100.0 * SUM(price) / (SELECT SUM(price) FROM products), 1) AS pct
FROM products
GROUP BY category
ORDER BY pct DESC;
```

```text filename:Output
category    | catalogue_value | pct
------------+-----------------+-----
Electronics | 69500           | 84.7
Furniture   | 12500           | 15.2
Stationery  | 80              | 0.1
```

# Swap two values in one UPDATE

```sql filename:SQL
CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT, gender TEXT);
INSERT INTO people VALUES (1, 'A', 'm'), (2, 'B', 'f'), (3, 'C', 'm');

UPDATE people SET gender = CASE gender WHEN 'm' THEN 'f' ELSE 'm' END;
SELECT * FROM people ORDER BY id;
```

```text filename:Output
id | name | gender
---+------+-------
1  | A    | f
2  | B    | m
3  | C    | f
```

# Year-over-year style comparison with a self join

```sql filename:SQL
WITH monthly AS (
    SELECT CAST(strftime('%m', o.order_date) AS INTEGER) AS m, COUNT(*) AS orders
    FROM orders o GROUP BY m
)
SELECT cur.m AS month, cur.orders, prev.orders AS prev_month_orders
FROM monthly cur
LEFT JOIN monthly prev ON prev.m = cur.m - 1
ORDER BY cur.m;
```

```text filename:Output
month | orders | prev_month_orders
------+--------+------------------
1     | 2      | NULL
2     | 3      | 2
3     | 3      | 3
```

# Second most recent order of each customer

```sql filename:SQL
SELECT customer_id, order_id, order_date
FROM (
    SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn
    FROM orders o
)
WHERE rn = 2
ORDER BY customer_id;
```

```text filename:Output
customer_id | order_id | order_date
------------+----------+-----------
1           | 103      | 2024-02-03
2           | 102      | 2024-01-12
3           | 104      | 2024-02-14
```

```question
How do you find customers who bought all products (relational division)?

---

Group the customer's distinct purchased products and compare the count with the total number of products: `GROUP BY customer HAVING COUNT(DISTINCT product_id) = (SELECT COUNT(*) FROM products)`. The double-`NOT EXISTS` formulation (“there is no product the customer has not bought”) is the textbook alternative.
```
