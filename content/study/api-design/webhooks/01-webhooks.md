---
id: b20bf5a9-b265-7b45-ac40-75bc71499419
key: topic:api-design/webhooks
subject: api-design
topic: webhooks
title: Webhooks
slug: webhooks
order: 1
---

Instead of your client asking "anything new?", the server tells your client "here's what just happened." Event-driven and efficient.

> [!INFO]
>
> <strong>Webhooks</strong> are user-defined HTTP callbacks. When an event occurs, the server sends a POST to a client-registered URL.

> [!NOTE] Polling (inefficient)
>
> Client asks every 30 seconds: "Did the payment complete?" 99% responses: "No." Wastes quota, adds latency.

> [!NOTE] Webhook (event-driven)
>
> Client registers URL. Server fires POST when payment completes. Instant. No wasted requests.

# Webhook security — critical

> [!NOTE] Verify the signature
>
> Any attacker can POST to your endpoint. Verify the HMAC-SHA256 signature on every request. Never skip this.
>
> `// Node.js:`<br>`const hmac = crypto.createHmac('sha256', secret);`<br>`hmac.update(rawBody);`<br>`const sig = hmac.digest('hex');`<br>`if (sig !== received) return res.status(401).send();`

> [!NOTE] Handle idempotency
>
> Webhooks can be delivered more than once. Processing the same event twice must not cause duplicates (double charges, double emails).
>
> `if (await db.events.exists(event.id)) {`<br>`  return res.status(200).send();`<br>`}`<br>`await processEvent(event);`

> [!NOTE]
>
> <strong>Tip:</strong> Return 200 immediately. Enqueue the event. Process async. If handler takes &gt;5s, sender times out and retries — causing duplicates.
