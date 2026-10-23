---
id: 52114e4e-9f3b-7095-8fe4-1dbf3d8be472
key: topic:api-design/status
subject: api-design
topic: status
title: Status codes
slug: status-codes
order: 1
---

Status codes are your API's communication language. Use the right code — don't return 200 for errors.

1. 200

   OK

   GET success

2. 201

   Created

   POST success. Include Location header.

3. 202

   Accepted

   Async processing — not yet done

4. 204

   No content

   DELETE / PATCH success — no body

5. 301

   Moved permanently

   Resource URL changed forever

6. 304

   Not modified

   Cache valid — use cached version

7. 400

   Bad request

   Invalid params, malformed JSON — client's fault

8. 401

   Unauthorized

   Not authenticated — send valid credentials

9. 403

   Forbidden

   Authenticated but not authorized

10. 404

    Not found

    Resource doesn't exist

11. 409

    Conflict

    Duplicate resource or optimistic lock failed

12. 422

    Unprocessable entity

    Valid syntax but semantic validation failed

13. 429

    Too many requests

    Rate limit exceeded. Include Retry-After.

14. 500

    Internal server error

    Unexpected server failure

15. 503

    Service unavailable

    Overloaded or down for maintenance

# Good error response shape

```json filename:JSON
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid product ID",
    "field": "productId",
    "request_id": "req_abc123"
  }
}
```

> [!NOTE]
>
> <strong>Rule:</strong> Always return machine-readable error code + human-readable message. Include request\_id. Never raw stack traces in production.

# Critical distinctions

> [!NOTE]
>
> <strong>401 vs 403:</strong> 401 = "I don't know who you are." 403 = "I know who you are, but you can't do this."

> [!NOTE]
>
> <strong>400 vs 422:</strong> 400 = malformed JSON or missing field. 422 = valid JSON but business logic validation failed.

> [!WARNING]
>
> <strong>Never return 200 for errors.</strong> This breaks HTTP caching, monitoring, and client error handling.
