---
id: 0ab4bac3-bc82-7649-a122-9bcb84cf238c
key: topic:system-design/location
subject: system-design
topic: location
title: Geospatial Systems
slug: geospatial-systems
order: 1
---

Designing systems that store, query, and serve geospatial data efficiently — used in Uber, Tinder, Google Maps, and Yelp.

# Core Challenge

> [!INFO]
>
> Finding all points within a radius of a given location efficiently. Naive approach (scan all records and compute distance) doesn't scale. Solution: spatial indexing — partition space so only nearby candidates are checked.

# Spatial Indexing Techniques

> [!NOTE] Geohash
>
> Encodes (lat, lng) as a base-32 string. Nearby locations share a common prefix. Easy to implement, supported natively by Redis GEOSEARCH. Limitations at cell boundaries.

> [!NOTE] Quadtree
>
> Recursively subdivides space into 4 quadrants. Dynamically adapts to data density. Used internally by many mapping systems.

> [!NOTE] S2 Library (Google)
>
> Maps sphere to 1D curve using Hilbert curve. Preserves locality. Used by Google Maps, Uber, and many others.

> [!NOTE] R-Tree
>
> Index for rectangles and polygons. Standard in PostGIS/PostgreSQL spatial extensions. Good for arbitrary shapes.
