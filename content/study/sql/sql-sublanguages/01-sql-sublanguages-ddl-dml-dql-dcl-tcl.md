---
id: eb782b6f-852b-73bc-841b-a53db9bcd9a4
key: topic:sql/sql-sublanguages
subject: sql
topic: sql-sublanguages
title: "SQL Sublanguages: DDL, DML, DQL, DCL, TCL"
slug: sql-sublanguages-ddl-dml-dql-dcl-tcl
order: 1
---

SQL commands are grouped by what they act on — the structure, the data, permissions, or transactions. A classic first interview question.

| Group | Stands for | Commands | Acts on |
| --- | --- | --- | --- |
| <strong>DDL</strong> | Data Definition Language | `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME` | Schema objects (tables, indexes, views) |
| <strong>DML</strong> | Data Manipulation Language | `INSERT`, `UPDATE`, `DELETE`, `MERGE` | Rows inside tables |
| <strong>DQL</strong> | Data Query Language | `SELECT` | Reading rows (often counted as part of DML) |
| <strong>DCL</strong> | Data Control Language | `GRANT`, `REVOKE` | Permissions of users and roles |
| <strong>TCL</strong> | Transaction Control Language | `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `BEGIN` | Grouping DML into atomic units |

# One of each

```sql filename:SQL
-- DDL: define structure
CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL);

-- TCL + DML: change data inside a transaction
BEGIN;
INSERT INTO notes (body) VALUES ('learn SQL'), ('practice joins');
UPDATE notes SET body = 'practice window functions' WHERE id = 2;
COMMIT;

-- DQL: read it back
SELECT id, body FROM notes ORDER BY id;
```

```text filename:Output
id | body
---+--------------------------
1  | learn SQL
2  | practice window functions
```

```sql filename:PostgreSQL%20%2F%20MySQL%20%2F%20SQL%20Server
-- DCL: permissions (server databases only; SQLite has no users)
GRANT SELECT, INSERT ON notes TO analyst;
REVOKE INSERT ON notes FROM analyst;
```

# Why the grouping matters

> [!NOTE] Auto-commit of DDL
>
> In MySQL and Oracle every DDL statement <em>implicitly commits</em> the open transaction and cannot be rolled back. PostgreSQL and SQLite allow DDL inside a transaction.

> [!NOTE] Permissions
>
> DBAs grant DDL rights to few people (schema owners), DML to applications, and read-only DQL to analysts.

```question
Is TRUNCATE DDL or DML?

---

<strong>DDL</strong> in most engines. It removes all rows by deallocating data pages instead of deleting row by row, does not fire `DELETE` triggers, resets identity counters, and (in MySQL/Oracle) auto-commits. `DELETE` is DML: row by row, logged, can have a `WHERE`, can be rolled back.
```

```question
Is SELECT part of DML?

---

Formally the SQL standard puts `SELECT` under data manipulation; many courses split it out as <strong>DQL</strong>. Either answer is accepted if you explain that `SELECT` only reads data.
```
