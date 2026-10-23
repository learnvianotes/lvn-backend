---
id: 362bae51-1897-7794-93d2-2e5d446ab6b5
key: topic:sql/access-control
subject: sql
topic: access-control
title: Users, Roles, GRANT & REVOKE
slug: users-roles-grant-revoke
order: 1
---

DCL controls <strong>who</strong> may do <strong>what</strong> on <strong>which</strong> objects. Grant the minimum needed — the principle of least privilege.

# Users and roles

A <strong>role</strong> is a named bundle of privileges; users get privileges by being members of roles. Manage roles, not individual grants.

```sql filename:PostgreSQL
CREATE ROLE analyst;                                    -- a group of privileges
CREATE ROLE app_rw;
CREATE USER priya WITH PASSWORD 's3cret';               -- PostgreSQL: a role that can log in
GRANT analyst TO priya;
```

# GRANT and REVOKE

```sql filename:PostgreSQL%20(MySQL%20%2F%20SQL%20Server%20are%20similar)
-- read-only reporting
GRANT SELECT ON employees, departments TO analyst;

-- the application: data changes, no schema changes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;

-- column-level: hide salary from HR assistants
GRANT SELECT (emp_id, name, dept_id) ON employees TO hr_assistant;

-- let a user pass on the privilege
GRANT SELECT ON orders TO team_lead WITH GRANT OPTION;

REVOKE DELETE ON orders FROM app_rw;
REVOKE analyst FROM priya;
```

| Privilege | Allows |
| --- | --- |
| `SELECT` | Read rows (optionally only some columns) |
| `INSERT` / `UPDATE` / `DELETE` | Change data |
| `EXECUTE` | Run a procedure/function |
| `REFERENCES` | Create a foreign key pointing at the table |
| `CREATE` / `ALTER` / `DROP` | Schema changes (usually only for migration users) |
| `ALL PRIVILEGES` | Everything on the object — avoid for applications |

# Row-level and view-based security

```sql filename:SQL
-- expose a safe subset through a view and grant access only to the view
CREATE VIEW employee_public AS
SELECT emp_id, name, dept_id, hire_date FROM employees;     -- no salary, no email

SELECT * FROM employee_public WHERE dept_id = 3 ORDER BY emp_id;
```

```text filename:Output
emp_id | name   | dept_id | hire_date
-------+--------+---------+-----------
8      | Vikram | 3       | 2018-09-05
9      | Sara   | 3       | 2023-01-09
```

```sql filename:PostgreSQL%20(row-level%20security)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_orders ON orders
    USING (customer_id = current_setting('app.customer_id')::int);
```

> [!NOTE] SQLite
>
> SQLite has no users or `GRANT`: access control is the file system's permissions plus whatever the application enforces.

# Checklist

- Separate accounts for the app, migrations, analysts and admins.
- No application connects as `root`/`postgres`/`sa`.
- Revoke defaults you don't need (e.g. PostgreSQL's `CREATE` on `public` for everyone before v15).
- Store credentials in a secret manager; rotate them; require TLS.
- Audit privileged actions and review grants periodically.

```question
What is the difference between GRANT and REVOKE?

---

`GRANT` gives privileges (or role membership) to a user/role: `GRANT SELECT ON t TO analyst`. `REVOKE` removes them: `REVOKE SELECT ON t FROM analyst`. `WITH GRANT OPTION` lets the grantee pass the privilege on; revoking can then cascade.
```
