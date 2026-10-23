---
id: 685ce0d3-8c83-7871-9fa6-3c0f4cce6f70
key: topic:sql/denormalization
subject: sql
topic: denormalization
title: Denormalization & OLTP vs OLAP
slug: denormalization-oltp-vs-olap
order: 1
---

Denormalization deliberately re-introduces redundancy to make reads faster or simpler — trading write complexity and consistency risk for fewer joins.

# Common techniques

| Technique | Example | Kept in sync by |
| --- | --- | --- |
| Stored aggregate | `customers.lifetime_value`, `posts.comment_count` | Trigger, application code, batch job |
| Duplicated column | `orders.customer_city` copied from customers | Trigger / app |
| Snapshot of a value at a time | `order_items.unit_price` (price <em>when bought</em>) | Written once — not really redundancy |
| Pre-joined reporting table | One wide `sales_fact` row per order line | ETL / materialised view |
| Materialised view | `monthly_revenue` | `REFRESH` |

> [!NOTE] Key point
>
> `order_items.unit_price` looks redundant with `products.price` but isn't: it records a <em>different fact</em> (the price paid on that day). Order 106 paid 52000 while the list price is 55000.

```sql filename:SQL
SELECT oi.order_id, p.name, p.price AS list_price, oi.unit_price AS paid
FROM order_items oi JOIN products p ON p.product_id = oi.product_id
WHERE p.name = 'Laptop'
ORDER BY oi.order_id;
```

```text filename:Output
order_id | name   | list_price | paid
---------+--------+------------+------
101      | Laptop | 55000      | 55000
106      | Laptop | 55000      | 52000
```

# OLTP vs OLAP

|  | OLTP (transactions) | OLAP (analytics) |
| --- | --- | --- |
| Workload | Many small reads/writes by key | Few huge scans and aggregations |
| Schema | Normalised (3NF) | Denormalised <strong>star / snowflake</strong> schema |
| Examples | PostgreSQL, MySQL, SQL Server for the app | Snowflake, BigQuery, Redshift, ClickHouse, DuckDB |
| Storage | Row-oriented | Column-oriented, compressed |
| Freshness | Real time | Loaded by ETL/ELT (minutes–hours) |

# Star schema

A central <strong>fact table</strong> of measurable events (`sales_fact`: quantity, amount) with foreign keys to <strong>dimension tables</strong> describing them (`dim_date`, `dim_customer`, `dim_product`). Dimensions are wide and denormalised, so queries need one join per dimension.

```sql filename:SQL
CREATE TABLE sales_fact AS
SELECT o.order_date AS date_key, o.customer_id, oi.product_id,
       oi.quantity, oi.quantity * oi.unit_price AS amount
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status <> 'cancelled';

SELECT p.category, c.city, SUM(f.amount) AS revenue
FROM sales_fact f
JOIN products  p ON p.product_id  = f.product_id
JOIN customers c ON c.customer_id = f.customer_id
GROUP BY p.category, c.city
ORDER BY revenue DESC;
```

```text filename:Output
category    | city      | revenue
------------+-----------+--------
Electronics | Mumbai    | 60000
Electronics | Delhi     | 52000
Furniture   | Bengaluru | 12500
Furniture   | Delhi     | 9000
Furniture   | Mumbai    | 8000
Stationery  | Bengaluru | 1200
Stationery  | Mumbai    | 400
Stationery  | Delhi     | 200
```

> [!TIP] Do
>
> Normalise first; denormalise a specific hot path after measuring, with a clear owner of the sync logic (trigger, job, or materialised view).

> [!DANGER] Avoid
>
> Denormalise “for speed” up front — you pay forever in inconsistent data and complex writes.

```question
When would you denormalize?

---

When a read path is hot and joins/aggregations are measurably too slow even with good indexes, for reporting/analytics (star schemas), or to cache expensive aggregates (counters). Accept the cost: extra storage, slower writes and code/triggers to keep copies consistent.
```

```question
What is a star schema?

---

A data-warehouse design with one central fact table (numeric measures + foreign keys) surrounded by denormalised dimension tables (date, customer, product, store). Snowflake schema = the dimensions are further normalised into sub-dimensions.
```
