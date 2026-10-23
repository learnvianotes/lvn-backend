---
id: 89406e12-fe67-71ae-acf2-a692bde5f680
key: topic:sql/query-optimization
subject: sql
topic: query-optimization
title: Query Optimization
slug: query-optimization
order: 1
---

Most slow queries are fixed by the same handful of habits: read the plan, give the optimizer usable indexes and <em>sargable</em> predicates, and fetch less data.

> [!INFO]
>
> <strong>Sargable</strong> — “Search ARGument ABLE” — a predicate the engine can answer with an index seek: the indexed column stands alone on one side of the comparison (`col >= X`), not wrapped in a function or expression.

# 1. Keep indexed columns bare

```sql filename:SQL
CREATE INDEX idx_events_created ON events (created_at);

EXPLAIN QUERY PLAN SELECT COUNT(*) FROM events WHERE strftime('%m', created_at) = '03';
EXPLAIN QUERY PLAN SELECT COUNT(*) FROM events WHERE created_at >= '2024-03-01' AND created_at < '2024-04-01';
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+----------------------------------------------------
3  | 0      | 213     | SCAN events USING COVERING INDEX idx_events_created

id | parent | notused | detail
---+--------+---------+--------------------------------------------------------------------------------------
3  | 0      | 153     | SEARCH events USING COVERING INDEX idx_events_created (created_at>? AND created_at<?)
```

Wrapped in `strftime`, every one of the 5 000 index entries has to be read and tested (<strong>SCAN</strong>). The bare-column range <strong>SEARCH</strong>es straight to March and reads only those entries.

| Non-sargable | Sargable rewrite |
| --- | --- |
| `WHERE YEAR(order_date) = 2024` | `WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'` |
| `WHERE salary * 12 > 1200000` | `WHERE salary > 100000` |
| `WHERE lower(email) = 'x@y.in'` | Store normalised, or index `lower(email)` |
| `WHERE name LIKE '%son'` | Full-text / trigram index, or reverse-string column |
| `WHERE phone = 9876543210` (text column) | `WHERE phone = '9876543210'` — avoid implicit casts |

# 2. Fetch less

- Select only needed columns — enables covering indexes and reduces I/O and network.
- Filter early in `WHERE` (not `HAVING`) and paginate with keyset pagination instead of big `OFFSET`s.
- Use `EXISTS` for existence checks instead of `COUNT(*) > 0` or `JOIN … DISTINCT`.
- Use `UNION ALL` instead of `UNION` when duplicates are impossible.

# 3. Avoid row-by-row work

> [!TIP] Do
>
> One set-based statement: `UPDATE … WHERE id IN (…)`, `INSERT … SELECT`, window functions instead of correlated subqueries.

> [!DANGER] Avoid
>
> The <strong>N+1 query</strong> pattern: fetch 100 orders, then run one query per order for its items (101 round trips). Fetch with a join or `WHERE order_id IN (…)`.

# 4. Help the planner

- Keep statistics fresh: `ANALYZE` (PostgreSQL, SQLite), `ANALYZE TABLE` (MySQL), `UPDATE STATISTICS` (SQL Server).
- Index foreign-key columns used in joins (`order_items.product_id`) — the PK side is indexed automatically, the FK side usually is not.
- Match data types on join columns (`INT` = `INT`, not `INT` = `VARCHAR`).
- Break monster queries into CTEs/temp tables when the planner mis-estimates.

# A tuning workflow

1. <strong>Measure</strong>

   Find the slow query (slow query log, `pg_stat_statements`, APM). Optimise what is actually slow and frequent.

2. <strong>Read the plan</strong>

   Look for full scans on big tables, huge row estimates vs actuals, temp B-trees for sorts, nested loops over large inputs.

3. <strong>Fix the cause</strong>

   Add/adjust an index, make predicates sargable, rewrite the query, reduce columns/rows.

4. <strong>Verify</strong>

   Re-run `EXPLAIN ANALYZE`, and check write overhead of any new index.

Example: <em>events of the user named user42</em>. `events` (5 000 rows) is the “many” side of the join, and its `user_id` column has no index yet:

```sql filename:SQL
EXPLAIN QUERY PLAN
SELECT u.name, e.kind, e.created_at
FROM users u JOIN events e ON e.user_id = u.user_id
WHERE u.name = 'user42';
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+---------------------------------------------
3  | 0      | 216     | SCAN e
5  | 0      | 45      | SEARCH u USING INTEGER PRIMARY KEY (rowid=?)
```

The only way in is to scan all 5 000 events and look up each one's user. Index the foreign-key column and the plan flips: scan the small `users` table and seek into `events`.

```sql filename:SQL
CREATE INDEX idx_events_user ON events (user_id);

EXPLAIN QUERY PLAN
SELECT u.name, e.kind, e.created_at
FROM users u JOIN events e ON e.user_id = u.user_id
WHERE u.name = 'user42';
```

```text filename:Output
id | parent | notused | detail
---+--------+---------+-------------------------------------------------
4  | 0      | 216     | SCAN u
8  | 0      | 61      | SEARCH e USING INDEX idx_events_user (user_id=?)
```

```question
How would you optimise a slow SQL query?

---

Reproduce and measure it; read `EXPLAIN (ANALYZE)`; look for full scans, bad row estimates and expensive sorts; add or fix indexes (composite in the right order, covering), make predicates sargable, remove `SELECT *`, replace correlated subqueries/N+1 patterns with joins or window functions, paginate with keysets, refresh statistics — then verify the plan and the write cost.
```
