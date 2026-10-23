---
id: 089d38c1-8413-7f74-acee-3431fe5376b0
key: topic:sql/limit-pagination
subject: sql
topic: limit-pagination
title: LIMIT, OFFSET & Pagination
slug: limit-offset-pagination
order: 1
---

`LIMIT` caps the number of rows returned; `OFFSET` skips rows first. Together they page through results — but deep offsets get slow.

# Top-N

```sql filename:SQL
SELECT name, salary FROM employees
ORDER BY salary DESC, emp_id
LIMIT 3;
```

```text filename:Output
name  | salary
------+-------
Asha  | 150000
Ravi  | 120000
Priya | 110000
```

> [!WARNING] Watch out
>
> `LIMIT` without `ORDER BY` returns an <em>arbitrary</em> 3 rows. And when the sort key has ties (Meera and Karan both 95000), add a unique tie-breaker (`emp_id`) so pages are stable.

# Offset pagination

```sql filename:SQL
-- page 2, page size 3 → OFFSET = (page - 1) * size
SELECT emp_id, name FROM employees
ORDER BY emp_id
LIMIT 3 OFFSET 3;
```

```text filename:Output
emp_id | name
-------+------
4      | Karan
5      | Priya
6      | Arjun
```

| Engine | Page 2 of size 3 |
| --- | --- |
| SQLite, PostgreSQL, MySQL | `LIMIT 3 OFFSET 3` (MySQL also `LIMIT 3, 3` — offset first!) |
| SQL Server 2012+ | `ORDER BY emp_id OFFSET 3 ROWS FETCH NEXT 3 ROWS ONLY` |
| Oracle 12c+ / standard | `OFFSET 3 ROWS FETCH NEXT 3 ROWS ONLY` |
| Old Oracle | `WHERE ROWNUM <= n` in a nested query |

# Keyset (seek) pagination

`OFFSET 100000` still reads and throws away 100 000 rows, and rows inserted between requests shift pages (duplicates / gaps). <strong>Keyset pagination</strong> remembers the last key seen and seeks past it using the index.

```sql filename:SQL
-- the client got page 1 ending at emp_id = 3; next page:
SELECT emp_id, name FROM employees
WHERE emp_id > 3
ORDER BY emp_id
LIMIT 3;
```

```text filename:Output
emp_id | name
-------+------
4      | Karan
5      | Priya
6      | Arjun
```

```sql filename:SQL
-- sorted by a non-unique column: seek on (salary, emp_id) together; last row seen was Meera (95000, 3)
SELECT emp_id, name, salary FROM employees
WHERE (salary, emp_id) < (95000, 3)
ORDER BY salary DESC, emp_id DESC
LIMIT 3;
```

```text filename:Output
emp_id | name   | salary
-------+--------+-------
9      | Sara   | 85000
8      | Vikram | 80000
7      | Neha   | 72000
```

> [!NOTE] Offset pagination
>
> Simple, allows jumping to page N. Cost grows with the offset; unstable when data changes.

> [!NOTE] Keyset pagination
>
> Constant speed on any page, stable under inserts. No random page jumps — ideal for infinite scroll and APIs (`?after=…`).

```question
Why is OFFSET pagination slow for large page numbers?

---

The database must produce and discard every row before the offset — `OFFSET 1000000` reads a million rows to return 20. Keyset pagination (`WHERE key > :last ORDER BY key LIMIT 20`) jumps straight to the starting point through the index.
```
