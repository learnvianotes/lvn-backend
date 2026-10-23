---
id: cb2ac186-cdc0-7bb3-bc12-bd36be1d8677
key: topic:sql/set-operations
subject: sql
topic: set-operations
title: UNION, INTERSECT & EXCEPT
slug: union-intersect-except
order: 1
---

Set operators combine the <strong>results of two queries</strong> vertically (more rows), unlike joins which combine tables horizontally (more columns).

| Operator | Returns | Duplicates |
| --- | --- | --- |
| `UNION` | Rows in either query | Removed |
| `UNION ALL` | Rows in either query | Kept (faster — no de-dup step) |
| `INTERSECT` | Rows in both queries | Removed |
| `EXCEPT` (`MINUS` in Oracle) | Rows in the first but not the second | Removed |

Rules: both queries must return the <strong>same number of columns</strong> with compatible types; column names come from the first query; one `ORDER BY` at the very end sorts the combined result.

# UNION vs UNION ALL

```sql filename:SQL
-- cities we have customers or offices in
SELECT city FROM customers WHERE city IS NOT NULL
UNION
SELECT location FROM departments
ORDER BY 1;
```

```text filename:Output
city
---------
Bengaluru
Delhi
Hyderabad
Mumbai
Pune
```

```sql filename:SQL
SELECT city FROM customers WHERE city IS NOT NULL
UNION ALL
SELECT location FROM departments
ORDER BY 1;
```

```text filename:Output
city
---------
Bengaluru
Bengaluru
Delhi
Delhi
Hyderabad
Mumbai
Mumbai
Pune
```

> [!TIP] Do
>
> Use `UNION ALL` unless you actually need duplicates removed — `UNION` has to sort or hash the whole result to de-duplicate.

# INTERSECT and EXCEPT

```sql filename:SQL
-- cities with both a customer and an office
SELECT city FROM customers
INTERSECT
SELECT location FROM departments
ORDER BY 1;

-- office cities with no customers
SELECT location FROM departments
EXCEPT
SELECT city FROM customers
ORDER BY 1;
```

```text filename:Output
city
---------
Bengaluru
Mumbai

location
---------
Hyderabad
Pune
```

> [!NOTE] Key point
>
> Set operators compare `NULL`s as equal (unlike `=`), so `EXCEPT` and `INTERSECT` are also a null-safe way to diff two result sets. MySQL supports `INTERSECT`/`EXCEPT` only since 8.0.31; Oracle calls `EXCEPT` `MINUS`.

# Labelled union: combining different sources

```sql filename:SQL
SELECT 'employee' AS kind, name, dept_id AS ref FROM employees WHERE salary >= 110000
UNION ALL
SELECT 'customer', name, customer_id FROM customers WHERE city = 'Delhi'
ORDER BY kind, name;
```

```text filename:Output
kind     | name  | ref
---------+-------+----
customer | Imran | 4
customer | Rahul | 2
employee | Asha  | 1
employee | Priya | 2
employee | Ravi  | 1
```

# Comparing two tables

```sql filename:SQL
CREATE TABLE prices_old (sku TEXT, price INTEGER);
CREATE TABLE prices_new (sku TEXT, price INTEGER);
INSERT INTO prices_old VALUES ('A', 10), ('B', 20), ('C', 30);
INSERT INTO prices_new VALUES ('A', 10), ('B', 25), ('D', 40);

SELECT 'removed/changed' AS diff, * FROM (SELECT * FROM prices_old EXCEPT SELECT * FROM prices_new)
UNION ALL
SELECT 'added/changed', * FROM (SELECT * FROM prices_new EXCEPT SELECT * FROM prices_old)
ORDER BY sku, diff;
```

```text filename:Output
diff            | sku | price
----------------+-----+------
added/changed   | B   | 25
removed/changed | B   | 20
removed/changed | C   | 30
added/changed   | D   | 40
```

```question
What is the difference between UNION and UNION ALL?

---

`UNION` removes duplicate rows from the combined result (extra sort/hash work); `UNION ALL` keeps every row and is faster. Use `UNION ALL` when the inputs can't overlap or duplicates are wanted.
```

```question
What is the difference between UNION and JOIN?

---

`UNION` stacks the rows of two compatible queries (same columns) — the result has more rows. `JOIN` matches rows of two tables on a condition — the result has more columns.
```
