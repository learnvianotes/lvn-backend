---
id: 737cb4b2-31b8-7ecb-8eda-81ffe65c1025
key: topic:api-design/caching
subject: api-design
topic: caching
title: Caching
slug: caching
order: 1
---

The fastest API call is the one you don't make. HTTP has built-in caching primitives — use them.

# Caching layers

Client cache → CDN / Edge → Reverse proxy → App cache (Redis) → Database

# HTTP caching headers

```filename:Cache-Control
// Public — CDN + browser can cache
Cache-Control: public, max-age=3600

// Private — only browser caches
Cache-Control: private, max-age=300

// Never cache (auth endpoints, mutations)
Cache-Control: no-store

// stale-while-revalidate: serve stale, refresh in background
Cache-Control: public, max-age=60, stale-while-revalidate=600
```

```filename:ETag
// Server response:
ETag: "v2-abc123"

// Client's next request:
If-None-Match: "v2-abc123"

// Unchanged → 304 Not Modified (no body = saves bandwidth)
// Changed → 200 OK + new ETag + new body
```

```filename:Vary
// Different languages = different cache entries
Vary: Accept-Language

// NEVER do this — disables CDN caching effectively
Vary: Authorization
```

# What to cache vs not

> [!NOTE] Safe to cache
>
> Public product listings · Static reference data · Product images · Public profiles

> [!NOTE] Never cache
>
> Auth tokens · Payment endpoints · POST/PUT/PATCH/DELETE · OTP codes · Real-time prices
