---
id: 2454f023-618b-76c6-9d11-521ca4064474
key: topic:dbms/intro
subject: dbms
topic: intro
title: Introduction
slug: introduction
order: 1
---

A Database Management System (DBMS) is a specialized system software designed to store, organize, retrieve, and manipulate data securely. It serves as an abstraction layer between physical storage and application programs or end-users.

> [!INFO]
>
> <strong>Core Functions of a DBMS:</strong>
>
> - <strong>Data Storage and Buffer Management:</strong> Storing data systematically across pages on disk, using memory buffers (caching) to minimize disk I/O latency.
> - <strong>Concurrency Control:</strong> Managing simultaneous transactions using scheduling algorithms and locking protocols to prevent data corruption.
> - <strong>Security &amp; Privilege Management:</strong> Controlling data access through granular authorization schemas (schemas, views, roles).
> - <strong>Data Integrity enforcement:</strong> Ensuring records adhere to domain constraints, referential keys, and schema rules.
> - <strong>Backup &amp; Recovery:</strong> Logging all write operations to WAL (Write-Ahead Log) files, allowing the database engine to restore its state after hardware crashes.

# File System vs DBMS

### DBMS Approach

| Feature | DBMS Detail |
| --- | --- |
| <strong>Data Redundancy</strong> | Minimized via Normalization. Changes need to be updated in only one place. |
| <strong>Data Abstraction</strong> | Provides 3 levels of abstraction (physical, conceptual, view). Hides physical storage paths from queries. |
| <strong>Concurrency</strong> | Excellent. Allows thousands of concurrent read/write operations using row-level locking. |
| <strong>Crash Recovery</strong> | Strong. Uses Transaction logs (WAL) to Undo uncommitted and Redo committed actions during startup. |
| <strong>Security</strong> | Granular. Access can be restricted down to specific tables, views, or even individual columns. |

### File System Approach

| Feature | File System Detail |
| --- | --- |
| <strong>Data Redundancy</strong> | High. Same customer information is duplicated across different department files, leading to updates anomalies. |
| <strong>Data Abstraction</strong> | None. Application code must know the physical layout (e.g., binary offset, CSV format) of the files to read them. |
| <strong>Concurrency</strong> | Poor. Concurrent modifications are blocked. The operating system locks the entire file, preventing parallel updates. |
| <strong>Crash Recovery</strong> | Weak/None. If a crash occurs mid-write, the file gets corrupted. No built-in rollback system. |
| <strong>Security</strong> | Basic. Relies on OS file permissions (read/write/execute). Anyone with read permissions sees all columns. |

# Primary Types of DBMS Models

> [!NOTE] Hierarchical Database Model
>
> Organizes data in a tree structure. Each child record has only one parent record (1:N relationship). Navigated via physical pointers.
>
> IBM IMS · Windows Registry

> [!NOTE] Network Database Model
>
> A graph-like structure. A record can have multiple parents (supports M:N relationships using pointers called sets).
>
> Integrated Data Store (IDS) · IDMS

> [!NOTE] Relational DBMS (RDBMS)
>
> Data stored in tabular format with rows and columns. Links tables using mathematical relations and keys. Employs SQL queries.
>
> PostgreSQL · MySQL · Oracle

> [!NOTE] NoSQL DBMS
>
> Non-relational schemas, optimized for horizontal scalability and high throughput. Handles semi-structured or unstructured data.
>
> Document (MongoDB) · Key-Value (Redis) · Column (Cassandra) · Graph (Neo4j)

# Database Languages

DBMS uses specialized languages to define structures, modify rows, and manage access privileges:

