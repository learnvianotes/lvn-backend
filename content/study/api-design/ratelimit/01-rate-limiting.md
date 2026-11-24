---
id: 74c3934b-82eb-7033-a53f-07d6a838f83d
key: topic:api-design/ratelimit
subject: api-design
topic: ratelimit
title: Rate limiting
slug: rate-limiting
order: 1
---

Rate limiting protects your API from abuse, DDoS, and accidental over-use. Every production API must have it.

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
Retry-After: 60

{ "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Retry in 60s" } }
```

# Algorithms

### Token bucket

> [!NOTE] Token bucket
>
> Bucket holds tokens. Each request consumes one. Tokens refill at fixed rate. Allows bursts up to bucket size. Used by AWS, Stripe.

> [!TIP]
>
> <strong>Best for:</strong> APIs that allow short bursts. Most flexible algorithm.

### Leaky bucket

> [!NOTE] Leaky bucket
>
> Requests enter a queue processed at fixed output rate. Smooths traffic — no bursts on output. Queue full → reject.

> [!NOTE]
>
> <strong>Best for:</strong> Protecting downstream services that can't handle bursts.

### Sliding window

> [!NOTE] Sliding window (recommended)
>
> Track request timestamps in a rolling window. At any moment, count requests in the last N seconds. No boundary vulnerability. More accurate.

> [!TIP]
>
> <strong>Best general-purpose algorithm.</strong> Implemented with Redis ZSET + timestamp scoring.

### Fixed window

> [!NOTE] Fixed window
>
> Count requests in fixed time windows. Reset counter at window boundary. Simple but has boundary vulnerability.

> [!WARNING]
>
> <strong>Vulnerability:</strong> 100 requests at 12:00:59 + 100 more at 13:00:01 = 200 requests in 2 seconds. Not suitable for strict rate limiting.

# Strategies

> [!NOTE] Per user
>
> Limits per authenticated user ID. Fair — power users can't starve others.

> [!NOTE] Per API key / tier
>
> Free: 100/min. Pro: 1000/min. Enterprise: custom. Enables monetization.

> [!NOTE] Per endpoint
>
> /login: 5/min. /search: 60/min. /export: 2/hour. Fine-grained per resource sensitivity.
