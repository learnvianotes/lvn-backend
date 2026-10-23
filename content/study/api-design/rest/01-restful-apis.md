---
id: 5dd9c9ad-700c-7a21-85cf-1c89a5044e47
key: topic:api-design/rest
subject: api-design
topic: rest
title: RESTful APIs
slug: restful-apis
order: 1
---

Resource-based URL design, filtering, sorting, pagination, and versioning — the complete REST playbook.

> [!INFO]
>
> <strong>REST</strong> uses standard HTTP methods and resource-based URLs. 6 constraints: stateless, uniform interface, client-server separation, layered system, cacheable, code on demand (optional).

# URL patterns

```
Collection:
GET   /api/v1/products
POST  /api/v1/products

Specific resource:
GET    /api/v1/products/:id
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id

Nested (relationship):
GET /api/v1/products/:id/reviews

Actions (when needed):
POST /api/v1/orders/:id/cancel
```

# Filtering, sorting, field selection

> [!NOTE] Filtering
>
> `GET /api/v1/products?category=electronics&inStock=true&minPrice=10`

> [!NOTE] Sorting
>
> `GET /api/v1/products?sort=price_asc`<br>`GET /api/v1/products?sort=-created_at  // minus = desc`

> [!NOTE] Field selection (sparse fieldsets)
>
> `GET /api/v1/products?fields=id,name,price`<br>`// Returns only: { id, name, price }`

# REST best practices

Plural nouns (/products not /product) · No verbs in URLs (GET /users/:id not /getUser) · Version with /v1, /v2 · Consistent response envelope · Return appropriate status codes · Never return unbounded lists · Never put credentials in URLs · Never return 200 for errors
