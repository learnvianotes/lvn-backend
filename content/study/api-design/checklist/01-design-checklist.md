---
id: de1669fa-c1da-7f13-bca5-04ec989bd213
key: topic:api-design/checklist
subject: api-design
topic: checklist
title: Design checklist
slug: design-checklist
order: 1
---

Run through this before shipping any API to production. Most commonly missed requirements that cause pain in production.

> [!NOTE] URL & resource design
>
> 1. Plural nouns for collections (/products not /product)
> 2. No verbs in URLs
> 3. Consistent naming (snake\_case or camelCase — pick one)
> 4. Versioned with /v1, /v2
> 5. Nested resources max 2 levels deep

> [!NOTE] HTTP correctness
>
> 1. Correct HTTP method for each operation
> 2. Correct status codes (201 for create, 204 for delete)
> 3. Location header on 201 Created responses
> 4. Never 200 for errors

> [!NOTE] Security
>
> 1. All endpoints require authentication (unless explicitly public)
> 2. Authorization checked on every request
> 3. Rate limiting on every endpoint
> 4. HTTPS only — no HTTP fallback
> 5. Input validation on every parameter
> 6. CORS configured correctly (not \*)

> [!NOTE] Data & responses
>
> 1. Consistent response envelope across all endpoints
> 2. All list endpoints have pagination
> 3. Max page size enforced (cap at 100 or less)
> 4. Machine-readable error codes in responses
> 5. Request ID in all responses for debugging

> [!NOTE] Performance & caching
>
> 1. Cache-Control headers on all GET responses
> 2. ETag support for conditional GETs
> 3. Gzip compression on responses &gt; 1KB
> 4. Rate limit headers on all responses

> [!NOTE] Documentation
>
> 1. OpenAPI spec for all endpoints
> 2. All error codes documented
> 3. Request/response examples per endpoint
> 4. Changelog for all breaking changes
> 5. Deprecation notices with Sunset header

> [!NOTE]
>
> <strong>The Stripe standard:</strong> Consistent naming, excellent docs, idempotency keys, cursor pagination, semantic versioning, and clear deprecation policy. Use it as your benchmark.
