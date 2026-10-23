---
id: bf88a060-a196-773d-9cf9-b8c2c1af5cf7
key: topic:sql/normalization
subject: sql
topic: normalization
title: Normalization (1NF → BCNF)
slug: normalization-1nf-bcnf
order: 1
---

Normalization organises columns into tables so that <strong>each fact is stored once</strong>. It removes update, insert and delete anomalies caused by redundancy.

> [!INFO]
>
> <strong>Functional dependency (A → B)</strong> — the value of A determines the value of B: `emp_id → name`, `customer_name → customer_city`. Normal forms are rules about which dependencies may exist inside one table.

# The problem: a spreadsheet as a table

```sql filename:SQL
SELECT * FROM order_sheet ORDER BY order_id;
```

```text filename:Output
order_id | order_date | customer_name | customer_city | products
---------+------------+---------------+---------------+-------------------
101      | 2024-01-05 | Ananya        | Mumbai        | Laptop, Headphones
102      | 2024-01-12 | Rahul         | Delhi         | Chair, Pen
103      | 2024-02-03 | Ananya        | Mumbai        | Notebook, Pen
```

| Anomaly | In this sheet |
| --- | --- |
| <strong>Update</strong> | Ananya moves city → must update several rows; miss one and data disagrees |
| <strong>Insert</strong> | Can't record a new customer until they place an order |
| <strong>Delete</strong> | Delete Rahul's only order → we forget Rahul exists |
| <strong>Query pain</strong> | “How many orders include a Pen?” needs string matching on `products` |

# 1NF — atomic values, no repeating groups

Every cell holds one value; no lists, no `phone1`/`phone2`/`phone3` columns; each row is unique (has a key).

```sql filename:SQL
-- split the list into one row per product (key: order_id + product)
WITH RECURSIVE split(order_id, order_date, customer_name, customer_city, product, rest) AS (
    SELECT order_id, order_date, customer_name, customer_city, '', products || ','
    FROM order_sheet
    UNION ALL
    SELECT order_id, order_date, customer_name, customer_city,
           trim(substr(rest, 1, instr(rest, ',') - 1)),
           substr(rest, instr(rest, ',') + 1)
    FROM split WHERE rest <> ''
)
SELECT order_id, order_date, customer_name, customer_city, product
FROM split WHERE product <> ''
ORDER BY order_id, product;
```

```text filename:Output
order_id | order_date | customer_name | customer_city | product
---------+------------+---------------+---------------+-----------
101      | 2024-01-05 | Ananya        | Mumbai        | Headphones
101      | 2024-01-05 | Ananya        | Mumbai        | Laptop
102      | 2024-01-12 | Rahul         | Delhi         | Chair
102      | 2024-01-12 | Rahul         | Delhi         | Pen
103      | 2024-02-03 | Ananya        | Mumbai        | Notebook
103      | 2024-02-03 | Ananya        | Mumbai        | Pen
```

# 2NF — no partial dependencies

Applies when the key is <strong>composite</strong>. Every non-key column must depend on the <em>whole</em> key. Here the key is `(order_id, product)`, but `order_date`, `customer_name`, `customer_city` depend on `order_id` alone → move them to an `orders` table. The line table keeps only `(order_id, product, quantity…)`.

# 3NF — no transitive dependencies

Non-key columns must depend on <strong>the key, the whole key, and nothing but the key</strong>. In `orders(order_id, order_date, customer_name, customer_city)`, `order_id → customer_name → customer_city`: city depends on the customer, not the order → move customers to their own table and keep `customer_id` in `orders`.

order\_sheet → 1NF: one product per row → 2NF: orders + order\_items → 3NF: customers + orders + order\_items + products

That final shape is exactly the sample database: `customers`, `orders`, `order_items`, `products`.

# BCNF — every determinant is a candidate key

A stricter 3NF. Classic case: `teaching(student, course, instructor)` where each instructor teaches exactly one course (`instructor → course`) and a student takes a course from one instructor. Key: `(student, course)`. `instructor → course` has a determinant that is not a candidate key → split into `instructor_course(instructor, course)` and `student_instructor(student, instructor)`.

```sql filename:SQL
CREATE TABLE teaching (student TEXT, course TEXT, instructor TEXT, PRIMARY KEY (student, course));
INSERT INTO teaching VALUES
    ('Asha', 'SQL', 'Dr. Rao'), ('Ravi', 'SQL', 'Dr. Rao'),
    ('Asha', 'Python', 'Dr. Iyer'), ('Meera', 'SQL', 'Dr. Sen');

-- the fact "Dr. Rao teaches SQL" is stored twice: redundancy BCNF removes
SELECT instructor, course, COUNT(*) AS times_stored
FROM teaching GROUP BY instructor, course ORDER BY instructor;
```

```text filename:Output
instructor | course | times_stored
-----------+--------+-------------
Dr. Iyer   | Python | 1
Dr. Rao    | SQL    | 2
Dr. Sen    | SQL    | 1
```

# Summary

| Form | Rule | Removes |
| --- | --- | --- |
| 1NF | Atomic values, no repeating groups, a key exists | Lists in cells |
| 2NF | 1NF + no non-key column depends on part of a composite key | Partial dependencies |
| 3NF | 2NF + no non-key column depends on another non-key column | Transitive dependencies |
| BCNF | For every dependency X → Y, X is a super key | Remaining anomalies from overlapping candidate keys |
| 4NF / 5NF | No independent multi-valued / join dependencies | Rare in practice |

> [!NOTE] Key point
>
> Most OLTP schemas aim for <strong>3NF/BCNF</strong>. Going further is rarely needed; going less far should be a deliberate choice (denormalization).

```question
What is normalization and why is it needed?

---

The process of structuring tables so each fact is stored once, using normal forms (1NF, 2NF, 3NF, BCNF) based on functional dependencies. It prevents update/insert/delete anomalies, saves space and keeps data consistent; the cost is more tables and joins.
```

```question
What is the difference between 3NF and BCNF?

---

3NF allows a dependency X → Y where Y is part of a candidate key (a <em>prime</em> attribute) even if X isn't a key. BCNF forbids it: the left side of every non-trivial dependency must be a super key. They differ only when a table has overlapping composite candidate keys.
```
