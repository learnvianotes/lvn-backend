---
id: d446e058-9a62-7b33-8920-63488653739d
key: topic:sql/outer-joins
subject: sql
topic: outer-joins
title: LEFT, RIGHT & FULL OUTER JOIN
slug: left-right-full-outer-join
order: 1
---

Outer joins keep rows that have <strong>no match</strong>, filling the missing side with `NULL`s. Use them whenever “no related rows” is a valid answer.

# LEFT JOIN

```sql filename:SQL
SELECT d.name AS department, e.name AS employee
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
ORDER BY d.dept_id, e.name;
```

```text filename:Output
department  | employee
------------+---------
Engineering | Asha
Engineering | Karan
Engineering | Meera
Engineering | Ravi
Sales       | Arjun
Sales       | Neha
Sales       | Priya
HR          | Sara
HR          | Vikram
Marketing   | NULL
```

Marketing appears with a `NULL` employee: every left row survives. Counting per department must count a <em>column from the right side</em>:

```sql filename:SQL
SELECT d.name, COUNT(e.emp_id) AS headcount, COUNT(*) AS wrong_count
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.dept_id
GROUP BY d.dept_id, d.name
ORDER BY d.dept_id;
```

```text filename:Output
name        | headcount | wrong_count
------------+-----------+------------
Engineering | 4         | 4
Sales       | 3         | 3
HR          | 2         | 2
Marketing   | 0         | 1
```

> [!WARNING] Watch out
>
> `COUNT(*)` counts the padded row, so Marketing shows 1. `COUNT(e.emp_id)` skips the `NULL` and correctly shows 0.

# RIGHT and FULL OUTER JOIN

`A RIGHT JOIN B` is `B LEFT JOIN A`. `FULL OUTER JOIN` keeps unmatched rows from <strong>both</strong> sides. SQLite supports both since 3.39 (2022); MySQL has <strong>no</strong> `FULL OUTER JOIN`.

```sql filename:SQL
SELECT e.name AS employee, d.name AS department
FROM employees e
FULL OUTER JOIN departments d ON d.dept_id = e.dept_id
ORDER BY d.dept_id NULLS LAST, e.emp_id;
```

```text filename:Output
employee | department
---------+------------
Asha     | Engineering
Ravi     | Engineering
Meera    | Engineering
Karan    | Engineering
Priya    | Sales
Arjun    | Sales
Neha     | Sales
Vikram   | HR
Sara     | HR
NULL     | Marketing
Dev      | NULL
```

```sql filename:SQL
-- MySQL workaround for FULL OUTER JOIN: LEFT JOIN ∪ the right-only rows
SELECT e.name AS employee, d.name AS department
FROM employees e LEFT JOIN departments d ON d.dept_id = e.dept_id
UNION ALL
SELECT NULL, d.name
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.dept_id = d.dept_id)
ORDER BY department, employee;
```

```text filename:Output
employee | department
---------+------------
Dev      | NULL
Asha     | Engineering
Karan    | Engineering
Meera    | Engineering
Ravi     | Engineering
Sara     | HR
Vikram   | HR
NULL     | Marketing
Arjun    | Sales
Neha     | Sales
Priya    | Sales
```

# ON vs WHERE in an outer join

<em>List every customer with their delivered orders.</em> The filter on the right table must go in `ON` — in `WHERE` it removes the `NULL` rows and silently turns the query into an inner join.

```sql filename:SQL
-- filter in ON: all 5 customers kept
SELECT c.name, o.order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'delivered'
ORDER BY c.customer_id, o.order_id;
```

```text filename:Output
name   | order_id
-------+---------
Ananya | 101
Ananya | 103
Rahul  | 102
Rahul  | 106
Sneha  | NULL
Imran  | NULL
Kavya  | NULL
```

```sql filename:SQL
-- filter in WHERE: Sneha, Imran and Kavya disappear
SELECT c.name, o.order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status = 'delivered'
ORDER BY c.customer_id, o.order_id;
```

```text filename:Output
name   | order_id
-------+---------
Ananya | 101
Ananya | 103
Rahul  | 102
Rahul  | 106
```

> [!NOTE] Key point
>
> Rule: conditions on the <strong>optional</strong> (right) side of a `LEFT JOIN` go in `ON`; conditions on the <strong>preserved</strong> (left) side go in `WHERE`. The exception is deliberately testing for `NULL` (`WHERE o.order_id IS NULL`), which finds non-matching rows — an anti-join.

```question
What is the difference between LEFT JOIN and INNER JOIN?

---

`INNER JOIN` returns only rows with a match on both sides. `LEFT JOIN` returns every row of the left table, with the right table's columns `NULL` where there is no match. The row count of a left join is always ≥ the left table's count (more if one left row matches several right rows).
```

```question
How do you emulate FULL OUTER JOIN in MySQL?

---

`LEFT JOIN` the two tables, then `UNION ALL` the rows of the right table that have no match (`RIGHT JOIN … WHERE left.key IS NULL` or `NOT EXISTS`). Plain `UNION` of a `LEFT` and a `RIGHT` join also works but de-duplicates, which can drop genuine duplicate rows.
```
