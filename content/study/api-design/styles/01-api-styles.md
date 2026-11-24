---
id: cf6acc1d-0366-7ee9-9baf-9aec8cd3292c
key: topic:api-design/styles
subject: api-design
topic: styles
title: API styles
slug: api-styles
order: 1
---

REST for web/mobile, GraphQL for complex UIs, gRPC for microservices, WebSockets for real-time. Architecture choice shapes everything downstream.

> [!NOTE] REST — Representational State Transfer
>
> Organizes APIs around <em>resources</em> (nouns) accessed via standard HTTP methods. Stateless — every request carries all information needed. Most widely used style today.
>
> Resource-based URLs · Stateless · HTTP methods = CRUD · JSON/XML response · Best for: web &amp; mobile

> [!NOTE] GraphQL — query language API
>
> Created by Facebook. Client specifies exactly what data it needs. Single endpoint. Operations: Query (read), Mutation (write), Subscription (real-time).
>
> Single endpoint · Client-defined shape · No over-fetching · Strongly typed schema · Best for: complex UIs
>
> `query {`<br>`  user(id: "123") {`<br>`    name`<br>`    posts { title }`<br>`  }`<br>`}`

> [!NOTE] gRPC — Google Remote Procedure Call
>
> Binary Protocol Buffers over HTTP/2. Services defined in `.proto` files. Supports unary, server streaming, client streaming, bidirectional streaming. Very high performance.
>
> Binary (not JSON) · HTTP/2 · Streaming support · Auto-generated stubs · Best for: microservices

> [!NOTE] WebSockets — persistent bidirectional
>
> Upgrades an HTTP connection to a persistent, full-duplex channel. Server and client push messages at any time without polling. Built on TCP.
>
> Persistent connection · Bidirectional · Low latency push · Best for: chat, live feeds, games

# Full comparison

| Criterion | REST | GraphQL | gRPC | WebSocket |
| --- | --- | --- | --- | --- |
| Protocol | HTTP/1.1 | HTTP/1.1 | HTTP/2 | WS over TCP |
| Payload | JSON/XML | JSON | Binary (protobuf) | Any |
| Typing | Untyped | Schema-typed | Strongly typed | Untyped |
| Streaming | No | Subscriptions | Native 4 modes | Native |
| Caching | HTTP cache | App-level | No HTTP cache | No |
| Browser support | ✓ Native | ✓ Native | Needs proxy | ✓ Native |
| Best use | Public APIs | Complex UIs | Internal svcs | Real-time |
