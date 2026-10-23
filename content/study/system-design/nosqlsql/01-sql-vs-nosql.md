---
id: 7200a2ad-7583-788f-98c5-62eefe80dd94
key: topic:system-design/nosqlsql
subject: system-design
topic: nosqlsql
title: SQL vs NoSQL
slug: sql-vs-nosql
order: 1
---

Choosing the right database type is one of the most impactful architectural decisions. Neither is universally better.

# Comparison

> [!NOTE] SQL (Relational)
>
> <strong>Examples:</strong> PostgreSQL, MySQL, SQLite, SQL Server<br><br>• Structured schema, enforced relationships<br>• ACID transactions<br>• Powerful JOIN queries<br>• Vertical scaling primarily<br>• Best for: financial data, inventory, user accounts, anything with complex relationships

> [!NOTE] NoSQL
>
> <strong>Examples:</strong> MongoDB, Cassandra, DynamoDB, Redis<br><br>• Flexible schema, horizontal scaling<br>• Eventual consistency (usually)<br>• Designed for specific access patterns<br>• Massive scale<br>• Best for: social graphs, product catalogs, real-time analytics, IoT data, caching

# NoSQL Types

> [!NOTE] Key-Value
>
> Redis, DynamoDB. Fastest. Perfect for sessions, caches, leaderboards.

> [!NOTE] Document
>
> MongoDB, Firestore. JSON documents. Great for content, user profiles, catalogs.

> [!NOTE] Wide-Column
>
> Cassandra, HBase. Optimized for time-series, write-heavy workloads at massive scale.

> [!NOTE] Graph
>
> Neo4j, Amazon Neptune. Nodes and edges. Best for social networks, recommendations, fraud detection.
