---
id: f432a3ee-e425-7840-9ada-32af01091716
key: topic:sql/triggers
subject: sql
topic: triggers
title: Triggers
slug: triggers
order: 1
---

A trigger is code the database runs <strong>automatically</strong> before or after an `INSERT`, `UPDATE` or `DELETE` on a table — for audit logs, derived columns and integrity rules.

| Part | Options |
| --- | --- |
| Timing | `BEFORE`, `AFTER`, `INSTEAD OF` (views) |
| Event | `INSERT`, `UPDATE [OF col]`, `DELETE` |
| Granularity | `FOR EACH ROW` (row-level) or per statement (PostgreSQL, SQL Server) |
| Row values | `NEW.col` (insert/update), `OLD.col` (update/delete); SQL Server uses `inserted`/`deleted` tables |

# Audit log with AFTER UPDATE

```sql filename:SQL
CREATE TABLE salary_audit (
    emp_id     INTEGER,
    old_salary INTEGER,
    new_salary INTEGER,
    changed_at TEXT DEFAULT '2024-06-01'
);

CREATE TRIGGER trg_salary_audit
AFTER UPDATE OF salary ON employees
FOR EACH ROW
WHEN NEW.salary <> OLD.salary
BEGIN
    INSERT INTO salary_audit (emp_id, old_salary, new_salary)
    VALUES (OLD.emp_id, OLD.salary, NEW.salary);
END;

UPDATE employees SET salary = salary + 5000 WHERE dept_id = 3;
UPDATE employees SET name = 'Sara K' WHERE emp_id = 9;       -- salary not touched: no audit row

SELECT * FROM salary_audit ORDER BY emp_id;
```

```text filename:Output
emp_id | old_salary | new_salary | changed_at
-------+------------+------------+-----------
8      | 80000      | 85000      | 2024-06-01
9      | 85000      | 90000      | 2024-06-01
```

# Validation with BEFORE + RAISE

```sql filename:SQL
CREATE TRIGGER trg_no_big_cut
BEFORE UPDATE OF salary ON employees
FOR EACH ROW
WHEN NEW.salary < OLD.salary * 0.8
BEGIN
    SELECT RAISE(ABORT, 'salary cut above 20% not allowed');
END;

UPDATE employees SET salary = 50000 WHERE emp_id = 2;
```

```text filename:Error
salary cut above 20% not allowed
```

# Maintaining a derived value

```sql filename:SQL
ALTER TABLE products ADD COLUMN units_sold INTEGER NOT NULL DEFAULT 0;
UPDATE products SET units_sold = (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi
                                  WHERE oi.product_id = products.product_id);

CREATE TRIGGER trg_units_sold
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE products SET units_sold = units_sold + NEW.quantity
    WHERE product_id = NEW.product_id;
END;

INSERT INTO orders VALUES (109, 5, '2024-03-20', 'pending');
INSERT INTO order_items VALUES (109, 7, 2, 12000), (109, 6, 3, 20);

SELECT name, units_sold FROM products WHERE product_id IN (6, 7) ORDER BY product_id;
```

```text filename:Output
name    | units_sold
--------+-----------
Pen     | 18
Monitor | 2
```

# INSTEAD OF: making a view writable

```sql filename:SQL
CREATE VIEW emp_public AS SELECT emp_id, name, dept_id FROM employees;

CREATE TRIGGER trg_emp_public_insert
INSTEAD OF INSERT ON emp_public
BEGIN
    INSERT INTO employees (emp_id, name, dept_id, salary, hire_date)
    VALUES (NEW.emp_id, NEW.name, NEW.dept_id, 50000, '2024-06-01');
END;

INSERT INTO emp_public VALUES (11, 'Tara', 4);
SELECT emp_id, name, dept_id, salary FROM employees WHERE emp_id = 11;
```

```text filename:Output
emp_id | name | dept_id | salary
-------+------+---------+-------
11     | Tara | 4       | 50000
```

```sql filename:PostgreSQL
-- PostgreSQL: the trigger body is a function
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_touch BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

> [!WARNING] Watch out
>
> Triggers are invisible side effects: a simple `UPDATE` can fan out into cascades of hidden writes, slow bulk loads and surprise developers. Keep them small, document them, and prefer constraints for pure integrity rules.

```question
What are triggers used for, and what are their drawbacks?

---

Audit trails, keeping denormalised/derived columns in sync, enforcing complex rules constraints can't express, and making views writable. Drawbacks: hidden logic, harder debugging, performance cost on every write (especially row-level triggers on bulk operations), and possible trigger chains.
```

```question
BEFORE vs AFTER trigger?

---

`BEFORE` runs before the row is written — use it to validate or modify `NEW` values (or reject the change). `AFTER` runs once the change is applied — use it for side effects like audit rows or updating other tables, when the final values are known.
```
