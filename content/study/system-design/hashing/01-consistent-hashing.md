---
id: f8780c20-a005-7d32-bd42-f6fd75f32e3e
key: topic:system-design/hashing
subject: system-design
topic: hashing
title: Consistent Hashing
slug: consistent-hashing
order: 1
---

A hashing technique that minimizes key remapping when nodes are added or removed from a distributed system.

# The Problem

> [!INFO]
>
> With simple modular hashing (key % N servers), adding or removing a server causes <strong>almost all keys to remap</strong> — catastrophic for cache systems. Consistent hashing solves this: only K/N keys need remapping when a node is added/removed (K = keys, N = nodes).

# How It Works

> [!NOTE] The Hash Ring
>
> Arrange all possible hash values in a circle (0 to 2³²). Each server is placed at a point on the ring via its hash. Each key is also hashed and assigned to the <strong>nearest server clockwise</strong>. When a server is added, only keys between the new server and its predecessor need to move.

> [!NOTE]
>
> <strong>Virtual Nodes:</strong> Each physical server is placed at multiple points on the ring (virtual nodes). This ensures even distribution even with heterogeneous servers, and further reduces hotspots. Used by Cassandra, DynamoDB, and Riak.
