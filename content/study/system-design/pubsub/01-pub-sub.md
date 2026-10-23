---
id: 8f7c6996-8a69-7bdc-be0f-21decdeba4e1
key: topic:system-design/pubsub
subject: system-design
topic: pubsub
title: Pub / Sub
slug: pub-sub
order: 1
---

A messaging pattern where publishers send events to topics, and multiple subscribers independently consume those events.

# Definition

> [!INFO]
>
> In <strong>Pub/Sub</strong>, publishers emit events without knowing who will consume them. Subscribers express interest in topics and receive all matching events. Unlike message queues (one consumer per message), pub/sub delivers each event to <strong>all subscribers</strong>. Examples: Apache Kafka, Google Pub/Sub, Redis Pub/Sub.

# Pub/Sub vs Message Queue

> [!NOTE] Message Queue
>
> One message → one consumer. Message deleted after consumed. Used for task distribution — work is shared among workers.

> [!NOTE] Pub/Sub
>
> One message → all subscribers. Each subscriber gets their own copy. Used for event broadcasting — notifications, analytics, cache invalidation.

> [!NOTE]
>
> <strong>Kafka:</strong> Kafka is technically a distributed log that supports both patterns. Messages are retained (not deleted after consumption) and consumers track their own offset. This enables replay, multiple consumer groups, and extremely high throughput (millions of events/second).
