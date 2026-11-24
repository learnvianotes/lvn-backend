---
id: 3d0127b4-cc0b-7785-8518-dcda4f61a165
key: topic:sql/sample-database
subject: sql
topic: sample-database
title: The Sample Database
slug: the-sample-database
order: 1
---

Every example in these notes runs against this small company-and-shop database. Skim it once — then every query result is easy to verify by eye.

# The tables

| Table | Rows | What it holds | Links |
| --- | --- | --- | --- |
| `departments` | 4 | Departments and their city | — |
| `employees` | 10 | Staff with salary, hire date and manager | `dept_id` → departments, `manager_id` → employees (self) |
| `customers` | 5 | Shop customers | — |
| `products` | 7 | Catalogue with category and list price | — |
| `orders` | 8 | One row per order, with status | `customer_id` → customers |
| `order_items` | 13 | Lines of each order (quantity × price paid) | `order_id` → orders, `product_id` → products |

customers → orders → order\_items → products

# Schema (DDL)

```sql filename:SQL%20%E2%80%94%20schema
PRAGMA foreign_keys = ON;

CREATE TABLE departments (
    dept_id   INTEGER PRIMARY KEY,
    name      TEXT NOT NULL UNIQUE,
    location  TEXT NOT NULL
);

CREATE TABLE employees (
    emp_id      INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    email       TEXT    UNIQUE,
    dept_id     INTEGER REFERENCES departments(dept_id),
    manager_id  INTEGER REFERENCES employees(emp_id),
    salary      INTEGER NOT NULL CHECK (salary > 0),
    hire_date   TEXT    NOT NULL
);

CREATE TABLE customers (
    customer_id  INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    city         TEXT,
    signup_date  TEXT NOT NULL
);

CREATE TABLE products (
    product_id  INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    price       INTEGER NOT NULL CHECK (price >= 0)
);

CREATE TABLE orders (
    order_id     INTEGER PRIMARY KEY,
    customer_id  INTEGER NOT NULL REFERENCES customers(customer_id),
    order_date   TEXT    NOT NULL,
    status       TEXT    NOT NULL
                 CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
    order_id    INTEGER NOT NULL REFERENCES orders(order_id),
    product_id  INTEGER NOT NULL REFERENCES products(product_id),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    unit_price  INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

> [!NOTE] SQLite
>
> `PRAGMA foreign_keys = ON` is SQLite-specific: SQLite enforces foreign keys only when this is switched on for the connection. Other engines always enforce them.

# The data

```sql filename:SQL
SELECT * FROM departments ORDER BY dept_id;
SELECT * FROM employees ORDER BY emp_id;
```

```text filename:Output
dept_id | name        | location
--------+-------------+----------
1       | Engineering | Bengaluru
2       | Sales       | Mumbai
3       | HR          | Hyderabad
4       | Marketing   | Pune

emp_id | name   | email          | dept_id | manager_id | salary | hire_date
-------+--------+----------------+---------+------------+--------+-----------
1      | Asha   | asha@corp.in   | 1       | NULL       | 150000 | 2015-03-01
2      | Ravi   | ravi@corp.in   | 1       | 1          | 120000 | 2017-06-15
3      | Meera  | meera@corp.in  | 1       | 2          | 95000  | 2019-01-10
4      | Karan  | karan@corp.in  | 1       | 2          | 95000  | 2020-08-01
5      | Priya  | priya@corp.in  | 2       | 1          | 110000 | 2016-11-20
6      | Arjun  | arjun@corp.in  | 2       | 5          | 70000  | 2021-02-14
7      | Neha   | NULL           | 2       | 5          | 72000  | 2022-05-30
8      | Vikram | vikram@corp.in | 3       | 1          | 80000  | 2018-09-05
9      | Sara   | sara@corp.in   | 3       | 8          | 85000  | 2023-01-09
10     | Dev    | NULL           | NULL    | 1          | 60000  | 2024-04-01
```

Built-in quirks worth noticing — later topics rely on them:

- <strong>Asha</strong> has no manager (`manager_id` is `NULL`) — she is the root of the hierarchy.
- <strong>Dev</strong> has no department (`dept_id` is `NULL`) and <strong>Marketing</strong> has no employees — perfect for outer joins.
- <strong>Meera</strong> and <strong>Karan</strong> earn the same (95000) — ties for ranking functions.
- <strong>Neha</strong> and <strong>Dev</strong> have no email — `NULL` handling.
- <strong>Sara</strong> (85000) earns more than her manager <strong>Vikram</strong> (80000).

```sql filename:SQL
SELECT * FROM customers ORDER BY customer_id;
SELECT * FROM products ORDER BY product_id;
```

```text filename:Output
customer_id | name   | city      | signup_date
------------+--------+-----------+------------
1           | Ananya | Mumbai    | 2023-11-02
2           | Rahul  | Delhi     | 2023-12-15
3           | Sneha  | Bengaluru | 2024-01-20
4           | Imran  | Delhi     | 2024-02-01
5           | Kavya  | NULL      | 2024-03-10

