---
id: 1ee299b2-42d6-7d82-9389-081c43ee7cb1
key: topic:dbms/indexing
subject: dbms
topic: indexing
title: Indexing
slug: indexing
order: 1
---

Indexing is an essential data structure technique designed to speed up search operations by reducing the number of physical disk block accesses required to retrieve rows.

# Indexing Classifications

| Index Type | Key Order Alignment | Index density | Description |
| --- | --- | --- | --- |
| <strong>Primary Index</strong> | Ordered key matches table structure. | Usually Sparse | Defined on the primary key of an ordered data file. Only one primary index can exist. |
| <strong>Clustering Index</strong> | Non-key field ordered matches table. | Sparse | Defined on a non-key ordered field (e.g., grouping employees by Department ID). |
| <strong>Secondary Index</strong> | Table physical order is independent of index key. | Dense | Defined on unordered fields (e.g., creating an index on email field). Multiple secondary indexes are allowed. |

# Index Dense vs Sparse

> [!NOTE] Dense Index
>
> An index record is created for <strong>every single search key value</strong> in the database table. Faster lookup, but requires significantly more memory.

> [!NOTE] Sparse Index
>
> An index record is created only for some search keys (typically one per data block). Requires less memory, but requires traversing the physical block to find the exact row.

# B-Tree vs B+ Tree Node Layout

Database engines use B+ Trees for relational indexes due to their physical layout advantages:

| Feature | B-Tree | B+ Tree |
| --- | --- | --- |
| <strong>Data pointers</strong> | Stored in both leaf and non-leaf nodes. | Stored <strong>only in leaf nodes</strong>. Non-leaf nodes only store search key values to route queries. |
| <strong>Leaf linking</strong> | Leaf nodes are not linked together. | Leaf nodes are connected sequentially in a <strong>doubly linked list</strong>. |
| <strong>Range Queries</strong> | Slow. Requires executing in-order traversal (up and down the tree). | Fast. Locate the starting key in a leaf, then traverse the linked list. |
| <strong>Internal Node capacity</strong> | Low, because data pointers occupy space in internal nodes. | High. Can store many child pointers, leading to a much wider fan-out and shorter tree. |
