---
id: 1463d699-0c11-7f06-8991-69300e29b5b4
key: topic:sql/sql-injection
subject: sql
topic: sql-injection
title: SQL Injection & Parameterized Queries
slug: sql-injection-parameterized-queries
order: 1
---

SQL injection happens when user input is pasted into SQL text, letting an attacker change the query itself. It is still one of the most common and damaging web vulnerabilities — and it is completely preventable.

# The vulnerable pattern

```python filename:Python%20%E2%80%94%20vulnerable
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript("""
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, is_admin INTEGER);
    INSERT INTO users VALUES (1, 'asha', 'x1', 1), (2, 'ravi', 'x2', 0);
""")

def find_user_unsafe(name):
    query = f"SELECT id, username FROM users WHERE username = '{name}'"   # ✗ string building
    return db.execute(query).fetchall()

print(find_user_unsafe("ravi"))              # [(2, 'ravi')]
print(find_user_unsafe("x' OR '1'='1"))      # [(1, 'asha'), (2, 'ravi')]
```

The input `x' OR '1'='1` closes the string and adds a condition that is always true, so the query becomes:

```sql filename:SQL
SELECT id, username FROM users WHERE username = 'x' OR '1'='1'
```

With a login form that is an authentication bypass; with `UNION SELECT` an attacker can read other tables; with stacked queries (`'; DROP TABLE users; --`) in engines/drivers that allow them, destroy data.

# The fix: bind parameters

```python filename:Python%20%E2%80%94%20parameterized
import sqlite3
db = sqlite3.connect(":memory:")
db.executescript("""
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    INSERT INTO users VALUES (1, 'asha'), (2, 'ravi');
""")

def find_user(name):
    return db.execute("SELECT id, username FROM users WHERE username = ?", (name,)).fetchall()

print(find_user("ravi"))             # [(2, 'ravi')]
print(find_user("x' OR '1'='1"))     # []   ← treated as a plain (odd) username
```

With a placeholder, the SQL text and the data travel <strong>separately</strong>; the database parses the query first and the value can never become code.

| Language / driver | Placeholder |
| --- | --- |
| Python `sqlite3` | `?` or `:name` |
| Python `psycopg` | `%s` or `%(name)s` (not Python `%` formatting!) |
| Java JDBC | `PreparedStatement` with `?` |
| Node `pg` | `$1, $2` |
| PHP PDO | `?` or `:name` |
| C# ADO.NET | `@name` |

# What parameters can't do

Placeholders stand for <strong>values</strong> only — not table names, column names, `ASC`/`DESC` or keywords. For those, map the user's choice through an allow-list:

```python filename:Python%20%E2%80%94%20allow-list
SORTABLE = {"name": "username", "newest": "id DESC"}

def order_clause(user_choice):
    return "ORDER BY " + SORTABLE.get(user_choice, "id")    # never interpolate the raw input

print(order_clause("newest"))                    # ORDER BY id DESC
print(order_clause("id; DROP TABLE users"))      # ORDER BY id
```

# Defence in depth

- Parameterized queries or an ORM everywhere — including admin tools and scripts.
- Least privilege: the app's DB user can't `DROP`, can't read tables it doesn't need.
- Validate input types and lengths; escape output (injection's cousin is XSS).
- Don't show raw database errors to users; log them.
- Watch ORM escape hatches: raw SQL helpers, `.extra()`, string-built `WHERE` fragments.

> [!WARNING] Watch out
>
> Escaping quotes by hand (`name.replace("'", "''")`) is fragile — character sets, numeric contexts and second-order injection (stored input reused later) break it. Use bind parameters.

```question
What is SQL injection and how do you prevent it?

---

An attack where untrusted input is concatenated into a SQL string and changes the query's structure (`' OR '1'='1`, `UNION SELECT …`, `; DROP …`). Prevent it with parameterized queries/prepared statements (or an ORM using them), allow-lists for identifiers, least-privilege database accounts, and input validation.
```

```question
Do stored procedures prevent SQL injection?

---

Only if they use parameters properly. A procedure that builds dynamic SQL by concatenating its arguments (`EXEC('SELECT … ' + @name)`) is just as injectable; use `sp_executesql` with parameters (SQL Server) or `EXECUTE … USING` (PostgreSQL).
```
