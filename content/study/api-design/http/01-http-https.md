---
id: e4445caa-fd71-7f84-abbd-47036729ea59
key: topic:api-design/http
subject: api-design
topic: http
title: HTTP / HTTPS
slug: http-https
order: 1
---

The foundation of data exchange on the web. Every REST API runs on HTTP. Understanding request/response structure is non-negotiable.

> [!INFO]
>
> <strong>HTTP</strong> — a stateless, text-based application protocol. Client sends a request with method + URL + headers + body. Server responds with status code + headers + body. No memory of previous requests.

# Request / response anatomy

> [!NOTE] HTTP request
>
> `GET /api/products/123 HTTP/1.1`<br>`Host: api.example.com`<br>`Authorization: Bearer tk9382nf...`<br>`Accept: application/json`<br>`Accept-Encoding: gzip`

> [!NOTE] HTTP response
>
> `HTTP/1.1 200 OK`<br>`Content-Type: application/json`<br>`Cache-Control: max-age=3600`<br>`ETag: "abc123"`<br>`X-RateLimit-Remaining: 99`<br><br>`{ "id": 123, "price": 19.99 }`

# HTTPS = HTTP + TLS/SSL

> [!TIP]
>
> <strong>Benefits:</strong> data encrypted in transit, data integrity, server authentication, SEO benefits. Required for any authentication to be secure.

> [!WARNING]
>
> <strong>Risks without:</strong> man-in-the-middle attacks, data tampering, credential exposure, session hijacking. Never ship a production API over plain HTTP.

# Key headers

> [!NOTE] Content-Type
>
> Format of the body. `application/json`, `multipart/form-data`. Must be set on requests with body and on all responses.

> [!NOTE] Authorization
>
> `Bearer <token>` for JWT/OAuth, `Basic <base64>`. Never put credentials in URL query params.

> [!NOTE] Cache-Control
>
> `max-age=3600` = cache 1hr. `no-store` = never cache. `stale-while-revalidate` = serve stale, refresh background.

> [!NOTE] ETag
>
> Entity tag for conditional requests. Client sends `If-None-Match` → server returns 304 if unchanged. Saves bandwidth.

> [!NOTE] Rate limit headers
>
> `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`. Always include so clients back off gracefully.

> [!NOTE] Idempotency-Key
>
> Client sends UUID. Server deduplicates. Critical for payment APIs — prevents double charges on network retries.
