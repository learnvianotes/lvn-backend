---
id: 8ea4e0b3-7646-71a5-b7ab-747279d00021
key: topic:api-design/versioning
subject: api-design
topic: versioning
title: Versioning
slug: versioning
order: 1
---

Once clients depend on your API, you can never break them. Versioning lets you evolve the API while keeping old consumers working.

> [!NOTE] Breaking changes (require new version)
>
> Removing a field · Renaming a field · Changing field type · Removing an endpoint · Changing URL structure · Changing auth mechanism

> [!NOTE] Non-breaking changes (safe)
>
> Adding a new field · Adding a new endpoint · Making required optional · Adding new optional params · Performance improvements

# Versioning strategies

### URL path

> [!NOTE] URL path versioning (most common)
>
> Version in the URL. Visible, easy to test with curl. Used by Stripe, Twitter, GitHub.

```
GET /api/v1/users/123
GET /api/v2/users/123
// v1 and v2 run simultaneously
```

> [!TIP]
>
> Easy to understand. Logs show which version each client uses. Simple to route in API gateway.

### Request header

> [!NOTE] Custom request header
>
> Client sends a custom header. URL stays stable.

```
GET /api/users/123
X-API-Version: 2
```

> [!WARNING]
>
> Less visible. Harder to test. Easy to forget the header. Hard to share versioned URLs.

### Query param

> [!NOTE] Query parameter versioning
>
> Version as a query param. Easy to test but pollutes the URL.

```
GET /api/users/123?version=2
```

> [!WARNING]
>
> Not recommended for primary strategy. Easy to accidentally omit.

# Deprecation policy

> [!NOTE]
>
> 1. <strong>Announce 6–12 months ahead</strong>
>
>    Add `Deprecation` and `Sunset` headers to v1 responses.
>
> 2. <strong>Document the migration</strong>
>
>    Write a clear migration guide. Show what changed, why, and how to update.
>
> 3. <strong>Reach out to heavy users</strong>
>
>    Monitor which API keys still hit v1. Email them directly.
>
> 4. <strong>Sunset the version</strong>
>
>    Return 410 Gone after the sunset date.
