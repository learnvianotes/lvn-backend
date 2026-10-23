---
id: 777144ec-c9f8-7443-9de0-ab182aaaa7ee
key: topic:sql/where-operators
subject: sql
topic: where-operators
title: Filtering with WHERE
slug: filtering-with-where
order: 1
---

`WHERE` keeps only the rows for which a condition is <strong>true</strong> — rows where it is false <em>or unknown</em> (`NULL`) are dropped.

# Operators

| Kind | Operators | Example |
| --- | --- | --- |
| Comparison | `= <> != < <= > >=` | `salary >= 100000` |
| Logical | `AND`, `OR`, `NOT` | `dept_id = 1 AND salary > 100000` |
| Range | `BETWEEN a AND b` (inclusive) | `hire_date BETWEEN '2018-01-01' AND '2020-12-31'` |
| List | `IN (…)`, `NOT IN (…)` | `dept_id IN (2, 3)` |
| Pattern | `LIKE`, `NOT LIKE` | `name LIKE 'A%'` |
| Null test | `IS NULL`, `IS NOT NULL` | `email IS NULL` |

# Comparison and logic

```sql filename:SQL
SELECT name, dept_id, salary
FROM employees
WHERE dept_id = 1 AND salary < 100000
ORDER BY emp_id;
```

```text filename:Output
name  | dept_id | salary
------+---------+-------
Meera | 1       | 95000
Karan | 1       | 95000
```

```sql filename:SQL
SELECT name, hire_date
FROM employees
WHERE hire_date BETWEEN '2018-01-01' AND '2020-12-31'
ORDER BY hire_date;
```

```text filename:Output
name   | hire_date
-------+-----------
Vikram | 2018-09-05
Meera  | 2019-01-10
Karan  | 2020-08-01
```

```sql filename:SQL
SELECT name, dept_id
FROM employees
WHERE dept_id IN (2, 3) AND NOT name = 'Sara'
ORDER BY emp_id;
```

```text filename:Output
name   | dept_id
-------+--------
Priya  | 2
Arjun  | 2
Neha   | 2
Vikram | 3
```

# Operator precedence: AND before OR

`AND` binds tighter than `OR`, exactly like `×` before `+`. Mixing them without parentheses is a classic bug.

```sql filename:SQL
-- intended: Sales or HR employees earning over 75000
SELECT name, dept_id, salary FROM employees
WHERE dept_id = 2 OR dept_id = 3 AND salary > 75000     -- means 2 OR (3 AND > 75000)
ORDER BY emp_id;

SELECT name, dept_id, salary FROM employees
WHERE (dept_id = 2 OR dept_id = 3) AND salary > 75000
ORDER BY emp_id;
```

```text filename:Output
name   | dept_id | salary
-------+---------+-------
Priya  | 2       | 110000
Arjun  | 2       | 70000
Neha   | 2       | 72000
Vikram | 3       | 80000
Sara   | 3       | 85000

name   | dept_id | salary
-------+---------+-------
Priya  | 2       | 110000
Vikram | 3       | 80000
Sara   | 3       | 85000
```

> [!WARNING] Watch out
>
> The first query returned Arjun and Neha (Sales, below 75000) because the salary test only applied to HR. When `AND` and `OR` meet, always add parentheses.

# BETWEEN with dates and times

> [!WARNING] Watch out
>
> `BETWEEN '2024-03-01' AND '2024-03-31'` misses `'2024-03-31 14:00'` when the column stores timestamps — the string/timestamp is greater than the upper bound. Prefer a half-open range: `ts >= '2024-03-01' AND ts < '2024-04-01'`.

```sql filename:SQL
SELECT order_id, order_date FROM orders
WHERE order_date >= '2024-02-01' AND order_date < '2024-03-01'
ORDER BY order_id;
```

```text filename:Output
order_id | order_date
---------+-----------
103      | 2024-02-03
104      | 2024-02-14
105      | 2024-02-20
```

```question
What is the difference between != and &lt;&gt;?

---

None in practice — `<>` is the ISO standard “not equal”, `!=` is accepted by every major engine. Both yield unknown (not true) when either side is `NULL`.
```

```question
Is BETWEEN inclusive?

---

Yes, both ends: `x BETWEEN a AND b` means `x >= a AND x <= b`. If `a > b` it matches nothing (SQL Server/MySQL) — `BETWEEN SYMMETRIC` in PostgreSQL swaps them for you.
```
