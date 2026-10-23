---
id: 7c1a5ff7-8774-731c-9cbe-2ba4f69ec707
key: topic:sql/like-patterns
subject: sql
topic: like-patterns
title: LIKE & Pattern Matching
slug: like-pattern-matching
order: 1
---

`LIKE` matches text against a simple pattern with two wildcards; regular expressions are available as dialect extensions.

| Wildcard | Matches | Example | Matches… |
| --- | --- | --- | --- |
| `%` | Any sequence of 0+ characters | `'A%'` | Asha, Arjun |
| `_` | Exactly one character | `'_a%'` | Ravi, Karan, Sara (second letter a) |

```sql filename:SQL
SELECT name FROM employees WHERE name LIKE 'A%'   ORDER BY name;
SELECT name FROM employees WHERE name LIKE '_a%'  ORDER BY name;
SELECT name FROM employees WHERE name LIKE '%an%' ORDER BY name;
```

```text filename:Output
name
-----
Arjun
Asha

name
-----
Karan
Ravi
Sara

name
-----
Karan
```

# Case sensitivity

SQLite's `LIKE` is case-insensitive for ASCII letters; PostgreSQL's `LIKE` is case-sensitive (use `ILIKE`); MySQL/SQL Server follow the column collation (usually insensitive). Portable trick: compare lowercased values.

```sql filename:SQL
SELECT name FROM employees WHERE name LIKE 'a%' ORDER BY name;              -- SQLite: matches A
SELECT name FROM employees WHERE name GLOB 'a*' ORDER BY name;              -- GLOB: case-sensitive
SELECT name FROM employees WHERE lower(name) LIKE 'a%' ORDER BY name;       -- portable
```

```text filename:Output
name
-----
Arjun
Asha

name
----

name
-----
Arjun
Asha
```

# Matching a literal % or \_

```sql filename:SQL
CREATE TABLE promos (code TEXT);
INSERT INTO promos VALUES ('SAVE10%'), ('SAVE10'), ('FLAT_50'), ('FLATX50');

SELECT code FROM promos WHERE code LIKE '%\%' ESCAPE '\' ORDER BY code;
SELECT code FROM promos WHERE code LIKE 'FLAT\_%' ESCAPE '\' ORDER BY code;
SELECT code FROM promos WHERE code LIKE 'FLAT_%' ORDER BY code;          -- _ is a wildcard!
```

```text filename:Output
code
-------
SAVE10%

code
-------
FLAT_50

code
-------
FLATX50
FLAT_50
```

# Regular expressions (dialects)

```sql filename:PostgreSQL%20%2F%20MySQL%20%2F%20Oracle
SELECT name FROM employees WHERE name ~ '^[AEIOU]';          -- PostgreSQL (~* = case-insensitive)
SELECT name FROM employees WHERE name REGEXP '^[AEIOU]';     -- MySQL
SELECT name FROM employees WHERE REGEXP_LIKE(name, '^[AEIOU]');  -- Oracle / MySQL 8
```

> [!WARNING] Performance
>
> A leading wildcard (`LIKE '%son'`) cannot use a normal B-tree index — the engine must scan every row. `LIKE 'son%'` (prefix) can. For real text search use full-text indexes (`FULLTEXT`, PostgreSQL `tsvector`, SQLite FTS5).

```question
Find names that start and end with a vowel.

---

Portable: `WHERE lower(substr(name,1,1)) IN ('a','e','i','o','u') AND lower(substr(name,-1)) IN ('a','e','i','o','u')` (SQL Server/MySQL: `LEFT`/`RIGHT`). With regex: `name ~* '^[aeiou].*[aeiou]$'` (PostgreSQL) or `REGEXP '^[aeiou].*[aeiou]$'` (MySQL).
```
