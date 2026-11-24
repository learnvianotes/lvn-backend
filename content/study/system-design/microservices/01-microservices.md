---
id: ab74626e-d324-79c7-a2f0-d4c1f38f7abd
key: topic:system-design/microservices
subject: system-design
topic: microservices
title: Microservices
slug: microservices
order: 1
---

Architectural style where a large application is built as a suite of small, independently deployable services.

# Definition

> [!INFO]
>
> In <strong>microservices</strong>, each service owns a specific business capability, has its own database, and communicates via well-defined APIs (REST, gRPC, events). Services are independently deployable, scalable, and replaceable.

> [!TIP] Advantages
>
> - Independent deployment and scaling
> - Technology diversity per service
> - Fault isolation
> - Easier to understand small codebases
> - Parallel development by multiple teams

> [!DANGER] Trade-offs
>
> - Network latency between services
> - Distributed system complexity
> - Data consistency challenges
> - Operational overhead (many services)
> - Hard to trace requests across services

> [!NOTE]
>
> <strong>vs Monolith:</strong> Start with a monolith. Extract microservices when a specific component has different scaling requirements or team boundaries emerge. Don't start with microservices on day one — the overhead kills small teams.
