---
id: 0224be9a-39c9-7f27-8cd1-25cf6f13bb99
key: topic:system-design/instagram
subject: system-design
topic: instagram
title: Instagram
slug: instagram
order: 1
---

A photo/video sharing platform with 2B+ users. Core challenges: photo storage at scale, feed generation, follow graph.

# Requirements

> [!NOTE] Functional
>
> Upload photos/videos · Follow users · View feed of followed users · Like &amp; comment · Stories (24h expiry)

> [!NOTE] Non-Functional
>
> 500M DAU · Read-heavy (100:1 read/write) · Photo uploads must be durable · Feed load &lt;200ms · Eventual consistency OK for feed

# Estimates

> [!NOTE]
>
> <strong>DAU</strong>: 500M
>
> <strong>Photos uploaded / day</strong>: 100M
>
> <strong>Avg photo size</strong>: 200 KB
>
> <strong>Storage / day</strong>: 20 TB
>
> <strong>10-year storage</strong>: 73 PB

# Photo Upload Flow

Client → API Gateway → Upload Service → S3 / Object Store

x → x ↓ Message Queue → CDN Invalidation + Feed Update

# Feed Generation: Push vs Pull

> [!NOTE] Fan-out on Write (Push)
>
> When user posts, pre-populate feed for all followers. Feed reads are instant. But celebrity with 100M followers = 100M writes per post. Instagram uses hybrid — fan-out for regular users, pull for celebrities.

> [!NOTE] Fan-out on Read (Pull)
>
> Build feed at read time by fetching posts from all followed users. No write amplification. But high read latency. Works well for low-follower accounts.
