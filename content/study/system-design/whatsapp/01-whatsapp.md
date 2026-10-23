---
id: ded794f7-fcde-713b-baec-684d7d6b5c7d
key: topic:system-design/whatsapp
subject: system-design
topic: whatsapp
title: WhatsApp
slug: whatsapp
order: 1
---

A global messaging platform with 2B users, 100B+ messages/day. Core challenges: message delivery guarantees, online presence, E2E encryption.

# Requirements

> [!NOTE] Functional
>
> 1:1 and group messaging · Media sharing (photos, video, audio) · Message delivery receipts (sent/delivered/read) · Online presence · End-to-end encryption

> [!NOTE] Non-Functional
>
> 2B users · 100B msgs/day ≈ 1.2M msg/sec · Low latency (&lt;500ms delivery) · High availability · Messages must not be lost

# Message Delivery Flow

Sender App → WebSocket Server → Message Service → Message Store (Cassandra)

x → x ↓ Presence Service → Recipient WebSocket / Push Notification

# WebSockets for Real-Time

> [!INFO]
>
> WhatsApp maintains a <strong>persistent WebSocket connection</strong> per user. This enables bidirectional, low-latency messaging without polling. When a user is offline, messages are queued in Cassandra and delivered when they reconnect. Each WebSocket server handles \~1M concurrent connections.

> [!NOTE]
>
> <strong>Delivery Receipts:</strong> Message server sends ACK to sender (✓ sent). When recipient's device receives it (✓✓ delivered). When recipient opens it (✓✓ blue = read). All receipts are separate messages flowing back through the same WebSocket infrastructure.