| Language Type | Description | Key Commands &amp; SQL Examples |
| --- | --- | --- |
| <strong>DDL</strong> (Data Definition) | Defines and modifies the physical database schema and structures. | `CREATE`, `DROP`, `ALTER`, `TRUNCATE`, `RENAME` <br>`CREATE TABLE Users (Id INT PRIMARY KEY, Name VARCHAR(50));` |
| <strong>DML</strong> (Data Manipulation) | Manipulates data records inside existing tables. | `INSERT`, `UPDATE`, `DELETE` <br>`UPDATE Users SET Name = 'Alice' WHERE Id = 1;` |
| <strong>DQL</strong> (Data Query) | Retrieves data records from the database. | `SELECT` <br>`SELECT * FROM Users WHERE Id = 1;` |
| <strong>TCL</strong> (Transaction Control) | Manages the execution flow of database transactions. | `COMMIT`, `ROLLBACK`, `SAVEPOINT` <br>`ROLLBACK TO SAVEPOINT sv1;` |
| <strong>DCL</strong> (Data Control) | Grants and revokes user access permissions. | `GRANT`, `REVOKE` <br>`GRANT SELECT ON Users TO DeveloperRole;` |

# DBMS Architectures

> [!NOTE] 1-Tier Architecture
>
> The client application, server database engine, and physical data live on the same local system. Primarily used for local testing or small embedded systems (e.g. SQLite embedded in mobile apps).

> [!NOTE] 2-Tier Architecture
>
> Client-Server model. The client application directly contacts the Database Server over the network, using database drivers like JDBC or ODBC to execute SQL queries.

> [!NOTE] 3-Tier Architecture
>
> Enterprise standard. The client application connects to an <strong>Application Server</strong> (Middle tier/API), which processes the business logic and queries the backend Database Server.

# Distributed Deployments

> [!NOTE] Homogeneous Distributed DBMS
>
> All physical database servers run the exact same DBMS software engine (e.g. all nodes are PostgreSQL). They share schema rules, making queries and distributed joins simple to coordinate.

> [!NOTE] Heterogeneous Distributed DBMS
>
> Different physical nodes run different database engines (e.g. some run Oracle, others MySQL). Requires specialized middleware translation layers to reconcile schema mapping and query operations.

# Codd's 12 Rules for Relational Databases

Dr. E.F. Codd established 12 rules (numbered 1 through 12, plus Rule 0) that define a true Relational Database Management System (RDBMS):

| Rule # | Rule Name | Description |
| --- | --- | --- |
| <strong>Rule 0</strong> | Foundation Rule | The system must manage databases entirely through its relational capabilities. |
| <strong>Rule 1</strong> | Information Rule | All data (including metadata) must be represented as values in table columns and rows. |
| <strong>Rule 2</strong> | Guaranteed Access Rule | Every data item is logically accessible using table name + primary key + column name. |
| <strong>Rule 3</strong> | Systematic Null Treatment | Nulls must represent missing/inapplicable info in a systematic way, distinct from 0 or blank. |
| <strong>Rule 4</strong> | Dynamic Online Catalog | Database schema description must be stored in tables queryable using SQL. |
| <strong>Rule 5</strong> | Comprehensive Sublanguage | Must support a single language (like SQL) covering schema definition, manipulation, integrity, and transactions. |
| <strong>Rule 6</strong> | View Updating Rule | All database views that are theoretically updatable must be updatable by the system. |
| <strong>Rule 7</strong> | High-Level Insert/Update/Delete | Must support multi-row insert, update, and delete statements. |
| <strong>Rule 8</strong> | Physical Data Independence | Changes to physical storage structures (disks, file paths) must not affect application code. |
| <strong>Rule 9</strong> | Logical Data Independence | Changes to conceptual schemas (splitting tables, adding fields) must not impact view applications. |
| <strong>Rule 10</strong> | Integrity Independence | Integrity constraints (PK, FK) must be stored in catalog metadata, not embedded in application code. |
| <strong>Rule 11</strong> | Distribution Independence | The database must function normally even if data is moved across different physical servers. |
| <strong>Rule 12</strong> | Nonsubversion Rule | Low-level access routes must not bypass schema security or integrity constraints. |
