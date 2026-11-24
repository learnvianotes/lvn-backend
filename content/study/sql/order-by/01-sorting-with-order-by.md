---
id: 54494534-1135-778a-a51e-8b13f18df716
key: topic:sql/order-by
subject: sql
topic: order-by
title: Sorting with ORDER BY
slug: sorting-with-order-by
order: 1
---

Without `ORDER BY`, row order is <strong>undefined</strong> — it may look sorted today and change after an index or a version upgrade. If order matters, say so.

# One or more sort keys

```sql filename:SQL
SELECT name, dept_id, salary
FROM employees
WHERE dept_id IS NOT NULL
ORDER BY dept_id ASC, salary DESC, name;    -- ASC is the default
```

```text filename:Output
name   | dept_id | salary
-------+---------+-------
Asha   | 1       | 150000
Ravi   | 1       | 120000
Karan  | 1       | 95000
Meera  | 1       | 95000
Priya  | 2       | 110000
Neha   | 2       | 72000
Arjun  | 2       | 70000
Sara   | 3       | 85000
Vikram | 3       | 80000
```

Rows are sorted by the first key; ties are broken by the second, and so on. Meera and Karan tie on salary, so `name` decides.

# Sort by expression, alias or position

```sql filename:SQL
SELECT name, salary / 12 AS monthly
FROM employees
WHERE dept_id = 2
ORDER BY monthly DESC;                      -- alias from the SELECT list

SELECT name, length(name) AS len
FROM employees
ORDER BY length(name) DESC, 1               -- expression, then column position 1
LIMIT 3;
```

```text filename:Output
name  | monthly
------+--------
Priya | 9166
Neha  | 6000
Arjun | 5833

name   | len
-------+----
Vikram | 6
Arjun  | 5
Karan  | 5
```

> [!WARNING] Watch out
>
> `ORDER BY 1` (column position) is handy interactively but fragile in code — reordering the select list changes the sort silently.

# Where do NULLs go?

SQLite, MySQL and SQL Server treat `NULL` as <strong>smallest</strong> (first in `ASC`); PostgreSQL and Oracle treat it as <strong>largest</strong> (last in `ASC`). Be explicit with `NULLS FIRST`/`NULLS LAST` (PostgreSQL, Oracle, SQLite 3.30+).

```sql filename:SQL
SELECT name, email FROM employees WHERE emp_id >= 6 ORDER BY email;
SELECT name, email FROM employees WHERE emp_id >= 6 ORDER BY email NULLS LAST;
```

```text filename:Output
name   | email
-------+---------------
Neha   | NULL
Dev    | NULL
Arjun  | arjun@corp.in
Sara   | sara@corp.in
Vikram | vikram@corp.in

name   | email
-------+---------------
Arjun  | arjun@corp.in
Sara   | sara@corp.in
Vikram | vikram@corp.in
Neha   | NULL
Dev    | NULL
```

```sql filename:SQL
-- engines without NULLS LAST (MySQL, SQL Server): sort on "is null" first
SELECT name, email FROM employees WHERE emp_id >= 6
ORDER BY email IS NULL, email;
```

```text filename:Output
name   | email
-------+---------------
Arjun  | arjun@corp.in
Sara   | sara@corp.in
Vikram | vikram@corp.in
Neha   | NULL
Dev    | NULL
```

# Custom order with CASE

```sql filename:SQL
SELECT order_id, status FROM orders
ORDER BY CASE status
             WHEN 'pending'   THEN 1
             WHEN 'shipped'   THEN 2
             WHEN 'delivered' THEN 3
             ELSE 4
         END,
         order_id;
```

```text filename:Output
order_id | status
---------+----------
107      | pending
104      | shipped
108      | shipped
101      | delivered
102      | delivered
103      | delivered
106      | delivered
105      | cancelled
```

```question
Can you ORDER BY a column that is not in the SELECT list?

---

Yes, in a plain query (`SELECT name FROM employees ORDER BY salary`). Not with `SELECT DISTINCT` or in some `UNION` cases, because the sort key must then be part of the output rows.
```
