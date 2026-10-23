---
id: 0ef04cfb-8ded-7e32-9a17-c643c441febd
key: topic:system-design/tinder
subject: system-design
topic: tinder
title: Tinder Dating
slug: tinder-dating
order: 1
---

A location-based matchmaking app. Core challenges: proximity search, swipe mechanics, real-time matching, recommendation quality.

# Requirements

> [!NOTE] Functional
>
> Create profile with photos · See profiles of nearby users · Swipe left/right · Match when both swipe right · Chat between matches

> [!NOTE] Non-Functional
>
> 50M DAU · 1B swipes/day ≈ 12K swipes/sec · Profile recommendations &lt;100ms · Geo-proximity within configurable radius · Eventual consistency for matches OK

# Proximity Search

> [!NOTE] Geohash-Based Discovery
>
> User location encoded as geohash. Stored in Redis (GEOSEARCH). To find nearby profiles: search current geohash + 8 neighbors (to handle boundaries). Filter by age, gender preferences. Return candidate pool. Profiles ranked by recommendation ML model (Elo-like scoring).

# Swipe &amp; Match System

User Swipes Right → Write to Swipe DB → Check if Other Swiped Right → Match! → Notify Both
