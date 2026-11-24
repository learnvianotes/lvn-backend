---
id: 80b4698f-8425-7272-9b5d-1148ec087ec0
key: topic:system-design/estimation
subject: system-design
topic: estimation
title: Back-of-Envelope
slug: back-of-envelope
order: 1
---

The ability to quickly estimate scale requirements. Interviewers use this to see if you understand the magnitude of the problem before designing.

# Key Numbers to Memorize

> [!NOTE]
>
> 1M
>
> seconds in 12 days

> [!NOTE]
>
> 86K
>
> seconds in a day

> [!NOTE]
>
> 8KB
>
> average tweet storage

> [!NOTE]
>
> 1PB
>
> = 1,000 TB = 1M GB

# Twitter Estimation Example

> [!NOTE]
>
> <strong>Monthly Active Users</strong>: 300M
>
> <strong>Daily Active Users (30%)</strong>: 90M
>
> <strong>Tweets per user per day</strong>: 2
>
> <strong>Tweets per day</strong>: 180M
>
> <strong>Tweets per second (QPS)</strong>: \~2,100
>
> <strong>Tweet size (text + metadata)</strong>: \~1 KB
>
> <strong>Storage per day</strong>: 180 GB
>
> <strong>Storage per year</strong>: \~65 TB

# Estimation Framework

> [!NOTE] Steps
>
> 1\. <strong>Users:</strong> MAU → DAU (usually 10-30% of MAU)<br>2. <strong>Actions:</strong> How many per user per day?<br>3. <strong>QPS:</strong> Total actions ÷ 86,400 seconds<br>4. <strong>Peak QPS:</strong> 2-3× average QPS<br>5. <strong>Storage:</strong> Size of one unit × count per day × retention period<br>6. <strong>Bandwidth:</strong> Avg request size × QPS
