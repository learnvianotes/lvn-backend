---
id: 54f3b5e8-7ae6-7f59-98e0-63aeb77733ae
key: topic:system-design/netflix
subject: system-design
topic: netflix
title: Netflix Streaming
slug: netflix-streaming
order: 1
---

A global video streaming service with 250M subscribers. Core challenges: content delivery at global scale, personalization, encoding pipeline.

# Requirements

> [!NOTE] Functional
>
> Stream videos globally · Personalized recommendations · Multiple profiles per account · Download for offline · Continue watching across devices

> [!NOTE] Non-Functional
>
> 250M subscribers · 15% of global internet traffic · 4K HDR streaming · &lt;200ms startup time · 99.99% availability

# Netflix Open Connect CDN

> [!INFO]
>
> Netflix operates its own CDN called <strong>Open Connect</strong>. They place servers (OCAs) directly inside ISP networks globally. During off-peak hours, Netflix proactively pushes popular content to OCAs close to viewers. Result: 95%+ of traffic served from local ISP caches — dramatically reducing costs and improving quality.

# Recommendations

> [!NOTE] Collaborative Filtering
>
> Users similar to you watched X → recommend X. Powered by offline ML training on massive viewing history. Netflix A/B tests every UI element — even the thumbnail shown for each title is personalized per user to maximize click rate.

> [!NOTE]
>
> <strong>Chaos Engineering:</strong> Netflix created Chaos Monkey — a tool that randomly kills production services to ensure the system handles failures gracefully. This is how they achieve extreme resilience: by practicing failure constantly.
