---
id: 9520c5c0-2f3d-7a03-8cbf-d8be4d2b2aca
key: topic:dbms/nosql
subject: dbms
topic: nosql
title: NoSQL Databases
slug: nosql-databases
order: 1
---

NoSQL (Not Only SQL) databases are built for horizontal scalability, unstructured schemas, and high write throughput, departing from the rigid ACID constraints of relational systems.

# Why NoSQL?

> [!INFO]
>
> Traditional RDBMS scales <strong>vertically</strong> (faster CPU, more RAM), which has physical scaling limits and high hardware costs. NoSQL is designed to scale <strong>horizontally</strong> (adding cheap server nodes in a distributed cluster). <br>• <strong>Dynamic Schemas:</strong> Allows storing unstructured document records (JSON) without running migrations. <br>• <strong>Low Latency:</strong> Uses simple query patterns (e.g. key-value hash lookups) to bypass slow relational joins.

# SQL vs NoSQL Comparison

| Dimension | SQL Databases (RDBMS) | NoSQL Databases |
| --- | --- | --- |
| <strong>Schema</strong> | Strict, predefined tabular schema. Changes require DDL migration locks. | Dynamic / Schema-less. Records can store custom dynamic columns. |
| <strong>Scaling</strong> | Vertical (Scale Up). | Horizontal (Scale Out). Shards data partitions across multiple nodes. |
| <strong>Joins</strong> | Supported natively. Executed horizontally. | Not supported. Data is denormalized in documents to avoid joins. |
| <strong>Transactions</strong> | Strict ACID properties. Absolute consistency. | BASE model. Prioritizes availability; eventual consistency. |

# The 4 Types of NoSQL Databases

> [!NOTE] 1. Document Database
>
> Stores records as documents (JSON/BSON). Documents can nest objects and arrays inside themselves.
>
> <strong>Use Cases:</strong> E-commerce catalogs, Content Management Systems (CMS), user profile configurations.
>
> MongoDB · CouchDB

> [!NOTE] 2. Key-Value Store
>
> Stores simple key-to-value associations. Extremely fast because it behaves as a giant hash table in RAM.
>
> <strong>Use Cases:</strong> Real-time caching, user session states, global leaderboards.
>
> Redis · Memcached

> [!NOTE] 3. Column-Family Store
>
> Stores columns of data together on disk, rather than rows. Highly optimized for mass writes across columns.
>
> <strong>Use Cases:</strong> IoT sensor metrics, time-series telemetry data, event logs.
>
> Apache Cassandra · HBase

> [!NOTE] 4. Graph Database
>
> Stores data nodes and directed edges (relationships) natively, bypassing join layers for deep networks.
>
> <strong>Use Cases:</strong> Social graph analysis, fraud detection, recommendation engines.
>
> Neo4j · Amazon Neptune

# Query Comparison: SQL vs MongoDB

| Action | SQL Database | MongoDB (NoSQL Document) |
| --- | --- | --- |
| <strong>Insert Row</strong> | `INSERT INTO Users (Name, Age) VALUES ('Alice', 25);` | `db.users.insertOne({ name: "Alice", age: 25 });` |
| <strong>Select rows</strong> | `SELECT * FROM Users WHERE Age > 21;` | `db.users.find({ age: { $gt: 21 } });` |
| <strong>Update rows</strong> | `UPDATE Users SET Age=26 WHERE Name='Alice';` | `db.users.updateMany({ name: "Alice" }, { $set: { age: 26 } });` |
