---
id: f87dd1dc-a395-7e7b-b772-ca552d1bd522
key: topic:sql/ctes
subject: sql
topic: ctes
title: Common Table Expressions (WITH)
slug: common-table-expressions-with
order: 1
---

A CTE names a subquery at the top of a statement with `WITH name AS (…)`. Queries read top-down like a pipeline instead of inside-out.

# Syntax

```sql filename:SQL
WITH dept_stats AS (
    SELECT dept_id, COUNT(*) AS staff, AVG(salary) AS avg_sal
    FROM employees
    WHERE dept_id IS NOT NULL
    GROUP BY dept_id
)
SELECT d.name, s.staff, ROUND(s.avg_sal) AS avg_sal
FROM dept_stats s
JOIN departments d ON d.dept_id = s.dept_id
ORDER BY s.avg_sal DESC;
```

```text filename:Output
name        | staff | avg_sal
------------+-------+---------
Engineering | 4     | 115000.0
Sales       | 3     | 84000.0
HR          | 2     | 82500.0
```

# Chaining CTEs

Each CTE can use the ones defined before it. A multi-step report becomes a list of named steps.

```sql filename:SQL
WITH order_totals AS (           -- step 1: value of each valid order
    SELECT o.order_id, o.customer_id, SUM(oi.quantity * oi.unit_price) AS total
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.order_id
    WHERE o.status <> 'cancelled'
    GROUP BY o.order_id, o.customer_id
),
customer_totals AS (             -- step 2: per customer
    SELECT customer_id, COUNT(*) AS orders, SUM(total) AS spent
    FROM order_totals
    GROUP BY customer_id
),
overall AS (                     -- step 3: one number to compare against
    SELECT AVG(spent) AS avg_spent FROM customer_totals
)
SELECT c.name, ct.orders, ct.spent,
       CASE WHEN ct.spent > o.avg_spent THEN 'above avg' ELSE 'below avg' END AS segment
FROM customer_totals ct
JOIN customers c ON c.customer_id = ct.customer_id
CROSS JOIN overall o
ORDER BY ct.spent DESC;
```

```text filename:Output
name   | orders | spent | segment
-------+--------+-------+----------
Ananya | 3      | 68400 | above avg
Rahul  | 2      | 61200 | above avg
Sneha  | 2      | 13700 | below avg
```

# CTE vs subquery vs view vs temp table

|  | Scope | Reusable in the statement | Stored |
| --- | --- | --- | --- |
| Derived table (subquery) | One place in one query | No — repeat it | No |
| CTE | One statement | Yes — reference by name, many times | No |
| View | The database | Across all queries | Definition only |
| Temporary table | Session | Across statements | Yes (data, can be indexed) |

> [!NOTE] Key point
>
> Whether a CTE is computed once (<strong>materialised</strong>) or inlined like a subquery depends on the engine. PostgreSQL 12+ inlines by default and lets you force either with `AS MATERIALIZED` / `AS NOT MATERIALIZED`; SQLite accepts the same hints.

# CTEs with DML

```sql filename:SQL
-- give a 5% raise to everyone below their department's average
WITH below AS (
    SELECT e.emp_id
    FROM employees e
    WHERE e.salary < (SELECT AVG(salary) FROM employees i WHERE i.dept_id = e.dept_id)
)
UPDATE employees
SET salary = salary * 105 / 100
WHERE emp_id IN (SELECT emp_id FROM below);

SELECT name, salary FROM employees WHERE emp_id IN (3, 4, 6, 7, 8) ORDER BY emp_id;
```

```text filename:Output
name   | salary
-------+-------
Meera  | 99750
Karan  | 99750
Arjun  | 73500
Neha   | 75600
Vikram | 84000
```

```question
What is a CTE and why use it?

---

A Common Table Expression is a named, temporary result defined with `WITH` and visible only to the statement that follows. It improves readability (step-by-step logic), lets you reference the same intermediate result several times, and is required for recursive queries.
```

```question
Is a CTE faster than a subquery?

---

Usually neither — most optimizers treat a non-recursive CTE like an inline subquery. It can be faster if it is materialised once and referenced many times, or slower if materialisation blocks predicate push-down. Choose it for clarity and check the plan when performance matters.
```
