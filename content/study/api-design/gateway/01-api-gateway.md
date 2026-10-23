---
id: 3e69f789-d16d-7203-9933-3e7511f3d70f
key: topic:api-design/gateway
subject: api-design
topic: gateway
title: API Gateway
slug: api-gateway
order: 1
---

The single entry point for all clients. Handles cross-cutting concerns centrally — so your services don't have to.

> [!INFO]
>
> <strong>API Gateway</strong> sits between clients and backend services. Auth, rate limiting, logging, CORS — handled once at the gateway. Services focus on business logic.

# Architecture

Mobile<br>Browser<br>Partners → API GatewayAuthRate limitSSL terminationLoggingRouting → User serviceOrder servicePayment service

# What an API Gateway does

> [!NOTE] Authentication & Authorization
>
> Validates JWT tokens, API keys, OAuth before the request reaches any service. Services trust the gateway already verified identity.

> [!NOTE] SSL termination
>
> Handles HTTPS at the gateway. Backend services communicate over plain HTTP within the private network. Manages TLS certificates in one place.

> [!NOTE] Request routing
>
> Routes `/api/users/*` to user-service. A/B routing, canary deployments, blue-green releases at gateway level.

> [!NOTE] Observability
>
> Centralized logging, request tracing, metrics. Every request logged once. Correlation IDs added for distributed tracing.

AWS API Gateway · Kong · nginx · Envoy · Apigee · Azure API Management

> [!WARNING]
>
> <strong>Don't:</strong> Put business logic in the gateway. Only infrastructure concerns. Logic there is hard to test, version, and debug.
