---
id: c7e502d9-c470-7cf6-95a7-65fa7b523731
key: topic:sql/update-delete
subject: sql
topic: update-delete
title: UPDATE & DELETE
slug: update-delete
order: 1
---

`UPDATE` changes column values in existing rows; `DELETE` removes rows. Both touch <strong>every row the </strong><strong>`WHERE`</strong><strong> matches</strong> — which is all of them if you forget it.

# UPDATE

```sql filename:SQL
-- 10% raise for Sales; several columns can change at once
UPDATE employees
SET salary = salary * 1.10,
    email  = COALESCE(email, lower(name) || '@corp.in')
WHERE dept_id = 2;

SELECT emp_id, name, email, salary FROM employees WHERE dept_id = 2 ORDER BY emp_id;
```

```text filename:Output
emp_id | name  | email         | salary
-------+-------+---------------+-------------------
5      | Priya | priya@corp.in | 121000.00000000001
6      | Arjun | arjun@corp.in | 77000
7      | Neha  | neha@corp.in  | 79200
```

> [!NOTE] Key point
>
> Every expression on the right of `SET` sees the row's <strong>old</strong> values, so `SET a = b, b = a` swaps two columns in standard SQL (MySQL is the odd one out — it applies assignments left to right).

> [!WARNING] Watch out
>
> Priya's `121000.00000000001` is floating-point error from `* 1.10` (SQLite stored a `REAL`). In a real schema `salary` would be `DECIMAL(10,2)`; in SQLite wrap it: `CAST(round(salary * 1.10) AS INTEGER)`.

# UPDATE using another table

```sql filename:SQL
-- raise everyone located in Hyderabad by 5000: subquery form (works everywhere)
UPDATE employees
SET salary = salary + 5000
WHERE dept_id IN (SELECT dept_id FROM departments WHERE location = 'Hyderabad');

SELECT name, salary FROM employees WHERE dept_id = 3 ORDER BY emp_id;
```

```text filename:Output
name   | salary
-------+-------
Vikram | 85000
Sara   | 90000
```

```sql filename:SQL
-- UPDATE … FROM (PostgreSQL, SQLite 3.33+): join the table being updated
CREATE TABLE raises (emp_id INTEGER PRIMARY KEY, pct INTEGER);
INSERT INTO raises VALUES (3, 10), (4, 20);

UPDATE employees
SET salary = salary + salary * r.pct / 100
FROM raises AS r
WHERE r.emp_id = employees.emp_id;

SELECT name, salary FROM employees WHERE emp_id IN (3, 4) ORDER BY emp_id;
```

```text filename:Output
name  | salary
------+-------
Meera | 104500
Karan | 114000
```

```sql filename:MySQL%20%2F%20SQL%20Server
-- MySQL: multi-table UPDATE with JOIN
UPDATE employees e
JOIN raises r ON r.emp_id = e.emp_id
SET e.salary = e.salary + e.salary * r.pct / 100;

-- SQL Server: UPDATE … FROM with an alias
UPDATE e SET e.salary = e.salary + e.salary * r.pct / 100
FROM employees e JOIN raises r ON r.emp_id = e.emp_id;
```

# DELETE

```sql filename:SQL
-- remove order lines of cancelled orders, then the orders themselves
DELETE FROM order_items
WHERE order_id IN (SELECT order_id FROM orders WHERE status = 'cancelled');

DELETE FROM orders WHERE status = 'cancelled'
RETURNING order_id, customer_id;

SELECT COUNT(*) AS orders_left FROM orders;
```

```text filename:Output
order_id | customer_id
---------+------------
105      | 4

orders_left
-----------
7
```

The child rows (`order_items`) had to go first — otherwise the foreign key would block deleting the order (unless it was declared `ON DELETE CASCADE`).

# Safe habits

1. <strong>Preview</strong>

   Run `SELECT … WHERE <same condition>` first and check the row count.

2. <strong>Wrap in a transaction</strong>

   `BEGIN; UPDATE …;` → check the result → `COMMIT` or `ROLLBACK`.

3. <strong>Limit the blast radius</strong>

   Key the `WHERE` on the primary key when you mean one row.

4. <strong>Prefer soft deletes for business data</strong>

   `UPDATE … SET deleted_at = CURRENT_TIMESTAMP` keeps history and is reversible.

```sql filename:SQL
BEGIN;
UPDATE employees SET salary = 1;          -- oops: no WHERE, all 10 rows changed
SELECT COUNT(*) AS paid_one_rupee FROM employees WHERE salary = 1;
ROLLBACK;                                 -- undo everything since BEGIN
SELECT name, salary FROM employees WHERE emp_id = 1;
```

```text filename:Output
paid_one_rupee
--------------
10

name | salary
-----+-------
Asha | 150000
```

```question
How do you delete rows from one table based on another table?

---

Use a subquery — `DELETE FROM a WHERE id IN (SELECT a_id FROM b WHERE …)` or `WHERE EXISTS (SELECT 1 FROM b WHERE b.a_id = a.id …)`. MySQL and SQL Server also allow a join form: `DELETE a FROM a JOIN b ON … WHERE …`; PostgreSQL has `DELETE FROM a USING b WHERE …`.
```

```question
What happens if you run UPDATE without WHERE?

---

Every row in the table is updated. If you are inside an explicit transaction you can `ROLLBACK`; in autocommit mode the change is permanent and you need a backup or point-in-time recovery. MySQL's `--safe-updates` mode refuses `UPDATE`/`DELETE` without a key-based `WHERE` or `LIMIT`.
```
