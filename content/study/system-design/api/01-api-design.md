---
id: 42914687-4ee5-7011-8cd2-56ebba8f168d
key: topic:system-design/api
subject: system-design
topic: api
title: API Design
slug: api-design
order: 1
---

Principles and patterns for designing robust, scalable, and developer-friendly application programming interfaces.

# REST vs GraphQL vs gRPC

> [!NOTE] REST
>
> Resource-based, HTTP verbs, stateless, JSON. Universal client support. Over-fetching/under-fetching is the main pain. Use for public APIs.

> [!NOTE] GraphQL
>
> Client specifies exact data needed. Single endpoint. No over/under-fetching. Complex queries can be expensive server-side. Great for mobile clients.

> [!NOTE] gRPC
>
> Binary protocol (Protocol Buffers). 5–10× faster than REST. Strongly typed. Bi-directional streaming. Used for internal microservice communication.

# Rate Limiting

> [!NOTE] Rate Limiting Algorithms
>
> <strong>Token Bucket:</strong> Tokens added at fixed rate; each request consumes a token. Allows bursts.<br><br><strong>Leaky Bucket:</strong> Requests processed at fixed rate regardless of input. Smooths bursts.<br><br><strong>Fixed Window Counter:</strong> Count requests per time window. Simple but vulnerable to boundary attacks.<br><br><strong>Sliding Window Log:</strong> Track timestamps of each request. Precise but memory-intensive.

> [!NOTE]
>
> <strong>Idempotency:</strong> Design mutating API endpoints to be idempotent — calling them multiple times produces the same result. Use idempotency keys (unique request IDs) to deduplicate retried requests. Critical for payment APIs.
