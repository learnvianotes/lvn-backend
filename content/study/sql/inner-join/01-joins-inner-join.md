---
id: ecae93ff-c72a-7edc-b230-54f93fa77759
key: topic:sql/inner-join
subject: sql
topic: inner-join
title: Joins & INNER JOIN
slug: joins-inner-join
order: 1
---

A join combines rows from two tables by matching a condition — usually a foreign key equal to a primary key. `INNER JOIN` keeps only the rows that match on both sides.

# Why joins exist

Normalised tables store each fact once: an employee row holds `dept_id = 1`, not the text <em>Engineering, Bengaluru</em>. A join puts the pieces back together at query time.

| Join | Returns |
| --- | --- |
| `INNER JOIN` | Only matching pairs |
| `LEFT [OUTER] JOIN` | All left rows + matches (`NULL`s where none) |
| `RIGHT [OUTER] JOIN` | All right rows + matches |
| `FULL [OUTER] JOIN` | All rows from both sides |
| `CROSS JOIN` | Every combination (Cartesian product) |
| Self join | A table joined to itself (hierarchies, comparisons) |

# INNER JOIN

```sql filename:SQL
SELECT e.name, d.name AS department, d.location
FROM employees e
INNER JOIN departments d ON d.dept_id = e.dept_id
ORDER BY e.emp_id;
```

```text filename:Output
name   | department  | location
-------+-------------+----------
Asha   | Engineering | Bengaluru
Ravi   | Engineering | Bengaluru
Meera  | Engineering | Bengaluru
Karan  | Engineering | Bengaluru
Priya  | Sales       | Mumbai
Arjun  | Sales       | Mumbai
Neha   | Sales       | Mumbai
Vikram | HR          | Hyderabad
Sara   | HR          | Hyderabad
```

10 employees, but only 9 rows: <strong>Dev</strong> (`dept_id` `NULL`) matches no department, and <strong>Marketing</strong> matches no employee — an inner join drops both. `JOIN` alone means `INNER JOIN`.

# How a join is evaluated (conceptually)

1. <strong>Pair up</strong>

   Take every combination of a row from the left table with a row from the right table.

2. <strong>Keep matches</strong>

   Keep only pairs for which the `ON` condition is true.

3. <strong>Continue</strong>

   Further joins, `WHERE`, `GROUP BY`… work on this combined row set.

> [!NOTE] Key point
>
> That is only the <em>meaning</em>. Physically the optimizer uses a <strong>nested-loop</strong> join (with an index on the inner side), a <strong>hash join</strong> (build a hash table on the smaller side) or a <strong>merge join</strong> (both inputs sorted on the key).

# Joining several tables

```sql filename:SQL
-- what did each customer buy? (customers → orders → order_items → products)
SELECT c.name AS customer, o.order_id, p.name AS product, oi.quantity
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
JOIN products p     ON p.product_id  = oi.product_id
WHERE o.status = 'delivered'
ORDER BY o.order_id, p.name;
```

```text filename:Output
customer | order_id | product    | quantity
---------+----------+------------+---------
Ananya   | 101      | Headphones | 1
Ananya   | 101      | Laptop     | 1
Rahul    | 102      | Chair      | 2
Rahul    | 102      | Pen        | 10
Ananya   | 103      | Notebook   | 5
Ananya   | 103      | Pen        | 5
Rahul    | 106      | Laptop     | 1
```

# ON vs USING vs NATURAL

```sql filename:SQL
-- USING: the column has the same name on both sides; it appears once in the output
SELECT order_id, customer_id, name, status
FROM orders JOIN customers USING (customer_id)
WHERE order_id <= 102
ORDER BY order_id;
```

```text filename:Output
order_id | customer_id | name   | status
---------+-------------+--------+----------
101      | 1           | Ananya | delivered
102      | 2           | Rahul  | delivered
```

> [!WARNING] Watch out
>
> `NATURAL JOIN` joins on <em>every</em> column with the same name. `employees NATURAL JOIN departments` would match on both `dept_id` <strong>and</strong> `name` (employee name = department name) and return nothing. Avoid it — spell out the condition.

# Join condition vs filter

For an inner join, a condition in `ON` or in `WHERE` gives the same result. Convention: relationships in `ON`, row filters in `WHERE`. For <strong>outer</strong> joins the placement changes the result — see the next topic.

> [!WARNING] Watch out
>
> Forgetting the join condition (old comma syntax `FROM a, b` with no `WHERE`) creates a Cartesian product — 10 employees × 4 departments = 40 rows of nonsense. Explicit `JOIN … ON` makes the omission obvious.

```question
What is the difference between JOIN and INNER JOIN?

---

None — `INNER` is optional. `JOIN … ON …` is an inner join.
```

```question
Can you join on columns that are not keys?

---

Yes; any boolean condition works (`ON a.city = b.city`, ranges, inequalities). Joins on unindexed or non-unique columns can be slow or multiply rows, so know the cardinality of both sides.
```
