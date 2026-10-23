---
id: e35991ae-6e91-77ef-8b01-769cfe27f75e
key: topic:sql/json-in-sql
subject: sql
topic: json-in-sql
title: JSON in SQL
slug: json-in-sql
order: 1
---

Modern engines store and query JSON documents inside relational tables — useful for flexible attributes, event payloads and API data, alongside normal columns.

# Extracting values

```sql filename:SQL
CREATE TABLE app_events (
    id      INTEGER PRIMARY KEY,
    payload TEXT CHECK (json_valid(payload))
);
INSERT INTO app_events (payload) VALUES
    ('{"user": {"id": 7, "name": "Asha"}, "action": "login",    "tags": ["web", "mobile"]}'),
    ('{"user": {"id": 9, "name": "Ravi"}, "action": "purchase", "amount": 2500, "tags": ["web"]}'),
    ('{"user": {"id": 7, "name": "Asha"}, "action": "purchase", "amount": 800}');

SELECT id,
       payload ->> '$.user.name'           AS user_name,
       json_extract(payload, '$.action')   AS action,
       payload ->> '$.amount'              AS amount,
       json_array_length(payload, '$.tags') AS tag_count
FROM app_events
ORDER BY id;
```

```text filename:Output
id | user_name | action   | amount | tag_count
---+-----------+----------+--------+----------
1  | Asha      | login    | NULL   | 2
2  | Ravi      | purchase | 2500   | 1
3  | Asha      | purchase | 800    | NULL
```

`->>` returns a plain SQL value (text/number); `->` returns JSON. Missing keys give `NULL`.

# Filtering and aggregating JSON

```sql filename:SQL
CREATE TABLE app_events (id INTEGER PRIMARY KEY, payload TEXT);
INSERT INTO app_events (payload) VALUES
    ('{"user": {"id": 7, "name": "Asha"}, "action": "login",    "tags": ["web", "mobile"]}'),
    ('{"user": {"id": 9, "name": "Ravi"}, "action": "purchase", "amount": 2500, "tags": ["web"]}'),
    ('{"user": {"id": 7, "name": "Asha"}, "action": "purchase", "amount": 800}');

SELECT payload ->> '$.user.name' AS user_name, SUM(payload ->> '$.amount') AS spent
FROM app_events
WHERE payload ->> '$.action' = 'purchase'
GROUP BY user_name
ORDER BY spent DESC;

-- expand an array into rows
SELECT e.id, t.value AS tag
FROM app_events e, json_each(e.payload, '$.tags') AS t
ORDER BY e.id, tag;
```

```text filename:Output
user_name | spent
----------+------
Ravi      | 2500
Asha      | 800

id | tag
---+-------
1  | mobile
1  | web
2  | web
```

# Building JSON from rows

```sql filename:SQL
SELECT d.name AS department,
       json_group_array(json_object('name', e.name, 'salary', e.salary)) AS staff
FROM departments d
JOIN employees e ON e.dept_id = d.dept_id
WHERE d.dept_id = 3
GROUP BY d.name;
```

```text filename:Output
department | staff
-----------+------------------------------------------------------------------
HR         | [{"name":"Vikram","salary":80000},{"name":"Sara","salary":85000}]
```

# Other engines

| Operation | PostgreSQL (`jsonb`) | MySQL (`JSON`) | SQL Server (text) |
| --- | --- | --- | --- |
| Get text | `payload ->> 'action'`, `payload #>> '{user,name}'` | `payload ->> '$.action'` | `JSON_VALUE(payload, '$.action')` |
| Get JSON | `payload -> 'user'` | `payload -> '$.user'` | `JSON_QUERY(payload, '$.user')` |
| Contains | `payload @> '{"action":"login"}'` | `JSON_CONTAINS(…)` | — |
| Array → rows | `jsonb_array_elements` | `JSON_TABLE` | `OPENJSON` |
| Index | GIN index on `jsonb` | Index a generated column | Index a computed column |

```sql filename:PostgreSQL
CREATE TABLE app_events (id BIGSERIAL PRIMARY KEY, payload JSONB NOT NULL);
CREATE INDEX idx_events_payload ON app_events USING GIN (payload);

SELECT id FROM app_events WHERE payload @> '{"action": "purchase"}';   -- uses the GIN index
SELECT payload -> 'user' ->> 'name' FROM app_events;
```

> [!TIP] Do
>
> Use JSON for genuinely variable or rarely-queried attributes and raw payloads; promote fields you filter/join on to real columns (or generated columns) with indexes.

> [!DANGER] Avoid
>
> Store everything as one JSON blob — you lose types, constraints, foreign keys, efficient joins and readable queries.

```question
When should you store JSON in a relational database?

---

When the structure is truly variable (per-product attributes, third-party webhook payloads, user settings) or the data is read/written as a whole. Keep core, frequently-filtered fields as typed columns; in PostgreSQL prefer `jsonb` (binary, indexable with GIN) over `json`.
```
