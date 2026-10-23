---
id: cd7133b8-2be2-737b-913f-ae85c908c23b
key: topic:sql/sql-interview-questions
subject: sql
topic: sql-interview-questions
title: SQL Interview Q&A
slug: sql-interview-q-a
order: 1
---

Rapid-fire theory questions with crisp answers. Each links to the topic where it is explained with runnable examples.

# Fundamentals

```question
What is the difference between DELETE, TRUNCATE and DROP?

---

`DELETE` removes selected rows (DML, `WHERE`, triggers fire, rollback-able). `TRUNCATE` removes all rows fast by deallocating pages (DDL, no `WHERE`, resets identity). `DROP` removes the table itself.
```

```question
What is the difference between WHERE and HAVING?

---

`WHERE` filters rows before grouping and can't use aggregates; `HAVING` filters groups after `GROUP BY` and can.
```

```question
What is the logical order of execution of a SELECT?

---

`FROM`/`JOIN` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `DISTINCT` → `ORDER BY` → `LIMIT`.
```

```question
What is NULL? How do you test for it?

---

The marker for a missing/unknown value. Comparisons with it are `UNKNOWN`, so use `IS NULL` / `IS NOT NULL`; replace it with `COALESCE`. Aggregates ignore it; `COUNT(*)` doesn't.
```

```question
UNION vs UNION ALL?

---

Both stack results; `UNION` removes duplicates (extra sort/hash), `UNION ALL` keeps them and is faster.
```

```question
What are the types of joins?

---

`INNER` (matches only), `LEFT`/`RIGHT` `OUTER` (all rows of one side), `FULL OUTER` (all rows of both), `CROSS` (Cartesian product), plus self joins, non-equi joins, and semi/anti joins via `EXISTS`/`NOT EXISTS`.
```

```question
CHAR vs VARCHAR?

---

`CHAR(n)` is fixed length and space-padded; `VARCHAR(n)` stores only the actual characters plus a length. Use `CHAR` only for truly fixed-length codes.
```

# Design

```question
Primary key vs unique key?

---

One primary key per table, never `NULL`, the row identity and FK target. Many unique keys allowed, `NULL`s permitted.
```

```question
What is a foreign key?

---

A column (set) whose values must exist in the referenced key of another table, enforcing referential integrity, with `ON DELETE`/`ON UPDATE` actions (`RESTRICT`, `CASCADE`, `SET NULL`).
```

```question
What is normalization? Name the normal forms.

---

Organising data so each fact is stored once: 1NF (atomic values), 2NF (no partial dependency on a composite key), 3NF (no transitive dependency), BCNF (every determinant is a candidate key). Prevents update/insert/delete anomalies.
```

```question
When would you denormalize?

---

For measured read-performance needs or analytics (star schemas), accepting redundancy and sync logic.
```

# Advanced querying

```question
What is a CTE? A recursive CTE?

---

A named subquery defined with `WITH` for one statement. A recursive CTE references itself (anchor `UNION ALL` recursive member) to walk hierarchies or generate series.
```

```question
What are window functions?

---

Functions computed over a set of rows related to the current row via `OVER (PARTITION BY … ORDER BY … frame)`, without collapsing rows: ranks, running totals, `LAG`/`LEAD`.
```

```question
RANK vs DENSE\_RANK vs ROW\_NUMBER?

---

`ROW_NUMBER`: 1,2,3,4 always unique. `RANK`: ties share, then a gap (1,2,2,4). `DENSE_RANK`: ties share, no gap (1,2,2,3).
```

```question
Correlated vs non-correlated subquery?

---

A correlated subquery references the outer query and is evaluated per outer row; a non-correlated one runs once independently.
```

```question
EXISTS vs IN vs JOIN?

---

`EXISTS`/`IN` test membership without duplicating rows (semi join); a `JOIN` returns combined rows and can multiply them. Prefer `NOT EXISTS` over `NOT IN` because of `NULL`s.
```

# Performance &amp; internals

```question
What is an index? What are its downsides?

---

A sorted auxiliary structure (usually a B+tree) for fast lookups, ranges and sorts. It costs storage and slows `INSERT`/`UPDATE`/`DELETE`.
```

```question
Clustered vs non-clustered index?

---

Clustered: table rows are physically stored in index order (one per table, usually the PK). Non-clustered: separate structure pointing back to rows (many per table).
```

```question
What is a covering index?

---

An index that contains all columns a query needs, so the query is answered from the index without reading the table.
```

```question
What makes a query non-sargable?

---

Functions or arithmetic on the indexed column, leading-wildcard `LIKE`, implicit type conversion, or `OR` across columns — the index can't be used for a seek.
```

```question
How do you find why a query is slow?

---

`EXPLAIN` / `EXPLAIN ANALYZE`: look for full scans, bad estimates, sorts and nested loops over big inputs; then index, rewrite, or reduce data.
```

# Transactions &amp; security

```question
What is ACID?

---

Atomicity (all or nothing), Consistency (constraints hold), Isolation (concurrent transactions don't interfere, per isolation level), Durability (committed data survives crashes).
```

```question
Name the isolation levels and the anomalies they prevent.

---

Read Uncommitted (none), Read Committed (dirty reads), Repeatable Read (+ non-repeatable reads), Serializable (+ phantoms and all others).
```

```question
What is a deadlock?

---

Transactions waiting on each other's locks in a cycle; the database kills one. Avoid with consistent lock order and short transactions; retry on error.
```

```question
What is SQL injection and how do you prevent it?

---

Untrusted input concatenated into SQL changes the query. Prevent with parameterized queries, allow-lists for identifiers and least-privilege accounts.
```

```question
View vs materialized view?

---

A view is a stored query run on each access (always fresh, no storage). A materialized view stores the result (fast, but stale until refreshed).
```

```question
Stored procedure vs function?

---

Procedures are called with `CALL`/`EXEC`, may modify data, return result sets/`OUT` params and control transactions; functions return a value/table and are used inside queries.
```

```question
What is a trigger?

---

Code run automatically `BEFORE`/`AFTER`/`INSTEAD OF` an `INSERT`/`UPDATE`/`DELETE` — for audit logs, derived values and complex rules; use sparingly because it hides logic.
```
