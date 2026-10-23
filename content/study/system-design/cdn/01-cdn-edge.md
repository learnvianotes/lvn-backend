---
id: 177d8890-0804-7662-8d90-ede5fdbcd7d6
key: topic:system-design/cdn
subject: system-design
topic: cdn
title: CDN & Edge
slug: cdn-edge
order: 1
---

A geographically distributed network of servers that caches and serves content from locations close to users.

# Definition

> [!INFO]
>
> A <strong>CDN</strong> caches static content (images, CSS, JS, videos) at edge servers worldwide. User requests are routed to the nearest edge node — reducing latency from 150ms (cross-continent) to 10–20ms. Examples: Cloudflare, AWS CloudFront, Akamai, Fastly.

# Push vs Pull CDN

> [!NOTE] Push CDN
>
> You proactively push content to edge nodes. Full control over what's cached. Good for known, large assets (videos). Must manage cache invalidation yourself.

> [!NOTE] Pull CDN
>
> Edge fetches from origin on first miss, caches with TTL. Simpler. Cache fills organically with popular content. Risk of cache miss storms on new content.

> [!NOTE]
>
> <strong>CDN for dynamic content:</strong> Modern CDNs can also accelerate dynamic content via persistent connections, TCP optimization, and smart routing — not just static files. Cloudflare Workers lets you run code at the edge.
