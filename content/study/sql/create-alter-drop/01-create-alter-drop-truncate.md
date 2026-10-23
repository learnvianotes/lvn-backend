---
id: a0761b76-6d57-728b-a2ae-befbbe16b932
key: topic:sql/create-alter-drop
subject: sql
topic: create-alter-drop
title: CREATE, ALTER, DROP & TRUNCATE
slug: create-alter-drop-truncate
order: 1
---

DDL commands create and reshape database objects. They change the <em>schema</em>, so they are usually run through versioned migration scripts, not by hand.

# CREATE TABLE

```sql filename:SQL
CREATE TABLE projects (
    project_id  INTEGER PRIMARY KEY,
    title       VARCHAR(100) NOT NULL,
    budget      DECIMAL(12, 2) DEFAULT 0,
    dept_id     INTEGER REFERENCES departments(dept_id),
    started_on  DATE
);

CREATE TABLE IF NOT EXISTS projects (id INTEGER);   -- no error: already exists, skipped

SELECT name, type, "notnull", dflt_value, pk
FROM pragma_table_info('projects')
ORDER BY cid;
```

```text filename:Output
name       | type           | notnull | dflt_value | pk
-----------+----------------+---------+------------+---
project_id | INTEGER        | 0       | NULL       | 1
title      | VARCHAR(100)   | 1       | NULL       | 0
budget     | DECIMAL(12, 2) | 0       | 0          | 0
dept_id    | INTEGER        | 0       | NULL       | 0
started_on | DATE           | 0       | NULL       | 0
```

> [!NOTE] Key point
>
> `pragma_table_info()` is SQLite's way to describe a table. Elsewhere: `DESCRIBE t` (MySQL), `\d t` (psql), `sp_help 't'` (SQL Server), or the standard `information_schema.columns` view.

# CREATE TABLE … AS SELECT

Creates a table <em>and</em> fills it from a query — handy for snapshots and backups. Constraints and indexes are <strong>not</strong> copied.

```sql filename:SQL
CREATE TABLE eng_staff AS
SELECT emp_id, name, salary FROM employees WHERE dept_id = 1;

SELECT * FROM eng_staff ORDER BY emp_id;
```

```text filename:Output
emp_id | name  | salary
-------+-------+-------
1      | Asha  | 150000
2      | Ravi  | 120000
3      | Meera | 95000
4      | Karan | 95000
```

```sql filename:SQL%20Server%20(SELECT%20%E2%80%A6%20INTO)
SELECT emp_id, name, salary
INTO eng_staff
FROM employees WHERE dept_id = 1;
```

# ALTER TABLE

```sql filename:SQL
CREATE TABLE projects (project_id INTEGER PRIMARY KEY, title TEXT NOT NULL);

ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'planned';
ALTER TABLE projects RENAME COLUMN title TO project_name;
ALTER TABLE projects RENAME TO initiatives;
INSERT INTO initiatives (project_name) VALUES ('Mobile app');
ALTER TABLE initiatives DROP COLUMN status;

SELECT * FROM initiatives;
```

```text filename:Output
project_id | project_name
-----------+-------------
1          | Mobile app
```

| Change | SQLite | MySQL | PostgreSQL |
| --- | --- | --- | --- |
| Add column | `ADD COLUMN c T` | `ADD COLUMN c T` | `ADD COLUMN c T` |
| Rename column | `RENAME COLUMN a TO b` | `RENAME COLUMN a TO b` | `RENAME COLUMN a TO b` |
| Change type | not supported — rebuild the table | `MODIFY COLUMN c NEWTYPE` | `ALTER COLUMN c TYPE NEWTYPE` |
| Drop column | `DROP COLUMN c` (3.35+) | `DROP COLUMN c` | `DROP COLUMN c` |
| Add constraint | not supported — rebuild | `ADD CONSTRAINT …` | `ADD CONSTRAINT …` |

```sql filename:MySQL%20%2F%20PostgreSQL
ALTER TABLE employees MODIFY COLUMN name VARCHAR(150) NOT NULL;   -- MySQL
ALTER TABLE employees ALTER COLUMN name TYPE VARCHAR(150);        -- PostgreSQL
ALTER TABLE employees ADD CONSTRAINT chk_sal CHECK (salary < 1000000);
```

# DROP, TRUNCATE, DELETE

|  | `DELETE FROM t` | `TRUNCATE TABLE t` | `DROP TABLE t` |
| --- | --- | --- | --- |
| Removes | Rows (all, or those matching `WHERE`) | All rows | Rows <strong>and</strong> the table definition |
| Category | DML | DDL | DDL |
| `WHERE` allowed | Yes | No | No |
| Speed on big tables | Slow — row by row, fully logged | Fast — deallocates pages | Fast |
| Fires triggers | Yes (`DELETE` triggers) | No | No |
| Resets auto-increment | No | Yes (most engines) | Table is gone |
| Rollback | Yes | PostgreSQL/SQL Server: yes in a transaction; MySQL/Oracle: no (auto-commit) | Same as `TRUNCATE` |

```sql filename:SQL
CREATE TABLE temp_log (msg TEXT);
INSERT INTO temp_log VALUES ('a'), ('b');

DELETE FROM temp_log;                 -- SQLite has no TRUNCATE; an unqualified DELETE is optimised the same way
SELECT COUNT(*) AS rows_left FROM temp_log;

DROP TABLE temp_log;
DROP TABLE IF EXISTS temp_log;        -- no error the second time
SELECT COUNT(*) AS tables_named_temp_log FROM sqlite_schema WHERE name = 'temp_log';
```

```text filename:Output
rows_left
---------
0

tables_named_temp_log
---------------------
0
```

```sql filename:MySQL%20%2F%20PostgreSQL%20%2F%20SQL%20Server%20%2F%20Oracle
TRUNCATE TABLE temp_log;
```

> [!WARNING] Watch out
>
> `DROP` and `TRUNCATE` cannot be undone in MySQL and Oracle (they auto-commit). Take a backup, and never run DDL on production without a reviewed migration.

```question
DELETE vs TRUNCATE vs DROP?

---

`DELETE` removes chosen rows one by one (DML, logged, triggers fire, rollback-able). `TRUNCATE` empties the whole table quickly by deallocating storage (DDL, no `WHERE`, no triggers, resets identity). `DROP` removes the table itself — structure, data, indexes, constraints.
```

```question
Can TRUNCATE be used on a table referenced by a foreign key?

---

Generally no — SQL Server and MySQL refuse to truncate a table referenced by a foreign key; PostgreSQL requires `TRUNCATE … CASCADE` to also empty the referencing tables. `DELETE` works if no child rows reference the deleted rows.
```
