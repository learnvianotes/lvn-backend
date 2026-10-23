---
id: 517bbde6-844e-7c13-9d61-56223645393a
key: topic:sql/logical-order
subject: sql
topic: logical-order
title: Logical Order of Query Execution
slug: logical-order-of-query-execution
order: 1
---

You <em>write</em> `SELECT` first, but the database <em>evaluates</em> it almost last. This single fact explains most “why can't I use that here?” errors.

FROM / JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT

1. <strong>FROM + JOINs</strong>

   Build the working set of rows from the tables.

2. <strong>WHERE</strong>

   Keep rows whose condition is true. Aggregates don't exist yet.

3. <strong>GROUP BY</strong>

   Collapse rows into one row per group.

4. <strong>HAVING</strong>

   Keep groups whose condition is true — aggregates are available now.

5. <strong>SELECT</strong>

   Compute output expressions, window functions and aliases.

6. <strong>DISTINCT</strong>

   Remove duplicate output rows.

7. <strong>ORDER BY</strong>

   Sort — can use aliases, since `SELECT` already ran.

8. <strong>LIMIT / OFFSET</strong>

   Cut the sorted result.

# Consequences

| You try | Result | Why |
| --- | --- | --- |
| `WHERE monthly > 9000` (alias) | Error in standard SQL | `WHERE` runs before `SELECT` creates the alias |
| `WHERE COUNT(*) > 2` | Error everywhere | Aggregates don't exist before `GROUP BY` — use `HAVING` |
| `ORDER BY monthly` | Works | `ORDER BY` runs after `SELECT` |
| `WHERE ROW_NUMBER() OVER (…) = 1` | Error | Window functions are computed in `SELECT` — filter in an outer query / CTE |

```sql filename:SQL
SELECT dept_id, COUNT(*) AS headcount
FROM employees
WHERE COUNT(*) > 2
GROUP BY dept_id;
```

```text filename:Error
misuse of aggregate: COUNT()
```

```sql filename:SQL
SELECT dept_id, COUNT(*) AS headcount
FROM employees
WHERE dept_id IS NOT NULL           -- row filter: before grouping
GROUP BY dept_id
HAVING COUNT(*) > 2                 -- group filter: after grouping
ORDER BY headcount DESC;            -- alias is fine here
```

```text filename:Output
dept_id | headcount
--------+----------
1       | 4
2       | 3
```

```sql filename:SQL
-- to filter on a computed column, compute it in a subquery / CTE first
SELECT name, monthly
FROM (SELECT name, salary / 12 AS monthly FROM employees) AS t
WHERE monthly > 9000
ORDER BY monthly DESC;
```

```text filename:Output
name  | monthly
------+--------
Asha  | 12500
Ravi  | 10000
Priya | 9166
```

> [!NOTE] Key point
>
> This is the <strong>logical</strong> order — it defines what a query means. The optimizer is free to execute it physically in any order that gives the same result (for example, pushing a filter into an index lookup).

```question
What is the order of execution of a SQL query?

---

`FROM`/`JOIN` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` (incl. window functions) → `DISTINCT` → `ORDER BY` → `LIMIT`/`OFFSET`. That is why `WHERE` can't see aggregates or select-list aliases, and `ORDER BY` can.
```
