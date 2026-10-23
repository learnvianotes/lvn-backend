---
id: e1b747f1-563d-7700-abcb-976d8763bdcd
key: topic:system-design/lb
subject: system-design
topic: lb
title: Load Balancing
slug: load-balancing
order: 1
---

Distributes incoming traffic across multiple servers to maximize throughput, minimize latency, and ensure no single server is overwhelmed.

# Definition

> [!INFO]
>
> <strong>Load Balancing</strong> is the process of distributing network or application traffic across a cluster of servers. It improves responsiveness and increases availability of applications.

# Algorithms

> [!NOTE] Round Robin
>
> Requests distributed sequentially. Simple, works well when servers have equal capacity and requests are similar in weight.

> [!NOTE] Weighted Round Robin
>
> Servers with higher capacity get more requests. Useful when servers have different hardware specs.

> [!NOTE] Least Connections
>
> New requests go to the server with fewest active connections. Best for variable-length requests.

> [!NOTE] IP Hash
>
> Client's IP is hashed to always route to the same server. Good for session stickiness without session storage.

# L4 vs L7 Load Balancing

> [!NOTE] L4 (Transport Layer)
>
> Routes based on IP and TCP/UDP port. Fast but no content inspection. Can't route based on URL path or HTTP headers.

> [!NOTE] L7 (Application Layer)
>
> Routes based on HTTP headers, URL, cookies, content. Slower but powerful — route /api/\* to API servers, /static/\* to CDN.

> [!NOTE]
>
> <strong>Health Checks:</strong> Load balancers continuously ping backend servers. If a server fails to respond, it's removed from the rotation automatically — this is how zero-downtime failover works.
