---
id: fc378a1c-3ead-7a72-b259-0b8a3df6074e
key: topic:sql/data-types
subject: sql
topic: data-types
title: Data Types
slug: data-types
order: 1
---

Every column has a type that decides what it can hold, how much space it takes and how it compares and sorts. Choose the narrowest type that fits the data <em>forever</em>.

# Standard SQL types

| Category | Types | Use for | Notes |
| --- | --- | --- | --- |
| Integer | `SMALLINT`, `INT`, `BIGINT` | Counts, ids, quantities | 2 / 4 / 8 bytes; `INT` max ≈ 2.1 billion |
| Exact decimal | `DECIMAL(p, s)` / `NUMERIC(p, s)` | <strong>Money</strong>, rates | `DECIMAL(10,2)` = 8 digits before the point, 2 after; no rounding errors |
| Approximate | `REAL`, `FLOAT`, `DOUBLE PRECISION` | Measurements, science | Binary floating point — `0.1 + 0.2 ≠ 0.3` |
| Fixed text | `CHAR(n)` | Codes of fixed length (`'IN'`, `'USD'`) | Padded with spaces to `n` |
| Variable text | `VARCHAR(n)`, `TEXT` | Names, emails, descriptions | Stores only what is used (+1–2 bytes length) |
| Date &amp; time | `DATE`, `TIME`, `TIMESTAMP`, `TIMESTAMPTZ`, `INTERVAL` | Events, birthdays | Store UTC; use `TIMESTAMP WITH TIME ZONE` where available |
| Boolean | `BOOLEAN` | Flags | MySQL: `TINYINT(1)`; SQL Server: `BIT` |
| Binary | `BLOB`, `BYTEA`, `VARBINARY` | Files, hashes | Large files usually belong in object storage, not the DB |
| Other | `UUID`, `JSON`/`JSONB`, `ENUM`, arrays | Engine-specific | PostgreSQL is richest here |

# CHAR vs VARCHAR

> [!NOTE] CHAR(10)
>
> Always 10 characters — `'abc'` is stored as `'abc'` + 7 spaces. Slightly faster for truly fixed-length values (country codes, hashes).

> [!NOTE] VARCHAR(10)
>
> Up to 10 characters, stores only the actual length plus a small length prefix. The default choice for text.

# Money: DECIMAL, never FLOAT

```sql filename:SQL
SELECT 0.1 + 0.2        AS float_sum,
       0.1 + 0.2 = 0.3  AS is_equal;
```

```text filename:Output
float_sum           | is_equal
--------------------+---------
0.30000000000000004 | 0
```

Floating-point numbers are binary fractions, so decimal values like 0.1 are approximated. `DECIMAL(p, s)` stores exact base-10 digits — use it (or integer paise/cents, as the sample database does) for money.

# SQLite: types belong to values

Most engines reject a value that doesn't fit the column type. SQLite uses <strong>type affinity</strong>: the column <em>prefers</em> a type and converts when it can, but otherwise stores what it is given. `typeof()` shows the stored type.

```sql filename:SQL
SELECT typeof(42), typeof(4.2), typeof('42'), typeof(NULL), typeof(x'CAFE');

CREATE TABLE loose (n INTEGER);
INSERT INTO loose VALUES (7), ('123'), ('abc');
SELECT n, typeof(n) FROM loose ORDER BY rowid;
```

```text filename:Output
typeof(42) | typeof(4.2) | typeof('42') | typeof(NULL) | typeof(x'CAFE')
-----------+-------------+--------------+--------------+----------------
integer    | real        | text         | null         | blob

n   | typeof(n)
----+----------
7   | integer
123 | integer
abc | text
```

`'123'` was converted to an integer, but `'abc'` was stored as text in an `INTEGER` column. A `STRICT` table (SQLite 3.37+) behaves like other databases:

```sql filename:SQL
CREATE TABLE strict_t (n INTEGER) STRICT;
INSERT INTO strict_t VALUES ('abc');
```

```text filename:Error
cannot store TEXT value in INTEGER column strict_t.n
```

> [!WARNING] SQLite
>
> SQLite has no separate `DATE`/`BOOLEAN` storage: dates are stored as ISO-8601 text (`'2024-03-15'`) or numbers, booleans as `0`/`1`. That is why the sample database uses `TEXT` for dates — ISO strings sort and compare correctly.

# Choosing types

> [!TIP] Do
>
> Pick the smallest correct type (`INT` over `BIGINT` if it can never exceed 2 billion), `DECIMAL` for money, `DATE`/`TIMESTAMP` for time, and the same type on both sides of a foreign key.

> [!DANGER] Avoid
>
> Store dates or numbers as free text in a real engine, use `FLOAT` for money, or give every text column `VARCHAR(255)` without thinking about the real limit.

```question
What is the difference between DECIMAL and FLOAT?

---

`DECIMAL(p,s)` is exact base-10 arithmetic with fixed precision — right for money. `FLOAT`/`DOUBLE` are approximate binary floating point: faster and with a huge range, but `0.1 + 0.2` is not exactly `0.3`, so sums of prices drift.
```

```question
What is the difference between VARCHAR and TEXT?

---

In PostgreSQL they are the same storage; `VARCHAR(n)` just adds a length check. In MySQL, `TEXT` columns are stored off-page and have indexing restrictions (need a prefix length) and no default value, so `VARCHAR(n)` is preferred for short strings.
```
