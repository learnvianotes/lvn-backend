---
id: 01c56c68-c0c5-78ea-a419-c38e96a8aa30
key: topic:sql/distinct-aliases
subject: sql
topic: distinct-aliases
title: DISTINCT & Aliases
slug: distinct-aliases
order: 1
---

`DISTINCT` removes duplicate result rows; aliases give columns and tables short, readable names.

# DISTINCT

```sql filename:SQL
SELECT DISTINCT category FROM products ORDER BY category;

SELECT DISTINCT city FROM customers ORDER BY city;       -- NULL counts as one value here
```

```text filename:Output
category
-----------
Electronics
Furniture
Stationery

city
---------
NULL
Bengaluru
Delhi
Mumbai
```

`DISTINCT` applies to the <strong>whole row</strong>, not to one column:

```sql filename:SQL
SELECT DISTINCT customer_id, status FROM orders ORDER BY customer_id, status;
```

```text filename:Output
customer_id | status
------------+----------
1           | delivered
1           | shipped
2           | delivered
3           | pending
3           | shipped
4           | cancelled
```

```sql filename:SQL
SELECT COUNT(DISTINCT customer_id) AS customers_who_ordered,
       COUNT(DISTINCT status)      AS statuses
FROM orders;
```

```text filename:Output
customers_who_ordered | statuses
----------------------+---------
4                     | 4
```

> [!WARNING] Watch out
>
> Reaching for `DISTINCT` to hide duplicates caused by a join usually hides a bug (a missing join condition or a one-to-many join). Fix the join — or use `EXISTS` — instead.

```sql filename:PostgreSQL%20(DISTINCT%20ON)
-- PostgreSQL only: first row per group (by the ORDER BY)
SELECT DISTINCT ON (dept_id) dept_id, name, salary
FROM employees
ORDER BY dept_id, salary DESC;
```

# Column aliases

```sql filename:SQL
SELECT name AS employee,
       salary * 12 AS "annual pay",       -- double quotes: spaces or reserved words
       hire_date joined                    -- AS is optional
FROM employees
WHERE emp_id <= 2
ORDER BY emp_id;
```

```text filename:Output
employee | annual pay | joined
---------+------------+-----------
Asha     | 1800000    | 2015-03-01
Ravi     | 1440000    | 2017-06-15
```

# Table aliases

```sql filename:SQL
SELECT e.name, d.name AS department
FROM employees AS e
JOIN departments d ON d.dept_id = e.dept_id
WHERE e.salary > 100000
ORDER BY e.emp_id;
```

```text filename:Output
name  | department
------+------------
Asha  | Engineering
Ravi  | Engineering
Priya | Sales
```

> [!NOTE] Key point
>
> A table alias is required when the same table appears twice (self-join) and makes every multi-table query readable. Oracle does not accept `AS` before a <em>table</em> alias.

> [!WARNING] Watch out
>
> A column alias cannot be used in `WHERE` of the same query (the `SELECT` list is evaluated <em>after</em> `WHERE`) — see the next topic. SQLite and MySQL relax this in places, which is not portable.

```question
What is the difference between DISTINCT and GROUP BY?

---

`SELECT DISTINCT a, b` and `SELECT a, b … GROUP BY a, b` return the same rows and usually get the same plan. Use `DISTINCT` to de-duplicate; use `GROUP BY` when you also compute aggregates per group.
```
