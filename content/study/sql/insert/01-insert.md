---
id: e09145be-e486-7236-9d7c-1d96f0233570
key: topic:sql/insert
subject: sql
topic: insert
title: INSERT
slug: insert
order: 1
---

`INSERT` adds rows — one at a time, many at once, or straight from a query.

# Basic forms

```sql filename:SQL
-- always name the columns: robust to column order and future new columns
INSERT INTO customers (customer_id, name, city, signup_date)
VALUES (6, 'Farhan', 'Pune', '2024-04-02');

-- several rows in one statement (one round trip, one transaction)
INSERT INTO customers (customer_id, name, city, signup_date) VALUES
    (7, 'Divya', 'Chennai', '2024-04-05'),
    (8, 'Gautam', NULL,     '2024-04-07');

SELECT * FROM customers WHERE customer_id >= 6 ORDER BY customer_id;
```

```text filename:Output
customer_id | name   | city    | signup_date
------------+--------+---------+------------
6           | Farhan | Pune    | 2024-04-02
7           | Divya  | Chennai | 2024-04-05
8           | Gautam | NULL    | 2024-04-07
```

# Auto-generated keys and DEFAULTs

Omit the key column and the database generates it. In SQLite an `INTEGER PRIMARY KEY` auto-assigns <em>max + 1</em>; `RETURNING` hands back the generated values without a second query.

```sql filename:SQL
INSERT INTO products (name, category, price)
VALUES ('Keyboard', 'Electronics', 1800)
RETURNING product_id, name;
```

```text filename:Output
product_id | name
-----------+---------
8          | Keyboard
```

| Engine | Get the new id |
| --- | --- |
| PostgreSQL, SQLite 3.35+ | `INSERT … RETURNING id` |
| SQL Server | `INSERT … OUTPUT inserted.id VALUES …` or `SCOPE_IDENTITY()` |
| MySQL | `SELECT LAST_INSERT_ID()` after the insert |
| Oracle | `RETURNING id INTO :v` (PL/SQL) |

# INSERT … SELECT

Copy rows produced by any query — no `VALUES` keyword.

```sql filename:SQL
CREATE TABLE vip_customers (customer_id INTEGER PRIMARY KEY, name TEXT, total_spent INTEGER);

INSERT INTO vip_customers (customer_id, name, total_spent)
SELECT c.customer_id, c.name, SUM(oi.quantity * oi.unit_price)
FROM customers c
JOIN orders o       ON o.customer_id = c.customer_id
JOIN order_items oi ON oi.order_id   = o.order_id
WHERE o.status <> 'cancelled'
GROUP BY c.customer_id, c.name
HAVING SUM(oi.quantity * oi.unit_price) > 50000;

SELECT * FROM vip_customers ORDER BY total_spent DESC;
```

```text filename:Output
customer_id | name   | total_spent
------------+--------+------------
1           | Ananya | 68400
2           | Rahul  | 61200
```

# Skipping rows that would violate a constraint

```sql filename:SQLite
INSERT OR IGNORE INTO departments (dept_id, name, location)
VALUES (1, 'Engineering', 'Bengaluru'), (5, 'Finance', 'Delhi');

SELECT * FROM departments ORDER BY dept_id;
```

```text filename:Output
dept_id | name        | location
--------+-------------+----------
1       | Engineering | Bengaluru
2       | Sales       | Mumbai
3       | HR          | Hyderabad
4       | Marketing   | Pune
5       | Finance     | Delhi
```

```sql filename:MySQL%20%2F%20PostgreSQL
INSERT IGNORE INTO departments (dept_id, name, location) VALUES (5, 'Finance', 'Delhi');          -- MySQL
INSERT INTO departments (dept_id, name, location) VALUES (5, 'Finance', 'Delhi')
ON CONFLICT DO NOTHING;                                                                     -- PostgreSQL
```

> [!WARNING] Watch out
>
> `INSERT INTO t VALUES (…)` without a column list depends on the physical column order — it breaks (or silently puts values in the wrong columns) after an `ALTER TABLE`.

> [!TIP] Do
>
> Batch inserts: one multi-row `INSERT` (or many inserts inside one transaction) is often 10–100× faster than autocommitting each row separately.

```question
How do you insert data from one table into another?

---

`INSERT INTO target (cols…) SELECT cols… FROM source WHERE …;` — the column counts and types must line up. To create the target at the same time use `CREATE TABLE t AS SELECT …` (or `SELECT … INTO t` in SQL Server).
```
