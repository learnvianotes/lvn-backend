---
id: 72b8cf4d-ab57-7aaa-92e3-f8c9752376ff
key: topic:system-design/tinyurl
subject: system-design
topic: tinyurl
title: TinyURL Shortener
slug: tinyurl-shortener
order: 1
---

High-throughput URL shortening service handling 100M URLs/day with sub-10ms redirection latency.

# Base62 Encoding vs KGS

> [!NOTE] Base62 Encoding
>
> Alphabet: `[a-z, A-Z, 0-9]` (62 chars). A 7-character string yields `62^7 = 3.52 Trillion` unique URLs.<br> Convert auto-incrementing DB ID integer to Base62: `100,000,000 → 'ft7l'`.

> [!NOTE] Key Generation Service (KGS)
>
> Standalone service pre-generates random 7-character keys and stores them in Key DB. Workers load key batches into RAM. Eliminates runtime hashing collisions completely!

# Redirection Read Path

Client (GET /ft7l) → Redis Cache → 301 / 302 Redirect to Original URL
