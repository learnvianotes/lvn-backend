---
id: fb5e1af1-3afe-7236-8641-a74200541746
key: topic:sql/keys
subject: sql
topic: keys
title: "Keys: Super, Candidate, Primary, Foreign"
slug: keys-super-candidate-primary-foreign
order: 1
---

Keys identify rows and link tables. Interviewers love the vocabulary — and the choice between natural and surrogate keys matters in every real schema.

| Key | Definition | In `employees` |
| --- | --- | --- |
| <strong>Super key</strong> | Any set of columns that uniquely identifies a row | `{emp_id}`, `{email}`, `{emp_id, name}`, … |
| <strong>Candidate key</strong> | A <em>minimal</em> super key — remove any column and it is no longer unique | `{emp_id}`, `{email}` (if always present) |
| <strong>Primary key</strong> | The candidate key chosen as the row's identity; unique and not null | `emp_id` |
| <strong>Alternate key</strong> | A candidate key not chosen as primary (usually enforced with `UNIQUE`) | `email` |
| <strong>Foreign key</strong> | Column(s) referencing a key of another (or the same) table | `dept_id`, `manager_id` |
| <strong>Composite key</strong> | A key made of two or more columns | `order_items (order_id, product_id)` |
| <strong>Surrogate key</strong> | A meaningless generated id (auto-increment, UUID) | `emp_id` |
| <strong>Natural key</strong> | A key with business meaning | email, PAN number, ISBN |

Super keys → minimal → Candidate keys → chosen → Primary key → others → Alternate keys

# Composite primary key

```sql filename:SQL
-- one row per (order, product): the pair is unique, neither column alone is
SELECT order_id, product_id, quantity FROM order_items WHERE order_id = 101 ORDER BY product_id;
```

```text filename:Output
order_id | product_id | quantity
---------+------------+---------
101      | 1          | 1
101      | 2          | 1
```

```sql filename:SQL
INSERT INTO order_items VALUES (101, 1, 3, 55000);    -- same pair again
```

```text filename:Error
UNIQUE constraint failed: order_items.order_id, order_items.product_id
```

# Natural vs surrogate keys

> [!NOTE] Surrogate (id)
>
> Stable (never changes), compact integer joins, no business meaning to leak. Needs a separate `UNIQUE` on the natural key to stop duplicates.

> [!NOTE] Natural (email, ISBN)
>
> Meaningful, no extra column, prevents duplicates by itself. But real-world “unique” values change (emails, phone numbers) or turn out not unique, and wide keys make every foreign key wide.

> [!TIP] Do
>
> Common practice: a surrogate primary key <strong>plus</strong> `UNIQUE` constraints on the natural candidate keys. Composite natural keys are fine for pure junction tables (`order_items`).

```sql filename:PostgreSQL
-- UUIDs: globally unique, generated anywhere (useful across services / offline clients)
CREATE TABLE sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id INT NOT NULL);
-- prefer time-ordered UUIDv7 for B-tree friendliness (random v4 keys scatter inserts)
```

```question
What is the difference between a primary key and a candidate key?

---

A candidate key is any minimal set of columns that uniquely identifies rows; a table can have several. The primary key is the one candidate key you choose as the table's official identifier (not null, referenced by foreign keys). The others become alternate keys with `UNIQUE` constraints.
```

```question
Can a table have no primary key?

---

Technically yes in most engines (a <em>heap</em>), but it is almost always a mistake: duplicates can't be prevented or targeted, replication and ORMs struggle, and InnoDB creates a hidden one anyway. Every table should have a primary key.
```
