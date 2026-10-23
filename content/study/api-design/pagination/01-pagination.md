---
id: 161cdd52-0833-7a71-b08f-b64f1ee96252
key: topic:api-design/pagination
subject: api-design
topic: pagination
title: Pagination
slug: pagination
order: 1
---

Never return unbounded lists. Even if there are only 10 rows today, there will be 10 million tomorrow. Pagination is non-optional.

### Offset

> [!NOTE] Offset pagination
>
> Skip N records, return next M. Simple. Works for small datasets. UI can jump to any page.

```
GET /products?offset=40&limit=20
// SQL: SELECT * FROM products LIMIT 20 OFFSET 40

{ "data": [...], "pagination": { "total": 1250, "offset": 40, "limit": 20 } }
```

> [!WARNING]
>
> <strong>Problems at scale:</strong> Large OFFSET scans all skipped rows. Page 10,000 requires DB to scan 200,000 rows. Also: inserts/deletes cause duplicate or skipped items.

### Cursor (recommended)

> [!NOTE] Cursor pagination (Stripe, Slack, Twitter style)
>
> Each response includes an opaque cursor. Next request starts from there. O(1) regardless of depth. Stable under inserts/deletes.

```
GET /products?limit=20

// Response:
{ "data": [...], "pagination": { "next_cursor": "eyJpZCI6MTIzfQ==", "has_more": true } }

// Next request:
GET /products?after=eyJpZCI6MTIzfQ==&limit=20
```

> [!TIP]
>
> <strong>Best for:</strong> Infinite scroll, feeds, high-volume datasets. Cursor is typically base64-encoded ID.

### Keyset

> [!NOTE] Keyset pagination
>
> Uses actual column values. `WHERE id > last_id`. Performant — uses index scan not full table scan.

```
GET /products?after_id=123&limit=20
// SQL: WHERE id > 123 ORDER BY id ASC LIMIT 20
```

> [!TIP]
>
> Transparent (no opaque cursor). Works well for time-series. Requires stable sort column with index.

# Strategy comparison

| Strategy | Performance | Stable under inserts? | Random access | Best for |
| --- | --- | --- | --- | --- |
| Offset | Poor (table scan) | No | Yes | Small datasets |
| Cursor | Excellent | Yes | No | Infinite scroll, feeds |
| Keyset | Excellent | Yes | No | Time-series, append-only |
