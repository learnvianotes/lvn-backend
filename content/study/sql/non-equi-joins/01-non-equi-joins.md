---
id: 9b19a64a-f85b-7218-b5d1-f23271c88a9f
key: topic:sql/non-equi-joins
subject: sql
topic: non-equi-joins
title: Non-Equi Joins
slug: non-equi-joins
order: 1
---

A join condition doesn't have to be `=`. Ranges, inequalities and `BETWEEN` joins match rows by <em>intervals</em> — salary bands, price tiers, date validity periods.

```sql filename:SQL
CREATE TABLE salary_grades (grade TEXT PRIMARY KEY, min_salary INTEGER, max_salary INTEGER);
INSERT INTO salary_grades VALUES
    ('G1', 0, 74999), ('G2', 75000, 99999), ('G3', 100000, 139999), ('G4', 140000, 999999);

        SELECT * FROM salary_grades ORDER BY grade;
```

```text filename:Output
grade | min_salary | max_salary
------+------------+-----------
G1    | 0          | 74999
G2    | 75000      | 99999
G3    | 100000     | 139999
G4    | 140000     | 999999
```

# Joining on a range

```sql filename:SQL
SELECT e.name, e.salary, g.grade
FROM employees e
JOIN salary_grades g ON e.salary BETWEEN g.min_salary AND g.max_salary
ORDER BY e.salary DESC, e.emp_id;
```

```text filename:Output
name   | salary | grade
-------+--------+------
Asha   | 150000 | G4
Ravi   | 120000 | G3
Priya  | 110000 | G3
Meera  | 95000  | G2
Karan  | 95000  | G2
Sara   | 85000  | G2
Vikram | 80000  | G2
Neha   | 72000  | G1
Arjun  | 70000  | G1
Dev    | 60000  | G1
```

# Inequality joins: running comparisons

```sql filename:SQL
-- for each employee, how many colleagues earn strictly more (their 0-based rank)
SELECT e.name, e.salary, COUNT(h.emp_id) AS earn_more
FROM employees e
LEFT JOIN employees h ON h.salary > e.salary
GROUP BY e.emp_id, e.name, e.salary
ORDER BY earn_more, e.emp_id
LIMIT 5;
```

```text filename:Output
name  | salary | earn_more
------+--------+----------
Asha  | 150000 | 0
Ravi  | 120000 | 1
Priya | 110000 | 2
Meera | 95000  | 3
Karan | 95000  | 3
```

```sql filename:SQL
-- repeat orders: placed within 30 days after an earlier order by the same customer
SELECT a.customer_id, a.order_id AS earlier, b.order_id AS later,
       julianday(b.order_date) - julianday(a.order_date) AS gap_days
FROM orders a
JOIN orders b ON b.customer_id = a.customer_id
             AND b.order_date >  a.order_date
             AND b.order_date <= date(a.order_date, '+30 days')
ORDER BY a.customer_id, a.order_id;
```

```text filename:Output
customer_id | earlier | later | gap_days
------------+---------+-------+---------
1           | 101     | 103   | 29.0
3           | 104     | 107   | 23.0
```

> [!WARNING] Watch out
>
> Range and inequality joins can explode in size (O(n²) pairs) and can't use hash joins. Make sure ranges don't overlap (or you get duplicates), index the range columns, and prefer window functions for ranking/running questions.

```question
What is a non-equi join?

---

A join whose condition uses an operator other than `=` — `BETWEEN`, `<`, `>=`, `<>`. Typical: mapping a value to a band (`salary BETWEEN min AND max`), finding overlapping date ranges, or pairing events that occurred within some interval.
```
