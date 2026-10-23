---
id: 2ffb137e-f032-79a1-8659-2cbf8473def9
key: topic:sql/rdbms-dialects
subject: sql
topic: rdbms-dialects
title: RDBMS Landscape & Dialects
slug: rdbms-landscape-dialects
order: 1
---

All major databases share core SQL, but each adds its own types, functions and syntax. Knowing the differences saves hours when you switch engines.

> [!INFO]
>
> <strong>RDBMS</strong> — Relational Database Management System — the software that stores tables, enforces constraints, runs queries and manages transactions and users.

# The major engines

| Engine | Typical use | Notable traits |
| --- | --- | --- |
| <strong>MySQL / MariaDB</strong> | Web apps (LAMP), SaaS back ends | Open source, InnoDB engine, very popular, replication-friendly |
| <strong>PostgreSQL</strong> | General purpose, analytics, GIS | Most standards-compliant open-source engine; rich types (`JSONB`, arrays), extensions |
| <strong>SQL Server</strong> | Microsoft / enterprise stacks | T-SQL dialect, strong tooling, `TOP`, `IDENTITY` |
| <strong>Oracle</strong> | Large enterprises, banking | PL/SQL, `ROWNUM`, `DUAL`, powerful but commercial |
| <strong>SQLite</strong> | Mobile apps, browsers, embedded, tests | A library, not a server — the whole DB is one file; dynamic typing |

> [!NOTE] About these notes
>
> Every runnable example in these notes executes on <strong>SQLite 3.53</strong>, which supports modern SQL: CTEs, window functions, `RIGHT`/`FULL` joins, `UPSERT`, `RETURNING` and JSON. Where another engine differs, the variant is shown and labelled.

# Dialect differences you will meet

| Task | MySQL | PostgreSQL | SQL Server | Oracle | SQLite |
| --- | --- | --- | --- | --- | --- |
| First N rows | `LIMIT n` | `LIMIT n` / `FETCH FIRST n ROWS ONLY` | `TOP (n)` / `OFFSET … FETCH` | `FETCH FIRST n ROWS ONLY` (12c+) | `LIMIT n` |
| Auto-increment id | `AUTO_INCREMENT` | `GENERATED … AS IDENTITY` / `SERIAL` | `IDENTITY(1,1)` | `GENERATED AS IDENTITY` | `INTEGER PRIMARY KEY` |
| String concat | `CONCAT(a, b)` | `a &#124;&#124; b` | `a + b` / `CONCAT` | `a &#124;&#124; b` | `a &#124;&#124; b` |
| Current timestamp | `NOW()` | `NOW()` | `GETDATE()` | `SYSDATE` | `CURRENT_TIMESTAMP` |
| NULL replacement | `IFNULL` / `COALESCE` | `COALESCE` | `ISNULL` / `COALESCE` | `NVL` / `COALESCE` | `IFNULL` / `COALESCE` |
| Boolean type | `TINYINT(1)` | `BOOLEAN` | `BIT` | `NUMBER(1)` (`BOOLEAN` in 23ai) | integer `0`/`1` |
| Identifier quoting | \`name\` | `"name"` | `[name]` | `"name"` | `"name"` (also accepts the others) |

# The same query in four dialects

<em>Top 3 highest-paid employees:</em>

```sql filename:SQLite%20%2F%20MySQL%20%2F%20PostgreSQL
SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 3;
```

```text filename:Output
name  | salary
------+-------
Asha  | 150000
Ravi  | 120000
Priya | 110000
```

```sql filename:SQL%20Server
SELECT TOP (3) name, salary FROM employees ORDER BY salary DESC;
```

```sql filename:Oracle%2012c%2B%20%2F%20PostgreSQL%20%2F%20SQL%20standard
SELECT name, salary FROM employees ORDER BY salary DESC
FETCH FIRST 3 ROWS ONLY;
```

> [!TIP] Do
>
> Prefer standard features (`COALESCE`, `CASE`, `FETCH FIRST`, `||` or `CONCAT`) when they exist — the code ports more easily between engines.

```question
Which SQL database should you choose for a new project?

---

Default to <strong>PostgreSQL</strong> for a general server-side app (standards, JSONB, extensions). <strong>MySQL</strong> is equally fine and widely hosted. <strong>SQLite</strong> for embedded/mobile/local tools and tests. SQL Server or Oracle usually when the organisation already runs them.
```

```question
Is SQLite a “real” database?

---

Yes — it is fully transactional (ACID) and is the most deployed database in the world (every phone and browser). What it lacks is a server: no network access, no user accounts/`GRANT`, and one writer at a time. It is ideal for local data, not for many concurrent writers.
```
