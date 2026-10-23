---
id: 197d0ff2-9718-73bd-a45a-8967f2adae4f
key: topic:system-design/interview
subject: system-design
topic: interview
title: Interview Tips
slug: interview-tips
order: 1
---

A structured approach to system design interviews. The difference between senior and staff-level candidates is almost entirely in how they structure their thinking.

# The 5-Step Framework

> [!NOTE] 1. Clarify Requirements (5 min)
>
> Don't assume. Ask: Who are the users? What's the scale? Read vs write heavy? Any specific constraints? Latency requirements? Global or regional? Active users vs registered?

> [!NOTE] 2. Estimate Scale (3 min)
>
> QPS, storage, bandwidth. This drives your architectural choices. A system serving 1K users vs 1B users is completely different. Do this out loud — show your math.

> [!NOTE] 3. High-Level Design (10 min)
>
> Draw the major components: clients, load balancers, API servers, databases, caches, queues, CDN. Don't go deep yet — get the full picture down first.

> [!NOTE] 4. Deep Dive (15 min)
>
> The interviewer will guide you to the interesting part. Common deep dives: database schema, feed generation algorithm, consistency model, handling failures.

> [!NOTE] 5. Trade-offs (5 min)
>
> Every decision has a cost. Acknowledge them: "We chose Cassandra for writes but this makes JOINs impossible." Senior engineers always discuss what they gave up.

> [!NOTE] Wrap Up
>
> Discuss bottlenecks, monitoring strategy, how the system evolves with 10× more traffic, any open issues you'd address with more time.

# Do's and Don'ts

> [!NOTE]
>
> <strong>Think out loud.</strong> Interviewers want to see your thought process, not just the answer. A great wrong answer with good reasoning beats a lucky right answer with no explanation.
>
> <strong>Drive the conversation.</strong> Don't wait to be asked. Lead with: "I'm going to start with requirements, then estimate scale, then sketch the HLD. Does that sound good?"
>
> <strong>Don't jump to solutions.</strong> Designing before clarifying requirements is the #1 interview mistake. You'll solve the wrong problem and waste everyone's time.
>
> <strong>Don't say "use Kafka" without reasoning.</strong> Every technology choice needs a why. "Kafka because it handles high throughput and message replay" beats "Kafka" alone.
>
> <strong>Acknowledge trade-offs explicitly.</strong> "We could use PostgreSQL here for strong consistency, but at 1M writes/sec we'd need heavy sharding. Cassandra trades consistency for write throughput — that's acceptable here because..."
