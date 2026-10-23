---
id: 6aec75e4-36c8-7004-ac52-eb33595159b4
key: topic:sql/semi-anti-joins
subject: sql
topic: semi-anti-joins
title: Semi & Anti Joins (EXISTS, IN, NOT EXISTS)
slug: semi-anti-joins-exists-in-not-exists
order: 1
---

A <strong>semi join</strong> keeps rows that <em>have</em> a match; an <strong>anti join</strong> keeps rows that have <em>no</em> match. Neither returns columns from the other table, and neither duplicates rows.

# Semi join: customers who ordered

```sql filename:SQL
SELECT c.name FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.name;

SELECT c.name FROM customers c
WHERE c.customer_id IN (SELECT customer_id FROM orders)
ORDER BY c.name;
```

```text filename:Output
name
------
Ananya
Imran
Rahul
Sneha

name
------
Ananya
Imran
Rahul
Sneha
```

Compare with a plain join, which returns a customer once <strong>per order</strong>:

```sql filename:SQL
SELECT c.name FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
ORDER BY c.name;
```

```text filename:Output
name
------
Ananya
Ananya
Ananya
Imran
Rahul
Rahul
Sneha
Sneha
```

> [!NOTE] Key point
>
> `EXISTS` stops at the first match and never multiplies rows. Using `JOIN` + `DISTINCT` to get the same list does more work and is a code smell.

# Anti join: customers who never ordered

```sql filename:SQL
-- 1. NOT EXISTS (recommended)
SELECT c.name FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);

-- 2. LEFT JOIN … IS NULL
SELECT c.name FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL;

-- 3. NOT IN (only safe if the subquery can never return NULL)
SELECT name FROM customers
WHERE customer_id NOT IN (SELECT customer_id FROM orders);
```

```text filename:Output
name
-----
Kavya

name
-----
Kavya

name
-----
Kavya
```

```sql filename:SQL
-- products never sold
SELECT p.name FROM products p
WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id);
```

```text filename:Output
name
-------
Monitor
```

# The NOT IN + NULL trap, for real

```sql filename:SQL
-- departments that no employee belongs to…
SELECT name FROM departments
WHERE dept_id NOT IN (SELECT dept_id FROM employees);          -- Dev's NULL dept_id → empty!

SELECT name FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id);
```

```text filename:Output
name
----

name
---------
Marketing
```

> [!WARNING] Watch out
>
> Marketing should be returned, but `NOT IN` returned nothing because the subquery contains a `NULL`. `NOT EXISTS` is immune. If you must use `NOT IN`, add `WHERE dept_id IS NOT NULL` inside the subquery.

| Form | Handles NULL | Duplicates | Notes |
| --- | --- | --- | --- |
| `EXISTS` / `NOT EXISTS` | Yes | Never | Clearest intent; optimizers turn it into a semi/anti join |
| `IN (subquery)` | Yes | Never | Fine for semi joins |
| `NOT IN (subquery)` | <strong>No</strong> | Never | Returns nothing if the subquery has a `NULL` |
| `LEFT JOIN … IS NULL` | Yes | Never (anti) | Common, portable; test a non-nullable column |
| `JOIN` + `DISTINCT` | Yes | Removed afterwards | Extra work; avoid for existence checks |

```question
EXISTS vs IN — which is faster?

---

Modern optimizers (PostgreSQL, SQL Server, Oracle, MySQL 8) usually rewrite both into the same semi join, so pick the clearest. The real difference is `NOT IN` vs `NOT EXISTS`: `NOT IN` gives wrong (empty) results when the subquery returns a `NULL`, so prefer `NOT EXISTS` for anti joins.
```

```question
Find customers who have never placed an order.

---

`SELECT c.* FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);` — or `LEFT JOIN orders o ON … WHERE o.order_id IS NULL`.
```
