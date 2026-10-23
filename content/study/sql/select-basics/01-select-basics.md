---
id: fe19adb7-9261-7029-a32f-28b2e7714d51
key: topic:sql/select-basics
subject: sql
topic: select-basics
title: SELECT Basics
slug: select-basics
order: 1
---

`SELECT` reads data: pick columns, compute expressions, and shape the result set. Every other query feature builds on this.

# Anatomy of a SELECT

```sql filename:SQL
SELECT   column_list        -- what to return   (required)
FROM     table_name         -- where from
WHERE    row_filter         -- which rows
GROUP BY grouping_columns   -- collapse rows into groups
HAVING   group_filter       -- which groups
ORDER BY sort_keys          -- in what order
LIMIT    n;                 -- how many
```

Only `SELECT` is mandatory — but the clauses must appear in exactly this order.

# Choosing columns

```sql filename:SQL
SELECT name, salary, hire_date
FROM employees
ORDER BY emp_id
LIMIT 4;
```

```text filename:Output
name  | salary | hire_date
------+--------+-----------
Asha  | 150000 | 2015-03-01
Ravi  | 120000 | 2017-06-15
Meera | 95000  | 2019-01-10
Karan | 95000  | 2020-08-01
```

# Computed columns and literals

The select list can contain any expression: arithmetic, function calls, string concatenation (`||`), constants.

```sql filename:SQL
SELECT name,
       salary,
       salary / 12            AS monthly,
       salary * 12 / 100      AS pf_12_pct,
       'INR'                  AS currency,
       upper(name) || ' #' || emp_id AS badge
FROM employees
WHERE dept_id = 1
ORDER BY emp_id;
```

```text filename:Output
name  | salary | monthly | pf_12_pct | currency | badge
------+--------+---------+-----------+----------+---------
Asha  | 150000 | 12500   | 18000     | INR      | ASHA #1
Ravi  | 120000 | 10000   | 14400     | INR      | RAVI #2
Meera | 95000  | 7916    | 11400     | INR      | MEERA #3
Karan | 95000  | 7916    | 11400     | INR      | KARAN #4
```

> [!WARNING] Watch out
>
> Integer ÷ integer is <strong>integer division</strong> in SQLite, PostgreSQL and SQL Server: `7 / 2` is `3`. Use `7 / 2.0` or `CAST(x AS REAL)` for a fractional result. (MySQL and Oracle return `3.5`.)

# SELECT without FROM

```sql filename:SQL
SELECT 2 + 3 * 4 AS result, 7 / 2 AS int_div, 7 / 2.0 AS real_div, 'hi' || '!' AS greeting;
```

```text filename:Output
result | int_div | real_div | greeting
-------+---------+----------+---------
14     | 3       | 3.5      | hi!
```

> [!NOTE] Oracle
>
> Oracle requires a `FROM`, so it provides a one-row dummy table: `SELECT 2 + 3 FROM DUAL;`.

# SELECT \*

> [!TIP] Do
>
> Name the columns you need: less data over the network, can use covering indexes, stable when columns are added.

> [!DANGER] Avoid
>
> `SELECT *` in production code or in views — it returns columns you don't need and changes shape silently when the table changes.

```question
Is SQL case-sensitive?

---

Keywords and (unquoted) identifiers are case-insensitive in all major engines. <strong>String comparison</strong> depends on the collation: `'a' = 'A'` is false in PostgreSQL and SQLite (binary), true in MySQL and SQL Server with their default case-insensitive collations. Quoted identifiers (`"Name"`) are case-sensitive in PostgreSQL and Oracle.
```
