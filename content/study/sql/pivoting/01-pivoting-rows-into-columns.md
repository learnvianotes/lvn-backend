---
id: 52abca6f-c2dc-7ddd-8744-57a9d624279d
key: topic:sql/pivoting
subject: sql
topic: pivoting
title: Pivoting Rows into Columns
slug: pivoting-rows-into-columns
order: 1
---

A pivot turns row values (subjects, months, statuses) into columns. The portable way is <strong>conditional aggregation</strong>: `GROUP BY` the row key and one `CASE` per output column.

```sql filename:SQL
SELECT * FROM exam_scores ORDER BY student, subject;
```

```text filename:Output
student | subject | score
--------+---------+------
Asha    | English | 78
Asha    | Math    | 91
Asha    | Science | 84
Meera   | English | 95
Meera   | Math    | 75
Ravi    | Math    | 67
Ravi    | Science | 88
```

# Pivot with CASE

```sql filename:SQL
SELECT student,
       MAX(CASE WHEN subject = 'Math'    THEN score END) AS math,
       MAX(CASE WHEN subject = 'Science' THEN score END) AS science,
       MAX(CASE WHEN subject = 'English' THEN score END) AS english,
       SUM(score) AS total
FROM exam_scores
GROUP BY student
ORDER BY student;
```

```text filename:Output
student | math | science | english | total
--------+------+---------+---------+------
Asha    | 91   | 84      | 78      | 253
Meera   | 75   | NULL    | 95      | 170
Ravi    | 67   | 88      | NULL    | 155
```

`MAX` just picks the single value in each cell (any aggregate works when there is one row per cell; use `SUM` when several rows should add up). Missing combinations become `NULL`.

# Business pivot: order counts per month and status

```sql filename:SQL
SELECT strftime('%Y-%m', order_date) AS month,
       SUM(status = 'delivered') AS delivered,
       SUM(status = 'shipped')   AS shipped,
       SUM(status = 'pending')   AS pending,
       SUM(status = 'cancelled') AS cancelled,
       COUNT(*)                  AS total
FROM orders
GROUP BY month
ORDER BY month;
```

```text filename:Output
month   | delivered | shipped | pending | cancelled | total
--------+-----------+---------+---------+-----------+------
2024-01 | 2         | 0       | 0       | 0         | 2
2024-02 | 1         | 1       | 0       | 1         | 3
2024-03 | 1         | 1       | 1       | 0         | 3
```

In SQLite and MySQL a comparison is `1`/`0`, so `SUM(status = 'x')` counts matches. Portable form: `SUM(CASE WHEN status = 'x' THEN 1 ELSE 0 END)`; PostgreSQL: `COUNT(*) FILTER (WHERE status = 'x')`.

# Unpivot: columns back into rows

```sql filename:SQL
CREATE TABLE quarterly (region TEXT, q1 INTEGER, q2 INTEGER, q3 INTEGER);
INSERT INTO quarterly VALUES ('North', 100, 120, 90), ('South', 80, 95, 110);

SELECT region, 'Q1' AS quarter, q1 AS sales FROM quarterly
UNION ALL SELECT region, 'Q2', q2 FROM quarterly
UNION ALL SELECT region, 'Q3', q3 FROM quarterly
ORDER BY region, quarter;
```

```text filename:Output
region | quarter | sales
-------+---------+------
North  | Q1      | 100
North  | Q2      | 120
North  | Q3      | 90
South  | Q1      | 80
South  | Q2      | 95
South  | Q3      | 110
```

```sql filename:SQL%20Server%20%2F%20Oracle%20(PIVOT%20%2F%20UNPIVOT)
SELECT *
FROM (SELECT student, subject, score FROM exam_scores) src
PIVOT (MAX(score) FOR subject IN ([Math], [Science], [English])) p;

SELECT region, quarter, sales
FROM quarterly
UNPIVOT (sales FOR quarter IN (q1, q2, q3)) u;
```

> [!WARNING] Watch out
>
> SQL needs the output columns known when the query is written. For a <em>dynamic</em> list of pivot columns you must generate the SQL text in application code (or dynamic SQL) — or pivot in the reporting tool.

```question
How do you convert rows to columns in SQL?

---

Conditional aggregation: `SELECT key, MAX(CASE WHEN attr = 'A' THEN value END) AS a, … FROM t GROUP BY key`. It works in every engine; SQL Server/Oracle also have `PIVOT`, PostgreSQL has `crosstab()` in the `tablefunc` extension.
```