product_id | name       | category    | price
-----------+------------+-------------+------
1          | Laptop     | Electronics | 55000
2          | Headphones | Electronics | 2500
3          | Desk       | Furniture   | 8000
4          | Chair      | Furniture   | 4500
5          | Notebook   | Stationery  | 60
6          | Pen        | Stationery  | 20
7          | Monitor    | Electronics | 12000
```

```sql filename:SQL
SELECT * FROM orders ORDER BY order_id;
SELECT * FROM order_items ORDER BY order_id, product_id;
```

```text filename:Output
order_id | customer_id | order_date | status
---------+-------------+------------+----------
101      | 1           | 2024-01-05 | delivered
102      | 2           | 2024-01-12 | delivered
103      | 1           | 2024-02-03 | delivered
104      | 3           | 2024-02-14 | shipped
105      | 4           | 2024-02-20 | cancelled
106      | 2           | 2024-03-01 | delivered
107      | 3           | 2024-03-08 | pending
108      | 1           | 2024-03-15 | shipped

order_id | product_id | quantity | unit_price
---------+------------+----------+-----------
101      | 1          | 1        | 55000
101      | 2          | 1        | 2500
102      | 4          | 2        | 4500
102      | 6          | 10       | 20
103      | 5          | 5        | 60
103      | 6          | 5        | 20
104      | 3          | 1        | 8000
104      | 4          | 1        | 4500
105      | 2          | 2        | 2500
106      | 1          | 1        | 52000
107      | 5          | 20       | 60
108      | 2          | 1        | 2500
108      | 3          | 1        | 8000
```

- <strong>Kavya</strong> has never ordered and has no city; the <strong>Monitor</strong> has never been sold.
- Order <strong>106</strong> sold a Laptop at 52000 — `unit_price` records the price <em>actually paid</em>, which can differ from the list price in `products`.
- Order <strong>105</strong> was cancelled — most revenue queries must exclude it.

# Data insert script

```sql filename:SQL%20%E2%80%94%20data
INSERT INTO departments VALUES
    (1, 'Engineering', 'Bengaluru'),
    (2, 'Sales',       'Mumbai'),
    (3, 'HR',          'Hyderabad'),
    (4, 'Marketing',   'Pune');

INSERT INTO employees VALUES
    (1,  'Asha',   'asha@corp.in',   1,    NULL, 150000, '2015-03-01'),
    (2,  'Ravi',   'ravi@corp.in',   1,    1,    120000, '2017-06-15'),
    (3,  'Meera',  'meera@corp.in',  1,    2,     95000, '2019-01-10'),
    (4,  'Karan',  'karan@corp.in',  1,    2,     95000, '2020-08-01'),
    (5,  'Priya',  'priya@corp.in',  2,    1,    110000, '2016-11-20'),
    (6,  'Arjun',  'arjun@corp.in',  2,    5,     70000, '2021-02-14'),
    (7,  'Neha',   NULL,             2,    5,     72000, '2022-05-30'),
    (8,  'Vikram', 'vikram@corp.in', 3,    1,     80000, '2018-09-05'),
    (9,  'Sara',   'sara@corp.in',   3,    8,     85000, '2023-01-09'),
    (10, 'Dev',    NULL,             NULL, 1,     60000, '2024-04-01');

INSERT INTO customers VALUES
    (1, 'Ananya', 'Mumbai',    '2023-11-02'),
    (2, 'Rahul',  'Delhi',     '2023-12-15'),
    (3, 'Sneha',  'Bengaluru', '2024-01-20'),
    (4, 'Imran',  'Delhi',     '2024-02-01'),
    (5, 'Kavya',  NULL,        '2024-03-10');

INSERT INTO products VALUES
    (1, 'Laptop',     'Electronics', 55000),
    (2, 'Headphones', 'Electronics',  2500),
    (3, 'Desk',       'Furniture',    8000),
    (4, 'Chair',      'Furniture',    4500),
    (5, 'Notebook',   'Stationery',     60),
    (6, 'Pen',        'Stationery',     20),
    (7, 'Monitor',    'Electronics', 12000);

INSERT INTO orders VALUES
    (101, 1, '2024-01-05', 'delivered'),
    (102, 2, '2024-01-12', 'delivered'),
    (103, 1, '2024-02-03', 'delivered'),
    (104, 3, '2024-02-14', 'shipped'),
    (105, 4, '2024-02-20', 'cancelled'),
    (106, 2, '2024-03-01', 'delivered'),
    (107, 3, '2024-03-08', 'pending'),
    (108, 1, '2024-03-15', 'shipped');

INSERT INTO order_items VALUES
    (101, 1, 1, 55000), (101, 2, 1, 2500),
    (102, 4, 2, 4500),  (102, 6, 10, 20),
    (103, 5, 5, 60),    (103, 6, 5, 20),
    (104, 3, 1, 8000),  (104, 4, 1, 4500),
    (105, 2, 2, 2500),
    (106, 1, 1, 52000),
    (107, 5, 20, 60),
    (108, 2, 1, 2500),  (108, 3, 1, 8000);
```

> [!WARNING] Watch out
>
> `SELECT *` is fine for exploring. In application code, list the columns you need: it is faster, and the query does not break (or silently change) when someone adds a column.
