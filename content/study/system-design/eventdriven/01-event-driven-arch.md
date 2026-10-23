---
id: e3f7c71e-04a6-741a-8554-00792976b6fc
key: topic:system-design/eventdriven
subject: system-design
topic: eventdriven
title: Event Driven Arch
slug: event-driven-arch
order: 1
---

A design pattern where services communicate by producing and consuming events, enabling loose coupling and high scalability.

# Definition

> [!INFO]
>
> In <strong>event-driven architecture</strong>, services emit events when something happens (order placed, user signed up). Other services subscribe to relevant events and react. The event broker (Kafka, SNS) is the central nervous system.

# Event Flow Example

User Places Order → order.created event → Kafka Topic → Inventory Service

spacer → spacer → spacer → Email Service

> [!NOTE]
>
> <strong>CQRS + Event Sourcing:</strong> Command Query Responsibility Segregation separates read and write models. Event Sourcing stores every state change as an event — the current state is derived by replaying events. Powerful but complex.
