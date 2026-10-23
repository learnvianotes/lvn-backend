---
id: 175eaee1-c0d5-7378-81d0-c1aba4a07f50
key: topic:api-design/grpc
subject: api-design
topic: grpc
title: gRPC
slug: grpc
order: 1
---

High-performance, binary protocol for server-to-server communication. Used heavily in microservices. Up to 10x faster than JSON/REST.

> [!INFO]
>
> <strong>gRPC</strong> uses Protocol Buffers (protobuf) for serialization and HTTP/2 as transport. Services defined in `.proto` files. Client stubs auto-generated in any language.

> [!NOTE] Protocol Buffers (.proto)
>
> Binary format — \~5–10x smaller than JSON, faster to parse. Type-safe — schema mismatch caught at compile time.
>
> `// user.proto`<br>`syntax = "proto3";`<br><br>`message User {`<br>`  string id = 1;`<br>`  string name = 2;`<br>`  int32 age = 3;`<br>`}`<br><br>`service UserService {`<br>`  rpc GetUser (UserRequest) returns (User);`<br>`}`

> [!NOTE] 4 communication types
>
> <strong>Unary</strong> — 1 req, 1 res (like REST).<br><strong>Server streaming</strong> — 1 req, many res.<br><strong>Client streaming</strong> — many req, 1 res.<br><strong>Bidirectional</strong> — both sides stream simultaneously.

| Property | gRPC | REST |
| --- | --- | --- |
| Protocol | HTTP/2 | HTTP/1.1 |
| Payload | Binary (protobuf) | Text (JSON) |
| Performance | \~5-10x faster | Baseline |
| Streaming | Native 4 modes | No |
| Browser support | Needs gRPC-Web proxy | Native |

> [!WARNING]
>
> <strong>When NOT to use gRPC:</strong> Browser clients can't use gRPC natively. If consumers are browsers, use REST or GraphQL.
