---
id: e46679c1-82c5-769e-9df7-6480286a7309
key: topic:sql/views
subject: sql
topic: views
title: Views
slug: views
order: 1
---

A view is a <strong>saved query</strong> that behaves like a table. It stores no data (unless materialised) — every time you select from it, its query runs.

# Creating and using a view

```sql filename:SQL
CREATE VIEW employee_directory AS
SELECT e.emp_id, e.name, d.name AS department, d.location, m.name AS manager
FROM employees e
LEFT JOIN departments d ON d.dept_id = e.dept_id
LEFT JOIN employees  m ON m.emp_id  = e.manager_id;

SELECT name, department, manager
FROM employee_directory
WHERE location = 'Mumbai'
ORDER BY emp_id;
```

```text filename:Output
name  | department | manager
------+------------+--------
Priya | Sales      | Asha
Arjun | Sales      | Priya
Neha  | Sales      | Priya
```

> [!NOTE] Simplicity
>
> Hide complex joins behind a simple name; analysts query `employee_directory`, not four joins.

> [!NOTE] Security
>
> Grant access to a view that exposes some columns/rows (no `salary`) instead of the base table.

> [!NOTE] Stable interface
>
> Refactor the underlying tables while the view keeps the old shape for existing reports.

> [!NOTE] Consistency
>
> One definition of “active customer” or “net revenue” instead of ten copies.

# A view for business logic

```sql filename:SQL
CREATE VIEW order_summary AS
SELECT o.order_id, o.customer_id, o.order_date, o.status,
       SUM(oi.quantity * oi.unit_price) AS order_total,
       COUNT(*) AS line_count
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, o.customer_id, o.order_date, o.status;

SELECT status, COUNT(*) AS orders, SUM(order_total) AS value
FROM order_summary
GROUP BY status
ORDER BY value DESC;
```

```text filename:Output
status    | orders | value
----------+--------+-------
delivered | 4      | 119100
shipped   | 2      | 23000
cancelled | 1      | 5000
pending   | 1      | 1200
```

# Updatable views

A simple view over <strong>one</strong> table without aggregates, `DISTINCT` or `GROUP BY` is usually updatable in PostgreSQL, MySQL, SQL Server and Oracle. `WITH CHECK OPTION` rejects writes that would fall outside the view's `WHERE`.

```sql filename:PostgreSQL%20%2F%20MySQL%20%2F%20SQL%20Server%20%2F%20Oracle
CREATE VIEW sales_team AS
SELECT emp_id, name, salary, dept_id FROM employees WHERE dept_id = 2
WITH CHECK OPTION;

UPDATE sales_team SET salary = salary + 1000 WHERE emp_id = 6;   -- OK: updates employees
UPDATE sales_team SET dept_id = 3 WHERE emp_id = 6;              -- ERROR: row would leave the view
```

> [!NOTE] SQLite
>
> SQLite views are read-only; you make them writable with `INSTEAD OF` triggers (see Triggers).

# Materialised views

A <strong>materialised view</strong> stores the query result physically, so reads are fast but data is only as fresh as the last refresh. Great for heavy dashboards.

```sql filename:PostgreSQL%20(Oracle%3A%20MATERIALIZED%20VIEW%3B%20SQL%20Server%3A%20indexed%20views)
CREATE MATERIALIZED VIEW monthly_revenue AS
SELECT date_trunc('month', order_date) AS month, SUM(total) AS revenue
FROM order_summary GROUP BY 1;

REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;   -- needs a unique index
```

|  | View | Materialised view |
| --- | --- | --- |
| Stores data | No — query runs on every read | Yes — a snapshot |
| Freshness | Always current | Stale until refreshed |
| Read speed | Same as the underlying query | Fast (can be indexed) |
| Write cost | None | Refresh cost |

```question
What is the difference between a view and a table?

---

A table stores rows. A (regular) view stores only a query; reading it runs the query against the base tables, so it is always up to date and uses no extra storage. Views give abstraction and security; they don't make queries faster by themselves.
```

```question
Can you insert into a view?

---

If the view is <em>updatable</em> — typically a single base table, no aggregates/`DISTINCT`/`GROUP BY`/set operators, and it includes all `NOT NULL` columns without defaults. Otherwise, use `INSTEAD OF` triggers (SQL Server, Oracle, PostgreSQL, SQLite).
```
