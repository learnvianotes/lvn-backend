---
id: d024b91d-79d6-7cf8-8fda-8f8f7abf8fb4
key: topic:system-design/uber
subject: system-design
topic: uber
title: Uber Platform
slug: uber-platform
order: 1
---

Real-time geospatial matching platform powering 100M+ rides. Key challenges: geospatial indexing, location ping ingestion, rider-driver matching, surge pricing.

# Requirements

> [!NOTE] Functional
>
> Drivers update location (every 4s) · Riders request ride · Match nearby drivers · Real-time location tracking · Surge pricing based on demand

> [!NOTE] Non-Functional
>
> 1M active drivers sending pings = 250k write QPS · Low matching latency (&lt;2s) · High availability · Zero lost location pings during active trip

# Geospatial Indexing: H3 / Quadtree

> [!INFO]
>
> Uber uses <strong>Uber H3</strong> (Hexagonal hierarchical spatial index). Hexagons are ideal for spatial analysis because all neighbor centroids are equidistant, eliminating edge distortion compared to rectangular grids.

# System Architecture Flow

Driver App (WebSockets) → Location Ingestion Service → Kafka → Redis (H3 Spatial Index)

Rider Request → Dispatch Service → Geospatial Matcher → Driver Notification
