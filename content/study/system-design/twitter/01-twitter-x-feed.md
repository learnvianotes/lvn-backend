---
id: 6dfcdb19-c2f7-7398-9efe-d27adc8b66f0
key: topic:system-design/twitter
subject: system-design
topic: twitter
title: Twitter / X Feed
slug: twitter-x-feed
order: 1
---

Real-time social network processing 500M tweets/day. Key challenges: hybrid fanout architecture, celebrity problem, counter service.

# Hybrid Timeline Fanout

> [!NOTE] Fanout-on-Write (Push Model)
>
> For regular users (&lt;10k followers): When a user tweets, background workers inject tweet ID into every follower's Redis Home Timeline cache. Ultra-fast feed reads!

> [!NOTE] Fanout-on-Read (Pull Model)
>
> For celebrities (&gt;100k followers): Pushing a tweet to 100M followers causes write amplification explosion. Celebrity tweets are stored in a celebrity tweet store and merged at read time when follower loads feed.
