---
id: 05861ef4-6bc9-76d8-95e6-54235ed63b6d
key: topic:api-design/ws
subject: api-design
topic: ws
title: WebSockets
slug: websockets
order: 1
---

Persistent, bidirectional connection. Replaces HTTP polling for real-time applications. One connection, unlimited messages in both directions.

> [!INFO]
>
> <strong>WebSocket</strong> — upgrades an HTTP connection into a persistent, full-duplex channel. Both sides push data at any time. Runs over TCP.

> [!NOTE] HTTP polling (old way)
>
> Client asks "Any new data?" → "No." → asks again → "No." Wasted bandwidth, added latency, not truly real-time.
>
> Always 1+ polling interval behind. Wastes bandwidth on empty responses.

> [!NOTE] WebSocket (right way)
>
> One HTTP handshake → upgrades to WebSocket → stays open forever. Server pushes the instant data is available.
>
> Real-time, minimal latency. Bidirectional over single connection.

# WebSockets vs SSE

> [!NOTE] WebSockets (bidirectional)
>
> Full-duplex — both sides send. Better for chat, gaming, collaborative editing. Needs custom reconnection logic.

> [!NOTE] SSE — Server-Sent Events (server→client only)
>
> One-way server push. Automatic reconnection built-in. Works through proxies. Good for dashboards, live feeds, notifications.

# Use cases

Chat apps (WhatsApp, Slack) · Live trading · Multiplayer games · Live collaboration (Figma) · Real-time notifications · Live sports
