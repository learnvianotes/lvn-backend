---
id: a0da2349-7464-7e13-a8b3-7d931f91c3c1
key: topic:api-design/intro
subject: api-design
topic: intro
title: Overview
slug: overview
order: 1
---

APIs are the contracts between software components. This guide covers every layer — from transport protocols up to security patterns, versioning, and real-world design decisions.

> [!NOTE] What is an API?
>
> Application Programming Interface. A documented contract that defines what requests can be made, how to make them, and what responses to expect. The interface between client and server.

> [!NOTE] API as contract
>
> The API contract defines: valid requests, required parameters, authentication method, response shape, error codes. Break the contract = you break every consumer simultaneously.

> [!NOTE] Why API design matters
>
> A bad API is forever. Once developers integrate your API, changing it breaks them. Good design reduces support burden, improves DX, enables scaling, and prevents security holes.

> [!NOTE] API consumers
>
> Internal teams (microservices), external developers (third-party integrations), mobile apps, browsers, IoT devices, partner systems. Each has different needs and constraints.

# Core flow

Client ↔ API (contract) ↔ Server / data

# Topics in this guide

> [!NOTE] API styles
>
> REST, GraphQL, gRPC — when to use which and why they exist.

> [!NOTE] Protocols
>
> HTTP, WebSockets, AMQP, gRPC, TCP/UDP — the wires your API runs on.

> [!NOTE] Versioning
>
> URL, header, query param strategies. How to evolve APIs without breaking consumers.

> [!NOTE] Caching
>
> ETag, Cache-Control, CDN caching, and when not to cache.

> [!NOTE] Rate limiting
>
> Token bucket, leaky bucket, sliding window — algorithms and strategies.

> [!NOTE] Security
>
> AuthN, AuthZ, rate limiting, CORS, SQL injection, CSRF, XSS.

# API design quality spectrum

> [!NOTE] Bad API
>
> Inconsistent naming. No versioning. 200 for all errors. No pagination. Returns entire object graph. Undocumented. No rate limiting. Changing behavior without notice.

> [!NOTE] OK API
>
> Basic REST conventions. Some error codes correct. Some docs. No guarantees on stability. Versioning exists but inconsistent. Limited pagination support.

> [!NOTE] Great API
>
> Consistent naming. Full OpenAPI docs. Proper status codes. Versioned with deprecation policy. Cursor pagination. Rate limit headers. Idempotency keys. Predictable evolution.
