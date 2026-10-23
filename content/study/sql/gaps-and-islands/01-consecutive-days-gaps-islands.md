---
id: 10d95a3c-5565-7545-b764-e50c6c6b7590
key: topic:sql/gaps-and-islands
subject: sql
topic: gaps-and-islands
title: Consecutive Days, Gaps & Islands
slug: consecutive-days-gaps-islands
order: 1
---

“Users who logged in 3 days in a row”, “longest streak”, “missing ids” — the <strong>gaps-and-islands</strong> family, solved elegantly with `ROW_NUMBER` or `LAG`.

```sql filename:SQL
SELECT user_id, group_concat(substr(login_date, 9), ', ') AS march_days
FROM (SELECT * FROM logins ORDER BY user_id, login_date)
GROUP BY user_id
ORDER BY user_id;
```

```text filename:Output
user_id | march_days
--------+-------------------
1       | 01, 02, 03, 05, 06
2       | 01, 03
3       | 02, 03, 04, 05
```

# The islands trick

Within one user, subtract the row number (in days) from the date. Consecutive dates produce the <strong>same</strong> anchor value; a gap changes it. Group by that anchor and each group is one streak (“island”).

```sql filename:SQL
SELECT user_id, login_date,
       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS rn,
       date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
FROM logins
WHERE user_id = 1
ORDER BY login_date;
```

```text filename:Output
user_id | login_date | rn | grp
--------+------------+----+-----------
1       | 2024-03-01 | 1  | 2024-02-29
1       | 2024-03-02 | 2  | 2024-02-29
1       | 2024-03-03 | 3  | 2024-02-29
1       | 2024-03-05 | 4  | 2024-03-01
1       | 2024-03-06 | 5  | 2024-03-01
```

```sql filename:SQL
WITH marked AS (
    SELECT user_id, login_date,
           date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
    FROM logins
)
SELECT user_id, MIN(login_date) AS streak_start, MAX(login_date) AS streak_end, COUNT(*) AS days
FROM marked
GROUP BY user_id, grp
ORDER BY user_id, streak_start;
```

```text filename:Output
user_id | streak_start | streak_end | days
--------+--------------+------------+-----
1       | 2024-03-01   | 2024-03-03 | 3
1       | 2024-03-05   | 2024-03-06 | 2
2       | 2024-03-01   | 2024-03-01 | 1
2       | 2024-03-03   | 2024-03-03 | 1
3       | 2024-03-02   | 2024-03-05 | 4
```

# Users with 3+ consecutive days, and longest streak

```sql filename:SQL
WITH marked AS (
    SELECT user_id,
           date(login_date, '-' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) || ' days') AS grp
    FROM logins
),
streaks AS (
    SELECT user_id, COUNT(*) AS days FROM marked GROUP BY user_id, grp
)
SELECT user_id, MAX(days) AS longest_streak
FROM streaks
GROUP BY user_id
HAVING MAX(days) >= 3
ORDER BY user_id;
```

```text filename:Output
user_id | longest_streak
--------+---------------
1       | 3
3       | 4
```

# The LAG alternative: detect breaks

```sql filename:SQL
-- 3 consecutive days = today, yesterday and the day before are all present
SELECT DISTINCT user_id
FROM (
    SELECT user_id, login_date,
           LAG(login_date, 2) OVER (PARTITION BY user_id ORDER BY login_date) AS two_back
    FROM logins
)
WHERE julianday(login_date) - julianday(two_back) = 2
ORDER BY user_id;
```

```text filename:Output
user_id
-------
1
3
```

# Gaps: missing values in a sequence

```sql filename:SQL
-- gaps in order ids (orders 101..108 exist; pretend 103 and 104 were deleted)
DELETE FROM order_items WHERE order_id IN (103, 104);
DELETE FROM orders WHERE order_id IN (103, 104);

SELECT order_id + 1 AS gap_start, next_id - 1 AS gap_end
FROM (SELECT order_id, LEAD(order_id) OVER (ORDER BY order_id) AS next_id FROM orders)
WHERE next_id - order_id > 1;
```

```text filename:Output
gap_start | gap_end
----------+--------
103       | 104
```

```question
Find users who logged in on 3 consecutive days.

---

Either `LAG(login_date, 2) OVER (PARTITION BY user_id ORDER BY login_date)` and keep rows where the date difference is exactly 2 days (deduplicate dates first), or the islands trick: `login_date − ROW_NUMBER()` days is constant across a streak, so `GROUP BY user_id, that_value HAVING COUNT(*) >= 3`.
```
