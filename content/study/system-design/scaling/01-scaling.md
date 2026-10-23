---
id: 487801f1-c42b-7b28-ab47-c7da4377df28
key: topic:system-design/scaling
subject: system-design
topic: scaling
title: Scaling
slug: scaling
order: 1
---

The ability of a system to handle growing amounts of work by adding resources. Two directions: up or out.

# Definition

> [!INFO]
>
> <strong>Scalability</strong> means your system can grow to handle more users, requests, or data without degrading performance. The two core strategies have completely different tradeoffs — most mature systems use both.

# Vertical vs Horizontal

> [!NOTE] Vertical Scaling (Scale Up)
>
> Add more CPU, RAM, or faster disk to the <strong>same machine</strong>. No code changes needed. Fast inter-process communication. But has a hard hardware limit and is a single point of failure.<br><br><strong>Example:</strong> Upgrading from 16 GB RAM → 256 GB RAM on your DB server.

> [!NOTE] Horizontal Scaling (Scale Out)
>
> Add <strong>more machines</strong> to distribute load. Theoretically unlimited. Requires load balancers, introduces network latency, and makes data consistency harder.<br><br><strong>Example:</strong> Adding 20 more API servers behind a load balancer when traffic doubles.

> [!TIP] Vertical Wins
>
> - Simple — no application changes
> - Fast IPC (no network hop)
> - Strong consistency
> - Great for small teams / early stage

> [!TIP] Horizontal Wins
>
> - No single point of failure
> - Virtually unlimited scale
> - Resilient — one node dies, others continue
> - Cost-effective at scale (commodity hardware)

# Hybrid Strategy (Real World)

> [!NOTE]
>
> <strong>Best practice:</strong> Start vertical (simpler, fewer moving parts). Once you hit hardware limits or need fault tolerance, scale horizontally. Most companies run vertically-scaled nodes that are themselves part of a horizontally scaled cluster. Cassandra: each node is powerful, and there are 100 of them.

# Pre-processing at Non-Peak Hours

> [!NOTE] Batch Work During Off-Hours
>
> Heavy computations (generating recommendations, pre-building news feeds) are done at low-traffic windows (e.g., 3am). Results are cached and served instantly during peak. Instagram pre-computes your feed rather than building it live on every request — this is why your feed loads in milliseconds even though it aggregates posts from hundreds of people.

# Related Topics

Load Balancing · DB Sharding · Microservices · Single Point of Failure
