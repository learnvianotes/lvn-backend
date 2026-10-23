---
id: e21d9f2d-605a-797b-8ad4-4357a575be9a
key: topic:sql/having
subject: sql
topic: having
title: HAVING vs WHERE
slug: having-vs-where
order: 1
---

`WHERE` filters <strong>rows</strong> before grouping; `HAVING` filters <strong>groups</strong> after aggregation. Same idea, different stage.

|  | `WHERE` | `HAVING` |
| --- | --- | --- |
| Filters | Individual rows | Groups (aggregated rows) |
| Runs | Before `GROUP BY` | After `GROUP BY` |
| Can use aggregates | No | Yes |
| Can use indexes | Yes | Rarely — groups are computed first |
| Needs `GROUP BY` | No | Usually (without it, the whole table is one group) |

```sql filename:SQL
-- departments whose average salary exceeds 90000, counting only people hired before 2023
SELECT dept_id,
       COUNT(*)            AS staff,
       ROUND(AVG(salary))  AS avg_salary
FROM employees
WHERE hire_date < '2023-01-01'          -- rows
GROUP BY dept_id
HAVING AVG(salary) > 90000              -- groups
ORDER BY avg_salary DESC;
```

```text filename:Output
dept_id | staff | avg_salary
--------+-------+-----------
1       | 4     | 115000.0
```

# Customers with more than one order

```sql filename:SQL
SELECT customer_id, COUNT(*) AS orders
FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 1
ORDER BY customer_id;
```

```text filename:Output
customer_id | orders
------------+-------
1           | 3
2           | 2
3           | 2
```

# Put row filters in WHERE

> [!TIP] Do
>
> `WHERE status <> 'cancelled' … GROUP BY customer_id` — discards rows early, can use an index, groups less data.

> [!DANGER] Avoid
>
> `… GROUP BY customer_id, status HAVING status <> 'cancelled'` — works, but groups everything first and changes the grouping.

```sql filename:SQL
-- HAVING without GROUP BY: the whole table is one group
SELECT COUNT(*) AS products FROM products HAVING MIN(price) < 100;
SELECT COUNT(*) AS products FROM products HAVING MIN(price) < 10;
```

```text filename:Output
products
--------
7

products
--------
```

```question
What is the difference between WHERE and HAVING?

---

`WHERE` filters rows before grouping and cannot reference aggregates. `HAVING` filters groups after `GROUP BY` and can reference aggregates like `COUNT(*) > 1`. Use `WHERE` for anything that doesn't need an aggregate — it's cheaper.
```

```question
Find duplicate emails in a users table.

---

`SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;` — group by the value that should be unique and keep groups with more than one row.
```
