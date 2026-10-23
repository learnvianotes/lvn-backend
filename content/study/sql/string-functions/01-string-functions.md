---
id: 514e4b77-caed-7717-b1c3-f00c0df1dd97
key: topic:sql/string-functions
subject: sql
topic: string-functions
title: String Functions
slug: string-functions
order: 1
---

Built-in functions clean, slice, combine and format text. Names differ between engines more than anywhere else — learn the ideas, then look up the local spelling.

# The essentials

| Task | SQLite / standard | MySQL | SQL Server | PostgreSQL |
| --- | --- | --- | --- | --- |
| Length | `length(s)` | `CHAR_LENGTH(s)` (`LENGTH` = bytes) | `LEN(s)` | `length(s)` |
| Upper / lower | `upper(s)`, `lower(s)` | same | same | same |
| Substring | `substr(s, start, len)` | `SUBSTRING(s, start, len)` | `SUBSTRING(s, start, len)` | `substring(s from 2 for 3)` |
| First / last n | `substr(s, 1, n)`, `substr(s, -n)` | `LEFT(s, n)`, `RIGHT(s, n)` | `LEFT`, `RIGHT` | `left`, `right` |
| Trim | `trim(s)`, `ltrim`, `rtrim` | same | `TRIM` (2017+), `LTRIM`, `RTRIM` | same |
| Find position | `instr(s, sub)` | `INSTR(s, sub)` / `LOCATE` | `CHARINDEX(sub, s)` | `position(sub in s)` |
| Replace | `replace(s, from, to)` | same | same | same |
| Concatenate | `a &#124;&#124; b`, `concat(a, b)` | `CONCAT(a, b)` | `a + b`, `CONCAT` | `a &#124;&#124; b`, `concat` |
| Pad | `printf('%5s', s)` | `LPAD(s, 5, ' ')` | `RIGHT(SPACE(5) + s, 5)` | `lpad(s, 5)` |

> [!NOTE] Key point
>
> SQL strings are <strong>1-indexed</strong>: the first character is position 1, and `instr`/`CHARINDEX` return `0` when not found.

# Slicing and searching

```sql filename:SQL
SELECT email,
       length(email)                              AS len,
       instr(email, '@')                          AS at_pos,
       substr(email, 1, instr(email, '@') - 1)    AS username,
       substr(email, instr(email, '@') + 1)       AS domain,
       substr(email, -2)                          AS last_two
FROM employees
WHERE emp_id IN (1, 8)
ORDER BY emp_id;
```

```text filename:Output
email          | len | at_pos | username | domain  | last_two
---------------+-----+--------+----------+---------+---------
asha@corp.in   | 12  | 5      | asha     | corp.in | in
vikram@corp.in | 14  | 7      | vikram   | corp.in | in
```

# Cleaning text

```sql filename:SQL
SELECT '[' || trim('   padded   ') || ']'        AS trimmed,
       ltrim('000742', '0')                      AS no_zeros,
       replace('2024/03/15', '/', '-')           AS iso_date,
       lower('MiXeD CaSe')                       AS lowered;
```

```text filename:Output
trimmed  | no_zeros | iso_date   | lowered
---------+----------+------------+-----------
[padded] | 742      | 2024-03-15 | mixed case
```

# Building strings

```sql filename:SQL
SELECT name || ' (' || COALESCE(email, 'n/a') || ')'   AS with_pipe,
       concat(name, ' - ', dept_id)                    AS with_concat,
       concat_ws(', ', name, email, dept_id)           AS with_separator,
       printf('%-6s|%8d', name, salary)                AS formatted
FROM employees
WHERE emp_id IN (7, 10)
ORDER BY emp_id;
```

```text filename:Output
with_pipe  | with_concat | with_separator | formatted
-----------+-------------+----------------+----------------
Neha (n/a) | Neha - 2    | Neha, 2        | Neha  |   72000
Dev (n/a)  | Dev -       | Dev            | Dev   |   60000
```

> [!WARNING] Watch out
>
> `||` with a `NULL` operand gives `NULL` (see Neha's email handled with `COALESCE`). `concat()` treats `NULL` as an empty string in SQLite, PostgreSQL and SQL Server — but in <strong>MySQL</strong> `CONCAT()` returns `NULL` if any argument is `NULL`. `concat_ws` skips `NULL`s everywhere (Dev's missing email and department vanish).

# Aggregating strings

```sql filename:SQL
SELECT dept_id,
       group_concat(name, ', ' ORDER BY name) AS team
FROM employees
WHERE dept_id IS NOT NULL
GROUP BY dept_id
ORDER BY dept_id;
```

```text filename:Output
dept_id | team
--------+-------------------------
1       | Asha, Karan, Meera, Ravi
2       | Arjun, Neha, Priya
3       | Sara, Vikram
```

Spellings: `STRING_AGG(name, ', ' ORDER BY name)` (PostgreSQL, SQLite 3.44+), `STRING_AGG(name, ', ') WITHIN GROUP (ORDER BY name)` (SQL Server), `GROUP_CONCAT(name ORDER BY name SEPARATOR ', ')` (MySQL), `LISTAGG(name, ', ') WITHIN GROUP (ORDER BY name)` (Oracle).

```question
How do you extract the domain from an email in SQL?

---

Find the `@` and take everything after it: `substr(email, instr(email, '@') + 1)` (SQLite/MySQL), `SUBSTRING(email, CHARINDEX('@', email) + 1, LEN(email))` (SQL Server), `split_part(email, '@', 2)` (PostgreSQL), `SUBSTRING_INDEX(email, '@', -1)` (MySQL).
```
