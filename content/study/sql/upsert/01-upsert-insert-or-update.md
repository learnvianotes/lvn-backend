---
id: b9fd592c-ec97-797e-87b4-1893e9204046
key: topic:sql/upsert
subject: sql
topic: upsert
title: "UPSERT: Insert or Update"
slug: upsert-insert-or-update
order: 1
---

An <em>upsert</em> inserts a row, or updates it if a row with the same key already exists — atomically, in one statement, without a race between “check” and “write”.

# INSERT … ON CONFLICT (PostgreSQL, SQLite)

```sql filename:SQL
CREATE TABLE inventory (
    sku        TEXT PRIMARY KEY,
    qty        INTEGER NOT NULL,
    updated_on TEXT NOT NULL
);
INSERT INTO inventory VALUES ('PEN', 100, '2024-03-01'), ('DESK', 5, '2024-03-01');

INSERT INTO inventory (sku, qty, updated_on) VALUES
    ('PEN',   50, '2024-03-10'),      -- exists  → add to stock
    ('CHAIR', 12, '2024-03-10')       -- new     → insert
ON CONFLICT (sku) DO UPDATE
    SET qty        = inventory.qty + excluded.qty,
        updated_on = excluded.updated_on;

SELECT * FROM inventory ORDER BY sku;
```

```text filename:Output
sku   | qty | updated_on
------+-----+-----------
CHAIR | 12  | 2024-03-10
DESK  | 5   | 2024-03-01
PEN   | 150 | 2024-03-10
```

`excluded` is the row that <em>would</em> have been inserted; `inventory.qty` is the existing row. `ON CONFLICT (sku) DO NOTHING` simply skips duplicates.

# Other dialects

```sql filename:MySQL
INSERT INTO inventory (sku, qty, updated_on) VALUES ('PEN', 50, '2024-03-10')
ON DUPLICATE KEY UPDATE
    qty = qty + VALUES(qty),          -- MySQL 8.0.20+: prefer an alias, e.g. AS new … new.qty
    updated_on = VALUES(updated_on);
```

```sql filename:SQL%20Server%20%2F%20Oracle%20%2F%20PostgreSQL%2015%2B%20(MERGE)
MERGE INTO inventory AS t
USING (VALUES ('PEN', 50, '2024-03-10')) AS s (sku, qty, updated_on)
    ON t.sku = s.sku
WHEN MATCHED THEN
    UPDATE SET qty = t.qty + s.qty, updated_on = s.updated_on
WHEN NOT MATCHED THEN
    INSERT (sku, qty, updated_on) VALUES (s.sku, s.qty, s.updated_on);
```

# The REPLACE trap

SQLite's `INSERT OR REPLACE` (and MySQL's `REPLACE`) <strong>deletes</strong> the old row and inserts a new one — columns you did not supply fall back to defaults.

```sql filename:SQL
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, plan TEXT DEFAULT 'free');
INSERT INTO users VALUES (1, 'Asha', 'premium');

INSERT OR REPLACE INTO users (id, name) VALUES (1, 'Asha R');   -- plan is lost!
SELECT * FROM users;
```

```text filename:Output
id | name   | plan
---+--------+-----
1  | Asha R | free
```

> [!WARNING] Watch out
>
> `REPLACE` also fires delete triggers and can cascade-delete child rows. Prefer `ON CONFLICT … DO UPDATE` / `ON DUPLICATE KEY UPDATE`, which update in place.

> [!WARNING] Race condition
>
> “`SELECT` then `INSERT` or `UPDATE`” in application code is a race: two requests can both see “not found” and both insert. Upsert statements (or a unique constraint plus retry) make it atomic.

```question
How do you implement an upsert?

---

Put a `UNIQUE`/`PRIMARY KEY` on the natural key, then use the engine's atomic form: `INSERT … ON CONFLICT (key) DO UPDATE SET … = excluded.…` (PostgreSQL/SQLite), `INSERT … ON DUPLICATE KEY UPDATE` (MySQL), or `MERGE` (SQL Server/Oracle/PostgreSQL 15+). The conflict target must be backed by a unique index.
```
