---
id: ebba6a9c-8107-7f9b-acc0-f2e683fcab9b
key: topic:api-design/choose
subject: api-design
topic: choose
title: Choosing a protocol
slug: choosing-a-protocol
order: 1
---

Choosing the wrong protocol creates a bottleneck. Most systems use multiple protocols for different needs.

> [!NOTE] Interaction pattern
>
> <strong>Request-response</strong> → HTTP/REST<br><strong>Real-time push</strong> → WebSockets<br><strong>Async fire-and-forget</strong> → AMQP / Kafka<br><strong>Service-to-service streaming</strong> → gRPC<br><strong>Server → client only</strong> → SSE

> [!NOTE] Performance
>
> gRPC (binary, HTTP/2) is fastest for internal. REST (text, HTTP/1.1) has more overhead. WebSockets for sustained real-time. AMQP is async — latency tolerance required.

> [!NOTE] Client compatibility
>
> Browsers → REST or GraphQL. Mobile → REST or gRPC. Internal services → gRPC. IoT → MQTT or AMQP. Third-party → REST (widest tool support).

> [!NOTE] Payload characteristics
>
> Large binary → gRPC. Small JSON → REST. Complex nested data → GraphQL. Streaming large datasets → gRPC server streaming.

> [!NOTE] Security
>
> Always TLS. gRPC has TLS via HTTP/2. HTTPS for REST. WSS for WebSockets. mTLS for zero-trust internal services.

> [!NOTE] Developer experience
>
> REST has best tooling (Postman, Swagger, curl). GraphQL has Playground. gRPC requires proto toolchain. Consider team familiarity.

# Real-world: what big apps use

| Company | External API | Internal | Real-time |
| --- | --- | --- | --- |
| Stripe | REST + Webhooks | gRPC | SSE |
| GitHub | REST + GraphQL | gRPC | SSE |
| Netflix | REST | gRPC | WebSockets |
| Slack | REST + Webhooks | Kafka + gRPC | WebSockets |
