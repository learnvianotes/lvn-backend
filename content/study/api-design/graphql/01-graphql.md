---
id: 57610891-3d82-7d71-80f5-85d302ecd11a
key: topic:api-design/graphql
subject: api-design
topic: graphql
title: GraphQL
slug: graphql
order: 1
---

Created by Facebook 2012, open-sourced 2015. Solves REST's over-fetching and N+1 request problems with a typed query language.

> [!INFO]
>
> <strong>GraphQL</strong> — client asks for exactly what it needs. Single endpoint handles all operations. Schema is the contract. Self-documenting via introspection.

> [!NOTE] REST: 4 requests for one screen
>
> `GET /api/users/123`<br>`GET /api/users/123/posts`<br>`GET /api/users/123/comments`<br>`GET /api/users/123/likes`<br>`→ 4 round trips, wasted data`

> [!NOTE] GraphQL: 1 request, exact data
>
> `query {`<br>`  user(id: "123") {`<br>`    name`<br>`    posts { title }`<br>`    comments { text }`<br>`  }`<br>`} → 1 round trip`

# Operations

> [!NOTE] Query (read)
>
> Fetch data. Client specifies exact fields. Equivalent to GET.

> [!NOTE] Mutation (write)
>
> Create, update, or delete data. Equivalent to POST/PUT/DELETE.

> [!NOTE] Subscription (real-time)
>
> WebSocket-based. Server pushes updates when data changes.

> [!WARNING]
>
> GraphQL always returns <strong>200 OK</strong> — even for errors. You must check the `errors` field. Common gotcha from REST.

# GraphQL pitfalls

> [!NOTE] N+1 query problem
>
> Resolving each user's posts individually fires N database queries. Fix: DataLoader (batching resolver).

> [!NOTE] Query depth attacks
>
> Deeply nested queries cause exponential DB load. Fix: max query depth, complexity limits.

> [!NOTE] Caching complexity
>
> All goes through POST /graphql — HTTP caching doesn't work. Need app-level caching (Apollo Client, persisted queries).

> [!NOTE] Over-permissive schemas
>
> Apply field-level authorization — not just resolver-level. Check auth per field for sensitive data.
