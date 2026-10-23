---
id: cdefa73d-d1ed-718c-80aa-6f9ebe6f43a2
key: topic:sql/case-expression
subject: sql
topic: case-expression
title: CASE Expressions
slug: case-expressions
order: 1
---

`CASE` is SQL's if/else. It is an <strong>expression</strong> — it returns a value and can be used anywhere a value can: `SELECT`, `WHERE`, `ORDER BY`, `GROUP BY`, inside aggregates.

# Searched CASE

```sql filename:SQL
SELECT name, salary,
       CASE
           WHEN salary >= 120000 THEN 'Senior'
           WHEN salary >= 90000  THEN 'Mid'
           ELSE 'Junior'
       END AS band
FROM employees
ORDER BY salary DESC, emp_id;
```

```text filename:Output
name   | salary | band
-------+--------+-------
Asha   | 150000 | Senior
Ravi   | 120000 | Senior
Priya  | 110000 | Mid
Meera  | 95000  | Mid
Karan  | 95000  | Mid
Sara   | 85000  | Junior
Vikram | 80000  | Junior
Neha   | 72000  | Junior
Arjun  | 70000  | Junior
Dev    | 60000  | Junior
```

Conditions are tested top to bottom and the <strong>first</strong> true branch wins — so order the `WHEN`s from most to least specific. Without `ELSE`, unmatched rows get `NULL`.

# Simple CASE

```sql filename:SQL
SELECT order_id,
       CASE status
           WHEN 'delivered' THEN 'Done'
           WHEN 'shipped'   THEN 'On the way'
           WHEN 'pending'   THEN 'Processing'
       END AS label
FROM orders
ORDER BY order_id;
```

```text filename:Output
order_id | label
---------+-----------
101      | Done
102      | Done
103      | Done
104      | On the way
105      | NULL
106      | Done
107      | Processing
108      | On the way
```

> [!WARNING] Watch out
>
> A simple `CASE x WHEN NULL THEN …` never matches — it tests `x = NULL`. Use the searched form: `CASE WHEN x IS NULL THEN …`.

# CASE inside aggregates: conditional counts

```sql filename:SQL
SELECT COUNT(*)                                           AS orders,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
       COUNT(CASE WHEN order_date >= '2024-03-01' THEN 1 END) AS in_march
FROM orders;
```

```text filename:Output
orders | delivered | cancelled | in_march
-------+-----------+-----------+---------
8      | 4         | 1         | 3
```

This pattern — an aggregate over a `CASE` — is the basis of <strong>pivot</strong> queries (see Interview Prep). `COUNT(CASE … THEN 1 END)` works because unmatched rows produce `NULL`, which `COUNT` skips. PostgreSQL also offers `COUNT(*) FILTER (WHERE status = 'delivered')`.

# CASE in ORDER BY and UPDATE

```sql filename:SQL
-- different raise per band, in one statement
UPDATE employees
SET salary = salary + CASE WHEN salary < 80000 THEN 5000
                           WHEN salary < 100000 THEN 3000
                           ELSE 0 END;

SELECT name, salary FROM employees WHERE salary < 110000 ORDER BY salary, emp_id;
```

```text filename:Output
name   | salary
-------+-------
Dev    | 65000
Arjun  | 75000
Neha   | 77000
Vikram | 83000
Sara   | 88000
Meera  | 98000
Karan  | 98000
```

> [!NOTE] Key point
>
> Short forms: `IIF(cond, a, b)` (SQL Server, SQLite), `IF(cond, a, b)` (MySQL), `DECODE(x, v1, r1, …, default)` (Oracle). `CASE` works everywhere.

```question
Can you use CASE in a WHERE clause?

---

Yes — it is just an expression: `WHERE CASE WHEN :role = 'admin' THEN 1 WHEN owner_id = :me THEN 1 ELSE 0 END = 1`. But plain `AND`/`OR` logic is usually clearer and friendlier to indexes.
```
