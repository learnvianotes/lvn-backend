---
id: 2f9e7843-aec9-713c-8644-511e72704dff
key: topic:system-design/msgqueue
subject: system-design
topic: msgqueue
title: Messaging & Eventing
slug: messaging-eventing
order: 1
---

Deep comparison of Kafka, RabbitMQ, SQS, Pulsar, NATS, along with delivery semantics, consumer group rebalancing, and DLQ patterns.

# Messaging Systems Deep Dive

# Enterprise Messaging Matrix

| Platform | Architecture | Ordering | Retention | Throughput |
| --- | --- | --- | --- | --- |
| <strong>Apache Kafka</strong> | Distributed Commit Log (Partitioned) | Strict within Partition | Log retention by Time/Size/Compaction | Ultra High (1M+ msg/sec) |
| <strong>RabbitMQ</strong> | AMQP Broker (Exchanges &amp; Queues) | Per Queue basis | Deleted upon Consumer ACK | High (\~50k msg/sec) |
| <strong>AWS SQS</strong> | Managed Queue (Standard vs FIFO) | FIFO mode only | Up to 14 days | Scalable Cloud Managed |
| <strong>Apache Pulsar</strong> | Stateless Broker + BookKeeper Storage | Per Partition / Key | Tiered Cloud Storage (S3) | Ultra High |
| <strong>NATS JetStream</strong> | Lightweight Go PubSub Engine | Stream subject ordering | Configurable Stream storage | Ultra High (Low latency) |

# Delivery Semantics

> [!NOTE] At-Most-Once
>
> Producer fires without retry, or consumer commits offset <em>before</em> processing. Zero duplicate risk, but data loss possible.

> [!NOTE] At-Least-Once
>
> Producer retries on failure; consumer commits offset <em>after</em> processing. Zero data loss, but duplicates can occur. <strong>Requires Idempotent Consumer.</strong>

> [!NOTE] Exactly-Once (EOS)
>
> Combination of Kafka Transactional Producer API (atomic multi-partition write) + Idempotent Consumer deduplication key.

# Consumer Groups &amp; Offset Management

> [!NOTE] Consumer Group Rebalancing
>
> • <strong>Eager Rebalance:</strong> All consumers stop reading, drop partition assignments, and rejoin group. Causes temporary pipeline pause.<br> • <strong>Cooperative Sticky Rebalance:</strong> Only revoked partitions are reassigned; remaining consumers continue processing uninterrupted.

> [!NOTE] Dead Letter Queue (DLQ) & Retry
>
> When a consumer fails to process a message after <em>N</em> retries (with exponential backoff + jitter), message is forwarded to a <strong>Dead Letter Queue (DLQ)</strong> for inspection, preventing pipeline head-of-line blocking.
