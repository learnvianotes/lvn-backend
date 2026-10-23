---
id: 589151f7-64c7-7209-b661-7d59862ee7eb
key: topic:api-design/amqp
subject: api-design
topic: amqp
title: AMQP
slug: amqp
order: 1
---

Enterprise messaging protocol. Producers publish to a broker; consumers pull from queues. Guaranteed delivery, async communication, service decoupling.

> [!INFO]
>
> <strong>AMQP</strong> introduces a <em>message broker</em> between producer and consumer. Producers don't talk to consumers directly.

# AMQP flow

Producer<br>Web services, payments → publish Message brokerExchangeQueuesRouting keys consume → Consumer<br>Order processing

# Exchange types

> [!NOTE] Direct (1:1)
>
> Message goes to exactly one queue. Used when one consumer should handle each message.

> [!NOTE] Fanout (1:N)
>
> Message broadcast to all bound queues. Used for notifications every service needs.

> [!NOTE] Topic (pattern)
>
> `order.*.placed` matches `order.uk.placed`. Flexible routing for complex event-driven systems.

> [!NOTE]
>
> <strong>Key benefit:</strong> Decouples producer from consumer. Messages wait in queue until consumed. Dead letter queues capture failed messages for retry.

RabbitMQ · Azure Service Bus · ActiveMQ · Apache Kafka · AWS SQS
