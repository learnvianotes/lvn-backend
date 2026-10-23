---
id: 19c5c2c4-8db6-79ad-9ae0-9899e8c61b60
key: topic:sql/sql-intro
subject: sql
topic: sql-intro
title: What is SQL?
slug: what-is-sql
order: 1
---

SQL (Structured Query Language) is the standard language for defining, querying and changing data in relational databases — you describe <em>what</em> you want, the database works out <em>how</em>.

> [!INFO]
>
> <strong>Relational database</strong> — data stored in <strong>tables</strong> (relations) of <strong>rows</strong> (records/tuples) and <strong>columns</strong> (attributes/fields). Tables are linked by shared key values, not by pointers.

> [!INFO]
>
> <strong>SQL</strong> — a <em>declarative</em> language (pronounced “S-Q-L” or “sequel”), standardised by ANSI/ISO since 1986. Every relational database speaks it, each with its own dialect.

# Tables, rows and columns

A table has a fixed set of named, typed columns and any number of rows. Every row should be identifiable by a <strong>primary key</strong>.

```sql filename:SQL
SELECT emp_id, name, salary
FROM employees
WHERE salary > 100000
ORDER BY salary DESC;
```

```text filename:Output
emp_id | name  | salary
-------+-------+-------
1      | Asha  | 150000
2      | Ravi  | 120000
5      | Priya | 110000
```

Read it as English: <em>give me the id, name and salary of employees earning over 1,00,000, highest first</em>. There is no loop, no index handling, no file access — the <strong>query optimizer</strong> decides how to fetch the rows.

# Declarative vs procedural

> [!NOTE] Declarative (SQL)
>
> You state the <em>result</em>: which rows, which columns, what order. The engine picks indexes, join algorithms and order of work.

> [!NOTE] Procedural (Python, Java)
>
> You state the <em>steps</em>: open, loop, compare, append, sort. You own the algorithm and its performance.

# Relational vocabulary

| Formal term | Everyday term | Meaning |
| --- | --- | --- |
| Relation | Table | A set of tuples with the same attributes |
| Tuple | Row / record | One entity, e.g. one employee |
| Attribute | Column / field | One property, e.g. `salary` |
| Domain | Data type (+ constraints) | The allowed values of an attribute |
| Degree | Number of columns | `employees` has degree 7 |
| Cardinality | Number of rows | `employees` has cardinality 10 |
| Schema | Structure | Table definitions, types, constraints (not the data) |

# Why relational databases?

> [!NOTE] Integrity
>
> Types, keys and constraints reject bad data before it is stored.

> [!NOTE] Transactions (ACID)
>
> Multi-step changes happen completely or not at all, even across crashes.

> [!NOTE] Ad-hoc queries
>
> Any question answerable from the data can be asked later — no new code paths needed.

> [!NOTE] Concurrency
>
> Hundreds of users read and write safely at the same time.

> [!NOTE] Convention
>
> SQL is case-insensitive for keywords (`select` = `SELECT`). Convention: keywords in UPPER CASE, table and column names in `snake_case`. String literals use <strong>single</strong> quotes: `'Mumbai'`.

```question
What is the difference between SQL and MySQL?

---

SQL is the <em>language</em> (an ISO standard). MySQL is one <em>database product</em> (an RDBMS) that implements SQL with its own extensions — like PostgreSQL, SQL Server, Oracle and SQLite.
```

```question
What does “declarative” mean for SQL?

---

You describe the result set you want, not the algorithm. The optimizer chooses the execution plan (index vs full scan, join order, hash vs nested-loop join), so the same query can get faster when indexes are added without changing a line of SQL.
```
