---
id: 339f983a-8f2b-76ca-b805-90f7ecc03630
key: topic:sql/indexes
subject: sql
topic: indexes
title: Indexes
slug: indexes
order: 1
---

An index is a separate, sorted structure that lets the database find rows without scanning the whole table — like the index at the back of a book. It speeds reads and slows writes.

# B-tree: the default index

A B-tree (B+tree) keeps keys sorted in a shallow, balanced tree: a lookup touches \~3–4 pages even for millions of rows (O(log n)), and because keys are sorted it also serves ranges, prefixes and `ORDER BY`.

| Query shape | Can a B-tree on `col` help? |
| --- | --- |
| `col = 5`, `col IN (…)` | Yes — seek |
| `col > 5`, `BETWEEN`, `LIKE 'abc%'` | Yes — range scan |
| `ORDER BY col`, `MIN/MAX(col)` | Yes — already sorted |
| `LIKE '%abc'`, `lower(col) = …`, `col + 1 = 6` | No — needs a full scan (or an expression index) |

# Reading a query plan

`EXPLAIN QUERY PLAN` (SQLite) shows how a query will run; read the `detail` column. <strong>SCAN</strong> = read every row; <strong>SEARCH … USING INDEX</strong> = jump straight to matching rows.

```sql filename:SQL
EXPLAIN QUERY PLAN
SELECT * FROM events WHERE user_id = 42;
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+------------
2  | 0      | 216     | SCAN events
```

```sql filename:SQL
CREATE INDEX idx_events_user ON events (user_id);

EXPLAIN QUERY PLAN
SELECT * FROM events WHERE user_id = 42;
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+------------------------------------------------------
3  | 0      | 61      | SEARCH events USING INDEX idx_events_user (user_id=?)
```

| Engine | Show the plan | Run and measure |
| --- | --- | --- |
| SQLite | `EXPLAIN QUERY PLAN …` | `.timer on` in the shell |
| PostgreSQL | `EXPLAIN …` | `EXPLAIN (ANALYZE, BUFFERS) …` |
| MySQL | `EXPLAIN …` / `EXPLAIN FORMAT=TREE` | `EXPLAIN ANALYZE …` |
| SQL Server | Estimated plan (Ctrl+L) | Actual plan, `SET STATISTICS IO ON` |

# Composite indexes and the leftmost-prefix rule

An index on `(user_id, created_at)` is sorted by `user_id`, then by `created_at` within each user — like a phone book sorted by surname, then first name. It helps queries that constrain a <strong>leftmost prefix</strong> of its columns.

```sql filename:SQL
CREATE INDEX idx_events_user_time ON events (user_id, created_at);

EXPLAIN QUERY PLAN SELECT * FROM events WHERE user_id = 42 AND created_at >= '2024-03-01';
EXPLAIN QUERY PLAN SELECT * FROM events WHERE user_id = 42;
EXPLAIN QUERY PLAN SELECT * FROM events WHERE created_at >= '2024-03-01';
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+----------------------------------------------------------------------------
3  | 0      | 51      | SEARCH events USING INDEX idx_events_user_time (user_id=? AND created_at>?)

id | parent | notused | detail
---+--------+---------+-----------------------------------------------------------
3  | 0      | 62      | SEARCH events USING INDEX idx_events_user_time (user_id=?)

id | parent | notused | detail
---+--------+---------+------------
2  | 0      | 216     | SCAN events
```

The third query cannot use the index: without `user_id`, the `created_at` values are scattered across the whole index. Column order rule of thumb: <strong>equality columns first, then the range/sort column</strong>.

# Covering indexes

If the index contains every column the query needs, the engine answers from the index alone and never touches the table.

```sql filename:SQL
CREATE INDEX idx_events_user_kind ON events (user_id, kind);

EXPLAIN QUERY PLAN
SELECT kind, COUNT(*) FROM events WHERE user_id = 42 GROUP BY kind;
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+--------------------------------------------------------------------
6  | 0      | 55      | SEARCH events USING COVERING INDEX idx_events_user_kind (user_id=?)
```

```sql filename:PostgreSQL%20%2F%20SQL%20Server%20(INCLUDE)
-- PostgreSQL 11+ / SQL Server: extra payload columns stored in the leaf, not part of the key
CREATE INDEX idx_orders_cust ON orders (customer_id) INCLUDE (order_date, status);
```

# Other kinds of index

```sql filename:SQL
CREATE UNIQUE INDEX ux_users_name ON users (name);                          -- also a constraint
CREATE INDEX idx_events_buy ON events (created_at) WHERE kind = 'buy';      -- partial
CREATE INDEX idx_emp_lower_name ON employees (lower(name));                 -- expression

EXPLAIN QUERY PLAN SELECT event_id FROM events WHERE kind = 'buy' AND created_at >= '2024-03-25';
EXPLAIN QUERY PLAN SELECT * FROM employees WHERE lower(name) = 'sara';
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+-----------------------------------------------------------------
2  | 0      | 183     | SEARCH events USING COVERING INDEX idx_events_buy (created_at>?)

id | parent | notused | detail
---+--------+---------+-----------------------------------------------------------
3  | 0      | 61      | SEARCH employees USING INDEX idx_emp_lower_name (<expr>=?)
```

| Index type | Good for | Where |
| --- | --- | --- |
| B-tree | Equality, ranges, sorting — the default | All |
| Hash | Equality only | PostgreSQL, MySQL MEMORY |
| GIN / full-text | Arrays, JSONB, text search | PostgreSQL, MySQL `FULLTEXT`, SQLite FTS5 |
| GiST / R-tree / spatial | Geometry, ranges, nearest neighbour | PostgreSQL, MySQL, SQLite R\*Tree |
| BRIN | Huge, naturally ordered tables (time series) | PostgreSQL |
| Bitmap | Low-cardinality columns in warehouses | Oracle |

# Clustered vs non-clustered

> [!NOTE] Clustered index
>
> The table rows themselves are stored in index order — one per table. InnoDB and SQL Server cluster on the primary key; SQLite tables are clustered on `rowid`.

> [!NOTE] Non-clustered (secondary)
>
> A separate structure of key + pointer (row id or primary key) back to the table. Many per table; a lookup may need an extra hop to fetch the row.

# The cost side

- Every `INSERT`, `DELETE` and indexed-column `UPDATE` must update every index — write-heavy tables should have few.
- Indexes take disk and memory (buffer cache).
- Low-selectivity columns (`status` with 4 values, booleans) rarely benefit alone — the planner prefers a scan when a large fraction of rows match.
- Unused and duplicate indexes (`(a)` next to `(a, b)`) are pure cost; drop them.

```question
How does an index speed up a query?

---

It keeps column values sorted in a B-tree with pointers to rows, so the engine can binary-search to the matching keys in O(log n) page reads instead of scanning all rows, and can return rows already sorted for `ORDER BY`. The price is extra storage and slower writes.
```

```question
Why might a query not use an index?

---

The predicate doesn't match the index (function on the column, leading wildcard, implicit type conversion, not the leftmost column of a composite index), `OR` across different columns, low selectivity so a scan is cheaper, stale statistics, or a tiny table.
```

```question
Clustered vs non-clustered index?

---

A clustered index defines the physical order of the table's rows (only one per table, usually the primary key). A non-clustered index is a separate structure with keys and row locators; a table can have many.
```
