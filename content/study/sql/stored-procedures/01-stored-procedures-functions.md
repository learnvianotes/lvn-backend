---
id: 72923d70-aa78-7028-80c8-1e979714da1a
key: topic:sql/stored-procedures
subject: sql
topic: stored-procedures
title: Stored Procedures & Functions
slug: stored-procedures-functions
order: 1
---

Stored procedures and user-defined functions are named programs stored <strong>inside</strong> the database — SQL plus variables, conditions, loops and error handling. Syntax is completely dialect-specific.

|  | Stored procedure | Function (UDF) |
| --- | --- | --- |
| Called with | `CALL p(…)` / `EXEC p …` | Inside a query: `SELECT f(x)` |
| Returns | Zero or more result sets, `OUT` parameters | A value (scalar) or a table |
| Side effects (`INSERT`/`UPDATE`) | Yes | Usually not allowed (SQL Server, MySQL) / discouraged |
| Transaction control | Can `COMMIT`/`ROLLBACK` (PostgreSQL 11+ procedures, MySQL, SQL Server) | No |

# MySQL

```sql filename:MySQL
DELIMITER //
CREATE PROCEDURE give_raise(IN p_dept INT, IN p_pct DECIMAL(5,2), OUT p_rows INT)
BEGIN
    UPDATE employees
    SET salary = salary * (1 + p_pct / 100)
    WHERE dept_id = p_dept;
    SET p_rows = ROW_COUNT();
END //
DELIMITER ;

CALL give_raise(2, 10, @n);
SELECT @n;
```

# PostgreSQL (PL/pgSQL)

```sql filename:PostgreSQL
CREATE OR REPLACE FUNCTION dept_payroll(p_dept INT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(salary), 0) INTO total FROM employees WHERE dept_id = p_dept;
    RETURN total;
END $$;

SELECT name, dept_payroll(dept_id) FROM departments;

CREATE PROCEDURE archive_orders(p_before DATE)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO orders_archive SELECT * FROM orders WHERE order_date < p_before;
    DELETE FROM orders WHERE order_date < p_before;
    COMMIT;
END $$;

CALL archive_orders('2024-01-01');
```

# SQL Server (T-SQL)

```sql filename:SQL%20Server
CREATE PROCEDURE dbo.GetDeptEmployees
    @DeptId INT,
    @MinSalary INT = 0              -- default parameter
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        SELECT name, salary FROM employees
        WHERE dept_id = @DeptId AND salary >= @MinSalary
        ORDER BY salary DESC;
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;

EXEC dbo.GetDeptEmployees @DeptId = 1, @MinSalary = 100000;
```

> [!NOTE] SQLite
>
> SQLite has no stored procedures: it is embedded, so the host program (Python, Java, …) <em>is</em> the procedure language. It does let the host register functions — e.g. Python's `sqlite3.Connection.create_function`.

# Pros and cons

> [!NOTE] Pros
>
> Fewer network round trips for multi-step logic; logic close to the data; can be granted `EXECUTE` without table access; plan reuse.

> [!NOTE] Cons
>
> Vendor lock-in; harder to version, test, debug and scale than application code; business logic split across two places.

```question
What is the difference between a stored procedure and a function?

---

A function returns a value (or table) and is used inside SQL expressions; it generally must not modify data. A procedure is invoked with `CALL`/`EXEC`, can return several result sets and `OUT` parameters, can modify data and (in most engines) control transactions, but cannot be used inside a `SELECT`.
```
