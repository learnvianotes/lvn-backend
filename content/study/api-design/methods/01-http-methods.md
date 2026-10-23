---
id: 16c686d1-b142-7988-98a5-b4982b73235a
key: topic:api-design/methods
subject: api-design
topic: methods
title: HTTP methods
slug: http-methods
order: 1
---

Each HTTP method maps to a CRUD operation. Safe = no state change. Idempotent = repeating has the same effect as doing it once.

1. GET

   Read — retrieve a resource

   Safe and idempotent. Never change state. GET /products = all. GET /products/123 = one.

2. POST

   Create — make a new resource

   Not safe, not idempotent — calling twice creates two resources. Returns 201 Created + Location header.

3. PUT

   Update (replace) — full replacement

   Idempotent. Replaces the entire resource. Missing fields become null/default.

4. PATCH

   Update (partial) — modify fields

   Send only the fields to change. Others remain. Preferred over PUT for most updates.

5. DELETE

   Delete — remove a resource

   Idempotent — deleting something that doesn't exist is still OK. Returns 204 No Content.

6. HEAD

   Like GET — no body in response

   Check if resource exists, get metadata, validate cache freshness.

7. OPTIONS

   Describe available methods

   Returns allowed methods. Used by browsers in CORS preflight requests.

# Safe vs idempotent

| Method | Safe | Idempotent | Has body | Success code |
| --- | --- | --- | --- | --- |
| GET | ✓ | ✓ | No | 200 |
| POST | ✗ | ✗ | Yes | 201 |
| PUT | ✗ | ✓ | Yes | 200 |
| PATCH | ✗ | ✗ | Yes | 200 |
| DELETE | ✗ | ✓ | No | 204 |
